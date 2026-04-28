// Vitest globals are available - no explicit imports needed
import { renderHook, act, waitFor } from '@testing-library/react';
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

// Mock crypto.randomUUID before importing the hook
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

// Create a shared mock object that will be used by all tests
const mockDBMethods = {
  getDecks: vi.fn(),
  getDeck: vi.fn(),
  createDeck: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  getItems: vi.fn(),
  getItem: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getFlashcards: vi.fn(),
  getAllFlashcards: vi.fn(),
  getDueCards: vi.fn(),
  getDueCardsForDeck: vi.fn(),
  addFlashcard: vi.fn(),
  updateFlashcard: vi.fn(),
  deleteFlashcard: vi.fn(),
  deleteFlashcardsForVocabulary: vi.fn(),
  init: vi.fn(),
};

// Mock the vocabulary-db module - use the same path as the import in useVocabulary.ts
vi.mock('@/lib/vocabulary-db', () => ({
  getVocabularyDB: vi.fn(() => Promise.resolve(mockDBMethods)),
}));

// Import after mocks are set up
import { useVocabulary } from '../useVocabulary';

// Helper to reset all mocks to default state
function resetAllMocks() {
  Object.values(mockDBMethods).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  // Set default return values
  mockDBMethods.getDecks.mockResolvedValue([]);
  mockDBMethods.getItems.mockResolvedValue([]);
  mockDBMethods.getFlashcards.mockResolvedValue([]);
  mockDBMethods.getAllFlashcards.mockResolvedValue([]);
  mockDBMethods.getDueCards.mockResolvedValue([]);
  mockDBMethods.getDueCardsForDeck.mockResolvedValue([]);
  mockDBMethods.init.mockResolvedValue(undefined);
  mockDBMethods.getDeck.mockResolvedValue(null);
  mockDBMethods.getItem.mockResolvedValue(null);
}

describe('useVocabulary', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useVocabulary());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.decks).toEqual([]);
      expect(result.current.currentDeck).toBeNull();
      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should load decks on mount', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.decks).toEqual(mockDecks);
      expect(result.current.currentDeck).toEqual(mockDecks[0]);
    });

    it('should set current deck to first deck on load', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
        {
          id: 'deck-2',
          language: 'zh',
          name: 'Chinese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.currentDeck).toEqual(mockDecks[0]);
    });
  });

  describe('createDeck', () => {
    it('should create a new deck', async () => {
      mockDBMethods.getDecks.mockResolvedValue([]);
      mockDBMethods.createDeck.mockImplementation(async (deck: LanguageDeck) => deck);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      let newDeck: LanguageDeck | undefined;
      await act(async () => {
        newDeck = await result.current.createDeck('ja', 'Japanese');
      });

      expect(mockDBMethods.createDeck).toHaveBeenCalled();
      expect(newDeck?.language).toBe('ja');
      expect(newDeck?.name).toBe('Japanese');
      expect(newDeck?.id).toBeDefined();
    });
  });

  describe('deleteDeck', () => {
    it('should delete a deck and its items', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      const mockItems: VocabularyItem[] = [
        {
          id: 'item-1',
          deckId: 'deck-1',
          word: 'word',
          language: 'ja',
          translation: 'trans',
          context: '',
          source: 'manual',
          createdAt: new Date(),
          tags: [],
        },
      ];

      // Set up mocks for initial load
      mockDBMethods.getDecks.mockResolvedValueOnce(mockDecks);
      mockDBMethods.getItems.mockResolvedValueOnce(mockItems);
      mockDBMethods.deleteFlashcardsForVocabulary.mockResolvedValue(undefined);
      mockDBMethods.deleteItem.mockResolvedValue(undefined);
      mockDBMethods.deleteDeck.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVocabulary());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Set up mocks for delete operation
      mockDBMethods.getItems.mockResolvedValueOnce(mockItems);
      mockDBMethods.getDecks.mockResolvedValueOnce([]);

      await act(async () => {
        await result.current.deleteDeck('deck-1');
      });

      expect(mockDBMethods.deleteFlashcardsForVocabulary).toHaveBeenCalledWith('item-1');
      expect(mockDBMethods.deleteItem).toHaveBeenCalledWith('item-1');
      expect(mockDBMethods.deleteDeck).toHaveBeenCalledWith('deck-1');
    });
  });

  describe('addItem', () => {
    it('should add a new vocabulary item', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);
      mockDBMethods.addItem.mockImplementation(async (item: VocabularyItem) => item);
      mockDBMethods.addFlashcard.mockImplementation(async (card: Flashcard) => card);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.currentDeck).toEqual(mockDecks[0]);
      }, { timeout: 5000 });

      let newItem: VocabularyItem | null | undefined;
      await act(async () => {
        newItem = await result.current.addItem(
          'word',
          'translation',
          'context',
          'manual'
        );
      });

      expect(mockDBMethods.addItem).toHaveBeenCalled();
      expect(newItem?.word).toBe('word');
      expect(newItem?.translation).toBe('translation');
    });

    it('should return null when no deck is selected', async () => {
      mockDBMethods.getDecks.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      let item: VocabularyItem | null | undefined;
      await act(async () => {
        item = await result.current.addItem('word', 'translation', '', 'manual');
      });

      expect(item).toBeNull();
      expect(result.current.error).toBe('No deck selected');
    });
  });

  describe('deleteItem', () => {
    it('should delete an item and its flashcards', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);
      mockDBMethods.deleteFlashcardsForVocabulary.mockResolvedValue(undefined);
      mockDBMethods.deleteItem.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.deleteItem('item-1');
      });

      expect(mockDBMethods.deleteFlashcardsForVocabulary).toHaveBeenCalledWith('item-1');
      expect(mockDBMethods.deleteItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('setCurrentDeck', () => {
    it('should update current deck', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
        {
          id: 'deck-2',
          language: 'zh',
          name: 'Chinese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.currentDeck).toEqual(mockDecks[0]);
      }, { timeout: 5000 });

      // Change to second deck
      act(() => {
        result.current.setCurrentDeck(mockDecks[1]);
      });

      // Wait for the state update
      await waitFor(() => {
        expect(result.current.currentDeck).toEqual(mockDecks[1]);
      }, { timeout: 5000 });
    });
  });

  describe('refreshDecks', () => {
    it('should reload decks from database', async () => {
      const initialDecks: LanguageDeck[] = [];
      mockDBMethods.getDecks.mockResolvedValue(initialDecks);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.decks).toEqual([]);

      // Update mock to return new deck
      const newDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];
      mockDBMethods.getDecks.mockResolvedValue(newDecks);

      await act(async () => {
        await result.current.refreshDecks();
      });

      await waitFor(() => {
        expect(result.current.decks).toEqual(newDecks);
      }, { timeout: 5000 });
    });
  });

  describe('refreshItems', () => {
    it('should reload items for current deck', async () => {
      const mockDecks: LanguageDeck[] = [
        {
          id: 'deck-1',
          language: 'ja',
          name: 'Japanese',
          createdAt: new Date(),
          stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
        },
      ];

      mockDBMethods.getDecks.mockResolvedValue(mockDecks);
      mockDBMethods.getItems.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.currentDeck).toEqual(mockDecks[0]);
      }, { timeout: 5000 });

      // Update mock to return items
      const mockItems: VocabularyItem[] = [
        {
          id: 'item-1',
          deckId: 'deck-1',
          word: 'word',
          language: 'ja',
          translation: 'trans',
          context: '',
          source: 'manual',
          createdAt: new Date(),
          tags: [],
        },
      ];
      mockDBMethods.getItems.mockResolvedValue(mockItems);

      await act(async () => {
        await result.current.refreshItems();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockItems);
      }, { timeout: 5000 });
    });

    it('should clear items when no deck is selected', async () => {
      mockDBMethods.getDecks.mockResolvedValue([]);

      const { result } = renderHook(() => useVocabulary());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.refreshItems();
      });

      expect(result.current.items).toEqual([]);
    });
  });
});