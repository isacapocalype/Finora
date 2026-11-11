// FINORA — BUILD WWW
// Menyalin seluruh file aplikasi (HTML, assets) ke folder www/ untuk Capacitor.
// Lalu menulis ulang assets/js/config.js dari environment variable (rahasia build).

import { copyFileSync, cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');

function rmDir(target) {
  rmSync(target, { recursive: true, force: true });
}

function copyDir(sourceDir, targetDir) {
  cpSync(sourceDir, targetDir, { recursive: true });
}

function copyFile(source, target) {
  copyFileSync(source, target);
}

const supabaseUrl =
  process.env.FINORA_SUPABASE_URL || process.env.SUPABASE_URL || 'https://falbyiisuuzpskosfdrt.supabase.co';
const supabaseAnonKey =
  process.env.FINORA_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_xxzYNfbmg4pnGS78H5esIg_ETiKR3sp';

const www = path.join(root, 'www');
rmDir(www);
mkdirSync(path.join(www, 'assets'), { recursive: true });

const rootPages = [
  'index.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'reset-password.html'
];

for (const file of rootPages) {
  copyFile(path.join(root, file), path.join(www, file));
}

const pagesSource = path.join(root, 'pages');
const pagesTarget = path.join(www, 'pages');
rmDir(pagesTarget);
mkdirSync(pagesTarget, { recursive: true });
for (const entry of readdirSync(pagesSource)) {
  if (entry.endsWith('.html')) {
    copyFile(path.join(pagesSource, entry), path.join(pagesTarget, entry));
  }
}

const assetsSource = path.join(root, 'assets');
const assetsTarget = path.join(www, 'assets');
rmDir(assetsTarget);
mkdirSync(assetsTarget, { recursive: true });
for (const dir of ['css', 'images', 'js', 'vendor', 'fonts']) {
  copyDir(path.join(assetsSource, dir), path.join(assetsTarget, dir));
}

const generatedConfig = `const runtimeConfig =
  typeof window !== 'undefined' && window.FINORA_CONFIG ? window.FINORA_CONFIG : {};

export const APP_NAME = 'Finora';
export const SUPPORTED_CURRENCY = 'IDR';

export const SUPABASE_URL = String(
  runtimeConfig.SUPABASE_URL || '${supabaseUrl}'
).trim();
export const SUPABASE_ANON_KEY = String(
  runtimeConfig.SUPABASE_ANON_KEY || '${supabaseAnonKey}'
).trim();

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_SUPABASE') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
`;

writeFileSync(path.join(assetsTarget, 'js', 'config.js'), generatedConfig);
