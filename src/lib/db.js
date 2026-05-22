import { PrismaClient } from '@prisma/client';

// In dev, Next.js hot-reloads modules, so without this guard you'd spawn a
// fresh PrismaClient per reload and saturate Supabase's connection pool.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
