import { requireSupabase } from '../supabase.js';

export async function getSession() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signIn({ email, password }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUp({ email, password, fullName }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      },
      emailRedirectTo: new URL('pages/dashboard.html', window.location.href).href
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(email) {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('reset-password.html', window.location.href).href
  });

  if (error) {
    throw error;
  }
}

export async function updatePassword(password) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  return data;
}

export function onAuthStateChange(callback) {
  const supabase = requireSupabase();
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
