// FINORA — WALLET SERVICE (local)
// Dompet mandiri dengan saldo, pemasukan, pengeluaran, dan transfer atomik.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import {
  isSameMonth,
  roundMoney,
  WALLET_COLORS,
  WALLET_EXPENSE_CATEGORIES,
  WALLET_INCOME_CATEGORIES,
  WALLET_TYPES
} from '../utils.js';

const TABLE = 'wallets';
const TRANSACTIONS_TABLE = 'wallet_transactions';
const TYPE_VALUES = new Set(WALLET_TYPES.map((item) => item.value));
const COLOR_VALUES = new Set(WALLET_COLORS.map((item) => item.value));
const INCOME_CATEGORIES = new Set(
  WALLET_INCOME_CATEGORIES.map((item) => item.value)
);
const EXPENSE_CATEGORIES = new Set(
  WALLET_EXPENSE_CATEGORIES.map((item) => item.value)
);

function sortWallets(rows) {
  return [...rows].sort((first, second) =>
    String(first.created_at || '').localeCompare(String(second.created_at || ''))
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

function normalizeType(type) {
  const value = String(type || '').toLowerCase();
  return TYPE_VALUES.has(value) ? value : 'other';
}

function normalizeColor(color) {
  const value = String(color || '').toLowerCase();
  return COLOR_VALUES.has(value) ? value : WALLET_COLORS[0].value;
}

function normalizeTarget(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const target = roundMoney(value);
  return Number.isFinite(target) && target > 0 ? target : null;
}

function assertAmount(amount, label = 'Nominal') {
  const value = roundMoney(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} harus lebih besar dari nol.`);
  }

  return value;
}

function assertDate(value) {
  const date = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Tanggal transaksi wajib diisi.');
  }

  return date;
}

function findWallet(wallets, walletId) {
  return wallets.find((item) => item.id === walletId) || null;
}

export async function listWallets(userId) {
  return sortWallets(await readUserRows(resolveUserId(userId), TABLE));
}

export async function getWallet(userId, walletId) {
  const wallets = await readUserRows(resolveUserId(userId), TABLE);
  return findWallet(wallets, walletId);
}

export async function createWallet(userId, payload) {
  const ownerId = resolveUserId(userId);
  const name = String(payload.name || '').trim();

  if (!name) {
    throw new Error('Nama dompet wajib diisi.');
  }

  if (name.length > 120) {
    throw new Error('Nama dompet maksimal 120 karakter.');
  }

  const initialBalance = roundMoney(payload.initialBalance || 0);

  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    throw new Error('Saldo awal tidak boleh negatif.');
  }

  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    name,
    type: normalizeType(payload.type),
    color: normalizeColor(payload.color),
    initial_balance: initialBalance,
    balance: initialBalance,
    target_amount: normalizeTarget(payload.targetAmount),
    description: String(payload.description || '').trim().slice(0, 500) || null,
    created_at: now,
    updated_at: now
  };

  await upsertRow(TABLE, row);

  return row;
}

export async function updateWallet(userId, walletId, payload) {
  const ownerId = resolveUserId(userId);
  const wallets = await readUserRows(ownerId, TABLE);
  const current = findWallet(wallets, walletId);

  if (!current) {
    throw new Error('Dompet tidak ditemukan.');
  }

  const name = String(payload.name ?? current.name).trim();

  if (!name) {
    throw new Error('Nama dompet wajib diisi.');
  }

  if (name.length > 120) {
    throw new Error('Nama dompet maksimal 120 karakter.');
  }

  const hasInitialBalance = payload.initialBalance !== undefined;
  const initialBalance = hasInitialBalance
    ? roundMoney(payload.initialBalance)
    : Number(current.initial_balance) || 0;

  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    throw new Error('Saldo awal tidak boleh negatif.');
  }

  const balanceDelta = initialBalance - (Number(current.initial_balance) || 0);
  const nextBalance = roundMoney((Number(current.balance) || 0) + balanceDelta);

  if (nextBalance < 0) {
    throw new Error(
      'Saldo awal tidak dapat dikurangi karena saldo dompet akan menjadi negatif.'
    );
  }

  const updated = {
    ...current,
    name,
    type: normalizeType(payload.type ?? current.type),
    color: normalizeColor(payload.color ?? current.color),
    initial_balance: initialBalance,
    balance: nextBalance,
    target_amount:
      payload.targetAmount === undefined
        ? current.target_amount ?? null
        : normalizeTarget(payload.targetAmount),
    description:
      payload.description === undefined
        ? current.description || null
        : String(payload.description || '').trim().slice(0, 500) || null,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteWallet(userId, walletId) {
  const ownerId = resolveUserId(userId);
  const wallets = await readUserRows(ownerId, TABLE);
  const current = findWallet(wallets, walletId);

  if (!current) {
    throw new Error('Dompet tidak ditemukan.');
  }

  const transactions = await readUserRows(ownerId, TRANSACTIONS_TABLE);
  const ownTransactions = transactions.filter(
    (transaction) => transaction.wallet_id === walletId
  );
  const transferIds = new Set(
    ownTransactions
      .map((transaction) => transaction.transfer_id)
      .filter(Boolean)
  );
  const pairedTransactions = transactions.filter(
    (transaction) =>
      transaction.transfer_id &&
      transferIds.has(transaction.transfer_id) &&
      transaction.wallet_id !== walletId
  );
  const counterpartAdjustments = new Map();

  for (const transaction of pairedTransactions) {
    const amount = Number(transaction.amount) || 0;
    const delta = transaction.type === 'transfer_in' ? -amount : amount;
    const previous = counterpartAdjustments.get(transaction.wallet_id) || 0;
    counterpartAdjustments.set(transaction.wallet_id, previous + delta);
  }

  const walletUpdates = [];

  for (const [counterpartId, delta] of counterpartAdjustments) {
    const counterpart = findWallet(wallets, counterpartId);

    if (!counterpart) {
      continue;
    }

    const nextBalance = roundMoney((Number(counterpart.balance) || 0) + delta);

    if (nextBalance < 0) {
      throw new Error(
        `Dompet "${counterpart.name}" akan bernilai negatif karena transfer terkait. Pindahkan dana terlebih dahulu.`
      );
    }

    walletUpdates.push({
      ...counterpart,
      balance: nextBalance,
      updated_at: new Date().toISOString()
    });
  }

  const removedIds = new Set([
    ...ownTransactions.map((transaction) => transaction.id),
    ...pairedTransactions.map((transaction) => transaction.id)
  ]);
  const operations = [
    ...[...removedIds].map((id) => ({
      table: TRANSACTIONS_TABLE,
      type: 'delete',
      key: id
    })),
    ...walletUpdates.map((wallet) => ({ table: TABLE, value: wallet })),
    { table: TABLE, type: 'delete', key: walletId }
  ];

  await writeBatch(operations);
}

export async function listWalletTransactions(userId, walletId) {
  const transactions = await readUserRows(
    resolveUserId(userId),
    TRANSACTIONS_TABLE
  );

  return sortTransactions(
    transactions.filter((transaction) => transaction.wallet_id === walletId)
  );
}

export async function listAllWalletTransactions(userId) {
  return sortTransactions(
    await readUserRows(resolveUserId(userId), TRANSACTIONS_TABLE)
  );
}

export async function recordWalletTransaction({
  userId,
  walletId,
  type,
  amount,
  category,
  transactionDate,
  description,
  clientTransactionId
}) {
  const ownerId = resolveUserId(userId);
  const wallets = await readUserRows(ownerId, TABLE);
  const current = findWallet(wallets, walletId);

  if (!current) {
    throw new Error('Dompet tidak ditemukan.');
  }

  const normalizedType = String(type || '').toLowerCase();

  if (!['income', 'expense'].includes(normalizedType)) {
    throw new Error('Jenis transaksi dompet tidak valid.');
  }

  const value = assertAmount(amount);
  const date = assertDate(transactionDate);
  const isIncome = normalizedType === 'income';
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const normalizedCategory = categories.has(category)
    ? category
    : isIncome
      ? 'other_income'
      : 'other_expense';
  const balance = Number(current.balance) || 0;

  if (!isIncome && value > balance) {
    throw new Error('Saldo dompet tidak mencukupi.');
  }

  const now = new Date().toISOString();
  const nextBalance = isIncome ? balance + value : balance - value;
  const transactionRow = {
    id: clientTransactionId || createId(),
    user_id: ownerId,
    wallet_id: walletId,
    type: normalizedType,
    amount: value,
    category: normalizedCategory,
    transaction_date: date,
    description: String(description || '').trim().slice(0, 500) || null,
    transfer_id: null,
    counter_wallet_id: null,
    created_at: now
  };
  const updatedWallet = {
    ...current,
    balance: roundMoney(nextBalance),
    updated_at: now
  };

  await writeBatch([
    { table: TRANSACTIONS_TABLE, value: transactionRow },
    { table: TABLE, value: updatedWallet }
  ]);

  return transactionRow.id;
}

export async function recordWalletTransfer({
  userId,
  fromWalletId,
  toWalletId,
  amount,
  transactionDate,
  description,
  clientTransferId
}) {
  const ownerId = resolveUserId(userId);

  if (fromWalletId === toWalletId) {
    throw new Error('Dompet asal dan tujuan harus berbeda.');
  }

  const wallets = await readUserRows(ownerId, TABLE);
  const source = findWallet(wallets, fromWalletId);
  const destination = findWallet(wallets, toWalletId);

  if (!source) {
    throw new Error('Dompet asal tidak ditemukan.');
  }

  if (!destination) {
    throw new Error('Dompet tujuan tidak ditemukan.');
  }

  const value = assertAmount(amount, 'Nominal transfer');
  const date = assertDate(transactionDate);
  const sourceBalance = Number(source.balance) || 0;

  if (value > sourceBalance) {
    throw new Error('Saldo dompet asal tidak mencukupi.');
  }

  const now = new Date().toISOString();
  const transferId = clientTransferId || createId();
  const note = String(description || '').trim().slice(0, 500) || null;
  const outgoingRow = {
    id: createId(),
    user_id: ownerId,
    wallet_id: fromWalletId,
    type: 'transfer_out',
    amount: value,
    category: null,
    transaction_date: date,
    description: note,
    transfer_id: transferId,
    counter_wallet_id: toWalletId,
    created_at: now
  };
  const incomingRow = {
    id: createId(),
    user_id: ownerId,
    wallet_id: toWalletId,
    type: 'transfer_in',
    amount: value,
    category: null,
    transaction_date: date,
    description: note,
    transfer_id: transferId,
    counter_wallet_id: fromWalletId,
    created_at: now
  };

  await writeBatch([
    { table: TRANSACTIONS_TABLE, value: outgoingRow },
    { table: TRANSACTIONS_TABLE, value: incomingRow },
    {
      table: TABLE,
      value: {
        ...source,
        balance: roundMoney(sourceBalance - value),
        updated_at: now
      }
    },
    {
      table: TABLE,
      value: {
        ...destination,
        balance: roundMoney((Number(destination.balance) || 0) + value),
        updated_at: now
      }
    }
  ]);

  return transferId;
}

export function computeWalletSummary(
  wallets,
  transactions,
  reference = new Date()
) {
  const summary = {
    totalBalance: 0,
    count: wallets.length,
    incomeThisMonth: 0,
    expenseThisMonth: 0,
    netThisMonth: 0,
    transferCountThisMonth: 0
  };

  for (const wallet of wallets) {
    summary.totalBalance += Number(wallet.balance) || 0;
  }

  const countedTransfers = new Set();

  for (const transaction of transactions) {
    if (!isSameMonth(transaction.transaction_date, reference)) {
      continue;
    }

    const amount = Number(transaction.amount) || 0;

    if (transaction.type === 'income') {
      summary.incomeThisMonth += amount;
    } else if (transaction.type === 'expense') {
      summary.expenseThisMonth += amount;
    } else if (transaction.type === 'transfer_out' && transaction.transfer_id) {
      countedTransfers.add(transaction.transfer_id);
    }
  }

  summary.totalBalance = roundMoney(summary.totalBalance);
  summary.incomeThisMonth = roundMoney(summary.incomeThisMonth);
  summary.expenseThisMonth = roundMoney(summary.expenseThisMonth);
  summary.netThisMonth = roundMoney(
    summary.incomeThisMonth - summary.expenseThisMonth
  );
  summary.transferCountThisMonth = countedTransfers.size;

  return summary;
}

export function computeWalletTotals(transactions) {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount) || 0;

      if (transaction.type === 'income') {
        totals.totalIncome += amount;
      } else if (transaction.type === 'expense') {
        totals.totalExpense += amount;
      } else if (transaction.type === 'transfer_in') {
        totals.totalTransferIn += amount;
      } else if (transaction.type === 'transfer_out') {
        totals.totalTransferOut += amount;
      }

      return totals;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      totalTransferIn: 0,
      totalTransferOut: 0
    }
  );
}
