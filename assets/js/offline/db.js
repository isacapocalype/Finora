// FINORA — OFFLINE DB (IndexedDB)
// Menyimpan cache tabel agar halaman bisa dibaca tanpa internet.

const DB_NAME = 'finora-offline';
const DB_VERSION = 2;

const OBJECT_STORES = [
  'profiles',
  'debts',
  'debt_payments',
  'receivables',
  'receivable_payments',
  'savings',
  'savings_transactions',
  'transaction_history',
  'outbox',
  'meta'
];

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        // Store meta versi 1 memakai keyPath sehingga penulisan meta selalu
        // gagal. Hapus hanya jika masih memakai keyPath, lalu buat ulang dengan
        // out-of-line key agar bisa menyimpan nilai apa pun.
        if (database.objectStoreNames.contains('meta')) {
          const legacyMeta = request.transaction.objectStore('meta');

          if (legacyMeta.keyPath) {
            database.deleteObjectStore('meta');
          }
        }

        for (const store of OBJECT_STORES) {
          if (database.objectStoreNames.contains(store)) {
            continue;
          }

          if (store === 'meta') {
            database.createObjectStore(store);
          } else {
            database.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

function putRecords(store, records) {
  if (typeof store.putAll === 'function') {
    store.putAll(records);
    return;
  }

  for (const record of records) {
    store.put(record);
  }
}

export async function readAll(table) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readonly');
    const store = transaction.objectStore(table);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readCachedUserRows(userId, table) {
  const rows = await readAll(table);
  return (rows || []).filter((row) => row && row.user_id === userId);
}

export async function writeAll(table, rows) {
  const db = await openDb();
  const records = Array.isArray(rows) ? rows : [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readwrite');
    putRecords(transaction.objectStore(table), records);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function replaceAll(table, rows) {
  const db = await openDb();
  const records = Array.isArray(rows) ? rows : [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readwrite');
    const store = transaction.objectStore(table);
    store.clear();
    putRecords(store, records);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function upsertRow(table, row) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readwrite');
    transaction.objectStore(table).put(row);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function removeRow(table, id) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readwrite');
    transaction.objectStore(table).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readFromStore(store, key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([store], 'readonly');
    const storeObject = transaction.objectStore(store);
    const request = key === undefined ? storeObject.getAll() : storeObject.get(key);

    request.onsuccess = () =>
      resolve(key === undefined ? request.result || [] : request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function putToStore(store, value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([store], 'readwrite');
    transaction.objectStore(store).put(value);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteFromStore(store, key) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([store], 'readwrite');
    transaction.objectStore(store).delete(key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function clearTable(table) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([table], 'readwrite');
    transaction.objectStore(table).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readMeta(key, defaultValue = null) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['meta'], 'readonly');
    const store = transaction.objectStore('meta');
    const request = store.get(key);

    request.onsuccess = () =>
      resolve(request.result === undefined ? defaultValue : request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function writeMeta(key, value) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['meta'], 'readwrite');
    transaction.objectStore('meta').put(value, key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
