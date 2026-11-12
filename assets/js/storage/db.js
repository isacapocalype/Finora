// FINORA — LOCAL DATABASE (IndexedDB)
// Seluruh data aplikasi disimpan di perangkat pengguna.

const DB_NAME = 'finora-local';
const DB_VERSION = 1;

const OBJECT_STORES = [
  'profiles',
  'debts',
  'debt_payments',
  'receivables',
  'receivable_payments',
  'savings',
  'savings_transactions'
];

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        for (const store of OBJECT_STORES) {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || new Error('Transaksi penyimpanan dibatalkan.'));
  });
}

export async function readAll(table) {
  const database = await openDb();
  const transaction = database.transaction([table], 'readonly');
  const request = transaction.objectStore(table).getAll();

  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  return rows;
}

export async function readUserRows(userId, table) {
  const rows = await readAll(table);
  return rows.filter((row) => row && row.user_id === userId);
}

export async function readFromStore(table, key) {
  const database = await openDb();
  const transaction = database.transaction([table], 'readonly');
  const request = transaction.objectStore(table).get(key);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function upsertRow(table, row) {
  const database = await openDb();
  const transaction = database.transaction([table], 'readwrite');
  transaction.objectStore(table).put(row);

  await transactionDone(transaction);
}

export async function removeRow(table, id) {
  const database = await openDb();
  const transaction = database.transaction([table], 'readwrite');
  transaction.objectStore(table).delete(id);

  await transactionDone(transaction);
}

// Menulis beberapa baris lintas tabel dalam satu transaksi agar perubahan
// saldo dan riwayat pembayaran tidak pernah setengah tersimpan.
export async function writeBatch(operations) {
  const list = Array.isArray(operations) ? operations : [];
  const tables = [...new Set(list.map((operation) => operation.table))];

  if (!tables.length) {
    return;
  }

  const database = await openDb();
  const transaction = database.transaction(tables, 'readwrite');

  try {
    for (const operation of list) {
      const store = transaction.objectStore(operation.table);

      if (operation.type === 'delete') {
        store.delete(operation.key ?? operation.value?.id);
      } else {
        store.put(operation.value);
      }
    }
  } catch (error) {
    transaction.abort();
    throw error;
  }

  await transactionDone(transaction);
}

export async function clearTable(table) {
  const database = await openDb();
  const transaction = database.transaction([table], 'readwrite');
  transaction.objectStore(table).clear();

  await transactionDone(transaction);
}

export async function clearAllData() {
  const database = await openDb();
  const transaction = database.transaction(OBJECT_STORES, 'readwrite');

  for (const store of OBJECT_STORES) {
    transaction.objectStore(store).clear();
  }

  await transactionDone(transaction);
}

export function getDatabaseName() {
  return DB_NAME;
}
