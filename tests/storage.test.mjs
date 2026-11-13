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
const walletService = await import('../assets/js/services/wallet.service.js');
const contactService = await import('../assets/js/services/contact.service.js');
const historyService = await import('../assets/js/services/history.service.js');
const dashboardService = await import(
  '../assets/js/services/dashboard.service.js'
);
const { validateImageFile } = await import('../assets/js/photo.js');

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

test('kontak menyatukan orang yang sama dan menyimpan foto profil', async () => {
  const debt = await debtService.createDebt(LOCAL_USER_ID, {
    lenderName: '  Budi   Santoso ',
    amount: 100000,
    transactionDate: '2026-01-01'
  });
  const receivable = await receivableService.createReceivable(LOCAL_USER_ID, {
    borrowerName: 'budi santoso',
    amount: 50000,
    transactionDate: '2026-01-02'
  });

  assert.equal(debt.contact_id, receivable.contact_id);

  const contacts = await contactService.listContacts(LOCAL_USER_ID);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].name, 'Budi Santoso');
  assert.equal(contacts[0].name_key, 'budi santoso');

  const photo = 'data:image/jpeg;base64,Zm90by11dGFtYQ==';
  const withPhoto = await contactService.setContactPhoto(
    LOCAL_USER_ID,
    debt.contact_id,
    photo
  );
  assert.equal(withPhoto.photo, photo);
  assert.equal(
    (await contactService.getContact(LOCAL_USER_ID, debt.contact_id)).photo,
    photo
  );

  const withoutPhoto = await contactService.removeContactPhoto(
    LOCAL_USER_ID,
    debt.contact_id
  );
  assert.equal(withoutPhoto.photo, '');

  const renamed = await contactService.updateContactName(
    LOCAL_USER_ID,
    debt.contact_id,
    'Budi S.'
  );
  assert.equal(renamed.name, 'Budi S.');
  assert.equal(renamed.name_key, 'budi s.');

  const second = await contactService.resolveContact(LOCAL_USER_ID, {
    name: 'Siti'
  });

  await assert.rejects(
    contactService.updateContactName(
      LOCAL_USER_ID,
      second.id,
      'budi s.'
    ),
    /sudah dipakai kontak lain/
  );
});

test('utang: penambahan pokok memperbarui total dan mengaktifkan kembali', async () => {
  const created = await debtService.createDebt(LOCAL_USER_ID, {
    lenderName: 'Budi',
    amount: 100000,
    transactionDate: '2026-01-01'
  });

  await debtService.recordDebtPayment({
    userId: LOCAL_USER_ID,
    debtId: created.id,
    amount: 100000,
    paymentDate: '2026-01-10'
  });

  let debt = (await debtService.listDebts(LOCAL_USER_ID))[0];
  assert.equal(debt.status, 'paid');

  const addition = await debtService.addDebtPrincipal({
    userId: LOCAL_USER_ID,
    debtId: created.id,
    amount: 50000,
    additionDate: '2026-01-20',
    description: 'Tambahan modal'
  });

  assert.equal(addition.amount, 50000);
  assert.equal(addition.debt_id, created.id);

  debt = (await debtService.listDebts(LOCAL_USER_ID))[0];
  assert.equal(debt.initial_amount, 100000);
  assert.equal(debt.amount, 150000);
  assert.equal(debt.paid_amount, 100000);
  assert.equal(debt.status, 'partial');
  assert.equal(
    (await debtService.listDebtAdditions(LOCAL_USER_ID, created.id)).length,
    1
  );

  await debtService.addDebtPrincipal({
    userId: LOCAL_USER_ID,
    debtId: created.id,
    amount: 25000,
    additionDate: '2026-01-21'
  });

  const updated = await debtService.updateDebt(LOCAL_USER_ID, created.id, {
    lenderName: 'Budi',
    amount: 110000,
    transactionDate: '2026-01-01'
  });

  assert.equal(updated.initial_amount, 110000);
  assert.equal(updated.amount, 185000);
  assert.equal(updated.status, 'partial');

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'debts'
  });
  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    [
      'debt_addition',
      'debt_addition',
      'debt_created',
      'debt_payment'
    ]
  );

  const dashboard = await dashboardService.loadDashboardData(LOCAL_USER_ID);
  assert.equal(dashboard.recent[0].category, 'debt_addition');

  await debtService.deleteDebt(LOCAL_USER_ID, created.id);

  assert.deepEqual(
    await debtService.listAllDebtAdditions(LOCAL_USER_ID),
    []
  );
  assert.equal(
    (
      await historyService.listHistory({
        userId: LOCAL_USER_ID,
        group: 'debts'
      })
    ).count,
    0
  );
});

test('piutang: penambahan pokok tercatat di riwayat dan dapat dihapus', async () => {
  const created = await receivableService.createReceivable(LOCAL_USER_ID, {
    borrowerName: 'Siti',
    amount: 80000,
    transactionDate: '2026-02-01'
  });

  await receivableService.recordReceivablePayment({
    userId: LOCAL_USER_ID,
    receivableId: created.id,
    amount: 30000,
    paymentDate: '2026-02-05'
  });

  await receivableService.addReceivablePrincipal({
    userId: LOCAL_USER_ID,
    receivableId: created.id,
    amount: 20000,
    additionDate: '2026-02-10',
    description: 'Pinjaman tambahan'
  });

  const receivable = (
    await receivableService.listReceivables(LOCAL_USER_ID)
  )[0];

  assert.equal(receivable.initial_amount, 80000);
  assert.equal(receivable.amount, 100000);
  assert.equal(receivable.received_amount, 30000);
  assert.equal(receivable.status, 'partial');
  assert.equal(
    (
      await receivableService.listReceivableAdditions(
        LOCAL_USER_ID,
        created.id
      )
    ).length,
    1
  );

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'receivables'
  });
  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    ['receivable_addition', 'receivable_created', 'receivable_payment']
  );

  await receivableService.deleteReceivable(LOCAL_USER_ID, created.id);
  assert.deepEqual(
    await receivableService.listAllReceivableAdditions(LOCAL_USER_ID),
    []
  );
});

test('migrasi v1 ke v2 membuat kontak bersama dan nominal awal', async () => {
  const databaseName = 'finora-migration-test';

  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database test masih terbuka.'));
  });

  await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      database.createObjectStore('debts', { keyPath: 'id' });
      database.createObjectStore('receivables', { keyPath: 'id' });
    };

    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        ['debts', 'receivables'],
        'readwrite'
      );

      transaction.objectStore('debts').put({
        id: 'debt-legacy',
        user_id: LOCAL_USER_ID,
        lender_name: 'Budi Santoso',
        amount: 100000,
        paid_amount: 0,
        transaction_date: '2026-01-01',
        status: 'unpaid',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      });
      transaction.objectStore('receivables').put({
        id: 'receivable-legacy',
        user_id: LOCAL_USER_ID,
        borrower_name: 'budi   santoso',
        amount: 50000,
        received_amount: 0,
        transaction_date: '2026-01-02',
        status: 'unpaid',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z'
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });

  const result = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const store of [
        'contacts',
        'debts',
        'receivables',
        'debt_additions',
        'receivable_additions'
      ]) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: 'id' });
        }
      }

      db.migrateLegacyRows(database, request.transaction);
    };

    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        ['contacts', 'debts', 'receivables'],
        'readonly'
      );
      const contactsRequest = transaction.objectStore('contacts').getAll();
      const debtsRequest = transaction.objectStore('debts').getAll();
      const receivablesRequest = transaction
        .objectStore('receivables')
        .getAll();

      transaction.oncomplete = () => {
        database.close();
        resolve({
          contacts: contactsRequest.result,
          debts: debtsRequest.result,
          receivables: receivablesRequest.result
        });
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });

  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].name, 'Budi Santoso');
  assert.equal(result.debts[0].contact_id, result.contacts[0].id);
  assert.equal(result.receivables[0].contact_id, result.contacts[0].id);
  assert.equal(result.debts[0].initial_amount, 100000);
  assert.equal(result.receivables[0].initial_amount, 50000);
});

test('validasi foto menolak berkas yang bukan gambar atau terlalu besar', () => {
  assert.equal(validateImageFile(null).valid, false);
  assert.equal(
    validateImageFile({ name: 'catatan.txt', type: 'text/plain', size: 10 })
      .valid,
    false
  );
  assert.equal(
    validateImageFile({
      name: 'besar.jpg',
      type: 'image/jpeg',
      size: 13 * 1024 * 1024
    }).valid,
    false
  );
  assert.equal(
    validateImageFile({
      name: 'wajah.jpg',
      type: 'image/jpeg',
      size: 1024
    }).valid,
    true
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

test('dompet: buat, pemasukan, pengeluaran, edit, dan validasi saldo', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const created = await walletService.createWallet(LOCAL_USER_ID, {
    name: 'Dompet Harian',
    type: 'cash',
    color: 'violet',
    initialBalance: 100000,
    targetAmount: 500000,
    description: 'Belanja sehari-hari'
  });

  assert.equal(created.balance, 100000);
  assert.equal(created.initial_balance, 100000);
  assert.equal(created.target_amount, 500000);

  await walletService.recordWalletTransaction({
    userId: LOCAL_USER_ID,
    walletId: created.id,
    type: 'income',
    amount: 50000,
    category: 'salary',
    transactionDate: today
  });
  await walletService.recordWalletTransaction({
    userId: LOCAL_USER_ID,
    walletId: created.id,
    type: 'expense',
    amount: 20000,
    category: 'food',
    transactionDate: today
  });

  let wallet = (await walletService.listWallets(LOCAL_USER_ID))[0];
  assert.equal(wallet.balance, 130000);

  await assert.rejects(
    walletService.recordWalletTransaction({
      userId: LOCAL_USER_ID,
      walletId: created.id,
      type: 'expense',
      amount: 999999,
      category: 'food',
      transactionDate: today
    }),
    /Saldo dompet tidak mencukupi/
  );

  const updated = await walletService.updateWallet(
    LOCAL_USER_ID,
    created.id,
    {
      name: 'Dompet Utama',
      type: 'bank',
      color: 'blue',
      initialBalance: 150000,
      targetAmount: 600000,
      description: 'Rekening utama'
    }
  );

  assert.equal(updated.name, 'Dompet Utama');
  assert.equal(updated.type, 'bank');
  assert.equal(updated.color, 'blue');
  assert.equal(updated.initial_balance, 150000);
  assert.equal(updated.balance, 180000);

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'wallets'
  });
  assert.deepEqual(
    history.rows.map((row) => row.category).sort(),
    ['wallet_expense', 'wallet_income']
  );

  const dashboard = await dashboardService.loadDashboardData(LOCAL_USER_ID);
  assert.equal(dashboard.summary.totalWalletBalance, 180000);
  assert.equal(dashboard.summary.walletCount, 1);
  assert.equal(dashboard.wallets.length, 1);
});

test('dompet: transfer antar dompet atomik dan tampil sekali di riwayat', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const source = await walletService.createWallet(LOCAL_USER_ID, {
    name: 'Tunai',
    type: 'cash',
    color: 'emerald',
    initialBalance: 100000
  });
  const destination = await walletService.createWallet(LOCAL_USER_ID, {
    name: 'Bank',
    type: 'bank',
    color: 'blue',
    initialBalance: 0
  });

  await walletService.recordWalletTransfer({
    userId: LOCAL_USER_ID,
    fromWalletId: source.id,
    toWalletId: destination.id,
    amount: 40000,
    transactionDate: today,
    description: 'Pindah dana'
  });

  const wallets = await walletService.listWallets(LOCAL_USER_ID);
  const sourceWallet = wallets.find((wallet) => wallet.id === source.id);
  const destinationWallet = wallets.find(
    (wallet) => wallet.id === destination.id
  );

  assert.equal(sourceWallet.balance, 60000);
  assert.equal(destinationWallet.balance, 40000);
  assert.equal(
    (await walletService.listWalletTransactions(LOCAL_USER_ID, source.id))
      .length,
    1
  );
  assert.equal(
    (await walletService.listWalletTransactions(LOCAL_USER_ID, destination.id))
      .length,
    1
  );

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'wallets'
  });
  assert.equal(history.count, 1);
  assert.equal(history.rows[0].category, 'wallet_transfer');
  assert.equal(history.rows[0].title, 'Transfer dari Tunai ke Bank');

  await assert.rejects(
    walletService.recordWalletTransfer({
      userId: LOCAL_USER_ID,
      fromWalletId: source.id,
      toWalletId: source.id,
      amount: 10000,
      transactionDate: today
    }),
    /harus berbeda/
  );

  await assert.rejects(
    walletService.recordWalletTransfer({
      userId: LOCAL_USER_ID,
      fromWalletId: source.id,
      toWalletId: destination.id,
      amount: 999999,
      transactionDate: today
    }),
    /Saldo dompet asal tidak mencukupi/
  );

  const dashboard = await dashboardService.loadDashboardData(LOCAL_USER_ID);
  assert.equal(dashboard.summary.totalWalletBalance, 100000);
  assert.equal(
    dashboard.recent.filter((row) => row.category === 'wallet_transfer').length,
    1
  );
});

test('dompet: hapus membatalkan transfer dan menolak saldo negatif', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const source = await walletService.createWallet(LOCAL_USER_ID, {
    name: 'Sumber',
    type: 'cash',
    color: 'amber',
    initialBalance: 100000
  });
  const destination = await walletService.createWallet(LOCAL_USER_ID, {
    name: 'Tujuan',
    type: 'ewallet',
    color: 'rose',
    initialBalance: 0
  });

  await walletService.recordWalletTransfer({
    userId: LOCAL_USER_ID,
    fromWalletId: source.id,
    toWalletId: destination.id,
    amount: 40000,
    transactionDate: today
  });
  await walletService.recordWalletTransaction({
    userId: LOCAL_USER_ID,
    walletId: destination.id,
    type: 'expense',
    amount: 10000,
    category: 'shopping',
    transactionDate: today
  });

  await assert.rejects(
    walletService.deleteWallet(LOCAL_USER_ID, source.id),
    /bernilai negatif/
  );

  await walletService.deleteWallet(LOCAL_USER_ID, destination.id);

  const wallets = await walletService.listWallets(LOCAL_USER_ID);
  assert.equal(wallets.length, 1);
  assert.equal(wallets[0].id, source.id);
  assert.equal(wallets[0].balance, 100000);
  assert.deepEqual(
    await walletService.listAllWalletTransactions(LOCAL_USER_ID),
    []
  );

  const history = await historyService.listHistory({
    userId: LOCAL_USER_ID,
    group: 'wallets'
  });
  assert.equal(history.count, 0);
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
