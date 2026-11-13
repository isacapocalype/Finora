// FINORA — DASHBOARD SERVICE (local)
// Ringkasan dashboard dihitung dari data yang tersimpan di perangkat.

import { readUserRows } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { calcRemaining, parseDate, roundMoney } from '../utils.js';
import { buildHistoryRows } from './history.service.js';
import { computeWalletSummary } from './wallet.service.js';

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

export function computeDashboardData({
  debts = [],
  receivables = [],
  savings = [],
  transactions = [],
  wallets = [],
  walletTransactions = [],
  recent = []
} = {}) {
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
  const walletSummary = computeWalletSummary(wallets, walletTransactions);

  const activeSavings = savings
    .filter((item) => Number(item.current_amount) < Number(item.target_amount))
    .sort((first, second) => {
      if (!first.target_date && !second.target_date) return 0;
      if (!first.target_date) return 1;
      if (!second.target_date) return -1;
      return String(first.target_date).localeCompare(String(second.target_date));
    })
    .slice(0, 4);

  return {
    summary: {
      totalDebt: roundMoney(totalDebt),
      totalReceivable: roundMoney(totalReceivable),
      totalSavings: roundMoney(totalSavings),
      totalTarget: roundMoney(totalTarget),
      totalWalletBalance: walletSummary.totalBalance,
      walletCount: walletSummary.count,
      walletIncomeThisMonth: walletSummary.incomeThisMonth,
      walletExpenseThisMonth: walletSummary.expenseThisMonth,
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
    wallets: [...wallets]
      .sort((first, second) => Number(second.balance) - Number(first.balance))
      .slice(0, 4),
    activeSavings,
    recent
  };
}

export async function loadDashboardData(userId) {
  const ownerId = resolveUserId(userId);
  const [
    debts,
    debtAdditions,
    debtPayments,
    receivables,
    receivableAdditions,
    receivablePayments,
    savings,
    transactions,
    wallets,
    walletTransactions
  ] = await Promise.all([
    readUserRows(ownerId, 'debts'),
    readUserRows(ownerId, 'debt_additions'),
    readUserRows(ownerId, 'debt_payments'),
    readUserRows(ownerId, 'receivables'),
    readUserRows(ownerId, 'receivable_additions'),
    readUserRows(ownerId, 'receivable_payments'),
    readUserRows(ownerId, 'savings'),
    readUserRows(ownerId, 'savings_transactions'),
    readUserRows(ownerId, 'wallets'),
    readUserRows(ownerId, 'wallet_transactions')
  ]);
  const recent = buildHistoryRows({
    debts,
    debtAdditions,
    debtPayments,
    receivables,
    receivableAdditions,
    receivablePayments,
    savings,
    savingsTransactions: transactions,
    wallets,
    walletTransactions
  })
    .sort(
      (first, second) =>
        String(second.transaction_date || '').localeCompare(
          String(first.transaction_date || '')
        ) ||
        String(second.created_at || '').localeCompare(
          String(first.created_at || '')
        )
    )
    .slice(0, 6);

  return computeDashboardData({
    debts,
    receivables,
    savings,
    transactions,
    wallets,
    walletTransactions,
    recent
  });
}
