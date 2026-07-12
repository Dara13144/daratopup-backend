const { PrismaClient } = require('@prisma/client');

async function test() {
  const url = 'postgresql://postgres.frumrhogdtuawshkdqxr:67f8e9b6-a419-43c9-9530-089a7d6051ae@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    console.log('Connecting to Supabase...');
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('SUCCESS:', result);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
