// FINORA — OFFLINE OUTBOX
// Antrean operasi offline yang akan disinkronisasi ke server saat online.

import { deleteFromStore, putToStore, readFromStore } from './db.js';

const OUTBOX_STORE = 'outbox';

let queueSequence = 0;

function nextSequence() {
  queueSequence = Math.max(Date.now(), queueSequence + 1);
  return queueSequence;
}

export async function enqueueOutboxOp(op) {
  return putToStore(OUTBOX_STORE, {
    ...op,
    sequence: nextSequence()
  });
}

export async function listPendingOutboxOps(userId) {
  const ops = await readFromStore(OUTBOX_STORE);

  return (Array.isArray(ops) ? ops : [])
    .filter((op) => !userId || op.userId === userId)
    .sort((first, second) => {
      const byTime = String(first.createdAt || '').localeCompare(
        String(second.createdAt || '')
      );

      if (byTime !== 0) {
        return byTime;
      }

      return (Number(first.sequence) || 0) - (Number(second.sequence) || 0);
    });
}

export async function countPendingOutboxOps(userId) {
  const ops = await listPendingOutboxOps(userId);
  return ops.length;
}

export async function removeOutboxOp(id) {
  return deleteFromStore(OUTBOX_STORE, id);
}
