import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization - create Prisma client on first access
let _prisma: PrismaClient | undefined;

export function prisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma;
    }
  }
  return _prisma;
}

// For backward compatibility with existing imports
const prismaProxy = new Proxy(
  {},
  {
    get(target, prop) {
      return prisma()[prop as keyof PrismaClient];
    }
  }
) as unknown as PrismaClient;

export default prismaProxy;
