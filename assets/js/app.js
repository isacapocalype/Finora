import { LOCAL_USER } from './local.js';
import { getOrCreateProfile } from './services/profile.service.js';
import { renderLayout } from './components/layout.js';
import {
  initPageTransitions,
  startRouteProgress,
  finishRouteProgress
} from './components/motion.js';
import { icon, refreshIcons } from './icons.js';
import { escapeHtml, getErrorMessage } from './utils.js';
import { initNativeShell } from './native.js';

const PAGE_LOADERS = {
  dashboard: () => import('./dashboard.js'),
  wallets: () => import('./wallets.js'),
  debts: () => import('./debts.js'),
  receivables: () => import('./receivables.js'),
  savings: () => import('./savings.js'),
  history: () => import('./history.js'),
  settings: () => import('./settings.js')
};

const page = document.body.dataset.page;

bootstrap().catch((error) => {
  console.error('Failed to initialize Finora:', error);
  finishRouteProgress({ immediate: true });

  renderFatalError({
    title: 'Aplikasi gagal dimuat',
    message: getErrorMessage(
      error,
      'Terjadi kesalahan saat menyiapkan halaman. Silakan muat ulang.'
    )
  });
});

async function bootstrap() {
  const loader = PAGE_LOADERS[page];

  if (!loader) {
    renderFatalError({
      title: 'Halaman tidak ditemukan',
      message: 'Halaman yang Anda buka tidak dikenali oleh aplikasi Finora.',
      showHome: true
    });
    return;
  }

  initPageTransitions();
  startRouteProgress();

  let profile;

  try {
    profile = await getOrCreateProfile(LOCAL_USER);
  } catch (error) {
    console.error('Failed to load local profile:', error);
    finishRouteProgress({ immediate: true });

    renderFatalError({
      title: 'Penyimpanan lokal tidak dapat diakses',
      message:
        'Finora tidak dapat membuka penyimpanan di perangkat ini. Pastikan penyimpanan tidak penuh, lalu muat ulang aplikasi.',
      showRetry: true
    });
    return;
  }

  renderLayout({
    profile,
    activePage: page
  });

  initNativeShell({ activePage: page });

  try {
    const module = await loader();

    if (typeof module.initPage === 'function') {
      await module.initPage({
        user: LOCAL_USER,
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
  } finally {
    finishRouteProgress();
  }
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
        </div>
      </section>
    </main>
  `;

  document.querySelector('[data-retry-bootstrap]')?.addEventListener('click', () => {
    window.location.reload();
  });

  refreshIcons();
}
