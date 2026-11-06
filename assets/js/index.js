import { isConfigured } from './supabase.js';
import { getSession } from './services/auth.service.js';
import { icon, refreshIcons } from './icons.js';

const statusElement = document.getElementById('index-status');
const retryButton = document.getElementById('index-retry');
const loginUrl = new URL('login.html', window.location.href).href;
const dashboardUrl = new URL('pages/dashboard.html', window.location.href).href;

retryButton?.addEventListener('click', () => {
  window.location.reload();
});

boot();

async function boot() {
  refreshIcons();

  if (!isConfigured) {
    showStatus(
      'Supabase belum dikonfigurasi. Isi assets/js/config.js terlebih dahulu, lalu muat ulang halaman.',
      false
    );
    return;
  }

  try {
    const session = await getSession();
    window.location.replace(session ? dashboardUrl : loginUrl);
  } catch (error) {
    console.error('Failed to initialize Finora:', error);
    showStatus(
      'Tidak dapat terhubung ke server. Periksa koneksi internet dan konfigurasi Supabase.',
      true
    );
  }
}

function showStatus(message, canRetry) {
  if (!statusElement) {
    return;
  }

  const loader = document.querySelector('.index-loader');

  if (loader) {
    loader.hidden = true;
  }

  statusElement.innerHTML = `
    <span class="index-status-icon">${icon('alert-circle')}</span>
    <p>${message}</p>
  `;

  if (retryButton && canRetry) {
    retryButton.hidden = false;
  }

  refreshIcons();
}
