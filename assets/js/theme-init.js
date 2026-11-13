// FINORA — TEMA AWAL
// Script klasik yang berjalan sebelum CSS agar tidak ada flash tema terang.

(function () {
  var STORAGE_KEY = 'finora-theme';
  var preference = 'system';

  try {
    var stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      preference = stored;
    }
  } catch (error) {
    // Abaikan penyimpanan yang diblokir; gunakan preferensi sistem.
  }

  var systemDark =
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  var root = document.documentElement;

  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;

  var meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f0d17' : '#f8f7fc');
  }
})();
