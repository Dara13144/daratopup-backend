import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Activating Farlight 84 & Delta Force and seeding packages...');

  const farlightPackages = [
    { name: '60 Diamonds', amount: 60, price: 0.99, category: 'BEST_SELLER' },
    { name: '350 Diamonds', amount: 350, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '720 Diamonds', amount: 720, price: 9.99, category: 'NORMAL' },
    { name: '1440 Diamonds', amount: 1440, price: 19.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '2880 Diamonds', amount: 2880, price: 39.99, category: 'NORMAL' },
    { name: '5760 Diamonds', amount: 5760, price: 79.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  const deltaforcePackages = [
    { name: '100 Delta Coins', amount: 100, price: 0.99, category: 'BEST_SELLER' },
    { name: '500 Delta Coins', amount: 500, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '1000 Delta Coins', amount: 1000, price: 9.99, category: 'NORMAL' },
    { name: '2000 Delta Coins', amount: 2000, price: 19.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5000 Delta Coins', amount: 5000, price: 49.99, category: 'NORMAL' },
    { name: '10000 Delta Coins', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  // 1. Process Farlight 84
  const existingFarlight = await prisma.product.findUnique({
    where: { slug: 'farlight-84' },
  });

  if (existingFarlight) {
    console.log(`Product "farlight-84" found. ID: ${existingFarlight.id}. Updating...`);
    await prisma.package.deleteMany({
      where: { productId: existingFarlight.id },
    });
    await prisma.product.update({
      where: { id: existingFarlight.id },
      data: {
        image: '/images/games/farlight.png',
        isActive: true,
        packages: {
          create: farlightPackages,
        },
      },
    });
    console.log('Farlight 84 updated successfully.');
  } else {
    console.log('Product "farlight-84" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'FARLIGHT 84',
        slug: 'farlight-84',
        image: '/images/games/farlight.png',
        category: 'MOBILE_GAME',
        isActive: true,
        packages: {
          create: farlightPackages,
        },
      },
    });
    console.log('Farlight 84 created successfully.');
  }

  // 2. Process Delta Force
  const existingDeltaForce = await prisma.product.findUnique({
    where: { slug: 'delta-force' },
  });

  if (existingDeltaForce) {
    console.log(`Product "delta-force" found. ID: ${existingDeltaForce.id}. Updating...`);
    await prisma.package.deleteMany({
      where: { productId: existingDeltaForce.id },
    });
    await prisma.product.update({
      where: { id: existingDeltaForce.id },
      data: {
        image: '/images/games/deltaforce.png',
        isActive: true,
        packages: {
          create: deltaforcePackages,
        },
      },
    });
    console.log('Delta Force updated successfully.');
  } else {
    console.log('Product "delta-force" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'DELTA FORCE',
        slug: 'delta-force',
        image: '/images/games/deltaforce.png',
        category: 'PC_GAME',
        isActive: true,
        packages: {
          create: deltaforcePackages,
        },
      },
    });
    console.log('Delta Force created successfully.');
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
