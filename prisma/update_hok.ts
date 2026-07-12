import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Activating Honor of Kings and seeding packages...');

  const hokPackages = [
    { name: '88 Tokens', amount: 88, price: 0.99, category: 'BEST_SELLER' },
    { name: '432 Tokens', amount: 432, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '905 Tokens', amount: 905, price: 9.99, category: 'NORMAL' },
    { name: '2475 Tokens', amount: 2475, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '4950 Tokens', amount: 4950, price: 49.99, category: 'NORMAL' },
    { name: '10000 Tokens', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  // Process Honor of Kings
  const existingHoK = await prisma.product.findUnique({
    where: { slug: 'honor-of-kings' },
  });

  if (existingHoK) {
    console.log(`Product "honor-of-kings" found. ID: ${existingHoK.id}. Updating...`);
    await prisma.package.deleteMany({
      where: { productId: existingHoK.id },
    });
    await prisma.product.update({
      where: { id: existingHoK.id },
      data: {
        image: '/images/games/hok.png',
        isActive: true,
        packages: {
          create: hokPackages,
        },
      },
    });
    console.log('Honor of Kings updated successfully.');
  } else {
    console.log('Product "honor-of-kings" not found. Creating a new one...');
    await prisma.product.create({
      data: {
        name: 'HONOR OF KINGS',
        slug: 'honor-of-kings',
        image: '/images/games/hok.png',
        category: 'MOBILE_GAME',
        isActive: true,
        packages: {
          create: hokPackages,
        },
      },
    });
    console.log('Honor of Kings created successfully.');
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
