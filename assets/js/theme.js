// FINORA — TEMA TAMPILAN
// Menyimpan preferensi terang/gelap/sistem dan menerapkannya ke dokumen.

export const THEME_STORAGE_KEY = 'finora-theme';
export const THEME_OPTIONS = ['light', 'dark', 'system'];

const systemThemeQuery = globalThis.matchMedia?.(
  '(prefers-color-scheme: dark)'
);

function normalizePreference(value) {
  return THEME_OPTIONS.includes(value) ? value : 'system';
}

function readStoredPreference() {
  try {
    return normalizePreference(
      globalThis.localStorage?.getItem(THEME_STORAGE_KEY)
    );
  } catch (error) {
    return 'system';
  }
}

function persistPreference(preference) {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, preference);
  } catch (error) {
    // Penyimpanan dapat diblokir di mode privat; tema tetap berlaku sesi ini.
  }
}

function systemTheme() {
  return systemThemeQuery?.matches ? 'dark' : 'light';
}

function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');

  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f0d17' : '#f8f7fc');
  }
}

function applyResolvedTheme(theme, preference, { persist = false } = {}) {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;

  updateThemeColor(theme);

  if (persist) {
    persistPreference(preference);
  }

  document.dispatchEvent(
    new CustomEvent('finora:themechange', {
      detail: { theme, preference }
    })
  );
}

export function getThemePreference() {
  return readStoredPreference();
}

export function resolveTheme(preference = getThemePreference()) {
  const normalized = normalizePreference(preference);
  return normalized === 'system' ? systemTheme() : normalized;
}

export function applyTheme(
  preference = getThemePreference(),
  { persist = false } = {}
) {
  const normalized = normalizePreference(preference);
  applyResolvedTheme(resolveTheme(normalized), normalized, { persist });
}

export function setThemePreference(preference) {
  applyTheme(preference, { persist: true });
}

export function initTheme() {
  applyTheme(getThemePreference());

  const handleSystemChange = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
    }
  };

  if (systemThemeQuery?.addEventListener) {
    systemThemeQuery.addEventListener('change', handleSystemChange);
  } else {
    systemThemeQuery?.addListener?.(handleSystemChange);
  }

  globalThis.addEventListener?.('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(getThemePreference());
    }
  });
}

export function onThemeChange(callback) {
  const handler = (event) => callback(event.detail);

  document.addEventListener('finora:themechange', handler);

  return () => document.removeEventListener('finora:themechange', handler);
}
