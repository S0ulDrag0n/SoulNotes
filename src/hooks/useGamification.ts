'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGamificationDB } from '@/lib/gamification-db';
import { useGamificationInit } from '@/providers/GamificationProvider';
import {
  UserProgress,
  LanguageProgress,
  Achievement,
  AchievementType,
  ReviewSession,
  XP_VALUES,
  LEVEL_THRESHOLDS,
  LEVEL_NAMES,
  ACHIEVEMENT_DEFINITIONS,
} from '@/types/gamification';

export interface GamificationCallbacks {
  onXPEarned?: (amount: number, reason: string) => void;
  onAchievementUnlocked?: (achievement: Achievement) => void;
  onLevelUp?: (newLevel: number, levelName: string) => void;
  onStreakUpdated?: (streak: number) => void;
}

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
  refreshProgress: () => Promise<void>;
}

export function useGamification(callbacks?: GamificationCallbacks): UseGamificationReturn {
  const { isInitialized, error: initError } = useGamificationInit();
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [languageProgress, setLanguageProgress] = useState<LanguageProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentSession, setCurrentSession] = useState<ReviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create default user progress
  const createDefaultUserProgress = useCallback((): UserProgress => ({
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
  }), []);

  // Calculate level from XP
  const calculateLevel = useCallback((xp: number): { level: number; xpToNext: number } => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        const nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i];
        return { level: i + 1, xpToNext: nextThreshold - xp };
      }
    }
    return { level: 1, xpToNext: LEVEL_THRESHOLDS[1] };
  }, []);

  // Initialize data from database
  useEffect(() => {
    // Wait for database initialization
    if (!isInitialized) {
      return;
    }
    
    // Handle initialization error
    if (initError) {
      console.error('Gamification database initialization error:', initError);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function loadProgress() {
      try {
        const db = await getGamificationDB();
        
        // Load user progress
        let progress = await db.getUserProgress();
        if (!progress) {
          progress = createDefaultUserProgress();
          await db.saveUserProgress(progress);
        }
        
        if (!mounted) return;
        setUserProgress(progress);
        
        // Load language progress
        const langProgress = await db.getAllLanguageProgress();
        if (!mounted) return;
        setLanguageProgress(langProgress);
        
        // Load or initialize achievements
        let storedAchievements = await db.getAchievements();
        if (storedAchievements.length === 0) {
          storedAchievements = ACHIEVEMENT_DEFINITIONS.map(def => ({
            ...def,
            unlockedAt: null,
            progress: 0,
          }));
          await db.saveAchievements(storedAchievements);
        }
        if (!mounted) return;
        setAchievements(storedAchievements);
      } catch (error) {
        console.error('Failed to load gamification data:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadProgress();
    
    return () => {
      mounted = false;
    };
  }, [createDefaultUserProgress, isInitialized, initError]);

  // Add XP to user progress
  const addXP = useCallback(async (amount: number, reason: string = 'Experience gained'): Promise<void> => {
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (!progress) progress = createDefaultUserProgress();
    
    const previousLevel = progress.currentLevel;
    
    progress.totalXP += amount;
    const { level, xpToNext } = calculateLevel(progress.totalXP);
    progress.currentLevel = level;
    progress.xpToNextLevel = xpToNext;
    progress.updatedAt = new Date();
    
    await db.saveUserProgress(progress);
    setUserProgress(progress);
    
    // Notify XP earned
    callbacks?.onXPEarned?.(amount, reason);
    
    // Check for level up
    if (level > previousLevel) {
      const levelName = LEVEL_NAMES[level] || `Level ${level}`;
      callbacks?.onLevelUp?.(level, levelName);
    }
  }, [createDefaultUserProgress, calculateLevel, callbacks]);

  // Update streak
  const updateStreak = useCallback(async (): Promise<void> => {
    const db = await getGamificationDB();
    let progress = await db.getUserProgress();
    if (!progress) progress = createDefaultUserProgress();
    
    const previousStreak = progress.currentStreak;
    const today = new Date().toISOString().split('T')[0];
    const lastReview = progress.lastReviewDate;
    
    if (lastReview) {
      const lastDate = new Date(lastReview);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastDateStr = lastDate.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastDateStr === yesterdayStr) {
        // Consecutive day
        progress.currentStreak += 1;
      } else if (lastDateStr !== today) {
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
    
    // Notify streak update if it changed
    if (progress.currentStreak !== previousStreak && progress.currentStreak > 0) {
      callbacks?.onStreakUpdated?.(progress.currentStreak);
    }
  }, [createDefaultUserProgress, callbacks]);

  // Start a review session
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

  // Record a review
  const recordReview = useCallback(async (
    correct: boolean,
    rating: 'again' | 'hard' | 'good' | 'easy'
  ): Promise<number> => {
    if (!currentSession) return 0;
    
    // Calculate XP
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
    const today = new Date().toISOString().split('T')[0];
    if (progress?.lastReviewDate !== today) {
      await updateStreak();
    }
    
    return xp;
  }, [currentSession, userProgress, addXP, updateStreak]);

  // End review session
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

  // Add conversation XP
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

  // Add new word XP
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

  // Check achievements
  const checkAchievements = useCallback(async (): Promise<Achievement[]> => {
    const db = await getGamificationDB();
    const progress = await db.getUserProgress();
    const currentAchievements = await db.getAchievements();
    const newlyUnlocked: Achievement[] = [];
    
    for (const achievement of currentAchievements) {
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
        case 'conversation_10':
        case 'conversation_50':
          newProgress = progress?.totalConversations || 0;
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
        await addXP(XP_VALUES.ACHIEVEMENT_BONUS, 'Achievement unlocked!');
        
        // Notify achievement unlocked
        callbacks?.onAchievementUnlocked?.(achievement);
      }
      
      await db.saveAchievement(achievement);
    }
    
    setAchievements([...currentAchievements]);
    return newlyUnlocked;
  }, [currentSession, addXP, callbacks]);

  // Get level name
  const getLevelName = useCallback((level: number): string => {
    return LEVEL_NAMES[level] || `Level ${level}`;
  }, []);

  // Get XP progress for current level
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

  // Refresh progress from database
  const refreshProgress = useCallback(async (): Promise<void> => {
    const db = await getGamificationDB();
    
    const progress = await db.getUserProgress();
    if (progress) setUserProgress(progress);
    
    const langProgress = await db.getAllLanguageProgress();
    setLanguageProgress(langProgress);
    
    const storedAchievements = await db.getAchievements();
    setAchievements(storedAchievements);
  }, []);

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
    refreshProgress,
  };
}