import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with special game catalog and categorized packages...');

  // 1. Clean existing data
  await prisma.stock.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.product.deleteMany({});

  // 2. Create Users
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const userPassword = bcrypt.hashSync('user123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@topup.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@topup.com',
      password: userPassword,
      role: 'USER',
    },
  });

  console.log(`Created admin: ${admin.email}`);
  console.log(`Created test user: ${user.email}`);

  // 3. Define Categorized Packages (Best Seller & Normal)
  const ffPackages = [
    // Best Seller Packages
    { name: 'Evo3D', amount: 50, price: 0.83, category: 'BEST_SELLER' },
    { name: 'Evo7D', amount: 100, price: 0.97, category: 'BEST_SELLER' },
    { name: 'Evo30D', amount: 200, price: 2.48, category: 'BEST_SELLER' },
    { name: 'ផ្សងសំណាង', amount: 80, price: 0.57, category: 'BEST_SELLER', badge: 'បានមួយ ដោយចៃដន្យ' },
    { name: 'lvp6', amount: 30, price: 0.45, category: 'BEST_SELLER' },
    { name: 'lvp10', amount: 60, price: 0.79, category: 'BEST_SELLER' },
    { name: 'lvp15', amount: 90, price: 0.79, category: 'BEST_SELLER' },
    { name: 'lvp20', amount: 120, price: 0.79, category: 'BEST_SELLER' },
    { name: 'lvp25', amount: 150, price: 0.79, category: 'BEST_SELLER' },
    { name: 'lvp30', amount: 180, price: 1.09, category: 'BEST_SELLER' },

    // Normal Packages
    { name: '25 Diamonds', amount: 25, price: 0.29, category: 'NORMAL', badge: 'សាកល្បង' },
    { name: '100 Diamonds', amount: 100, price: 0.97, category: 'NORMAL' },
    { name: '310 Diamonds', amount: 310, price: 2.63, category: 'NORMAL' },
    { name: '520 Diamonds', amount: 520, price: 4.15, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '1060 diamonds', amount: 1060, price: 8.40, category: 'NORMAL', badge: 'Bonus Event 🔥' },
    { name: '2180 Diamonds', amount: 2180, price: 16.49, category: 'NORMAL' },
    { name: '5600 Diamonds', amount: 5600, price: 43.55, category: 'NORMAL' },
    { name: '11500 Diamonds', amount: 11500, price: 88.55, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
    { name: 'WeeklyLite', amount: 100, price: 0.45, category: 'NORMAL', badge: 'ទទួលបាន 20 💎 ភ្លាមៗ' },
    { name: 'Weekly', amount: 250, price: 1.67, category: 'NORMAL', badge: 'ទទួលបាន 200 💎 ភ្លាមៗ' },
    { name: 'Monthly', amount: 1200, price: 7.60, category: 'NORMAL', badge: 'ទទួលបាន 1000 💎 ភ្លាមៗ' },
  ];

  // Helper to create MLBB Packages
  const mlbbPackages = [
    { name: 'Evo3D MLBB', amount: 100, price: 0.99, category: 'BEST_SELLER' },
    { name: 'Weekly Pass Best', amount: 210, price: 1.80, category: 'BEST_SELLER', badge: 'ទទួលបាន 200 💎 ភ្លាមៗ' },
    { name: '11 Diamonds', amount: 11, price: 0.25, category: 'NORMAL' },
    { name: '50 Diamonds', amount: 50, price: 0.99, category: 'NORMAL', badge: 'សាកល្បង' },
    { name: '150 Diamonds', amount: 150, price: 2.80, category: 'NORMAL' },
    { name: '250 Diamonds', amount: 250, price: 4.50, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '500 Diamonds', amount: 500, price: 8.90, category: 'NORMAL' },
    { name: '1000 Diamonds', amount: 1000, price: 17.50, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  // 4. Seeding Products
  // 1. MOBILE LEGENDS | KHMER
  await prisma.product.create({
    data: {
      name: 'MOBILE LEGENDS | KHMER',
      slug: 'mobile-legends-khmer',
      image: '/images/games/mlbb.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: mlbbPackages },
    },
  });

  // 2. MOBILE LEGENDS | PHILIPPINES
  await prisma.product.create({
    data: {
      name: 'MOBILE LEGENDS | PHILIPPINES',
      slug: 'mobile-legends-philippines',
      image: '/images/games/mlbb.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: mlbbPackages },
    },
  });

  // 3. MOBILE LEGENDS | INDONESIA
  await prisma.product.create({
    data: {
      name: 'MOBILE LEGENDS | INDONESIA',
      slug: 'mobile-legends-indonesia',
      image: '/images/games/mlbb.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: mlbbPackages },
    },
  });

  // 4. FREE FIRE | KHMER
  await prisma.product.create({
    data: {
      name: 'FREE FIRE | KHMER',
      slug: 'free-fire-khmer',
      image: '/images/games/freefire.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: ffPackages },
    },
  });

  // 5. FREE FIRE | INDONESIA
  await prisma.product.create({
    data: {
      name: 'FREE FIRE | INDONESIA',
      slug: 'free-fire-indonesia',
      image: '/images/games/freefire.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: ffPackages },
    },
  });

  // 6. FREE FIRE | VIETNAM
  await prisma.product.create({
    data: {
      name: 'FREE FIRE | VIETNAM',
      slug: 'free-fire-vietnam',
      image: '/images/games/freefire.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: ffPackages },
    },
  });

  // 7. FREE FIRE | TAIWAN
  await prisma.product.create({
    data: {
      name: 'FREE FIRE | TAIWAN',
      slug: 'free-fire-taiwan',
      image: '/images/games/freefire.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: ffPackages },
    },
  });

  // 8. MAGIC CHESS GOGO
  await prisma.product.create({
    data: {
      name: 'MAGIC CHESS GOGO',
      slug: 'magic-chess-gogo',
      image: '/images/games/magicchess.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: {
        create: [
          { name: 'Evo3D Magic Chess', amount: 50, price: 0.83, category: 'BEST_SELLER' },
          { name: '100 Gold Coins', amount: 100, price: 0.99, category: 'NORMAL' },
          { name: '500 Gold Coins', amount: 500, price: 4.50, category: 'NORMAL', badge: 'ពេញនិយម' },
        ],
      },
    },
  });

  // 9. HONOR OF KINGS
  const hokPackages = [
    { name: '88 Tokens', amount: 88, price: 0.99, category: 'BEST_SELLER' },
    { name: '432 Tokens', amount: 432, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '905 Tokens', amount: 905, price: 9.99, category: 'NORMAL' },
    { name: '2475 Tokens', amount: 2475, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '4950 Tokens', amount: 4950, price: 49.99, category: 'NORMAL' },
    { name: '10000 Tokens', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'HONOR OF KINGS',
      slug: 'honor-of-kings',
      image: '/images/games/hok.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: hokPackages },
    },
  });

  // 10. PUBG MOBILE
  const pubgmPackages = [
    { name: '60 UC', amount: 60, price: 0.99, category: 'BEST_SELLER' },
    { name: '325 UC', amount: 325, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '660 UC', amount: 660, price: 9.99, category: 'NORMAL' },
    { name: '1800 UC', amount: 1800, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '3850 UC', amount: 3850, price: 49.99, category: 'NORMAL' },
    { name: '8100 UC', amount: 8100, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'PUBG MOBILE',
      slug: 'pubg-mobile',
      image: '/images/games/pubgm.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: pubgmPackages },
    },
  });

  // 11. BLOOD STRIKE
  const bloodStrikePackages = [
    { name: '100 Gold', amount: 100, price: 0.99, category: 'BEST_SELLER' },
    { name: '500 Gold', amount: 500, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '1000 Gold', amount: 1000, price: 9.99, category: 'NORMAL' },
    { name: '2500 Gold', amount: 2500, price: 24.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5000 Gold', amount: 5000, price: 49.99, category: 'NORMAL' },
    { name: '10000 Gold', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'BLOOD STRIKE',
      slug: 'blood-strike',
      image: '/images/games/bloodstrike.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: bloodStrikePackages },
    },
  });

  // 11b. VALORANT
  const valorantPackages = [
    { name: '475 VP', amount: 475, price: 4.99, category: 'BEST_SELLER' },
    { name: '1000 VP', amount: 1000, price: 9.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '2050 VP', amount: 2050, price: 19.99, category: 'NORMAL' },
    { name: '3650 VP', amount: 3650, price: 34.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5350 VP', amount: 5350, price: 49.99, category: 'NORMAL' },
    { name: '11000 VP', amount: 11000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'VALORANT',
      slug: 'valorant',
      image: '/images/games/valorant.png',
      category: 'PC_GAME',
      isActive: true,
      packages: { create: valorantPackages },
    },
  });

  // 12. SUPER SUS (Out of stock)
  await prisma.product.create({
    data: {
      name: 'SUPER SUS',
      slug: 'super-sus',
      image: '/images/games/roblox.png',
      category: 'MOBILE_GAME',
      isActive: false,
      packages: { create: [] },
    },
  });

  // 13. FARLIGHT 84
  const farlightPackages = [
    { name: '60 Diamonds', amount: 60, price: 0.99, category: 'BEST_SELLER' },
    { name: '350 Diamonds', amount: 350, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '720 Diamonds', amount: 720, price: 9.99, category: 'NORMAL' },
    { name: '1440 Diamonds', amount: 1440, price: 19.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '2880 Diamonds', amount: 2880, price: 39.99, category: 'NORMAL' },
    { name: '5760 Diamonds', amount: 5760, price: 79.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'FARLIGHT 84',
      slug: 'farlight-84',
      image: '/images/games/farlight.png',
      category: 'MOBILE_GAME',
      isActive: true,
      packages: { create: farlightPackages },
    },
  });

  // 14. DELTA FORCE
  const deltaforcePackages = [
    { name: '100 Delta Coins', amount: 100, price: 0.99, category: 'BEST_SELLER' },
    { name: '500 Delta Coins', amount: 500, price: 4.99, category: 'BEST_SELLER', badge: 'ពេញនិយម' },
    { name: '1000 Delta Coins', amount: 1000, price: 9.99, category: 'NORMAL' },
    { name: '2000 Delta Coins', amount: 2000, price: 19.99, category: 'NORMAL', badge: 'ពេញនិយម' },
    { name: '5000 Delta Coins', amount: 5000, price: 49.99, category: 'NORMAL' },
    { name: '10000 Delta Coins', amount: 10000, price: 99.99, category: 'NORMAL', badge: 'កញ្ចប់ពិសេស 💎' },
  ];

  await prisma.product.create({
    data: {
      name: 'DELTA FORCE',
      slug: 'delta-force',
      image: '/images/games/deltaforce.png',
      category: 'PC_GAME',
      isActive: true,
      packages: { create: deltaforcePackages },
    },
  });

  console.log('Seeded games and categorized top-up packages.');
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
