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
  cacheDebtHistory,
  cacheDebtPaymentHistory,
  removeHistoryEntry
} from '../offline/history.js';

const TABLE = 'debts';
const PAYMENTS_TABLE = 'debt_payments';
const DEBT_FIELDS =
  'id, user_id, lender_name, amount, paid_amount, transaction_date, due_date, description, status, created_at, updated_at';

export async function listDebts(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEBT_FIELDS)
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

export async function listActiveDebts(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEBT_FIELDS)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, TABLE)).filter(
        (debt) => debt.status !== 'paid'
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

export async function createDebt(userId, payload) {
  if (!isOnline()) {
    const clientId = payload.id || createId();
    const now = new Date().toISOString();
    const row = {
      id: clientId,
      user_id: userId,
      lender_name: payload.lenderName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null,
      status: 'unpaid',
      paid_amount: 0,
      created_at: now,
      updated_at: now
    };

    await upsertRow(TABLE, row);
    await cacheDebtHistory(row);
    await enqueueOutboxOp({
      id: clientId,
      type: 'debt.create',
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
      lender_name: payload.lenderName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null
    })
    .select(DEBT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);
  await cacheDebtHistory(data);

  return data;
}

export async function updateDebt(userId, debtId, payload) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((debt) => debt.id === debtId);

    if (!current) {
      throw new Error('Utang tidak ditemukan.');
    }

    const updated = {
      ...current,
      lender_name: payload.lenderName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null,
      updated_at: new Date().toISOString()
    };

    await upsertRow(TABLE, updated);
    await cacheDebtHistory(updated);
    await enqueueOutboxOp({
      id: createId(),
      type: 'debt.update',
      userId,
      debtId,
      payload,
      createdAt: new Date().toISOString()
    });

    return updated;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      lender_name: payload.lenderName,
      amount: payload.amount,
      transaction_date: payload.transactionDate,
      due_date: payload.dueDate || null,
      description: payload.description || null
    })
    .eq('id', debtId)
    .eq('user_id', userId)
    .select(DEBT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  await upsertRow(TABLE, data);
  await cacheDebtHistory(data);

  return data;
}

export async function deleteDebt(userId, debtId) {
  if (!isOnline()) {
    const cached = await readCachedUserRows(userId, TABLE);
    const current = cached.find((debt) => debt.id === debtId);

    if (!current) {
      throw new Error('Utang tidak ditemukan.');
    }

    await removeRow(TABLE, debtId);
    await removeHistoryEntry(debtId);

    const payments = await readCachedUserRows(userId, PAYMENTS_TABLE);
    for (const payment of payments) {
      if (payment.debt_id === debtId) {
        await removeRow(PAYMENTS_TABLE, payment.id);
        await removeHistoryEntry(payment.id);
      }
    }

    await enqueueOutboxOp({
      id: createId(),
      type: 'debt.delete',
      userId,
      debtId,
      createdAt: new Date().toISOString()
    });

    return;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', debtId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Utang tidak ditemukan.');
  }

  await removeRow(TABLE, debtId);
  await removeHistoryEntry(debtId);

  const payments = await readCachedUserRows(userId, PAYMENTS_TABLE);
  for (const payment of payments) {
    if (payment.debt_id === debtId) {
      await removeRow(PAYMENTS_TABLE, payment.id);
      await removeHistoryEntry(payment.id);
    }
  }
}

export async function listDebtPayments(userId, debtId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select('id, debt_id, user_id, amount, payment_date, description, created_at')
    .eq('debt_id', debtId)
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = (await readCachedUserRows(userId, PAYMENTS_TABLE)).filter(
        (payment) => payment.debt_id === debtId
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

export async function recordDebtPayment({
  debtId,
  amount,
  paymentDate,
  description,
  clientPaymentId
}) {
  const paymentId = clientPaymentId || createId();

  if (!isOnline()) {
    const debts = await readAll(TABLE);
    const debt = debts.find((item) => item.id === debtId);

    if (!debt) {
      throw new Error('Utang tidak ditemukan.');
    }

    const paymentAmount = Number(amount) || 0;
    const remaining = Number(debt.amount) - Number(debt.paid_amount);

    if (paymentAmount <= 0) {
      throw new Error('Nominal pembayaran harus lebih besar dari nol.');
    }

    if (paymentAmount > remaining) {
      throw new Error('Nominal pembayaran melebihi sisa utang.');
    }

    const now = new Date().toISOString();
    const nextPaid = Number(debt.paid_amount) + paymentAmount;
    const paymentRow = {
      id: paymentId,
      debt_id: debtId,
      user_id: debt.user_id,
      amount: paymentAmount,
      payment_date: paymentDate,
      description: description || null,
      created_at: now
    };
    const updatedDebt = {
      ...debt,
      paid_amount: nextPaid,
      status: nextPaid >= Number(debt.amount) ? 'paid' : 'partial',
      updated_at: now
    };

    await upsertRow(PAYMENTS_TABLE, paymentRow);
    await upsertRow(TABLE, updatedDebt);
    await cacheDebtPaymentHistory(paymentRow, updatedDebt);

    await enqueueOutboxOp({
      id: paymentId,
      type: 'debt.payment',
      userId: debt.user_id,
      debtId,
      amount: paymentAmount,
      paymentDate,
      description: description || null,
      clientPaymentId: paymentId,
      createdAt: now
    });

    return paymentId;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_debt_payment', {
    p_debt_id: debtId,
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
  const debts = await readAll(TABLE);
  const debt = debts.find((item) => item.id === debtId);

  if (debt) {
    const now = new Date().toISOString();
    const nextPaid = Number(debt.paid_amount) + Number(amount);
    const updatedDebt = {
      ...debt,
      paid_amount: nextPaid,
      status: nextPaid >= Number(debt.amount) ? 'paid' : 'partial',
      updated_at: now
    };
    const paymentRow = {
      id: resolvedId,
      debt_id: debtId,
      user_id: debt.user_id,
      amount: Number(amount),
      payment_date: paymentDate,
      description: description || null,
      created_at: now
    };

    await upsertRow(TABLE, updatedDebt);
    await upsertRow(PAYMENTS_TABLE, paymentRow);
    await cacheDebtPaymentHistory(paymentRow, updatedDebt);
  }

  return resolvedId;
}

export function computeDebtSummary(debts) {
  return debts.reduce(
    (summary, debt) => {
      const amount = Number(debt.amount);
      const paid = Number(debt.paid_amount);
      const remaining = calcRemaining(amount, paid);

      summary.totalAmount += amount;
      summary.totalPaid += paid;
      summary.totalRemaining += remaining;

      if (debt.status !== 'paid' && remaining > 0) {
        summary.activeCount += 1;
      }

      return summary;
    },
    {
      totalAmount: 0,
      totalPaid: 0,
      totalRemaining: 0,
      activeCount: 0
    }
  );
}
