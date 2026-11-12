// FINORA — ENSURE CONFIG
// Membuat assets/js/config.js bila belum ada (misalnya pada checkout CI bersih).
// File yang sudah ada tidak ditimpa agar konfigurasi lokal tetap aman.

import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderConfig } from './generate-config.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const target = path.join(root, 'assets', 'js', 'config.js');

if (existsSync(target) && process.env.FINORA_FORCE_CONFIG !== '1') {
  console.log('assets/js/config.js sudah ada — dilewati.');
  process.exit(0);
}

writeFileSync(target, renderConfig());
console.log('assets/js/config.js dibuat dari environment variable.');
