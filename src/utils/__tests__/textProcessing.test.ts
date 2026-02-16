import { describe, it, expect } from 'vitest';
import {
  normalizeTranslationText,
  appendWithSpacing,
  appendWithCleanup,
  extractTranslatableChunk,
  generateId,
  getLanguageLabel,
  containsCjk,
  calculateTextDelta,
  parseLanguageCode,
} from '../textProcessing';

describe('normalizeTranslationText', () => {
  it('removes spaces before punctuation', () => {
    expect(normalizeTranslationText('Hello , world .')).toBe('Hello, world.');
  });

  it('removes multiple spaces', () => {
    expect(normalizeTranslationText('Hello    world')).toBe('Hello world');
  });

  it('trims whitespace', () => {
    expect(normalizeTranslationText('  hello world  ')).toBe('hello world');
  });

  it('fixes apostrophe spacing', () => {
    expect(normalizeTranslationText("don ' t")).toBe("don't");
  });
});

describe('appendWithSpacing', () => {
  it('returns next text when prev is empty', () => {
    expect(appendWithSpacing('', 'hello')).toBe('hello');
  });

  it('adds space when no punctuation', () => {
    expect(appendWithSpacing('Hello', 'world')).toBe('Hello world');
  });

  it('adds period for Latin sentence boundary', () => {
    expect(appendWithSpacing('Hello', 'World')).toBe('Hello. World');
  });

  it('adds period for CJK characters', () => {
    expect(appendWithSpacing('你好', '世界')).toBe('你好。世界');
  });

  it('handles punctuation at end', () => {
    expect(appendWithSpacing('Hello.', 'World')).toBe('Hello. World');
  });

  it('handles punctuation at start', () => {
    expect(appendWithSpacing('Hello', '. World')).toBe('Hello . World');
  });
});

describe('appendWithCleanup', () => {
  it('combines and normalizes text', () => {
    expect(appendWithCleanup('Hello ', ' world .')).toBe('Hello world.');
  });
});

describe('extractTranslatableChunk', () => {
  it('returns empty for empty buffer', () => {
    const result = extractTranslatableChunk('', {
      isIdle: true,
      intervalElapsed: true,
      maxChunkLength: 100,
    });
    expect(result).toEqual({ chunk: '', rest: '' });
  });

  it('returns all text when idle', () => {
    const result = extractTranslatableChunk('Hello world. This is a test.', {
      isIdle: true,
      intervalElapsed: true,
      maxChunkLength: 100,
    });
    expect(result).toEqual({
      chunk: 'Hello world. This is a test.',
      rest: '',
    });
  });

  it('waits for idle when not interval elapsed', () => {
    const result = extractTranslatableChunk('Hello world', {
      isIdle: false,
      intervalElapsed: false,
      maxChunkLength: 100,
    });
    expect(result).toEqual({ chunk: '', rest: 'Hello world' });
  });

  it('breaks at sentence boundary', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = extractTranslatableChunk(text, {
      isIdle: false,
      intervalElapsed: true,
      maxChunkLength: 50,
    });
    expect(result.chunk).toBe('First sentence. Second sentence.');
    expect(result.rest).toBe('Third sentence.');
  });

  it('hard breaks at max length when no sentence boundary', () => {
    const text = 'ThisIsAVeryLongWordThatHasNoBreaksAtAll';
    const result = extractTranslatableChunk(text, {
      isIdle: false,
      intervalElapsed: true,
      maxChunkLength: 10,
    });
    expect(result.chunk).toBe('ThisIsAVer');
    expect(result.rest).toBe('yLongWordThatHasNoBreaksAtAll');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe('getLanguageLabel', () => {
  it('returns label for known language codes', () => {
    expect(getLanguageLabel('en')).toBe('English');
    expect(getLanguageLabel('zh-traditional')).toBe('Traditional Chinese');
  });

  it('returns code for unknown languages', () => {
    expect(getLanguageLabel('unknown')).toBe('unknown');
  });
});

describe('containsCjk', () => {
  it('returns true for CJK characters', () => {
    expect(containsCjk('你好')).toBe(true);
    expect(containsCjk('Hello你好')).toBe(true);
  });

  it('returns false for non-CJK characters', () => {
    expect(containsCjk('Hello')).toBe(false);
  });
});

describe('calculateTextDelta', () => {
  it('detects append', () => {
    const result = calculateTextDelta('Hello', 'Hello world');
    expect(result.isAppend).toBe(true);
    expect(result.delta).toBe(' world');
  });

  it('detects non-append', () => {
    const result = calculateTextDelta('Hello world', 'Goodbye world');
    expect(result.isAppend).toBe(false);
    expect(result.delta).toBe('Goodbye world');
  });
});

describe('parseLanguageCode', () => {
  it('parses Chinese variants', () => {
    expect(parseLanguageCode('zh-simplified')).toEqual({
      language: 'zh',
      chineseVariant: 'simplified',
    });
    expect(parseLanguageCode('zh-traditional')).toEqual({
      language: 'zh',
      chineseVariant: 'traditional',
    });
  });

  it('parses regular languages', () => {
    expect(parseLanguageCode('en')).toEqual({
      language: 'en',
      chineseVariant: null,
    });
  });
});