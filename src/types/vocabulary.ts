// Vocabulary Types for SoulNotes

export interface LanguageDeck {
  id: string;
  language: string;
  name: string;
  createdAt: Date;
  lastReviewedAt?: Date;
  stats: DeckStats;
}

export interface DeckStats {
  totalWords: number;
  wordsLearned: number;
  dueToday: number;
}

export interface VocabularyItem {
  id: string;
  deckId: string;
  word: string;
  language: string;
  translation: string;
  definition?: string;
  context: string;
  source: 'transcript' | 'translation' | 'conversation' | 'manual';
  createdAt: Date;
  audioUrl?: string;
  tags: string[];
}

export interface Flashcard {
  id: string;
  vocabularyId: string;
  type: CardType;
  front: string;
  back: string;
  // SRS fields
  ease: number;
  interval: number;
  dueDate: Date;
  reviewCount: number;
  lapseCount: number;
}

export type CardType = 'basic' | 'reverse' | 'context' | 'audio';

export interface ReviewResult {
  cardId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  reviewedAt: Date;
}
