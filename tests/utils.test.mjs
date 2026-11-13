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
  getHistoryGroup,
  getInitials,
  getStatusMeta,
  getWalletCategoryMeta,
  getWalletColorMeta,
  getWalletTypeMeta,
  greetingForHour,
  isSameMonth,
  normalizeNameKey,
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

test('normalizeNameKey menyamakan nama untuk pencocokan kontak', () => {
  assert.equal(normalizeNameKey('  Budi   Santoso '), 'budi santoso');
  assert.equal(normalizeNameKey('BUDI SANTOSO'), 'budi santoso');
  assert.equal(normalizeNameKey(''), '');
});

test('metadata status dan kategori konsisten', () => {
  assert.equal(getStatusMeta('debt', 'paid').label, 'Lunas');
  assert.equal(getStatusMeta('receivable', 'partial').label, 'Dikembalikan sebagian');
  assert.equal(getCategoryMeta('debt_payment').label, 'Pembayaran utang');
  assert.equal(getCategoryMeta('debt_addition').label, 'Penambahan utang');
  assert.equal(getCategoryMeta('receivable_addition').label, 'Penambahan piutang');
  assert.equal(getCategoryMeta('unknown').label, 'Transaksi');
});

test('metadata dompet dan pengelompokan riwayat konsisten', () => {
  assert.equal(getWalletTypeMeta('cash').label, 'Tunai');
  assert.equal(getWalletTypeMeta('bank').icon, 'landmark');
  assert.equal(getWalletTypeMeta('unknown').value, 'other');
  assert.equal(getWalletColorMeta('blue').value, 'blue');
  assert.equal(getWalletColorMeta('unknown').value, 'violet');
  assert.equal(getWalletCategoryMeta('salary').label, 'Gaji');
  assert.equal(getWalletCategoryMeta('food').label, 'Makan');
  assert.equal(getWalletCategoryMeta('unknown').label, 'Lainnya');
  assert.equal(getCategoryMeta('wallet_income').label, 'Pemasukan dompet');
  assert.equal(getCategoryMeta('wallet_transfer').label, 'Transfer dompet');
  assert.equal(getHistoryGroup('wallet_income'), 'wallets');
  assert.equal(getHistoryGroup('wallet_expense'), 'wallets');
  assert.equal(getHistoryGroup('wallet_transfer'), 'wallets');
  assert.equal(getHistoryGroup('debt_created'), 'debts');
  assert.equal(getHistoryGroup('unknown'), 'all');
});

test('isSameMonth membandingkan bulan transaksi dengan aman', () => {
  assert.equal(isSameMonth('2026-11-05', '2026-11-20'), true);
  assert.equal(isSameMonth('2026-10-31', '2026-11-01'), false);
  assert.equal(isSameMonth('', '2026-11-01'), false);
  assert.equal(isSameMonth('bukan tanggal', new Date(2026, 10, 2)), false);
});
