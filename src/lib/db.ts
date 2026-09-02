import { ratepayerDb } from './ratepayerDb';
import type { PrismaClient } from '../generated/prisma/client';

/**
 * Scoped Database Access for Citizen Ratepayer Application
 */
export const prisma = ratepayerDb as unknown as PrismaClient;
export { ratepayerDb };
