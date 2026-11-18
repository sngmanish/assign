import { useSyncExternalStore } from 'react';

/**
 * Light or dark colours. The design tokens switch on `data-theme="dark"` on <html>; "system"
 * follows the OS setting (and changes with it). The choice is remembered in this browser.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'crm.theme';
const darkQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

let choice: ThemeChoice = readChoice();

/** Put the effective theme on <html>. Called once before the first render (no flash) and on every change. */
export function applyTheme(): void {
  const dark = choice === 'dark' || (choice === 'system' && Boolean(darkQuery?.matches));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setTheme(next: ThemeChoice): void {
  choice = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // storage unavailable (private mode): the choice lasts until reload
  }
  applyTheme();
  listeners.forEach((l) => l());
}

// the OS setting changed: only matters while following it
darkQuery?.addEventListener('change', () => {
  if (choice === 'system') applyTheme();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The current choice; re-renders when it changes. */
export const useTheme = () => useSyncExternalStore(subscribe, () => choice);
