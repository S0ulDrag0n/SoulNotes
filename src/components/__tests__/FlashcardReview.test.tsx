// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlashcardReview } from '../FlashcardReview';
import type { VocabularyItem, Flashcard } from '@/types/vocabulary';

// Mock the vocabulary-db module
const mockDB = {
  getDueCardsForDeck: vi.fn(),
  updateFlashcard: vi.fn(),
};

vi.mock('@/lib/vocabulary-db', () => ({
  getVocabularyDB: () => Promise.resolve(mockDB),
}));

// Mock the gamification-db module
const mockGamificationDB = {
  getUserProgress: vi.fn(),
  saveUserProgress: vi.fn(),
  getAllLanguageProgress: vi.fn(),
  getAchievements: vi.fn(),
  saveAchievement: vi.fn(),
  saveAchievements: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn(),
};

vi.mock('@/lib/gamification-db', () => ({
  getGamificationDB: () => Promise.resolve(mockGamificationDB),
}));

// Mock the NotificationContext
vi.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifyXP: vi.fn(),
    notifyAchievement: vi.fn(),
    notifyLevelUp: vi.fn(),
    notifyStreak: vi.fn(),
  }),
}));

// Mock the GamificationProvider
vi.mock('@/providers/GamificationProvider', () => ({
  useGamificationInit: () => ({
    isInitialized: true,
    error: null,
  }),
}));

// Mock the SRS module
vi.mock('@/lib/srs', () => ({
  calculateNextReview: vi.fn((card, rating) => ({
    ...card,
    ease: rating === 'again' ? card.ease - 0.2 : rating === 'easy' ? card.ease + 0.15 : card.ease,
    interval: rating === 'again' ? 1 : rating === 'easy' ? 4 : 2,
    dueDate: new Date(),
    reviewCount: card.reviewCount + 1,
    lapseCount: rating === 'again' ? card.lapseCount + 1 : card.lapseCount,
  })),
}));

describe('FlashcardReview', () => {
  const mockDeck = {
    id: 'deck-1',
    name: 'Japanese Vocabulary',
  };

  const mockItems: VocabularyItem[] = [
    {
      id: 'item-1',
      deckId: 'deck-1',
      word: 'こんにちは',
      language: 'ja',
      translation: 'Hello',
      context: 'A greeting',
      source: 'manual',
      createdAt: new Date(),
      tags: [],
    },
    {
      id: 'item-2',
      deckId: 'deck-1',
      word: 'さようなら',
      language: 'ja',
      translation: 'Goodbye',
      context: '',
      source: 'manual',
      createdAt: new Date(),
      tags: [],
    },
  ];

  const mockDueCards: Flashcard[] = [
    {
      id: 'card-1',
      vocabularyId: 'item-1',
      type: 'basic',
      front: 'こんにちは',
      back: 'Hello',
      ease: 2.5,
      interval: 1,
      dueDate: new Date(),
      reviewCount: 0,
      lapseCount: 0,
    },
    {
      id: 'card-2',
      vocabularyId: 'item-1',
      type: 'reverse',
      front: 'Hello',
      back: 'こんにちは',
      ease: 2.5,
      interval: 1,
      dueDate: new Date(),
      reviewCount: 0,
      lapseCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB.getDueCardsForDeck.mockResolvedValue(mockDueCards);
    mockDB.updateFlashcard.mockResolvedValue(undefined);
    
    // Mock gamification database defaults
    mockGamificationDB.getUserProgress.mockResolvedValue(null);
    mockGamificationDB.getAllLanguageProgress.mockResolvedValue([]);
    mockGamificationDB.getAchievements.mockResolvedValue([]);
    mockGamificationDB.saveUserProgress.mockResolvedValue(undefined);
    mockGamificationDB.saveAchievement.mockResolvedValue(undefined);
    mockGamificationDB.saveAchievements.mockResolvedValue(undefined);
    mockGamificationDB.createSession.mockResolvedValue(undefined);
    mockGamificationDB.updateSession.mockResolvedValue(undefined);
  });

  describe('when no deck is selected', () => {
    it('should show "No Deck Selected" message', () => {
      render(
        <FlashcardReview
          deck={null}
          items={mockItems}
        />
      );

      expect(screen.getByText('No Deck Selected')).toBeDefined();
      expect(screen.getByText(/Select a vocabulary deck/)).toBeDefined();
    });

    it('should show book emoji', () => {
      render(
        <FlashcardReview
          deck={null}
          items={mockItems}
        />
      );

      expect(screen.getByText('📚')).toBeDefined();
    });
  });

  describe('when no cards are due', () => {
    it('should show "All Caught Up" message', async () => {
      mockDB.getDueCardsForDeck.mockResolvedValue([]);

      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('All Caught Up!')).toBeDefined();
      });

      expect(screen.getByText(/No cards due for review/)).toBeDefined();
    });

    it('should show celebration emoji', async () => {
      mockDB.getDueCardsForDeck.mockResolvedValue([]);

      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('🎉')).toBeDefined();
      });
    });
  });

  describe('when cards are due', () => {
    it('should show the first card', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });
    });

    it('should show card type label', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Word')).toBeDefined();
      });
    });

    it('should show progress indicator', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeDefined();
      });
    });

    it('should show context when available', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('A greeting')).toBeDefined();
      });
    });

    it('should show "Click to reveal answer" hint', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Click to reveal answer')).toBeDefined();
      });
    });
  });

  describe('flipping cards', () => {
    it('should show answer when card is clicked', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });

      // Click to flip
      fireEvent.click(screen.getByText('こんにちは'));

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined();
      });
    });

    it('should show rating buttons after flip', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });

      // Click to flip
      fireEvent.click(screen.getByText('こんにちは'));

      await waitFor(() => {
        expect(screen.getByText('Again')).toBeDefined();
        expect(screen.getByText('Hard')).toBeDefined();
        expect(screen.getByText('Good')).toBeDefined();
        expect(screen.getByText('Easy')).toBeDefined();
      });
    });
  });

  describe('rating cards', () => {
    it('should move to next card after rating', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });

      // Flip card
      fireEvent.click(screen.getByText('こんにちは'));

      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });

      // Rate as Good
      fireEvent.click(screen.getByText('Good'));

      // Should show next card
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined(); // Second card front
      });
    });

    it('should update progress indicator', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeDefined();
      });

      // Flip and rate first card
      fireEvent.click(screen.getByText('こんにちは'));
      
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(screen.getByText('2 / 2')).toBeDefined();
      });
    });

    it('should call updateFlashcard with correct data', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });

      // Flip and rate
      fireEvent.click(screen.getByText('こんにちは'));
      
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(mockDB.updateFlashcard).toHaveBeenCalled();
      });

      const updatedCard = mockDB.updateFlashcard.mock.calls[0][0];
      expect(updatedCard.reviewCount).toBe(1);
    });
  });

  describe('session summary', () => {
    it('should show summary after all cards are reviewed', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      // Review first card
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });
      fireEvent.click(screen.getByText('こんにちは'));
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Good'));

      // Review second card
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Hello'));
      await waitFor(() => {
        expect(screen.getByText('Again')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Again'));

      // Should show summary
      await waitFor(() => {
        expect(screen.getByText('Session Complete!')).toBeDefined();
      });
    });

    it('should show review count in summary', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      // Review all cards
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });
      fireEvent.click(screen.getByText('こんにちは'));
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Hello'));
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(screen.getByText('You reviewed 2 cards.')).toBeDefined();
      });
    });

    it('should restart session when "Continue" is clicked in summary', async () => {
      render(
        <FlashcardReview
          deck={mockDeck}
          items={mockItems}
        />
      );

      // Review all cards
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });
      fireEvent.click(screen.getByText('こんにちは'));
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Hello'));
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Good'));

      // Should show session complete (ReviewSummary when session data exists)
      await waitFor(() => {
        expect(screen.getByText('Session Complete!')).toBeDefined();
      });

      // Click "Start New Session" to restart (fallback summary shows this button,
      // ReviewSummary shows "Continue" when currentSession is available)
      fireEvent.click(screen.getByText('Start New Session'));

      // Should show first card again (or "All Caught Up" if no cards due)
      await waitFor(() => {
        expect(screen.getByText('こんにちは')).toBeDefined();
      });
    });
  });
});