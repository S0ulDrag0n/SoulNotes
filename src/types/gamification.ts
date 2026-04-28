// Gamification Types for SoulNotes

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

// Achievement definitions
export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
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