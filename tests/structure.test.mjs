import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'index.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'reset-password.html',
  'pages/dashboard.html',
  'pages/debts.html',
  'pages/receivables.html',
  'pages/savings.html',
  'pages/history.html',
  'pages/settings.html',
  'assets/css/variables.css',
  'assets/css/reset.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/dashboard.css',
  'assets/css/pages.css',
  'assets/css/responsive.css',
  'assets/js/config.js',
  'assets/js/supabase.js',
  'assets/js/app.js',
  'assets/js/auth.js',
  'assets/js/dashboard.js',
  'assets/js/debts.js',
  'assets/js/receivables.js',
  'assets/js/savings.js',
  'assets/js/history.js',
  'assets/js/settings.js',
  'assets/js/components/ledger.js',
  'assets/js/components/modal.js',
  'assets/js/components/toast.js',
  'assets/js/components/states.js',
  'assets/js/components/layout.js',
  'assets/js/components/summary.js',
  'assets/js/components/charts.js',
  'assets/js/services/auth.service.js',
  'assets/js/services/profile.service.js',
  'assets/js/services/dashboard.service.js',
  'assets/js/services/debt.service.js',
  'assets/js/services/receivable.service.js',
  'assets/js/services/savings.service.js',
  'assets/js/services/history.service.js',
  'database/schema.sql',
  'database/functions.sql',
  'database/policies.sql',
  'README.md'
];

const PAGE_MODULES = [
  'dashboard',
  'debts',
  'receivables',
  'savings',
  'history',
  'settings'
];

async function fileExists(relativePath) {
  try {
    const info = await stat(path.join(root, relativePath));
    return info.isFile();
  } catch {
    return false;
  }
}

async function collectFiles(directory, extension) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true
  });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relative, extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(relative);
    }
  }

  return files;
}

test('seluruh file wajib tersedia', async () => {
  const missing = [];

  for (const file of REQUIRED_FILES) {
    if (!(await fileExists(file))) {
      missing.push(file);
    }
  }

  assert.deepEqual(missing, []);
});

test('halaman aplikasi memuat aset dan struktur layout yang benar', async () => {
  const htmlFiles = [
    ...(await readdir(root))
      .filter((file) => file.endsWith('.html'))
      .map((file) => file),
    ...PAGE_MODULES.map((page) => `pages/${page}.html`)
  ];

  for (const file of htmlFiles) {
    const html = await readFile(path.join(root, file), 'utf8');

    assert.match(html, /<html lang="id">/, `${file}: atribut bahasa`);

    const localRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((ref) => !/^https?:|^#|^mailto:/.test(ref));

    for (const reference of localRefs) {
      const resolved = path.normalize(
        path.join(path.dirname(file), reference.split('?')[0])
      );

      assert.ok(
        await fileExists(resolved),
        `${file}: aset ${reference} tidak ditemukan`
      );
    }
  }

  for (const page of PAGE_MODULES) {
    const html = await readFile(path.join(root, 'pages', `${page}.html`), 'utf8');

    assert.match(html, new RegExp(`data-page="${page}"`), `${page}: data-page`);
    assert.match(html, /id="sidebar"/, `${page}: sidebar`);
    assert.match(html, /id="bottom-nav"/, `${page}: bottom nav`);
    assert.match(html, /id="page-content"/, `${page}: page content`);
    assert.match(html, /id="toast-root"/, `${page}: toast root`);
    assert.match(html, /id="modal-root"/, `${page}: modal root`);
    assert.match(html, /assets\/js\/app\.js/, `${page}: app module`);
  }
});

test('halaman autentikasi memakai modul auth', async () => {
  const authPages = {
    'login.html': 'login',
    'register.html': 'register',
    'forgot-password.html': 'forgot',
    'reset-password.html': 'reset'
  };

  for (const [file, page] of Object.entries(authPages)) {
    const html = await readFile(path.join(root, file), 'utf8');
    assert.match(html, new RegExp(`data-auth-page="${page}"`), file);
    assert.match(html, /assets\/js\/auth\.js/, file);
  }
});

test('app.js memuat semua modul halaman yang ada', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');

  for (const page of PAGE_MODULES) {
    assert.match(
      app,
      new RegExp(`${page}:\\s*\\(\\)\\s*=>\\s*import\\('\\./${page}\\.js'\\)`),
      `loader ${page}`
    );

    const module = await readFile(
      path.join(root, 'assets/js', `${page}.js`),
      'utf8'
    );
    assert.match(module, /export (async )?function initPage/, `${page}: initPage`);
  }
});

test('semua import lokal JavaScript menunjuk file yang ada', async () => {
  const files = await collectFiles('assets/js', '.js');

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    );

    for (const specifier of imports) {
      if (/^(https?:|node:|@)/.test(specifier)) {
        continue;
      }

      const resolved = path.normalize(
        path.join(path.dirname(file), specifier)
      );
      assert.ok(
        await fileExists(resolved),
        `${file}: import ${specifier} tidak ditemukan`
      );
    }
  }
});

test('tidak ada placeholder atau fungsi transaksi palsu di frontend', async () => {
  const files = [
    ...(await collectFiles('assets/js', '.js')),
    ...(await collectFiles('pages', '.html')),
    ...(await readdir(root))
      .filter((file) => file.endsWith('.html'))
      .map((file) => file)
  ];

  const forbidden = [
    /\bTODO\b/i,
    /coming soon/i,
    /lorem ipsum/i,
    /alert\s*\(\s*['"]/,
    /transaction successful/i,
    /dummy[_-]?data/i
  ];

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');

    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file}: ${pattern}`);
    }
  }
});

test('konfigurasi frontend tidak memuat service role key', async () => {
  const files = [
    ...(await collectFiles('assets/js', '.js')),
    ...(await readdir(root))
      .filter((file) => file.endsWith('.html'))
      .map((file) => file)
  ];

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /service_role\s*[:=]/i, file);
    assert.doesNotMatch(source, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./, file);
  }
});

test('SQL memuat RLS, RPC atomik, dan view riwayat', async () => {
  const schema = await readFile(path.join(root, 'database/schema.sql'), 'utf8');
  const functions = await readFile(
    path.join(root, 'database/functions.sql'),
    'utf8'
  );
  const policies = await readFile(
    path.join(root, 'database/policies.sql'),
    'utf8'
  );

  for (const table of [
    'profiles',
    'debts',
    'debt_payments',
    'receivables',
    'receivable_payments',
    'savings',
    'savings_transactions'
  ]) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(
      policies,
      new RegExp(`alter table public\\.${table} enable row level security`)
    );
  }

  assert.match(schema, /create or replace view public\.transaction_history/);
  assert.match(functions, /record_debt_payment/);
  assert.match(functions, /record_receivable_payment/);
  assert.match(functions, /record_savings_transaction/);
  assert.match(functions, /security definer/);
  assert.match(functions, /for update/);
  assert.match(policies, /auth\.uid\(\)/);
});

test('package.json menyediakan perintah pengujian', async () => {
  const pkg = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );

  assert.match(pkg.scripts.test, /test:sql/);
  assert.match(pkg.scripts.test, /test:utils/);
  assert.match(pkg.scripts.test, /test:structure/);
  assert.equal(pkg.scripts.dev, 'python3 -m http.server 4173');
});
