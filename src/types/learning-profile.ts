// src/types/learning-profile.ts

export interface LearningProfile {
  id: string;
  language: string;
  
  // Weakness tracking
  grammarWeaknesses: GrammarWeakness[];
  vocabularyGaps: VocabularyGap[];
  pronunciationIssues: PronunciationIssue[];
  
  // Strengths
  confidenceAreas: string[];
  
  // Scores (0-100)
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  
  // History
  sessionsCompleted: number;
  totalPracticeMinutes: number;
  wordsLearned: number;
  wordsMastered: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastPracticeAt: Date | null;
}

export interface GrammarWeakness {
  pattern: string;           // e.g., "verb conjugation", "article usage"
  category: GrammarCategory;
  errorCount: number;
  correctCount: number;
  lastOccurred: Date;
  examples: string[];        // Recent mistakes
  improvement: number;       // -100 to 100 (negative = getting worse)
}

export type GrammarCategory = 
  | 'verb_tense'
  | 'verb_conjugation'
  | 'article_usage'
  | 'preposition'
  | 'word_order'
  | 'gender'
  | 'number'
  | 'case'
  | 'mood'
  | 'voice'
  | 'other';

export interface VocabularyGap {
  word: string;
  translation: string;
  context: string;           // Where it was encountered
  encounterCount: number;    // How many times seen but not known
  lastEncountered: Date;
  priority: 'high' | 'medium' | 'low';
  relatedWords: string[];    // Similar words to learn together
}

export interface PronunciationIssue {
  sound: string;             // IPA or description
  wordExamples: string[];
  issueCount: number;
  lastOccurred: Date;
  improvement: number;
}

export interface PracticeSession {
  id: string;
  profileId: string;
  type: PracticeType;
  startedAt: Date;
  endedAt: Date | null;
  focusAreas: string[];
  results: PracticeResult[];
  overallScore: number;
}

export type PracticeType = 
  | 'grammar_focus'
  | 'vocabulary_focus'
  | 'pronunciation_focus'
  | 'mixed'
  | 'conversation'
  | 'flashcard_review';

export interface PracticeResult {
  item: string;              // Word, grammar pattern, or sound
  type: 'grammar' | 'vocabulary' | 'pronunciation';
  correct: boolean;
  responseTime: number;      // milliseconds
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface WeeklyProgress {
  id: string;
  profileId: string;
  weekStart: Date;
  weekEnd: Date;
  totalMinutes: number;
  sessionsCompleted: number;
  wordsLearned: number;
  wordsReviewed: number;
  averageScore: number;
  streakDays: number;
  improvement: {
    grammar: number;         // percentage change
    vocabulary: number;
    pronunciation: number;
    fluency: number;
  };
}

export interface MeetingReport {
  id: string;
  language: string;
  date: Date;
  duration: number;          // minutes
  transcript: string;
  vocabulary: ExtractedVocabulary[];
  keyPhrases: KeyPhrase[];
  technicalTerms: TechnicalTerm[];
  summary: string;
}

export interface ExtractedVocabulary {
  word: string;
  translation: string;
  definition: string;
  context: string;
  frequency: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isKnown: boolean;
  isSaved: boolean;
}

export interface KeyPhrase {
  phrase: string;
  translation: string;
  context: string;
  usage: string;             // How/when to use
}

export interface TechnicalTerm {
  term: string;
  definition: string;
  context: string;
  field: string;             // e.g., "technology", "finance", "medicine"
}