import { escapeHtml } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

const MAX_VISIBLE_TOASTS = 4;

export function showToast(message, type = 'success', title = '') {
  const root = document.getElementById('toast-root');

  if (!root) {
    return;
  }

  const toast = document.createElement('div');
  const iconName =
    type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check-circle-2';

  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <span class="toast-icon">${icon(iconName)}</span>
    <div class="toast-content">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
      <p>${escapeHtml(message)}</p>
    </div>
    <button class="toast-close" type="button" aria-label="Tutup notifikasi">
      ${icon('x')}
    </button>
  `;

  root.appendChild(toast);
  refreshIcons();

  const removeToast = () => {
    if (!toast.isConnected || toast.classList.contains('is-leaving')) {
      return;
    }

    toast.classList.add('is-leaving');
    globalThis.setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.toast-close')?.addEventListener('click', removeToast);
  globalThis.setTimeout(removeToast, 4500);

  while (root.children.length > MAX_VISIBLE_TOASTS) {
    root.firstElementChild?.remove();
  }
}
