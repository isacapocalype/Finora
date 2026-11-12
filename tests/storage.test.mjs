import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

const db = await import('../assets/js/storage/db.js');
const { createId } = await import('../assets/js/storage/id.js');
const { LOCAL_USER_ID } = await import('../assets/js/local.js');
const profileService = await import('../assets/js/services/profile.service.js');
const debtService = await import('../assets/js/services/debt.service.js');
const receivableService = await import(
  '../assets/js/services/receivable.service.js'
);
const savingsService = await import('../assets/js/services/savings.service.js');
const historyService = await import('../assets/js/services/history.service.js');
const dashboardService = await import(
  '../assets/js/services/dashboard.service.js'
);

beforeEach(async () => {
  await db.clearAllData();
});

test('createId menghasilkan UUID v4', () => {
  assert.match(
    createId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('profil lokal dibuat sekali dan dapat diperbarui', async () => {
  const created = await profileService.getOrCreateProfile({
    id: LOCAL_USER_ID
  });

  assert.equal(created.id, LOCAL_USER_ID);
  assert.equal(created.full_name, 'Pengguna Finora');
  assert.equal(created.currency, 'IDR');

  const again = await profileService.getOrCreateProfile({
    id: LOCAL_USER_ID
  });

  assert.equal(again.created_at, created.created_at);

  const updated = await profileService.updateProfile(LOCAL_USER_ID, {
    fullName: 'Budi Santoso'
  });

  assert.equal(updated.full_name, 'Budi Santoso');
  assert.equal(
    (await profileService.getProfile(LOCAL_USER_ID)).full_name,
    'Budi Santoso'
  );
});

test('utang: buat, bayar, validasi sisa, dan hapus beserta riwayat', async () => {
  const created = await debtService.createDebt(LOCAL_USER_ID, {
    lenderName: 'Budi',
    amount: 100000,
    transactionDate: '2026-01-01',
    dueDate: '2026-02-01',
    description: 'Pinjaman modal'
  });

  assert.equal(created.paid_amount, 0);
  assert.equal(created.status, 'unpaid');
  assert.equal((await debtService.listDebts(LOCAL_USER_ID)).length, 1);

  await debtService.recordDebtPayment({
    userId: LOCAL_USER_ID,
    debtId: created.id,
    amount: 40000,
    paymentDate: '2026-01-15'
  });

  let debt = (await debtService.listDebts(LOCAL_USER_ID))[0];
  assert.equal(debt.paid_amount, 40000);
  assert.equal(debt.status, 'partial');
  assert.equal(
    (await debtService.listDebtPayments(LOCAL_USER_ID, created.id)).length,
    1
  );

  await assert.rejects(
    debtService.recordDebtPayment({
      userId: LOCAL_USER_ID,
      debtId: created.id,
      amount: 70000,
      paymentDate: '2026-01-16'
    }),
    /melebihi sisa utang/
  );

  await debtService.recordDebtPayment({
    userId: LOCAL_USER_ID,
    debtId: created.id,
    amount: 60000,
    paymentDate: '2026-01-17'
  });

  debt = (await debtService.listDebts(LOCAL_USER_ID))[0];
  assert.equal(debt.paid_amount, 100000);
  assert.equal(debt.status, 'paid');

  await assert.rejects(
    debtService.recordDebtPayment({
      userId: LOCAL_USER_ID,
      debtId: created.id,
      amount: 1000,
      paymentDate: '2026-01-18'
    }),
    /sudah lunas/
  );

  await assert.rejects(
    debtService.updateDebt(LOCAL_USER_ID, created.id, {
      lenderName: 'Budi',
      amount: 50000,
      transactionDate: '2026-01-01'
    }),
    /lebih kecil dari total pembayaran/
  );

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    pageSize: 10
  });

  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    ['debt_created', 'debt_payment', 'debt_payment']
  );

  await debtService.deleteDebt(LOCAL_USER_ID, created.id);

  assert.deepEqual(await debtService.listDebts(LOCAL_USER_ID), []);
  assert.deepEqual(
    await debtService.listDebtPayments(LOCAL_USER_ID, created.id),
    []
  );
  assert.equal(
    (await historyService.listHistory({ userId: LOCAL_USER_ID })).count,
    0
  );
});

test('piutang: pengembalian memperbarui status dan riwayat', async () => {
  const created = await receivableService.createReceivable(LOCAL_USER_ID, {
    borrowerName: 'Siti',
    amount: 50000,
    transactionDate: '2026-02-01'
  });

  await receivableService.recordReceivablePayment({
    userId: LOCAL_USER_ID,
    receivableId: created.id,
    amount: 20000,
    paymentDate: '2026-02-10'
  });

  const receivable = (
    await receivableService.listReceivables(LOCAL_USER_ID)
  )[0];

  assert.equal(receivable.received_amount, 20000);
  assert.equal(receivable.status, 'partial');

  await assert.rejects(
    receivableService.recordReceivablePayment({
      userId: LOCAL_USER_ID,
      receivableId: created.id,
      amount: 40000,
      paymentDate: '2026-02-11'
    }),
    /melebihi sisa piutang/
  );

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'receivables'
  });

  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    ['receivable_created', 'receivable_payment']
  );
});

test('tabungan: setor, tarik, validasi saldo, dan hapus transaksi', async () => {
  const created = await savingsService.createSavings(LOCAL_USER_ID, {
    name: 'Dana Darurat',
    targetAmount: 1000000,
    startDate: '2026-01-01',
    targetDate: '2026-12-31'
  });

  assert.equal(created.current_amount, 0);

  await savingsService.recordSavingsTransaction({
    userId: LOCAL_USER_ID,
    savingsId: created.id,
    type: 'deposit',
    amount: 200000,
    transactionDate: '2026-01-02'
  });

  await savingsService.recordSavingsTransaction({
    userId: LOCAL_USER_ID,
    savingsId: created.id,
    type: 'withdrawal',
    amount: 50000,
    transactionDate: '2026-01-03'
  });

  let item = (await savingsService.listSavings(LOCAL_USER_ID))[0];
  assert.equal(item.current_amount, 150000);

  await assert.rejects(
    savingsService.recordSavingsTransaction({
      userId: LOCAL_USER_ID,
      savingsId: created.id,
      type: 'withdrawal',
      amount: 999999,
      transactionDate: '2026-01-04'
    }),
    /Saldo tabungan tidak mencukupi/
  );

  const transactions = await savingsService.listSavingsTransactions(
    LOCAL_USER_ID,
    created.id
  );
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].type, 'withdrawal');

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'savings'
  });
  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    ['savings_deposit', 'savings_withdrawal']
  );

  await savingsService.deleteSavings(LOCAL_USER_ID, created.id);

  assert.deepEqual(await savingsService.listSavings(LOCAL_USER_ID), []);
  assert.equal(
    (
      await historyService.listHistory({
        userId: LOCAL_USER_ID,
        group: 'savings'
      })
    ).count,
    0
  );
});

test('riwayat mendukung filter grup, pencarian, urutan, dan pagination', async () => {
  await debtService.createDebt(LOCAL_USER_ID, {
    lenderName: 'Budi',
    amount: 100000,
    transactionDate: '2026-01-01',
    description: 'Modal usaha'
  });
  await receivableService.createReceivable(LOCAL_USER_ID, {
    borrowerName: 'Siti',
    amount: 50000,
    transactionDate: '2026-02-01',
    description: 'Pinjaman laptop'
  });
  const savingsGoal = await savingsService.createSavings(LOCAL_USER_ID, {
    name: 'Liburan',
    targetAmount: 500000,
    startDate: '2026-01-01'
  });
  await savingsService.recordSavingsTransaction({
    userId: LOCAL_USER_ID,
    savingsId: savingsGoal.id,
    type: 'deposit',
    amount: 100000,
    transactionDate: '2026-01-15'
  });

  const bySearch = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    search: 'Budi'
  });
  assert.equal(bySearch.count, 1);
  assert.equal(bySearch.rows[0].title, 'Utang kepada Budi');

  const byGroup = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'receivables'
  });
  assert.equal(byGroup.count, 1);
  assert.equal(byGroup.rows[0].category, 'receivable_created');

  const oldest = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    sort: 'oldest'
  });
  assert.equal(oldest.rows[0].transaction_date, '2026-01-01');
  assert.equal(
    oldest.rows[oldest.rows.length - 1].transaction_date,
    '2026-02-01'
  );

  const paged = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    pageSize: 2,
    page: 2
  });
  assert.equal(paged.count, 3);
  assert.equal(paged.totalPages, 2);
  assert.equal(paged.rows.length, 1);

  const recent = await historyService.listRecentHistory(LOCAL_USER_ID, 2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].transaction_date, '2026-02-01');
});

test('dashboard menghitung ringkasan dari penyimpanan lokal', async () => {
  const debt = await debtService.createDebt(LOCAL_USER_ID, {
    lenderName: 'Budi',
    amount: 100000,
    transactionDate: '2026-01-01'
  });
  await debtService.recordDebtPayment({
    userId: LOCAL_USER_ID,
    debtId: debt.id,
    amount: 40000,
    paymentDate: '2026-01-10'
  });

  const receivable = await receivableService.createReceivable(LOCAL_USER_ID, {
    borrowerName: 'Siti',
    amount: 50000,
    transactionDate: '2026-01-02'
  });
  await receivableService.recordReceivablePayment({
    userId: LOCAL_USER_ID,
    receivableId: receivable.id,
    amount: 10000,
    paymentDate: '2026-01-11'
  });

  const savings = await savingsService.createSavings(LOCAL_USER_ID, {
    name: 'Dana Darurat',
    targetAmount: 1000000,
    startDate: '2026-01-01'
  });
  await savingsService.recordSavingsTransaction({
    userId: LOCAL_USER_ID,
    savingsId: savings.id,
    type: 'deposit',
    amount: 30000,
    transactionDate: '2026-01-03'
  });

  const dashboard = await dashboardService.loadDashboardData(LOCAL_USER_ID);

  assert.equal(dashboard.summary.totalDebt, 60000);
  assert.equal(dashboard.summary.totalReceivable, 40000);
  assert.equal(dashboard.summary.totalSavings, 30000);
  assert.equal(dashboard.summary.totalTarget, 1000000);
  assert.equal(dashboard.summary.activeDebtCount, 1);
  assert.equal(dashboard.recent.length, 5);
  assert.equal(dashboard.recent[0].transaction_date, '2026-01-11');
});
