// Vitest globals are available - no explicit imports needed
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

// Mock IndexedDB
interface MockObjectStore {
  name: string;
  indexNames: string[];
  createIndex: (name: string, keyPath: string, options?: { unique: boolean }) => void;
  add: (value: unknown) => MockIDBRequest;
  get: (key: string) => MockIDBRequest;
  getAll: (query?: string) => MockIDBRequest;
  put: (value: unknown) => MockIDBRequest;
  delete: (key: string) => MockIDBRequest;
}

interface MockIndex {
  getAll: (query: string) => MockIDBRequest;
}

interface MockTransaction {
  objectStore: (name: string) => MockObjectStore & { index: (name: string) => MockIndex };
}

interface MockIDBRequest {
  result: unknown;
  error: Error | null;
  onsuccess: ((event: { target: MockIDBRequest }) => void) | null;
  onerror: ((event: { target: MockIDBRequest }) => void) | null;
}

interface MockIDBDatabase {
  objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore: (name: string, options: { keyPath: string }) => MockObjectStore;
  transaction: (storeNames: string | string[], mode: string) => MockTransaction;
}

describe('VocabularyDatabase', () => {
  let mockIndexedDB: {
    open: (name: string, version: number) => MockIDBRequest;
  };
  let mockDB: MockIDBDatabase;
  let stores: Map<string, MockObjectStore>;
  let storeData: Map<string, Map<string, unknown>>;
  let dbInstance: Awaited<ReturnType<typeof import('../vocabulary-db').getVocabularyDB>>;

  beforeEach(async () => {
    stores = new Map();
    storeData = new Map();
    
    // Initialize store data
    storeData.set('decks', new Map());
    storeData.set('items', new Map());
    storeData.set('flashcards', new Map());

    mockDB = {
      objectStoreNames: {
        contains: (name: string) => stores.has(name),
      },
      createObjectStore: (name: string, options: { keyPath: string }) => {
        const store: MockObjectStore = {
          name,
          indexNames: [],
          createIndex: (indexName: string) => {
            store.indexNames.push(indexName);
          },
          add: (value: unknown) => {
            const key = (value as Record<string, unknown>)[options.keyPath] as string;
            storeData.get(name)?.set(key, value);
            const request: MockIDBRequest = {
              result: value,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => request.onsuccess?.({ target: request }), 0);
            return request;
          },
          get: (key: string) => {
            const data = storeData.get(name)?.get(key);
            const request: MockIDBRequest = {
              result: data || undefined,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => request.onsuccess?.({ target: request }), 0);
            return request;
          },
          getAll: () => {
            const data = Array.from(storeData.get(name)?.values() || []);
            const request: MockIDBRequest = {
              result: data,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => request.onsuccess?.({ target: request }), 0);
            return request;
          },
          put: (value: unknown) => {
            const key = (value as Record<string, unknown>)[options.keyPath] as string;
            storeData.get(name)?.set(key, value);
            const request: MockIDBRequest = {
              result: value,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => request.onsuccess?.({ target: request }), 0);
            return request;
          },
          delete: (key: string) => {
            storeData.get(name)?.delete(key);
            const request: MockIDBRequest = {
              result: undefined,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            setTimeout(() => request.onsuccess?.({ target: request }), 0);
            return request;
          },
        };
        stores.set(name, store);
        return store;
      },
      transaction: (storeNames: string | string[], _mode: string) => {
        const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
        const store = stores.get(storeName);
        
        if (!store) {
          throw new Error(`Store ${storeName} not found`);
        }

        // Create a mock store with index support
        const mockStoreWithIndex: MockObjectStore & { index: (name: string) => MockIndex } = {
          ...store,
          index: (indexName: string) => {
            return {
              getAll: (query: string) => {
                // Filter data by index
                const allData = Array.from(storeData.get(storeName)?.values() || []);
                let filtered: unknown[];
                
                if (indexName === 'deckId') {
                  filtered = allData.filter(item => (item as { deckId: string }).deckId === query);
                } else if (indexName === 'vocabularyId') {
                  filtered = allData.filter(item => (item as { vocabularyId: string }).vocabularyId === query);
                } else {
                  filtered = allData;
                }
                
                const request: MockIDBRequest = {
                  result: filtered,
                  error: null,
                  onsuccess: null,
                  onerror: null,
                };
                setTimeout(() => request.onsuccess?.({ target: request }), 0);
                return request;
              },
            };
          },
        };
        
        return {
          objectStore: () => mockStoreWithIndex,
        };
      },
    };

    mockIndexedDB = {
      open: (_name: string, _version: number) => {
        const request: MockIDBRequest = {
          result: null,
          error: null,
          onsuccess: null,
          onerror: null,
        };

        setTimeout(() => {
          // Simulate onupgradeneeded
          // Create stores if they don't exist
          if (!stores.has('decks')) {
            mockDB.createObjectStore('decks', { keyPath: 'id' });
          }
          if (!stores.has('items')) {
            const itemStore = mockDB.createObjectStore('items', { keyPath: 'id' });
            itemStore.createIndex('deckId', 'deckId', { unique: false });
          }
          if (!stores.has('flashcards')) {
            const cardStore = mockDB.createObjectStore('flashcards', { keyPath: 'id' });
            cardStore.createIndex('vocabularyId', 'vocabularyId', { unique: false });
          }
          
          request.result = mockDB;
          request.onsuccess?.({ target: request });
        }, 0);

        return request;
      },
    };

    // @ts-expect-error - Mock for testing
    globalThis.indexedDB = mockIndexedDB;

    // Clear the singleton instance
    vi.resetModules();
    
    // Get a fresh database instance
    const { getVocabularyDB } = await import('../vocabulary-db');
    dbInstance = await getVocabularyDB();
  });

  afterEach(() => {
    vi.clearAllMocks();
    stores.clear();
    storeData.clear();
  });

  describe('Deck operations', () => {
    it('should create and get a deck', async () => {
      const deck: LanguageDeck = {
        id: 'deck-1',
        language: 'ja',
        name: 'Japanese Vocabulary',
        createdAt: new Date(),
        stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
      };

      await dbInstance.createDeck(deck);
      const result = await dbInstance.getDeck('deck-1');

      expect(result).toEqual(deck);
    });

    it('should return null for non-existent deck', async () => {
      const result = await dbInstance.getDeck('non-existent');
      expect(result).toBeNull();
    });

    it('should get all decks', async () => {
      const deck1: LanguageDeck = {
        id: 'deck-1',
        language: 'ja',
        name: 'Japanese',
        createdAt: new Date(),
        stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
      };

      const deck2: LanguageDeck = {
        id: 'deck-2',
        language: 'zh',
        name: 'Chinese',
        createdAt: new Date(),
        stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
      };

      await dbInstance.createDeck(deck1);
      await dbInstance.createDeck(deck2);

      const result = await dbInstance.getDecks();
      expect(result).toHaveLength(2);
    });

    it('should update a deck', async () => {
      const deck: LanguageDeck = {
        id: 'deck-1',
        language: 'ja',
        name: 'Japanese',
        createdAt: new Date(),
        stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
      };

      await dbInstance.createDeck(deck);

      const updatedDeck: LanguageDeck = {
        ...deck,
        name: 'Japanese Vocabulary',
      };

      await dbInstance.updateDeck(updatedDeck);
      const result = await dbInstance.getDeck('deck-1');

      expect(result?.name).toBe('Japanese Vocabulary');
    });

    it('should delete a deck', async () => {
      const deck: LanguageDeck = {
        id: 'deck-1',
        language: 'ja',
        name: 'Japanese',
        createdAt: new Date(),
        stats: { totalWords: 0, wordsLearned: 0, dueToday: 0 },
      };

      await dbInstance.createDeck(deck);
      await dbInstance.deleteDeck('deck-1');
      const result = await dbInstance.getDeck('deck-1');

      expect(result).toBeNull();
    });
  });

  describe('Vocabulary item operations', () => {
    it('should add and get an item', async () => {
      const item: VocabularyItem = {
        id: 'item-1',
        deckId: 'deck-1',
        word: 'こんにちは',
        language: 'ja',
        translation: 'Hello',
        context: 'Used as a greeting',
        source: 'manual',
        createdAt: new Date(),
        tags: [],
      };

      await dbInstance.addItem(item);
      const result = await dbInstance.getItem('item-1');

      expect(result).toEqual(item);
    });

    it('should get items for a deck', async () => {
      const item1: VocabularyItem = {
        id: 'item-1',
        deckId: 'deck-1',
        word: 'word1',
        language: 'ja',
        translation: 'trans1',
        context: '',
        source: 'manual',
        createdAt: new Date(),
        tags: [],
      };

      const item2: VocabularyItem = {
        id: 'item-2',
        deckId: 'deck-1',
        word: 'word2',
        language: 'ja',
        translation: 'trans2',
        context: '',
        source: 'manual',
        createdAt: new Date(),
        tags: [],
      };

      await dbInstance.addItem(item1);
      await dbInstance.addItem(item2);

      const result = await dbInstance.getItems('deck-1');
      expect(result).toHaveLength(2);
    });

    it('should update an item', async () => {
      const item: VocabularyItem = {
        id: 'item-1',
        deckId: 'deck-1',
        word: 'word',
        language: 'ja',
        translation: 'trans',
        context: '',
        source: 'manual',
        createdAt: new Date(),
        tags: [],
      };

      await dbInstance.addItem(item);

      const updatedItem: VocabularyItem = {
        ...item,
        translation: 'updated translation',
      };

      await dbInstance.updateItem(updatedItem);
      const result = await dbInstance.getItem('item-1');

      expect(result?.translation).toBe('updated translation');
    });

    it('should delete an item', async () => {
      const item: VocabularyItem = {
        id: 'item-1',
        deckId: 'deck-1',
        word: 'word',
        language: 'ja',
        translation: 'trans',
        context: '',
        source: 'manual',
        createdAt: new Date(),
        tags: [],
      };

      await dbInstance.addItem(item);
      await dbInstance.deleteItem('item-1');
      const result = await dbInstance.getItem('item-1');

      expect(result).toBeNull();
    });
  });

  describe('Flashcard operations', () => {
    it('should add and get flashcards', async () => {
      const card: Flashcard = {
        id: 'card-1',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'こんにちは',
        back: 'Hello',
        ease: 2.5,
        interval: 1,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };

      await dbInstance.addFlashcard(card);
      const result = await dbInstance.getFlashcards('item-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(card);
    });

    it('should get all flashcards', async () => {
      const card1: Flashcard = {
        id: 'card-1',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'word1',
        back: 'trans1',
        ease: 2.5,
        interval: 1,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };

      const card2: Flashcard = {
        id: 'card-2',
        vocabularyId: 'item-2',
        type: 'basic',
        front: 'word2',
        back: 'trans2',
        ease: 2.5,
        interval: 1,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };

      await dbInstance.addFlashcard(card1);
      await dbInstance.addFlashcard(card2);

      const result = await dbInstance.getAllFlashcards();
      expect(result).toHaveLength(2);
    });

    it('should update a flashcard', async () => {
      const card: Flashcard = {
        id: 'card-1',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'word',
        back: 'trans',
        ease: 2.5,
        interval: 1,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };

      await dbInstance.addFlashcard(card);

      const updatedCard: Flashcard = {
        ...card,
        ease: 2.3,
        interval: 3,
      };

      await dbInstance.updateFlashcard(updatedCard);
      const result = await dbInstance.getFlashcards('item-1');

      expect(result[0].ease).toBe(2.3);
      expect(result[0].interval).toBe(3);
    });

    it('should delete a flashcard', async () => {
      const card: Flashcard = {
        id: 'card-1',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'word',
        back: 'trans',
        ease: 2.5,
        interval: 1,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };

      await dbInstance.addFlashcard(card);
      await dbInstance.deleteFlashcard('card-1');
      const result = await dbInstance.getFlashcards('item-1');

      expect(result).toHaveLength(0);
    });

    it('should get due cards', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

      const pastCard: Flashcard = {
        id: 'card-1',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'past',
        back: 'Past',
        ease: 2.5,
        interval: 1,
        dueDate: pastDate,
        reviewCount: 1,
        lapseCount: 0,
      };

      const futureCard: Flashcard = {
        id: 'card-2',
        vocabularyId: 'item-1',
        type: 'basic',
        front: 'future',
        back: 'Future',
        ease: 2.5,
        interval: 1,
        dueDate: futureDate,
        reviewCount: 1,
        lapseCount: 0,
      };

      await dbInstance.addFlashcard(pastCard);
      await dbInstance.addFlashcard(futureCard);

      const result = await dbInstance.getDueCards();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });
  });

  describe('Database initialization', () => {
    it('should throw distinct error when database not initialized', async () => {
      // Create a new database instance without initializing
      const { VocabularyDatabase } = await import('../vocabulary-db');
      const uninitializedDb = new VocabularyDatabase();
      
      await expect(uninitializedDb.getDecks()).rejects.toThrow(
        'Vocabulary database not initialized.'
      );
    });

    it('should report isReady() as false before initialization', async () => {
      const { VocabularyDatabase } = await import('../vocabulary-db');
      const db = new VocabularyDatabase();
      
      expect(db.isReady()).toBe(false);
    });

    it('should report isReady() as true after initialization', async () => {
      expect(dbInstance.isReady()).toBe(true);
    });

    it('should return the same instance from getVocabularyDB', async () => {
      const { getVocabularyDB } = await import('../vocabulary-db');
      const instance1 = await getVocabularyDB();
      const instance2 = await getVocabularyDB();
      
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance from initVocabularyDB', async () => {
      const { initVocabularyDB } = await import('../vocabulary-db');
      const instance1 = await initVocabularyDB();
      const instance2 = await initVocabularyDB();
      
      expect(instance1).toBe(instance2);
    });
  });
});