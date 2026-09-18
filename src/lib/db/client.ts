import { supabase, supabaseAdmin, isSupabaseConfigured } from '../supabase/client';

export const getDbClient = () => {
  if (!isSupabaseConfigured()) return null;
  return supabaseAdmin || supabase;
};
export { isSupabaseConfigured };

