'use client';

import { useState, useEffect } from 'react';

const THEME_COOKIE_NAME = 'theme';
const THEME_COOKIE_MAX_AGE = 31536000; // 1 year

interface UseThemeReturn {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

/**
 * Get initial theme from cookie or system preference
 */
function getInitialTheme(): boolean {
  if (typeof document === 'undefined') return false;
  
  const themeMatch = document.cookie.match(/(?:^|; )theme=(dark|light)/);
  if (themeMatch?.[1] === 'dark') {
    document.documentElement.classList.add('dark');
    return true;
  }
  if (themeMatch?.[1] === 'light') {
    document.documentElement.classList.remove('dark');
    return false;
  }
  
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    document.documentElement.classList.add('dark');
    return true;
  }
  return false;
}

/**
 * Hook for managing dark/light theme with cookie persistence
 */
export function useTheme(): UseThemeReturn {
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);

  // Update cookie and DOM when theme changes
  useEffect(() => {
    const value = isDarkMode ? 'dark' : 'light';
    document.cookie = `${THEME_COOKIE_NAME}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}`;
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return { isDarkMode, toggleTheme };
}