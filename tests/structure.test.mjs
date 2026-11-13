import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'index.html',
  'pages/dashboard.html',
  'pages/wallets.html',
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
  'assets/js/local.js',
  'assets/js/photo.js',
  'assets/js/storage/db.js',
  'assets/js/storage/id.js',
  'assets/js/app.js',
  'assets/js/index.js',
  'assets/js/dashboard.js',
  'assets/js/wallets.js',
  'assets/js/debts.js',
  'assets/js/receivables.js',
  'assets/js/savings.js',
  'assets/js/history.js',
  'assets/js/settings.js',
  'assets/js/components/ledger.js',
  'assets/js/components/modal.js',
  'assets/js/components/motion.js',
  'assets/js/components/toast.js',
  'assets/js/components/states.js',
  'assets/js/components/layout.js',
  'assets/js/components/summary.js',
  'assets/js/components/charts.js',
  'assets/js/services/profile.service.js',
  'assets/js/services/contact.service.js',
  'assets/js/services/dashboard.service.js',
  'assets/js/services/debt.service.js',
  'assets/js/services/receivable.service.js',
  'assets/js/services/savings.service.js',
  'assets/js/services/wallet.service.js',
  'assets/js/services/history.service.js',
  'scripts/build-www.mjs',
  'tests/storage.test.mjs',
  'tests/utils.test.mjs',
  'README.md'
];

// Bagian dari versi cloud/auth yang sudah dihapus. Aplikasi lokal tidak boleh
// kembali bergantung pada berkas-berkas ini tanpa perubahan arsitektur.
const REMOVED_PATHS = [
  'login.html',
  'register.html',
  'forgot-password.html',
  'reset-password.html',
  'assets/js/auth.js',
  'assets/js/supabase.js',
  'assets/js/config.js',
  'assets/js/services/auth.service.js',
  'assets/js/offline',
  'assets/js/offline/db.js',
  'assets/vendor/supabase.bundle.js',
  'database',
  'database/schema.sql',
  'database/functions.sql',
  'database/policies.sql',
  'scripts/ensure-config.mjs',
  'scripts/generate-config.mjs',
  'tests/sql.test.mjs'
];

const PAGE_MODULES = [
  'dashboard',
  'wallets',
  'debts',
  'receivables',
  'savings',
  'history',
  'settings'
];

const STORE_NAMES = [
  'profiles',
  'contacts',
  'debts',
  'debt_additions',
  'debt_payments',
  'receivables',
  'receivable_additions',
  'receivable_payments',
  'savings',
  'savings_transactions',
  'wallets',
  'wallet_transactions'
];

async function fileExists(relativePath) {
  try {
    const info = await stat(path.join(root, relativePath));
    return info.isFile();
  } catch {
    return false;
  }
}

async function pathExists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
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

test('berkas login, Supabase, SQL, dan offline lama sudah dihapus', async () => {
  const existing = [];

  for (const target of REMOVED_PATHS) {
    if (await pathExists(target)) {
      existing.push(target);
    }
  }

  assert.deepEqual(existing, []);
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
    assert.doesNotMatch(html, /type="importmap"/, `${file}: import map`);
    assert.doesNotMatch(html, /supabase/i, `${file}: referensi Supabase`);

    const localRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((ref) => !/^https?:|^#|^mailto:|^javascript:/.test(ref));

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

  for (const page of ['dashboard', 'settings']) {
    const html = await readFile(path.join(root, 'pages', `${page}.html`), 'utf8');
    assert.match(html, /data-user-name/, `${page}: identitas lokal`);
  }
});

test('index.html langsung membuka dashboard tanpa login', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const entry = await readFile(path.join(root, 'assets/js/index.js'), 'utf8');

  assert.match(html, /assets\/js\/index\.js/);
  assert.match(entry, /pages\/dashboard\.html/);
  assert.doesNotMatch(entry, /login\.html|auth\.service|supabase/i);
});

test('app.js memuat semua modul halaman tanpa auth', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');

  assert.doesNotMatch(app, /login|auth\.service|supabase|session/i);
  assert.match(app, /getOrCreateProfile/);
  assert.match(app, /LOCAL_USER/);

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

test('frontend tidak lagi memakai Supabase, auth, atau antrean offline', async () => {
  const files = [
    ...(await collectFiles('assets/js', '.js')),
    ...(await collectFiles('pages', '.html')),
    ...(await readdir(root))
      .filter((file) => file.endsWith('.html'))
      .map((file) => file)
  ];

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');

    assert.doesNotMatch(source, /supabase/i, `${file}: Supabase`);
    assert.doesNotMatch(source, /service_role\s*[:=]/i, `${file}: service role`);
    assert.doesNotMatch(
      source,
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./,
      `${file}: token JWT`
    );
    assert.doesNotMatch(source, /enqueueOutbox|flushOutbox/i, `${file}: outbox`);
    assert.doesNotMatch(source, /signIn|signOut|onAuthStateChange/i, `${file}: auth`);
  }
});

test('penyimpanan lokal memakai IndexedDB dengan seluruh tabel aplikasi', async () => {
  const database = await readFile(
    path.join(root, 'assets/js/storage/db.js'),
    'utf8'
  );
  const local = await readFile(path.join(root, 'assets/js/local.js'), 'utf8');

  assert.match(database, /indexedDB\.open/);
  assert.match(database, /'finora-local'/);
  assert.match(database, /DB_VERSION\s*=\s*3/);
  assert.match(database, /export async function writeBatch/);
  assert.match(database, /export async function clearAllData/);
  assert.match(local, /LOCAL_USER_ID\s*=\s*'local-device'/);
  assert.match(local, /Pengguna Finora/);

  for (const store of STORE_NAMES) {
    assert.match(database, new RegExp(`'${store}'`), `store ${store}`);
  }

  for (const service of [
    'profile.service.js',
    'contact.service.js',
    'debt.service.js',
    'receivable.service.js',
    'savings.service.js',
    'wallet.service.js',
    'history.service.js',
    'dashboard.service.js'
  ]) {
    const source = await readFile(
      path.join(root, 'assets/js/services', service),
      'utf8'
    );
    assert.match(source, /storage\/db\.js/, `${service}: storage lokal`);
  }
});

test('halaman utang dan piutang memakai profil kontak dan penambahan pokok', async () => {
  const ledger = await readFile(
    path.join(root, 'assets/js/components/ledger.js'),
    'utf8'
  );

  assert.match(ledger, /openContactProfile/);
  assert.match(ledger, /openPrincipalForm/);
  assert.match(ledger, /fileToAvatarDataUrl/);
  assert.match(ledger, /profile-addition-history/);

  for (const page of ['debts.js', 'receivables.js']) {
    const source = await readFile(
      path.join(root, 'assets/js', page),
      'utf8'
    );

    assert.match(source, /addPrincipal/, `${page}: addPrincipal`);
    assert.match(source, /listAdditions/, `${page}: listAdditions`);
    assert.match(source, /profileTitle/, `${page}: profileTitle`);
    assert.match(source, /principalAction/, `${page}: principalAction`);
  }
});

test('halaman dompet, navigasi, dan sistem motion terhubung', async () => {
  const layout = await readFile(
    path.join(root, 'assets/js/components/layout.js'),
    'utf8'
  );
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
  const motion = await readFile(
    path.join(root, 'assets/js/components/motion.js'),
    'utf8'
  );
  const history = await readFile(
    path.join(root, 'pages/history.html'),
    'utf8'
  );
  const walletService = await readFile(
    path.join(root, 'assets/js/services/wallet.service.js'),
    'utf8'
  );
  const variables = await readFile(
    path.join(root, 'assets/css/variables.css'),
    'utf8'
  );
  const layoutCss = await readFile(
    path.join(root, 'assets/css/layout.css'),
    'utf8'
  );
  const components = await readFile(
    path.join(root, 'assets/css/components.css'),
    'utf8'
  );
  const modal = await readFile(
    path.join(root, 'assets/js/components/modal.js'),
    'utf8'
  );
  const gradle = await readFile(
    path.join(root, 'android/app/build.gradle'),
    'utf8'
  );

  assert.match(layout, /wallets\.html/);
  assert.match(layout, /label: 'Dompet'/);
  assert.match(layout, /MORE_PAGES/);
  assert.match(app, /wallets:\s*\(\)\s*=>\s*import\('\.\/wallets\.js'\)/);
  assert.match(history, /data-history-group="wallets"/);
  assert.match(walletService, /recordWalletTransfer/);
  assert.match(walletService, /deleteWallet/);
  assert.match(walletService, /wallet_transactions/);
  assert.match(variables, /--motion-ease-emphasized/);
  assert.match(layoutCss, /@view-transition/);
  assert.match(layoutCss, /content-reveal/);
  assert.match(layoutCss, /\.route-progress\s*\{/);
  assert.match(layoutCss, /route-progress-bar/);
  assert.match(layoutCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /initRouteProgress/);
  assert.match(motion, /startRouteProgress/);
  assert.match(motion, /finishRouteProgress/);
  assert.match(motion, /route-progress/);
  assert.match(app, /startRouteProgress/);
  assert.match(app, /finishRouteProgress/);
  assert.match(components, /prefers-reduced-motion:\s*reduce/);
  assert.match(modal, /is-closing/);
  assert.match(gradle, /versionCode 5/);
  assert.match(gradle, /versionName "2\.3"/);
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

test('package.json menyediakan perintah pengujian lokal', async () => {
  const pkg = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );

  assert.equal(pkg.version, '2.3.0');
  assert.match(pkg.scripts.test, /test:storage/);
  assert.match(pkg.scripts.test, /test:utils/);
  assert.match(pkg.scripts.test, /test:structure/);
  assert.doesNotMatch(pkg.scripts.test, /test:sql/);
  assert.equal(pkg.scripts.dev, 'python3 -m http.server 4173');
  assert.equal(pkg.dependencies['@supabase/supabase-js'], undefined);
  assert.equal(pkg.devDependencies['@electric-sql/pglite'], undefined);
  assert.equal(pkg.dependencies['@capacitor/network'], undefined);
});

test('konfigurasi Capacitor memakai aplikasi lokal tanpa plugin jaringan', async () => {
  const config = JSON.parse(
    await readFile(path.join(root, 'capacitor.config.json'), 'utf8')
  );

  assert.equal(config.appId, 'com.finora.app');
  assert.equal(config.webDir, 'www');
  assert.equal(config.plugins['@capacitor/network'], undefined);
});

test('workflow rilis tidak membutuhkan secrets Supabase', async () => {
  const workflow = await readFile(
    path.join(root, '.github/workflows/android-release.yml'),
    'utf8'
  );

  assert.doesNotMatch(workflow, /SUPABASE|supabase/i);
  assert.match(workflow, /tags:/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /softprops\/action-gh-release/);
});

test('README menjelaskan penyimpanan lokal tanpa login', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');

  assert.match(readme, /tanpa login|tanpa akun/i);
  assert.match(readme, /IndexedDB/);
  assert.doesNotMatch(readme, /Supabase/i);
  assert.doesNotMatch(readme, /service role/i);
});
