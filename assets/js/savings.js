import {
  calcProgress,
  calcProgressRaw,
  debounce,
  daysUntil,
  escapeHtml,
  formatCurrency,
  formatDate,
  getErrorMessage,
  todayISO,
  validateAmount
} from './utils.js';
import { icon, refreshIcons } from './icons.js';
import {
  computeSavingsSummary,
  computeSavingsTotals,
  createSavings,
  deleteSavings,
  listSavings,
  listSavingsTransactions,
  recordSavingsTransaction,
  updateSavings
} from './services/savings.service.js';
import {
  renderSummaryCards,
  summaryLoading
} from './components/summary.js';
import {
  cardSkeleton,
  clearFormErrors,
  emptyState,
  errorState,
  setButtonLoading,
  showFieldError,
  showFormError
} from './components/states.js';
import { confirmDialog, openModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { renderSavingsDetailChart } from './components/charts.js';

const elements = {
  summary: document.getElementById('savings-summary'),
  grid: document.getElementById('savings-grid'),
  search: document.getElementById('savings-search'),
  refresh: document.getElementById('savings-refresh'),
  resultCount: document.getElementById('savings-result-count'),
  add: document.querySelector('[data-savings-add]')
};

const state = {
  items: [],
  search: '',
  loading: false,
  user: null,
  urlActionHandled: false
};

export async function initPage({ user }) {
  state.user = user;
  bindEvents();
  await loadData();

  if (!state.urlActionHandled) {
    state.urlActionHandled = true;
    handleUrlAction();
  }
}

function bindEvents() {
  elements.add?.addEventListener('click', () => openForm());

  elements.search?.addEventListener(
    'input',
    debounce((event) => {
      state.search = event.target.value.trim().toLowerCase();
      renderGrid();
    }, 180)
  );

  elements.refresh?.addEventListener('click', () => loadData());

  elements.grid?.addEventListener('click', (event) => {
    const emptyAction = event.target.closest('.empty-state-action');

    if (emptyAction) {
      if (emptyAction.dataset.emptyMode === 'reset') {
        state.search = '';
        elements.search.value = '';
        renderGrid();
      } else {
        openForm();
      }
      return;
    }

    if (event.target.closest('.state-retry')) {
      loadData();
      return;
    }

    const actionButton = event.target.closest('[data-action]');

    if (!actionButton) {
      return;
    }

    const item = state.items.find(
      (savings) => savings.id === actionButton.dataset.id
    );

    if (!item) {
      return;
    }

    switch (actionButton.dataset.action) {
      case 'deposit':
        openTransaction(item, 'deposit');
        break;
      case 'withdraw':
        openTransaction(item, 'withdrawal');
        break;
      case 'detail':
        openDetail(item);
        break;
      case 'edit':
        openForm(item);
        break;
      case 'delete':
        handleDelete(item);
        break;
      default:
        break;
    }
  });
}

async function loadData() {
  if (state.loading) {
    return;
  }

  state.loading = true;
  elements.refresh?.setAttribute('aria-busy', 'true');
  elements.refresh?.setAttribute('disabled', 'disabled');
  summaryLoading(elements.summary, 4);
  elements.grid.innerHTML = cardSkeleton(3);

  if (elements.resultCount) {
    elements.resultCount.textContent = 'Memuat data...';
  }

  try {
    state.items = await listSavings(state.user.id);
    renderSummary();
    renderGrid();
  } catch (error) {
    console.error('Failed to load savings:', error);
    renderSummaryError();
    elements.grid.innerHTML = errorState({
      message: getErrorMessage(error, 'Data tabungan gagal dimuat.')
    });

    if (elements.resultCount) {
      elements.resultCount.textContent = 'Data gagal dimuat.';
    }
  } finally {
    state.loading = false;
    elements.refresh?.removeAttribute('aria-busy');
    elements.refresh?.removeAttribute('disabled');
  }
}

function renderSummary() {
  const summary = computeSavingsSummary(state.items);
  const overallProgress =
    summary.totalTarget > 0
      ? Math.round((summary.totalCurrent / summary.totalTarget) * 100)
      : 0;

  renderSummaryCards(elements.summary, [
    {
      label: 'Total Saldo',
      value: formatCurrency(summary.totalCurrent),
      meta:
        summary.count > 0
          ? `Dari ${summary.count} target tabungan`
          : 'Belum ada saldo tabungan',
      iconName: 'piggy-bank',
      tone: 'primary',
      metaIcon: 'wallet'
    },
    {
      label: 'Total Target',
      value: formatCurrency(summary.totalTarget),
      meta:
        summary.totalTarget > 0
          ? `${overallProgress}% sudah terkumpul`
          : 'Belum ada target',
      iconName: 'target',
      tone: 'lavender',
      metaIcon: 'flag'
    },
    {
      label: 'Target Aktif',
      value: String(summary.activeCount),
      meta:
        summary.activeCount > 0
          ? 'Masih perlu ditabung'
          : summary.count > 0
            ? 'Semua target tercapai'
            : 'Belum ada target',
      iconName: 'circle-dot',
      tone: 'success',
      metaIcon: 'activity'
    },
    {
      label: 'Progress Keseluruhan',
      value: `${overallProgress}%`,
      meta:
        overallProgress >= 100
          ? 'Seluruh target tercapai'
          : overallProgress > 0
            ? 'Terus konsisten menabung'
            : 'Mulai dengan setoran pertama',
      iconName: 'trending-up',
      tone: 'info',
      metaIcon: 'percent'
    }
  ]);
}

function renderSummaryError() {
  renderSummaryCards(elements.summary, [
    {
      label: 'Total Saldo',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'piggy-bank',
      tone: 'primary'
    },
    {
      label: 'Total Target',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'target',
      tone: 'lavender'
    },
    {
      label: 'Target Aktif',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'circle-dot',
      tone: 'success'
    },
    {
      label: 'Progress Keseluruhan',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'trending-up',
      tone: 'info'
    }
  ]);
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const name = String(item.name || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    return (
      !state.search ||
      name.includes(state.search) ||
      description.includes(state.search)
    );
  });
}

function renderGrid() {
  if (!elements.grid) {
    return;
  }

  const items = getFilteredItems();

  if (elements.resultCount) {
    elements.resultCount.textContent =
      state.items.length === 0
        ? ''
        : items.length === state.items.length
          ? `${state.items.length} target tabungan`
          : `${items.length} dari ${state.items.length} target ditampilkan`;
  }

  if (state.items.length === 0) {
    elements.grid.innerHTML = emptyState({
      iconName: 'piggy-bank',
      title: 'Belum ada target tabungan',
      description:
        'Buat target pertamamu, lalu catat setoran dan penarikan untuk melihat progress.',
      actionLabel: 'Buat Tabungan'
    });
    elements.grid
      .querySelector('.empty-state-action')
      ?.setAttribute('data-empty-mode', 'add');
    refreshIcons();
    return;
  }

  if (items.length === 0) {
    elements.grid.innerHTML = emptyState({
      iconName: 'search-x',
      title: 'Target tabungan tidak ditemukan',
      description: 'Coba gunakan kata kunci lain untuk mencari target tabungan.',
      actionLabel: 'Reset pencarian'
    });
    elements.grid
      .querySelector('.empty-state-action')
      ?.setAttribute('data-empty-mode', 'reset');
    refreshIcons();
    return;
  }

  elements.grid.innerHTML = items.map(renderSavingsCard).join('');
  refreshIcons();
}

function renderSavingsCard(item) {
  const target = Number(item.target_amount);
  const current = Number(item.current_amount);
  const percentage = Math.round(calcProgressRaw(current, target));
  const visualProgress = calcProgress(current, target);
  const achieved = current >= target;
  const remainingDays = item.target_date ? daysUntil(item.target_date) : null;
  const deadlineClass =
    !achieved && remainingDays !== null && remainingDays < 0
      ? 'saving-deadline is-soon'
      : 'saving-deadline';
  const safeName = escapeHtml(item.name);

  return `
    <article class="glass-card saving-card">
      <div class="saving-card-top">
        <span class="saving-icon">${icon(achieved ? 'badge-check' : 'piggy-bank')}</span>
        <div class="saving-menu">
          <button type="button" class="icon-button icon-button-sm" data-action="edit" data-id="${item.id}" aria-label="Edit ${safeName}" title="Edit target">
            ${icon('pencil')}
          </button>
          <button type="button" class="icon-button icon-button-sm icon-button-danger" data-action="delete" data-id="${item.id}" aria-label="Hapus ${safeName}" title="Hapus target">
            ${icon('trash-2')}
          </button>
        </div>
      </div>

      <h3 class="saving-name">${safeName}</h3>
      <p class="saving-description">${escapeHtml(
        item.description || 'Tanpa deskripsi'
      )}</p>

      <div class="saving-amounts">
        <strong>${formatCurrency(current)}</strong>
        <span>dari ${formatCurrency(target)}</span>
      </div>
      <p class="saving-target-line">
        ${
          achieved
            ? '<span class="badge badge-success">Target tercapai</span>'
            : `Sisa ${formatCurrency(Math.max(0, target - current))} lagi`
        }
      </p>

      <div class="saving-progress">
        <div class="progress">
          <div class="progress-bar" style="width:${visualProgress}%"></div>
        </div>
        <div class="progress-meta">
          <span>Progress tabungan</span>
          <strong>${percentage}%</strong>
        </div>
      </div>

      <p class="${deadlineClass}">
        ${icon('calendar-days')}
        <span>${
          item.target_date
            ? `Target selesai ${formatDate(item.target_date)}`
            : 'Tanpa tanggal selesai'
        }</span>
      </p>

      <div class="saving-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="deposit" data-id="${item.id}">
          ${icon('plus')}<span>Setor</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="withdraw" data-id="${item.id}" ${current <= 0 ? 'disabled' : ''}>
          ${icon('minus')}<span>Tarik</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="detail" data-id="${item.id}">
          ${icon('eye')}<span>Detail</span>
        </button>
      </div>
    </article>
  `;
}

function openForm(record = null) {
  const isEdit = Boolean(record);
  const values = record
    ? {
        name: record.name,
        targetAmount: record.target_amount,
        startDate: record.start_date,
        targetDate: record.target_date || '',
        description: record.description || ''
      }
    : {
        name: '',
        targetAmount: '',
        startDate: todayISO(),
        targetDate: '',
        description: ''
      };

  const modal = openModal({
    title: isEdit ? 'Edit Tabungan' : 'Buat Tabungan',
    description: isEdit
      ? 'Perbarui target tabungan. Saldo tetap dihitung dari riwayat transaksi.'
      : 'Tentukan target, lalu catat setoran untuk mulai menabung.',
    size: 'md',
    body: `
      <form id="savings-form" class="form-grid" novalidate>
        <div class="form-field form-field-full">
          <label for="savings-name">Nama tabungan</label>
          <input class="input" id="savings-name" name="name" type="text" maxlength="120" value="${escapeHtml(
            values.name
          )}" placeholder="Contoh: Dana darurat" autofocus required>
        </div>

        <div class="form-field form-field-full">
          <label for="savings-target">Target nominal</label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="savings-target" name="targetAmount" type="number" inputmode="decimal" min="0.01" step="0.01" value="${escapeHtml(
              values.targetAmount
            )}" placeholder="0" required>
          </div>
        </div>

        <div class="form-field">
          <label for="savings-start">Tanggal mulai</label>
          <input class="input" id="savings-start" name="startDate" type="date" value="${escapeHtml(
            values.startDate
          )}" required>
        </div>

        <div class="form-field">
          <label for="savings-deadline">Target selesai <span class="muted">(opsional)</span></label>
          <input class="input" id="savings-deadline" name="targetDate" type="date" value="${escapeHtml(
            values.targetDate
          )}" min="${escapeHtml(values.startDate)}">
        </div>

        <div class="form-field form-field-full">
          <label for="savings-description">Deskripsi <span class="muted">(opsional)</span></label>
          <textarea class="textarea" id="savings-description" name="description" maxlength="500" placeholder="Untuk apa tabungan ini?">${escapeHtml(
            values.description
          )}</textarea>
        </div>

        <div class="form-error" data-form-error hidden></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
      <button type="submit" form="savings-form" class="btn btn-primary">
        ${icon('save')}<span>${isEdit ? 'Simpan Perubahan' : 'Buat Tabungan'}</span>
      </button>
    `
  });

  const form = modal.dialog.querySelector('#savings-form');
  const submitButton = modal.dialog.querySelector('[type="submit"]');
  const startInput = form.elements.startDate;
  const targetDateInput = form.elements.targetDate;

  startInput.addEventListener('change', () => {
    targetDateInput.min = startInput.value;
  });

  modal.dialog
    .querySelector('[data-modal-cancel]')
    ?.addEventListener('click', () => modal.close());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const nameInput = form.elements.name;
    const targetInput = form.elements.targetAmount;
    const name = nameInput.value.trim();
    const targetResult = validateAmount(targetInput.value, {
      label: 'Target nominal'
    });
    const startDate = startInput.value;
    const targetDate = targetDateInput.value;
    const description = form.elements.description.value.trim();

    if (!name) {
      showFieldError(nameInput, 'Nama tabungan wajib diisi.');
      return;
    }

    if (!targetResult.valid) {
      showFieldError(targetInput, targetResult.message);
      return;
    }

    if (!startDate) {
      showFieldError(startInput, 'Tanggal mulai wajib diisi.');
      return;
    }

    if (targetDate && targetDate < startDate) {
      showFieldError(
        targetDateInput,
        'Target selesai tidak boleh sebelum tanggal mulai.'
      );
      return;
    }

    if (description.length > 500) {
      showFieldError(
        form.elements.description,
        'Deskripsi maksimal 500 karakter.'
      );
      return;
    }

    const payload = {
      name,
      targetAmount: targetResult.value,
      startDate,
      targetDate,
      description
    };

    setButtonLoading(
      submitButton,
      true,
      isEdit ? 'Menyimpan...' : 'Membuat...'
    );

    try {
      if (isEdit) {
        await updateSavings(state.user.id, record.id, payload);
      } else {
        await createSavings(state.user.id, payload);
      }

      modal.close();
      showToast(
        isEdit ? 'Target tabungan berhasil diperbarui.' : 'Target tabungan berhasil dibuat.',
        'success'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to save savings:', error);
      setButtonLoading(submitButton, false);
      showFormError(
        form,
        getErrorMessage(error, 'Target tabungan gagal disimpan.')
      );
    }
  });
}

function openTransaction(record, type) {
  const isWithdrawal = type === 'withdrawal';
  const balance = Number(record.current_amount);

  if (isWithdrawal && balance <= 0) {
    showToast('Saldo tabungan belum tersedia untuk ditarik.', 'info');
    return;
  }

  const modal = openModal({
    title: isWithdrawal ? 'Tarik Tabungan' : 'Setor Tabungan',
    description: isWithdrawal
      ? 'Penarikan tidak dapat melebihi saldo tabungan saat ini.'
      : 'Setoran akan menambah saldo tabungan secara atomik.',
    size: 'sm',
    body: `
      <div class="detail-grid">
        <div class="detail-item">
          <dt>Tabungan</dt>
          <dd>${escapeHtml(record.name)}</dd>
        </div>
        <div class="detail-item">
          <dt>Saldo saat ini</dt>
          <dd>${formatCurrency(balance)}</dd>
        </div>
        <div class="detail-item">
          <dt>Target</dt>
          <dd>${formatCurrency(record.target_amount)}</dd>
        </div>
        <div class="detail-item">
          <dt>Progress</dt>
          <dd>${Math.round(
            calcProgressRaw(balance, record.target_amount)
          )}%</dd>
        </div>
      </div>

      <form id="savings-transaction-form" class="form-grid" style="margin-top: 16px;" novalidate>
        <div class="form-field form-field-full">
          <label for="savings-transaction-amount">Nominal ${isWithdrawal ? 'penarikan' : 'setoran'}</label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="savings-transaction-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" ${
              isWithdrawal ? `max="${balance}"` : ''
            } placeholder="0" autofocus required>
          </div>
          ${
            isWithdrawal
              ? `<p class="field-hint">Maksimal ${formatCurrency(balance)}.</p>`
              : ''
          }
        </div>

        <div class="form-field form-field-full">
          <label for="savings-transaction-date">Tanggal transaksi</label>
          <input class="input" id="savings-transaction-date" name="transactionDate" type="date" value="${todayISO()}" required>
        </div>

        <div class="form-field form-field-full">
          <label for="savings-transaction-description">Catatan <span class="muted">(opsional)</span></label>
          <textarea class="textarea" id="savings-transaction-description" name="description" maxlength="500" placeholder="${
            isWithdrawal ? 'Contoh: kebutuhan mendesak' : 'Contoh: sisihkan gaji bulan ini'
          }"></textarea>
        </div>

        <div class="form-error" data-form-error hidden></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
      <button type="submit" form="savings-transaction-form" class="btn btn-primary">
        ${icon(isWithdrawal ? 'arrow-up-right' : 'arrow-down-left')}
        <span>Simpan ${isWithdrawal ? 'Penarikan' : 'Setoran'}</span>
      </button>
    `
  });

  const form = modal.dialog.querySelector('#savings-transaction-form');
  const submitButton = modal.dialog.querySelector('[type="submit"]');

  modal.dialog
    .querySelector('[data-modal-cancel]')
    ?.addEventListener('click', () => modal.close());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const amountInput = form.elements.amount;
    const dateInput = form.elements.transactionDate;
    const amountResult = validateAmount(amountInput.value, {
      label: `Nominal ${isWithdrawal ? 'penarikan' : 'setoran'}`
    });

    if (!amountResult.valid) {
      showFieldError(amountInput, amountResult.message);
      return;
    }

    if (isWithdrawal && amountResult.value > balance) {
      showFieldError(
        amountInput,
        'Nominal penarikan melebihi saldo tabungan saat ini.'
      );
      return;
    }

    if (!dateInput.value) {
      showFieldError(dateInput, 'Tanggal transaksi wajib diisi.');
      return;
    }

    setButtonLoading(submitButton, true, 'Menyimpan...');

    try {
      await recordSavingsTransaction({
        savingsId: record.id,
        type,
        amount: amountResult.value,
        transactionDate: dateInput.value,
        description: form.elements.description.value.trim()
      });

      modal.close();
      showToast(
        `${isWithdrawal ? 'Penarikan' : 'Setoran'} berhasil dicatat.`,
        'success'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to save savings transaction:', error);
      setButtonLoading(submitButton, false);
      showFormError(
        form,
        getErrorMessage(error, 'Transaksi tabungan gagal disimpan.')
      );
    }
  });
}

function openDetail(record) {
  const balance = Number(record.current_amount);
  const target = Number(record.target_amount);
  const percentage = Math.round(calcProgressRaw(balance, target));
  const visualProgress = calcProgress(balance, target);

  const modal = openModal({
    title: 'Detail Tabungan',
    description: 'Saldo, progress, dan riwayat transaksi target ini.',
    size: 'lg',
    body: `
      <div class="saving-detail-header">
        <span class="saving-icon">${icon('piggy-bank')}</span>
        <div>
          <h3 class="saving-name" style="margin-top: 0">${escapeHtml(
            record.name
          )}</h3>
          <p class="muted" style="font-size: 11.5px">${escapeHtml(
            record.description || 'Tanpa deskripsi'
          )}</p>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <dt>Saldo saat ini</dt>
          <dd>${formatCurrency(balance)}</dd>
        </div>
        <div class="detail-item">
          <dt>Target nominal</dt>
          <dd>${formatCurrency(target)}</dd>
        </div>
        <div class="detail-item">
          <dt>Tanggal mulai</dt>
          <dd>${formatDate(record.start_date)}</dd>
        </div>
        <div class="detail-item">
          <dt>Target selesai</dt>
          <dd>${record.target_date ? formatDate(record.target_date) : '-'}</dd>
        </div>
        <div class="detail-item">
          <dt>Total setoran</dt>
          <dd class="amount-positive" id="savings-detail-deposit">—</dd>
        </div>
        <div class="detail-item">
          <dt>Total penarikan</dt>
          <dd class="amount-negative" id="savings-detail-withdrawal">—</dd>
        </div>
      </div>

      <div class="saving-detail-progress">
        <div class="progress">
          <div class="progress-bar" style="width:${visualProgress}%"></div>
        </div>
        <div class="progress-meta">
          <span>${
            balance >= target
              ? 'Target tercapai'
              : `Sisa ${formatCurrency(Math.max(0, target - balance))}`
          }</span>
          <strong>${percentage}%</strong>
        </div>
      </div>

      <div class="detail-section">
        <h3>Perkembangan Saldo</h3>
        <div class="detail-chart-wrap">
          <canvas id="savings-detail-chart" aria-label="Grafik perkembangan saldo tabungan" role="img"></canvas>
        </div>
      </div>

      <div class="detail-section">
        <h3>Riwayat Transaksi</h3>
        <div id="savings-detail-history">
          <div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Tutup</button>
      <button type="button" class="btn btn-secondary" data-modal-withdraw ${
        balance <= 0 ? 'disabled' : ''
      }>${icon('arrow-up-right')}<span>Tarik</span></button>
      <button type="button" class="btn btn-primary" data-modal-deposit>${icon(
        'arrow-down-left'
      )}<span>Setor</span></button>
    `
  });

  modal.dialog
    .querySelector('[data-modal-close]')
    ?.addEventListener('click', () => modal.close());
  modal.dialog
    .querySelector('[data-modal-deposit]')
    ?.addEventListener('click', () => {
      modal.close();
      openTransaction(record, 'deposit');
    });
  modal.dialog
    .querySelector('[data-modal-withdraw]')
    ?.addEventListener('click', () => {
      modal.close();
      openTransaction(record, 'withdrawal');
    });

  loadDetailHistory(record, modal.dialog);
}

async function loadDetailHistory(record, dialog) {
  const historyContainer = dialog.querySelector('#savings-detail-history');
  const chartCanvas = dialog.querySelector('#savings-detail-chart');

  try {
    const transactions = await listSavingsTransactions(
      state.user.id,
      record.id
    );
    const totals = computeSavingsTotals(transactions);

    const depositElement = dialog.querySelector('#savings-detail-deposit');
    const withdrawalElement = dialog.querySelector(
      '#savings-detail-withdrawal'
    );

    if (depositElement) {
      depositElement.textContent = formatCurrency(totals.totalDeposit);
    }

    if (withdrawalElement) {
      withdrawalElement.textContent = formatCurrency(totals.totalWithdrawal);
    }

    if (transactions.length === 0) {
      historyContainer.innerHTML =
        '<div class="inline-empty">Belum ada setoran atau penarikan untuk tabungan ini.</div>';
    } else {
      historyContainer.innerHTML = `
        <div class="mini-list">
          ${transactions
            .map(
              (transaction) => `
                <div class="mini-list-item">
                  <div class="mini-list-main">
                    <strong>${formatDate(transaction.transaction_date)}</strong>
                    <small>${escapeHtml(
                      transaction.description ||
                        (transaction.type === 'deposit'
                          ? 'Setoran'
                          : 'Penarikan')
                    )}</small>
                  </div>
                  <span class="mini-list-amount ${
                    transaction.type === 'deposit'
                      ? 'amount-positive'
                      : 'amount-negative'
                  }">
                    ${transaction.type === 'deposit' ? '+' : '−'}${formatCurrency(
                      transaction.amount
                    )}
                  </span>
                </div>
              `
            )
            .join('')}
        </div>
      `;
    }

    requestAnimationFrame(() => {
      renderSavingsDetailChart(chartCanvas, transactions);
    });
  } catch (error) {
    console.error('Failed to load savings detail:', error);
    historyContainer.innerHTML = errorState({
      message: getErrorMessage(error, 'Riwayat tabungan gagal dimuat.')
    });
    historyContainer
      .querySelector('.state-retry')
      ?.addEventListener('click', () => {
        historyContainer.innerHTML =
          '<div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>';
        loadDetailHistory(record, dialog);
      });
    refreshIcons();
  }
}

async function handleDelete(record) {
  const confirmed = await confirmDialog({
    title: 'Hapus target tabungan?',
    message: `Target "${record.name}" beserta seluruh riwayat setoran dan penarikan akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    cancelLabel: 'Batal',
    danger: true
  });

  if (!confirmed) {
    return;
  }

  try {
    await deleteSavings(state.user.id, record.id);
    showToast('Target tabungan berhasil dihapus.', 'success');
    await loadData();
  } catch (error) {
    console.error('Failed to delete savings:', error);
    showToast(
      getErrorMessage(error, 'Target tabungan gagal dihapus.'),
      'error'
    );
  }
}

function handleUrlAction() {
  const url = new URL(window.location.href);
  const action = url.searchParams.get('action');

  if (!action) {
    return;
  }

  url.searchParams.delete('action');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

  if (action === 'create') {
    openForm();
    return;
  }

  if (action === 'deposit') {
    const target = state.items.find(
      (item) => Number(item.current_amount) < Number(item.target_amount)
    ) || state.items[0];

    if (target) {
      openTransaction(target, 'deposit');
    } else {
      showToast(
        'Buat target tabungan terlebih dahulu sebelum mencatat setoran.',
        'info'
      );
    }
  }
}
