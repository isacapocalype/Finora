// FINORA — RECEIVABLE SERVICE (local)
// Piutang dan pengembaliannya dibaca serta ditulis langsung dari IndexedDB.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { calcRemaining, roundMoney } from '../utils.js';

const TABLE = 'receivables';
const PAYMENTS_TABLE = 'receivable_payments';

function sortReceivables(rows) {
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

export async function listReceivables(userId) {
  return sortReceivables(await readUserRows(resolveUserId(userId), TABLE));
}

export async function createReceivable(userId, payload) {
  const ownerId = resolveUserId(userId);
  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    borrower_name: payload.borrowerName,
    amount: roundMoney(payload.amount),
    received_amount: 0,
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

export async function updateReceivable(userId, receivableId, payload) {
  const ownerId = resolveUserId(userId);
  const receivables = await readUserRows(ownerId, TABLE);
  const current = receivables.find(
    (receivable) => receivable.id === receivableId
  );

  if (!current) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const amount = roundMoney(payload.amount);
  const received = Number(current.received_amount) || 0;

  if (amount < received) {
    throw new Error(
      'Nominal piutang tidak boleh lebih kecil dari total pengembalian.'
    );
  }

  const updated = {
    ...current,
    borrower_name: payload.borrowerName,
    amount,
    transaction_date: payload.transactionDate,
    due_date: payload.dueDate || null,
    description: payload.description || null,
    status:
      received <= 0 ? 'unpaid' : received >= amount ? 'paid' : 'partial',
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteReceivable(userId, receivableId) {
  const ownerId = resolveUserId(userId);
  const receivables = await readUserRows(ownerId, TABLE);

  if (!receivables.some((receivable) => receivable.id === receivableId)) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const payments = await readUserRows(ownerId, PAYMENTS_TABLE);
  const operations = [
    { table: TABLE, type: 'delete', key: receivableId },
    ...payments
      .filter((payment) => payment.receivable_id === receivableId)
      .map((payment) => ({
        table: PAYMENTS_TABLE,
        type: 'delete',
        key: payment.id
      }))
  ];

  await writeBatch(operations);
}

export async function listReceivablePayments(userId, receivableId) {
  const payments = await readUserRows(resolveUserId(userId), PAYMENTS_TABLE);
  return sortPayments(
    payments.filter((payment) => payment.receivable_id === receivableId)
  );
}

export async function recordReceivablePayment({
  userId,
  receivableId,
  amount,
  paymentDate,
  description,
  clientPaymentId
}) {
  const ownerId = resolveUserId(userId);
  const receivables = await readUserRows(ownerId, TABLE);
  const receivable = receivables.find((item) => item.id === receivableId);

  if (!receivable) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const paymentAmount = roundMoney(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Nominal pengembalian harus lebih besar dari nol.');
  }

  const remaining = roundMoney(
    Number(receivable.amount) - Number(receivable.received_amount)
  );

  if (remaining <= 0) {
    throw new Error('Piutang ini sudah lunas.');
  }

  if (paymentAmount > remaining) {
    throw new Error('Nominal pengembalian melebihi sisa piutang.');
  }

  const now = new Date().toISOString();
  const nextReceived = roundMoney(
    Number(receivable.received_amount) + paymentAmount
  );
  const paymentRow = {
    id: clientPaymentId || createId(),
    receivable_id: receivableId,
    user_id: receivable.user_id,
    amount: paymentAmount,
    payment_date: paymentDate,
    description: description || null,
    created_at: now
  };
  const updatedReceivable = {
    ...receivable,
    received_amount: nextReceived,
    status:
      nextReceived >= Number(receivable.amount) ? 'paid' : 'partial',
    updated_at: now
  };

  await writeBatch([
    { table: PAYMENTS_TABLE, value: paymentRow },
    { table: TABLE, value: updatedReceivable }
  ]);

  return paymentRow.id;
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
