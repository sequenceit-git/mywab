import { supabase, supabaseAdmin, isSupabaseConfigured } from '../supabase/client';

export const getDbClient = () => supabaseAdmin || supabase;
export { isSupabaseConfigured };
