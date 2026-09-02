import { adminDb } from './adminDb';
import type { PrismaClient } from '../../../src/generated/prisma/client';

/**
 * Scoped Enterprise Database Access for Administrative Portal
 */
export const prisma = adminDb as unknown as PrismaClient;
export { adminDb };
