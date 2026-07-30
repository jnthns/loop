import { useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'dynasty-guide:theme';

export type Theme = 'light' | 'dark';

/** Resolve the active theme from the document (set by the head FOUC script). */
export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / quota — theme still applies for this session.
  }
}

/**
 * Site-wide light/dark toggle. Persists to localStorage; pairs with the inline
 * head script in BaseLayout that applies the saved (or system) theme before paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-[0.5rem] border border-line bg-surface-alt px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}

export default ThemeToggle;
