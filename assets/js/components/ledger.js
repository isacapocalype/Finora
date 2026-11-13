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
  normalizeNameKey,
  todayISO,
  validateAmount
} from '../utils.js';
import { icon, refreshIcons } from '../icons.js';
import { showToast } from './toast.js';
import { confirmDialog, openModal } from './modal.js';
import {
  listContacts,
  removeContactPhoto,
  resolveContact,
  setContactPhoto
} from '../services/contact.service.js';
import { fileToAvatarDataUrl } from '../photo.js';
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
    contacts: [],
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
        case 'profile':
          openProfileForRow(row);
          break;
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
      const [rows, contacts] = await Promise.all([
        config.services.list(state.user.id),
        listContacts(state.user.id)
      ]);

      state.rows = rows;
      state.contacts = contacts;
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

  function contactForRow(row) {
    if (row.contact_id) {
      const matched = state.contacts.find(
        (contact) => contact.id === row.contact_id
      );

      if (matched) {
        return matched;
      }
    }

    const nameKey = normalizeNameKey(config.read.person(row));
    return (
      state.contacts.find((contact) => contact.name_key === nameKey) || null
    );
  }

  function avatarMarkup(contact, name, className) {
    const photo = contact?.photo;

    return `
      <span class="${className}">
        ${
          photo
            ? `<img src="${escapeHtml(photo)}" alt="">`
            : escapeHtml(getInitials(name))
        }
      </span>
    `;
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
    const contact = contactForRow(row);

    return `
      <tr>
        <td data-label="${escapeHtml(config.labels.personHeader)}">
          <button type="button" class="cell-primary cell-person-button" data-action="profile" data-id="${row.id}" aria-label="Buka profil ${safePerson}">
            ${avatarMarkup(contact, person, 'cell-avatar')}
            <span class="cell-person-meta">
              <strong>${safePerson}</strong>
              <small>${subtitle}</small>
            </span>
            <span class="cell-person-arrow" aria-hidden="true">${icon('chevron-right')}</span>
          </button>
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

  function openForm(record = null, options = {}) {
    const isEdit = Boolean(record);
    const lockedContact = options.contact || null;
    const values = record
      ? config.toForm(record)
      : {
          person: lockedContact?.name || '',
          amount: '',
          transactionDate: todayISO(),
          dueDate: '',
          description: ''
        };
    const additionsTotal = isEdit
      ? Math.max(
          0,
          Number(record.amount) -
            Number(
              record.initial_amount === undefined
                ? record.amount
                : record.initial_amount
            )
        )
      : 0;
    const amountLabel =
      isEdit && additionsTotal > 0
        ? config.labels.initialAmountLabel
        : config.labels.amountLabel;

    const modal = openModal({
      title: isEdit
        ? config.labels.editTitle
        : lockedContact
          ? config.labels.profileAddAction
          : config.labels.addTitle,
      description: isEdit
        ? `Perbarui data ${config.entityName}. Perubahan langsung tersimpan di perangkat.`
        : lockedContact
          ? `Catat ${config.entityName} baru untuk ${lockedContact.name}. Catatan ini akan masuk ke profil dan riwayat orang tersebut.`
          : config.labels.formDescription,
      size: 'md',
      body: `
        <form id="ledger-form" class="form-grid" novalidate>
          <div class="form-field form-field-full">
            <label for="ledger-person">${escapeHtml(config.labels.personLabel)}</label>
            <div class="input-wrap has-icon">
              <span class="input-icon">${icon(config.icons.person)}</span>
              <input class="input" id="ledger-person" name="person" type="text" maxlength="120" placeholder="${escapeHtml(config.labels.personPlaceholder)}" value="${escapeHtml(values.person)}" autocomplete="off" ${lockedContact ? 'readonly' : 'autofocus'} required>
            </div>
            ${
              lockedContact
                ? `<p class="field-hint">Terhubung ke profil ${escapeHtml(lockedContact.name)}.</p>`
                : ''
            }
          </div>

          <div class="form-field form-field-full">
            <label for="ledger-amount">${escapeHtml(amountLabel)}</label>
            <div class="input-wrap has-prefix">
              <span class="input-prefix">Rp</span>
              <input class="input" id="ledger-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" value="${escapeHtml(values.amount)}" required>
            </div>
            ${
              additionsTotal > 0
                ? `<p class="field-hint">Total saat ini termasuk penambahan: ${formatCurrency(
                    record.amount
                  )}. Mengubah nominal awal akan menghitung ulang total.</p>`
                : ''
            }
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
          ${icon('save')}<span>${
            isEdit
              ? 'Simpan Perubahan'
              : lockedContact
                ? config.labels.profileAddAction
                : config.labels.addAction
          }</span>
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
        label: amountLabel
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
        amountResult.value + additionsTotal < Number(config.read.paid(record))
      ) {
        showFieldError(
          amountInput,
          `Total pokok tidak boleh lebih kecil dari total ${config.labels.paymentNoun} (${formatCurrency(
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

      if (!isEdit && lockedContact) {
        payload.contactId = lockedContact.id;
      }

      setButtonLoading(
        submitButton,
        true,
        isEdit ? 'Menyimpan...' : 'Menambahkan...'
      );

      try {
        let saved;

        if (isEdit) {
          saved = await config.services.update(
            state.user.id,
            record.id,
            payload
          );
        } else {
          saved = await config.services.create(state.user.id, payload);
        }

        modal.close();
        showToast(
          isEdit
            ? `${config.entityLabel} berhasil diperbarui.`
            : `${config.entityLabel} berhasil ditambahkan.`,
          'success'
        );
        await loadData();

        if (typeof options.onSaved === 'function') {
          await options.onSaved(saved);
        }
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

  function openPayment(record, options = {}) {
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

        <form id="payment-form" class="form-grid form-grid-spaced" novalidate>
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

        if (typeof options.onSaved === 'function') {
          await options.onSaved();
        }
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
    const initialAmount = Number(
      record.initial_amount === undefined ? amount : record.initial_amount
    );
    const additionsTotal = Math.max(0, amount - initialAmount);
    const contact = contactForRow(record);
    const statusMeta = getStatusMeta(config.kind, record.status);
    const remainingClass =
      remaining <= 0
        ? 'amount-positive'
        : config.kind === 'debt'
          ? 'amount-negative'
          : 'amount-info';
    const modal = openModal({
      title: `${config.labels.detailTitle}`,
      description: `Informasi lengkap, riwayat penambahan, dan ${config.labels.paymentNoun}.`,
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
          ${
            additionsTotal > 0
              ? `
                <div class="detail-item">
                  <dt>${escapeHtml(config.labels.initialAmountLabel)}</dt>
                  <dd>${formatCurrency(initialAmount)}</dd>
                </div>
                <div class="detail-item">
                  <dt>Total penambahan</dt>
                  <dd class="amount-info">${formatCurrency(additionsTotal)}</dd>
                </div>
              `
              : ''
          }
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
            <span>${escapeHtml(config.labels.additionHistoryTitle)}</span>
            <span class="badge badge-purple">${formatCurrency(additionsTotal)}</span>
          </h3>
          <div id="addition-history">
            <div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>
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
          contact
            ? `<button type="button" class="btn btn-secondary" data-modal-profile>${icon(
                'user-round'
              )}<span>Profil</span></button>`
            : ''
        }
        <button type="button" class="btn btn-secondary" data-modal-add-principal>${icon(
          'plus'
        )}<span>${escapeHtml(config.labels.principalAction)}</span></button>
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

    modal.dialog.querySelector('[data-modal-profile]')?.addEventListener('click', () => {
      modal.close();
      openContactProfile(contact);
    });

    modal.dialog
      .querySelector('[data-modal-add-principal]')
      ?.addEventListener('click', () => {
        modal.close();
        openPrincipalForm(record, {
          onSaved: async () => {
            const refreshed = findRow(record.id);
            if (refreshed) {
              openDetail(refreshed);
            }
          }
        });
      });

    modal.dialog.querySelector('[data-modal-pay]')?.addEventListener('click', () => {
      modal.close();
      openPayment(record, {
        onSaved: async () => {
          const refreshed = findRow(record.id);
          if (refreshed) {
            openDetail(refreshed);
          }
        }
      });
    });

    loadAdditionHistory(
      record,
      modal.dialog.querySelector('#addition-history')
    );
    loadPaymentHistory(record, modal.dialog.querySelector('#payment-history'));
  }

  function findRow(recordId) {
    return state.rows.find((row) => row.id === recordId) || null;
  }

  function currentContact(contact) {
    return (
      state.contacts.find((item) => item.id === contact?.id) || contact || null
    );
  }

  function recordsForContact(contact) {
    if (!contact) {
      return [];
    }

    const nameKey = contact.name_key || normalizeNameKey(contact.name);

    return state.rows.filter(
      (row) =>
        row.contact_id === contact.id ||
        normalizeNameKey(config.read.person(row)) === nameKey
    );
  }

  function initialAmountOf(record) {
    return Number(
      record.initial_amount === undefined
        ? record.amount
        : record.initial_amount
    );
  }

  function additionsTotalOf(record) {
    return Math.max(
      0,
      Number(config.read.amount(record)) - initialAmountOf(record)
    );
  }

  function recordStatusMarkup(record) {
    const statusMeta = getStatusMeta(config.kind, record.status);
    return `<span class="${statusMeta.className}">${escapeHtml(
      statusMeta.label
    )}</span>`;
  }

  function profileStatsMarkup(records) {
    const totals = records.reduce(
      (summary, record) => {
        const amount = Number(config.read.amount(record)) || 0;
        const paid = Number(config.read.paid(record)) || 0;

        summary.amount += amount;
        summary.additions += additionsTotalOf(record);
        summary.paid += paid;
        summary.remaining += calcRemaining(amount, paid);
        return summary;
      },
      { amount: 0, additions: 0, paid: 0, remaining: 0 }
    );
    const paidPercent =
      totals.amount > 0
        ? Math.round((totals.paid / totals.amount) * 100)
        : 0;
    const remainingClass =
      totals.remaining <= 0
        ? 'amount-positive'
        : config.kind === 'debt'
          ? 'amount-negative'
          : 'amount-info';

    return `
      <div class="profile-stats">
        <div class="profile-stat">
          <span>Total pokok</span>
          <strong>${formatCurrency(totals.amount)}</strong>
        </div>
        <div class="profile-stat">
          <span>Penambahan pokok</span>
          <strong class="amount-info">+${formatCurrency(totals.additions)}</strong>
        </div>
        <div class="profile-stat">
          <span>${escapeHtml(config.labels.paidLabel)}</span>
          <strong class="amount-positive">${formatCurrency(totals.paid)}</strong>
          <small>${paidPercent}% dari pokok</small>
        </div>
        <div class="profile-stat">
          <span>${escapeHtml(config.labels.remainingLabel)}</span>
          <strong class="${remainingClass}">${formatCurrency(totals.remaining)}</strong>
        </div>
      </div>
    `;
  }

  function profileRecordMarkup(record) {
    const amount = Number(config.read.amount(record)) || 0;
    const paid = Number(config.read.paid(record)) || 0;
    const remaining = calcRemaining(amount, paid);
    const additionsTotal = additionsTotalOf(record);
    const remainingClass =
      remaining <= 0
        ? 'amount-positive'
        : config.kind === 'debt'
          ? 'amount-negative'
          : 'amount-info';

    return `
      <article class="profile-record">
        <div class="profile-record-head">
          <div class="profile-record-title">
            <strong>${formatCurrency(amount)}</strong>
            <small>
              Dicatat ${formatDate(record.transaction_date)}
              ${record.due_date ? ` · Jatuh tempo ${formatDate(record.due_date)}` : ''}
            </small>
          </div>
          ${recordStatusMarkup(record)}
        </div>
        ${
          record.description
            ? `<p class="profile-record-note">${escapeHtml(record.description)}</p>`
            : ''
        }
        <div class="profile-record-meta">
          <span>Pokok awal ${formatCurrency(initialAmountOf(record))}</span>
          ${
            additionsTotal > 0
              ? `<span class="amount-info">+${formatCurrency(additionsTotal)} penambahan</span>`
              : ''
          }
          <span>${escapeHtml(config.labels.paidLabel)} ${formatCurrency(paid)}</span>
          <span class="${remainingClass}">Sisa ${formatCurrency(remaining)}</span>
        </div>
        <div class="profile-record-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-profile-action="detail" data-id="${record.id}">
            ${icon('eye')}<span>Detail</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-profile-action="principal" data-id="${record.id}">
            ${icon('plus')}<span>${escapeHtml(config.labels.principalAction)}</span>
          </button>
          ${
            remaining > 0
              ? `<button type="button" class="btn btn-secondary btn-sm" data-profile-action="pay" data-id="${record.id}">
                  ${icon('hand-coins')}<span>${escapeHtml(config.labels.paymentAction)}</span>
                </button>`
              : ''
          }
        </div>
      </article>
    `;
  }

  async function openProfileForRow(row) {
    let contact = contactForRow(row);

    if (!contact) {
      try {
        contact = await resolveContact(state.user.id, {
          contactId: row.contact_id,
          name: config.read.person(row)
        });
        await loadData();
      } catch (error) {
        console.error('Failed to resolve contact:', error);
        showToast(
          getErrorMessage(error, 'Profil orang ini gagal dibuka.'),
          'error'
        );
        return;
      }
    }

    openContactProfile(currentContact(contact) || contact);
  }

  function openContactProfile(contact) {
    if (!contact) {
      return;
    }

    const records = recordsForContact(contact);
    const activeCount = records.filter(
      (record) =>
        Number(config.read.paid(record)) < Number(config.read.amount(record))
    ).length;
    const modal = openModal({
      title: config.labels.profileTitle,
      description: config.labels.profileDescription,
      size: 'lg',
      body: `
        <div class="contact-profile">
          <div class="contact-hero">
            ${avatarMarkup(
              contact,
              contact.name,
              'contact-avatar contact-avatar-lg'
            )}
            <div class="contact-hero-main">
              <h3>${escapeHtml(contact.name)}</h3>
              <p>
                ${records.length} catatan ${escapeHtml(config.entityName)} · ${
                  activeCount > 0
                    ? `${activeCount} aktif`
                    : 'semua sudah lunas'
                }
              </p>
              <div class="contact-photo-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-profile-photo>
                  ${icon('camera')}<span>${escapeHtml(config.labels.photoAction)}</span>
                </button>
                ${
                  contact.photo
                    ? `<button type="button" class="btn btn-secondary btn-sm" data-profile-remove-photo>
                        ${icon('trash-2')}<span>${escapeHtml(config.labels.photoRemoveAction)}</span>
                      </button>`
                    : ''
                }
              </div>
              <input type="file" accept="image/*" data-profile-photo-input hidden>
            </div>
          </div>

          ${profileStatsMarkup(records)}

          <div class="detail-section">
            <h3>
              <span>${escapeHtml(config.labels.profileHistoryTitle)}</span>
              <span class="badge badge-purple">${records.length} catatan</span>
            </h3>
            ${
              records.length > 0
                ? `<div class="profile-record-list">${records
                    .map(profileRecordMarkup)
                    .join('')}</div>`
                : `<div class="inline-empty">Belum ada ${escapeHtml(
                    config.entityName
                  )} untuk orang ini.</div>`
            }
          </div>

          <div class="detail-section">
            <h3>
              <span>${escapeHtml(config.labels.profileAdditionTitle)}</span>
            </h3>
            <div id="profile-addition-history">
              <div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-close>Tutup</button>
        <button type="button" class="btn btn-secondary" data-profile-add-record>
          ${icon('file-plus')}<span>${escapeHtml(config.labels.profileAddAction)}</span>
        </button>
        <button type="button" class="btn btn-primary" data-profile-add-principal ${records.length ? '' : 'disabled'}>
          ${icon('plus')}<span>${escapeHtml(config.labels.principalAction)}</span>
        </button>
      `
    });

    const photoButton = modal.dialog.querySelector('[data-profile-photo]');
    const photoInput = modal.dialog.querySelector('[data-profile-photo-input]');

    modal.dialog
      .querySelector('[data-modal-close]')
      ?.addEventListener('click', () => modal.close());

    photoButton?.addEventListener('click', () => photoInput?.click());

    photoInput?.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      photoInput.value = '';

      if (file) {
        handlePhotoUpload(modal, contact, file, photoButton);
      }
    });

    modal.dialog
      .querySelector('[data-profile-remove-photo]')
      ?.addEventListener('click', () =>
        handlePhotoRemove(modal, contact)
      );

    modal.dialog
      .querySelector('[data-profile-add-record]')
      ?.addEventListener('click', () => {
        modal.close();
        openForm(null, {
          contact: currentContact(contact),
          onSaved: async () => {
            openContactProfile(currentContact(contact));
          }
        });
      });

    modal.dialog
      .querySelector('[data-profile-add-principal]')
      ?.addEventListener('click', () => {
        modal.close();
        openPrincipalForm(null, {
          contact: currentContact(contact),
          records: recordsForContact(currentContact(contact)),
          onSaved: async () => {
            openContactProfile(currentContact(contact));
          }
        });
      });

    modal.dialog.addEventListener('click', (event) => {
      const action = event.target.closest('[data-profile-action]');

      if (!action) {
        return;
      }

      const record = findRow(action.dataset.id);

      if (!record) {
        return;
      }

      if (action.dataset.profileAction === 'detail') {
        modal.close();
        openDetail(record);
        return;
      }

      if (action.dataset.profileAction === 'principal') {
        modal.close();
        openPrincipalForm(record, {
          onSaved: async () => {
            openContactProfile(currentContact(contact));
          }
        });
        return;
      }

      if (action.dataset.profileAction === 'pay') {
        modal.close();
        openPayment(record, {
          onSaved: async () => {
            openContactProfile(currentContact(contact));
          }
        });
      }
    });

    loadProfileAdditionHistory(
      records,
      modal.dialog.querySelector('#profile-addition-history')
    );
  }

  async function loadProfileAdditionHistory(records, container) {
    if (!container) {
      return;
    }

    try {
      const groups = await Promise.all(
        records.map(async (record) => {
          const additions = await config.services.listAdditions(
            state.user.id,
            record.id
          );

          return additions.map((addition) => ({ ...addition, record }));
        })
      );
      const additions = [].concat(...groups).sort(
        (first, second) =>
          String(second.addition_date || '').localeCompare(
            String(first.addition_date || '')
          ) ||
          String(second.created_at || '').localeCompare(
            String(first.created_at || '')
          )
      );

      if (additions.length === 0) {
        container.innerHTML = `<div class="inline-empty">${escapeHtml(
          config.labels.profileAdditionEmpty
        )}</div>`;
        return;
      }

      container.innerHTML = `
        <div class="profile-timeline">
          ${additions
            .map(
              (addition) => `
                <div class="profile-timeline-item">
                  <span class="profile-timeline-icon">${icon('plus')}</span>
                  <div class="profile-timeline-main">
                    <strong>${formatDate(addition.addition_date)}</strong>
                    <small>
                      ${escapeHtml(addition.description || 'Tanpa catatan')}
                      · Catatan ${formatDate(addition.record.transaction_date)}
                    </small>
                  </div>
                  <span class="mini-list-amount ${
                    config.kind === 'debt' ? 'amount-inflow' : 'amount-outflow'
                  }">+${formatCurrency(addition.amount)}</span>
                </div>
              `
            )
            .join('')}
        </div>
      `;
      refreshIcons();
    } catch (error) {
      console.error('Failed to load profile additions:', error);
      container.innerHTML = errorState({
        message: getErrorMessage(error, 'Riwayat penambahan gagal dimuat.'),
        retryLabel: 'Coba lagi'
      });
      container.querySelector('.state-retry')?.addEventListener('click', () => {
        container.innerHTML =
          '<div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>';
        loadProfileAdditionHistory(records, container);
      });
      refreshIcons();
    }
  }

  async function handlePhotoUpload(modal, contact, file, triggerButton) {
    setButtonLoading(triggerButton, true, 'Memproses...');

    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const updated = await setContactPhoto(
        state.user.id,
        contact.id,
        dataUrl
      );

      modal.close();
      showToast('Foto profil berhasil diperbarui.', 'success');
      await loadData();
      openContactProfile(currentContact(updated));
    } catch (error) {
      console.error('Failed to save contact photo:', error);
      setButtonLoading(triggerButton, false);
      showToast(getErrorMessage(error, 'Foto profil gagal disimpan.'), 'error');
    }
  }

  async function handlePhotoRemove(modal, contact) {
    const confirmed = await confirmDialog({
      title: 'Hapus foto profil?',
      message: `Foto ${contact.name} akan dihapus dari perangkat. Riwayat tetap tersimpan.`,
      confirmLabel: 'Hapus Foto',
      cancelLabel: 'Batal',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    try {
      const updated = await removeContactPhoto(state.user.id, contact.id);

      modal.close();
      showToast('Foto profil berhasil dihapus.', 'success');
      await loadData();
      openContactProfile(currentContact(updated));
    } catch (error) {
      console.error('Failed to remove contact photo:', error);
      showToast(
        getErrorMessage(error, 'Foto profil gagal dihapus.'),
        'error'
      );
    }
  }

  function openPrincipalForm(record = null, options = {}) {
    const contact =
      options.contact || (record ? contactForRow(record) : null);
    const records = record
      ? [record]
      : Array.isArray(options.records)
        ? options.records
        : recordsForContact(contact);

    if (records.length === 0) {
      showToast(
        `Belum ada ${config.entityName} yang bisa ditambahkan pokoknya.`,
        'info'
      );
      return;
    }

    const selected = record || records[0];
    const multiple = records.length > 1;
    const modal = openModal({
      title: config.labels.principalTitle,
      description: config.labels.principalDescription,
      size: 'sm',
      body: `
        <form id="principal-form" class="form-grid" novalidate>
          ${
            multiple
              ? `
                <div class="form-field form-field-full">
                  <label for="principal-record">Pilih catatan ${escapeHtml(
                    config.entityName
                  )}</label>
                  <select class="input" id="principal-record" name="recordId">
                    ${records
                      .map(
                        (item) => `
                          <option value="${item.id}" ${item.id === selected.id ? 'selected' : ''}>
                            ${escapeHtml(formatDate(item.transaction_date))} · ${formatCurrency(
                              config.read.amount(item)
                            )} · sisa ${formatCurrency(
                              calcRemaining(
                                config.read.amount(item),
                                config.read.paid(item)
                              )
                            )}
                          </option>
                        `
                      )
                      .join('')}
                  </select>
                </div>
              `
              : `
                <div class="principal-target">
                  <div>
                    <span>Catatan</span>
                    <strong>${formatDate(selected.transaction_date)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    ${recordStatusMarkup(selected)}
                  </div>
                </div>
              `
          }

          <div class="form-field form-field-full">
            <label for="principal-amount">Nominal penambahan</label>
            <div class="input-wrap has-prefix">
              <span class="input-prefix">Rp</span>
              <input class="input" id="principal-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="0" autofocus required>
            </div>
          </div>

          <div class="principal-preview">
            <div>
              <span>Pokok saat ini</span>
              <strong data-principal-current>${formatCurrency(
                config.read.amount(selected)
              )}</strong>
            </div>
            <div>
              <span>Setelah penambahan</span>
              <strong data-principal-next>${formatCurrency(
                config.read.amount(selected)
              )}</strong>
            </div>
          </div>

          <div class="form-field form-field-full">
            <label for="principal-date">Tanggal penambahan</label>
            <input class="input" id="principal-date" name="additionDate" type="date" value="${todayISO()}" required>
          </div>

          <div class="form-field form-field-full">
            <label for="principal-description">Catatan <span class="muted">(opsional)</span></label>
            <textarea class="textarea" id="principal-description" name="description" maxlength="500" placeholder="Contoh: tambahan pinjaman untuk kebutuhan mendesak"></textarea>
          </div>

          <p class="field-hint" data-principal-hint></p>
          <div class="form-error" data-form-error hidden></div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-secondary" data-modal-cancel>Batal</button>
        <button type="submit" form="principal-form" class="btn btn-primary">
          ${icon('plus')}<span>${escapeHtml(config.labels.principalAction)}</span>
        </button>
      `
    });

    const form = modal.dialog.querySelector('#principal-form');
    const submitButton = modal.dialog.querySelector('[type="submit"]');
    const recordSelect = form.elements.recordId;
    const amountInput = form.elements.amount;
    const currentLabel = modal.dialog.querySelector('[data-principal-current]');
    const nextLabel = modal.dialog.querySelector('[data-principal-next]');
    const hint = modal.dialog.querySelector('[data-principal-hint]');

    const targetRecord = () => {
      if (!multiple) {
        return selected;
      }

      return (
        records.find((item) => item.id === recordSelect?.value) || records[0]
      );
    };

    const updatePreview = () => {
      const target = targetRecord();
      const current = Number(config.read.amount(target)) || 0;
      const parsed = Number(amountInput.value);
      const next =
        current + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
      const remaining = calcRemaining(
        current,
        config.read.paid(target)
      );

      currentLabel.textContent = formatCurrency(current);
      nextLabel.textContent = formatCurrency(next);
      hint.textContent =
        `Sisa saat ini ${formatCurrency(remaining)}.` +
        (target.status === 'paid'
          ? ' Catatan ini sudah lunas dan akan aktif kembali setelah pokok ditambahkan.'
          : '');
    };

    recordSelect?.addEventListener('change', updatePreview);
    amountInput.addEventListener('input', updatePreview);
    updatePreview();

    modal.dialog
      .querySelector('[data-modal-cancel]')
      ?.addEventListener('click', () => modal.close());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFormErrors(form);

      const target = targetRecord();
      const amountResult = validateAmount(amountInput.value, {
        label: 'Nominal penambahan'
      });
      const dateInput = form.elements.additionDate;
      const description = form.elements.description.value.trim();

      if (!amountResult.valid) {
        showFieldError(amountInput, amountResult.message);
        return;
      }

      if (!dateInput.value) {
        showFieldError(dateInput, 'Tanggal penambahan wajib diisi.');
        return;
      }

      if (description.length > 500) {
        showFieldError(
          form.elements.description,
          'Catatan maksimal 500 karakter.'
        );
        return;
      }

      setButtonLoading(submitButton, true, 'Menyimpan...');

      try {
        await config.services.addPrincipal(state.user.id, target.id, {
          amount: amountResult.value,
          additionDate: dateInput.value,
          description
        });

        modal.close();
        showToast(
          `${config.labels.principalAction} berhasil dicatat.`,
          'success'
        );
        await loadData();

        if (typeof options.onSaved === 'function') {
          await options.onSaved();
        }
      } catch (error) {
        console.error('Failed to add principal:', error);
        setButtonLoading(submitButton, false);
        showFormError(
          form,
          getErrorMessage(error, 'Penambahan pokok gagal disimpan.')
        );
      }
    });
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

  async function loadAdditionHistory(record, container) {
    if (!container) {
      return;
    }

    try {
      const additions = await config.services.listAdditions(
        state.user.id,
        record.id
      );

      if (additions.length === 0) {
        container.innerHTML = `<div class="inline-empty">${escapeHtml(
          config.labels.additionHistoryEmpty
        )}</div>`;
        return;
      }

      container.innerHTML = `
        <div class="mini-list">
          ${additions
            .map(
              (addition) => `
                <div class="mini-list-item">
                  <div class="mini-list-main">
                    <strong>${formatDate(addition.addition_date)}</strong>
                    <small>${escapeHtml(
                      addition.description || 'Tanpa catatan'
                    )}</small>
                  </div>
                  <span class="mini-list-amount ${
                    config.kind === 'debt' ? 'amount-inflow' : 'amount-outflow'
                  }">+${formatCurrency(addition.amount)}</span>
                </div>
              `
            )
            .join('')}
        </div>
      `;
    } catch (error) {
      console.error('Failed to load principal additions:', error);
      container.innerHTML = errorState({
        message: getErrorMessage(error, 'Riwayat penambahan gagal dimuat.'),
        retryLabel: 'Coba lagi'
      });
      container.querySelector('.state-retry')?.addEventListener('click', () => {
        container.innerHTML =
          '<div class="inline-loader"><span class="spinner" aria-hidden="true"></span> Memuat riwayat...</div>';
        loadAdditionHistory(record, container);
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
