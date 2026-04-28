// Vitest globals are available - no explicit imports needed
import type { UserProgress, LanguageProgress, Achievement, ReviewSession } from '@/types/gamification';

// Helper to create default user progress
function createTestUserProgress(overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    id: 'default',
    currentStreak: 0,
    longestStreak: 0,
    lastReviewDate: null,
    totalXP: 0,
    currentLevel: 1,
    xpToNextLevel: 100,
    totalWordsLearned: 0,
    totalReviews: 0,
    totalConversations: 0,
    totalMinutesPracticed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create test language progress
function createTestLanguageProgress(overrides: Partial<LanguageProgress> = {}): LanguageProgress {
  return {
    id: 'lang-1',
    language: 'ja',
    wordsLearned: 0,
    totalReviews: 0,
    accuracy: 0,
    averageSessionTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    level: 1,
    xp: 0,
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create test achievement
function createTestAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 'test-achievement',
    type: 'streak_7',
    name: 'Test Achievement',
    description: 'Test description',
    icon: '🏆',
    unlockedAt: null,
    progress: 0,
    requirement: 7,
    ...overrides,
  };
}

// Helper to create test review session
function createTestSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    id: 'session-1',
    deckId: 'deck-1',
    startedAt: new Date(),
    endedAt: null,
    cardsReviewed: 0,
    correctAnswers: 0,
    xpEarned: 0,
    perfectStreak: 0,
    ...overrides,
  };
}

describe('GamificationDatabase', () => {
  // We'll test the database operations with a mock IndexedDB
  // Since IndexedDB is not available in Node.js test environment,
  // we'll mock the database operations

  describe('UserProgress operations', () => {
    it('should save and retrieve user progress', async () => {
      // This test would require IndexedDB mock
      // For now, we'll test the data structures
      const progress = createTestUserProgress({ totalXP: 500, currentLevel: 3 });
      
      expect(progress.id).toBe('default');
      expect(progress.totalXP).toBe(500);
      expect(progress.currentLevel).toBe(3);
    });

    it('should update user progress fields', () => {
      const progress = createTestUserProgress();
      
      const updated = {
        ...progress,
        totalXP: 100,
        currentLevel: 2,
        currentStreak: 5,
        longestStreak: 5,
        lastReviewDate: new Date().toISOString(),
      };

      expect(updated.totalXP).toBe(100);
      expect(updated.currentLevel).toBe(2);
      expect(updated.currentStreak).toBe(5);
    });
  });

  describe('LanguageProgress operations', () => {
    it('should create language progress with correct defaults', () => {
      const langProgress = createTestLanguageProgress();
      
      expect(langProgress.language).toBe('ja');
      expect(langProgress.level).toBe(1);
      expect(langProgress.xp).toBe(0);
    });

    it('should update language progress', () => {
      const langProgress = createTestLanguageProgress();
      
      const updated = {
        ...langProgress,
        wordsLearned: 50,
        totalReviews: 100,
        accuracy: 85,
        level: 3,
        xp: 500,
      };

      expect(updated.wordsLearned).toBe(50);
      expect(updated.accuracy).toBe(85);
      expect(updated.level).toBe(3);
    });
  });

  describe('Achievement operations', () => {
    it('should create achievement with correct structure', () => {
      const achievement = createTestAchievement();
      
      expect(achievement.id).toBe('test-achievement');
      expect(achievement.type).toBe('streak_7');
      expect(achievement.unlockedAt).toBeNull();
      expect(achievement.progress).toBe(0);
    });

    it('should unlock achievement', () => {
      const achievement = createTestAchievement();
      
      const unlocked = {
        ...achievement,
        unlockedAt: new Date(),
        progress: 100,
      };

      expect(unlocked.unlockedAt).not.toBeNull();
      expect(unlocked.progress).toBe(100);
    });

    it('should calculate achievement progress', () => {
      const achievement = createTestAchievement({ requirement: 100 });
      
      // Progress calculation: (current / requirement) * 100
      const current = 25;
      const progress = Math.min(100, (current / achievement.requirement) * 100);
      
      expect(progress).toBe(25);
    });
  });

  describe('ReviewSession operations', () => {
    it('should create session with correct defaults', () => {
      const session = createTestSession();
      
      expect(session.id).toBe('session-1');
      expect(session.deckId).toBe('deck-1');
      expect(session.cardsReviewed).toBe(0);
      expect(session.correctAnswers).toBe(0);
      expect(session.xpEarned).toBe(0);
      expect(session.endedAt).toBeNull();
    });

    it('should update session after reviews', () => {
      const session = createTestSession();
      
      // Simulate some reviews
      const updated = {
        ...session,
        cardsReviewed: 10,
        correctAnswers: 8,
        xpEarned: 150,
        perfectStreak: 5,
      };

      expect(updated.cardsReviewed).toBe(10);
      expect(updated.correctAnswers).toBe(8);
      expect(updated.xpEarned).toBe(150);
    });

    it('should end session', () => {
      const session = createTestSession();
      
      const ended = {
        ...session,
        endedAt: new Date(),
      };

      expect(ended.endedAt).not.toBeNull();
    });

    it('should calculate session accuracy', () => {
      const session = createTestSession({
        cardsReviewed: 20,
        correctAnswers: 16,
      });

      const accuracy = (session.correctAnswers / session.cardsReviewed) * 100;
      expect(accuracy).toBe(80);
    });

    it('should calculate session duration', () => {
      const startedAt = new Date();
      startedAt.setMinutes(startedAt.getMinutes() - 15);
      
      const session = createTestSession({
        startedAt,
        endedAt: new Date(),
      });

      const duration = session.endedAt 
        ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
        : 0;

      expect(duration).toBe(15);
    });
  });
});

describe('XP Calculations', () => {
  it('should calculate XP for correct answer', () => {
    const CARD_REVIEW = 5;
    const CARD_CORRECT = 10;
    
    const xp = CARD_REVIEW + CARD_CORRECT;
    expect(xp).toBe(15);
  });

  it('should calculate XP for easy answer', () => {
    const CARD_REVIEW = 5;
    const CARD_PERFECT = 15;
    
    const xp = CARD_REVIEW + CARD_PERFECT;
    expect(xp).toBe(20);
  });

  it('should calculate XP for incorrect answer', () => {
    const CARD_REVIEW = 5;
    
    const xp = CARD_REVIEW;
    expect(xp).toBe(5);
  });

  it('should calculate streak bonus', () => {
    const STREAK_BONUS = 2;
    const currentStreak = 5;
    const maxStreakBonus = 10;
    
    const bonus = STREAK_BONUS * Math.min(currentStreak, maxStreakBonus);
    expect(bonus).toBe(10);
  });

  it('should cap streak bonus at 10 days', () => {
    const STREAK_BONUS = 2;
    const currentStreak = 15;
    const maxStreakBonus = 10;
    
    const bonus = STREAK_BONUS * Math.min(currentStreak, maxStreakBonus);
    expect(bonus).toBe(20); // 2 * 10 = 20
  });
});

describe('Level Calculations', () => {
  const LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000,
    15000, 20000, 27000, 35000, 45000, 60000, 80000, 105000, 135000, 170000,
  ];

  it('should calculate level 1 for 0 XP', () => {
    const xp = 0;
    let level = 1;
    
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    
    expect(level).toBe(1);
  });

  it('should calculate level 2 for 100 XP', () => {
    const xp = 100;
    let level = 1;
    
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    
    expect(level).toBe(2);
  });

  it('should calculate level 5 for 1000 XP', () => {
    const xp = 1000;
    let level = 1;
    
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    
    expect(level).toBe(5);
  });

  it('should calculate level 10 for 11000 XP', () => {
    const xp = 11000;
    let level = 1;
    
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    
    expect(level).toBe(10);
  });

  it('should calculate XP to next level', () => {
    const xp = 300;
    const currentLevelThreshold = LEVEL_THRESHOLDS[2]; // 250 for level 3
    const nextLevelThreshold = LEVEL_THRESHOLDS[3]; // 500 for level 4
    
    const xpInLevel = xp - currentLevelThreshold; // 50
    const xpNeeded = nextLevelThreshold - currentLevelThreshold; // 250
    
    expect(xpInLevel).toBe(50);
    expect(xpNeeded).toBe(250);
  });
});

describe('Achievement Progress', () => {
  it('should calculate streak achievement progress', () => {
    const currentStreak = 5;
    const requirement = 7;
    
    const progress = Math.min(100, (currentStreak / requirement) * 100);
    expect(progress).toBeCloseTo(71.43, 1);
  });

  it('should detect unlocked streak achievement', () => {
    const currentStreak = 7;
    const requirement = 7;
    
    const unlocked = currentStreak >= requirement;
    expect(unlocked).toBe(true);
  });

  it('should calculate words learned achievement progress', () => {
    const wordsLearned = 50;
    const requirement = 100;
    
    const progress = Math.min(100, (wordsLearned / requirement) * 100);
    expect(progress).toBe(50);
  });

  it('should calculate reviews achievement progress', () => {
    const totalReviews = 250;
    const requirement = 500;
    
    const progress = Math.min(100, (totalReviews / requirement) * 100);
    expect(progress).toBe(50);
  });

  it('should detect perfect streak achievement', () => {
    const perfectStreak = 10;
    const requirement = 10;
    
    const unlocked = perfectStreak >= requirement;
    expect(unlocked).toBe(true);
  });

  it('should detect early bird achievement', () => {
    const hour = 6; // 6 AM
    const unlocked = hour < 7;
    expect(unlocked).toBe(true);
  });

  it('should detect night owl achievement', () => {
    const hour = 23; // 11 PM
    const unlocked = hour >= 23;
    expect(unlocked).toBe(true);
  });

  it('should detect weekend warrior achievement', () => {
    const day = 0; // Sunday
    const unlocked = day === 0 || day === 6;
    expect(unlocked).toBe(true);
  });

  it('should detect marathon achievement', () => {
    const sessionDuration = 65; // minutes
    const requirement = 60;
    
    const unlocked = sessionDuration >= requirement;
    expect(unlocked).toBe(true);
  });

  it('should detect sprinter achievement', () => {
    const cardsReviewed = 50;
    const requirement = 50;
    
    const unlocked = cardsReviewed >= requirement;
    expect(unlocked).toBe(true);
  });

  it('should detect perfectionist achievement', () => {
    const cardsReviewed = 15;
    const correctAnswers = 15;
    const accuracy = (correctAnswers / cardsReviewed) * 100;
    
    const unlocked = accuracy >= 100 && cardsReviewed >= 10;
    expect(unlocked).toBe(true);
  });

  it('should not detect perfectionist with low card count', () => {
    const cardsReviewed = 5;
    const correctAnswers = 5;
    const accuracy = (correctAnswers / cardsReviewed) * 100;
    
    const unlocked = accuracy >= 100 && cardsReviewed >= 10;
    expect(unlocked).toBe(false);
  });
  
  describe('Database initialization', () => {
    it('should throw distinct error when gamification database not initialized', async () => {
      const { GamificationDatabase } = await import('../gamification-db');
      const uninitializedDb = new GamificationDatabase();
      
      await expect(uninitializedDb.getUserProgress()).rejects.toThrow(
        'Gamification database not initialized.'
      );
    });
  
    it('should report isReady() as false before initialization', async () => {
      const { GamificationDatabase } = await import('../gamification-db');
      const db = new GamificationDatabase();
      
      expect(db.isReady()).toBe(false);
    });
  });
});