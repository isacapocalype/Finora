// FINORA — RECEIVABLE SERVICE (local)
// Piutang, penambahan pokok, dan pengembaliannya disimpan di IndexedDB.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { resolveContact } from './contact.service.js';
import { calcRemaining, roundMoney } from '../utils.js';

const TABLE = 'receivables';
const ADDITIONS_TABLE = 'receivable_additions';
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

function sortAdditions(rows) {
  return [...rows].sort(
    (first, second) =>
      String(second.addition_date || '').localeCompare(
        String(first.addition_date || '')
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

function statusFor(amount, received) {
  if (received <= 0) {
    return 'unpaid';
  }

  return received >= amount ? 'paid' : 'partial';
}

function initialAmountFor(row, additionsTotal) {
  return row.initial_amount === undefined
    ? roundMoney(Number(row.amount) - additionsTotal)
    : roundMoney(row.initial_amount);
}

export async function listReceivables(userId) {
  return sortReceivables(await readUserRows(resolveUserId(userId), TABLE));
}

export async function createReceivable(userId, payload) {
  const ownerId = resolveUserId(userId);
  const amount = roundMoney(payload.amount);
  const contact = await resolveContact(ownerId, {
    contactId: payload.contactId,
    name: payload.borrowerName
  });
  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    contact_id: contact.id,
    borrower_name: contact.name,
    initial_amount: amount,
    amount,
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
  const [receivables, additions] = await Promise.all([
    readUserRows(ownerId, TABLE),
    readUserRows(ownerId, ADDITIONS_TABLE)
  ]);
  const current = receivables.find(
    (receivable) => receivable.id === receivableId
  );

  if (!current) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const receivableAdditions = additions.filter(
    (addition) => addition.receivable_id === receivableId
  );
  const additionsTotal = receivableAdditions.reduce(
    (total, addition) => total + Number(addition.amount || 0),
    0
  );
  const currentInitial = initialAmountFor(current, additionsTotal);
  const initialAmount = roundMoney(
    payload.initialAmount === undefined
      ? payload.amount === undefined
        ? currentInitial
        : payload.amount
      : payload.initialAmount
  );
  const totalAmount = roundMoney(initialAmount + additionsTotal);
  const received = Number(current.received_amount) || 0;

  if (totalAmount < received) {
    throw new Error(
      'Nominal piutang tidak boleh lebih kecil dari total pengembalian.'
    );
  }

  const contact = await resolveContact(ownerId, {
    contactId: payload.contactId,
    name: payload.borrowerName ?? current.borrower_name
  });

  const updated = {
    ...current,
    contact_id: contact.id,
    borrower_name: contact.name,
    initial_amount: initialAmount,
    amount: totalAmount,
    transaction_date: payload.transactionDate ?? current.transaction_date,
    due_date:
      payload.dueDate === undefined ? current.due_date : payload.dueDate || null,
    description:
      payload.description === undefined
        ? current.description
        : payload.description || null,
    status: statusFor(totalAmount, received),
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteReceivable(userId, receivableId) {
  const ownerId = resolveUserId(userId);
  const [receivables, additions, payments] = await Promise.all([
    readUserRows(ownerId, TABLE),
    readUserRows(ownerId, ADDITIONS_TABLE),
    readUserRows(ownerId, PAYMENTS_TABLE)
  ]);

  if (!receivables.some((receivable) => receivable.id === receivableId)) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const operations = [
    { table: TABLE, type: 'delete', key: receivableId },
    ...additions
      .filter((addition) => addition.receivable_id === receivableId)
      .map((addition) => ({
        table: ADDITIONS_TABLE,
        type: 'delete',
        key: addition.id
      })),
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

export async function listReceivableAdditions(userId, receivableId) {
  const additions = await listAllReceivableAdditions(userId);
  return additions.filter(
    (addition) => addition.receivable_id === receivableId
  );
}

export async function listAllReceivableAdditions(userId) {
  return sortAdditions(
    await readUserRows(resolveUserId(userId), ADDITIONS_TABLE)
  );
}

export async function listReceivablePayments(userId, receivableId) {
  const payments = await listAllReceivablePayments(userId);
  return payments.filter(
    (payment) => payment.receivable_id === receivableId
  );
}

export async function listAllReceivablePayments(userId) {
  return sortPayments(
    await readUserRows(resolveUserId(userId), PAYMENTS_TABLE)
  );
}

export async function addReceivablePrincipal({
  userId,
  receivableId,
  amount,
  additionDate,
  description,
  clientAdditionId
}) {
  const ownerId = resolveUserId(userId);
  const receivables = await readUserRows(ownerId, TABLE);
  const receivable = receivables.find((item) => item.id === receivableId);

  if (!receivable) {
    throw new Error('Piutang tidak ditemukan.');
  }

  const additionAmount = roundMoney(amount);

  if (!Number.isFinite(additionAmount) || additionAmount <= 0) {
    throw new Error('Nominal penambahan harus lebih besar dari nol.');
  }

  const now = new Date().toISOString();
  const nextAmount = roundMoney(Number(receivable.amount) + additionAmount);
  const additionRow = {
    id: clientAdditionId || createId(),
    receivable_id: receivableId,
    user_id: receivable.user_id,
    amount: additionAmount,
    addition_date: additionDate,
    description: description || null,
    created_at: now
  };
  const updatedReceivable = {
    ...receivable,
    initial_amount:
      receivable.initial_amount === undefined
        ? roundMoney(Number(receivable.amount))
        : Number(receivable.initial_amount),
    amount: nextAmount,
    status: statusFor(nextAmount, Number(receivable.received_amount) || 0),
    updated_at: now
  };

  await writeBatch([
    { table: ADDITIONS_TABLE, value: additionRow },
    { table: TABLE, value: updatedReceivable }
  ]);

  return additionRow;
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
    status: statusFor(Number(receivable.amount), nextReceived),
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
