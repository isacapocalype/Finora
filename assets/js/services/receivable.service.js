import { requireSupabase } from '../supabase.js';
import { calcRemaining } from '../utils.js';

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
    throw error;
  }

  return data || [];
}

export async function listActiveReceivables(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, borrower_name, amount, received_amount, status, due_date')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createReceivable(userId, payload) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
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

  return data;
}

export async function updateReceivable(userId, receivableId, payload) {
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

  return data;
}

export async function deleteReceivable(userId, receivableId) {
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
}

export async function listReceivablePayments(userId, receivableId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select('id, receivable_id, amount, payment_date, description, created_at')
    .eq('receivable_id', receivableId)
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function recordReceivablePayment({
  receivableId,
  amount,
  paymentDate,
  description
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_receivable_payment', {
    p_receivable_id: receivableId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_description: description || null
  });

  if (error) {
    throw error;
  }

  return data;
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
