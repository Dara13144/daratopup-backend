import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJWT, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Apply auth + admin restriction to all paths in this router
router.use(authenticateJWT, requireAdmin);

// 1. Fetch dashboard metric figures
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalOrdersCount = await prisma.order.count();
    const completedOrdersCount = await prisma.order.count({ 
      where: { status: { in: ['COMPLETED', 'SUCCESS'] } } 
    });
    const pendingOrdersCount = await prisma.order.count({ where: { status: 'PENDING' } });
    const failedOrdersCount = await prisma.order.count({ where: { status: 'FAILED' } });

    // Calculate sum of price for completed orders
    const revenueSum = await prisma.order.aggregate({
      where: { status: { in: ['COMPLETED', 'SUCCESS'] } },
      _sum: {
        price: true,
      },
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        package: {
          include: { product: true },
        },
      },
    });

    // Game popularity distribution (Completed order counts per game product)
    const productStats = await prisma.product.findMany({
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
  } catch (error) {
    console.error('Admin metrics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch all orders (Paginated / Filterable)
router.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;

    const whereClause: any = {};
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

    const orders = await prisma.order.findMany({
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
  } catch (error) {
    console.error('Admin fetch orders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Manually edit order status (override for manual checks)
router.put('/orders/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, stockDeliveredCode } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id },
      include: { package: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStatus = order.status;

    // Save update
    const updatedOrder = await prisma.order.update({
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
  } catch (error) {
    console.error('Admin update order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Stock management: Get stock levels
router.get('/stock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stocks = await prisma.stock.findMany({
      include: {
        package: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Summary statistics
    const totals = await prisma.stock.groupBy({
      by: ['packageId', 'isUsed'],
      _count: {
        id: true,
      },
    });

    return res.status(200).json({ stocks, summary: totals });
  } catch (error) {
    console.error('Admin get stock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Stock management: Add digital voucher serial codes
router.post('/stock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { packageId, codes } = req.body; // codes is string[] or a single comma-separated list string

    if (!packageId || !codes) {
      return res.status(400).json({ error: 'Package ID and codes list are required' });
    }

    let codeList: string[] = [];
    if (Array.isArray(codes)) {
      codeList = codes;
    } else if (typeof codes === 'string') {
      codeList = codes.split('\n').map((c) => c.trim()).filter((c) => c.length > 0);
    }

    if (codeList.length === 0) {
      return res.status(400).json({ error: 'No valid codes provided' });
    }

    const createdRecords = await Promise.all(
      codeList.map((code) => {
        return prisma.stock.create({
          data: {
            packageId,
            code,
            isUsed: false,
          },
        });
      })
    );

    return res.status(201).json({
      message: `Successfully added ${createdRecords.length} codes to stock`,
      count: createdRecords.length,
    });
  } catch (error) {
    console.error('Admin add stock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Product management: Add a new game product
router.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, image } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Product name and category are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: `A product with slug '${slug}' already exists` });
    }

    const newProduct = await prisma.product.create({
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
  } catch (error: any) {
    console.error('Admin add product error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. Product management: Add a new package under a product
router.post('/products/:productId/packages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { name, amount, price, category, badge } = req.body;

    if (!name || amount === undefined || price === undefined) {
      return res.status(400).json({ error: 'Package name, amount, and price are required' });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const newPackage = await prisma.package.create({
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
  } catch (error: any) {
    console.error('Admin add package error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 7b. Product management: Update a product's image URL
router.patch('/products/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { image, name } = req.body;
    const data: any = {};
    if (image !== undefined) data.image = image;
    if (name) data.name = name;

    const updated = await prisma.product.update({ where: { id }, data });
    return res.status(200).json({ message: 'Product updated', product: updated });
  } catch (error: any) {
    console.error('Admin update product error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. Product management: Delete a product
router.delete('/products/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    console.log(`[Admin Dashboard] Deleted product: ${id}`);
    return res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Admin delete product error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. Product management: Delete a package
router.delete('/packages/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.package.delete({ where: { id } });
    console.log(`[Admin Dashboard] Deleted package: ${id}`);
    return res.status(200).json({ message: 'Package deleted successfully' });
  } catch (error: any) {
    console.error('Admin delete package error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
