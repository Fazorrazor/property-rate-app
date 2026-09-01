import { supabaseDb } from '../../../src/lib/supabaseDb';
import type { PrismaClient } from '../../../src/generated/prisma/client';

export const prisma = supabaseDb as unknown as PrismaClient;
export { supabaseDb };
