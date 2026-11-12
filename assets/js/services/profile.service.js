import { requireSupabase } from '../supabase.js';
import { readFromStore, upsertRow } from '../offline/db.js';
import { isNetworkError } from '../offline/errors.js';
import { createId } from '../offline/id.js';
import { isOnline } from '../offline/network.js';
import { enqueueOutboxOp } from '../offline/outbox.js';

const TABLE = 'profiles';
const PROFILE_FIELDS = 'id, full_name, currency, created_at, updated_at';

async function readCachedProfile(userId) {
  const row = await readFromStore(TABLE, userId);
  return row || null;
}

function profileFromUser(user) {
  const fallbackName =
    user.user_metadata?.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'Pengguna Finora';

  return {
    id: user.id,
    full_name: fallbackName.slice(0, 120),
    currency: 'IDR',
    created_at: null,
    updated_at: null
  };
}

async function saveProfileOffline(userId, fullName) {
  const cached = await readCachedProfile(userId);

  if (!cached) {
    throw new Error('Profil belum tersedia offline. Sambungkan internet sekali untuk menyiapkan data.');
  }

  const updated = {
    ...cached,
    full_name: fullName,
    updated_at: new Date().toISOString()
  };

  await upsertRow(TABLE, updated);
  await enqueueOutboxOp({
    id: createId(),
    type: 'profile.update',
    userId,
    payload: { fullName },
    createdAt: new Date().toISOString()
  });

  return updated;
}

export async function getProfile(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (!isOnline() || isNetworkError(error)) {
      const cached = await readCachedProfile(userId);
      return cached || null;
    }

    throw error;
  }

  if (data) {
    await upsertRow(TABLE, data);
  }

  return data;
}

export async function getOrCreateProfile(user) {
  const existing = await getProfile(user.id);

  if (existing) {
    return existing;
  }

  const cached = await readCachedProfile(user.id);

  if (cached) {
    return cached;
  }

  if (!isOnline()) {
    return profileFromUser(user);
  }

  const supabase = requireSupabase();
  const fallbackName =
    user.user_metadata?.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'Pengguna Finora';

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id: user.id,
      full_name: fallbackName.slice(0, 120)
    })
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    if (error.code === '23505') {
      const retried = await getProfile(user.id);

      if (retried) {
        return retried;
      }
    }

    if (isNetworkError(error)) {
      const fallback = await readCachedProfile(user.id);
      return fallback || profileFromUser(user);
    }

    throw error;
  }

  await upsertRow(TABLE, data);

  return data;
}

export async function updateProfile(userId, { fullName }) {
  if (!isOnline()) {
    return saveProfileOffline(userId, fullName);
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ full_name: fullName })
    .eq('id', userId)
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    if (isNetworkError(error)) {
      return saveProfileOffline(userId, fullName);
    }

    throw error;
  }

  await upsertRow(TABLE, data);

  return data;
}
