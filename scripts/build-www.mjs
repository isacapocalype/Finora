// FINORA — BUILD WWW
// Menyalin seluruh file aplikasi (HTML, CSS, JS) ke folder www/ untuk Capacitor.

import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync
} from 'node:fs';
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

const www = path.join(root, 'www');
rmDir(www);
mkdirSync(path.join(www, 'assets'), { recursive: true });

const rootPages = ['index.html'];

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
