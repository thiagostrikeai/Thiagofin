import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_'));

if (!isSupabaseConfigured) {
  console.warn(
    '[FinTrack] Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (local) ou no Netlify.'
  );
}

/** Placeholder client when env is missing — avoids crash; auth/db will error clearly */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
