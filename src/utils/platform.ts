// Platform detection utility for SoulNotes
// Provides a simple boolean check for Tauri/desktop environment

import { THEME } from '@/lib/constants';

// Synchronous check for Tauri (useful for early initialization)
export const isDesktopMode = (): boolean => {
  if (typeof globalThis === 'undefined') return false;
  return '__TAURI__' in globalThis;
};

// ---------------------------------------------------------------------
// Theme utilities
// ---------------------------------------------------------------------

/**
 * Get initial dark mode state from cookie or system preference
 * Used for lazy initialization of useState to avoid hydration mismatch
 */
export const getInitialDarkMode = (): boolean => {
  if (typeof document === 'undefined') return false;
  const themeMatch = document.cookie.match(/(?:^|; )theme=(dark|light)/);
  if (themeMatch?.[1] === THEME.DARK) return true;
  if (themeMatch?.[1] === THEME.LIGHT) return false;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};
