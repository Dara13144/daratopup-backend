import { PrismaClient } from '@prisma/client';

// Enable query logging in development for debugging
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

export default prisma;
