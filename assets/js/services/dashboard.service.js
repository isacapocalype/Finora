import { requireSupabase } from '../supabase.js';
import { calcRemaining, parseDate, roundMoney } from '../utils.js';
import { listRecentHistory } from './history.service.js';

function transactionNet(transaction) {
  const amount = Number(transaction.amount) || 0;
  return transaction.type === 'deposit' ? amount : -amount;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  return start;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function netBefore(transactions, boundary) {
  return transactions
    .filter((transaction) => transaction.parsedDate < boundary)
    .reduce((total, transaction) => total + transaction.net, 0);
}

export function buildSavingsSeries(
  transactions,
  range = 'monthly',
  referenceDate = new Date()
) {
  const normalized = transactions
    .map((transaction) => ({
      ...transaction,
      parsedDate: parseDate(transaction.transaction_date),
      net: transactionNet(transaction)
    }))
    .filter((transaction) => transaction.parsedDate);

  const isWeekly = range === 'weekly';
  const periodCount = isWeekly ? 8 : 6;
  const start = isWeekly
    ? addDays(startOfWeek(referenceDate), -7 * (periodCount - 1))
    : addMonths(startOfMonth(referenceDate), -(periodCount - 1));

  const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' });
  const weekFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short'
  });

  let runningBalance = netBefore(normalized, start);
  const openingBalance = roundMoney(runningBalance);
  const labels = [];
  const values = [];

  for (let index = 0; index < periodCount; index += 1) {
    const periodStart = isWeekly
      ? addDays(start, index * 7)
      : addMonths(start, index);
    const periodEnd = isWeekly
      ? addDays(periodStart, 7)
      : addMonths(periodStart, 1);

    const periodNet = normalized
      .filter(
        (transaction) =>
          transaction.parsedDate >= periodStart &&
          transaction.parsedDate < periodEnd
      )
      .reduce((total, transaction) => total + transaction.net, 0);

    runningBalance += periodNet;

    labels.push(
      isWeekly
        ? weekFormatter.format(periodStart)
        : monthFormatter.format(periodStart)
    );
    values.push(roundMoney(runningBalance));
  }

  return {
    labels,
    values,
    openingBalance,
    hasTransactions: normalized.length > 0,
    total: roundMoney(
      normalized.reduce((total, transaction) => total + transaction.net, 0)
    )
  };
}

export async function loadDashboardData(userId) {
  const supabase = requireSupabase();

  const [debtsResult, receivablesResult, savingsResult, transactionsResult, recent] =
    await Promise.all([
      supabase
        .from('debts')
        .select('id, amount, paid_amount, status')
        .eq('user_id', userId),
      supabase
        .from('receivables')
        .select('id, amount, received_amount, status')
        .eq('user_id', userId),
      supabase
        .from('savings')
        .select('id, name, target_amount, current_amount, target_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('savings_transactions')
        .select('id, type, amount, transaction_date, created_at')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true }),
      listRecentHistory(userId, 6)
    ]);

  for (const result of [
    debtsResult,
    receivablesResult,
    savingsResult,
    transactionsResult
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const debts = debtsResult.data || [];
  const receivables = receivablesResult.data || [];
  const savings = savingsResult.data || [];
  const transactions = transactionsResult.data || [];

  const totalDebt = debts.reduce(
    (total, debt) =>
      total + calcRemaining(debt.amount, debt.paid_amount),
    0
  );
  const totalReceivable = receivables.reduce(
    (total, receivable) =>
      total + calcRemaining(receivable.amount, receivable.received_amount),
    0
  );
  const totalSavings = savings.reduce(
    (total, item) => total + Number(item.current_amount),
    0
  );
  const totalTarget = savings.reduce(
    (total, item) => total + Number(item.target_amount),
    0
  );

  const activeSavings = savings
    .filter((item) => Number(item.current_amount) < Number(item.target_amount))
    .sort((first, second) => {
      if (!first.target_date && !second.target_date) return 0;
      if (!first.target_date) return 1;
      if (!second.target_date) return -1;
      return first.target_date.localeCompare(second.target_date);
    })
    .slice(0, 4);

  return {
    summary: {
      totalDebt: roundMoney(totalDebt),
      totalReceivable: roundMoney(totalReceivable),
      totalSavings: roundMoney(totalSavings),
      totalTarget: roundMoney(totalTarget),
      activeDebtCount: debts.filter((debt) => debt.status !== 'paid').length,
      activeReceivableCount: receivables.filter(
        (receivable) => receivable.status !== 'paid'
      ).length,
      savingsCount: savings.length
    },
    charts: {
      monthly: buildSavingsSeries(transactions, 'monthly'),
      weekly: buildSavingsSeries(transactions, 'weekly')
    },
    comparison: {
      debt: roundMoney(totalDebt),
      receivable: roundMoney(totalReceivable)
    },
    activeSavings,
    recent
  };
}
