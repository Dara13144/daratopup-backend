"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const prisma_1 = __importDefault(require("./prisma"));
// Route Imports
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const admin_1 = __importDefault(require("./routes/admin"));
const payments_1 = __importDefault(require("./routes/payments"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const paymentVerification_1 = require("./utils/paymentVerification");
// Load environmental variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security Middlewares
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Rate limiting configuration
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);
// Middleware configuration
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Serve uploaded product images statically
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'uploads')));
// Base health route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sandbox: process.env.SANDBOX_MODE === 'true',
    });
});
// Mounting Sub-Routers
app.use('/api/auth', auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/payment', payments_1.default);
app.use('/api/webhook', webhook_1.default);
app.use('/api/payments/webhook', webhook_1.default);
app.use('/api/payment/webhook', webhook_1.default);
// ── Product Image Upload Endpoint ────────────────────────────────────────────
const auth_2 = require("./middleware/auth");
const storage = multer_1.default.diskStorage({
    destination: path_1.default.join(__dirname, '..', 'public', 'uploads', 'products'),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const base = path_1.default.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
        cb(null, `${base}-${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max
app.post('/api/admin/upload-image', auth_2.authenticateJWT, auth_2.requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = `/uploads/products/${req.file.filename}`;
    return res.status(200).json({ imageUrl });
});
// Express Error Handling Middleware fallback
app.use((err, req, res, next) => {
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
    if (sweepRunning)
        return;
    sweepRunning = true;
    try {
        // Run stale orders sweep first to clean up expired invoices
        await (0, paymentVerification_1.expireOldOrders)();
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const pendingOrders = await prisma_1.default.order.findMany({
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
                const isPaid = await (0, paymentVerification_1.verifyAbaKhqrPayment)(order);
                if (isPaid) {
                    console.log(`[Sweeper] ✅ Payment confirmed for order ${order.paymentTxnId}. Auto-delivering...`);
                    await (0, paymentVerification_1.processVerifiedPayment)(order, `SWEEP-${order.paymentMd5 || order.paymentTxnId}`);
                }
            }
            catch (err) {
                console.error(`[Sweeper] Error checking order ${order.paymentTxnId}:`, err);
            }
        }
    }
    catch (err) {
        console.error('[Sweeper] Fatal sweep error:', err);
    }
    finally {
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
