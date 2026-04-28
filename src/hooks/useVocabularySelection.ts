// Hook for handling vocabulary selection workflow with context-aware translation

import { useState, useCallback, useRef } from 'react';
import { useVocabulary } from './useVocabulary';
import { getPlatform } from '@/lib/platform';
import type { LanguageDeck } from '@/types/vocabulary';

interface UseVocabularySelectionOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface UseVocabularySelectionReturn {
  translation: string;
  isTranslating: boolean;
  decks: LanguageDeck[];
  currentDeck: LanguageDeck | null;
  setCurrentDeck: (deck: LanguageDeck) => void;
  translateText: (text: string, context: string) => Promise<string>;
  addToFlashcards: (word: string, translation: string, context: string, source: 'transcript' | 'translation' | 'conversation') => Promise<boolean>;
  error: string | null;
  clearError: () => void;
}

// Translation cache to avoid repeated API calls
const translationCache = new Map<string, string>();

export function useVocabularySelection(options: UseVocabularySelectionOptions): UseVocabularySelectionReturn {
  const { sourceLanguage, targetLanguage } = options;
  
  const {
    decks,
    currentDeck,
    setCurrentDeck,
    addItem,
  } = useVocabulary();

  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track the current translation request
  const currentRequestIdRef = useRef(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const translateText = useCallback(async (text: string, context: string): Promise<string> => {
    if (!text.trim()) {
      return '';
    }

    // Check cache first
    const cacheKey = `${sourceLanguage}|${targetLanguage}|${text}|${context}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslation(cached);
      return cached;
    }

    const requestId = ++currentRequestIdRef.current;
    setIsTranslating(true);
    setError(null);

    try {
      const platform = getPlatform();
      
      // Prepend context to text for better translation accuracy
      const textWithContext = context.trim()
        ? `Context: ${context}\n\nTranslate: ${text}`
        : text;

      let result = '';
      
      await platform.translation.translate(textWithContext, {
        sourceLanguage,
        targetLanguage,
      }, async (chunk: string) => {
        // Check if this request is still current
        if (requestId !== currentRequestIdRef.current) {
          return; // Request was superseded
        }
        result += chunk;
        setTranslation(result);
      });

      // Cache the result
      translationCache.set(cacheKey, result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Translation failed';
      setError(errorMessage);
      return '';
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setIsTranslating(false);
      }
    }
  }, [sourceLanguage, targetLanguage]);

  const addToFlashcards = useCallback(async (
    word: string,
    translation: string,
    context: string,
    source: 'transcript' | 'translation' | 'conversation'
  ): Promise<boolean> => {
    if (!currentDeck) {
      setError('No deck selected. Please select a deck first.');
      return false;
    }

    if (!word.trim() || !translation.trim()) {
      setError('Word and translation are required.');
      return false;
    }

    try {
      await addItem(word.trim(), translation.trim(), context.trim(), source);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to flashcards';
      setError(errorMessage);
      return false;
    }
  }, [currentDeck, addItem]);

  return {
    translation,
    isTranslating,
    decks,
    currentDeck,
    setCurrentDeck,
    translateText,
    addToFlashcards,
    error,
    clearError,
  };
}