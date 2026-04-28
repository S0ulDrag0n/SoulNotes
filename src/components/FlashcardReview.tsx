'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Flashcard, VocabularyItem } from '@/types/vocabulary';
import { calculateNextReview, type Rating } from '@/lib/srs';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import { useGamification, type GamificationCallbacks } from '@/hooks/useGamification';
import { useNotifications } from '@/contexts/NotificationContext';
import { ReviewSummary } from './ReviewSummary';
import { LevelUpModal } from './LevelUpModal';
import { LEVEL_NAMES } from '@/types/gamification';

interface FlashcardReviewProps {
  deck: { id: string; name: string } | null;
  items: VocabularyItem[];
  language?: string; // Language code for learning profile tracking
}

interface CardWithItem extends Flashcard {
  item?: VocabularyItem;
}

export function FlashcardReview({ deck, items, language = 'en' }: FlashcardReviewProps) {
  const [cards, setCards] = useState<CardWithItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  const [showSummary, setShowSummary] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; levelName: string } | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Notifications
  const { notifyXP, notifyAchievement, notifyLevelUp, notifyStreak } = useNotifications();

  // Gamification callbacks
  const gamificationCallbacks: GamificationCallbacks = {
    onXPEarned: (amount, reason) => {
      notifyXP(amount, reason);
    },
    onAchievementUnlocked: (achievement) => {
      notifyAchievement(achievement.id, achievement.name, achievement.icon);
    },
    onLevelUp: (level, levelName) => {
      setLevelUpInfo({ level, levelName });
      notifyLevelUp(level, levelName);
    },
    onStreakUpdated: (streak) => {
      if (streak > 1 && streak % 5 === 0) {
        notifyStreak(streak);
      }
    },
  };

  // Gamification hook
  const {
    startReviewSession,
    recordReview,
    endReviewSession,
    currentSession,
    isLoading: gamificationLoading,
    checkAchievements,
  } = useGamification(gamificationCallbacks);

  const loadDueCards = useCallback(async () => {
    if (!deck) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    try {
      const db = await getVocabularyDB();
      const dueCards = await db.getDueCardsForDeck(deck.id);
      
      // Attach vocabulary items to cards
      const itemMap = new Map(items.map(item => [item.id, item]));
      const cardsWithItems = dueCards.map(card => ({
        ...card,
        item: itemMap.get(card.vocabularyId),
      }));

      setCards(cardsWithItems);
    } catch (error) {
      console.error('Failed to load due cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deck, items]);

  useEffect(() => {
    loadDueCards();
  }, [loadDueCards]);

  // Start gamification session when cards are loaded
  useEffect(() => {
    if (cards.length > 0 && deck && !currentSession && !gamificationLoading) {
      startReviewSession(deck.id);
      setSessionStartTime(new Date());
    }
  }, [cards, deck, currentSession, gamificationLoading, startReviewSession]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = async (rating: Rating) => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    try {
      const db = await getVocabularyDB();
      const srsResult = calculateNextReview(currentCard, rating);
      const updatedCard: Flashcard = {
        ...currentCard,
        ease: srsResult.ease,
        interval: srsResult.interval,
        dueDate: srsResult.dueDate,
        reviewCount: srsResult.reviewCount,
        lapseCount: srsResult.lapseCount,
      };
      await db.updateFlashcard(updatedCard);

      // Record review for gamification
      const correct = rating !== 'again';
      await recordReview(correct, rating);

      // Update learning profile - track vocabulary progress
      try {
        const profileService = await getLearningProfileService();
        
        if (correct && currentCard.item) {
          // If the word was answered correctly multiple times, mark as learned
          // A word is considered "learned" after 3+ successful reviews
          if (updatedCard.reviewCount >= 3 && updatedCard.lapseCount === 0) {
            await profileService.markVocabularyLearned(language, currentCard.front);
          }
          // For very mature cards (10+ reviews, low lapse rate), mark as mastered
          if (updatedCard.reviewCount >= 10 && updatedCard.lapseCount / updatedCard.reviewCount < 0.1) {
            await profileService.markVocabularyMastered(language, currentCard.front);
          }
        } else if (!correct && currentCard.item) {
          // Record vocabulary gap for words the user is struggling with
          await profileService.recordVocabularyGap(
            language,
            currentCard.front,
            currentCard.back,
            currentCard.item.context || ''
          );
        }
      } catch (profileError) {
        // Don't fail the whole operation if profile update fails
        console.error('Failed to update learning profile:', profileError);
      }

      setSessionStats(prev => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        [rating]: prev[rating] + 1,
      }));

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        // End session and check achievements
        await endReviewSession();
        await checkAchievements();
        
        // Record practice session in learning profile
        if (sessionStartTime) {
          try {
            const profileService = await getLearningProfileService();
            
            // Create a practice session and record results
            const session = await profileService.createPracticeSession(
              language,
              'flashcard_review',
              [] // focus areas
            );
            
            // Build results from session stats
            const results = cards.map(card => ({
              item: card.front,
              type: 'vocabulary' as const,
              correct: true, // Cards that made it through are considered correct
              responseTime: 0,
              difficulty: 'medium' as const,
            }));
            
            await profileService.endPracticeSession(session.id, results);
          } catch (profileError) {
            console.error('Failed to record practice session:', profileError);
          }
        }
        
        setSessionEnded(true);
        setShowSummary(true);
      }
    } catch (error) {
      console.error('Failed to update card:', error);
    }
  };

  const handleRestart = async () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
    setShowSummary(false);
    setSessionEnded(false);
    await loadDueCards();
  };

  if (!deck) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <div className="text-center">
          <div className="mb-4 text-6xl">📚</div>
          <h2 className="mb-2 text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
            No Deck Selected
          </h2>
          <p className="max-w-md text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
            Select a vocabulary deck to start reviewing flashcards.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎉</div>
          <h2 className="mb-2 text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
            All Caught Up!
          </h2>
          <p className="max-w-md text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
            No cards due for review. Check back later or add more words to your deck.
          </p>
        </div>
      </div>
    );
  }

  // Show ReviewSummary modal when session ends
  if (showSummary && currentSession) {
    return (
      <ReviewSummary
        session={currentSession}
        onClose={handleRestart}
      />
    );
  }

  // Fallback summary if session data isn't available
  if (showSummary) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
        <div className="text-center">
          <div className="mb-4 text-6xl">✨</div>
          <h2 className="mb-2 text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
            Session Complete!
          </h2>
          <p className="mb-6 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
            You reviewed {sessionStats.reviewed} cards.
          </p>
          
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{sessionStats.again}</div>
              <div className="text-xs text-red-600 dark:text-red-400">Again</div>
            </div>
            <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{sessionStats.hard}</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">Hard</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{sessionStats.good}</div>
              <div className="text-xs text-green-600 dark:text-green-400">Good</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionStats.easy}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Easy</div>
            </div>
          </div>
          
          <button
            onClick={handleRestart}
            className="rounded-lg bg-[#1f1c16] px-6 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
            <div
              className="h-full rounded-full bg-[#1f1c16] transition-all dark:bg-[#f6e9cc]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="relative min-h-[300px] cursor-pointer rounded-2xl border border-black/10 bg-white/80 p-8 shadow-lg transition-all hover:shadow-xl dark:border-white/10 dark:bg-[#15120d]/85"
        style={{ perspective: '1000px' }}
      >
        <div
          className={`transition-transform duration-300 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center p-8 [backface-visibility:hidden]`}
          >
            <div className="text-center">
              <div className="mb-2 text-xs uppercase tracking-wide text-[#8b7a5a] dark:text-[#6b5a3f]">
                {currentCard.type === 'basic' ? 'Word' : 'Translation'}
              </div>
              <div className="text-3xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
                {currentCard.front}
              </div>
              {currentCard.item?.context && (
                <p className="mt-4 max-w-md text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                  {currentCard.item.context}
                </p>
              )}
            </div>
            <div className="mt-8 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
              Click to reveal answer
            </div>
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]`}
          >
            <div className="text-center">
              <div className="mb-2 text-xs uppercase tracking-wide text-[#8b7a5a] dark:text-[#6b5a3f]">
                {currentCard.type === 'basic' ? 'Translation' : 'Word'}
              </div>
              <div className="text-3xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
                {currentCard.back}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {isFlipped && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handleRate('again')}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Again
          </button>
          <button
            onClick={() => handleRate('hard')}
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
          >
            Hard
          </button>
          <button
            onClick={() => handleRate('good')}
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            Good
          </button>
          <button
            onClick={() => handleRate('easy')}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            Easy
          </button>
        </div>
      )}

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={levelUpInfo !== null}
        onClose={() => setLevelUpInfo(null)}
        level={levelUpInfo?.level ?? 1}
        levelName={levelUpInfo?.levelName ?? ''}
      />
    </div>
  );
}