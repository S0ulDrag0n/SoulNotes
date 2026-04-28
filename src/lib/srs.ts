/**
 * SM-2 Spaced Repetition Algorithm
 * Based on Anki's implementation
 */

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const EASE_MODIFIER = 0.15;

// Interval modifiers
const AGAIN_INTERVAL = 1; // 1 day
const HARD_INTERVAL_MULTIPLIER = 1.2;
const EASY_INTERVAL_MULTIPLIER = 2.5;
const GRADUATING_INTERVAL = 1; // 1 day for new cards

export interface SRSCard {
  ease: number;
  interval: number;
  dueDate: Date;
  reviewCount: number;
  lapseCount: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Calculate next review date based on rating
 */
export function calculateNextReview(card: SRSCard, rating: Rating): SRSCard {
  const now = new Date();
  let newEase = card.ease;
  let newInterval = card.interval;
  let newLapseCount = card.lapseCount;

  switch (rating) {
    case 'again':
      // Reset interval, decrease ease, increment lapse
      newInterval = AGAIN_INTERVAL;
      newEase = Math.max(MIN_EASE, card.ease - 0.2);
      newLapseCount = card.lapseCount + 1;
      break;

    case 'hard':
      // Small interval increase, decrease ease
      newInterval = Math.max(1, Math.floor(card.interval * HARD_INTERVAL_MULTIPLIER));
      newEase = Math.max(MIN_EASE, card.ease - EASE_MODIFIER);
      break;

    case 'good':
      // Standard interval increase
      if (card.reviewCount === 0) {
        newInterval = GRADUATING_INTERVAL;
      } else if (card.interval === 0) {
        newInterval = 1;
      } else {
        newInterval = Math.floor(card.interval * card.ease);
      }
      break;

    case 'easy':
      // Large interval increase, increase ease
      if (card.reviewCount === 0) {
        newInterval = 4; // 4 days for easy on new card
      } else {
        newInterval = Math.floor(card.interval * card.ease * EASY_INTERVAL_MULTIPLIER);
      }
      newEase = card.ease + EASE_MODIFIER;
      break;
  }

  // Calculate next due date
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    ease: newEase,
    interval: newInterval,
    dueDate,
    reviewCount: card.reviewCount + 1,
    lapseCount: newLapseCount,
  };
}

/**
 * Get cards due for review today
 */
export function getDueCards(cards: SRSCard[]): SRSCard[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return cards.filter(card => new Date(card.dueDate) <= now);
}

/**
 * Initialize a new card for SRS
 */
export function initializeNewCard(): SRSCard {
  const now = new Date();
  return {
    ease: DEFAULT_EASE,
    interval: 0,
    dueDate: now,
    reviewCount: 0,
    lapseCount: 0,
  };
}