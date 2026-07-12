"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const paymentMock_1 = require("../utils/paymentMock");
const paymentVerification_1 = require("../utils/paymentVerification");
const telegram_1 = require("../utils/telegram");
const router = (0, express_1.Router)();
// POST /api/payments/webhook  AND  POST /api/webhook
router.post('/', async (req, res) => {
    try {
        console.log('[Webhook] 📥 Received callback request.');
        console.log('[Webhook] Request headers:', JSON.stringify(req.headers));
        console.log('[Webhook] Request body:', JSON.stringify(req.body, null, 2));
        // Resolve MD5 using all possible paths
        const rawMd5 = req.body.md5 ||
            req.body.md5Hash ||
            req.body.req_khqr?.md5 ||
            req.body.data?.md5 ||
            req.body.data?.md5Hash;
        const sanitizedMd5 = rawMd5 ? rawMd5.toLowerCase().trim() : '';
        // Resolve Transaction ID using all possible paths
        const transactionId = req.body.transactionId ||
            req.body.transaction_id ||
            req.body.trans_id ||
            req.body.bill_number ||
            req.body.req_khqr?.bill_number ||
            req.body.data?.bill_number ||
            req.body.data?.transaction_id ||
            req.body.data?.trans_id;
        // Resolve Session ID
        const sessionId = req.body.session_id ||
            req.body.data?.session_id ||
            req.body.id;
        // Resolve Status using all possible paths
        const rawStatus = req.body.status ||
            req.body.paymentStatus ||
            req.body.data?.status;
        // Resolve Amount using all possible paths
        const amount = req.body.amount ||
            req.body.req_khqr?.amount ||
            req.body.data?.amount;
        // Resolve Currency using all possible paths
        const currency = req.body.currency ||
            req.body.req_khqr?.currency ||
            req.body.data?.currency;
        console.log(`[Webhook] Parsed variables: MD5="${sanitizedMd5}", TxnID="${transactionId || 'N/A'}", SessionID="${sessionId || 'N/A'}", Status="${rawStatus || 'N/A'}", Amount="${amount || 'N/A'}", Currency="${currency || 'N/A'}"`);
        const signature = req.headers['x-bakong-signature'];
        const bakongApiKey = process.env.BAKONG_API_KEY || '';
        // Webhook signature verification
        if (bakongApiKey && signature) {
            const isValid = (0, paymentMock_1.verifyBakongWebhook)(rawMd5 || '', transactionId || '', signature, bakongApiKey);
            if (!isValid) {
                console.warn('[Webhook] ⚠️ Invalid signature! Rejecting.');
                return res.status(401).json({ error: 'Invalid webhook signature' });
            }
            console.log('[Webhook] ✅ Signature verified.');
        }
        else {
            console.log('[Webhook] ⚠️ BAKONG_API_KEY not set — skipping signature verification (sandbox mode).');
        }
        if (!transactionId && !sanitizedMd5 && !sessionId) {
            console.warn('[Webhook] ❌ Error: Neither transactionId, md5, nor sessionId is present.');
            return res.status(400).json({ error: 'transactionId, md5, or session_id is required' });
        }
        // Find Order
        let order = null;
        if (sessionId) {
            order = await prisma_1.default.order.findFirst({
                where: { gatewayRef: sessionId },
                include: { package: { include: { product: true } } },
            });
        }
        if (!order && transactionId) {
            order = await prisma_1.default.order.findUnique({
                where: { paymentTxnId: transactionId },
                include: { package: { include: { product: true } } },
            });
        }
        if (!order && sanitizedMd5) {
            order = await prisma_1.default.order.findFirst({
                where: {
                    OR: [
                        { paymentMd5: sanitizedMd5 },
                        { paymentMd5: sanitizedMd5.toUpperCase() }
                    ]
                },
                include: { package: { include: { product: true } } },
            });
        }
        if (!order) {
            console.warn(`[Webhook] ❌ Order NOT found for sessionId: "${sessionId || 'N/A'}", txnId: "${transactionId || 'N/A'}" or md5: "${sanitizedMd5 || 'N/A'}"`);
            return res.status(200).json({ message: 'Order not found, acknowledged' });
        }
        if (order.paymentStatus === 'PAID') {
            console.log(`[Webhook] Order ${order.paymentTxnId} already marked PAID. Skipping.`);
            return res.status(200).json({ message: 'Order already processed' });
        }
        // Verify Amount and Currency
        if (amount) {
            const parsedAmount = parseFloat(amount);
            const webhookCurrency = currency ? currency.toString().toUpperCase().trim() : 'USD';
            let isAmountMatch = false;
            if (webhookCurrency === 'KHR') {
                const expectedKhr = Math.round(order.price * 4100);
                isAmountMatch = Math.abs(parsedAmount - expectedKhr) <= 10;
                if (!isAmountMatch) {
                    console.warn(`[Webhook] ❌ Amount mismatch (KHR)! Webhook=${parsedAmount}, Order expected KHR=${expectedKhr} (Order price USD=${order.price})`);
                }
            }
            else {
                isAmountMatch = Math.abs(parsedAmount - order.price) <= 0.05;
                if (!isAmountMatch) {
                    console.warn(`[Webhook] ❌ Amount mismatch (USD)! Webhook=${parsedAmount}, Order expected USD=${order.price}`);
                }
            }
            if (!isAmountMatch) {
                return res.status(400).json({ error: 'Amount mismatch' });
            }
        }
        if (currency) {
            const normalizedCurrency = currency.toString().toUpperCase().trim();
            if (normalizedCurrency !== 'USD' && normalizedCurrency !== 'KHR') {
                console.warn(`[Webhook] ❌ Currency not supported! Webhook currency=${normalizedCurrency}`);
                return res.status(400).json({ error: 'Currency not supported' });
            }
        }
        const isSuccess = typeof rawStatus === 'string' &&
            ['PAID', 'SUCCESS', 'paid', 'success'].includes(rawStatus.toUpperCase());
        if (!isSuccess) {
            console.warn(`[Webhook] ⚠️ Payment reported unsuccessful. Raw status: "${rawStatus}"`);
            await prisma_1.default.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'FAILED', status: 'FAILED', deliveryStatus: 'FAILED' },
            });
            await (0, telegram_1.sendTelegramNotification)(`❌ <b>Bakong Payment Failed (Webhook)</b>\n` +
                `-----------------------------------------\n` +
                `<b>Txn ID:</b> <code>${order.paymentTxnId}</code>\n` +
                `<b>Status from Bakong:</b> ${rawStatus}\n` +
                `<b>Amount:</b> $${order.price.toFixed(2)}`);
            return res.status(200).json({ message: 'Payment failure recorded' });
        }
        // Replay attack check
        const replayCheck = await prisma_1.default.order.findFirst({
            where: {
                paymentMd5: sanitizedMd5 || order.paymentMd5 || '',
                paymentStatus: 'PAID',
                id: { not: order.id }
            }
        });
        if (replayCheck) {
            console.warn(`[Webhook] ❌ Replay attack detected! MD5 "${sanitizedMd5}" already used by paid order "${replayCheck.paymentTxnId}".`);
            return res.status(409).json({ error: 'Transaction already used' });
        }
        const ref = `BAKONG-WEBHOOK-${sanitizedMd5 || Date.now()}`;
        console.log(`[Webhook] ✅ Payment confirmed for order "${order.paymentTxnId}". Processing delivery...`);
        const result = await (0, paymentVerification_1.processVerifiedPayment)(order, ref);
        console.log(`[Webhook] Order update complete. finalStatus="${result.currentOrder.status}"`);
        return res.status(200).json({
            message: 'Bakong payment processed and top-up delivered',
            status: result.currentOrder.status,
        });
    }
    catch (error) {
        console.error('[Webhook] ❌ Unhandled error processing callback:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
