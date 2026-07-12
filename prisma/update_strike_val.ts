import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Activating Blood Strike & Valorant and seeding packages...');

  const bloodStrikePackages = [
    { name: '100 Gold', amount: 100, price: 0.99, category: 'BEST_SELLER' },
    { name: '500 Gold', amount: 500, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '1000 Gold', amount: 1000, price: 9.99, category: 'NORMAL' },
    { name: '2500 Gold', amount: 2500, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5000 Gold', amount: 5000, price: 49.99, category: 'NORMAL' },
    { name: '10000 Gold', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  const valorantPackages = [
    { name: '475 VP', amount: 475, price: 4.99, category: 'BEST_SELLER' },
    { name: '1000 VP', amount: 1000, price: 9.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '2050 VP', amount: 2050, price: 19.99, category: 'NORMAL' },
    { name: '3650 VP', amount: 3650, price: 34.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5350 VP', amount: 5350, price: 49.99, category: 'NORMAL' },
    { name: '11000 VP', amount: 11000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  // 1. Process Blood Strike
  const existingBloodStrike = await prisma.product.findUnique({
    where: { slug: 'blood-strike' },
  });

  if (existingBloodStrike) {
    console.log(`Product "blood-strike" found. ID: ${existingBloodStrike.id}. Updating...`);
    await prisma.package.deleteMany({
      where: { productId: existingBloodStrike.id },
    });
    await prisma.product.update({
      where: { id: existingBloodStrike.id },
      data: {
        image: '/images/games/bloodstrike.png',
        isActive: true,
        packages: {
          create: bloodStrikePackages,
        },
      },
    });
    console.log('Blood Strike updated successfully.');
  } else {
    console.log('Product "blood-strike" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'BLOOD STRIKE',
        slug: 'blood-strike',
        image: '/images/games/bloodstrike.png',
        category: 'MOBILE_GAME',
        isActive: true,
        packages: {
          create: bloodStrikePackages,
        },
      },
    });
    console.log('Blood Strike created successfully.');
  }

  // 2. Process Valorant
  const existingValorant = await prisma.product.findUnique({
    where: { slug: 'valorant' },
  });

  if (existingValorant) {
    console.log(`Product "valorant" found. ID: ${existingValorant.id}. Updating...`);
    await prisma.package.deleteMany({
      where: { productId: existingValorant.id },
    });
    await prisma.product.update({
      where: { id: existingValorant.id },
      data: {
        image: '/images/games/valorant.png',
        isActive: true,
        packages: {
          create: valorantPackages,
        },
      },
    });
    console.log('Valorant updated successfully.');
  } else {
    console.log('Product "valorant" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'VALORANT',
        slug: 'valorant',
        image: '/images/games/valorant.png',
        category: 'PC_GAME',
        isActive: true,
        packages: {
          create: valorantPackages,
        },
      },
    });
    console.log('Valorant created successfully.');
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
