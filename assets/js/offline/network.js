// FINORA — OFFLINE NETWORK
// Deteksi koneksi dan langganan perubahan online/offline.

let nativeStatus = null;

export function setNativeOnline(online) {
  nativeStatus = typeof online === 'boolean' ? online : null;
}

export function isOnline() {
  if (typeof nativeStatus === 'boolean') {
    return nativeStatus;
  }

  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function onNetworkChange(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}
