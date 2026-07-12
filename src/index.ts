import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import multer from 'multer';
import prisma from './prisma';

// Route Imports
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import adminRouter from './routes/admin';
import paymentsRouter from './routes/payments';
import webhookRouter from './routes/webhook';
import { verifyAbaKhqrPayment, processVerifiedPayment, expireOldOrders } from './utils/paymentVerification';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Middleware configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve uploaded product images statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Base health route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sandbox: process.env.SANDBOX_MODE === 'true',
  });
});

// Mounting Sub-Routers
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payment', paymentsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/payments/webhook', webhookRouter);
app.use('/api/payment/webhook', webhookRouter);

// ── Product Image Upload Endpoint ────────────────────────────────────────────
import { authenticateJWT, requireAdmin } from './middleware/auth';
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads', 'products'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

app.post(
  '/api/admin/upload-image',
  authenticateJWT,
  requireAdmin,
  upload.single('image'),
  (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/products/${req.file.filename}`;
    return res.status(200).json({ imageUrl });
  }
);

// Express Error Handling Middleware fallback
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND PAYMENT SWEEPER (Real-Time Safety Sweeper)
// Runs every 3 minutes. Sweeps PENDING orders, checks status against gateways,
// processes delivery for paid orders, and automatically expires old ones.
// ─────────────────────────────────────────────────────────────────────────────
const SWEEP_INTERVAL_MS = 15_000; // 15 seconds — real-time payment sweeper

let sweepRunning = false;

async function runPaymentSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    // Run stale orders sweep first to clean up expired invoices
    await expireOldOrders();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        createdAt: { gte: cutoff },
      },
      include: {
        package: { include: { product: true } },
      },
    });

    if (pendingOrders.length === 0) {
      sweepRunning = false;
      return;
    }

    console.log(`[Sweeper] Checking ${pendingOrders.length} pending orders...`);

    for (const order of pendingOrders) {
      try {
        const isPaid = await verifyAbaKhqrPayment(order);
        if (isPaid) {
          console.log(`[Sweeper] ✅ Payment confirmed for order ${order.paymentTxnId}. Auto-delivering...`);
          await processVerifiedPayment(order, `SWEEP-${order.paymentMd5 || order.paymentTxnId}`);
        }
      } catch (err) {
        console.error(`[Sweeper] Error checking order ${order.paymentTxnId}:`, err);
      }
    }
  } catch (err) {
    console.error('[Sweeper] Fatal sweep error:', err);
  } finally {
    sweepRunning = false;
  }
}

// Start Express Server (Trigger nodemon restart)
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Top-Up Server is running on port ${PORT}`);
  console.log(`🛠️ Mode: ${process.env.SANDBOX_MODE === 'true' ? 'SANDBOX / SIMULATOR' : 'PRODUCTION'}`);
  console.log(`🌐 API Endpoint: http://localhost:${PORT}`);
  console.log(`===============================================`);

  // Start background payment sweeper
  setInterval(runPaymentSweep, SWEEP_INTERVAL_MS);
  console.log(`🔄 Payment sweeper started — checking every ${SWEEP_INTERVAL_MS / 1000}s`);
});

