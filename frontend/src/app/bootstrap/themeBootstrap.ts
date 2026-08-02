export type AppTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'iota-ml-theme';

export function readStoredTheme(): AppTheme {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: AppTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
