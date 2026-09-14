import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/config/env';

export const isSupabaseConfigured = () => {
  return env.supabase.isConfigured;
};

// Client-side / Anon Supabase instance
export const supabase = env.supabase.isConfigured
  ? createClient(env.supabase.url, env.supabase.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// Server-side / Service Role Supabase Admin instance (for elevated operations, webhooks, and backend procedures)
export const supabaseAdmin = env.supabase.url && env.supabase.serviceRoleKey
  ? createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : supabase;
