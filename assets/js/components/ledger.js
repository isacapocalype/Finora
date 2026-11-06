import {
  calcProgress,
  calcRemaining,
  debounce,
  escapeHtml,
  formatCurrency,
  formatDate,
  getDueMeta,
  getErrorMessage,
  getInitials,
  getStatusMeta,
  todayISO,
  validateAmount
} from '../utils.js';
import { icon, refreshIcons } from '../icons.js';
import { showToast } from './toast.js';
import { confirmDialog, openModal } from './modal.js';
import {
  clearFormErrors,
  emptyState,
  errorState,
  setButtonLoading,
  showFieldError,
  showFormError,
  tableSkeleton
} from './states.js';
import { renderSummaryCards, summaryLoading } from './summary.js';

/**
 * Halaman utang dan piutang memiliki alur yang sama: daftar, ringkasan,
 * CRUD, pencatatan pembayaran atomik, dan riwayat pembayaran.
 * Factory ini menjaga alur tersebut tetap konsisten tanpa menduplikasi kode.
 */
export function createLedgerPage(config) {
  const state = {
    rows: [],
    search: '',
    status: 'all',
    loading: false,
    urlActionHandled: false
  };

  const elements = {
    summary: document.getElementById('ledger-summary'),
    table: document.getElementById('ledger-table'),
    resultCount: document.getElementById('ledger-result-count'),
    search: document.getElementById('ledger-search'),
    status: document.getElementById('ledger-status-filter'),
    refresh: document.getElementById('ledger-refresh'),
    add: document.querySelector('[data-ledger-add]')
  };

  return {
    async init(user) {
      state.user = user;
      bindEvents();
      await loadData();

      if (!state.urlActionHandled) {
        state.urlActionHandled = true;
        handleUrlAction();
      }
    }
  };

  function bindEvents() {
    elements.add?.addEventListener('click', () => openForm());

    elements.search?.addEventListener(
      'input',
      debounce((event) => {
        state.search = event.target.value.trim().toLowerCase();
        renderTable();
      }, 180)
    );

    elements.status?.addEventListener('change', (event) => {
      state.status = event.target.value;
      renderTable();
    });

    elements.refresh?.addEventListener('click', () => loadData());

    elements.table?.addEventListener('click', (event) => {
      const emptyAction = event.target.closest('.empty-state-action');

      if (emptyAction) {
        if (emptyAction.dataset.emptyMode === 'reset') {
          resetFilters();
        } else {
          openForm();
        }
        return;
      }

      const retry = event.target.closest('.state-retry');

      if (retry) {
        loadData();
        return;
      }

      const actionButton = event.target.closest('[data-action]');

      if (!actionButton) {
        return;
      }

      const row = state.rows.find((item) => item.id === actionButton.dataset.id);

      if (!row) {
        return;
      }

      switch (actionButton.dataset.action) {
        case 'detail':
          openDetail(row);
          break;
        case 'edit':
          openForm(row);
          break;
        case 'pay':
          openPayment(row);
          break;
        case 'delete':
          handleDelete(row);
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
    summaryLoading(elements.summary, 3);
    elements.table.innerHTML = tableSkeleton(5, 6);

    if (elements.resultCount) {
      elements.resultCount.textContent = 'Memuat data...';
    }

    try {
      state.rows = await config.services.list(state.user.id);
      renderSummary();
      renderTable();
    } catch (error) {
      console.error(`Failed to load ${config.entityName}:`, error);
      renderSummaryError();
      elements.table.innerHTML = errorState({
        message: getErrorMessage(error, `Data ${config.entityName} gagal dimuat.`)
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
    const summary = config.computeSummary(state.rows);
    renderSummaryCards(elements.summary, config.summaryCards(summary));
  }

  function renderSummaryError() {
    renderSummaryCards(elements.summary, [
      {
        label: config.labels.amountLabel,
        value: '—',
        meta: 'Belum dapat dimuat',
        iconName: 'wallet',
        tone: 'danger'
      },
      {
        label: config.labels.paidLabel,
        value: '—',
        meta: 'Belum dapat dimuat',
        iconName: 'circle-check-big',
        tone: 'success'
      },
      {
        label: config.labels.remainingLabel,
        value: '—',
        meta: 'Belum dapat dimuat',
        iconName: 'circle-alert',
        tone: 'primary'
      }
    ]);
  }

  function getFilteredRows() {
    return state.rows.filter((row) => {
      const matchesStatus =
        state.status === 'all' || row.status === state.status;
      const person = String(config.read.person(row) || '').toLowerCase();
      const description = String(row.description || '').toLowerCase();
      const matchesSearch =
        !state.search ||
        person.includes(state.search) ||
        description.includes(state.search);

      return matchesStatus && matchesSearch;
    });
  }

  function renderTable() {
    if (!elements.table) {
      return;
    }

    const rows = getFilteredRows();
    updateResultCount(rows.length);

    if (state.rows.length === 0) {
      elements.table.innerHTML = emptyState({
        iconName: config.icons.empty,
        title: config.labels.emptyTitle,
        description: config.labels.emptyDescription,
        actionLabel: config.labels.emptyAction
      });
      elements.table
        .querySelector('.empty-state-action')
        ?.setAttribute('data-empty-mode', 'add');
      refreshIcons();
      return;
    }

    if (rows.length === 0) {
      elements.table.innerHTML = emptyState({
        iconName: 'search-x',
        title: `${config.entityLabel} tidak ditemukan`,
        description:
          'Coba ubah kata kunci pencarian atau filter status yang dipakai.',
        actionLabel: 'Reset filter'
      });
      elements.table
        .querySelector('.empty-state-action')
        ?.setAttribute('data-empty-mode', 'reset');
      refreshIcons();
      return;
    }

    elements.table.innerHTML = `
      <div class="table-wrap">
        <table class="data-table table-stack">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(config.labels.personHeader)}</th>
              <th scope="col" class="text-right">${escapeHtml(config.labels.amountLabel)}</th>
              <th scope="col">${escapeHtml(config.labels.paidLabel)}</th>
              <th scope="col" class="text-right">${escapeHtml(config.labels.remainingLabel)}</th>
              <th scope="col">${escapeHtml(config.labels.dueLabel)}</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderRow).join('')}
          </tbody>
        </table>
      </div>
    `;

    refreshIcons();
  }

  function renderRow(row) {
    const person = config.read.person(row);
    const amount = Number(config.read.amount(row));
    const paid = Number(config.read.paid(row));
    const remaining = calcRemaining(amount, paid);
    const statusMeta = getStatusMeta(config.kind, row.status);
    const dueMeta = getDueMeta(row.due_date, row.status);
    const progress = Math.round(calcProgress(paid, amount));
    const dueDate = row.due_date ? formatDate(row.due_date) : '-';
    const remainingClass =
      remaining <= 0
        ? 'amount-positive'
        : config.kind === 'debt'
          ? 'amount-negative'
          : 'amount-info';
    const subtitle = row.description
      ? escapeHtml(row.description)
      : `Dicatat ${formatDate(row.transaction_date)}`;
    const safePerson = escapeHtml(person);

    return `
      <tr>
        <td data-label="${escapeHtml(config.labels.personHeader)}">
          <div class="cell-primary">
            <span class="cell-avatar">${escapeHtml(getInitials(person))}</span>
            <div>
              <strong>${safePerson}</strong>
              <small>${subtitle}</small>
            </div>
          </div>
        </td>
        <td data-label="${escapeHtml(config.labels.amountLabel)}" class="text-right">
          ${formatCurrency(amount)}
        </td>
        <td data-label="${escapeHtml(config.labels.paidLabel)}">
          <span>${formatCurrency(paid)}</span>
          <small class="muted"> · ${progress}%</small>
        </td>
        <td data-label="${escapeHtml(config.labels.remainingLabel)}" class="text-right">
          <strong class="${remainingClass}">
            ${formatCurrency(remaining)}
          </strong>
        </td>
        <td data-label="${escapeHtml(config.labels.dueLabel)}">
          <div class="cell-date">
            <span>${dueDate}</span>
            ${
              dueMeta
                ? `<span class="${dueMeta.className}">${escapeHtml(dueMeta.label)}</span>`
                : ''
            }
          </div>
        </td>
        <td data-label="Status">
          <span class="${statusMeta.className}">${escapeHtml(statusMeta.label)}</span>
        </td>
        <td data-label="">
          <div class="row-actions">
            <button type="button" class="icon-button icon-button-sm" data-action="detail" data-id="${row.id}" aria-label="Lihat detail ${safePerson}" title="Detail">
              ${icon('eye')}
            </button>
            <button type="button" class="icon-button icon-button-sm" data-action="edit" data-id="${row.id}" aria-label="Edit ${safePerson}" title="Edit">
              ${icon('pencil')}
            </button>
            <button type="button" class="icon-button icon-button-sm" data-action="pay" data-id="${row.id}" aria-label="Catat ${config.labels.paymentNoun} ${safePerson}" title="${escapeHtml(config.labels.paymentAction)}" ${remaining <= 0 ? 'disabled' : ''}>
              ${icon('hand-coins')}
            </button>
            <button type="button" class="icon-button icon-button-sm icon-button-danger" data-action="delete" data-id="${row.id}" aria-label="Hapus ${safePerson}" title="Hapus">
              ${icon('trash-2')}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function updateResultCount(filteredCount) {
    if (!elements.resultCount) {
      return;
    }

    const total = state.rows.length;

    if (total === 0) {
      elements.resultCount.textContent = `Belum ada ${config.entityName}.`;
      return;
    }

    elements.resultCount.textContent =
      filteredCount === total
        ? `${total} ${config.entityName} tercatat.`
        : `${filteredCount} dari ${total} ${config.entityName} ditampilkan.`;
  }

  function resetFilters() {
    state.search = '';
    state.status = 'all';

    if (elements.search) {
      elements.search.value = '';
    }

    if (elements.status) {
      elements.status.value = 'all';
    }

    renderTable();
  }

  function openForm(record = null) {
    const isEdit = Boolean(record);
    const values = record
      ? config.toForm(record)
      : {
          person: '',
          amount: '',
          transactionDate: todayISO(),
          dueDate: '',
          description: ''
        };

    const modal = openModal({
      title: isEdit ? config.labels.editTitle : config.labels.addTitle,
      description: isEdit
        ? `Perbarui data ${config.entityName}. Perubahan langsung tersimpan di database.`
        : config.labels.formDescription,
      size: 'md',
      body: `
        <form id="ledger-form" class="form-grid" novalidate>
          <div class="form-field form-field-full">
            <label for="ledger-person">${escapeHtml(config.labels.personLabel)}</label>
            <div class="input-wrap has-icon">
              <span class="input-icon">${icon(config.icons.person)}</span>
              <input class="input" id="ledger-person" name="person" type="text" maxlength="120" placeholder="${escapeHtml(config.labels.personPlaceholder)}" value="${escapeHtml(values.person)}" autocomplete="off" autofocus required>
            </div>
          </div>

          <div class="form-field form-field-full">
            <label for="ledger-amount">${escapeHtml(config.labels.amountLabel)}</label>
            <div class="input-wrap has-prefix">
              <span class="input-prefix">Rp</span>
              <input class="input" id="ledger-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" value="${escapeHtml(values.amount)}" required>
            </div>
          </div>

          <div class="form-field">
            <label for="ledger-date">${escapeHtml(config.labels.dateLabel)}</label>
            <input class="input" id="ledger-date" name="transactionDate" type="date" value="${escapeHtml(values.transactionDate)}" required>
          </div>

          <div class="form-field">
            <label for="ledger-due">${escapeHtml(config.labels.dueLabel)} <span class="muted">(opsional)</span></label>
            <input class="input" id="ledger-due" name="dueDate" type="date" value="${escapeHtml(values.dueDate)}" min="${escapeHtml(values.transactionDate)}">
          </div>

          <div class="form-field form-field-full">
            <label for="ledger-description">Catatan <span class="muted">(opsional)</span></label>
            <textarea class="textarea" id="ledger-description" name="description" maxlength="500" placeholder="Tambahkan keterangan singkat...">${escapeHtml(values.description)}</textarea>
          </div>

          <div class="form-error" data-form-error hidden></div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
        <button type="submit" form="ledger-form" class="btn btn-primary">
          ${icon('save')}<span>${isEdit ? 'Simpan Perubahan' : config.labels.addAction}</span>
        </button>
      `
    });

    const form = modal.dialog.querySelector('#ledger-form');
    const submitButton = modal.dialog.querySelector('[type="submit"]');
    const dateInput = form.elements.transactionDate;
    const dueInput = form.elements.dueDate;

    dateInput.addEventListener('change', () => {
      dueInput.min = dateInput.value;
    });

    modal.dialog
      .querySelector('[data-modal-cancel]')
      ?.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);

      const personInput = form.elements.person;
      const amountInput = form.elements.amount;
      const person = personInput.value.trim();
      const amountResult = validateAmount(amountInput.value, {
        label: config.labels.amountLabel
      });
      const transactionDate = dateInput.value;
      const dueDate = dueInput.value;
      const description = form.elements.description.value.trim();

      if (!person) {
        showFieldError(personInput, `${config.labels.personLabel} wajib diisi.`);
        return;
      }

      if (!amountResult.valid) {
        showFieldError(amountInput, amountResult.message);
        return;
      }

      if (!transactionDate) {
        showFieldError(dateInput, `${config.labels.dateLabel} wajib diisi.`);
        return;
      }

      if (dueDate && dueDate < transactionDate) {
        showFieldError(
          dueInput,
          `${config.labels.dueLabel} tidak boleh sebelum ${config.labels.dateLabel.toLowerCase()}.`
        );
        return;
      }

      if (description.length > 500) {
        showFieldError(
          form.elements.description,
          'Catatan maksimal 500 karakter.'
        );
        return;
      }

      if (
        isEdit &&
        amountResult.value < Number(config.read.paid(record))
      ) {
        showFieldError(
          amountInput,
          `Nominal tidak boleh lebih kecil dari total ${config.labels.paymentNoun} (${formatCurrency(
            config.read.paid(record)
          )}).`
        );
        return;
      }

      const payload = config.toPayload({
        person,
        amount: amountResult.value,
        transactionDate,
        dueDate,
        description
      });

      setButtonLoading(
        submitButton,
        true,
        isEdit ? 'Menyimpan...' : 'Menambahkan...'
      );

      try {
        if (isEdit) {
          await config.services.update(state.user.id, record.id, payload);
        } else {
          await config.services.create(state.user.id, payload);
        }

        modal.close();
        showToast(
          isEdit
            ? `${config.entityLabel} berhasil diperbarui.`
            : `${config.entityLabel} berhasil ditambahkan.`,
          'success'
        );
        await loadData();
      } catch (error) {
        console.error(`Failed to save ${config.entityName}:`, error);
        setButtonLoading(submitButton, false);
        showFormError(
          form,
          getErrorMessage(error, `${config.entityLabel} gagal disimpan.`)
        );
      }
    });
  }

  function openPayment(record) {
    const remaining = calcRemaining(
      config.read.amount(record),
      config.read.paid(record)
    );
    const remainingClass =
      config.kind === 'debt' ? 'amount-negative' : 'amount-info';

    if (remaining <= 0) {
      showToast(`${config.entityLabel} ini sudah lunas.`, 'info');
      return;
    }

    const modal = openModal({
      title: config.labels.paymentTitle,
      description: config.labels.paymentDescription,
      size: 'sm',
      body: `
        <div class="detail-grid">
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.personLabel)}</dt>
            <dd>${escapeHtml(config.read.person(record))}</dd>
          </div>
          <div class="detail-item">
            <dt>Sisa ${escapeHtml(config.entityName)}</dt>
            <dd class="${remainingClass}">${formatCurrency(remaining)}</dd>
          </div>
        </div>

        <form id="payment-form" class="form-grid" style="margin-top: 16px;" novalidate>
          <div class="form-field form-field-full">
            <label for="payment-amount">Nominal ${escapeHtml(config.labels.paymentNoun)}</label>
            <div class="input-wrap has-prefix">
              <span class="input-prefix">Rp</span>
              <input class="input" id="payment-amount" name="amount" type="number" inputmode="decimal" min="0.01" max="${remaining}" step="0.01" placeholder="0" autofocus required>
            </div>
            <p class="field-hint">Maksimal ${formatCurrency(remaining)}.</p>
          </div>

          <div class="form-field form-field-full">
            <label for="payment-date">Tanggal ${escapeHtml(config.labels.paymentNoun)}</label>
            <input class="input" id="payment-date" name="paymentDate" type="date" value="${todayISO()}" required>
          </div>

          <div class="form-field form-field-full">
            <label for="payment-description">Catatan <span class="muted">(opsional)</span></label>
            <textarea class="textarea" id="payment-description" name="description" maxlength="500" placeholder="Contoh: transfer bank"></textarea>
          </div>

          <div class="form-error" data-form-error hidden></div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
        <button type="submit" form="payment-form" class="btn btn-primary">
          ${icon('hand-coins')}<span>Simpan ${escapeHtml(config.labels.paymentNoun)}</span>
        </button>
      `
    });

    const form = modal.dialog.querySelector('#payment-form');
    const submitButton = modal.dialog.querySelector('[type="submit"]');

    modal.dialog
      .querySelector('[data-modal-cancel]')
      ?.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);

      const amountInput = form.elements.amount;
      const dateInput = form.elements.paymentDate;
      const amountResult = validateAmount(amountInput.value, {
        label: `Nominal ${config.labels.paymentNoun}`
      });

      if (!amountResult.valid) {
        showFieldError(amountInput, amountResult.message);
        return;
      }

      if (amountResult.value > remaining) {
        showFieldError(
          amountInput,
          `Nominal ${config.labels.paymentNoun} melebihi sisa ${config.entityName}.`
        );
        return;
      }

      if (!dateInput.value) {
        showFieldError(dateInput, `Tanggal ${config.labels.paymentNoun} wajib diisi.`);
        return;
      }

      setButtonLoading(submitButton, true, 'Menyimpan...');

      try {
        await config.services.recordPayment(state.user.id, record.id, {
          amount: amountResult.value,
          paymentDate: dateInput.value,
          description: form.elements.description.value.trim()
        });

        modal.close();
        showToast(
          `${config.labels.paymentNoun[0].toUpperCase()}${config.labels.paymentNoun.slice(
            1
          )} berhasil dicatat.`,
          'success'
        );
        await loadData();
      } catch (error) {
        console.error(`Failed to record ${config.entityName} payment:`, error);
        setButtonLoading(submitButton, false);
        showFormError(
          form,
          getErrorMessage(
            error,
            `${config.labels.paymentNoun[0].toUpperCase()}${config.labels.paymentNoun.slice(
              1
            )} gagal disimpan.`
          )
        );
      }
    });
  }

  function openDetail(record) {
    const amount = Number(config.read.amount(record));
    const paid = Number(config.read.paid(record));
    const remaining = calcRemaining(amount, paid);
    const statusMeta = getStatusMeta(config.kind, record.status);
    const remainingClass =
      remaining <= 0
        ? 'amount-positive'
        : config.kind === 'debt'
          ? 'amount-negative'
          : 'amount-info';
    const modal = openModal({
      title: `${config.labels.detailTitle}`,
      description: `Informasi lengkap dan riwayat ${config.labels.paymentNoun}.`,
      size: 'lg',
      body: `
        <div class="detail-grid">
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.personLabel)}</dt>
            <dd>${escapeHtml(config.read.person(record))}</dd>
          </div>
          <div class="detail-item">
            <dt>Status</dt>
            <dd><span class="${statusMeta.className}">${escapeHtml(statusMeta.label)}</span></dd>
          </div>
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.amountLabel)}</dt>
            <dd>${formatCurrency(amount)}</dd>
          </div>
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.paidLabel)}</dt>
            <dd class="amount-positive">${formatCurrency(paid)}</dd>
          </div>
          <div class="detail-item">
            <dt>Sisa</dt>
            <dd class="${remainingClass}">${formatCurrency(remaining)}</dd>
          </div>
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.dateLabel)}</dt>
            <dd>${formatDate(record.transaction_date)}</dd>
          </div>
          <div class="detail-item">
            <dt>${escapeHtml(config.labels.dueLabel)}</dt>
            <dd>${record.due_date ? formatDate(record.due_date) : '-'}</dd>
          </div>
          <div class="detail-item">
            <dt>Terakhir diperbarui</dt>
            <dd>${formatDate(record.updated_at || record.created_at)}</dd>
          </div>
          <div class="detail-item detail-item-full">
            <dt>Catatan</dt>
            <dd>${record.description ? escapeHtml(record.description) : '-'}</dd>
          </div>
        </div>

        <div class="detail-section">
          <h3>
            <span>${escapeHtml(config.labels.historyTitle)}</span>
            <span class="badge badge-purple">${formatCurrency(paid)}</span>
          </h3>
          <div id="payment-history">
            <div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-close>Tutup</button>
        ${
          remaining > 0
            ? `<button type="button" class="btn btn-primary" data-modal-pay>${icon(
                'hand-coins'
              )}<span>${escapeHtml(config.labels.paymentAction)}</span></button>`
            : ''
        }
      `
    });

    modal.dialog
      .querySelector('[data-modal-close]')
      ?.addEventListener('click', () => modal.close());

    modal.dialog.querySelector('[data-modal-pay]')?.addEventListener('click', () => {
      modal.close();
      openPayment(record);
    });

    loadPaymentHistory(record, modal.dialog.querySelector('#payment-history'));
  }

  async function loadPaymentHistory(record, container) {
    if (!container) {
      return;
    }

    try {
      const payments = await config.services.listPayments(
        state.user.id,
        record.id
      );

      if (payments.length === 0) {
        container.innerHTML = `<div class="inline-empty">${escapeHtml(
          config.labels.historyEmpty
        )}</div>`;
        return;
      }

      container.innerHTML = `
        <div class="mini-list">
          ${payments
            .map(
              (payment) => `
                <div class="mini-list-item">
                  <div class="mini-list-main">
                    <strong>${formatDate(payment.payment_date)}</strong>
                    <small>${escapeHtml(payment.description || 'Tanpa catatan')}</small>
                  </div>
                  <span class="mini-list-amount ${
                    config.kind === 'debt' ? 'amount-outflow' : 'amount-inflow'
                  }">${formatCurrency(payment.amount)}</span>
                </div>
              `
            )
            .join('')}
        </div>
      `;
    } catch (error) {
      console.error('Failed to load payment history:', error);
      container.innerHTML = errorState({
        message: getErrorMessage(error, 'Riwayat pembayaran gagal dimuat.'),
        retryLabel: 'Coba lagi'
      });
      container.querySelector('.state-retry')?.addEventListener('click', () => {
        container.innerHTML =
          '<div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>';
        loadPaymentHistory(record, container);
      });
      refreshIcons();
    }
  }

  async function handleDelete(record) {
    const confirmed = await confirmDialog({
      title: config.labels.deleteTitle,
      message: config.labels.deleteMessage(record),
      confirmLabel: 'Hapus',
      cancelLabel: 'Batal',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    try {
      await config.services.remove(state.user.id, record.id);
      showToast(`${config.entityLabel} berhasil dihapus.`, 'success');
      await loadData();
    } catch (error) {
      console.error(`Failed to delete ${config.entityName}:`, error);
      showToast(
        getErrorMessage(error, `${config.entityLabel} gagal dihapus.`),
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

    if (action === 'pay') {
      const target = state.rows.find(
        (row) =>
          calcRemaining(config.read.amount(row), config.read.paid(row)) > 0
      );

      if (target) {
        openPayment(target);
      } else {
        showToast(
          `Belum ada ${config.entityName} aktif untuk dibayar.`,
          'info'
        );
      }
    }
  }
}
