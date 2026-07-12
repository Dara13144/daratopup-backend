"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply auth + admin restriction to all paths in this router
router.use(auth_1.authenticateJWT, auth_1.requireAdmin);
// 1. Fetch dashboard metric figures
router.get('/stats', async (req, res) => {
    try {
        const totalOrdersCount = await prisma_1.default.order.count();
        const completedOrdersCount = await prisma_1.default.order.count({
            where: { status: { in: ['COMPLETED', 'SUCCESS'] } }
        });
        const pendingOrdersCount = await prisma_1.default.order.count({ where: { status: 'PENDING' } });
        const failedOrdersCount = await prisma_1.default.order.count({ where: { status: 'FAILED' } });
        // Calculate sum of price for completed orders
        const revenueSum = await prisma_1.default.order.aggregate({
            where: { status: { in: ['COMPLETED', 'SUCCESS'] } },
            _sum: {
                price: true,
            },
        });
        // Recent orders
        const recentOrders = await prisma_1.default.order.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                package: {
                    include: { product: true },
                },
            },
        });
        // Game popularity distribution (Completed order counts per game product)
        const productStats = await prisma_1.default.product.findMany({
            include: {
                packages: {
                    include: {
                        _count: {
                            select: { orders: { where: { status: { in: ['COMPLETED', 'SUCCESS'] } } } },
                        },
                    },
                },
            },
        });
        const popularity = productStats.map((prod) => {
            let salesCount = 0;
            let revenue = 0;
            prod.packages.forEach((pkg) => {
                salesCount += pkg._count.orders;
            });
            return {
                name: prod.name,
                salesCount,
            };
        }).sort((a, b) => b.salesCount - a.salesCount);
        return res.status(200).json({
            metrics: {
                totalRevenue: revenueSum._sum.price || 0,
                totalOrders: totalOrdersCount,
                completedOrders: completedOrdersCount,
                pendingOrders: pendingOrdersCount,
                failedOrders: failedOrdersCount,
            },
            recentOrders,
            popularity,
        });
    }
    catch (error) {
        console.error('Admin metrics error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 2. Fetch all orders (Paginated / Filterable)
router.get('/orders', async (req, res) => {
    try {
        const status = req.query.status;
        const search = req.query.search;
        const whereClause = {};
        if (status) {
            whereClause.status = status;
        }
        if (search) {
            whereClause.OR = [
                { playerId: { contains: search } },
                { playerNickname: { contains: search } },
                { paymentTxnId: { contains: search } },
            ];
        }
        const orders = await prisma_1.default.order.findMany({
            where: whereClause,
            include: {
                package: {
                    include: { product: true },
                },
                user: {
                    select: { email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json(orders);
    }
    catch (error) {
        console.error('Admin fetch orders error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 3. Manually edit order status (override for manual checks)
router.put('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, stockDeliveredCode } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        // Check if order exists
        const order = await prisma_1.default.order.findUnique({
            where: { id },
            include: { package: { include: { product: true } } },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const previousStatus = order.status;
        // Save update
        const updatedOrder = await prisma_1.default.order.update({
            where: { id },
            data: {
                status,
                paymentStatus: (status === 'COMPLETED' || status === 'SUCCESS') ? 'PAID' : order.paymentStatus,
                stockDeliveredCode,
            },
        });
        console.log(`[Admin Override] Order ${order.paymentTxnId} status changed from ${previousStatus} to ${status}`);
        return res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder,
        });
    }
    catch (error) {
        console.error('Admin update order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 4. Stock management: Get stock levels
router.get('/stock', async (req, res) => {
    try {
        const stocks = await prisma_1.default.stock.findMany({
            include: {
                package: {
                    include: { product: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Summary statistics
        const totals = await prisma_1.default.stock.groupBy({
            by: ['packageId', 'isUsed'],
            _count: {
                id: true,
            },
        });
        return res.status(200).json({ stocks, summary: totals });
    }
    catch (error) {
        console.error('Admin get stock error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 5. Stock management: Add digital voucher serial codes
router.post('/stock', async (req, res) => {
    try {
        const { packageId, codes } = req.body; // codes is string[] or a single comma-separated list string
        if (!packageId || !codes) {
            return res.status(400).json({ error: 'Package ID and codes list are required' });
        }
        let codeList = [];
        if (Array.isArray(codes)) {
            codeList = codes;
        }
        else if (typeof codes === 'string') {
            codeList = codes.split('\n').map((c) => c.trim()).filter((c) => c.length > 0);
        }
        if (codeList.length === 0) {
            return res.status(400).json({ error: 'No valid codes provided' });
        }
        const createdRecords = await Promise.all(codeList.map((code) => {
            return prisma_1.default.stock.create({
                data: {
                    packageId,
                    code,
                    isUsed: false,
                },
            });
        }));
        return res.status(201).json({
            message: `Successfully added ${createdRecords.length} codes to stock`,
            count: createdRecords.length,
        });
    }
    catch (error) {
        console.error('Admin add stock error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 6. Product management: Add a new game product
router.post('/products', async (req, res) => {
    try {
        const { name, category, image } = req.body;
        if (!name || !category) {
            return res.status(400).json({ error: 'Product name and category are required' });
        }
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        // Check if slug already exists
        const existing = await prisma_1.default.product.findUnique({ where: { slug } });
        if (existing) {
            return res.status(400).json({ error: `A product with slug '${slug}' already exists` });
        }
        const newProduct = await prisma_1.default.product.create({
            data: {
                name,
                slug,
                category,
                image: image || `/images/games/${slug}.png`,
                isActive: true,
            },
        });
        console.log(`[Admin Dashboard] Product created: "${newProduct.name}" (Slug: ${slug})`);
        return res.status(201).json({
            message: 'Product created successfully',
            product: newProduct,
        });
    }
    catch (error) {
        console.error('Admin add product error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 7. Product management: Add a new package under a product
router.post('/products/:productId/packages', async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, amount, price, category, badge } = req.body;
        if (!name || amount === undefined || price === undefined) {
            return res.status(400).json({ error: 'Package name, amount, and price are required' });
        }
        // Verify product exists
        const product = await prisma_1.default.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const newPackage = await prisma_1.default.package.create({
            data: {
                productId,
                name,
                amount: parseInt(amount, 10),
                price: parseFloat(price),
                isActive: true,
                category: category || 'NORMAL',
                badge: badge || null,
            },
        });
        console.log(`[Admin Dashboard] Package created under ${product.name}: "${newPackage.name}" ($${newPackage.price})`);
        return res.status(201).json({
            message: 'Package created successfully',
            package: newPackage,
        });
    }
    catch (error) {
        console.error('Admin add package error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 7b. Product management: Update a product's image URL
router.patch('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { image, name } = req.body;
        const data = {};
        if (image !== undefined)
            data.image = image;
        if (name)
            data.name = name;
        const updated = await prisma_1.default.product.update({ where: { id }, data });
        return res.status(200).json({ message: 'Product updated', product: updated });
    }
    catch (error) {
        console.error('Admin update product error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 8. Product management: Delete a product
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.product.delete({ where: { id } });
        console.log(`[Admin Dashboard] Deleted product: ${id}`);
        return res.status(200).json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error('Admin delete product error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 9. Product management: Delete a package
router.delete('/packages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.package.delete({ where: { id } });
        console.log(`[Admin Dashboard] Deleted package: ${id}`);
        return res.status(200).json({ message: 'Package deleted successfully' });
    }
    catch (error) {
        console.error('Admin delete package error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
