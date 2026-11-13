import {
  calcProgress,
  calcProgressRaw,
  debounce,
  escapeHtml,
  formatCurrency,
  formatDate,
  getErrorMessage,
  getWalletCategoryMeta,
  getWalletColorMeta,
  getWalletTypeMeta,
  parseNumber,
  todayISO,
  validateAmount,
  WALLET_COLORS,
  WALLET_EXPENSE_CATEGORIES,
  WALLET_INCOME_CATEGORIES,
  WALLET_TYPES
} from './utils.js';
import { icon, refreshIcons } from './icons.js';
import {
  computeWalletSummary,
  computeWalletTotals,
  createWallet,
  deleteWallet,
  listAllWalletTransactions,
  listWalletTransactions,
  listWallets,
  recordWalletTransaction,
  recordWalletTransfer,
  updateWallet
} from './services/wallet.service.js';
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

const elements = {
  summary: document.getElementById('wallets-summary'),
  grid: document.getElementById('wallets-grid'),
  search: document.getElementById('wallets-search'),
  refresh: document.getElementById('wallets-refresh'),
  resultCount: document.getElementById('wallets-result-count'),
  add: document.querySelector('[data-wallets-add]')
};

const state = {
  wallets: [],
  transactions: [],
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

    const wallet = state.wallets.find(
      (item) => item.id === actionButton.dataset.id
    );

    if (!wallet) {
      return;
    }

    switch (actionButton.dataset.action) {
      case 'income':
        openTransaction(wallet, 'income');
        break;
      case 'expense':
        openTransaction(wallet, 'expense');
        break;
      case 'transfer':
        openTransfer(wallet);
        break;
      case 'detail':
        openDetail(wallet);
        break;
      case 'edit':
        openForm(wallet);
        break;
      case 'delete':
        handleDelete(wallet);
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
    const [wallets, transactions] = await Promise.all([
      listWallets(state.user.id),
      listAllWalletTransactions(state.user.id)
    ]);

    state.wallets = wallets;
    state.transactions = transactions;
    renderSummary();
    renderGrid();
  } catch (error) {
    console.error('Failed to load wallets:', error);
    renderSummaryError();
    elements.grid.innerHTML = errorState({
      message: getErrorMessage(error, 'Data dompet gagal dimuat.')
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
  const summary = computeWalletSummary(state.wallets, state.transactions);

  renderSummaryCards(elements.summary, [
    {
      label: 'Total Saldo',
      value: formatCurrency(summary.totalBalance),
      meta:
        summary.count > 0
          ? `Tersebar di ${summary.count} dompet`
          : 'Belum ada dompet',
      iconName: 'wallet',
      tone: 'primary',
      metaIcon: 'wallet-cards'
    },
    {
      label: 'Pemasukan Bulan Ini',
      value: formatCurrency(summary.incomeThisMonth),
      meta:
        summary.incomeThisMonth > 0
          ? 'Uang masuk ke dompet'
          : 'Belum ada pemasukan',
      iconName: 'arrow-down-left',
      tone: 'success',
      metaIcon: 'trending-up'
    },
    {
      label: 'Pengeluaran Bulan Ini',
      value: formatCurrency(summary.expenseThisMonth),
      meta:
        summary.expenseThisMonth > 0
          ? 'Uang keluar dari dompet'
          : 'Belum ada pengeluaran',
      iconName: 'arrow-up-right',
      tone: 'danger',
      metaIcon: 'trending-down'
    },
    {
      label: 'Selisih Bulan Ini',
      value: formatCurrency(summary.netThisMonth),
      meta:
        summary.netThisMonth > 0
          ? 'Arus kas positif'
          : summary.netThisMonth < 0
            ? 'Arus kas negatif'
            : 'Arus kas seimbang',
      iconName: 'scale',
      tone: 'info',
      metaIcon: 'activity'
    }
  ]);
}

function renderSummaryError() {
  renderSummaryCards(elements.summary, [
    {
      label: 'Total Saldo',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'wallet',
      tone: 'primary'
    },
    {
      label: 'Pemasukan Bulan Ini',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'arrow-down-left',
      tone: 'success'
    },
    {
      label: 'Pengeluaran Bulan Ini',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'arrow-up-right',
      tone: 'danger'
    },
    {
      label: 'Selisih Bulan Ini',
      value: '—',
      meta: 'Data gagal dimuat',
      iconName: 'scale',
      tone: 'info'
    }
  ]);
}

function getFilteredWallets() {
  return state.wallets.filter((wallet) => {
    const type = getWalletTypeMeta(wallet.type);
    const haystack = `${wallet.name || ''} ${wallet.description || ''} ${
      type.label
    }`.toLowerCase();
    return !state.search || haystack.includes(state.search);
  });
}

function renderGrid() {
  if (!elements.grid) {
    return;
  }

  const wallets = getFilteredWallets();

  if (elements.resultCount) {
    elements.resultCount.textContent =
      state.wallets.length === 0
        ? ''
        : wallets.length === state.wallets.length
          ? `${state.wallets.length} dompet`
          : `${wallets.length} dari ${state.wallets.length} dompet ditampilkan`;
  }

  if (state.wallets.length === 0) {
    elements.grid.innerHTML = emptyState({
      iconName: 'wallet',
      title: 'Belum ada dompet',
      description:
        'Buat dompet pertamamu untuk memisahkan saldo tunai, bank, dan e-wallet.',
      actionLabel: 'Buat Dompet'
    });
    elements.grid
      .querySelector('.empty-state-action')
      ?.setAttribute('data-empty-mode', 'add');
    refreshIcons();
    return;
  }

  if (wallets.length === 0) {
    elements.grid.innerHTML = emptyState({
      iconName: 'search-x',
      title: 'Dompet tidak ditemukan',
      description: 'Coba gunakan kata kunci lain untuk mencari dompet.',
      actionLabel: 'Reset pencarian'
    });
    elements.grid
      .querySelector('.empty-state-action')
      ?.setAttribute('data-empty-mode', 'reset');
    refreshIcons();
    return;
  }

  elements.grid.innerHTML = wallets.map(renderWalletCard).join('');
  refreshIcons();
}

function renderWalletCard(wallet) {
  const type = getWalletTypeMeta(wallet.type);
  const color = getWalletColorMeta(wallet.color);
  const balance = Number(wallet.balance) || 0;
  const target = Number(wallet.target_amount) || 0;
  const percentage = target > 0 ? Math.round(calcProgressRaw(balance, target)) : 0;
  const visualProgress = target > 0 ? calcProgress(balance, target) : 0;
  const safeName = escapeHtml(wallet.name);
  const transferDisabled = state.wallets.length < 2 ? 'disabled' : '';

  return `
    <article class="glass-card wallet-card wallet-tone-${escapeHtml(color.value)}">
      <div class="wallet-card-top">
        <span class="wallet-icon">${icon(type.icon)}</span>
        <div class="wallet-menu">
          <button type="button" class="icon-button icon-button-sm" data-action="edit" data-id="${wallet.id}" aria-label="Edit ${safeName}" title="Edit dompet">
            ${icon('pencil')}
          </button>
          <button type="button" class="icon-button icon-button-sm icon-button-danger" data-action="delete" data-id="${wallet.id}" aria-label="Hapus ${safeName}" title="Hapus dompet">
            ${icon('trash-2')}
          </button>
        </div>
      </div>

      <p class="wallet-type">${escapeHtml(type.label)}</p>
      <h3 class="wallet-name">${safeName}</h3>
      <p class="wallet-description">${escapeHtml(
        wallet.description || 'Tanpa deskripsi'
      )}</p>

      <div class="wallet-balance">
        <span>Saldo saat ini</span>
        <strong>${formatCurrency(balance)}</strong>
      </div>

      ${
        target > 0
          ? `<div class="wallet-target">
               <div class="progress">
                 <div class="progress-bar" style="--progress: ${visualProgress}%"></div>
               </div>
               <div class="progress-meta">
                 <span>${
                   balance >= target
                     ? 'Target tercapai'
                     : `Target ${formatCurrency(target)}`
                 }</span>
                 <strong>${percentage}%</strong>
               </div>
             </div>`
          : ''
      }

      <div class="wallet-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="income" data-id="${wallet.id}">
          ${icon('arrow-down-left')}<span>Masuk</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="expense" data-id="${wallet.id}" ${balance <= 0 ? 'disabled' : ''}>
          ${icon('arrow-up-right')}<span>Keluar</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="transfer" data-id="${wallet.id}" ${transferDisabled}>
          ${icon('arrow-left-right')}<span>Transfer</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="detail" data-id="${wallet.id}">
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
        type: record.type,
        color: record.color,
        initialBalance: record.initial_balance,
        targetAmount: record.target_amount || '',
        description: record.description || ''
      }
    : {
        name: '',
        type: 'cash',
        color: 'violet',
        initialBalance: '',
        targetAmount: '',
        description: ''
      };

  const modal = openModal({
    title: isEdit ? 'Edit Dompet' : 'Buat Dompet',
    description: isEdit
      ? 'Perbarui informasi dompet. Mengubah saldo awal akan menyesuaikan saldo berjalan.'
      : 'Tentukan nama, jenis, dan saldo awal dompet barumu.',
    size: 'md',
    body: `
      <form id="wallet-form" class="form-grid" novalidate>
        <div class="form-field form-field-full">
          <label for="wallet-name">Nama dompet</label>
          <input class="input" id="wallet-name" name="name" type="text" maxlength="120" value="${escapeHtml(
            values.name
          )}" placeholder="Contoh: Dompet Harian" autofocus required>
        </div>

        <div class="form-field">
          <label for="wallet-type">Jenis dompet</label>
          <select class="select" id="wallet-type" name="type">
            ${WALLET_TYPES.map(
              (item) =>
                `<option value="${item.value}" ${
                  item.value === values.type ? 'selected' : ''
                }>${escapeHtml(item.label)}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-field">
          <label for="wallet-initial">Saldo awal</label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="wallet-initial" name="initialBalance" type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(
              values.initialBalance
            )}" placeholder="0">
          </div>
        </div>

        <div class="form-field form-field-full">
          <label>Warna dompet</label>
          <div class="wallet-color-options" role="radiogroup" aria-label="Warna dompet">
            ${WALLET_COLORS.map(
              (item) => `
                <label class="wallet-color-option wallet-tone-${item.value}" title="${escapeHtml(
                  item.label
                )}">
                  <input type="radio" name="color" value="${item.value}" ${
                    item.value === values.color ? 'checked' : ''
                  }>
                  <span class="wallet-color-dot" aria-hidden="true"></span>
                  <span class="sr-only">${escapeHtml(item.label)}</span>
                </label>
              `
            ).join('')}
          </div>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-target">Target saldo <span class="muted">(opsional)</span></label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="wallet-target" name="targetAmount" type="number" inputmode="decimal" min="0.01" step="0.01" value="${escapeHtml(
              values.targetAmount
            )}" placeholder="0">
          </div>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-description">Deskripsi <span class="muted">(opsional)</span></label>
          <textarea class="textarea" id="wallet-description" name="description" maxlength="500" placeholder="Untuk apa dompet ini?">${escapeHtml(
            values.description
          )}</textarea>
        </div>

        <div class="form-error" data-form-error hidden></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
      <button type="submit" form="wallet-form" class="btn btn-primary">
        ${icon('save')}<span>${isEdit ? 'Simpan Perubahan' : 'Buat Dompet'}</span>
      </button>
    `
  });

  const form = modal.dialog.querySelector('#wallet-form');
  const submitButton = modal.dialog.querySelector('[type="submit"]');

  modal.dialog
    .querySelector('[data-modal-cancel]')
    ?.addEventListener('click', () => modal.close());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const nameInput = form.elements.name;
    const initialInput = form.elements.initialBalance;
    const targetInput = form.elements.targetAmount;
    const name = nameInput.value.trim();
    const initialBalance = parseNumber(initialInput.value || 0);
    const targetValue = targetInput.value.trim();

    if (!name) {
      showFieldError(nameInput, 'Nama dompet wajib diisi.');
      return;
    }

    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      showFieldError(initialInput, 'Saldo awal tidak boleh negatif.');
      return;
    }

    if (
      initialInput.value !== '' &&
      Math.abs(initialBalance * 100 - Math.round(initialBalance * 100)) >
        0.000001
    ) {
      showFieldError(initialInput, 'Saldo awal maksimal 2 angka desimal.');
      return;
    }

    let targetAmount = null;

    if (targetValue) {
      const targetResult = validateAmount(targetValue, {
        label: 'Target saldo'
      });

      if (!targetResult.valid) {
        showFieldError(targetInput, targetResult.message);
        return;
      }

      targetAmount = targetResult.value;
    }

    const payload = {
      name,
      type: form.elements.type.value,
      color: form.elements.color.value,
      initialBalance,
      targetAmount,
      description: form.elements.description.value.trim()
    };

    setButtonLoading(
      submitButton,
      true,
      isEdit ? 'Menyimpan...' : 'Membuat...'
    );

    try {
      if (isEdit) {
        await updateWallet(state.user.id, record.id, payload);
      } else {
        await createWallet(state.user.id, payload);
      }

      modal.close();
      showToast(
        isEdit ? 'Dompet berhasil diperbarui.' : 'Dompet berhasil dibuat.',
        'success'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to save wallet:', error);
      setButtonLoading(submitButton, false);
      showFormError(
        form,
        getErrorMessage(error, 'Dompet gagal disimpan.')
      );
    }
  });
}

function openTransaction(record, type) {
  const isExpense = type === 'expense';
  const balance = Number(record.balance) || 0;

  if (isExpense && balance <= 0) {
    showToast('Saldo dompet belum tersedia untuk pengeluaran.', 'info');
    return;
  }

  const categories = isExpense
    ? WALLET_EXPENSE_CATEGORIES
    : WALLET_INCOME_CATEGORIES;
  const modal = openModal({
    title: isExpense ? 'Catat Pengeluaran' : 'Catat Pemasukan',
    description: isExpense
      ? 'Pengeluaran tidak dapat melebihi saldo dompet saat ini.'
      : 'Pemasukan akan menambah saldo dompet secara langsung.',
    size: 'sm',
    body: `
      <div class="detail-grid">
        <div class="detail-item">
          <dt>Dompet</dt>
          <dd>${escapeHtml(record.name)}</dd>
        </div>
        <div class="detail-item">
          <dt>Saldo saat ini</dt>
          <dd>${formatCurrency(balance)}</dd>
        </div>
      </div>

      <form id="wallet-transaction-form" class="form-grid form-grid-spaced" novalidate>
        <div class="form-field form-field-full">
          <label for="wallet-transaction-amount">Nominal ${isExpense ? 'pengeluaran' : 'pemasukan'}</label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="wallet-transaction-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" ${
              isExpense ? `max="${balance}"` : ''
            } placeholder="0" autofocus required>
          </div>
          ${
            isExpense
              ? `<p class="field-hint">Maksimal ${formatCurrency(balance)}.</p>`
              : ''
          }
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transaction-category">Kategori</label>
          <select class="select" id="wallet-transaction-category" name="category">
            ${categories
              .map(
                (item) =>
                  `<option value="${item.value}">${escapeHtml(item.label)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transaction-date">Tanggal transaksi</label>
          <input class="input" id="wallet-transaction-date" name="transactionDate" type="date" value="${todayISO()}" required>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transaction-description">Catatan <span class="muted">(opsional)</span></label>
          <textarea class="textarea" id="wallet-transaction-description" name="description" maxlength="500" placeholder="${
            isExpense ? 'Contoh: makan siang' : 'Contoh: gaji bulan ini'
          }"></textarea>
        </div>

        <div class="form-error" data-form-error hidden></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
      <button type="submit" form="wallet-transaction-form" class="btn btn-primary">
        ${icon(isExpense ? 'arrow-up-right' : 'arrow-down-left')}
        <span>Simpan ${isExpense ? 'Pengeluaran' : 'Pemasukan'}</span>
      </button>
    `
  });

  const form = modal.dialog.querySelector('#wallet-transaction-form');
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
      label: `Nominal ${isExpense ? 'pengeluaran' : 'pemasukan'}`
    });

    if (!amountResult.valid) {
      showFieldError(amountInput, amountResult.message);
      return;
    }

    if (isExpense && amountResult.value > balance) {
      showFieldError(
        amountInput,
        'Nominal pengeluaran melebihi saldo dompet saat ini.'
      );
      return;
    }

    if (!dateInput.value) {
      showFieldError(dateInput, 'Tanggal transaksi wajib diisi.');
      return;
    }

    setButtonLoading(submitButton, true, 'Menyimpan...');

    try {
      await recordWalletTransaction({
        userId: state.user.id,
        walletId: record.id,
        type,
        amount: amountResult.value,
        category: form.elements.category.value,
        transactionDate: dateInput.value,
        description: form.elements.description.value.trim()
      });

      modal.close();
      showToast(
        `${isExpense ? 'Pengeluaran' : 'Pemasukan'} berhasil dicatat.`,
        'success'
      );
      await loadData();
    } catch (error) {
      console.error('Failed to save wallet transaction:', error);
      setButtonLoading(submitButton, false);
      showFormError(
        form,
        getErrorMessage(error, 'Transaksi dompet gagal disimpan.')
      );
    }
  });
}

function openTransfer(record) {
  const destinations = state.wallets.filter((wallet) => wallet.id !== record.id);

  if (destinations.length === 0) {
    showToast('Buat dompet lain terlebih dahulu untuk melakukan transfer.', 'info');
    return;
  }

  const balance = Number(record.balance) || 0;

  if (balance <= 0) {
    showToast('Saldo dompet asal belum tersedia untuk ditransfer.', 'info');
    return;
  }

  const modal = openModal({
    title: 'Transfer Antar Dompet',
    description: 'Pindahkan saldo antar dompet dalam satu transaksi atomik.',
    size: 'sm',
    body: `
      <div class="detail-grid">
        <div class="detail-item">
          <dt>Dari dompet</dt>
          <dd>${escapeHtml(record.name)}</dd>
        </div>
        <div class="detail-item">
          <dt>Saldo tersedia</dt>
          <dd>${formatCurrency(balance)}</dd>
        </div>
      </div>

      <form id="wallet-transfer-form" class="form-grid form-grid-spaced" novalidate>
        <div class="form-field form-field-full">
          <label for="wallet-transfer-destination">Dompet tujuan</label>
          <select class="select" id="wallet-transfer-destination" name="destination">
            ${destinations
              .map(
                (wallet) =>
                  `<option value="${wallet.id}">${escapeHtml(
                    wallet.name
                  )} — ${formatCurrency(wallet.balance)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transfer-amount">Nominal transfer</label>
          <div class="input-wrap has-prefix">
            <span class="input-prefix">Rp</span>
            <input class="input" id="wallet-transfer-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" max="${balance}" placeholder="0" autofocus required>
          </div>
          <p class="field-hint">Maksimal ${formatCurrency(balance)}.</p>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transfer-date">Tanggal transfer</label>
          <input class="input" id="wallet-transfer-date" name="transactionDate" type="date" value="${todayISO()}" required>
        </div>

        <div class="form-field form-field-full">
          <label for="wallet-transfer-description">Catatan <span class="muted">(opsional)</span></label>
          <textarea class="textarea" id="wallet-transfer-description" name="description" maxlength="500" placeholder="Contoh: pindah dana ke rekening bank"></textarea>
        </div>

        <div class="form-error" data-form-error hidden></div>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
      <button type="submit" form="wallet-transfer-form" class="btn btn-primary">
        ${icon('arrow-left-right')}<span>Transfer</span>
      </button>
    `
  });

  const form = modal.dialog.querySelector('#wallet-transfer-form');
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
      label: 'Nominal transfer'
    });

    if (!amountResult.valid) {
      showFieldError(amountInput, amountResult.message);
      return;
    }

    if (amountResult.value > balance) {
      showFieldError(amountInput, 'Nominal transfer melebihi saldo dompet asal.');
      return;
    }

    if (!dateInput.value) {
      showFieldError(dateInput, 'Tanggal transfer wajib diisi.');
      return;
    }

    setButtonLoading(submitButton, true, 'Memindahkan...');

    try {
      await recordWalletTransfer({
        userId: state.user.id,
        fromWalletId: record.id,
        toWalletId: form.elements.destination.value,
        amount: amountResult.value,
        transactionDate: dateInput.value,
        description: form.elements.description.value.trim()
      });

      modal.close();
      showToast('Transfer dompet berhasil dicatat.', 'success');
      await loadData();
    } catch (error) {
      console.error('Failed to transfer wallet balance:', error);
      setButtonLoading(submitButton, false);
      showFormError(
        form,
        getErrorMessage(error, 'Transfer dompet gagal disimpan.')
      );
    }
  });
}

function openDetail(record) {
  const type = getWalletTypeMeta(record.type);
  const color = getWalletColorMeta(record.color);
  const balance = Number(record.balance) || 0;
  const target = Number(record.target_amount) || 0;
  const percentage = target > 0 ? Math.round(calcProgressRaw(balance, target)) : 0;
  const visualProgress = target > 0 ? calcProgress(balance, target) : 0;

  const modal = openModal({
    title: 'Detail Dompet',
    description: 'Saldo, target, dan seluruh transaksi dompet ini.',
    size: 'lg',
    body: `
      <div class="wallet-detail-header wallet-tone-${escapeHtml(color.value)}">
        <span class="wallet-icon">${icon(type.icon)}</span>
        <div>
          <p class="wallet-type">${escapeHtml(type.label)}</p>
          <h3 class="wallet-name">${escapeHtml(record.name)}</h3>
          <p class="muted">${escapeHtml(record.description || 'Tanpa deskripsi')}</p>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <dt>Saldo saat ini</dt>
          <dd>${formatCurrency(balance)}</dd>
        </div>
        <div class="detail-item">
          <dt>Saldo awal</dt>
          <dd>${formatCurrency(record.initial_balance)}</dd>
        </div>
        <div class="detail-item">
          <dt>Target saldo</dt>
          <dd>${target > 0 ? formatCurrency(target) : '-'}</dd>
        </div>
        <div class="detail-item">
          <dt>Sisa target</dt>
          <dd>${target > 0 ? formatCurrency(Math.max(0, target - balance)) : '-'}</dd>
        </div>
        <div class="detail-item">
          <dt>Total pemasukan</dt>
          <dd class="amount-positive" id="wallet-detail-income">—</dd>
        </div>
        <div class="detail-item">
          <dt>Total pengeluaran</dt>
          <dd class="amount-negative" id="wallet-detail-expense">—</dd>
        </div>
        <div class="detail-item">
          <dt>Transfer masuk</dt>
          <dd class="amount-positive" id="wallet-detail-transfer-in">—</dd>
        </div>
        <div class="detail-item">
          <dt>Transfer keluar</dt>
          <dd class="amount-negative" id="wallet-detail-transfer-out">—</dd>
        </div>
      </div>

      ${
        target > 0
          ? `<div class="wallet-detail-progress">
               <div class="progress">
                 <div class="progress-bar" style="--progress: ${visualProgress}%"></div>
               </div>
               <div class="progress-meta">
                 <span>${
                   balance >= target
                     ? 'Target tercapai'
                     : `Sisa ${formatCurrency(Math.max(0, target - balance))}`
                 }</span>
                 <strong>${percentage}%</strong>
               </div>
             </div>`
          : ''
      }

      <div class="detail-section">
        <h3>Riwayat Transaksi</h3>
        <div id="wallet-detail-history">
          <div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>
        </div>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-close>Tutup</button>
      <button type="button" class="btn btn-secondary" data-modal-transfer ${
        state.wallets.length < 2 ? 'disabled' : ''
      }>${icon('arrow-left-right')}<span>Transfer</span></button>
      <button type="button" class="btn btn-primary" data-modal-expense ${
        balance <= 0 ? 'disabled' : ''
      }>${icon('arrow-up-right')}<span>Catat Pengeluaran</span></button>
    `
  });

  modal.dialog
    .querySelector('[data-modal-close]')
    ?.addEventListener('click', () => modal.close());
  modal.dialog
    .querySelector('[data-modal-transfer]')
    ?.addEventListener('click', () => {
      modal.close();
      openTransfer(record);
    });
  modal.dialog
    .querySelector('[data-modal-expense]')
    ?.addEventListener('click', () => {
      modal.close();
      openTransaction(record, 'expense');
    });

  loadDetailHistory(record, modal.dialog);
}

async function loadDetailHistory(record, dialog) {
  const historyContainer = dialog.querySelector('#wallet-detail-history');

  try {
    const transactions = await listWalletTransactions(
      state.user.id,
      record.id
    );
    const totals = computeWalletTotals(transactions);

    const setText = (selector, value) => {
      const element = dialog.querySelector(selector);

      if (element) {
        element.textContent = formatCurrency(value);
      }
    };

    setText('#wallet-detail-income', totals.totalIncome);
    setText('#wallet-detail-expense', totals.totalExpense);
    setText('#wallet-detail-transfer-in', totals.totalTransferIn);
    setText('#wallet-detail-transfer-out', totals.totalTransferOut);

    if (transactions.length === 0) {
      historyContainer.innerHTML =
        '<div class="inline-empty">Belum ada transaksi untuk dompet ini.</div>';
      return;
    }

    historyContainer.innerHTML = `
      <div class="mini-list">
        ${transactions.map((transaction) => renderWalletHistoryItem(transaction)).join('')}
      </div>
    `;
    refreshIcons();
  } catch (error) {
    console.error('Failed to load wallet detail:', error);
    historyContainer.innerHTML = errorState({
      message: getErrorMessage(error, 'Riwayat dompet gagal dimuat.')
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

function renderWalletHistoryItem(transaction) {
  const category = getWalletCategoryMeta(transaction.category);
  const counterpart = transaction.counter_wallet_id
    ? state.wallets.find((wallet) => wallet.id === transaction.counter_wallet_id)
    : null;
  let label = category.label;
  let amountClass = 'amount-neutral';
  let prefix = '';

  if (transaction.type === 'income') {
    amountClass = 'amount-positive';
    prefix = '+';
  } else if (transaction.type === 'expense') {
    amountClass = 'amount-negative';
    prefix = '−';
  } else if (transaction.type === 'transfer_in') {
    label = `Transfer dari ${counterpart?.name || 'dompet lain'}`;
    amountClass = 'amount-positive';
    prefix = '+';
  } else if (transaction.type === 'transfer_out') {
    label = `Transfer ke ${counterpart?.name || 'dompet lain'}`;
    amountClass = 'amount-negative';
    prefix = '−';
  }

  const note = transaction.description ? ` · ${transaction.description}` : '';

  return `
    <div class="mini-list-item">
      <div class="mini-list-main">
        <strong>${formatDate(transaction.transaction_date)}</strong>
        <small>${escapeHtml(`${label}${note}`)}</small>
      </div>
      <span class="mini-list-amount ${amountClass}">
        ${prefix}${formatCurrency(transaction.amount)}
      </span>
    </div>
  `;
}

async function handleDelete(record) {
  const confirmed = await confirmDialog({
    title: 'Hapus dompet?',
    message: `Dompet "${record.name}" beserta seluruh transaksinya akan dihapus permanen. Transfer yang melibatkan dompet ini juga akan dibatalkan bila saldo dompet lain tetap aman.`,
    confirmLabel: 'Hapus',
    cancelLabel: 'Batal',
    danger: true
  });

  if (!confirmed) {
    return;
  }

  try {
    await deleteWallet(state.user.id, record.id);
    showToast('Dompet berhasil dihapus.', 'success');
    await loadData();
  } catch (error) {
    console.error('Failed to delete wallet:', error);
    showToast(getErrorMessage(error, 'Dompet gagal dihapus.'), 'error');
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

  if (state.wallets.length === 0) {
    showToast('Buat dompet terlebih dahulu sebelum mencatat transaksi.', 'info');
    return;
  }

  if (
    state.wallets.length > 1 &&
    ['income', 'expense', 'transfer'].includes(action)
  ) {
    const reducedMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    showToast('Pilih dompet yang ingin dicatat.', 'info');
    elements.grid?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
    return;
  }

  const wallet = state.wallets[0];

  if (action === 'income') {
    openTransaction(wallet, 'income');
    return;
  }

  if (action === 'expense') {
    openTransaction(wallet, 'expense');
    return;
  }

  if (action === 'transfer') {
    openTransfer(wallet);
  }
}
