import { requireSupabase } from '../supabase.js';
import { calcRemaining } from '../utils.js';
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
  cacheReceivableHistory,
  cacheReceivablePaymentHistory,
  removeHistoryEntry
} from '../offline/history.js';

const TABLE = 'receivables';
const PAYMENTS_TABLE = 'receivable_payments';
const RECEIVABLE_FIELDS =
  'id, user_id, borrower_name, amount, received_amount, transaction_date, due_date, description, status, created_at, updated_at';

export async function listReceivables(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(RECEIVABLE_FIELDS)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
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

export async function listActiveReceivables(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(RECEIVABLE_FIELDS)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, TABLE)).filter(
        (receivable) => receivable.status !== 'paid'
      );
      cached.sort((first, second) => {
        const firstDate = first.due_date || '9999-12-31';
        const secondDate = second.due_date || '9999-12-31';
        if (firstDate !== secondDate) {
          return firstDate.localeCompare(secondDate);
        }
        return String(first.created_at || '').localeCompare(String(second.created_at || ''));
      });
      return cached;
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(TABLE, rows);

  return rows;
}

export async function createReceivable(userId, payload) {
  if (!isOnline()) {
    const clientId = payload.id || createId();
    const now = new Date().toISOString();
    const row = {
      id: clientId,
      user_id: userId,
      borrower_name: payload.borrowerName,
      amount: payload.amount,
      received_amount: 0,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null,
      status: 'unpaid',
      created_at: now,
      updated_at: now
    };

    await upsertRow(TABLE, row);
    await cacheReceivableHistory(row);
    await enqueueOutboxOp({
      id: clientId,
      type: 'receivable.create',
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
      borrower_name: payload.borrowerName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null
    })
    .select(RECEIVABLE_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);
  await cacheReceivableHistory(data);

  return data;
}

export async function updateReceivable(userId, receivableId, payload) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((receivable) => receivable.id === receivableId);

    if (!current) {
      throw new Error('Piutang tidak ditemukan.');
    }

    const updated = {
      ...current,
      borrower_name: payload.borrowerName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null,
      updated_at: new Date().toISOString()
    };

    await upsertRow(TABLE, updated);
    await cacheReceivableHistory(updated);
    await enqueueOutboxOp({
      id: createId(),
      type: 'receivable.update',
      userId,
      receivableId,
      payload,
      createdAt: new Date().toISOString()
    });

    return updated;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      borrower_name: payload.borrowerName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null
    })
    .eq('id', receivableId)
    .eq('user_id', userId)
    .select(RECEIVABLE_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);
  await cacheReceivableHistory(data);

  return data;
}

export async function deleteReceivable(userId, receivableId) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((receivable) => receivable.id === receivableId);

    if (!current) {
      throw new Error('Piutang tidak ditemukan.');
    }

    await removeRow(TABLE, receivableId);
    await removeHistoryEntry(receivableId);

    const payments = await readCachedUserRows(userId, PAYMENTS_TABLE);
    for (const payment of payments) {
      if (payment.receivable_id === receivableId) {
        await removeRow(PAYMENTS_TABLE, payment.id);
        await removeHistoryEntry(payment.id);
      }
    }

    await enqueueOutboxOp({
      id: createId(),
      type: 'receivable.delete',
      userId,
      receivableId,
      createdAt: new Date().toISOString()
    });

    return;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', receivableId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Piutang tidak ditemukan.');
  }

  await removeRow(TABLE, receivableId);
  await removeHistoryEntry(receivableId);

  const payments = await readCachedUserRows(userId, PAYMENTS_TABLE);
  for (const payment of payments) {
    if (payment.receivable_id === receivableId) {
      await removeRow(PAYMENTS_TABLE, payment.id);
      await removeHistoryEntry(payment.id);
    }
  }
}

export async function listReceivablePayments(userId, receivableId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select('id, receivable_id, user_id, amount, payment_date, description, created_at')
    .eq('receivable_id', receivableId)
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, PAYMENTS_TABLE)).filter(
        (payment) => payment.receivable_id === receivableId
      );
      return cached.sort((first, second) =>
        String(second.created_at || '').localeCompare(String(first.created_at || ''))
      );
    }
    throw error;
  }

  const rows = data || [];
  await writeAll(PAYMENTS_TABLE, rows);

  return rows;
}

export async function recordReceivablePayment({
  receivableId,
  amount,
  paymentDate,
  description,
  clientPaymentId
}) {
  const paymentId = clientPaymentId || createId();

  if (!isOnline()) {
    const receivables = await readAll(TABLE);
    const receivable = receivables.find((item) => item.id === receivableId);

    if (!receivable) {
      throw new Error('Piutang tidak ditemukan.');
    }

    const paymentAmount = Number(amount) || 0;
    const remaining = Number(receivable.amount) - Number(receivable.received_amount);

    if (paymentAmount <= 0) {
      throw new Error('Nominal pengembalian harus lebih besar dari nol.');
    }

    if (paymentAmount > remaining) {
      throw new Error('Nominal pengembalian melebihi sisa piutang.');
    }

    const now = new Date().toISOString();
    const nextReceived = Number(receivable.received_amount) + paymentAmount;
    const paymentRow = {
      id: paymentId,
      receivable_id: receivableId,
      user_id: receivable.user_id,
      amount: paymentAmount,
      payment_date: paymentDate,
      description: description || null,
      created_at: now
    };
    const updatedReceivable = {
      ...receivable,
      received_amount: nextReceived,
      status: nextReceived >= Number(receivable.amount) ? 'paid' : 'partial',
      updated_at: now
    };

    await upsertRow(PAYMENTS_TABLE, paymentRow);
    await upsertRow(TABLE, updatedReceivable);
    await cacheReceivablePaymentHistory(paymentRow, updatedReceivable);

    await enqueueOutboxOp({
      id: paymentId,
      type: 'receivable.payment',
      userId: receivable.user_id,
      receivableId,
      amount: paymentAmount,
      paymentDate,
      description: description || null,
      clientPaymentId: paymentId,
      createdAt: now
    });

    return paymentId;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_receivable_payment', {
    p_receivable_id: receivableId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_description: description || null,
    p_client_id: paymentId
  });

  if (error) {
    if (error.code === '23505') {
      return paymentId;
    }
    throw error;
  }

  const resolvedId = data || paymentId;
  const receivables = await readAll(TABLE);
  const receivable = receivables.find((item) => item.id === receivableId);

  if (receivable) {
    const now = new Date().toISOString();
    const nextReceived = Number(receivable.received_amount) + Number(amount);
    const updatedReceivable = {
      ...receivable,
      received_amount: nextReceived,
      status: nextReceived >= Number(receivable.amount) ? 'paid' : 'partial',
      updated_at: now
    };
    const paymentRow = {
      id: resolvedId,
      receivable_id: receivableId,
      user_id: receivable.user_id,
      amount: Number(amount),
      payment_date: paymentDate,
      description: description || null,
      created_at: now
    };

    await upsertRow(TABLE, updatedReceivable);
    await upsertRow(PAYMENTS_TABLE, paymentRow);
    await cacheReceivablePaymentHistory(paymentRow, updatedReceivable);
  }

  return resolvedId;
}

export function computeReceivableSummary(receivables) {
  return receivables.reduce(
    (summary, receivable) => {
      const amount = Number(receivable.amount);
      const received = Number(receivable.received_amount);
      const remaining = calcRemaining(amount, received);

      summary.totalAmount += amount;
      summary.totalReceived += received;
      summary.totalRemaining += remaining;

      if (receivable.status !== 'paid' && remaining > 0) {
        summary.activeCount += 1;
      }

      return summary;
    },
    {
      totalAmount: 0,
      totalReceived: 0,
      totalRemaining: 0,
      activeCount: 0
    }
  );
}
