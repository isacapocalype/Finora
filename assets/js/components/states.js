import { escapeHtml } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

export function tableSkeleton(rowCount = 5, columnCount = 6) {
  const rows = Array.from(
    { length: rowCount },
    (_, rowIndex) => `
      <div class="skeleton-table-row" aria-hidden="true">
        ${Array.from(
          { length: columnCount },
          (_, columnIndex) =>
            `<span class="skeleton skeleton-text" style="width:${55 + ((rowIndex + columnIndex) % 4) * 10}%"></span>`
        ).join('')}
      </div>
    `
  ).join('');

  return `<div class="skeleton-table" role="status" aria-label="Memuat data">${rows}</div>`;
}

export function cardSkeleton(cardCount = 3) {
  const cards = Array.from(
    { length: cardCount },
    () => `
      <div class="skeleton-card" aria-hidden="true">
        <span class="skeleton skeleton-circle"></span>
        <span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-text"></span>
        <span class="skeleton skeleton-text short"></span>
        <span class="skeleton skeleton-block"></span>
      </div>
    `
  ).join('');

  return `<div class="skeleton-grid" role="status" aria-label="Memuat data">${cards}</div>`;
}

export function chartSkeleton() {
  return `
    <div class="chart-skeleton" role="status" aria-label="Memuat grafik">
      <span class="skeleton skeleton-chart"></span>
    </div>
  `;
}

export function emptyState({
  iconName = 'inbox',
  title,
  description,
  actionLabel = ''
}) {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon(iconName)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${
        actionLabel
          ? `<button type="button" class="btn btn-primary empty-state-action">${escapeHtml(actionLabel)}</button>`
          : ''
      }
    </div>
  `;
}

export function errorState({
  message = 'Data gagal dimuat.',
  retryLabel = 'Coba lagi'
}) {
  return `
    <div class="error-state">
      <span class="error-state-icon">${icon('cloud-off')}</span>
      <h3>Gagal memuat data</h3>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn btn-secondary state-retry">
        ${icon('refresh-cw')}
        <span>${escapeHtml(retryLabel)}</span>
      </button>
    </div>
  `;
}

export function setButtonLoading(button, isLoading, loadingLabel = 'Memproses...') {
  if (!button) {
    return;
  }

  if (isLoading) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `
      <span class="button-spinner" aria-hidden="true"></span>
      <span>${escapeHtml(loadingLabel)}</span>
    `;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  refreshIcons();
}

export function clearFormErrors(form) {
  form.querySelectorAll('.field-error').forEach((element) => element.remove());
  form.querySelectorAll('.has-error').forEach((element) => {
    element.classList.remove('has-error');
    element.removeAttribute('aria-invalid');
  });

  const summary = form.querySelector('[data-form-error]');

  if (summary) {
    summary.hidden = true;
    summary.textContent = '';
  }
}

export function showFieldError(input, message) {
  input.classList.add('has-error');
  input.setAttribute('aria-invalid', 'true');

  const field = input.closest('.form-field') || input.parentElement;
  field?.querySelector('.field-error')?.remove();

  const error = document.createElement('p');
  error.className = 'field-error';
  error.textContent = message;
  field?.appendChild(error);
  input.focus();
}

export function showFormError(form, message) {
  const summary = form.querySelector('[data-form-error]');

  if (summary) {
    summary.textContent = message;
    summary.hidden = false;
  }
}
