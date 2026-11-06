import { requireSupabase } from '../supabase.js';

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
    throw error;
  }

  return data || [];
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
    throw error;
  }

  return data;
}

export async function listSavingsTransactions(userId, savingsId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select(
      'id, savings_id, type, amount, transaction_date, description, created_at'
    )
    .eq('savings_id', savingsId)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createSavings(userId, payload) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
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

  return data;
}

export async function updateSavings(userId, savingsId, payload) {
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

  return data;
}

export async function deleteSavings(userId, savingsId) {
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
}

export async function recordSavingsTransaction({
  savingsId,
  type,
  amount,
  transactionDate,
  description
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('record_savings_transaction', {
    p_savings_id: savingsId,
    p_type: type,
    p_amount: amount,
    p_transaction_date: transactionDate,
    p_description: description || null
  });

  if (error) {
    throw error;
  }

  return data;
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
