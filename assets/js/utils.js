const currencyFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const DEBT_STATUS_META = {
  unpaid: { label: 'Belum dibayar', className: 'badge badge-danger' },
  partial: { label: 'Dibayar sebagian', className: 'badge badge-warning' },
  paid: { label: 'Lunas', className: 'badge badge-success' }
};

const RECEIVABLE_STATUS_META = {
  unpaid: { label: 'Belum dikembalikan', className: 'badge badge-danger' },
  partial: { label: 'Dikembalikan sebagian', className: 'badge badge-warning' },
  paid: { label: 'Lunas', className: 'badge badge-success' }
};

const HISTORY_CATEGORY_META = {
  debt_created: {
    label: 'Utang baru',
    icon: 'arrow-down-left',
    badgeClass: 'badge badge-purple',
    amountClass: 'amount-inflow'
  },
  debt_payment: {
    label: 'Pembayaran utang',
    icon: 'hand-coins',
    badgeClass: 'badge badge-danger',
    amountClass: 'amount-outflow'
  },
  receivable_created: {
    label: 'Piutang baru',
    icon: 'arrow-up-right',
    badgeClass: 'badge badge-info',
    amountClass: 'amount-outflow'
  },
  receivable_payment: {
    label: 'Pengembalian piutang',
    icon: 'hand-coins',
    badgeClass: 'badge badge-success',
    amountClass: 'amount-inflow'
  },
  savings_deposit: {
    label: 'Setoran tabungan',
    icon: 'piggy-bank',
    badgeClass: 'badge badge-purple',
    amountClass: 'amount-neutral'
  },
  savings_withdrawal: {
    label: 'Penarikan tabungan',
    icon: 'banknote',
    badgeClass: 'badge badge-warning',
    amountClass: 'amount-neutral'
  }
};

export const HISTORY_GROUPS = {
  debts: ['debt_created', 'debt_payment'],
  receivables: ['receivable_created', 'receivable_payment'],
  savings: ['savings_deposit', 'savings_withdrawal']
};

export function formatCurrency(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'Rp0';
  }

  const sign = numericValue < 0 ? '−' : '';
  return `${sign}Rp${currencyFormatter.format(Math.abs(numericValue))}`;
}

export function formatSignedCurrency(value, direction) {
  const prefix = direction === '+' ? '+' : direction === '-' ? '−' : '';
  return `${prefix}${formatCurrency(value)}`;
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : '-';
}

export function formatLongDate(value = new Date()) {
  const date = parseDate(value);
  return date ? longDateFormatter.format(date) : '-';
}

export function formatDateTime(value) {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : '-';
}

export function toLocalISODate(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function todayISO() {
  return toLocalISODate(new Date());
}

export function parseDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysUntil(value) {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.round((date.getTime() - start.getTime()) / 86400000);
}

export function getDueMeta(dueDate, status) {
  if (!dueDate || status === 'paid') {
    return null;
  }

  const remainingDays = daysUntil(dueDate);

  if (remainingDays === null || remainingDays > 7) {
    return null;
  }

  if (remainingDays < 0) {
    return { label: 'Terlambat', className: 'badge badge-danger' };
  }

  if (remainingDays === 0) {
    return { label: 'Jatuh tempo hari ini', className: 'badge badge-warning' };
  }

  return {
    label: `Jatuh tempo ${remainingDays} hari lagi`,
    className: 'badge badge-warning'
  };
}

export function getStatusMeta(kind, status) {
  const map =
    kind === 'receivable' ? RECEIVABLE_STATUS_META : DEBT_STATUS_META;

  return map[status] || { label: status || '-', className: 'badge' };
}

export function getCategoryMeta(category) {
  return (
    HISTORY_CATEGORY_META[category] || {
      label: 'Transaksi',
      icon: 'circle-dot',
      badgeClass: 'badge',
      amountClass: 'amount-neutral'
    }
  );
}

export function getHistoryGroup(category) {
  if (HISTORY_GROUPS.debts.includes(category)) {
    return 'debts';
  }

  if (HISTORY_GROUPS.receivables.includes(category)) {
    return 'receivables';
  }

  if (HISTORY_GROUPS.savings.includes(category)) {
    return 'savings';
  }

  return 'all';
}

export function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (value === null || value === undefined) {
    return NaN;
  }

  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');

  if (normalized === '') {
    return NaN;
  }

  return Number(normalized);
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function validateAmount(
  value,
  { label = 'Nominal', min = 0.01, max = 9999999999999.99 } = {}
) {
  const parsed = parseNumber(value);

  if (!Number.isFinite(parsed)) {
    return { valid: false, value: 0, message: `${label} wajib diisi dengan angka.` };
  }

  const cents = Math.round(parsed * 100);

  if (Math.abs(parsed * 100 - cents) > 0.000001) {
    return {
      valid: false,
      value: parsed,
      message: `${label} maksimal memiliki 2 angka desimal.`
    };
  }

  const normalized = cents / 100;

  if (normalized < min) {
    return {
      valid: false,
      value: normalized,
      message: `${label} harus lebih besar dari nol.`
    };
  }

  if (normalized > max) {
    return {
      valid: false,
      value: normalized,
      message: `${label} terlalu besar.`
    };
  }

  return { valid: true, value: normalized, message: '' };
}

export function calcRemaining(amount, paidAmount) {
  return Math.max(0, roundMoney(Number(amount) - Number(paidAmount)));
}

export function calcProgress(current, target) {
  const currentValue = Number(current);
  const targetValue = Number(target);

  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
}

export function calcProgressRaw(current, target) {
  const currentValue = Number(current);
  const targetValue = Number(target);

  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return 0;
  }

  return Math.max(0, (currentValue / targetValue) * 100);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return entities[character];
  });
}

export function getInitials(name) {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    return 'FN';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0]}${parts[parts.length - 1][0]}`;

  return initials.toUpperCase();
}

export function getFirstName(name, fallback = 'Pengguna') {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.split(/\s+/)[0];
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 11) {
    return 'Selamat pagi';
  }

  if (hour < 15) {
    return 'Selamat siang';
  }

  if (hour < 19) {
    return 'Selamat sore';
  }

  return 'Selamat malam';
}

export function debounce(callback, delay = 300) {
  let timerId = null;

  return (...args) => {
    globalThis.clearTimeout(timerId);
    timerId = globalThis.setTimeout(() => callback(...args), delay);
  };
}

export function getErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const message = String(error?.message || '').trim();

  if (!message) {
    return fallback;
  }

  if (/quota|storage/i.test(message) && /full|penuh|exceed/i.test(message)) {
    return 'Penyimpanan perangkat penuh. Hapus data lain atau kosongkan ruang, lalu coba lagi.';
  }

  return message;
}

export function isFutureDate(value) {
  const date = parseDate(value);

  if (!date) {
    return false;
  }

  const today = parseDate(todayISO());
  return date.getTime() > today.getTime();
}
