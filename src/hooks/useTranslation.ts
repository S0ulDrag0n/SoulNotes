// Hook for translation service

import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlatform } from '@/lib/platform';
import { extractTranslatableChunk, generateMessageId } from '@/utils/text';
import { DEBOUNCE_DELAY, TRANSLATION_TIMING } from '@/lib/constants';

export interface TranslationMessage {
  id: string;
  text: string;
  timestamp: Date;
}

export interface UseTranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface UseTranslationReturn {
  translation: string;
  translationMessages: TranslationMessage[];
  isTranslating: boolean;
  triggerTranslate: (text: string) => void;
  /** Clear all translation messages */
  clearTranslation: () => void;
}

// ---------------------------------------------------------------------
// Translation hook
// ---------------------------------------------------------------------
export function useTranslation(options: UseTranslationOptions): UseTranslationReturn {
  const { sourceLanguage, targetLanguage } = options;

  const [translation, setTranslation] = useState('');
  const [translationMessages, setTranslationMessages] = useState<TranslationMessage[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // Refs for translation state
  const translateRequestIdRef = useRef(0);
  const lastTranslateAtRef = useRef(0);
  const lastSeenTranscriptRef = useRef('');
  const inflightTranslatedTextRef = useRef('');
  const lastTranslationLanguageRef = useRef('');
  const pendingTranslateBufferRef = useRef('');
  const currentTranslationRef = useRef<TranslationMessage | null>(null);
  const isMountedRef = useRef(true);

  // Platform adapter
  const platform = getPlatform();

  // ---------------------------------------------------------------------
  // Add translation message (final or streaming)
  // ---------------------------------------------------------------------
  const addTranslationMessage = useCallback((text: string, isFinal: boolean = true) => {
    // Guard against updates after unmount
    if (!isMountedRef.current) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    if (isFinal) {
      // If there's a current streaming message, remove it first
      if (currentTranslationRef.current) {
        const streamingId = currentTranslationRef.current.id;
        currentTranslationRef.current = null;
        setTranslationMessages((prev) => prev.filter((msg) => msg.id !== streamingId));
      }

      // Create a new final message
      const newMessage: TranslationMessage = {
        id: generateMessageId(),
        text: trimmed,
        timestamp: new Date(),
      };
      setTranslationMessages((prev) => [...prev, newMessage]);
      setTranslation((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
    } else {
      // Update or create current streaming message
      if (currentTranslationRef.current) {
        const streamingId = currentTranslationRef.current.id;
        setTranslationMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingId
              ? { ...msg, text: trimmed }
              : msg
          )
        );
      } else {
        const newStreamingMessage: TranslationMessage = {
          id: `translating-${Date.now()}`,
          text: trimmed,
          timestamp: new Date(),
        };
        currentTranslationRef.current = newStreamingMessage;
        setTranslationMessages((prev) => [...prev, newStreamingMessage]);
      }
    }
  }, []);

  // ---------------------------------------------------------------------
  // Translate a single chunk
  // ---------------------------------------------------------------------
  const translate = useCallback(async (requestId: number, text: string) => {
    try {
      setIsTranslating(true);
      let accumulatedText = '';

      await platform.translation.translate(
        text,
        { sourceLanguage, targetLanguage },
        async (chunk) => {
          // Guard against stale requests and unmounted component
          if (translateRequestIdRef.current !== requestId || !isMountedRef.current) return;
          accumulatedText += chunk;
          addTranslationMessage(accumulatedText, false);
        }
      );

      // Finalize - only if still valid and mounted
      if (accumulatedText && translateRequestIdRef.current === requestId && isMountedRef.current) {
        addTranslationMessage(accumulatedText, true);
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsTranslating(false);
      }
    }
  }, [sourceLanguage, targetLanguage, platform, addTranslationMessage]);

  // ---------------------------------------------------------------------
  // Trigger next translation if possible
  // ---------------------------------------------------------------------
  const triggerNextTranslate = useCallback(() => {
    if (inflightTranslatedTextRef.current) return;

    const maxChunkLength = DEBOUNCE_DELAY.translation * TRANSLATION_TIMING.chunkLengthMultiplier;
    const { chunk, rest } = extractTranslatableChunk(
      pendingTranslateBufferRef.current,
      false,
      true,
      maxChunkLength
    );
    if (!chunk) {
      pendingTranslateBufferRef.current = rest;
      return;
    }
    pendingTranslateBufferRef.current = rest;

    const requestId = translateRequestIdRef.current + 1;
    translateRequestIdRef.current = requestId;
    lastTranslateAtRef.current = Date.now();
    inflightTranslatedTextRef.current = chunk;
    translate(requestId, chunk).finally(() => {
      if (inflightTranslatedTextRef.current === chunk) {
        inflightTranslatedTextRef.current = '';
        if (pendingTranslateBufferRef.current.trim()) {
          triggerNextTranslate();
        }
      }
    });
  }, [translate]);

  // ---------------------------------------------------------------------
  // Handle incoming transcript for translation
  // ---------------------------------------------------------------------
  const triggerTranslate = useCallback((transcript: string) => {
    const text = transcript.trim();
    if (!text) return;

    const now = Date.now();
    const isIdle = now - lastTranslateAtRef.current >= DEBOUNCE_DELAY.translation * TRANSLATION_TIMING.idleMultiplier;
    const maxIntervalMs = DEBOUNCE_DELAY.summarization * TRANSLATION_TIMING.maxIntervalMultiplier;
    const intervalElapsed = now - lastTranslateAtRef.current >= maxIntervalMs;

    // Check if language changed
    const languageKey = `${sourceLanguage}|${targetLanguage}`;
    if (lastTranslationLanguageRef.current !== languageKey) {
      lastTranslationLanguageRef.current = languageKey;
      lastSeenTranscriptRef.current = '';
      pendingTranslateBufferRef.current = '';
      inflightTranslatedTextRef.current = '';
      setTranslation('');
      setTranslationMessages([]);
    }

    // Check if transcript changed
    if (text === lastSeenTranscriptRef.current) return;

    // Calculate delta
    let deltaText = '';
    if (text.startsWith(lastSeenTranscriptRef.current)) {
      deltaText = text.slice(lastSeenTranscriptRef.current.length);
    } else {
      pendingTranslateBufferRef.current = '';
      inflightTranslatedTextRef.current = '';
      deltaText = text;
      setTranslation('');
      setTranslationMessages([]);
    }

    lastSeenTranscriptRef.current = text;

    if (deltaText.trim()) {
      pendingTranslateBufferRef.current += deltaText;
    }

    if (inflightTranslatedTextRef.current) return;

    triggerNextTranslate();
  }, [sourceLanguage, targetLanguage, triggerNextTranslate]);

  // ---------------------------------------------------------------------
  // Clear translation
  // ---------------------------------------------------------------------
  const clearTranslation = useCallback(() => {
    setTranslation('');
    setTranslationMessages([]);
    lastSeenTranscriptRef.current = '';
    pendingTranslateBufferRef.current = '';
    inflightTranslatedTextRef.current = '';
    currentTranslationRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      translateRequestIdRef.current = 0;
      currentTranslationRef.current = null;
    };
  }, []);

  return {
    translation,
    translationMessages,
    isTranslating,
    triggerTranslate,
    clearTranslation,
  };
}