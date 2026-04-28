'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { initVocabularyDB } from '@/lib/vocabulary-db';

interface VocabularyContextValue {
  isInitialized: boolean;
  error: Error | null;
}

const VocabularyContext = createContext<VocabularyContextValue>({
  isInitialized: false,
  error: null,
});

export function useVocabularyInit() {
  return useContext(VocabularyContext);
}

interface VocabularyProviderProps {
  children: ReactNode;
}

export function VocabularyProvider({ children }: VocabularyProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    initVocabularyDB()
      .then(() => {
        if (mounted) {
          setIsInitialized(true);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize vocabulary database:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize vocabulary database'));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <VocabularyContext.Provider value={{ isInitialized, error }}>
      {children}
    </VocabularyContext.Provider>
  );
}