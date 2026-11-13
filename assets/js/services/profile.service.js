// FINORA — PROFILE SERVICE (local)
// Profil tunggal perangkat, tanpa akun atau server.

import { readFromStore, upsertRow } from '../storage/db.js';
import { LOCAL_USER_ID, resolveUserId } from '../local.js';

const TABLE = 'profiles';
const DEFAULT_NAME = 'Pengguna Finora';

function defaultProfile(userId) {
  const now = new Date().toISOString();

  return {
    id: resolveUserId(userId),
    full_name: DEFAULT_NAME,
    currency: 'IDR',
    photo: null,
    created_at: now,
    updated_at: now
  };
}

export async function getProfile(userId = LOCAL_USER_ID) {
  const row = await readFromStore(TABLE, resolveUserId(userId));
  return row || null;
}

export async function getOrCreateProfile(user) {
  const userId = resolveUserId(user?.id);
  const existing = await getProfile(userId);

  if (existing) {
    return existing;
  }

  const profile = defaultProfile(userId);
  await upsertRow(TABLE, profile);

  return profile;
}

export async function updateProfile(userId, { fullName } = {}) {
  const ownerId = resolveUserId(userId);
  const current = await getOrCreateProfile({ id: ownerId });
  const updated = {
    ...current,
    full_name: String(fullName || '').trim() || DEFAULT_NAME,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}

export async function updateProfilePhoto(userId, photo) {
  const ownerId = resolveUserId(userId);
  const current = await getOrCreateProfile({ id: ownerId });
  const normalizedPhoto =
    typeof photo === 'string' && photo.startsWith('data:image/') ? photo : null;
  const updated = {
    ...current,
    photo: normalizedPhoto,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);

  return updated;
}
