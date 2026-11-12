// FINORA — GENERATE CONFIG
// Menyusun modul config dari environment variable build.

const DEFAULT_SUPABASE_URL = 'https://falbyiisuuzpskosfdrt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_xxzYNfbmg4pnGS78H5esIg_ETiKR3sp';

export function renderConfig() {
  const supabaseUrl =
    process.env.FINORA_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.FINORA_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;
  const urlLiteral = JSON.stringify(supabaseUrl);
  const keyLiteral = JSON.stringify(supabaseAnonKey);

  return `const runtimeConfig =
  typeof window !== 'undefined' && window.FINORA_CONFIG ? window.FINORA_CONFIG : {};

export const APP_NAME = 'Finora';
export const SUPPORTED_CURRENCY = 'IDR';

export const SUPABASE_URL = String(
  runtimeConfig.SUPABASE_URL || ${urlLiteral}
).trim();
export const SUPABASE_ANON_KEY = String(
  runtimeConfig.SUPABASE_ANON_KEY || ${keyLiteral}
).trim();

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
`;
}
