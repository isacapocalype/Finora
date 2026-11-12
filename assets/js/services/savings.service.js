import { requireSupabase } from '../supabase.js';
import { isOnline } from '../offline/network.js';
import { isNetworkError } from '../offline/errors.js';
import { createId } from '../offline/id.js';
import {
  writeAll,
  upsertRow,
  removeRow,
  readAll,
  readCachedUserRows
} from '../offline/db.js';
import { enqueueOutboxOp } from '../offline/outbox.js';
import {
  cacheSavingsTransactionHistory,
  removeHistoryEntry
} from '../offline/history.js';

const TABLE = 'savings';
const TRANSACTIONS_TABLE = 'savings_transactions';
const SAVINGS_FIELDS =
  'id, user_id, name, target_amount, current_amount, start_date, target_date, description, created_at, updated_at';

export async function listSavings(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SAVINGS_FIELDS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      return readCachedUserRows(userId, TABLE);
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(TABLE, rows);

  return rows;
}

export async function getSavings(userId, savingsId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SAVINGS_FIELDS)
    .eq('id', savingsId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, TABLE)).find(
        (item) => item.id === savingsId
      );
      return cached || null;
    }
    throw error;
  }

  if (data) {
    await upsertRow(TABLE, data);
  }

  return data;
}

export async function listSavingsTransactions(userId, savingsId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select(
      'id, savings_id, user_id, type, amount, transaction_date, description, created_at'
    )
    .eq('savings_id', savingsId)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, TRANSACTIONS_TABLE)).filter(
        (transaction) => transaction.savings_id === savingsId
      );
      return cached.sort((first, second) =>
        String(second.created_at || '').localeCompare(String(first.created_at || ''))
      );
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(TRANSACTIONS_TABLE, rows);

  return rows;
}

export async function createSavings(userId, payload) {
  if (!isOnline()) {
    const clientId = payload.id || createId();
    const now = new Date().toISOString();
    const row = {
      id: clientId,
      user_id: userId,
      name: payload.name,
      target_amount: payload.targetAmount,
      current_amount: 0,
      start_date: payload.startDate,
      target_date: payload.targetDate || null,
      description: payload.description || null,
      created_at: now,
      updated_at: now
    };

    await upsertRow(TABLE, row);
    await enqueueOutboxOp({
      id: clientId,
      type: 'savings.create',
      userId,
      payload: { ...payload, id: clientId },
      createdAt: now
    });

    return row;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...(payload.id ? { id: payload.id } : {}),
      user_id: userId,
      name: payload.name,
      target_amount: payload.targetAmount,
      start_date: payload.startDate,
      target_date: payload.targetDate || null,
      description: payload.description || null
    })
    .select(SAVINGS_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);

  return data;
}

export async function updateSavings(userId, savingsId, payload) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((item) => item.id === savingsId);

    if (!current) {
      throw new Error('Tabungan tidak ditemukan.');
    }

    const updated = {
      ...current,
      name: payload.name,
      target_amount: payload.targetAmount,
      start_date: payload.startDate,
      target_date: payload.targetDate || null,
      description: payload.description || null,
      updated_at: new Date().toISOString()
    };

    await upsertRow(TABLE, updated);
    await enqueueOutboxOp({
      id: createId(),
      type: 'savings.update',
      userId,
      savingsId,
      payload,
      createdAt: new Date().toISOString()
    });

    return updated;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name: payload.name,
      target_amount: payload.targetAmount,
      start_date: payload.startDate,
      target_date: payload.targetDate || null,
      description: payload.description || null
    })
    .eq('id', savingsId)
    .eq('user_id', userId)
    .select(SAVINGS_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);

  return data;
}

export async function deleteSavings(userId, savingsId) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((item) => item.id === savingsId);

    if (!current) {
      throw new Error('Tabungan tidak ditemukan.');
    }

    await removeRow(TABLE, savingsId);

    const transactions = await readCachedUserRows(userId, TRANSACTIONS_TABLE);
    for (const transaction of transactions) {
      if (transaction.savings_id === savingsId) {
        await removeRow(TRANSACTIONS_TABLE, transaction.id);
        await removeHistoryEntry(transaction.id);
      }
    }

    await enqueueOutboxOp({
      id: createId(),
      type: 'savings.delete',
      userId,
      savingsId,
      createdAt: new Date().toISOString()
    });

    return;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', savingsId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Tabungan tidak ditemukan.');
  }

  await removeRow(TABLE, savingsId);

  const transactions = await readCachedUserRows(userId, TRANSACTIONS_TABLE);
  for (const transaction of transactions) {
    if (transaction.savings_id === savingsId) {
      await removeRow(TRANSACTIONS_TABLE, transaction.id);
      await removeHistoryEntry(transaction.id);
    }
  }
}

export async function recordSavingsTransaction({
  savingsId,
  type,
  amount,
  transactionDate,
  description,
  clientTransactionId
}) {
  const transactionId = clientTransactionId || createId();
  const normalizedType = String(type || '').toLowerCase();

  if (!isOnline()) {
    const savingsRows = await readAll(TABLE);
    const savings = savingsRows.find((item) => item.id === savingsId);

    if (!savings) {
      throw new Error('Tabungan tidak ditemukan.');
    }

    if (!['deposit', 'withdrawal'].includes(normalizedType)) {
      throw new Error('Jenis transaksi tabungan tidak valid.');
    }

    const value = Number(amount) || 0;

    if (value <= 0) {
      throw new Error('Nominal transaksi harus lebih besar dari nol.');
    }

    const current = Number(savings.current_amount) || 0;

    if (normalizedType === 'withdrawal' && value > current) {
      throw new Error('Saldo tabungan tidak mencukupi.');
    }

    const now = new Date().toISOString();
    const nextAmount =
      normalizedType === 'deposit' ? current + value : current - value;
    const transactionRow = {
      id: transactionId,
      savings_id: savingsId,
      user_id: savings.user_id,
      type: normalizedType,
      amount: value,
      transaction_date: transactionDate,
      description: description || null,
      created_at: now
    };
    const updatedSavings = {
      ...savings,
      current_amount: nextAmount,
      updated_at: now
    };

    await upsertRow(TRANSACTIONS_TABLE, transactionRow);
    await upsertRow(TABLE, updatedSavings);
    await cacheSavingsTransactionHistory(transactionRow, updatedSavings);

    await enqueueOutboxOp({
      id: transactionId,
      type: 'savings.transaction',
      userId: savings.user_id,
      savingsId,
      transactionType: normalizedType,
      amount: value,
      transactionDate,
      description: description || null,
      clientTransactionId: transactionId,
      createdAt: now
    });

    return transactionId;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_savings_transaction', {
    p_savings_id: savingsId,
    p_type: normalizedType,
    p_amount: amount,
    p_transaction_date: transactionDate,
    p_description: description || null,
    p_client_id: transactionId
  });

  if (error) {
    if (error.code === '23505') {
      return transactionId;
    }
    throw error;
  }

  const resolvedId = data || transactionId;
  const savingsRows = await readAll(TABLE);
  const savings = savingsRows.find((item) => item.id === savingsId);

  if (savings) {
    const now = new Date().toISOString();
    const value = Number(amount);
    const nextAmount =
      normalizedType === 'deposit'
        ? Number(savings.current_amount) + value
        : Number(savings.current_amount) - value;
    const updatedSavings = {
      ...savings,
      current_amount: nextAmount,
      updated_at: now
    };
    const transactionRow = {
      id: resolvedId,
      savings_id: savingsId,
      user_id: savings.user_id,
      type: normalizedType,
      amount: value,
      transaction_date: transactionDate,
      description: description || null,
      created_at: now
    };

    await upsertRow(TABLE, updatedSavings);
    await upsertRow(TRANSACTIONS_TABLE, transactionRow);
    await cacheSavingsTransactionHistory(transactionRow, updatedSavings);
  }

  return resolvedId;
}

export function computeSavingsSummary(savings) {
  return savings.reduce(
    (summary, item) => {
      const target = Number(item.target_amount);
      const current = Number(item.current_amount);

      summary.totalCurrent += current;
      summary.totalTarget += target;

      if (current < target) {
        summary.activeCount += 1;
      }

      return summary;
    },
    {
      totalCurrent: 0,
      totalTarget: 0,
      activeCount: 0,
      count: savings.length
    }
  );
}

export function computeSavingsTotals(transactions) {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount);

      if (transaction.type === 'deposit') {
        totals.totalDeposit += amount;
      } else if (transaction.type === 'withdrawal') {
        totals.totalWithdrawal += amount;
      }

      return totals;
    },
    { totalDeposit: 0, totalWithdrawal: 0 }
  );
}
