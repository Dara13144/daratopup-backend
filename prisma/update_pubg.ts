import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Activating PUBG MOBILE and seeding UC packages...');

  const pubgmPackages = [
    { name: '60 UC', amount: 60, price: 0.99, category: 'BEST_SELLER' },
    { name: '325 UC', amount: 325, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '660 UC', amount: 660, price: 9.99, category: 'NORMAL' },
    { name: '1800 UC', amount: 1800, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '3850 UC', amount: 3850, price: 49.99, category: 'NORMAL' },
    { name: '8100 UC', amount: 8100, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  // 1. Find if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { slug: 'pubg-mobile' },
  });

  if (existingProduct) {
    console.log(`Product with slug "pubg-mobile" found. ID: ${existingProduct.id}. Updating...`);
    
    // Delete existing packages for this product to avoid duplicates
    await prisma.package.deleteMany({
      where: { productId: existingProduct.id },
    });

    // Update active status and create packages
    await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        isActive: true,
        packages: {
          create: pubgmPackages,
        },
      },
    });
    console.log('PUBG MOBILE updated and packages created successfully.');
  } else {
    console.log('Product "pubg-mobile" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'PUBG MOBILE',
        slug: 'pubg-mobile',
        image: '/images/games/pubgm.png',
        category: 'MOBILE_GAME',
        isActive: true,
        packages: {
          create: pubgmPackages,
        },
      },
    });
    console.log('PUBG MOBILE created successfully.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
