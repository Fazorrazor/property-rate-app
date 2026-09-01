import { supabaseDb } from './supabaseDb';
import type { PrismaClient } from '../generated/prisma/client';

export const prisma = supabaseDb as unknown as PrismaClient;
export { supabaseDb };
