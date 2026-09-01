import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function resolveDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl) {
    return "postgresql://postgres:P%4055word1243@127.0.0.1:5432/property_rate_db";
  }
  return rawUrl;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    (globalForPrisma.prisma as any).notification &&
    (globalForPrisma.prisma as any).session
  ) {
    return globalForPrisma.prisma;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
