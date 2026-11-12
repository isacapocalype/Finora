// FINORA — SAVINGS SERVICE (local)
// Target tabungan dan transaksinya disimpan langsung di IndexedDB.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { roundMoney } from '../utils.js';

const TABLE = 'savings';
const TRANSACTIONS_TABLE = 'savings_transactions';

function sortSavings(rows) {
  return [...rows].sort((first, second) =>
    String(second.created_at || '').localeCompare(String(first.created_at || ''))
  );
}

function sortTransactions(rows) {
  return [...rows].sort(
    (first, second) =>
      String(second.transaction_date || '').localeCompare(
        String(first.transaction_date || '')
      ) ||
      String(second.created_at || '').localeCompare(
        String(first.created_at || '')
      )
  );
}

export async function listSavings(userId) {
  return sortSavings(await readUserRows(resolveUserId(userId), TABLE));
}

export async function createSavings(userId, payload) {
  const ownerId = resolveUserId(userId);
  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    name: payload.name,
    target_amount: roundMoney(payload.targetAmount),
    current_amount: 0,
    start_date: payload.startDate,
    target_date: payload.targetDate || null,
    description: payload.description || null,
    created_at: now,
    updated_at: now
  };

  await upsertRow(TABLE, row);

  return row;
}

export async function updateSavings(userId, savingsId, payload) {
  const ownerId = resolveUserId(userId);
  const savings = await readUserRows(ownerId, TABLE);
  const current = savings.find((item) => item.id === savingsId);

  if (!current) {
    throw new Error('Tabungan tidak ditemukan.');
  }

  const updated = {
    ...current,
    name: payload.name,
    target_amount: roundMoney(payload.targetAmount),
    start_date: payload.startDate,
    target_date: payload.targetDate || null,
    description: payload.description || null,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteSavings(userId, savingsId) {
  const ownerId = resolveUserId(userId);
  const savings = await readUserRows(ownerId, TABLE);

  if (!savings.some((item) => item.id === savingsId)) {
    throw new Error('Tabungan tidak ditemukan.');
  }

  const transactions = await readUserRows(ownerId, TRANSACTIONS_TABLE);
  const operations = [
    { table: TABLE, type: 'delete', key: savingsId },
    ...transactions
      .filter((transaction) => transaction.savings_id === savingsId)
      .map((transaction) => ({
        table: TRANSACTIONS_TABLE,
        type: 'delete',
        key: transaction.id
      }))
  ];

  await writeBatch(operations);
}

export async function listSavingsTransactions(userId, savingsId) {
  const transactions = await readUserRows(
    resolveUserId(userId),
    TRANSACTIONS_TABLE
  );

  return sortTransactions(
    transactions.filter(
      (transaction) => transaction.savings_id === savingsId
    )
  );
}

export async function recordSavingsTransaction({
  userId,
  savingsId,
  type,
  amount,
  transactionDate,
  description,
  clientTransactionId
}) {
  const ownerId = resolveUserId(userId);
  const savings = await readUserRows(ownerId, TABLE);
  const current = savings.find((item) => item.id === savingsId);

  if (!current) {
    throw new Error('Tabungan tidak ditemukan.');
  }

  const normalizedType = String(type || '').toLowerCase();

  if (!['deposit', 'withdrawal'].includes(normalizedType)) {
    throw new Error('Jenis transaksi tabungan tidak valid.');
  }

  const value = roundMoney(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari nol.');
  }

  const balance = Number(current.current_amount) || 0;

  if (normalizedType === 'withdrawal' && value > balance) {
    throw new Error('Saldo tabungan tidak mencukupi.');
  }

  const now = new Date().toISOString();
  const nextAmount =
    normalizedType === 'deposit' ? balance + value : balance - value;
  const transactionRow = {
    id: clientTransactionId || createId(),
    savings_id: savingsId,
    user_id: current.user_id,
    type: normalizedType,
    amount: value,
    transaction_date: transactionDate,
    description: description || null,
    created_at: now
  };
  const updatedSavings = {
    ...current,
    current_amount: roundMoney(nextAmount),
    updated_at: now
  };

  await writeBatch([
    { table: TRANSACTIONS_TABLE, value: transactionRow },
    { table: TABLE, value: updatedSavings }
  ]);

  return transactionRow.id;
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
