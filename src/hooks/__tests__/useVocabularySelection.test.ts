// Tests for useVocabularySelection hook

import { renderHook, act, waitFor } from '@testing-library/react';
import type { LanguageDeck } from '@/types/vocabulary';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

// Mock useVocabulary
vi.mock('../useVocabulary', () => ({
  useVocabulary: () => ({
    decks: [
      { id: 'deck-1', name: 'Spanish', language: 'es', createdAt: new Date(), stats: { totalWords: 10, wordsLearned: 5, dueToday: 2 } },
    ],
    currentDeck: { id: 'deck-1', name: 'Spanish', language: 'es', createdAt: new Date(), stats: { totalWords: 10, wordsLearned: 5, dueToday: 2 } },
    setCurrentDeck: vi.fn(),
    addItem: vi.fn().mockResolvedValue({ id: 'item-1', word: 'hola', translation: 'hello' }),
  }),
}));

// Mock platform module
const mockTranslate = vi.fn();
vi.mock('@/lib/platform', () => ({
  getPlatform: () => ({
    translation: {
      translate: mockTranslate,
    },
    summarization: {
      summarize: vi.fn(),
    },
    audioDevices: {
      getDevices: vi.fn(),
    },
    isDesktop: false,
  }),
}));

// Import after mocks are set up
import { useVocabularySelection } from '../useVocabularySelection';

describe('useVocabularySelection', () => {
  beforeEach(() => {
    mockTranslate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => 
      useVocabularySelection({ 
        sourceLanguage: 'es', 
        targetLanguage: 'en' 
      })
    );
    
    expect(result.current.translation).toBe('');
    expect(result.current.isTranslating).toBe(false);
    expect(result.current.decks).toHaveLength(1);
    expect(result.current.currentDeck).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should translate text with context', async () => {
    // Mock successful translation
    mockTranslate.mockImplementation(async (_text: string, _options: unknown, onChunk: (chunk: string) => void) => {
      onChunk('hello');
    });

    const { result } = renderHook(() => 
      useVocabularySelection({ 
        sourceLanguage: 'es', 
        targetLanguage: 'en' 
      })
    );
    
    await act(async () => {
      const translation = await result.current.translateText('hola', 'hola, ¿cómo estás?');
      expect(translation).toBe('hello');
    });
  });

  it('should handle translation errors', async () => {
    // Mock error response - use unique text to avoid cache
    mockTranslate.mockRejectedValue(new Error('Translation failed'));

    const { result } = renderHook(() =>
      useVocabularySelection({
        sourceLanguage: 'es',
        targetLanguage: 'en'
      })
    );
    
    await act(async () => {
      // Use unique text to avoid cache from previous tests
      const translation = await result.current.translateText('error_test_word', 'error context');
      expect(translation).toBe('');
    });
    
    expect(result.current.error).toBe('Translation failed');
  });

  it('should add to flashcards', async () => {
    const { result } = renderHook(() => 
      useVocabularySelection({ 
        sourceLanguage: 'es', 
        targetLanguage: 'en' 
      })
    );
    
    await act(async () => {
      const success = await result.current.addToFlashcards('hola', 'hello', 'hola, ¿cómo estás?', 'transcript');
      expect(success).toBe(true);
    });
  });

  it('should clear error', () => {
    const { result } = renderHook(() => 
      useVocabularySelection({ 
        sourceLanguage: 'es', 
        targetLanguage: 'en' 
      })
    );
    
    act(() => {
      result.current.clearError();
    });
    
    expect(result.current.error).toBeNull();
  });
});