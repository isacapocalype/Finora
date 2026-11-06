import { escapeHtml } from '../utils.js';
import { icon, refreshIcons } from '../icons.js';

function summaryCardMarkup(card) {
  const tone = card.tone || 'primary';
  const metaIcon = card.metaIcon ? icon(card.metaIcon) : '';
  const link = card.href
    ? `<a class="stat-card-link" href="${escapeHtml(card.href)}" aria-label="${escapeHtml(
        card.linkLabel || card.label
      )}"></a>`
    : '';

  return `
    <article class="glass-card stat-card stat-tone-${escapeHtml(tone)}">
      <div class="stat-top">
        <div>
          <span class="stat-label">${escapeHtml(card.label)}</span>
          <strong class="stat-value">${escapeHtml(card.value)}</strong>
        </div>
        <span class="stat-icon">${icon(card.iconName || 'wallet')}</span>
      </div>
      ${
        card.meta
          ? `<p class="stat-meta">${metaIcon}<span>${escapeHtml(card.meta)}</span></p>`
          : ''
      }
      ${link}
    </article>
  `;
}

export function renderSummaryCards(container, cards) {
  if (!container) {
    return;
  }

  container.innerHTML = cards.map(summaryCardMarkup).join('');
  refreshIcons();
}

export function summaryLoading(container, count = 4) {
  if (!container) {
    return;
  }

  container.innerHTML = Array.from(
    { length: count },
    () => `
      <div class="glass-card stat-card" aria-hidden="true">
        <div class="stat-top">
          <div style="width: 100%">
            <span class="skeleton skeleton-text" style="width: 48%"></span>
            <span class="skeleton skeleton-title" style="width: 72%; height: 22px; margin-top: 11px"></span>
          </div>
          <span class="skeleton skeleton-circle"></span>
        </div>
        <span class="skeleton skeleton-text" style="width: 62%"></span>
      </div>
    `
  ).join('');
}
