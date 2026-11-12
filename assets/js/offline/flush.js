// FINORA — OFFLINE FLUSH
// Mengirim antrean operasi offline ke server secara berurutan.
// Operasi hanya dihapus dari outbox setelah server mengonfirmasi.

import { writeMeta } from './db.js';
import { isOnline } from './network.js';
import { isNetworkError } from './errors.js';
import { countPendingOutboxOps, listPendingOutboxOps, removeOutboxOp } from './outbox.js';
import {
  createDebt,
  deleteDebt,
  recordDebtPayment,
  updateDebt
} from '../services/debt.service.js';
import {
  createReceivable,
  deleteReceivable,
  recordReceivablePayment,
  updateReceivable
} from '../services/receivable.service.js';
import {
  createSavings,
  deleteSavings,
  recordSavingsTransaction,
  updateSavings
} from '../services/savings.service.js';
import { updateProfile } from '../services/profile.service.js';

export const SYNC_EVENT = 'finora:sync';

let activeFlush = null;

function emitSyncStatus(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
}

function isAlreadyApplied(op, error) {
  if (!error) {
    return false;
  }

  if (error.code === '23505' || error.code === 'PGRST116') {
    return true;
  }

  const message = String(error.message || '');

  return (
    /tidak ditemukan/i.test(message) &&
    (op.type.endsWith('.delete') || op.type.endsWith('.update'))
  );
}

async function applyOperation(op) {
  switch (op.type) {
    case 'debt.create':
      return createDebt(op.userId, op.payload);
    case 'debt.update':
      return updateDebt(op.userId, op.debtId, op.payload);
    case 'debt.delete':
      return deleteDebt(op.userId, op.debtId);
    case 'debt.payment':
      return recordDebtPayment({
        debtId: op.debtId,
        amount: op.amount,
        paymentDate: op.paymentDate,
        description: op.description,
        clientPaymentId: op.clientPaymentId
      });

    case 'receivable.create':
      return createReceivable(op.userId, op.payload);
    case 'receivable.update':
      return updateReceivable(op.userId, op.receivableId, op.payload);
    case 'receivable.delete':
      return deleteReceivable(op.userId, op.receivableId);
    case 'receivable.payment':
      return recordReceivablePayment({
        receivableId: op.receivableId,
        amount: op.amount,
        paymentDate: op.paymentDate,
        description: op.description,
        clientPaymentId: op.clientPaymentId
      });

    case 'savings.create':
      return createSavings(op.userId, op.payload);
    case 'savings.update':
      return updateSavings(op.userId, op.savingsId, op.payload);
    case 'savings.delete':
      return deleteSavings(op.userId, op.savingsId);
    case 'savings.transaction':
      return recordSavingsTransaction({
        savingsId: op.savingsId,
        type: op.transactionType,
        amount: op.amount,
        transactionDate: op.transactionDate,
        description: op.description,
        clientTransactionId: op.clientTransactionId
      });

    case 'profile.update':
      return updateProfile(op.userId, op.payload);

    default:
      throw new Error(`Jenis operasi offline tidak dikenal: ${op.type}`);
  }
}

async function runFlush(userId) {
  const ops = await listPendingOutboxOps(userId);

  if (!ops.length) {
    emitSyncStatus({ status: 'completed', processed: 0, pending: 0, failure: null });
    return { processed: 0, pending: 0, failure: null };
  }

  emitSyncStatus({
    status: 'started',
    processed: 0,
    pending: ops.length,
    failure: null
  });

  let processed = 0;
  let failure = null;

  for (const op of ops) {
    try {
      await applyOperation(op);
      await removeOutboxOp(op.id);
      processed += 1;
    } catch (error) {
      if (isAlreadyApplied(op, error)) {
        await removeOutboxOp(op.id);
        processed += 1;
        continue;
      }

      failure = {
        type: op.type,
        message: error?.message || 'Sinkronisasi gagal.',
        retryable: isNetworkError(error)
      };
      break;
    }
  }

  const pending = await countPendingOutboxOps(userId);

  if (failure) {
    await writeMeta('last_sync_error', {
      ...failure,
      at: new Date().toISOString()
    });
  } else {
    await writeMeta('last_sync_error', null);
  }

  emitSyncStatus({
    status: failure ? 'error' : 'completed',
    processed,
    pending,
    failure
  });

  return { processed, pending, failure };
}

export function flushOutbox(userId) {
  if (!isOnline()) {
    return Promise.resolve({ processed: 0, pending: null, failure: null, offline: true });
  }

  if (activeFlush) {
    return activeFlush;
  }

  activeFlush = runFlush(userId).catch(async (error) => {
    const pending = await countPendingOutboxOps(userId).catch(() => null);
    const failure = {
      type: 'flush',
      message: error?.message || 'Sinkronisasi gagal.',
      retryable: isNetworkError(error)
    };

    emitSyncStatus({ status: 'error', processed: 0, pending, failure });
    return { processed: 0, pending, failure };
  });

  const current = activeFlush;
  current.then(
    () => {
      if (activeFlush === current) {
        activeFlush = null;
      }
    },
    () => {
      if (activeFlush === current) {
        activeFlush = null;
      }
    }
  );

  return current;
}
