import {
  debounce,
  escapeHtml,
  formatDate,
  formatSignedCurrency,
  getCategoryMeta,
  getErrorMessage
} from './utils.js';
import { icon, refreshIcons } from './icons.js';
import { listHistory } from './services/history.service.js';
import {
  errorState,
  tableSkeleton
} from './components/states.js';
import { showToast } from './components/toast.js';

const PAGE_SIZE = 10;

const elements = {
  list: document.getElementById('history-list'),
  pagination: document.getElementById('history-pagination'),
  count: document.getElementById('history-result-count'),
  search: document.getElementById('history-search'),
  dateFrom: document.getElementById('history-from'),
  dateTo: document.getElementById('history-to'),
  sort: document.getElementById('history-sort'),
  reset: document.getElementById('history-reset'),
  groupTabs: document.querySelectorAll('[data-history-group]')
};

const state = {
  user: null,
  group: 'all',
  search: '',
  dateFrom: '',
  dateTo: '',
  sort: 'newest',
  page: 1,
  requestId: 0
};

export async function initPage({ user }) {
  state.user = user;
  bindEvents();
  await loadHistory();
}

function bindEvents() {
  elements.search?.addEventListener(
    'input',
    debounce((event) => {
      state.search = event.target.value.trim();
      state.page = 1;
      loadHistory();
    }, 300)
  );

  elements.dateFrom?.addEventListener('change', (event) => {
    state.dateFrom = event.target.value;
    state.page = 1;
    validateDateRange();
  });

  elements.dateTo?.addEventListener('change', (event) => {
    state.dateTo = event.target.value;
    state.page = 1;
    validateDateRange();
  });

  elements.sort?.addEventListener('change', (event) => {
    state.sort = event.target.value;
    state.page = 1;
    loadHistory();
  });

  elements.reset?.addEventListener('click', resetFilters);

  elements.groupTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (state.group === tab.dataset.historyGroup) {
        return;
      }

      state.group = tab.dataset.historyGroup;
      state.page = 1;
      elements.groupTabs.forEach((item) => {
        const isActive = item === tab;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      loadHistory();
    });
  });

  elements.list?.addEventListener('click', (event) => {
    if (event.target.closest('.state-retry')) {
      loadHistory();
      return;
    }

    const resetAction = event.target.closest('[data-history-reset]');

    if (resetAction) {
      resetFilters();
    }
  });

  elements.pagination?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');

    if (!button || button.disabled) {
      return;
    }

    const targetPage = Number(button.dataset.page);

    if (!Number.isFinite(targetPage) || targetPage === state.page) {
      return;
    }

    state.page = targetPage;
    loadHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function validateDateRange() {
  if (state.dateFrom && state.dateTo && state.dateFrom > state.dateTo) {
    showToast(
      'Tanggal mulai tidak boleh melebihi tanggal akhir.',
      'error'
    );
    return false;
  }

  loadHistory();
  return true;
}

async function loadHistory() {
  if (!state.user) {
    return;
  }

  const requestId = ++state.requestId;
  elements.list.innerHTML = tableSkeleton(5, 4);
  elements.pagination.innerHTML = '';

  if (elements.count) {
    elements.count.textContent = 'Memuat riwayat...';
  }

  try {
    const result = await listHistory({
      userId: state.user.id,
      group: state.group,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      search: state.search,
      sort: state.sort,
      page: state.page,
      pageSize: PAGE_SIZE
    });

    if (requestId !== state.requestId) {
      return;
    }

    if (
      result.rows.length === 0 &&
      result.count > 0 &&
      state.page > result.totalPages
    ) {
      state.page = result.totalPages;
      return loadHistory();
    }

    renderHistory(result);
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }

    console.error('Failed to load history:', error);
    elements.list.innerHTML = errorState({
      message: getErrorMessage(error, 'Riwayat transaksi gagal dimuat.')
    });
    elements.pagination.innerHTML = '';

    if (elements.count) {
      elements.count.textContent = 'Riwayat gagal dimuat.';
    }
  }
}

function renderHistory(result) {
  const { rows, count, page, totalPages } = result;
  const hasFilters =
    state.group !== 'all' ||
    Boolean(state.search) ||
    Boolean(state.dateFrom) ||
    Boolean(state.dateTo) ||
    state.sort !== 'newest';

  if (elements.count) {
    elements.count.textContent =
      count > 0
        ? `${count} transaksi ditemukan`
        : hasFilters
          ? 'Tidak ada transaksi yang cocok dengan filter.'
          : 'Belum ada transaksi tercatat.';
  }

  if (rows.length === 0) {
    elements.list.innerHTML = hasFilters
      ? `
        <div class="empty-state">
          <span class="empty-state-icon">${icon('search-x')}</span>
          <h3>Tidak ada transaksi</h3>
          <p>Ubah kata kunci, kategori, atau rentang tanggal untuk menemukan transaksi lain.</p>
          <button type="button" class="btn btn-secondary empty-state-action" data-history-reset>Reset filter</button>
        </div>
      `
      : `
        <div class="empty-state">
          <span class="empty-state-icon">${icon('history')}</span>
          <h3>Belum ada transaksi</h3>
          <p>Mulai catat utang, piutang, atau tabungan. Semua aktivitas akan muncul di sini.</p>
          <a class="btn btn-primary empty-state-action" href="debts.html?action=create">Tambah Utang</a>
        </div>
      `;
    elements.pagination.innerHTML = '';
    refreshIcons();
    return;
  }

  elements.list.innerHTML = `
    <div class="history-list">
      ${rows.map(renderHistoryItem).join('')}
    </div>
  `;
  renderPagination({ count, page, totalPages });

  refreshIcons();
}

function renderHistoryItem(transaction) {
  const meta = getCategoryMeta(transaction.category);

  return `
    <article class="history-item">
      <span class="history-icon">${icon(meta.icon)}</span>
      <div class="history-main">
        <strong>${escapeHtml(transaction.title)}</strong>
        <small>
          ${escapeHtml(meta.label)}
          ${transaction.description ? ` · ${escapeHtml(transaction.description)}` : ''}
        </small>
      </div>
      <div class="history-side">
        <span class="history-amount ${meta.amountClass}">
          ${formatSignedCurrency(transaction.amount, transaction.direction)}
        </span>
        <span class="history-date">${formatDate(transaction.transaction_date)}</span>
      </div>
    </article>
  `;
}

function renderPagination({ count, page, totalPages }) {
  if (totalPages <= 1) {
    elements.pagination.innerHTML = `
      <div class="pagination">
        <span class="pagination-info">Menampilkan ${count} transaksi</span>
      </div>
    `;
    return;
  }

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, count);

  elements.pagination.innerHTML = `
    <div class="pagination">
      <span class="pagination-info">
        Menampilkan ${start}–${end} dari ${count} transaksi
      </span>
      <div class="pagination-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-page="${page - 1}" ${
          page <= 1 ? 'disabled' : ''
        }>
          ${icon('chevron-left')}<span>Sebelumnya</span>
        </button>
        <span class="page-indicator">Hal ${page} / ${totalPages}</span>
        <button type="button" class="btn btn-secondary btn-sm" data-page="${page + 1}" ${
          page >= totalPages ? 'disabled' : ''
        }>
          <span>Berikutnya</span>${icon('chevron-right')}
        </button>
      </div>
    </div>
  `;

  refreshIcons();
}

function resetFilters() {
  state.group = 'all';
  state.search = '';
  state.dateFrom = '';
  state.dateTo = '';
  state.sort = 'newest';
  state.page = 1;

  if (elements.search) elements.search.value = '';
  if (elements.dateFrom) elements.dateFrom.value = '';
  if (elements.dateTo) elements.dateTo.value = '';
  if (elements.sort) elements.sort.value = 'newest';

  elements.groupTabs.forEach((tab) => {
    const isActive = tab.dataset.historyGroup === 'all';
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });

  loadHistory();
}
