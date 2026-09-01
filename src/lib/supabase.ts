import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jzezuitkenrfkzrkphiz.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6ZXp1aXRrZW5yZmt6cmtwaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODA4NjEsImV4cCI6MjEwMzg1Njg2MX0.65s4OvVtgkrLpngsF9e6UwkWJIX4G1ydyuu1zzsEQSw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
