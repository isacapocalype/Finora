import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

const STORES = [
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

async function createLegacyDatabase() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('finora-offline', 1);

    request.onupgradeneeded = () => {
      for (const store of STORES) {
        request.result.createObjectStore(store, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(['debts'], 'readwrite');
    transaction.objectStore('debts').put({
      id: 'legacy-debt',
      user_id: 'user-a',
      amount: 100
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  database.close();
}

await createLegacyDatabase();

const db = await import('../assets/js/offline/db.js');
const outbox = await import('../assets/js/offline/outbox.js');
const { createId } = await import('../assets/js/offline/id.js');

test('createId menghasilkan UUID v4', () => {
  assert.match(
    createId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
});

test('cache offline dapat diupgrade dari versi lama', async () => {
  assert.deepEqual(await db.readAll('debts'), [
    { id: 'legacy-debt', user_id: 'user-a', amount: 100 }
  ]);

  await db.writeMeta('user_id', 'user-a');
  await db.writeMeta('last_sync_error', { message: 'gagal' });

  assert.equal(await db.readMeta('user_id'), 'user-a');
  assert.deepEqual(await db.readMeta('last_sync_error'), { message: 'gagal' });
  assert.equal(await db.readMeta('tidak_ada', 'cadangan'), 'cadangan');
});

test('outbox menyimpan, mengurutkan, dan menghapus operasi', async () => {
  await db.clearTable('outbox');

  const createdAt = '2026-01-01T00:00:00.000Z';
  await outbox.enqueueOutboxOp({
    id: 'op-1',
    type: 'debt.create',
    userId: 'user-a',
    createdAt
  });
  await outbox.enqueueOutboxOp({
    id: 'op-2',
    type: 'debt.payment',
    userId: 'user-a',
    createdAt
  });
  await outbox.enqueueOutboxOp({
    id: 'op-3',
    type: 'debt.create',
    userId: 'user-b',
    createdAt
  });

  assert.deepEqual(
    (await outbox.listPendingOutboxOps('user-a')).map((op) => op.id),
    ['op-1', 'op-2']
  );
  assert.equal(await outbox.countPendingOutboxOps('user-a'), 2);

  await outbox.removeOutboxOp('op-1');
  assert.deepEqual(
    (await outbox.listPendingOutboxOps('user-a')).map((op) => op.id),
    ['op-2']
  );
});

test('cache tabel mendukung replace, upsert, filter pengguna, dan hapus', async () => {
  await db.replaceAll('receivables', [
    { id: 'r-1', user_id: 'user-a', amount: 10 },
    { id: 'r-2', user_id: 'user-b', amount: 20 }
  ]);

  assert.equal((await db.readAll('receivables')).length, 2);
  assert.deepEqual(
    (await db.readCachedUserRows('user-a', 'receivables')).map((row) => row.id),
    ['r-1']
  );

  await db.upsertRow('receivables', { id: 'r-3', user_id: 'user-a', amount: 30 });
  assert.equal((await db.readCachedUserRows('user-a', 'receivables')).length, 2);

  await db.removeRow('receivables', 'r-1');
  assert.deepEqual(
    (await db.readCachedUserRows('user-a', 'receivables')).map((row) => row.id),
    ['r-3']
  );

  await db.clearTable('receivables');
  assert.deepEqual(await db.readAll('receivables'), []);
});
