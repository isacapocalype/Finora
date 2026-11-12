// FINORA — OFFLINE UI
// Banner status koneksi, antrean sinkronisasi, dan tombol coba lagi.

import { icon, refreshIcons } from '../icons.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils.js';
import { SYNC_EVENT } from './flush.js';
import {
  NETWORK_EVENT,
  readLastSyncError,
  readPendingCount,
  syncNow
} from './sync.js';
import { isOnline } from './network.js';

const BANNER_ID = 'sync-banner';

const state = {
  userId: null,
  online: true,
  pending: 0,
  syncing: false,
  failure: null,
  initialized: false
};

let retrying = false;

function ensureBanner() {
  let banner = document.getElementById(BANNER_ID);

  if (banner) {
    return banner;
  }

  const appMain = document.querySelector('.app-main');

  if (!appMain) {
    return null;
  }

  banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'sync-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  appMain.insertBefore(banner, appMain.firstChild);

  return banner;
}

function render() {
  const banner = ensureBanner();

  if (!banner) {
    return;
  }

  let variant = '';
  let iconName = 'cloud-check';
  let title = '';
  let detail = '';
  let action = '';

  if (!state.online) {
    variant = 'offline';
    iconName = 'wifi-off';
    title = 'Mode offline';
    detail =
      state.pending > 0
        ? `${state.pending} perubahan disimpan dan akan disinkronkan otomatis.`
        : 'Data dibaca dari perangkat. Perubahan akan disinkronkan saat online.';
  } else if (state.syncing) {
    variant = 'syncing';
    iconName = 'refresh-cw';
    title = 'Menyinkronkan…';
    detail =
      state.pending > 0
        ? `${state.pending} perubahan sedang dikirim ke server.`
        : 'Menyegarkan data dari server.';
  } else if (state.failure) {
    variant = 'error';
    iconName = 'alert-triangle';
    title = 'Sinkronisasi tertunda';
    detail = state.failure.message || 'Beberapa perubahan belum terkirim.';
    action = 'retry';
  } else if (state.pending > 0) {
    variant = 'pending';
    iconName = 'cloud-upload';
    title = 'Menunggu sinkronisasi';
    detail = `${state.pending} perubahan belum terkirim ke server.`;
    action = 'retry';
  } else {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }

  banner.className = `sync-banner sync-banner--${variant}`;
  banner.hidden = false;
  banner.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  banner.innerHTML = `
    <span class="sync-banner-icon">${icon(iconName)}</span>
    <div class="sync-banner-copy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    ${
      action === 'retry'
        ? `<button type="button" class="sync-banner-action" data-sync-retry>
             ${icon('refresh-cw')}<span>Coba lagi</span>
           </button>`
        : ''
    }
  `;

  banner
    .querySelector('[data-sync-retry]')
    ?.addEventListener('click', handleRetry);

  refreshIcons();
}

async function refreshStatus() {
  state.online = isOnline();

  if (state.userId) {
    try {
      state.pending = await readPendingCount(state.userId);
    } catch {
      state.pending = 0;
    }

    try {
      state.failure = state.pending > 0 ? await readLastSyncError() : null;
    } catch {
      state.failure = null;
    }
  }

  render();
}

async function handleRetry() {
  if (retrying || !state.userId) {
    return;
  }

  retrying = true;
  state.syncing = true;
  state.failure = null;
  render();

  try {
    const result = await syncNow(state.userId);

    if (result.failure) {
      state.failure = result.failure;
    }
  } catch (error) {
    state.failure = {
      message: error?.message || 'Sinkronisasi gagal. Coba lagi.'
    };
  } finally {
    retrying = false;
    state.syncing = false;
    await refreshStatus();
  }
}

function handleNetworkEvent(event) {
  const detail = event.detail || {};
  state.online = detail.online ?? isOnline();

  if (typeof detail.pending === 'number') {
    state.pending = detail.pending;
  }

  if (state.online) {
    state.failure = null;
  }

  render();
  refreshStatus();
}

function handleSyncEvent(event) {
  const detail = event.detail || {};

  if (detail.status === 'started') {
    state.syncing = true;
    state.failure = null;

    if (typeof detail.pending === 'number') {
      state.pending = detail.pending;
    }

    render();
    return;
  }

  if (detail.status === 'completed') {
    state.syncing = false;
    state.failure = null;

    if (typeof detail.pending === 'number') {
      state.pending = detail.pending;
    }

    if (detail.processed > 0) {
      showToast(
        `${detail.processed} perubahan berhasil disinkronkan.`,
        'success',
        'Sinkronisasi selesai'
      );
    }

    render();
    return;
  }

  if (detail.status === 'error') {
    state.syncing = false;
    state.failure = detail.failure || {
      message: 'Sinkronisasi gagal. Periksa koneksi lalu coba lagi.'
    };

    if (typeof detail.pending === 'number') {
      state.pending = detail.pending;
    }

    render();
  }
}

export function initOfflineUI(userId) {
  state.userId = userId;
  state.online = isOnline();

  if (state.initialized) {
    refreshStatus();
    return () => {};
  }

  state.initialized = true;
  ensureBanner();

  window.addEventListener(NETWORK_EVENT, handleNetworkEvent);
  window.addEventListener(SYNC_EVENT, handleSyncEvent);
  window.addEventListener('online', refreshStatus);
  window.addEventListener('offline', refreshStatus);

  refreshStatus();

  return () => {
    window.removeEventListener(NETWORK_EVENT, handleNetworkEvent);
    window.removeEventListener(SYNC_EVENT, handleSyncEvent);
    window.removeEventListener('online', refreshStatus);
    window.removeEventListener('offline', refreshStatus);
    state.initialized = false;
  };
}
