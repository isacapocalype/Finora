import { requireSupabase } from '../supabase.js';

const TABLE = 'profiles';

export async function getProfile(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, full_name, currency, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOrCreateProfile(user) {
  const existing = await getProfile(user.id);

  if (existing) {
    return existing;
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
    .select('id, full_name, currency, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      const retried = await getProfile(user.id);

      if (retried) {
        return retried;
      }
    }

    throw error;
  }

  return data;
}

export async function updateProfile(userId, { fullName }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ full_name: fullName })
    .eq('id', userId)
    .select('id, full_name, currency, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
