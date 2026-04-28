# Phase 2 Implementation Specifications: SRS & Gamification

## Overview

Phase 2 builds on the vocabulary system from Phase 1 to add:
- Complete spaced repetition system with review scheduling
- Gamification elements (streaks, XP, levels, achievements)
- Progress tracking per language
- Statistics and analytics

---

## 1. Gamification Types

```typescript
// src/types/gamification.ts

export interface UserProgress {
  id: string;
  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null; // ISO date string
  
  // XP and Levels
  totalXP: number;
  currentLevel: number;
  xpToNextLevel: number;
  
  // Statistics
  totalWordsLearned: number;
  totalReviews: number;
  totalConversations: number;
  totalMinutesPracticed: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface LanguageProgress {
  id: string;
  language: string;
  
  // Language-specific stats
  wordsLearned: number;
  totalReviews: number;
  accuracy: number; // percentage
  averageSessionTime: number; // minutes
  
  // Streak per language
  currentStreak: number;
  longestStreak: number;
  
  // Level per language
  level: number;
  xp: number;
  
  updatedAt: Date;
}

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date | null;
  progress: number; // 0-100
  requirement: number;
}

export type AchievementType = 
  | 'streak_7'      // 7 day streak
  | 'streak_30'     // 30 day streak
  | 'streak_100'    // 100 day streak
  | 'words_100'     // Learn 100 words
  | 'words_500'     // Learn 500 words
  | 'words_1000'    // Learn 1000 words
  | 'reviews_100'   // Complete 100 reviews
  | 'reviews_500'   // Complete 500 reviews
  | 'reviews_1000'  // Complete 1000 reviews
  | 'perfect_10'    // 10 perfect reviews in a row
  | 'perfect_50'    // 50 perfect reviews in a row
  | 'conversation_10' // 10 conversations
  | 'conversation_50' // 50 conversations
  | 'polyglot'      // Learn 3+ languages
  | 'early_bird'    // Review before 7am
  | 'night_owl'     // Review after 11pm
  | 'weekend_warrior' // Review on weekends
  | 'marathon'      // 1 hour session
  | 'sprinter'      // 50 reviews in one session
  | 'perfectionist' // 100% accuracy in a session
  ;

export interface ReviewSession {
  id: string;
  deckId: string;
  startedAt: Date;
  endedAt: Date | null;
  cardsReviewed: number;
  correctAnswers: number;
  xpEarned: number;
  perfectStreak: number; // consecutive correct in this session
}

// XP Constants
export const XP_VALUES = {
  CARD_REVIEW: 5,
  CARD_CORRECT: 10,
  CARD_PERFECT: 15, // "Easy" rating
  STREAK_BONUS: 2,  // per streak day
  CONVERSATION_MINUTE: 20,
  NEW_WORD: 15,
  ACHIEVEMENT_BONUS: 50,
} as const;

// Level Constants
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  2000,   // Level 6
  3500,   // Level 7
  5500,   // Level 8
  8000,   // Level 9
  11000,  // Level 10
  15000,  // Level 11
  20000,  // Level 12
  27000,  // Level 13
  35000,  // Level 14
  45000,  // Level 15
  60000,  // Level 16
  80000,  // Level 17
  105000, // Level 18
  135000, // Level 19
  170000, // Level 20
];

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Beginner',
  2: 'Novice',
  3: 'Learner',
  4: 'Student',
  5: 'Apprentice',
  6: 'Practitioner',
  7: 'Scholar',
  8: 'Expert',
  9: 'Master',
  10: 'Grandmaster',
  11: 'Virtuoso',
  12: 'Sage',
  13: 'Guru',
  14: 'Legend',
  15: 'Immortal',
  16: 'Divine',
  17: 'Celestial',
  18: 'Mythical',
  19: 'Transcendent',
  20: 'Omniscient',
};
```

---

## 2. Gamification Database

```typescript
// src/lib/gamification-db.ts

import type { UserProgress, LanguageProgress, Achievement, ReviewSession } from '@/types/gamification';

const DB_NAME = 'soulnotes-gamification';
const DB_VERSION = 1;

class GamificationDatabase {
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
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
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
}

let dbInstance: GamificationDatabase | null = null;

export async function getGamificationDB(): Promise<GamificationDatabase> {
  if (!dbInstance) {
    dbInstance = new GamificationDatabase();
    await dbInstance.init();
  }
  return dbInstance;
}
```

---

## 3. Gamification Hook

```typescript
// src/hooks/useGamification.ts

import { useState, useEffect, useCallback } from 'react';
import { getGamificationDB } from '@/lib/gamification-db';
import { 
  UserProgress, 
  LanguageProgress, 
  Achievement, 
  AchievementType,
  ReviewSession,
  XP_VALUES,
  LEVEL_THRESHOLDS,
  LEVEL_NAMES,
} from '@/types/gamification';

const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  { id: 'streak_7', type: 'streak_7', name: 'Week Warrior', description: '7 day streak', icon: '🔥', requirement: 7 },
  { id: 'streak_30', type: 'streak_30', name: 'Monthly Master', description: '30 day streak', icon: '💪', requirement: 30 },
  { id: 'streak_100', type: 'streak_100', name: 'Century Club', description: '100 day streak', icon: '🏆', requirement: 100 },
  { id: 'words_100', type: 'words_100', name: 'Vocabulary Builder', description: 'Learn 100 words', icon: '📚', requirement: 100 },
  { id: 'words_500', type: 'words_500', name: 'Word Collector', description: 'Learn 500 words', icon: '📖', requirement: 500 },
  { id: 'words_1000', type: 'words_1000', name: 'Lexicon Master', description: 'Learn 1000 words', icon: '🎓', requirement: 1000 },
  { id: 'reviews_100', type: 'reviews_100', name: 'Dedicated Learner', description: 'Complete 100 reviews', icon: '⭐', requirement: 100 },
  { id: 'reviews_500', type: 'reviews_500', name: 'Review Champion', description: 'Complete 500 reviews', icon: '🌟', requirement: 500 },
  { id: 'reviews_1000', type: 'reviews_1000', name: 'Review Legend', description: 'Complete 1000 reviews', icon: '💫', requirement: 1000 },
  { id: 'perfect_10', type: 'perfect_10', name: 'Perfect Ten', description: '10 correct in a row', icon: '🎯', requirement: 10 },
  { id: 'perfect_50', type: 'perfect_50', name: 'Perfect Fifty', description: '50 correct in a row', icon: '🎪', requirement: 50 },
  { id: 'conversation_10', type: 'conversation_10', name: 'Conversationalist', description: '10 conversations', icon: '💬', requirement: 10 },
  { id: 'conversation_50', type: 'conversation_50', name: 'Talk Master', description: '50 conversations', icon: '🗣️', requirement: 50 },
  { id: 'polyglot', type: 'polyglot', name: 'Polyglot', description: 'Learn 3+ languages', icon: '🌍', requirement: 3 },
  { id: 'early_bird', type: 'early_bird', name: 'Early Bird', description: 'Review before 7am', icon: '🌅', requirement: 1 },
  { id: 'night_owl', type: 'night_owl', name: 'Night Owl', description: 'Review after 11pm', icon: '🦉', requirement: 1 },
  { id: 'weekend_warrior', type: 'weekend_warrior', name: 'Weekend Warrior', description: 'Review on weekends', icon: '📅', requirement: 1 },
  { id: 'marathon', type: 'marathon', name: 'Marathon Runner', description: '1 hour session', icon: '🏃', requirement: 60 },
  { id: 'sprinter', type: 'sprinter', name: 'Sprinter', description: '50 reviews in one session', icon: '⚡', requirement: 50 },
  { id: 'perfectionist', type: 'perfectionist', name: 'Perfectionist', description: '100% accuracy in a session', icon: '💎', requirement: 100 },
];

interface UseGamificationReturn {
  userProgress: UserProgress | null;
  languageProgress: LanguageProgress[];
  achievements: Achievement[];
  currentSession: ReviewSession | null;
  isLoading: boolean;
  
  // Actions
  startReviewSession: (deckId: string) => Promise<void>;
  recordReview: (correct: boolean, rating: 'again' | 'hard' | 'good' | 'easy') => Promise<number>; // returns XP earned
  endReviewSession: () => Promise<void>;
  addConversationXP: (minutes: number) => Promise<void>;
  addNewWordXP: () => Promise<void>;
  checkAchievements: () => Promise<Achievement[]>;
  getLevelName: (level: number) => string;
  getXPProgress: () => { current: number; needed: number; percentage: number };
}

export function useGamification(): UseGamificationReturn {
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [languageProgress, setLanguageProgress] = useState<LanguageProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentSession, setCurrentSession] = useState<ReviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize
  useEffect(() => {
    async function loadProgress() {
      const db = await getGamificationDB();
      
      let progress = await db.getUserProgress();
      if (!progress) {
        progress = createDefaultUserProgress();
        await db.saveUserProgress(progress);
      }
      setUserProgress(progress);
      
      const langProgress = await db.getAllLanguageProgress();
      setLanguageProgress(langProgress);
      
      let storedAchievements = await db.getAchievements();
      if (storedAchievements.length === 0) {
        storedAchievements = ACHIEVEMENT_DEFINITIONS.map(def => ({
          ...def,
          unlockedAt: null,
          progress: 0,
        }));
        for (const achievement of storedAchievements) {
          await db.saveAchievement(achievement);
        }
      }
      setAchievements(storedAchievements);
      setIsLoading(false);
    }
    
    loadProgress();
  }, []);

  const createDefaultUserProgress = (): UserProgress => ({
    id: 'default',
    currentStreak: 0,
    longestStreak: 0,
    lastReviewDate: null,
    totalXP: 0,
    currentLevel: 1,
    xpToNextLevel: LEVEL_THRESHOLDS[1],
    totalWordsLearned: 0,
    totalReviews: 0,
    totalConversations: 0,
    totalMinutesPracticed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const calculateLevel = (xp: number): { level: number; xpToNext: number } => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        const nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i];
        return { level: i + 1, xpToNext: nextThreshold - xp };
      }
    }
    return { level: 1, xpToNext: LEVEL_THRESHOLDS[1] };
  };

  const addXP = useCallback(async (amount: number): Promise<void> => {
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (!progress) progress = createDefaultUserProgress();
    
    progress.totalXP += amount;
    const { level, xpToNext } = calculateLevel(progress.totalXP);
    progress.currentLevel = level;
    progress.xpToNextLevel = xpToNext;
    progress.updatedAt = new Date();
    
    await db.saveUserProgress(progress);
    setUserProgress(progress);
  }, []);

  const updateStreak = useCallback(async (): Promise<void> => {
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (!progress) progress = createDefaultUserProgress();
    
    const today = new Date().toISOString().split('T')[0];
    const lastReview = progress.lastReviewDate;
    
    if (lastReview) {
      const lastDate = new Date(lastReview);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        // Consecutive day
        progress.currentStreak += 1;
      } else if (lastDate.toISOString().split('T')[0] !== today) {
        // Streak broken
        progress.currentStreak = 1;
      }
      // Same day - no change
    } else {
      progress.currentStreak = 1;
    }
    
    progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
    progress.lastReviewDate = today;
    progress.updatedAt = new Date();
    
    await db.saveUserProgress(progress);
    setUserProgress(progress);
  }, []);

  const startReviewSession = useCallback(async (deckId: string): Promise<void> => {
    const session: ReviewSession = {
      id: crypto.randomUUID(),
      deckId,
      startedAt: new Date(),
      endedAt: null,
      cardsReviewed: 0,
      correctAnswers: 0,
      xpEarned: 0,
      perfectStreak: 0,
    };
    
    const db = await getGamificationDB();
    await db.createSession(session);
    setCurrentSession(session);
  }, []);

  const recordReview = useCallback(async (
    correct: boolean,
    rating: 'again' | 'hard' | 'good' | 'easy'
  ): Promise<number> => {
    if (!currentSession) return 0;
    
    let xp = XP_VALUES.CARD_REVIEW;
    if (correct) {
      xp += XP_VALUES.CARD_CORRECT;
      if (rating === 'easy') {
        xp += XP_VALUES.CARD_PERFECT - XP_VALUES.CARD_CORRECT;
      }
    }
    
    // Streak bonus
    if (userProgress && userProgress.currentStreak > 0) {
      xp += XP_VALUES.STREAK_BONUS * Math.min(userProgress.currentStreak, 10);
    }
    
    const db = await getGamificationDB();
    
    // Update session
    const updatedSession = {
      ...currentSession,
      cardsReviewed: currentSession.cardsReviewed + 1,
      correctAnswers: currentSession.correctAnswers + (correct ? 1 : 0),
      xpEarned: currentSession.xpEarned + xp,
      perfectStreak: correct ? currentSession.perfectStreak + 1 : 0,
    };
    await db.updateSession(updatedSession);
    setCurrentSession(updatedSession);
    
    // Update user progress
    let progress = await db.getUserProgress();
    if (progress) {
      progress.totalReviews += 1;
      progress.updatedAt = new Date();
      await db.saveUserProgress(progress);
      setUserProgress(progress);
    }
    
    // Add XP
    await addXP(xp);
    
    // Update streak if first review of the day
    if (progress?.lastReviewDate !== new Date().toISOString().split('T')[0]) {
      await updateStreak();
    }
    
    return xp;
  }, [currentSession, userProgress, addXP, updateStreak]);

  const endReviewSession = useCallback(async (): Promise<void> => {
    if (!currentSession) return;
    
    const db = await getGamificationDB();
    const endedSession = {
      ...currentSession,
      endedAt: new Date(),
    };
    await db.updateSession(endedSession);
    
    // Check for session-based achievements
    await checkAchievements();
    
    setCurrentSession(null);
  }, [currentSession]);

  const addConversationXP = useCallback(async (minutes: number): Promise<void> => {
    const xp = minutes * XP_VALUES.CONVERSATION_MINUTE;
    await addXP(xp);
    
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (progress) {
      progress.totalConversations += 1;
      progress.totalMinutesPracticed += minutes;
      await db.saveUserProgress(progress);
      setUserProgress(progress);
    }
  }, [addXP]);

  const addNewWordXP = useCallback(async (): Promise<void> => {
    await addXP(XP_VALUES.NEW_WORD);
    
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (progress) {
      progress.totalWordsLearned += 1;
      await db.saveUserProgress(progress);
      setUserProgress(progress);
    }
  }, [addXP]);

  const checkAchievements = useCallback(async (): Promise<Achievement[]> => {
    const db = await getGamificationDB();
    const progress = await db.getUserProgress();
    const achievements = await db.getAchievements();
    const newlyUnlocked: Achievement[] = [];
    
    for (const achievement of achievements) {
      if (achievement.unlockedAt) continue;
      
      let newProgress = 0;
      let unlocked = false;
      
      switch (achievement.type) {
        case 'streak_7':
        case 'streak_30':
        case 'streak_100':
          newProgress = progress?.currentStreak || 0;
          unlocked = newProgress >= achievement.requirement;
          break;
        case 'words_100':
        case 'words_500':
        case 'words_1000':
          newProgress = progress?.totalWordsLearned || 0;
          unlocked = newProgress >= achievement.requirement;
          break;
        case 'reviews_100':
        case 'reviews_500':
        case 'reviews_1000':
          newProgress = progress?.totalReviews || 0;
          unlocked = newProgress >= achievement.requirement;
          break;
        case 'perfect_10':
        case 'perfect_50':
          newProgress = currentSession?.perfectStreak || 0;
          unlocked = newProgress >= achievement.requirement;
          break;
        case 'early_bird':
          const hour = new Date().getHours();
          unlocked = hour < 7;
          newProgress = unlocked ? 1 : 0;
          break;
        case 'night_owl':
          const hourNow = new Date().getHours();
          unlocked = hourNow >= 23;
          newProgress = unlocked ? 1 : 0;
          break;
        case 'weekend_warrior':
          const day = new Date().getDay();
          unlocked = day === 0 || day === 6;
          newProgress = unlocked ? 1 : 0;
          break;
        case 'marathon':
          if (currentSession) {
            const minutes = (Date.now() - new Date(currentSession.startedAt).getTime()) / 60000;
            newProgress = Math.floor(minutes);
            unlocked = minutes >= achievement.requirement;
          }
          break;
        case 'sprinter':
          newProgress = currentSession?.cardsReviewed || 0;
          unlocked = newProgress >= achievement.requirement;
          break;
        case 'perfectionist':
          if (currentSession && currentSession.cardsReviewed > 0) {
            const accuracy = (currentSession.correctAnswers / currentSession.cardsReviewed) * 100;
            newProgress = Math.floor(accuracy);
            unlocked = accuracy >= 100 && currentSession.cardsReviewed >= 10;
          }
          break;
        case 'polyglot':
          const languages = await db.getAllLanguageProgress();
          newProgress = languages.length;
          unlocked = languages.length >= achievement.requirement;
          break;
      }
      
      achievement.progress = Math.min(100, (newProgress / achievement.requirement) * 100);
      
      if (unlocked && !achievement.unlockedAt) {
        achievement.unlockedAt = new Date();
        newlyUnlocked.push(achievement);
        await addXP(XP_VALUES.ACHIEVEMENT_BONUS);
      }
      
      await db.saveAchievement(achievement);
    }
    
    setAchievements(achievements);
    return newlyUnlocked;
  }, [currentSession, addXP]);

  const getLevelName = useCallback((level: number): string => {
    return LEVEL_NAMES[level] || `Level ${level}`;
  }, []);

  const getXPProgress = useCallback((): { current: number; needed: number; percentage: number } => {
    if (!userProgress) return { current: 0, needed: LEVEL_THRESHOLDS[1], percentage: 0 };
    
    const currentLevelThreshold = LEVEL_THRESHOLDS[userProgress.currentLevel - 1] || 0;
    const nextLevelThreshold = LEVEL_THRESHOLDS[userProgress.currentLevel] || currentLevelThreshold;
    const xpInLevel = userProgress.totalXP - currentLevelThreshold;
    const xpNeeded = nextLevelThreshold - currentLevelThreshold;
    
    return {
      current: xpInLevel,
      needed: xpNeeded,
      percentage: Math.min(100, (xpInLevel / xpNeeded) * 100),
    };
  }, [userProgress]);

  return {
    userProgress,
    languageProgress,
    achievements,
    currentSession,
    isLoading,
    startReviewSession,
    recordReview,
    endReviewSession,
    addConversationXP,
    addNewWordXP,
    checkAchievements,
    getLevelName,
    getXPProgress,
  };
}
```

---

## 4. Streak Display Component

```typescript
// src/components/StreakDisplay.tsx

'use client';

import { useGamification } from '@/hooks/useGamification';

export function StreakDisplay() {
  const { userProgress } = useGamification();
  
  if (!userProgress) return null;
  
  const { currentStreak, longestStreak } = userProgress;
  
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Current Streak</p>
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">{currentStreak} days</p>
        </div>
      </div>
      
      <div className="h-8 w-px bg-[#d7c7a7] dark:bg-[#3b2f1d]" />
      
      <div>
        <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Longest</p>
        <p className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">{longestStreak} days</p>
      </div>
    </div>
  );
}
```

---

## 5. XP and Level Display

```typescript
// src/components/XPDisplay.tsx

'use client';

import { useGamification } from '@/hooks/useGamification';

export function XPDisplay() {
  const { userProgress, getLevelName, getXPProgress } = useGamification();
  
  if (!userProgress) return null;
  
  const { current, needed, percentage } = getXPProgress();
  const levelName = getLevelName(userProgress.currentLevel);
  
  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Level {userProgress.currentLevel}</p>
          <p className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">{levelName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">{userProgress.totalXP.toLocaleString()} XP</p>
        </div>
      </div>
      
      <div className="mt-3">
        <div className="flex justify-between text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
          <span>{current} XP</span>
          <span>{needed} XP to next level</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Achievements Display

```typescript
// src/components/AchievementsDisplay.tsx

'use client';

import { useState } from 'react';
import { useGamification } from '@/hooks/useGamification';
import type { Achievement } from '@/types/gamification';

export function AchievementsDisplay() {
  const { achievements } = useGamification();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  
  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  
  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Achievements</h3>
        <span className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          {unlockedCount} / {achievements.length}
        </span>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {achievements.map((achievement) => (
          <button
            key={achievement.id}
            onClick={() => setSelectedAchievement(achievement)}
            className={`relative flex h-12 w-12 items-center justify-center rounded-lg text-2xl transition ${
              achievement.unlockedAt
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-800/30 grayscale'
            }`}
            title={achievement.name}
          >
            {achievement.icon}
            {achievement.unlockedAt && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
      
      {selectedAchievement && (
        <div className="mt-4 rounded-lg bg-[#efe0c3]/50 p-3 dark:bg-[#2a2218]/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedAchievement.icon}</span>
            <div>
              <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                {selectedAchievement.name}
              </p>
              <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                {selectedAchievement.description}
              </p>
            </div>
          </div>
          
          {!selectedAchievement.unlockedAt && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                <span>Progress</span>
                <span>{Math.round(selectedAchievement.progress)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#d7c7a7] dark:bg-[#3b2f1d]">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${selectedAchievement.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {selectedAchievement.unlockedAt && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              Unlocked {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 7. Review Session Summary

```typescript
// src/components/ReviewSummary.tsx

'use client';

import type { ReviewSession } from '@/types/gamification';

interface ReviewSummaryProps {
  session: ReviewSession;
  onClose: () => void;
}

export function ReviewSummary({ session, onClose }: ReviewSummaryProps) {
  const accuracy = session.cardsReviewed > 0
    ? Math.round((session.correctAnswers / session.cardsReviewed) * 100)
    : 0;
  
  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]">
        <h2 className="text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Session Complete! 🎉
        </h2>
        
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {session.cardsReviewed}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Cards Reviewed</p>
          </div>
          
          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {accuracy}%
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">Accuracy</p>
          </div>
          
          <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {session.xpEarned}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">XP Earned</p>
          </div>
          
          <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {duration}
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">Minutes</p>
          </div>
        </div>
        
        {session.perfectStreak >= 10 && (
          <div className="mt-4 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 p-3 text-center dark:from-amber-900/30 dark:to-amber-800/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              🔥 Perfect Streak: {session.perfectStreak} correct in a row!
            </p>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

---

## 8. Updated FlashcardReview with Gamification

```typescript
// src/components/FlashcardReview.tsx (updated)

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useGamification } from '@/hooks/useGamification';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import { calculateNextReview, initializeNewCard } from '@/lib/srs';
import type { VocabularyItem, Flashcard, LanguageDeck, ReviewResult } from '@/types/vocabulary';
import { ReviewSummary } from './ReviewSummary';

interface FlashcardReviewProps {
  deck: LanguageDeck | null;
  items: VocabularyItem[];
}

export function FlashcardReview({ deck, items }: FlashcardReviewProps) {
  const { isPremium, isAtLimit } = useVocabulary();
  const { 
    startReviewSession, 
    recordReview, 
    endReviewSession, 
    currentSession 
  } = useGamification();
  
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const currentCard = dueCards[currentIndex];
  const currentItem = items.find(i => i.id === currentCard?.vocabularyId);

  // Load due cards
  useEffect(() => {
    async function loadDueCards() {
      if (!deck) {
        setDueCards([]);
        setIsLoading(false);
        return;
      }
      
      const db = await getVocabularyDB();
      const cards = await db.getDueCards(deck.id);
      setDueCards(cards);
      setIsLoading(false);
    }
    
    loadDueCards();
  }, [deck]);

  // Start session when cards are loaded
  useEffect(() => {
    if (dueCards.length > 0 && deck && !currentSession) {
      startReviewSession(deck.id);
    }
  }, [dueCards, deck, currentSession, startReviewSession]);

  const handleRate = useCallback(async (rating: ReviewResult['rating']) => {
    if (!currentCard) return;
    
    const correct = rating !== 'again';
    await recordReview(correct, rating);
    
    // Update card SRS
    const db = await getVocabularyDB();
    const updatedCard = calculateNextReview(currentCard, rating);
    await db.updateFlashcard(updatedCard);
    
    // Move to next card
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      // Session complete
      await endReviewSession();
      setSessionComplete(true);
    }
  }, [currentCard, currentIndex, dueCards.length, recordReview, endReviewSession]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <p className="text-lg text-[#5c4d39] dark:text-[#c8b7a0]">Select a deck to start reviewing</p>
      </div>
    );
  }

  if (dueCards.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <span className="text-4xl">🎉</span>
        <p className="text-lg text-[#1f1c16] dark:text-[#f3e9d8]">All caught up!</p>
        <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">No cards due for review. Check back later.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
            Card {currentIndex + 1} of {dueCards.length}
          </p>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${((currentIndex + 1) / dueCards.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="relative min-h-[300px] cursor-pointer perspective-1000"
        >
          <div className={`absolute inset-0 transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}>
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-black/10 bg-white/80 p-8 shadow-lg dark:border-white/10 dark:bg-[#15120d]/85">
              <p className="text-2xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
                {isFlipped ? currentCard?.back : currentCard?.front}
              </p>
              {currentItem && !isFlipped && (
                <p className="mt-4 text-sm text-[#8b7a5a] dark:text-[#6b5a3f]">
                  {currentItem.context}
                </p>
              )}
              {!isFlipped && (
                <p className="mt-4 text-xs text-[#a08a68] dark:text-[#8b7355]">
                  Click to reveal answer
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rating buttons */}
        {isFlipped && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => handleRate('again')}
              className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
            >
              Again
            </button>
            <button
              onClick={() => handleRate('hard')}
              className="rounded-lg bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300"
            >
              Hard
            </button>
            <button
              onClick={() => handleRate('good')}
              className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
            >
              Good
            </button>
            <button
              onClick={() => handleRate('easy')}
              className="rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
            >
              Easy
            </button>
          </div>
        )}
      </div>

      {/* Session Summary Modal */}
      {sessionComplete && currentSession && (
        <ReviewSummary
          session={currentSession}
          onClose={() => {
            setSessionComplete(false);
            setDueCards([]);
          }}
        />
      )}
    </>
  );
}
```

---

## 9. Implementation Checklist

### Phase 2A: Gamification Types & Database (Week 1)
- [ ] Create gamification types (`src/types/gamification.ts`)
- [ ] Create gamification database (`src/lib/gamification-db.ts`)
- [ ] Define achievement types and requirements
- [ ] Define XP values and level thresholds

### Phase 2B: Gamification Hook (Week 1)
- [ ] Create useGamification hook
- [ ] Implement XP calculation
- [ ] Implement level calculation
- [ ] Implement streak tracking
- [ ] Implement achievement checking

### Phase 2C: UI Components (Week 2)
- [ ] Create StreakDisplay component
- [ ] Create XPDisplay component
- [ ] Create AchievementsDisplay component
- [ ] Create ReviewSummary component
- [ ] Update FlashcardReview with gamification

### Phase 2D: Integration (Week 2)
- [ ] Integrate gamification with vocabulary system
- [ ] Add XP notifications
- [ ] Add achievement unlock notifications
- [ ] Add level up celebrations
- [ ] Test all gamification flows

---

## 10. CSS Additions

Add to `globals.css`:

```css
/* Card flip animation */
.perspective-1000 {
  perspective: 1000px;
}

.rotate-y-180 {
  transform: rotateY(180deg);
}

/* XP popup animation */
@keyframes xp-popup {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  50% {
    opacity: 1;
    transform: translateY(-10px);
  }
  100% {
    opacity: 0;
    transform: translateY(-20px);
  }
}

.xp-popup {
  animation: xp-popup 1.5s ease-out forwards;
}

/* Achievement unlock animation */
@keyframes achievement-unlock {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.achievement-unlock {
  animation: achievement-unlock 0.5s ease-out forwards;
}

/* Level up celebration */
@keyframes level-up {
  0%, 100% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.1);
  }
  50% {
    transform: scale(1);
  }
  75% {
    transform: scale(1.05);
  }
}

.level-up {
  animation: level-up 0.8s ease-in-out;
}