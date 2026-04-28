/**
 * Gamification Database - IndexedDB storage for gamification data
 */

import type { UserProgress, LanguageProgress, Achievement, ReviewSession } from '@/types/gamification';

const DB_NAME = 'soulnotes-gamification';
const DB_VERSION = 1;

export class GamificationDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('userProgress')) {
          db.createObjectStore('userProgress', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('languageProgress')) {
          const langStore = db.createObjectStore('languageProgress', { keyPath: 'id' });
          langStore.createIndex('language', 'language', { unique: false });
        }

        if (!db.objectStoreNames.contains('achievements')) {
          const achievementStore = db.createObjectStore('achievements', { keyPath: 'id' });
          achievementStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('reviewSessions')) {
          const sessionStore = db.createObjectStore('reviewSessions', { keyPath: 'id' });
          sessionStore.createIndex('deckId', 'deckId', { unique: false });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
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
      throw new Error('Gamification database not initialized.');
    }
    return this.db;
  }

  isReady(): boolean {
    return this.db !== null;
  }

  // User Progress
  async getUserProgress(): Promise<UserProgress | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('userProgress', 'readonly');
      const store = transaction.objectStore('userProgress');
      const request = store.get('default');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserProgress(progress: UserProgress): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('userProgress', 'readwrite');
      const store = transaction.objectStore('userProgress');
      const request = store.put(progress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Language Progress
  async getLanguageProgress(language: string): Promise<LanguageProgress | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('languageProgress', 'readonly');
      const store = transaction.objectStore('languageProgress');
      const index = store.index('language');
      const request = index.get(language);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllLanguageProgress(): Promise<LanguageProgress[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('languageProgress', 'readonly');
      const store = transaction.objectStore('languageProgress');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveLanguageProgress(progress: LanguageProgress): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('languageProgress', 'readwrite');
      const store = transaction.objectStore('languageProgress');
      const request = store.put(progress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Achievements
  async getAchievements(): Promise<Achievement[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('achievements', 'readonly');
      const store = transaction.objectStore('achievements');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAchievement(id: string): Promise<Achievement | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('achievements', 'readonly');
      const store = transaction.objectStore('achievements');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAchievement(achievement: Achievement): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('achievements', 'readwrite');
      const store = transaction.objectStore('achievements');
      const request = store.put(achievement);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveAchievements(achievements: Achievement[]): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('achievements', 'readwrite');
      const store = transaction.objectStore('achievements');
      
      let completed = 0;
      const total = achievements.length;
      
      if (total === 0) {
        resolve();
        return;
      }

      for (const achievement of achievements) {
        const request = store.put(achievement);
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

  // Review Sessions
  async createSession(session: ReviewSession): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reviewSessions', 'readwrite');
      const store = transaction.objectStore('reviewSessions');
      const request = store.add(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateSession(session: ReviewSession): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reviewSessions', 'readwrite');
      const store = transaction.objectStore('reviewSessions');
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(id: string): Promise<ReviewSession | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reviewSessions', 'readonly');
      const store = transaction.objectStore('reviewSessions');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentSessions(limit: number = 10): Promise<ReviewSession[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reviewSessions', 'readonly');
      const store = transaction.objectStore('reviewSessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, limit);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionsForDeck(deckId: string): Promise<ReviewSession[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reviewSessions', 'readonly');
      const store = transaction.objectStore('reviewSessions');
      const index = store.index('deckId');
      const request = index.getAll(deckId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    const db = this.ensureDb();
    const storeNames = ['userProgress', 'languageProgress', 'achievements', 'reviewSessions'];
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      
      for (const storeName of storeNames) {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === storeNames.length) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      }
    });
  }
}

// Singleton instance - initialized once at app start
let dbInstance: GamificationDatabase | null = null;
let initPromise: Promise<GamificationDatabase> | null = null;

/**
 * Initialize the database. Called once by GamificationProvider at app start.
 * Subsequent calls will return the same promise.
 */
export function initGamificationDB(): Promise<GamificationDatabase> {
  if (dbInstance?.isReady()) {
    return Promise.resolve(dbInstance);
  }
  
  if (!initPromise) {
    const db = new GamificationDatabase();
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
 * Get the database instance. Initializes if not already done.
 * All callers share the same initialization promise.
 */
export async function getGamificationDB(): Promise<GamificationDatabase> {
  // If already initialized, return immediately
  if (dbInstance?.isReady()) {
    return dbInstance;
  }
  
  // Otherwise, initialize (or wait for existing initialization)
  return initGamificationDB();
}