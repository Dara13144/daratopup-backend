"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const gameProviderMock_1 = require("../utils/gameProviderMock");
const router = (0, express_1.Router)();
// 1. Get all products with active packages (Public)
router.get('/', async (req, res) => {
    try {
        const products = await prisma_1.default.product.findMany({
            where: { isActive: true },
            include: {
                packages: {
                    where: { isActive: true },
                    orderBy: { price: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });
        return res.status(200).json(products);
    }
    catch (error) {
        // Log the full error details for diagnosis
        console.error('[GET /api/products] ERROR:', {
            name: error?.constructor?.name,
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
        });
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV !== 'production' ? error?.message : 'Check server logs',
        });
    }
});
// 2. Lookup Player Nickname by Game and Player ID (Public)
// IMPORTANT: This route MUST be before /:slug to avoid Express matching 'lookup' as a slug.
router.get('/lookup/:gameSlug', async (req, res) => {
    try {
        const { gameSlug } = req.params;
        const playerId = req.query.playerId;
        const playerZoneId = req.query.playerZoneId;
        if (!playerId) {
            return res.status(400).json({ error: 'Player ID is required' });
        }
        const result = await (0, gameProviderMock_1.lookupPlayerNickname)(gameSlug, playerId, playerZoneId);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        return res.status(200).json({ nickname: result.nickname });
    }
    catch (error) {
        console.error('Nickname lookup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 3. Get specific product by slug (Public)
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await prisma_1.default.product.findUnique({
            where: { slug },
            include: {
                packages: {
                    where: { isActive: true },
                    orderBy: { price: 'asc' },
                },
            },
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.status(200).json(product);
    }
    catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ADMIN ONLY CRUD ROUTES BELOW
// 4. Create Product
router.post('/', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { name, slug, image, category, isActive } = req.body;
        if (!name || !slug || !image || !category) {
            return res.status(400).json({ error: 'Required fields missing' });
        }
        const product = await prisma_1.default.product.create({
            data: {
                name,
                slug,
                image,
                category,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        return res.status(201).json(product);
    }
    catch (error) {
        console.error('Error creating product:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Product slug already exists' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 5. Update Product
router.put('/:id', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, image, category, isActive } = req.body;
        const product = await prisma_1.default.product.update({
            where: { id },
            data: { name, slug, image, category, isActive },
        });
        return res.status(200).json(product);
    }
    catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 6. Delete Product
router.delete('/:id', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.product.delete({
            where: { id },
        });
        return res.status(200).json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 7. Add Package to Product
router.post('/:productId/packages', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, amount, price, isActive } = req.body;
        if (!name || amount === undefined || price === undefined) {
            return res.status(400).json({ error: 'Required fields missing' });
        }
        const newPackage = await prisma_1.default.package.create({
            data: {
                productId,
                name,
                amount: parseInt(amount),
                price: parseFloat(price),
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        return res.status(201).json(newPackage);
    }
    catch (error) {
        console.error('Error creating package:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 8. Update Package
router.put('/packages/:packageId', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { packageId } = req.params;
        const { name, amount, price, isActive } = req.body;
        const updatedPackage = await prisma_1.default.package.update({
            where: { id: packageId },
            data: {
                name,
                amount: amount !== undefined ? parseInt(amount) : undefined,
                price: price !== undefined ? parseFloat(price) : undefined,
                isActive,
            },
        });
        return res.status(200).json(updatedPackage);
    }
    catch (error) {
        console.error('Error updating package:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// 9. Delete Package
router.delete('/packages/:packageId', auth_1.authenticateJWT, auth_1.requireAdmin, async (req, res) => {
    try {
        const { packageId } = req.params;
        await prisma_1.default.package.delete({
            where: { id: packageId },
        });
        return res.status(200).json({ message: 'Package deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting package:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
