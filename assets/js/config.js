const runtimeConfig =
  typeof window !== 'undefined' && window.FINORA_CONFIG ? window.FINORA_CONFIG : {};

export const APP_NAME = 'Finora';
export const SUPPORTED_CURRENCY = 'IDR';

// Ganti dua nilai berikut dengan Project URL dan Publishable/Anon Key dari
// Supabase Dashboard > Project Settings > API. Jangan pernah memakai Service Role Key.
export const SUPABASE_URL = String(
  runtimeConfig.SUPABASE_URL || 'https://falbyiisuuzpskosfdrt.supabase.co'
).trim();
export const SUPABASE_ANON_KEY = String(
  runtimeConfig.SUPABASE_ANON_KEY || 'sb_publishable_xxzYNfbmg4pnGS78H5esIg_ETiKR3sp'
).trim();

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://falbyiisuuzpskosfdrt.supabase.co') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
