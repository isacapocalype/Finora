// FINORA — BUILD WWW
// Menyalin seluruh file aplikasi (HTML, assets) ke folder www/ untuk Capacitor.
// Lalu menulis ulang assets/js/config.js dari environment variable (rahasia build).

import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderConfig } from './generate-config.mjs';

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

writeFileSync(path.join(assetsTarget, 'js', 'config.js'), renderConfig());
