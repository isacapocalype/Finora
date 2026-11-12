// FINORA — OFFLINE HISTORY CACHE
// Menjaga cache riwayat tetap sinkron saat pengguna menulis tanpa internet.

import { removeRow, upsertRow } from './db.js';

const TABLE = 'transaction_history';

function baseHistoryRow({
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
    created_at: createdAt || new Date().toISOString()
  };
}

export async function cacheDebtHistory(debt) {
  return upsertRow(
    TABLE,
    baseHistoryRow({
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

export async function cacheDebtPaymentHistory(payment, debt) {
  return upsertRow(
    TABLE,
    baseHistoryRow({
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

export async function cacheReceivableHistory(receivable) {
  return upsertRow(
    TABLE,
    baseHistoryRow({
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

export async function cacheReceivablePaymentHistory(payment, receivable) {
  return upsertRow(
    TABLE,
    baseHistoryRow({
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

export async function cacheSavingsTransactionHistory(transaction, savings) {
  const isDeposit = transaction.type === 'deposit';

  return upsertRow(
    TABLE,
    baseHistoryRow({
      id: transaction.id,
      userId: transaction.user_id,
      category: isDeposit ? 'savings_deposit' : 'savings_withdrawal',
      title: isDeposit
        ? `Setoran tabungan ${savings.name}`
        : `Penarikan tabungan ${savings.name}`,
      description: transaction.description,
      amount: transaction.amount,
      direction: isDeposit ? '-' : '+',
      transactionDate: transaction.transaction_date,
      createdAt: transaction.created_at
    })
  );
}

export async function removeHistoryEntry(id) {
  return removeRow(TABLE, id);
}
