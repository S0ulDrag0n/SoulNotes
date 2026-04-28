// Vitest globals are available - no explicit imports needed
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UserProgress, Achievement, ReviewSession } from '@/types/gamification';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

// Create a shared mock object for database methods
const mockDBMethods = {
  getUserProgress: vi.fn(),
  saveUserProgress: vi.fn(),
  getLanguageProgress: vi.fn(),
  getAllLanguageProgress: vi.fn(),
  saveLanguageProgress: vi.fn(),
  getAchievements: vi.fn(),
  getAchievement: vi.fn(),
  saveAchievement: vi.fn(),
  saveAchievements: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn(),
  getRecentSessions: vi.fn(),
  getSessionsForDeck: vi.fn(),
  clearAllData: vi.fn(),
  init: vi.fn(),
};

// Mock the gamification-db module
vi.mock('@/lib/gamification-db', () => ({
  getGamificationDB: vi.fn(() => Promise.resolve(mockDBMethods)),
}));

// Mock the GamificationProvider
vi.mock('@/providers/GamificationProvider', () => ({
  useGamificationInit: () => ({
    isInitialized: true,
    error: null,
  }),
}));

// Import after mocks are set up
import { useGamification } from '../useGamification';

// Helper to create default user progress
function createDefaultUserProgress(): UserProgress {
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
  };
}

// Helper to create default achievements
function createDefaultAchievements(): Achievement[] {
  return [
    { id: 'streak_7', type: 'streak_7', name: 'Week Warrior', description: '7 day streak', icon: '🔥', unlockedAt: null, progress: 0, requirement: 7 },
    { id: 'words_100', type: 'words_100', name: 'Vocabulary Builder', description: 'Learn 100 words', icon: '📚', unlockedAt: null, progress: 0, requirement: 100 },
    { id: 'reviews_100', type: 'reviews_100', name: 'Dedicated Learner', description: 'Complete 100 reviews', icon: '⭐', unlockedAt: null, progress: 0, requirement: 100 },
  ];
}

// Helper to reset all mocks to default state
function resetAllMocks() {
  Object.values(mockDBMethods).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
  // Set default return values
  mockDBMethods.getUserProgress.mockResolvedValue(null);
  mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
  mockDBMethods.getAchievements.mockResolvedValue([]);
  mockDBMethods.saveUserProgress.mockResolvedValue(undefined);
  mockDBMethods.saveAchievement.mockResolvedValue(undefined);
  mockDBMethods.saveAchievements.mockResolvedValue(undefined);
  mockDBMethods.createSession.mockResolvedValue(undefined);
  mockDBMethods.updateSession.mockResolvedValue(undefined);
  mockDBMethods.init.mockResolvedValue(undefined);
}

describe('useGamification', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useGamification());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.userProgress).toBeNull();
      expect(result.current.achievements).toEqual([]);
      expect(result.current.currentSession).toBeNull();
    });

    it('should create default user progress when none exists', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(null);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue([]);
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);
      mockDBMethods.saveAchievements.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.userProgress).not.toBeNull();
      expect(result.current.userProgress?.currentLevel).toBe(1);
      expect(result.current.userProgress?.totalXP).toBe(0);
    });

    it('should load existing user progress', async () => {
      const existingProgress: UserProgress = {
        ...createDefaultUserProgress(),
        totalXP: 500,
        currentLevel: 3,
        currentStreak: 5,
        longestStreak: 10,
      };

      mockDBMethods.getUserProgress.mockResolvedValue(existingProgress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.userProgress?.totalXP).toBe(500);
      expect(result.current.userProgress?.currentLevel).toBe(3);
      expect(result.current.userProgress?.currentStreak).toBe(5);
    });

    it('should initialize achievements if none exist', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue([]);
      mockDBMethods.saveAchievements.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(mockDBMethods.saveAchievements).toHaveBeenCalled();
      expect(result.current.achievements.length).toBeGreaterThan(0);
    });
  });

  describe('startReviewSession', () => {
    it('should create a new review session', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      expect(mockDBMethods.createSession).toHaveBeenCalled();
      expect(result.current.currentSession).not.toBeNull();
      expect(result.current.currentSession?.deckId).toBe('deck-1');
      expect(result.current.currentSession?.cardsReviewed).toBe(0);
    });
  });

  describe('recordReview', () => {
    it('should record a correct review and earn XP', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);
      mockDBMethods.updateSession.mockResolvedValue(undefined);
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Start a session first
      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      let xpEarned = 0;
      await act(async () => {
        xpEarned = await result.current.recordReview(true, 'good');
      });

      // XP = CARD_REVIEW (5) + CARD_CORRECT (10) = 15
      expect(xpEarned).toBeGreaterThanOrEqual(15);
      expect(result.current.currentSession?.cardsReviewed).toBe(1);
      expect(result.current.currentSession?.correctAnswers).toBe(1);
    });

    it('should record an incorrect review with less XP', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);
      mockDBMethods.updateSession.mockResolvedValue(undefined);
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      let xpEarned = 0;
      await act(async () => {
        xpEarned = await result.current.recordReview(false, 'again');
      });

      // XP = CARD_REVIEW (5) only for incorrect
      expect(xpEarned).toBe(5);
      expect(result.current.currentSession?.cardsReviewed).toBe(1);
      expect(result.current.currentSession?.correctAnswers).toBe(0);
    });

    it('should give bonus XP for easy rating', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);
      mockDBMethods.updateSession.mockResolvedValue(undefined);
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      let xpEarned = 0;
      await act(async () => {
        xpEarned = await result.current.recordReview(true, 'easy');
      });

      // XP = CARD_REVIEW (5) + CARD_PERFECT (15) = 20
      expect(xpEarned).toBeGreaterThanOrEqual(20);
    });

    it('should return 0 XP if no session is active', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      let xpEarned = 0;
      await act(async () => {
        xpEarned = await result.current.recordReview(true, 'good');
      });

      expect(xpEarned).toBe(0);
    });
  });

  describe('endReviewSession', () => {
    it('should end the current session', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);
      mockDBMethods.updateSession.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      expect(result.current.currentSession).not.toBeNull();

      await act(async () => {
        await result.current.endReviewSession();
      });

      expect(result.current.currentSession).toBeNull();
      expect(mockDBMethods.updateSession).toHaveBeenCalled();
    });
  });

  describe('addConversationXP', () => {
    it('should add XP for conversation minutes', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.addConversationXP(5);
      });

      // 5 minutes * 20 XP = 100 XP
      expect(mockDBMethods.saveUserProgress).toHaveBeenCalled();
    });
  });

  describe('addNewWordXP', () => {
    it('should add XP for new word', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.addNewWordXP();
      });

      // 15 XP for new word
      expect(mockDBMethods.saveUserProgress).toHaveBeenCalled();
    });
  });

  describe('getLevelName', () => {
    it('should return correct level names', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.getLevelName(1)).toBe('Beginner');
      expect(result.current.getLevelName(5)).toBe('Apprentice');
      expect(result.current.getLevelName(10)).toBe('Grandmaster');
      expect(result.current.getLevelName(20)).toBe('Omniscient');
    });
  });

  describe('getXPProgress', () => {
    it('should return progress for level 1', async () => {
      mockDBMethods.getUserProgress.mockResolvedValue(createDefaultUserProgress());
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const progress = result.current.getXPProgress();

      expect(progress.current).toBe(0);
      expect(progress.needed).toBe(100); // Level 1 to Level 2
      expect(progress.percentage).toBe(0);
    });

    it('should calculate progress correctly for higher levels', async () => {
      const progress: UserProgress = {
        ...createDefaultUserProgress(),
        totalXP: 300, // Level 3 (250 threshold), 250 XP into level
        currentLevel: 3,
        xpToNextLevel: 250, // 500 - 250 = 250 to next level
      };

      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const xpProgress = result.current.getXPProgress();

      // 300 total XP, level 3 threshold is 250
      // Current in level: 300 - 250 = 50
      // Next level (4) threshold: 500, so needed: 500 - 250 = 250
      expect(xpProgress.current).toBe(50);
      expect(xpProgress.needed).toBe(250);
    });
  });

  describe('streak tracking', () => {
    it('should start streak on first review', async () => {
      const progress = createDefaultUserProgress();
      mockDBMethods.getUserProgress.mockResolvedValue(progress);
      mockDBMethods.getAllLanguageProgress.mockResolvedValue([]);
      mockDBMethods.getAchievements.mockResolvedValue(createDefaultAchievements());
      mockDBMethods.createSession.mockResolvedValue(undefined);
      mockDBMethods.updateSession.mockResolvedValue(undefined);
      mockDBMethods.saveUserProgress.mockResolvedValue(undefined);

      const { result } = renderHook(() => useGamification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      await act(async () => {
        await result.current.startReviewSession('deck-1');
      });

      await act(async () => {
        await result.current.recordReview(true, 'good');
      });

      // Streak should be updated
      expect(mockDBMethods.saveUserProgress).toHaveBeenCalled();
    });
  });
});