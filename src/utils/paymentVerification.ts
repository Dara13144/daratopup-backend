import { PrismaClient } from '@prisma/client';
import { checkBakongPaymentStatus, PaymentVerificationContext } from './paymentMock';
import { sendTelegramNotification } from './telegram';

const prisma = new PrismaClient();

const SANDBOX_MODE = process.env.SANDBOX_MODE === 'true';
const SANDBOX_AUTO_MS = 15000; // sandbox auto-approve after 15s

// ── Logging helpers ──────────────────────────────────────────────────────────
function log(tag: string, txnId: string, msg: string)    { console.log(`[${tag}] [${txnId}] ${msg}`); }
function logErr(tag: string, txnId: string, msg: string) { console.error(`[${tag}] X [${txnId}] ${msg}`); }

/**
 * verifyAbaKhqrPayment
 *
 * Calls the live ABA/Bakong gateway APIs to check whether the MD5-identified
 * transaction has been paid. Validates amount, currency, and merchant ID.
 * In SANDBOX_MODE, auto-approves after SANDBOX_AUTO_MS have elapsed.
 *
 * Returns true  -> payment confirmed by gateway (or sandbox timer elapsed)
 * Returns false -> not yet paid
 */
export async function verifyAbaKhqrPayment(order: any): Promise<boolean> {
  const txnId = order.paymentTxnId as string;
  const md5   = order.paymentMd5 as string | null;

  if (!md5) {
    logErr('Verification', txnId, 'No MD5 hash stored for this order -- cannot verify.');
    return false;
  }

  log('Verification', txnId, `Starting gateway verification. MD5=${md5} Amount=$${order.price}`);

  // -- 1. Replay attack guard ------------------------------------------------
  const replayOrder = await prisma.order.findFirst({
    where: { paymentMd5: md5, paymentStatus: 'PAID', id: { not: order.id } },
  });
  if (replayOrder) {
    logErr('Verification', txnId,
      `REPLAY ATTACK: MD5 "${md5}" already used by paid order "${replayOrder.paymentTxnId}". Rejecting.`);
    return false;
  }

  // -- 2. Live gateway check -------------------------------------------------
  const ctx: PaymentVerificationContext = {
    expectedAmount:     order.price,
    expectedCurrency:   'USD',
    expectedMerchantId: process.env.BAKONG_ACCOUNT_ID ? process.env.BAKONG_ACCOUNT_ID.replace(/['"]/g, '').trim() : undefined,
  };
  const khpayTxnId = txnId.startsWith('bk_') ? txnId : undefined;

  try {
    const isPaid = await checkBakongPaymentStatus(md5, khpayTxnId, ctx);
    if (isPaid) {
      log('Verification', txnId, 'Gateway confirmed payment PAID.');
      return true;
    }
    log('Verification', txnId, 'Gateway returned NOT PAID yet.');
  } catch (err: any) {
    logErr('Verification', txnId, `Gateway call error: ${err.message || err}`);
  }

  // -- 3. Sandbox auto-approve (testing only) --------------------------------
  if (SANDBOX_MODE) {
    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    if (elapsedMs >= SANDBOX_AUTO_MS) {
      log('Verification', txnId,
        `[SANDBOX] ${Math.round(elapsedMs / 1000)}s elapsed >= 15s threshold. Auto-approving.`);
      return true;
    }
    log('Verification', txnId,
      `[SANDBOX] Only ${Math.round(elapsedMs / 1000)}s elapsed -- waiting for 15s.`);
  }

  return false;
}

/**
 * processVerifiedPayment
 *
 * Runs inside an atomic transaction block. Marks the payment as PAID and
 * allocates stock vouchers if the product is a code voucher category, else
 * delivers immediately. Sends Telegram alert notifications.
 */
export async function processVerifiedPayment(order: any, gatewayRef: string) {
  const txnId = order.paymentTxnId;

  log('Delivery', txnId, `Initiating delivery workflow. GatewayRef: "${gatewayRef}"`);

  // Guard: idempotency
  const freshCheck = await prisma.order.findUnique({ where: { id: order.id } });
  if (freshCheck?.paymentStatus === 'PAID' || freshCheck?.paymentStatus === 'SUCCESS') {
    log('Delivery', txnId, 'Order already PAID or SUCCESS -- skipping duplicate processing.');
    return {
      deliverySuccess: freshCheck.status === 'SUCCESS' || freshCheck.status === 'PAID',
      deliveredCode:   freshCheck.stockDeliveredCode,
      currentOrder:    freshCheck,
    };
  }

  // Execute database updates and stock claiming atomically
  const result = await prisma.$transaction(async (tx) => {
    let stockCode: string | null = null;
    let isVoucher = order.package?.category === 'CODE_VOUCHER';

    if (isVoucher) {
      // Find an unused stock item for this package
      const stockItem = await tx.stock.findFirst({
        where: { packageId: order.packageId, isUsed: false },
        orderBy: { createdAt: 'asc' },
      });

      if (stockItem) {
        stockCode = stockItem.code;
        // Mark stock as used
        await tx.stock.update({
          where: { id: stockItem.id },
          data: { isUsed: true, orderId: order.id },
        });
        log('Delivery', txnId, `Claimed stock code: "${stockCode}"`);
      } else {
        logErr('Delivery', txnId, `OUT OF STOCK for package ${order.packageId}`);
      }
    }

    const deliveryStatus = isVoucher
      ? (stockCode ? 'DELIVERED' : 'FAILED')
      : 'DELIVERED'; // Direct top-ups are immediately delivered on payment

    const finalStatus = deliveryStatus === 'DELIVERED' ? 'PAID' : 'FAILED';

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'SUCCESS',
        status: finalStatus,
        deliveryStatus: deliveryStatus,
        paidAt: new Date(),
        gatewayRef: gatewayRef,
        stockDeliveredCode: stockCode,
      },
      include: { package: { include: { product: true } } },
    });

    return { updated, stockCode, deliveryStatus };
  });

  log('Delivery', txnId, `Transaction committed. deliveryStatus=${result.deliveryStatus} finalStatus=${result.updated.status}`);

  // Send Telegram Notification
  try {
    const deliveryEmoji = result.deliveryStatus === 'DELIVERED' ? '✅' : '⚠️';
    const deliveryDetail = result.stockCode
      ? `🎫 <b>Voucher Code:</b> <code>${result.stockCode}</code>`
      : `📲 <b>Top-Up Delivery:</b> ${result.deliveryStatus}`;

    const productSlug = result.updated.package?.product?.slug || order.package?.product?.slug || '';
    const isMLBB = productSlug.includes('mobile-legends');
    const isFreeFire = productSlug.includes('free-fire');
    const isValorant = productSlug.includes('valorant');
    const isBloodStrike = productSlug.includes('blood-strike');
    const isHoK = productSlug.includes('honor-of-kings');
    const isFarlight = productSlug.includes('farlight');
    const isDeltaForce = productSlug.includes('delta-force');

    let credentialsLabel = `<b>Player ID:</b> <code>${order.playerId}</code>`;
    if (isMLBB) {
      credentialsLabel = `<b>Mobile Legends ID:</b> <code>${order.playerId}</code>\n<b>Server ID:</b> <code>${order.playerZoneId || 'N/A'}</code>`;
    } else if (isFreeFire) {
      credentialsLabel = `<b>Free Fire ID:</b> <code>${order.playerId}</code>`;
    } else if (isValorant) {
      credentialsLabel = `<b>Valorant ID:</b> <code>${order.playerId}</code>`;
    } else if (isBloodStrike) {
      credentialsLabel = `<b>Blood Strike ID:</b> <code>${order.playerId}</code>`;
    } else if (isHoK) {
      credentialsLabel = `<b>Honor of Kings ID:</b> <code>${order.playerId}</code>`;
    } else if (isFarlight) {
      credentialsLabel = `<b>Farlight 84 ID:</b> <code>${order.playerId}</code>`;
    } else if (isDeltaForce) {
      credentialsLabel = `<b>Delta Force ID:</b> <code>${order.playerId}</code>`;
    } else if (order.playerZoneId) {
      credentialsLabel = `<b>Player ID:</b> <code>${order.playerId}</code>\n<b>Server/Zone ID:</b> <code>${order.playerZoneId}</code>`;
    }

    await sendTelegramNotification(
      `🛒 <b>New Order Placed & Verified!</b>\n` +
      `-----------------------------------------\n` +
      `<b>ID:</b> <code>${result.updated.id}</code>\n` +
      `<b>Txn ID:</b> <code>${txnId}</code>\n` +
      `<b>Game:</b> ${result.updated.package?.product?.name || order.package?.product?.name || 'N/A'}\n` +
      `<b>Package:</b> ${result.updated.package?.name || order.package?.name || 'N/A'}\n` +
      `${credentialsLabel}\n` +
      `<b>Nickname:</b> ${order.playerNickname || 'N/A'}\n` +
      `<b>Price:</b> $${order.price.toFixed(2)}\n` +
      `<b>Payment:</b> ${order.paymentMethod} (Verified)\n` +
      `<b>Delivery:</b> ${deliveryEmoji} ${result.deliveryStatus}\n` +
      `${deliveryDetail}`
    );
    log('Telegram', txnId, 'Successfully dispatched Telegram notification alert.');
  } catch (tgErr: any) {
    logErr('Telegram', txnId, `Failed to dispatch Telegram alert: ${tgErr.message}`);
  }

  return {
    deliverySuccess: result.deliveryStatus === 'DELIVERED',
    deliveredCode:   result.stockCode,
    currentOrder:    result.updated,
  };
}

/**
 * expireOldOrders
 *
 * Scans the database for orders still pending after 30 minutes, marking them
 * as EXPIRED / FAILED to prevent delayed auto-fulfillment issues.
 */
export async function expireOldOrders() {
  const expiryCutoff = new Date(Date.now() - 15 * 1000); // 15 seconds ago

  try {
    const expiredOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        createdAt: { lt: expiryCutoff },
      },
    });

    if (expiredOrders.length === 0) return;

    console.log(`[Sweeper] Found ${expiredOrders.length} expired/stale orders. Processing cleanup...`);

    for (const order of expiredOrders) {
      // Final live check to avoid cancelling paid orders
      const isPaid = await checkBakongPaymentStatus(order.paymentMd5 || '', undefined, {
        expectedAmount: order.price,
        expectedCurrency: 'USD',
      });
      if (isPaid) {
        console.log(`[Sweeper] Order ${order.paymentTxnId} confirmed PAID during expiry check. Processing delivery instead of expiring.`);
        await processVerifiedPayment(order, `SWEEPER-AUTO-${order.paymentMd5 || order.paymentTxnId}`);
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'EXPIRED',
            status: 'CANCELLED',
            deliveryStatus: 'FAILED',
          },
        });
        log('Sweeper', order.paymentTxnId, 'Order flagged as EXPIRED / CANCELLED (older than 15 seconds).');
      }
    }
  } catch (err: any) {
    console.error(`[Sweeper] Failed to clean up expired orders: ${err.message}`);
  }
}
