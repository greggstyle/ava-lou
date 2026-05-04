import { createClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client — uses the secret key, bypasses RLS.
 * SERVER ONLY. Never import in a 'use client' component or expose in a route
 * that doesn't validate the user first.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
