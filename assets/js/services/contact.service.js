// FINORA — CONTACT SERVICE (local)
// Satu kontak mewakili orang yang sama pada utang maupun piutang.

import { createId } from '../storage/id.js';
import { readFromStore, readUserRows, upsertRow } from '../storage/db.js';
import { resolveUserId } from '../local.js';
import { normalizeNameKey } from '../utils.js';

const TABLE = 'contacts';
const DEFAULT_NAME = 'Tanpa Nama';

function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export async function listContacts(userId) {
  const rows = await readUserRows(resolveUserId(userId), TABLE);
  return [...rows].sort((first, second) =>
    String(first.name || '').localeCompare(String(second.name || ''), 'id')
  );
}

export async function getContact(userId, contactId) {
  if (!contactId) {
    return null;
  }

  const row = await readFromStore(TABLE, contactId);
  return row && row.user_id === resolveUserId(userId) ? row : null;
}

export async function resolveContact(userId, { contactId, name } = {}) {
  const ownerId = resolveUserId(userId);
  const existing = await getContact(ownerId, contactId);

  if (existing) {
    return existing;
  }

  const safeName = cleanName(name) || DEFAULT_NAME;
  const nameKey = normalizeNameKey(safeName) || 'tanpa-nama';
  const contacts = await readUserRows(ownerId, TABLE);
  const matched = contacts.find(
    (contact) => contact.name_key === nameKey
  );

  if (matched) {
    return matched;
  }

  const now = new Date().toISOString();
  const contact = {
    id: createId(),
    user_id: ownerId,
    name: safeName,
    name_key: nameKey,
    photo: null,
    created_at: now,
    updated_at: now
  };

  await upsertRow(TABLE, contact);

  return contact;
}

export async function updateContactName(userId, contactId, name) {
  const ownerId = resolveUserId(userId);
  const current = await getContact(ownerId, contactId);

  if (!current) {
    throw new Error('Kontak tidak ditemukan.');
  }

  const safeName = cleanName(name) || DEFAULT_NAME;
  const nameKey = normalizeNameKey(safeName) || 'tanpa-nama';
  const contacts = await readUserRows(ownerId, TABLE);
  const duplicate = contacts.find(
    (contact) => contact.id !== contactId && contact.name_key === nameKey
  );

  if (duplicate) {
    throw new Error('Nama tersebut sudah dipakai kontak lain.');
  }

  const updated = {
    ...current,
    name: safeName,
    name_key: nameKey,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function setContactPhoto(userId, contactId, photo) {
  const ownerId = resolveUserId(userId);
  const current = await getContact(ownerId, contactId);

  if (!current) {
    throw new Error('Kontak tidak ditemukan.');
  }

  const updated = {
    ...current,
    photo: String(photo || ''),
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function removeContactPhoto(userId, contactId) {
  return setContactPhoto(userId, contactId, '');
}
