import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcProgress,
  calcProgressRaw,
  calcRemaining,
  escapeHtml,
  formatCurrency,
  formatSignedCurrency,
  getCategoryMeta,
  getFirstName,
  getInitials,
  getStatusMeta,
  greetingForHour,
  parseDate,
  parseNumber,
  roundMoney,
  toLocalISODate,
  todayISO,
  validateAmount
} from '../assets/js/utils.js';

test('formatCurrency memakai format Rupiah', () => {
  const formatted = formatCurrency(1500000);

  assert.match(formatted, /^Rp/);
  assert.match(formatted, /1\.500\.000/);
  assert.equal(formatCurrency('bukan angka'), 'Rp0');
  assert.equal(formatCurrency(null), 'Rp0');
  assert.equal(formatCurrency(-1500), '−Rp1.500');
});

test('formatSignedCurrency menambahkan tanda sesuai arah', () => {
  assert.ok(formatSignedCurrency(1000, '+').startsWith('+'));
  assert.ok(formatSignedCurrency(1000, '-').startsWith('−'));
  assert.ok(formatSignedCurrency(1000, '').startsWith('Rp'));
});

test('calcRemaining tidak pernah negatif dan menjaga presisi', () => {
  assert.equal(calcRemaining(1000, 300), 700);
  assert.equal(calcRemaining(1000, 1000), 0);
  assert.equal(calcRemaining(1000, 1200), 0);
  assert.equal(calcRemaining(0.1 + 0.2, 0.1), 0.2);
});

test('calcProgress membatasi visual 0-100 dan raw tetap akurat', () => {
  assert.equal(calcProgress(250, 1000), 25);
  assert.equal(calcProgress(1500, 1000), 100);
  assert.equal(calcProgress(-100, 1000), 0);
  assert.equal(calcProgress(100, 0), 0);
  assert.equal(calcProgressRaw(1500, 1000), 150);
  assert.equal(calcProgressRaw(100, 0), 0);
});

test('parseNumber menerima angka dan koma desimal', () => {
  assert.equal(parseNumber('1250.5'), 1250.5);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber(' 1000 '), 1000);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
});

test('validateAmount menolak nol, desimal berlebih, dan nilai terlalu besar', () => {
  assert.equal(validateAmount('1000').valid, true);
  assert.equal(validateAmount('1000.55').value, 1000.55);
  assert.equal(validateAmount('0').valid, false);
  assert.equal(validateAmount('-5').valid, false);
  assert.equal(validateAmount('10.555').valid, false);
  assert.equal(validateAmount('999999999999999').valid, false);
  assert.equal(validateAmount('abc').valid, false);
});

test('roundMoney membulatkan dua angka desimal', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(1000), 1000);
});

test('parseDate menangani tanggal lokal dan nilai tidak valid', () => {
  const date = parseDate('2026-11-06');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 6);
  assert.equal(parseDate(''), null);
  assert.equal(parseDate('bukan tanggal'), null);
});

test('toLocalISODate dan todayISO menghasilkan format YYYY-MM-DD', () => {
  assert.match(toLocalISODate(new Date(2026, 0, 5)), /^2026-01-05$/);
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('escapeHtml mengamankan karakter HTML', () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script>`),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
  );
  assert.equal(escapeHtml(null), '');
});

test('getInitials dan getFirstName bekerja untuk nama kosong dan lengkap', () => {
  assert.equal(getInitials('Ani Wijaya'), 'AW');
  assert.equal(getInitials('Ani'), 'AN');
  assert.equal(getInitials(''), 'FN');
  assert.equal(getFirstName('Ani Wijaya'), 'Ani');
  assert.equal(getFirstName(''), 'Pengguna');
});

test('greetingForHour memakai sapaan yang sesuai', () => {
  assert.equal(greetingForHour(8), 'Selamat pagi');
  assert.equal(greetingForHour(12), 'Selamat siang');
  assert.equal(greetingForHour(17), 'Selamat sore');
  assert.equal(greetingForHour(21), 'Selamat malam');
});

test('metadata status dan kategori konsisten', () => {
  assert.equal(getStatusMeta('debt', 'paid').label, 'Lunas');
  assert.equal(getStatusMeta('receivable', 'partial').label, 'Dikembalikan sebagian');
  assert.equal(getCategoryMeta('debt_payment').label, 'Pembayaran utang');
  assert.equal(getCategoryMeta('unknown').label, 'Transaksi');
});
