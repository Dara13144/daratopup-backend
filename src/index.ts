import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import multer from 'multer';
import prisma from './prisma';

// Load environmental variables FIRST before anything else
dotenv.config();

// Route Imports
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import adminRouter from './routes/admin';
import paymentsRouter from './routes/payments';
import webhookRouter from './routes/webhook';
import { verifyAbaKhqrPayment, processVerifiedPayment, expireOldOrders } from './utils/paymentVerification';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP to avoid blocking API responses
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow all origins (works for both local dev and production on Render/Vercel)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman) and all browser origins
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
}));

// Handle OPTIONS preflight requests explicitly for all routes
app.options('*', cors());

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  skip: (req) => req.path === '/api/health' || req.path === '/', // Skip health checks
});
app.use('/api/', limiter);

// ─── Static File Serving ───────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// ─── Health & Root Routes ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'DaraTopup Backend API Server is running successfully!',
    timestamp: new Date().toISOString(),
    sandbox: process.env.SANDBOX_MODE === 'true',
    version: '1.0.0',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'DaraTopup Backend API Server is running successfully!',
    timestamp: new Date().toISOString(),
    sandbox: process.env.SANDBOX_MODE === 'true',
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payment', paymentsRouter);   // Alias for legacy compatibility
app.use('/api/webhook', webhookRouter);
app.use('/api/payments/webhook', webhookRouter);
app.use('/api/payment/webhook', webhookRouter);

// ─── Product Image Upload Endpoint ────────────────────────────────────────────
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

// ─── 404 Catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/products',
      'GET /api/products/:slug',
      'POST /api/orders',
      'GET /api/orders/status/:txnId',
    ],
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ─── BACKGROUND PAYMENT SWEEPER ───────────────────────────────────────────────
const SWEEP_INTERVAL_MS = 15_000; // 15 seconds
let sweepRunning = false;

async function runPaymentSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
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

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 DaraTopup Backend running on port ${PORT}`);
  console.log(`🛠️  Mode: ${process.env.SANDBOX_MODE === 'true' ? 'SANDBOX' : 'PRODUCTION'}`);
  console.log(`🌐 URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
  console.log(`🗄️  DB: ${process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`===============================================`);

  setInterval(runPaymentSweep, SWEEP_INTERVAL_MS);
  console.log(`🔄 Payment sweeper started — checking every ${SWEEP_INTERVAL_MS / 1000}s`);
});
