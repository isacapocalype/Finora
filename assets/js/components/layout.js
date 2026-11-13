import { escapeHtml, getInitials } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

const NAV_ITEMS = [
  { page: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
  { page: 'wallets', href: 'wallets.html', label: 'Dompet', icon: 'wallet' },
  { page: 'debts', href: 'debts.html', label: 'Utang', icon: 'arrow-down-left' },
  { page: 'receivables', href: 'receivables.html', label: 'Piutang', icon: 'arrow-up-right' },
  { page: 'savings', href: 'savings.html', label: 'Tabungan', icon: 'piggy-bank' },
  { page: 'history', href: 'history.html', label: 'Riwayat', icon: 'history' },
  { page: 'settings', href: 'settings.html', label: 'Pengaturan', icon: 'settings' }
];

const BOTTOM_ITEMS = [
  { page: 'dashboard', href: 'dashboard.html', label: 'Home', icon: 'layout-dashboard' },
  { page: 'wallets', href: 'wallets.html', label: 'Dompet', icon: 'wallet' },
  { page: 'debts', href: 'debts.html', label: 'Utang', icon: 'arrow-down-left' },
  { page: 'receivables', href: 'receivables.html', label: 'Piutang', icon: 'arrow-up-right' }
];

const MORE_PAGES = ['savings', 'history', 'settings'];

let sheetListenersBound = false;

export function renderLayout({ profile, activePage }) {
  const sidebar = document.getElementById('sidebar');
  const bottomNav = document.getElementById('bottom-nav');
  const displayName = profile?.full_name || 'Pengguna Finora';
  const initials = getInitials(displayName);

  if (sidebar) {
    sidebar.innerHTML = `
      <a class="brand" href="dashboard.html" aria-label="Finora — ke dashboard">
        <img class="brand-logo" src="../assets/images/logo.svg" alt="" width="40" height="40">
        <span class="brand-name">Finora</span>
      </a>

      <nav class="sidebar-nav" aria-label="Navigasi utama">
        ${NAV_ITEMS.map(
          (item) => `
            <a class="nav-link ${activePage === item.page ? 'is-active' : ''}"
               href="${item.href}"
               ${activePage === item.page ? 'aria-current="page"' : ''}>
              ${icon(item.icon)}
              <span>${item.label}</span>
            </a>
          `
        ).join('')}
      </nav>

      <div class="sidebar-footer">
        <a class="user-card" href="settings.html" aria-label="Buka pengaturan profil">
          <span class="avatar" data-user-initials>${escapeHtml(initials)}</span>
          <span class="user-card-meta">
            <strong data-user-name>${escapeHtml(displayName)}</strong>
            <small>Data lokal</small>
          </span>
        </a>
      </div>
    `;
  }

  if (bottomNav) {
    bottomNav.innerHTML = `
      ${BOTTOM_ITEMS.map(
        (item) => `
          <a class="bottom-nav-link ${activePage === item.page ? 'is-active' : ''}"
             href="${item.href}"
             ${activePage === item.page ? 'aria-current="page"' : ''}>
            ${icon(item.icon)}
            <span>${item.label}</span>
          </a>
        `
      ).join('')}
      <button type="button"
              class="bottom-nav-link ${MORE_PAGES.includes(activePage) ? 'is-active' : ''}"
              data-more-menu
              aria-expanded="false"
              aria-controls="mobile-sheet">
        ${icon('menu')}
        <span>Lainnya</span>
      </button>
    `;
  }

  renderIdentity({ profile });
  ensureMobileSheet(activePage);
  refreshIcons();
}

export function renderIdentity({ profile }) {
  const displayName = profile?.full_name || 'Pengguna Finora';
  const initials = getInitials(displayName);

  document.querySelectorAll('[data-user-name]').forEach((element) => {
    element.textContent = displayName;
  });
  document.querySelectorAll('[data-user-initials]').forEach((element) => {
    element.textContent = initials;
  });
  document.querySelectorAll('[data-user-first-name]').forEach((element) => {
    element.textContent = displayName.split(/\s+/)[0] || 'Pengguna';
  });
}

function ensureMobileSheet(activePage = '') {
  const existing = document.getElementById('mobile-sheet');

  if (existing) {
    existing.querySelectorAll('[data-sheet-page]').forEach((link) => {
      const isActive = link.dataset.sheetPage === activePage;
      link.classList.toggle('is-active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    bindSheetListeners();
    return;
  }

  const sheet = document.createElement('div');
  sheet.id = 'mobile-sheet';
  sheet.className = 'mobile-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button type="button" class="mobile-sheet-backdrop" data-sheet-close aria-label="Tutup menu"></button>
    <div class="mobile-sheet-panel" role="dialog" aria-modal="true" aria-label="Menu lainnya">
      <span class="sheet-handle" aria-hidden="true"></span>
      <a class="sheet-link ${activePage === 'savings' ? 'is-active' : ''}" data-sheet-page="savings" href="savings.html">${icon('piggy-bank')}<span>Tabungan</span></a>
      <a class="sheet-link ${activePage === 'history' ? 'is-active' : ''}" data-sheet-page="history" href="history.html">${icon('history')}<span>Riwayat Transaksi</span></a>
      <a class="sheet-link ${activePage === 'settings' ? 'is-active' : ''}" data-sheet-page="settings" href="settings.html">${icon('settings')}<span>Pengaturan</span></a>
    </div>
  `;

  document.body.appendChild(sheet);
  bindSheetListeners();
}

function bindSheetListeners() {
  if (sheetListenersBound) {
    return;
  }

  const sheet = document.getElementById('mobile-sheet');
  const moreButton = document.querySelector('[data-more-menu]');

  if (!sheet || !moreButton) {
    return;
  }

  sheetListenersBound = true;
  let closeTimer = null;

  moreButton.addEventListener('click', () => {
    openSheet();
  });

  sheet.querySelector('[data-sheet-close]')?.addEventListener('click', closeSheet);

  sheet.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeSheet);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) {
      closeSheet();
    }
  });

  function openSheet() {
    globalThis.clearTimeout(closeTimer);
    sheet.hidden = false;
    moreButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    sheet.querySelector('.sheet-link')?.focus();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    moreButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sheet-open');
    globalThis.clearTimeout(closeTimer);
    closeTimer = globalThis.setTimeout(() => {
      sheet.hidden = true;
    }, 220);
  }
}
