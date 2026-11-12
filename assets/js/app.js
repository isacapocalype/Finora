import { isConfigured, supabase } from './supabase.js';
import { getSession, onAuthStateChange } from './services/auth.service.js';
import { getOrCreateProfile } from './services/profile.service.js';
import { renderLayout } from './components/layout.js';
import { icon, refreshIcons } from './icons.js';
import { escapeHtml, getErrorMessage } from './utils.js';
import { initializeOfflineSync } from './offline/sync.js';
import { initOfflineUI } from './offline/ui.js';
import { initNativeShell } from './native.js';

const PAGE_LOADERS = {
  dashboard: () => import('./dashboard.js'),
  debts: () => import('./debts.js'),
  receivables: () => import('./receivables.js'),
  savings: () => import('./savings.js'),
  history: () => import('./history.js'),
  settings: () => import('./settings.js')
};

const page = document.body.dataset.page;
let redirecting = false;

bootstrap().catch((error) => {
  console.error('Failed to initialize Finora:', error);

  renderFatalError({
    title: 'Aplikasi gagal dimuat',
    message: getErrorMessage(
      error,
      'Terjadi kesalahan saat menyiapkan halaman. Silakan muat ulang.'
    )
  });
});

async function bootstrap() {
  if (!isConfigured) {
    renderFatalError({
      title: 'Supabase belum dikonfigurasi',
      message:
        'Isi SUPABASE_URL dan SUPABASE_ANON_KEY pada assets/js/config.js, lalu muat ulang halaman. Lihat README.md untuk langkah lengkap.',
      showRetry: true
    });
    return;
  }

  const loader = PAGE_LOADERS[page];

  if (!loader) {
    renderFatalError({
      title: 'Halaman tidak ditemukan',
      message: 'Halaman yang Anda buka tidak dikenali oleh aplikasi Finora.',
      showHome: true
    });
    return;
  }

  let session;

  try {
    session = await getSession();
  } catch (error) {
    console.error('Failed to read auth session:', error);

    renderFatalError({
      title: 'Sesi tidak dapat diperiksa',
      message:
        'Tidak dapat terhubung ke Supabase. Periksa koneksi internet dan konfigurasi project.',
      showRetry: true
    });
    return;
  }

  if (!session) {
    redirectToLogin();
    return;
  }

  let profile;

  try {
    profile = await getOrCreateProfile(session.user);
  } catch (error) {
    console.error('Failed to load profile:', error);

    renderFatalError({
      title: 'Database belum siap',
      message:
        'Profil pengguna tidak dapat dimuat. Pastikan schema.sql, functions.sql, dan policies.sql sudah dijalankan di Supabase.',
      showRetry: true
    });
    return;
  }

  renderLayout({
    user: session.user,
    profile,
    activePage: page
  });

  initOfflineUI(session.user.id);

  initializeOfflineSync(session.user.id).catch((error) => {
    console.warn('Offline cache initialization failed:', error);
  });

  initNativeShell({
    activePage: page,
    userId: session.user.id
  });

  onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      redirectToLogin();
    }
  });

  try {
    const module = await loader();

    if (typeof module.initPage === 'function') {
      await module.initPage({
        user: session.user,
        profile
      });
    }
  } catch (error) {
    console.error(`Failed to initialize page "${page}":`, error);

    const pageContent = document.querySelector('#page-content');

    if (pageContent) {
      pageContent.innerHTML = `
        <section class="glass-card page-init-error">
          <span class="error-state-icon">${icon('alert-triangle')}</span>
          <h2>Halaman gagal dimuat</h2>
          <p>${escapeHtml(
            getErrorMessage(error, 'Silakan muat ulang halaman dan coba lagi.')
          )}</p>
          <button type="button" class="btn btn-primary" data-page-reload>
            Muat ulang
          </button>
        </section>
      `;
      pageContent.querySelector('[data-page-reload]')?.addEventListener('click', () => {
        window.location.reload();
      });
      refreshIcons();
    }
  }
}

function redirectToLogin() {
  if (redirecting) {
    return;
  }

  redirecting = true;
  window.location.replace(new URL('../login.html', window.location.href).href);
}

function renderFatalError({ title, message, showRetry = false, showHome = false }) {
  document.body.className = 'fatal-body';
  document.body.innerHTML = `
    <main class="fatal-shell">
      <section class="glass-card fatal-card">
        <a class="brand" href="../index.html" aria-label="Finora">
          <img class="brand-logo" src="../assets/images/logo.svg" alt="" width="44" height="44">
          <span class="brand-name">Finora</span>
        </a>
        <span class="fatal-icon">${icon('shield-alert')}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <div class="fatal-actions">
          ${
            showRetry
              ? `<button type="button" class="btn btn-primary" data-retry-bootstrap>
                   ${icon('refresh-cw')}<span>Muat ulang</span>
                 </button>`
              : ''
          }
          ${
            showHome
              ? `<a class="btn btn-secondary" href="../pages/dashboard.html">Kembali ke Dashboard</a>`
              : ''
          }
          <a class="btn btn-secondary" href="../login.html">Halaman Masuk</a>
        </div>
      </section>
    </main>
  `;

  document.querySelector('[data-retry-bootstrap]')?.addEventListener('click', () => {
    window.location.reload();
  });

  refreshIcons();
}
