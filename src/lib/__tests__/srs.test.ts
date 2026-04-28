// Vitest globals are available - no explicit imports needed
import { calculateNextReview, getDueCards, initializeNewCard } from '../srs';

describe('SRS Algorithm', () => {
  describe('initializeNewCard', () => {
    it('should create a new card with default values', () => {
      const card = initializeNewCard();
      
      expect(card.ease).toBe(2.5);
      expect(card.interval).toBe(0);
      expect(card.reviewCount).toBe(0);
      expect(card.lapseCount).toBe(0);
      expect(card.dueDate).toBeInstanceOf(Date);
    });

    it('should set due date to current time', () => {
      const before = new Date();
      const card = initializeNewCard();
      const after = new Date();
      
      expect(card.dueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(card.dueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('calculateNextReview', () => {
    it('should handle again rating', () => {
      const card = {
        ease: 2.5,
        interval: 5,
        dueDate: new Date(),
        reviewCount: 3,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'again');
      
      expect(result.interval).toBe(1);
      expect(result.ease).toBe(2.3);
      expect(result.lapseCount).toBe(1);
      expect(result.reviewCount).toBe(4);
    });

    it('should handle hard rating', () => {
      const card = {
        ease: 2.5,
        interval: 5,
        dueDate: new Date(),
        reviewCount: 3,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'hard');
      
      expect(result.interval).toBe(6);
      expect(result.ease).toBe(2.35);
      expect(result.lapseCount).toBe(0);
      expect(result.reviewCount).toBe(4);
    });

    it('should handle good rating for new card', () => {
      const card = {
        ease: 2.5,
        interval: 0,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'good');
      
      expect(result.interval).toBe(1);
      expect(result.ease).toBe(2.5);
      expect(result.reviewCount).toBe(1);
    });

    it('should handle good rating for reviewed card', () => {
      const card = {
        ease: 2.5,
        interval: 3,
        dueDate: new Date(),
        reviewCount: 2,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'good');
      
      expect(result.interval).toBe(7);
      expect(result.ease).toBe(2.5);
      expect(result.reviewCount).toBe(3);
    });

    it('should handle easy rating for new card', () => {
      const card = {
        ease: 2.5,
        interval: 0,
        dueDate: new Date(),
        reviewCount: 0,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'easy');
      
      expect(result.interval).toBe(4);
      expect(result.ease).toBe(2.65);
      expect(result.reviewCount).toBe(1);
    });

    it('should handle easy rating for reviewed card', () => {
      const card = {
        ease: 2.5,
        interval: 3,
        dueDate: new Date(),
        reviewCount: 2,
        lapseCount: 0,
      };
      
      const result = calculateNextReview(card, 'easy');
      
      expect(result.interval).toBe(18);
      expect(result.ease).toBe(2.65);
      expect(result.reviewCount).toBe(3);
    });

    it('should not go below minimum ease', () => {
      const card = {
        ease: 1.4,
        interval: 5,
        dueDate: new Date(),
        reviewCount: 3,
        lapseCount: 2,
      };
      
      const result = calculateNextReview(card, 'again');
      
      expect(result.ease).toBe(1.3);
    });
  });

  describe('getDueCards', () => {
    it('should return cards due today or earlier', () => {
      vi.useFakeTimers();
      const today = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const pastCard = {
        ease: 2.5,
        interval: 1,
        dueDate: new Date('2024-01-10T00:00:00Z'),
        reviewCount: 1,
        lapseCount: 0,
      };

      const todayCard = {
        ease: 2.5,
        interval: 1,
        dueDate: new Date('2024-01-15T00:00:00Z'),
        reviewCount: 1,
        lapseCount: 0,
      };

      const futureCard = {
        ease: 2.5,
        interval: 1,
        dueDate: new Date('2024-01-20T00:00:00Z'),
        reviewCount: 1,
        lapseCount: 0,
      };

      const cards = [pastCard, todayCard, futureCard];
      const result = getDueCards(cards);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(pastCard);
      expect(result).toContainEqual(todayCard);
      expect(result).not.toContainEqual(futureCard);

      vi.useRealTimers();
    });

    it('should return empty array when no cards are due', () => {
      vi.useFakeTimers();
      const today = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(today);

      const futureCard = {
        ease: 2.5,
        interval: 1,
        dueDate: new Date('2024-01-20T00:00:00Z'),
        reviewCount: 1,
        lapseCount: 0,
      };

      const result = getDueCards([futureCard]);
      expect(result).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should handle empty array', () => {
      const result = getDueCards([]);
      expect(result).toHaveLength(0);
    });
  });
});