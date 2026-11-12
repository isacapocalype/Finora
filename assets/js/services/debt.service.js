// FINORA — DEBT SERVICE (local)
// Utang dan pembayarannya dibaca serta ditulis langsung dari IndexedDB.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { calcRemaining, roundMoney } from '../utils.js';

const TABLE = 'debts';
const PAYMENTS_TABLE = 'debt_payments';

function sortDebts(rows) {
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

function sortPayments(rows) {
  return [...rows].sort(
    (first, second) =>
      String(second.payment_date || '').localeCompare(
        String(first.payment_date || '')
      ) ||
      String(second.created_at || '').localeCompare(
        String(first.created_at || '')
      )
  );
}

export async function listDebts(userId) {
  return sortDebts(await readUserRows(resolveUserId(userId), TABLE));
}

export async function createDebt(userId, payload) {
  const ownerId = resolveUserId(userId);
  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    lender_name: payload.lenderName,
    amount: roundMoney(payload.amount),
    paid_amount: 0,
    transaction_date: payload.transactionDate,
    due_date: payload.dueDate || null,
    description: payload.description || null,
    status: 'unpaid',
    created_at: now,
    updated_at: now
  };

  await upsertRow(TABLE, row);

  return row;
}

export async function updateDebt(userId, debtId, payload) {
  const ownerId = resolveUserId(userId);
  const debts = await readUserRows(ownerId, TABLE);
  const current = debts.find((debt) => debt.id === debtId);

  if (!current) {
    throw new Error('Utang tidak ditemukan.');
  }

  const amount = roundMoney(payload.amount);
  const paid = Number(current.paid_amount) || 0;

  if (amount < paid) {
    throw new Error(
      'Nominal utang tidak boleh lebih kecil dari total pembayaran.'
    );
  }

  const updated = {
    ...current,
    lender_name: payload.lenderName,
    amount,
    transaction_date: payload.transactionDate,
    due_date: payload.dueDate || null,
    description: payload.description || null,
    status: paid <= 0 ? 'unpaid' : paid >= amount ? 'paid' : 'partial',
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteDebt(userId, debtId) {
  const ownerId = resolveUserId(userId);
  const debts = await readUserRows(ownerId, TABLE);

  if (!debts.some((debt) => debt.id === debtId)) {
    throw new Error('Utang tidak ditemukan.');
  }

  const payments = await readUserRows(ownerId, PAYMENTS_TABLE);
  const operations = [
    { table: TABLE, type: 'delete', key: debtId },
    ...payments
      .filter((payment) => payment.debt_id === debtId)
      .map((payment) => ({
        table: PAYMENTS_TABLE,
        type: 'delete',
        key: payment.id
      }))
  ];

  await writeBatch(operations);
}

export async function listDebtPayments(userId, debtId) {
  const payments = await readUserRows(resolveUserId(userId), PAYMENTS_TABLE);
  return sortPayments(
    payments.filter((payment) => payment.debt_id === debtId)
  );
}

export async function recordDebtPayment({
  userId,
  debtId,
  amount,
  paymentDate,
  description,
  clientPaymentId
}) {
  const ownerId = resolveUserId(userId);
  const debts = await readUserRows(ownerId, TABLE);
  const debt = debts.find((item) => item.id === debtId);

  if (!debt) {
    throw new Error('Utang tidak ditemukan.');
  }

  const paymentAmount = roundMoney(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Nominal pembayaran harus lebih besar dari nol.');
  }

  const remaining = roundMoney(
    Number(debt.amount) - Number(debt.paid_amount)
  );

  if (remaining <= 0) {
    throw new Error('Utang ini sudah lunas.');
  }

  if (paymentAmount > remaining) {
    throw new Error('Nominal pembayaran melebihi sisa utang.');
  }

  const now = new Date().toISOString();
  const nextPaid = roundMoney(Number(debt.paid_amount) + paymentAmount);
  const paymentRow = {
    id: clientPaymentId || createId(),
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

  await writeBatch([
    { table: PAYMENTS_TABLE, value: paymentRow },
    { table: TABLE, value: updatedDebt }
  ]);

  return paymentRow.id;
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
