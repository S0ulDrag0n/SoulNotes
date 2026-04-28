/**
 * Vocabulary Database - IndexedDB storage for vocabulary and flashcards
 */

import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

const DB_NAME = 'soulnotes-vocabulary';
const DB_VERSION = 1;

export class VocabularyDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Decks store
        if (!db.objectStoreNames.contains('decks')) {
          const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
          deckStore.createIndex('language', 'language', { unique: false });
        }

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('deckId', 'deckId', { unique: false });
          itemStore.createIndex('word', 'word', { unique: false });
          itemStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Flashcards store
        if (!db.objectStoreNames.contains('flashcards')) {
          const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          cardStore.createIndex('vocabularyId', 'vocabularyId', { unique: false });
          cardStore.createIndex('dueDate', 'dueDate', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Vocabulary database not initialized.');
    }
    return this.db;
  }

  isReady(): boolean {
    return this.db !== null;
  }

  // Deck operations
  async getDecks(): Promise<LanguageDeck[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readonly');
      const store = transaction.objectStore('decks');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDeck(id: string): Promise<LanguageDeck | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readonly');
      const store = transaction.objectStore('decks');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async createDeck(deck: LanguageDeck): Promise<LanguageDeck> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.add(deck);

      request.onsuccess = () => resolve(deck);
      request.onerror = () => reject(request.error);
    });
  }

  async updateDeck(deck: LanguageDeck): Promise<LanguageDeck> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.put(deck);

      request.onsuccess = () => resolve(deck);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDeck(deckId: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.delete(deckId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Vocabulary item operations
  async getItems(deckId: string): Promise<VocabularyItem[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readonly');
      const store = transaction.objectStore('items');
      const index = store.index('deckId');
      const request = index.getAll(deckId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getItem(id: string): Promise<VocabularyItem | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readonly');
      const store = transaction.objectStore('items');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addItem(item: VocabularyItem): Promise<VocabularyItem> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.add(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async updateItem(item: VocabularyItem): Promise<VocabularyItem> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Flashcard operations
  async getFlashcards(vocabularyId: string): Promise<Flashcard[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const index = store.index('vocabularyId');
      const request = index.getAll(vocabularyId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFlashcards(): Promise<Flashcard[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDueCards(): Promise<Flashcard[]> {
    const db = this.ensureDb();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const request = store.getAll();

      request.onsuccess = () => {
        const cards = request.result.filter(card => 
          new Date(card.dueDate) <= now
        );
        resolve(cards);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getDueCardsForDeck(deckId: string): Promise<Flashcard[]> {
    const db = this.ensureDb();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // First get all items for the deck
    const items = await this.getItems(deckId);
    const itemIds = new Set(items.map(item => item.id));

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const request = store.getAll();

      request.onsuccess = () => {
        const cards = request.result.filter(card => 
          itemIds.has(card.vocabularyId) && new Date(card.dueDate) <= now
        );
        resolve(cards);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addFlashcard(card: Flashcard): Promise<Flashcard> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readwrite');
      const store = transaction.objectStore('flashcards');
      const request = store.add(card);

      request.onsuccess = () => resolve(card);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFlashcard(card: Flashcard): Promise<Flashcard> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readwrite');
      const store = transaction.objectStore('flashcards');
      const request = store.put(card);

      request.onsuccess = () => resolve(card);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFlashcard(cardId: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readwrite');
      const store = transaction.objectStore('flashcards');
      const request = store.delete(cardId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFlashcardsForVocabulary(vocabularyId: string): Promise<void> {
    const cards = await this.getFlashcards(vocabularyId);
    const db = this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readwrite');
      const store = transaction.objectStore('flashcards');
      
      let completed = 0;
      const total = cards.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      for (const card of cards) {
        const request = store.delete(card.id);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      }
    });
  }

  /**
   * Recalculate stats for a specific deck based on actual item count
   */
  async recalculateDeckStats(deckId: string): Promise<LanguageDeck> {
    const db = this.ensureDb();
    
    // Get the deck
    const deck = await this.getDeck(deckId);
    if (!deck) {
      throw new Error(`Deck with id ${deckId} not found`);
    }
    
    // Count actual items
    const items = await this.getItems(deckId);
    const actualCount = items.length;
    
    // Update deck stats
    const updatedDeck: LanguageDeck = {
      ...deck,
      stats: {
        ...deck.stats,
        totalWords: actualCount,
      },
    };
    
    // Save updated deck
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.put(updatedDeck);

      request.onsuccess = () => resolve(updatedDeck);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Recalculate stats for all decks based on actual item counts
   */
  async recalculateAllDeckStats(): Promise<LanguageDeck[]> {
    const decks = await this.getDecks();
    const updatedDecks: LanguageDeck[] = [];
    
    for (const deck of decks) {
      const updatedDeck = await this.recalculateDeckStats(deck.id);
      updatedDecks.push(updatedDeck);
    }
    
    return updatedDecks;
  }
}

// Singleton instance - initialized once at app start
let dbInstance: VocabularyDatabase | null = null;
let initPromise: Promise<VocabularyDatabase> | null = null;

/**
 * Initialize the vocabulary database. Called once at app start.
 * Subsequent calls will return the same promise.
 */
export function initVocabularyDB(): Promise<VocabularyDatabase> {
  if (dbInstance?.isReady()) {
    return Promise.resolve(dbInstance);
  }
  
  if (!initPromise) {
    const db = new VocabularyDatabase();
    initPromise = db.init().then(() => {
      dbInstance = db;
      return dbInstance;
    }).catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  
  return initPromise;
}

/**
 * Get the vocabulary database instance. Initializes if not already done.
 * All callers share the same initialization promise.
 */
export async function getVocabularyDB(): Promise<VocabularyDatabase> {
  // If already initialized, return immediately
  if (dbInstance?.isReady()) {
    return dbInstance;
  }
  
  // Otherwise, initialize (or wait for existing initialization)
  return initVocabularyDB();
}