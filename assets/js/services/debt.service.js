// FINORA — DEBT SERVICE (local)
// Utang, penambahan pokok, dan pembayarannya disimpan di IndexedDB.

import { createId } from '../storage/id.js';
import { readUserRows, upsertRow, writeBatch } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { resolveContact } from './contact.service.js';
import { calcRemaining, roundMoney } from '../utils.js';

const TABLE = 'debts';
const ADDITIONS_TABLE = 'debt_additions';
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

function statusFor(amount, paid) {
  if (paid <= 0) {
    return 'unpaid';
  }

  return paid >= amount ? 'paid' : 'partial';
}

function initialAmountFor(row, additionsTotal) {
  return row.initial_amount === undefined
    ? roundMoney(Number(row.amount) - additionsTotal)
    : roundMoney(row.initial_amount);
}

export async function listDebts(userId) {
  return sortDebts(await readUserRows(resolveUserId(userId), TABLE));
}

export async function createDebt(userId, payload) {
  const ownerId = resolveUserId(userId);
  const amount = roundMoney(payload.amount);
  const contact = await resolveContact(ownerId, {
    contactId: payload.contactId,
    name: payload.lenderName
  });
  const now = new Date().toISOString();
  const row = {
    id: payload.id || createId(),
    user_id: ownerId,
    contact_id: contact.id,
    lender_name: contact.name,
    initial_amount: amount,
    amount,
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
  const [debts, additions] = await Promise.all([
    readUserRows(ownerId, TABLE),
    readUserRows(ownerId, ADDITIONS_TABLE)
  ]);
  const current = debts.find((debt) => debt.id === debtId);

  if (!current) {
    throw new Error('Utang tidak ditemukan.');
  }

  const debtAdditions = additions.filter(
    (addition) => addition.debt_id === debtId
  );
  const additionsTotal = debtAdditions.reduce(
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
  const paid = Number(current.paid_amount) || 0;

  if (totalAmount < paid) {
    throw new Error(
      'Nominal utang tidak boleh lebih kecil dari total pembayaran.'
    );
  }

  const contact = await resolveContact(ownerId, {
    contactId: payload.contactId,
    name: payload.lenderName ?? current.lender_name
  });

  const updated = {
    ...current,
    contact_id: contact.id,
    lender_name: contact.name,
    initial_amount: initialAmount,
    amount: totalAmount,
    transaction_date: payload.transactionDate ?? current.transaction_date,
    due_date:
      payload.dueDate === undefined ? current.due_date : payload.dueDate || null,
    description:
      payload.description === undefined
        ? current.description
        : payload.description || null,
    status: statusFor(totalAmount, paid),
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function deleteDebt(userId, debtId) {
  const ownerId = resolveUserId(userId);
  const [debts, additions, payments] = await Promise.all([
    readUserRows(ownerId, TABLE),
    readUserRows(ownerId, ADDITIONS_TABLE),
    readUserRows(ownerId, PAYMENTS_TABLE)
  ]);

  if (!debts.some((debt) => debt.id === debtId)) {
    throw new Error('Utang tidak ditemukan.');
  }

  const operations = [
    { table: TABLE, type: 'delete', key: debtId },
    ...additions
      .filter((addition) => addition.debt_id === debtId)
      .map((addition) => ({
        table: ADDITIONS_TABLE,
        type: 'delete',
        key: addition.id
      })),
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

export async function listDebtAdditions(userId, debtId) {
  const additions = await listAllDebtAdditions(userId);
  return additions.filter((addition) => addition.debt_id === debtId);
}

export async function listAllDebtAdditions(userId) {
  return sortAdditions(
    await readUserRows(resolveUserId(userId), ADDITIONS_TABLE)
  );
}

export async function listDebtPayments(userId, debtId) {
  const payments = await listAllDebtPayments(userId);
  return payments.filter((payment) => payment.debt_id === debtId);
}

export async function listAllDebtPayments(userId) {
  return sortPayments(await readUserRows(resolveUserId(userId), PAYMENTS_TABLE));
}

export async function addDebtPrincipal({
  userId,
  debtId,
  amount,
  additionDate,
  description,
  clientAdditionId
}) {
  const ownerId = resolveUserId(userId);
  const debts = await readUserRows(ownerId, TABLE);
  const debt = debts.find((item) => item.id === debtId);

  if (!debt) {
    throw new Error('Utang tidak ditemukan.');
  }

  const additionAmount = roundMoney(amount);

  if (!Number.isFinite(additionAmount) || additionAmount <= 0) {
    throw new Error('Nominal penambahan harus lebih besar dari nol.');
  }

  const now = new Date().toISOString();
  const nextAmount = roundMoney(Number(debt.amount) + additionAmount);
  const additionRow = {
    id: clientAdditionId || createId(),
    debt_id: debtId,
    user_id: debt.user_id,
    amount: additionAmount,
    addition_date: additionDate,
    description: description || null,
    created_at: now
  };
  const updatedDebt = {
    ...debt,
    initial_amount:
      debt.initial_amount === undefined
        ? roundMoney(Number(debt.amount))
        : Number(debt.initial_amount),
    amount: nextAmount,
    status: statusFor(nextAmount, Number(debt.paid_amount) || 0),
    updated_at: now
  };

  await writeBatch([
    { table: ADDITIONS_TABLE, value: additionRow },
    { table: TABLE, value: updatedDebt }
  ]);

  return additionRow;
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
    status: statusFor(Number(debt.amount), nextPaid),
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
