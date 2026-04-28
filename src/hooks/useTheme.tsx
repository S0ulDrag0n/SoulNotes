'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { getInitialDarkMode } from '@/utils/platform';
import { THEME, COOKIE_SETTINGS } from '@/lib/constants';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);

  // Apply dark mode class on initial render and when theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Save theme to cookie when it changes
  useEffect(() => {
    const value = isDarkMode ? THEME.DARK : THEME.LIGHT;
    document.cookie = `theme=${value}; path=${COOKIE_SETTINGS.path}; max-age=${COOKIE_SETTINGS.maxAge}`;
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}