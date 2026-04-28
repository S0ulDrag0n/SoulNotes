'use client';

import { useState } from 'react';
import { useVocabulary } from '@/hooks/useVocabulary';
import { LanguageDeckSelector } from '@/components/LanguageDeckSelector';
import { FlashcardReview } from '@/components/FlashcardReview';
import { VocabularyPanel } from '@/components/VocabularyPanel';
import { StreakDisplay } from '@/components/StreakDisplay';
import { XPDisplay } from '@/components/XPDisplay';
import { AchievementsDisplay } from '@/components/AchievementsDisplay';

export default function FlashcardsPage() {
  const {
    decks, 
    currentDeck, 
    items, 
    isLoading, 
    error, 
    setCurrentDeck, 
    createDeck, 
    addItem,
    deleteItem,
  } = useVocabulary();
  
  const [activeView, setActiveView] = useState<'review' | 'manage'>('review');

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
              Flashcards
            </h1>
            <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
              Review vocabulary with spaced repetition
            </p>
          </div>
        </div>

        {/* Gamification Stats Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
          <StreakDisplay />
          <div className="h-8 w-px bg-[#d7c7a7] dark:bg-[#3b2f1d]" />
          <XPDisplay />
          <div className="h-8 w-px bg-[#d7c7a7] dark:bg-[#3b2f1d]" />
          <AchievementsDisplay />
        </div>

        <div className="mb-6 flex items-center justify-end gap-4">
          <LanguageDeckSelector
            decks={decks}
            currentDeck={currentDeck}
            onSelect={setCurrentDeck}
            onCreate={createDeck}
          />
          
          <div className="flex rounded-lg border border-[#d7c7a7] bg-white/70 p-1 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
            <button
              onClick={() => setActiveView('review')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === 'review'
                  ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                  : 'text-[#5c4d39] dark:text-[#d6c5ad]'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setActiveView('manage')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeView === 'manage'
                  ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                  : 'text-[#5c4d39] dark:text-[#d6c5ad]'
              }`}
            >
              Manage
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
          </div>
        ) : activeView === 'review' ? (
          <FlashcardReview deck={currentDeck} items={items} />
        ) : (
          <VocabularyPanel
            deck={currentDeck}
            items={items}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
          />
        )}
      </main>
    </div>
  );
}