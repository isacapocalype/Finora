export function icon(name, className = '') {
  const safeName = String(name || 'circle').replace(/[^a-z0-9-]/gi, '');
  return `<i data-lucide="${safeName}" class="${className}" aria-hidden="true"></i>`;
}

let waitingForIcons = false;

export function refreshIcons() {
  if (typeof window !== 'undefined' && window.lucide?.createIcons) {
    waitingForIcons = false;
    window.lucide.createIcons({
      attrs: {
        'stroke-width': 1.8
      }
    });
    return;
  }

  // Script Lucide pada halaman autentikasi dimuat dengan defer. Bila modul
  // berjalan lebih dahulu, render ulang ikon setelah semua script selesai.
  if (
    !waitingForIcons &&
    typeof document !== 'undefined' &&
    document.readyState !== 'complete'
  ) {
    waitingForIcons = true;
    const retry = () => {
      if (!waitingForIcons) {
        return;
      }

      waitingForIcons = false;
      refreshIcons();
    };

    document.addEventListener('DOMContentLoaded', retry, { once: true });
    window.addEventListener('load', retry, { once: true });
  }
}
