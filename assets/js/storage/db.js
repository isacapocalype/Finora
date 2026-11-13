// FINORA — LOCAL DATABASE (IndexedDB)
// Seluruh data aplikasi disimpan di perangkat pengguna.

import { createId } from './id.js';
import { normalizeNameKey } from '../utils.js';

const DB_NAME = 'finora-local';
const DB_VERSION = 3;

const OBJECT_STORES = [
  'profiles',
  'contacts',
  'debts',
  'debt_additions',
  'debt_payments',
  'receivables',
  'receivable_additions',
  'receivable_payments',
  'savings',
  'savings_transactions',
  'wallets',
  'wallet_transactions'
];

let dbPromise = null;

function migrationContactId(contactStore, cache, userId, name, createdAt, now) {
  const safeName = String(name || '').trim() || 'Tanpa Nama';
  const nameKey = normalizeNameKey(safeName) || 'tanpa-nama';
  const cacheKey = `${userId}|${nameKey}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const id = createId();

  contactStore.put({
    id,
    user_id: userId,
    name: safeName.slice(0, 120),
    name_key: nameKey,
    photo: null,
    created_at: createdAt || now,
    updated_at: now
  });
  cache.set(cacheKey, id);

  return id;
}

// Data versi 1 belum mengenal kontak dan nominal awal. Saat upgrade, setiap
// nama unik dibuatkan satu kontak agar profil, foto, dan riwayat penambahan
// dapat dipakai tanpa kehilangan catatan lama.
export function migrateLegacyRows(database, transaction) {
  if (!database.objectStoreNames.contains('contacts')) {
    return;
  }

  const contactStore = transaction.objectStore('contacts');
  const cache = new Map();
  const now = new Date().toISOString();

  const migrateStore = (table, nameField) => {
    if (!database.objectStoreNames.contains(table)) {
      return;
    }

    const request = transaction.objectStore(table).openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      const row = cursor.value;
      const contactId = migrationContactId(
        contactStore,
        cache,
        row.user_id,
        row[nameField],
        row.created_at,
        now
      );

      cursor.update({
        ...row,
        contact_id: contactId,
        initial_amount:
          row.initial_amount === undefined
            ? Number(row.amount) || 0
            : Number(row.initial_amount),
        updated_at: row.updated_at || now
      });
      cursor.continue();
    };
  };

  migrateStore('debts', 'lender_name');
  migrateStore('receivables', 'borrower_name');
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;

        for (const store of OBJECT_STORES) {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store, { keyPath: 'id' });
          }
        }

        if (event.oldVersion > 0 && event.oldVersion < 2) {
          migrateLegacyRows(database, request.transaction);
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
