// FINORA — HISTORY SERVICE (local)
// Riwayat dibentuk dari data utang, piutang, dan tabungan di perangkat.

import { HISTORY_GROUPS } from '../utils.js';
import { readUserRows } from '../storage/db.js';
import { resolveUserId } from '../local.js';

const SORT_OPTIONS = {
  newest: { column: 'transaction_date', ascending: false },
  oldest: { column: 'transaction_date', ascending: true },
  amount_desc: { column: 'amount', ascending: false },
  amount_asc: { column: 'amount', ascending: true }
};

function historyRow({
  id,
  userId,
  category,
  title,
  description,
  amount,
  direction,
  transactionDate,
  createdAt
}) {
  return {
    id,
    user_id: userId,
    category,
    title,
    description: description || '',
    amount: Number(amount) || 0,
    direction,
    transaction_date: transactionDate,
    created_at: createdAt || ''
  };
}

export function buildHistoryRows({
  debts = [],
  debtAdditions = [],
  debtPayments = [],
  receivables = [],
  receivableAdditions = [],
  receivablePayments = [],
  savings = [],
  savingsTransactions = []
} = {}) {
  const debtMap = new Map(debts.map((debt) => [debt.id, debt]));
  const receivableMap = new Map(
    receivables.map((receivable) => [receivable.id, receivable])
  );
  const savingsMap = new Map(savings.map((item) => [item.id, item]));
  const rows = [];

  for (const debt of debts) {
    rows.push(
      historyRow({
        id: debt.id,
        userId: debt.user_id,
        category: 'debt_created',
        title: `Utang kepada ${debt.lender_name}`,
        description: debt.description,
        amount: debt.amount,
        direction: '+',
        transactionDate: debt.transaction_date,
        createdAt: debt.created_at
      })
    );
  }

  for (const addition of debtAdditions) {
    const debt = debtMap.get(addition.debt_id);

    if (!debt) {
      continue;
    }

    rows.push(
      historyRow({
        id: addition.id,
        userId: addition.user_id,
        category: 'debt_addition',
        title: `Penambahan utang kepada ${debt.lender_name}`,
        description: addition.description,
        amount: addition.amount,
        direction: '+',
        transactionDate: addition.addition_date,
        createdAt: addition.created_at
      })
    );
  }

  for (const payment of debtPayments) {
    const debt = debtMap.get(payment.debt_id);

    if (!debt) {
      continue;
    }

    rows.push(
      historyRow({
        id: payment.id,
        userId: payment.user_id,
        category: 'debt_payment',
        title: `Pembayaran utang kepada ${debt.lender_name}`,
        description: payment.description,
        amount: payment.amount,
        direction: '-',
        transactionDate: payment.payment_date,
        createdAt: payment.created_at
      })
    );
  }

  for (const receivable of receivables) {
    rows.push(
      historyRow({
        id: receivable.id,
        userId: receivable.user_id,
        category: 'receivable_created',
        title: `Piutang kepada ${receivable.borrower_name}`,
        description: receivable.description,
        amount: receivable.amount,
        direction: '-',
        transactionDate: receivable.transaction_date,
        createdAt: receivable.created_at
      })
    );
  }

  for (const addition of receivableAdditions) {
    const receivable = receivableMap.get(addition.receivable_id);

    if (!receivable) {
      continue;
    }

    rows.push(
      historyRow({
        id: addition.id,
        userId: addition.user_id,
        category: 'receivable_addition',
        title: `Penambahan piutang kepada ${receivable.borrower_name}`,
        description: addition.description,
        amount: addition.amount,
        direction: '-',
        transactionDate: addition.addition_date,
        createdAt: addition.created_at
      })
    );
  }

  for (const payment of receivablePayments) {
    const receivable = receivableMap.get(payment.receivable_id);

    if (!receivable) {
      continue;
    }

    rows.push(
      historyRow({
        id: payment.id,
        userId: payment.user_id,
        category: 'receivable_payment',
        title: `Pengembalian piutang dari ${receivable.borrower_name}`,
        description: payment.description,
        amount: payment.amount,
        direction: '+',
        transactionDate: payment.payment_date,
        createdAt: payment.created_at
      })
    );
  }

  for (const transaction of savingsTransactions) {
    const item = savingsMap.get(transaction.savings_id);

    if (!item) {
      continue;
    }

    const isDeposit = transaction.type === 'deposit';

    rows.push(
      historyRow({
        id: transaction.id,
        userId: transaction.user_id,
        category: isDeposit ? 'savings_deposit' : 'savings_withdrawal',
        title: isDeposit
          ? `Setoran tabungan ${item.name}`
          : `Penarikan tabungan ${item.name}`,
        description: transaction.description,
        amount: transaction.amount,
        direction: isDeposit ? '-' : '+',
        transactionDate: transaction.transaction_date,
        createdAt: transaction.created_at
      })
    );
  }

  return rows;
}

async function loadHistorySource(userId) {
  const ownerId = resolveUserId(userId);
  const [
    debts,
    debtAdditions,
    debtPayments,
    receivables,
    receivableAdditions,
    receivablePayments,
    savings,
    savingsTransactions
  ] = await Promise.all([
    readUserRows(ownerId, 'debts'),
    readUserRows(ownerId, 'debt_additions'),
    readUserRows(ownerId, 'debt_payments'),
    readUserRows(ownerId, 'receivables'),
    readUserRows(ownerId, 'receivable_additions'),
    readUserRows(ownerId, 'receivable_payments'),
    readUserRows(ownerId, 'savings'),
    readUserRows(ownerId, 'savings_transactions')
  ]);

  return {
    debts,
    debtAdditions,
    debtPayments,
    receivables,
    receivableAdditions,
    receivablePayments,
    savings,
    savingsTransactions
  };
}

function sortHistory(rows, sortOption) {
  const direction = sortOption.ascending ? 1 : -1;

  return [...rows].sort((first, second) => {
    const comparison =
      sortOption.column === 'amount'
        ? Number(first.amount) - Number(second.amount)
        : String(first.transaction_date || '').localeCompare(
            String(second.transaction_date || '')
          );

    if (comparison !== 0) {
      return comparison * direction;
    }

    return String(second.created_at || '').localeCompare(
      String(first.created_at || '')
    );
  });
}

export async function listHistory({
  userId,
  group = 'all',
  dateFrom = '',
  dateTo = '',
  search = '',
  sort = 'newest',
  page = 1,
  pageSize = 10
}) {
  const source = await loadHistorySource(userId);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(50, Number(pageSize) || 10));
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const rows = buildHistoryRows(source).filter((row) => {
    if (group !== 'all' && HISTORY_GROUPS[group]) {
      if (!HISTORY_GROUPS[group].includes(row.category)) {
        return false;
      }
    }

    const transactionDate = String(row.transaction_date || '');

    if (dateFrom && transactionDate < dateFrom) {
      return false;
    }

    if (dateTo && transactionDate > dateTo) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = `${row.title || ''} ${row.description || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    }

    return true;
  });
  const sorted = sortHistory(
    rows,
    SORT_OPTIONS[sort] || SORT_OPTIONS.newest
  );
  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const start = (safePage - 1) * safePageSize;

  return {
    rows: sorted.slice(start, start + safePageSize),
    count: totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages
  };
}

export async function listRecentHistory(userId, limit = 6) {
  const source = await loadHistorySource(userId);
  const sorted = sortHistory(buildHistoryRows(source), SORT_OPTIONS.newest);

  return sorted.slice(0, Math.max(1, Number(limit) || 6));
}
