const runtimeConfig =
  typeof window !== 'undefined' && window.FINORA_CONFIG ? window.FINORA_CONFIG : {};

export const APP_NAME = 'Finora';
export const SUPPORTED_CURRENCY = 'IDR';

// Ganti dua nilai berikut dengan Project URL dan Publishable/Anon Key dari
// Supabase Dashboard > Project Settings > API. Jangan pernah memakai Service Role Key.
export const SUPABASE_URL = String(
  runtimeConfig.SUPABASE_URL || 'YOUR_SUPABASE_PROJECT_URL'
).trim();
export const SUPABASE_ANON_KEY = String(
  runtimeConfig.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_PUBLISHABLE_KEY'
).trim();

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
