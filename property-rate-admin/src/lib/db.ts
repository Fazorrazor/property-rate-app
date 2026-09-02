import { adminDb } from './adminDb';

/**
 * Scoped Enterprise Database Access for Administrative Portal
 */
export const prisma = adminDb as any;
export { adminDb };
