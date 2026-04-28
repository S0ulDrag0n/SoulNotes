// Hook for summarization service

import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlatform } from '@/lib/platform';
import { DEBOUNCE_DELAY } from '@/lib/constants';

export interface UseSummarizationReturn {
  summary: string;
  isSummarizing: boolean;
  triggerSummarize: (text: string) => void;
}

// ---------------------------------------------------------------------
// Summarization hook
// ---------------------------------------------------------------------
export function useSummarization(): UseSummarizationReturn {
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const lastSummarizedTextRef = useRef('');
  const summarizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Platform adapter
  const platform = getPlatform();

  // ---------------------------------------------------------------------
  // Perform summarization
  // ---------------------------------------------------------------------
  const summarize = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsSummarizing(true);
    try {
      const result = await platform.summarization.summarize(text);
      setSummary(result);
    } catch (err) {
      console.error('Summarization error:', err);
    } finally {
      setIsSummarizing(false);
    }
  }, [platform]);

  // ---------------------------------------------------------------------
  // Trigger summarize with debounce
  // ---------------------------------------------------------------------
  const triggerSummarize = useCallback((text: string) => {
    // Don't summarize while recording
    // Don't summarize empty text
    if (!text.trim()) return;

    // Skip if text hasn't changed
    if (text === lastSummarizedTextRef.current) return;

    // Clear existing debounce
    if (summarizeDebounceRef.current) {
      clearTimeout(summarizeDebounceRef.current);
    }

    // Debounce summarization
    summarizeDebounceRef.current = setTimeout(() => {
      lastSummarizedTextRef.current = text;
      summarize(text);
    }, DEBOUNCE_DELAY.summarization);
  }, [summarize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (summarizeDebounceRef.current) {
        clearTimeout(summarizeDebounceRef.current);
      }
    };
  }, []);

  return {
    summary,
    isSummarizing,
    triggerSummarize,
  };
}