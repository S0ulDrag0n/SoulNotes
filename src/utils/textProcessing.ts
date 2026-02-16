/**
 * Text Processing Utilities
 * 
 * All functions in this module are pure - they have no side effects
 * and always return the same output for the same input.
 */

/**
 * Normalizes translation text by cleaning up spacing and punctuation
 */
export const normalizeTranslationText = (text: string): string =>
  text
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/\s*'\s*/g, "'")  // Fix apostrophe spacing on both sides
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();

/**
 * Appends text with appropriate spacing based on punctuation rules
 */
export const appendWithSpacing = (prev: string, next: string): string => {
  if (!prev) return next;

  const trimmedPrev = prev.trim();
  const trimmedNext = next.trim();

  // Check if previous ends with punctuation/space
  const prevEndsClean = /[\s\n.,!?;:，。！？；：)]$/.test(trimmedPrev);
  const nextStartsClean = /^[\s\n.,!?;:，。！？；：(]/.test(trimmedNext);

  if (prevEndsClean || nextStartsClean) {
    return `${trimmedPrev} ${trimmedNext}`;
  }

  // Check for Latin word boundaries
  const prevEndsLatin = /[A-Za-z0-9)]$/.test(trimmedPrev);
  const nextStartsLatinUpper = /^[A-Z]/.test(trimmedNext);

  if (prevEndsLatin && nextStartsLatinUpper) {
    return `${trimmedPrev}. ${trimmedNext}`;
  }

  // Check for CJK boundaries
  const prevEndsCjk = /[\u4e00-\u9fff]$/.test(trimmedPrev);
  const nextStartsCjk = /^[\u4e00-\u9fff]/.test(trimmedNext);

  if (prevEndsCjk && nextStartsCjk) {
    return `${trimmedPrev}。${trimmedNext}`;
  }

  return `${trimmedPrev} ${trimmedNext}`;
};

/**
 * Combines previous text with new chunk, applying normalization and spacing
 */
export const appendWithCleanup = (prev: string, next: string): string =>
  normalizeTranslationText(appendWithSpacing(prev, next));

/**
 * Extracts a chunk of text up to a specified maximum length,
 * respecting sentence boundaries when possible
 */
export const extractTranslatableChunk = (
  buffer: string,
  options: {
    isIdle: boolean;
    intervalElapsed: boolean;
    maxChunkLength: number;
  }
): { chunk: string; rest: string } => {
    const trimmed = buffer.replace(/^\s+/, '');

    if (!trimmed) {
      return { chunk: '', rest: '' };
    }

    if (!options.isIdle && !options.intervalElapsed) {
      return { chunk: '', rest: trimmed };
    }

    if (options.isIdle) {
      return { chunk: trimmed, rest: '' };
    }

    // Try to break at sentence boundary
    const sentenceEndIndex = findSentenceBoundary(trimmed, options.maxChunkLength);
    
    if (sentenceEndIndex > 0) {
      const chunk = trimmed.slice(0, sentenceEndIndex).trim();
      const rest = trimmed.slice(sentenceEndIndex).trim();
      return { chunk, rest };
    }

    // Hard break at max length
    const chunk = trimmed.slice(0, options.maxChunkLength).trim();
    const rest = trimmed.slice(options.maxChunkLength).replace(/^\s+/, '');
    
    return { chunk, rest };
};

/**
 * Finds a sentence boundary before the max length
 */
const findSentenceBoundary = (text: string, maxLength: number): number => {
  const searchRange = Math.min(maxLength, text.length);
  
  // Look for sentence endings
  const sentenceEndRegex = /[.!?。！？]\s+/g;
  let lastMatch = -1;
  let match;

  while ((match = sentenceEndRegex.exec(text)) !== null) {
    if (match.index + match[0].length > searchRange) {
      break;
    }
    lastMatch = match.index + match[0].length;
  }

  return lastMatch;
};

/**
 * Generates a unique ID
 */
export const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Gets human-readable language label from code
 */
export const getLanguageLabel = (code: string): string => {
  const labels: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    zh: 'Chinese',
    'zh-simplified': 'Simplified Chinese',
    'zh-traditional': 'Traditional Chinese',
  };

  return labels[code] || code;
};

/**
 * Checks if text contains CJK characters
 */
export const containsCjk = (text: string): boolean =>
  /[\u4e00-\u9fff]/.test(text);

/**
 * Calculates the delta between old and new text
 */
export const calculateTextDelta = (
  oldText: string,
  newText: string
): { isAppend: boolean; delta: string } => {
  const trimmedOld = oldText.trim();
  const trimmedNew = newText.trim();

  if (trimmedNew.startsWith(trimmedOld)) {
    return {
      isAppend: true,
      delta: trimmedNew.slice(trimmedOld.length),
    };
  }

  return {
    isAppend: false,
    delta: trimmedNew,
  };
};

/**
 * Parses language code to extract Chinese variant if present
 */
export const parseLanguageCode = (
  code: string
): { language: string; chineseVariant: 'simplified' | 'traditional' | null } => {
  if (code === 'zh-simplified') {
    return { language: 'zh', chineseVariant: 'simplified' };
  }
  if (code === 'zh-traditional') {
    return { language: 'zh', chineseVariant: 'traditional' };
  }
  return { language: code, chineseVariant: null };
};

/**
 * Debounces a function call
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Formats timestamp for display
 */
export const formatTimestamp = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString();

/**
 * Truncates text to a maximum length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};