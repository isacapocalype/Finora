import { requireSupabase } from '../supabase.js';
import { calcRemaining } from '../utils.js';

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
    throw error;
  }

  return data || [];
}

export async function listActiveDebts(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, lender_name, amount, paid_amount, status, due_date')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createDebt(userId, payload) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
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

  return data;
}

export async function updateDebt(userId, debtId, payload) {
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

  return data;
}

export async function deleteDebt(userId, debtId) {
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
}

export async function listDebtPayments(userId, debtId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select('id, debt_id, amount, payment_date, description, created_at')
    .eq('debt_id', debtId)
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function recordDebtPayment({
  debtId,
  amount,
  paymentDate,
  description
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_debt_payment', {
    p_debt_id: debtId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_description: description || null
  });

  if (error) {
    throw error;
  }

  return data;
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
