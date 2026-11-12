// FINORA — OFFLINE SYNC
// Inisialisasi cache dari server saat online, membaca cache saat offline.
// Antrean tulis offline dikirim lebih dulu sebelum cache disegarkan.

import { requireSupabase } from '../supabase.js';
import { readMeta, replaceAll, clearTable, writeMeta } from './db.js';
import { isOnline, onNetworkChange } from './network.js';
import { flushOutbox } from './flush.js';
import { countPendingOutboxOps } from './outbox.js';

export { isOnline, onNetworkChange } from './network.js';
export { readCachedUserRows } from './db.js';

const USER_TABLES = [
  'debts',
  'debt_payments',
  'receivables',
  'receivable_payments',
  'savings',
  'savings_transactions',
  'transaction_history'
];

export const NETWORK_EVENT = 'finora:network';

async function emitNetworkStatus() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  const online = isOnline();
  let pending = 0;

  try {
    const userId = await readMeta('user_id');
    pending = userId ? await countPendingOutboxOps(userId) : 0;
  } catch {
    pending = 0;
  }

  window.dispatchEvent(
    new CustomEvent(NETWORK_EVENT, { detail: { online, pending } })
  );
}

export async function hydrateFromServer(userId) {
  const supabase = requireSupabase();

  const results = await Promise.all([
    supabase
      .from('debts')
      .select(
        'id, user_id, lender_name, amount, paid_amount, status, transaction_date, due_date, description, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('debt_payments')
      .select('id, debt_id, user_id, amount, payment_date, description, created_at')
      .eq('user_id', userId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('receivables')
      .select(
        'id, user_id, borrower_name, amount, received_amount, status, transaction_date, due_date, description, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('receivable_payments')
      .select('id, receivable_id, user_id, amount, payment_date, description, created_at')
      .eq('user_id', userId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('savings')
      .select(
        'id, user_id, name, target_amount, current_amount, start_date, target_date, description, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('savings_transactions')
      .select(
        'id, user_id, savings_id, type, amount, transaction_date, description, created_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('transaction_history')
      .select(
        'id, user_id, category, title, description, amount, direction, transaction_date, created_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)
  ]);

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
  }

  const [
    debts,
    debtPayments,
    receivables,
    receivablePayments,
    savings,
    savingsTransactions,
    recent
  ] = results.map((result) => result.data || []);

  await Promise.all([
    replaceAll('debts', debts),
    replaceAll('debt_payments', debtPayments),
    replaceAll('receivables', receivables),
    replaceAll('receivable_payments', receivablePayments),
    replaceAll('savings', savings),
    replaceAll('savings_transactions', savingsTransactions),
    replaceAll('transaction_history', recent)
  ]);

  await writeMeta('last_sync', new Date().toISOString());
  await writeMeta('user_id', userId);
  await writeMeta('last_sync_error', null);

  return true;
}

export async function clearOfflineData() {
  for (const table of USER_TABLES) {
    await clearTable(table);
  }

  await clearTable('outbox');
  await writeMeta('last_sync', null);
  await writeMeta('last_sync_error', null);
  await writeMeta('user_id', null);
}

async function syncUser(userId) {
  if (!isOnline()) {
    return { offline: true, processed: 0, pending: null, failure: null };
  }

  const result = await flushOutbox(userId);

  if (!result.failure) {
    try {
      await hydrateFromServer(userId);
    } catch (error) {
      console.warn('Offline cache belum tersedia:', error);
    }
  }

  return result;
}

export async function initializeOfflineSync(userId) {
  await writeMeta('user_id', userId);

  await syncUser(userId);
  await emitNetworkStatus();

  return onNetworkChange(async () => {
    await emitNetworkStatus();

    if (isOnline()) {
      await syncUser(userId);
      await emitNetworkStatus();
    }
  });
}

export async function syncNow(userId) {
  const targetUser = userId || (await readMeta('user_id'));

  if (!targetUser) {
    return { processed: 0, pending: 0, failure: null };
  }

  const result = await syncUser(targetUser);
  await emitNetworkStatus();
  return result;
}

export async function readLastSync() {
  return readMeta('last_sync');
}

export async function readLastSyncError() {
  return readMeta('last_sync_error');
}

export async function readPendingCount(userId) {
  const targetUser = userId || (await readMeta('user_id'));
  return targetUser ? countPendingOutboxOps(targetUser) : 0;
}
