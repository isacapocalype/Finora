import { escapeHtml } from '../utils.js';
import { refreshIcons } from '../icons.js';

export function openModal({
  title,
  description = '',
  body = '',
  footer = '',
  size = 'md',
  closeOnBackdrop = true,
  onClose = null
}) {
  const root = document.getElementById('modal-root');
  const dialog = document.createElement('dialog');

  dialog.className = `modal modal-${size}`;
  dialog.innerHTML = `
    <div class="modal-surface">
      <header class="modal-header">
        <div>
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          ${description ? `<p class="modal-description">${escapeHtml(description)}</p>` : ''}
        </div>
        <button type="button" class="icon-button modal-close" aria-label="Tutup dialog">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
    </div>
  `;

  root.appendChild(dialog);

  const close = () => {
    if (dialog.open) {
      dialog.close();
    }
  };

  dialog.querySelector('.modal-close')?.addEventListener('click', close);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && closeOnBackdrop) {
      close();
    }
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('close', () => {
    dialog.remove();

    if (!root.querySelector('dialog[open]')) {
      document.body.classList.remove('modal-open');
    }

    onClose?.();
  });

  document.body.classList.add('modal-open');
  dialog.showModal();
  refreshIcons();

  const focusTarget =
    dialog.querySelector('[autofocus]') ||
    dialog.querySelector('input, select, textarea, button');

  focusTarget?.focus();

  return {
    dialog,
    body: dialog.querySelector('.modal-body'),
    close
  };
}

export function confirmDialog({
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  danger = false
}) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
      modal.close();
    };

    const modal = openModal({
      title,
      size: 'sm',
      body: `<p class="confirm-message">${escapeHtml(message)}</p>`,
      footer: `
        <button type="button" class="btn btn-secondary" data-confirm-cancel>
          ${escapeHtml(cancelLabel)}
        </button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>
          ${escapeHtml(confirmLabel)}
        </button>
      `,
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }
    });

    modal.dialog
      .querySelector('[data-confirm-cancel]')
      ?.addEventListener('click', () => finish(false));
    modal.dialog
      .querySelector('[data-confirm-ok]')
      ?.addEventListener('click', () => finish(true));
  });
}
