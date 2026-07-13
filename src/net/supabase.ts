import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Single Supabase client, or null when the leaderboard isn't configured (no .env)
// so every call site can degrade gracefully instead of crashing.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: { persistSession: true, detectSessionInUrl: false, autoRefreshToken: true },
      })
    : null;
