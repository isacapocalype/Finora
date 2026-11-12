// FINORA — OFFLINE ERRORS
// Membedakan kegagalan jaringan dari kegagalan validasi/server.

export function isNetworkError(error) {
  if (!error) {
    return false;
  }

  if (error.name === 'TypeError') {
    return true;
  }

  return /failed to fetch|networkerror|network request|load failed|offline/i.test(
    String(error.message || '')
  );
}
