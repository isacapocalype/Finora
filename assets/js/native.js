// FINORA — NATIVE SHELL
// Status bar, tombol kembali Android, dan splash screen.

import {
  App,
  Capacitor,
  SplashScreen,
  StatusBar,
  Style
} from '../vendor/capacitor.bundle.js';
import { showToast } from './components/toast.js';

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

export function initNativeShell({ activePage }) {
  if (!Capacitor?.isNativePlatform?.() || initialized) {
    return;
  }

  initialized = true;
  configureStatusBar();

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

  SplashScreen.hide().catch(() => {});
}
