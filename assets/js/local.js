// FINORA — IDENTITAS LOKAL
// Aplikasi berjalan tanpa login. Semua data dimiliki perangkat ini.

export const LOCAL_USER_ID = 'local-device';

export const LOCAL_USER = {
  id: LOCAL_USER_ID,
  email: '',
  user_metadata: {
    full_name: 'Pengguna Finora'
  }
};

export function resolveUserId(userId) {
  return userId || LOCAL_USER_ID;
}
