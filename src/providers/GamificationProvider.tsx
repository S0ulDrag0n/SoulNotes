'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { initGamificationDB } from '@/lib/gamification-db';

interface GamificationContextValue {
  isInitialized: boolean;
  error: Error | null;
}

const GamificationContext = createContext<GamificationContextValue>({
  isInitialized: false,
  error: null,
});

export function useGamificationInit() {
  return useContext(GamificationContext);
}

interface GamificationProviderProps {
  children: ReactNode;
}

export function GamificationProvider({ children }: GamificationProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    initGamificationDB()
      .then(() => {
        if (mounted) {
          setIsInitialized(true);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize gamification database:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize database'));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GamificationContext.Provider value={{ isInitialized, error }}>
      {children}
    </GamificationContext.Provider>
  );
}