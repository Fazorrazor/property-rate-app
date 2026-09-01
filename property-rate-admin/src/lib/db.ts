import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

function resolveDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl) {
    return `file:${path.resolve(process.cwd(), '../dev.db')}`;
  }

  if (rawUrl.startsWith('postgres://') || rawUrl.startsWith('postgresql://')) {
    return rawUrl;
  }

  if (rawUrl.startsWith('file:')) {
    const rawPath = rawUrl.slice(5);
    if (path.isAbsolute(rawPath)) {
      return rawUrl;
    }
    return `file:${path.resolve(process.cwd(), rawPath)}`;
  }

  if (!path.isAbsolute(rawUrl)) {
    return `file:${path.resolve(process.cwd(), rawUrl)}`;
  }

  return `file:${rawUrl}`;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    try {
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: databaseUrl });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({ adapter });
    } catch {
      // Fall through to sqlite if pg packages are not locally required
    }
  }

  const dbPath = resolveDatabaseUrl(databaseUrl);
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma && (globalForPrisma.prisma as any).notification) {
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
