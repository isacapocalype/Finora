// FINORA — NATIVE SHELL
// Status bar, tombol kembali Android, dan sinkronisasi saat aplikasi kembali aktif.

import {
  App,
  Capacitor,
  Network,
  SplashScreen,
  StatusBar,
  Style
} from '../vendor/capacitor.bundle.js';
import { showToast } from './components/toast.js';
import { isOnline, setNativeOnline } from './offline/network.js';
import { syncNow } from './offline/sync.js';

let initialized = false;
let lastBackPress = 0;

function configureStatusBar() {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#f8f7fc' }).catch(() => {});
}

function closeTopLayer() {
  const dialog = document.querySelector('dialog.modal[open]');

  if (dialog) {
    dialog.querySelector('.modal-close')?.click();
    return true;
  }

  const sheet = document.getElementById('mobile-sheet');

  if (sheet && !sheet.hidden) {
    sheet.querySelector('[data-sheet-close]')?.click();
    return true;
  }

  return false;
}

export function initNativeShell({ activePage, userId }) {
  if (!Capacitor?.isNativePlatform?.() || initialized) {
    return;
  }

  initialized = true;
  configureStatusBar();

  Network.addListener('networkStatusChange', (status) => {
    const wasOnline = isOnline();
    setNativeOnline(status.connected);

    if (wasOnline !== status.connected) {
      window.dispatchEvent(new Event(status.connected ? 'online' : 'offline'));
    }
  });

  Network.getStatus()
    .then((status) => {
      const wasOnline = isOnline();
      setNativeOnline(status.connected);

      if (wasOnline !== status.connected) {
        window.dispatchEvent(new Event(status.connected ? 'online' : 'offline'));
      }
    })
    .catch(() => {});

  App.addListener('backButton', async () => {
    if (closeTopLayer()) {
      return;
    }

    if (activePage !== 'dashboard') {
      window.location.assign(new URL('dashboard.html', window.location.href).href);
      return;
    }

    const now = Date.now();

    if (now - lastBackPress < 2000) {
      await App.exitApp();
      return;
    }

    lastBackPress = now;
    showToast('Tekan tombol kembali sekali lagi untuk keluar.', 'info');
  });

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && userId && isOnline()) {
      syncNow(userId).catch(() => {});
    }
  });

  SplashScreen.hide().catch(() => {});
}
