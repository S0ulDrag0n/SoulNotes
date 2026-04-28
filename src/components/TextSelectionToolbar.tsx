// TextSelectionToolbar - Floating popup for text selection with translation and flashcard addition

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVocabularySelection } from '@/hooks/useVocabularySelection';
import type { LanguageDeck } from '@/types/vocabulary';

export interface TextSelectionToolbarProps {
  readonly selectedText: string;
  readonly context: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly position: { x: number; y: number };
  readonly source: 'transcript' | 'translation' | 'conversation';
  readonly onAddToFlashcards?: () => void;
  readonly onDismiss: () => void;
}

export function TextSelectionToolbar({
  selectedText,
  context,
  sourceLanguage,
  targetLanguage,
  position,
  source,
  onAddToFlashcards,
  onDismiss,
}: TextSelectionToolbarProps) {
  const {
    translation,
    isTranslating,
    decks,
    currentDeck,
    setCurrentDeck,
    translateText,
    addToFlashcards,
    error,
    clearError,
  } = useVocabularySelection({ sourceLanguage, targetLanguage });

  const [editedTranslation, setEditedTranslation] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Use edited translation if user has modified it, otherwise use the translation from API
  const displayTranslation = editedTranslation ?? translation;

  // Translate on mount
  useEffect(() => {
    translateText(selectedText, context);
  }, [selectedText, context, translateText]);

  // Handle click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDismiss]);

  // Handle escape key to dismiss
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  const handleAddToFlashcards = useCallback(async () => {
    if (!currentDeck) {
      setShowDeckSelector(true);
      return;
    }

    setIsAdding(true);
    clearError();

    try {
      const success = await addToFlashcards(
        selectedText,
        displayTranslation,
        context,
        source
      );

      if (success) {
        onAddToFlashcards?.();
        onDismiss();
      }
    } catch (error) {
      console.error('Failed to add to flashcards:', error);
    } finally {
      setIsAdding(false);
    }
  }, [currentDeck, selectedText, displayTranslation, context, source, addToFlashcards, clearError, onAddToFlashcards, onDismiss]);

  const handleDeckSelect = useCallback((deck: LanguageDeck) => {
    setCurrentDeck(deck);
    setShowDeckSelector(false);
  }, [setCurrentDeck]);

  // Calculate position to keep toolbar in viewport
  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.max(position.y - 10, 10),
    transform: 'translate(-50%, -100%)',
    zIndex: 50, // Reasonable z-index since portal escapes stacking contexts
  };

  // Render toolbar in a portal to escape stacking contexts
  return createPortal(
    <div
      ref={toolbarRef}
      style={toolbarStyle}
      className="w-80 rounded-xl border-2 border-[#c9a66b] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.2)] dark:border-[#8b6914] dark:bg-[#1a1612]"
      role="dialog"
      aria-label="Text selection toolbar"
    >
      {/* Selected Text */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-[#8b7a5a] dark:text-[#6b5a3f]">
          Selected Text
        </label>
        <p className="rounded-lg bg-[#efe0c3]/50 px-3 py-2 text-sm text-[#1f1c16] dark:bg-[#2a2218]/50 dark:text-[#f3e9d8]">
          {selectedText}
        </p>
      </div>

      {/* Translation */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-[#8b7a5a] dark:text-[#6b5a3f]">
          Translation
        </label>
        {isTranslating ? (
          <div className="flex items-center gap-2 rounded-lg bg-[#efe0c3]/50 px-3 py-2 text-sm text-[#8b7a5a] dark:bg-[#2a2218]/50 dark:text-[#6b5a3f]">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Translating...
          </div>
        ) : (
          <input
            type="text"
            value={displayTranslation}
            onChange={(e) => setEditedTranslation(e.target.value)}
            className="w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#1f1c16] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
            placeholder="Enter translation"
          />
        )}
      </div>

      {/* Deck Selector (shown when needed) */}
      {showDeckSelector && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-[#8b7a5a] dark:text-[#6b5a3f]">
            Select Deck
          </label>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-[#d7c7a7] bg-white dark:border-[#3b2f1d] dark:bg-[#1b1711]">
            {decks.length === 0 ? (
              <p className="p-2 text-sm text-[#8b7a5a] dark:text-[#6b5a3f]">
                No decks available. Create one first.
              </p>
            ) : (
              decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => handleDeckSelect(deck)}
                  className="w-full px-3 py-2 text-left text-sm text-[#1f1c16] transition hover:bg-[#efe0c3] dark:text-[#f3e9d8] dark:hover:bg-[#2a2218]"
                >
                  {deck.name} ({deck.language})
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Current Deck Info - clickable to change */}
      {currentDeck && !showDeckSelector && (
        <button
          type="button"
          onClick={() => setShowDeckSelector(true)}
          className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#d7c7a7] bg-[#efe0c3]/30 px-3 py-2 text-left text-xs text-[#8b7a5a] transition hover:bg-[#efe0c3]/50 dark:border-[#3b2f1d] dark:bg-[#2a2218]/30 dark:text-[#6b5a3f] dark:hover:bg-[#2a2218]/50"
        >
          <span>Adding to:</span>
          <span className="font-medium text-[#5c4d39] dark:text-[#c8b7a0]">{currentDeck.name} ({currentDeck.language})</span>
          <span className="text-[#8b7a5a] dark:text-[#6b5a3f]">▼</span>
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 rounded-lg border border-[#d7c7a7] px-3 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
        >
          Cancel
        </button>
        <button
          onClick={handleAddToFlashcards}
          disabled={isTranslating || isAdding || !displayTranslation.trim()}
          className="flex-1 rounded-lg bg-[#1f1c16] px-3 py-2 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
        >
          {isAdding ? 'Adding...' : 'Add to Flashcards'}
        </button>
      </div>
    </div>,
    document.body
  );
}