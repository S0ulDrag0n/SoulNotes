'use client';

import { useState, useEffect, useCallback } from 'react';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';
import { initializeNewCard } from '@/lib/srs';

interface UseVocabularyReturn {
  decks: LanguageDeck[];
  currentDeck: LanguageDeck | null;
  items: VocabularyItem[];
  isLoading: boolean;
  error: string | null;
  setCurrentDeck: (deck: LanguageDeck | null) => void;
  createDeck: (language: string, name: string) => Promise<LanguageDeck>;
  deleteDeck: (deckId: string) => Promise<void>;
  addItem: (word: string, translation: string, context: string, source: VocabularyItem['source']) => Promise<VocabularyItem | null>;
  updateItem: (item: VocabularyItem) => Promise<VocabularyItem>;
  deleteItem: (itemId: string) => Promise<void>;
  refreshDecks: () => Promise<void>;
  refreshItems: () => Promise<void>;
  recalculateDeckStats: (deckId?: string) => Promise<void>;
}

export function useVocabulary(): UseVocabularyReturn {
  const [decks, setDecks] = useState<LanguageDeck[]>([]);
  const [currentDeck, setCurrentDeck] = useState<LanguageDeck | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDecks = useCallback(async () => {
    try {
      const db = await getVocabularyDB();
      const allDecks = await db.getDecks();
      setDecks(allDecks);
      
      // Set current deck to first deck if not set
      if (!currentDeck && allDecks.length > 0) {
        setCurrentDeck(allDecks[0]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDeck]);

  const refreshItems = useCallback(async () => {
    if (!currentDeck) {
      setItems([]);
      return;
    }
    
    try {
      const db = await getVocabularyDB();
      const deckItems = await db.getItems(currentDeck.id);
      setItems(deckItems);
    } catch (err) {
      setError(String(err));
    }
  }, [currentDeck]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    
    async function loadInitialData() {
      try {
        const db = await getVocabularyDB();
        
        // Recalculate all deck stats to fix any inconsistencies
        await db.recalculateAllDeckStats();
        
        const allDecks = await db.getDecks();
        
        if (!mounted) return;
        
        setDecks(allDecks);
        
        if (allDecks.length > 0) {
          setCurrentDeck(allDecks[0]);
          const deckItems = await db.getItems(allDecks[0].id);
          if (mounted) {
            setItems(deckItems);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(String(err));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadInitialData();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Refresh items when deck changes
  useEffect(() => {
    let mounted = true;
    
    async function loadItems() {
      if (!currentDeck) {
        if (mounted) setItems([]);
        return;
      }
      
      try {
        const db = await getVocabularyDB();
        const deckItems = await db.getItems(currentDeck.id);
        if (mounted) {
          setItems(deckItems);
        }
      } catch (err) {
        if (mounted) {
          setError(String(err));
        }
      }
    }
    
    loadItems();
    
    return () => {
      mounted = false;
    };
  }, [currentDeck]);

  const createDeck = useCallback(async (language: string, name: string): Promise<LanguageDeck> => {
    const db = await getVocabularyDB();
    const deck: LanguageDeck = {
      id: crypto.randomUUID(),
      language,
      name,
      createdAt: new Date(),
      stats: {
        totalWords: 0,
        wordsLearned: 0,
        dueToday: 0,
      },
    };
    
    await db.createDeck(deck);
    await refreshDecks();
    return deck;
  }, [refreshDecks]);

  const deleteDeck = useCallback(async (deckId: string): Promise<void> => {
    const db = await getVocabularyDB();
    
    // Delete all items and flashcards for this deck
    const deckItems = await db.getItems(deckId);
    for (const item of deckItems) {
      await db.deleteFlashcardsForVocabulary(item.id);
      await db.deleteItem(item.id);
    }
    
    await db.deleteDeck(deckId);
    await refreshDecks();
    
    if (currentDeck?.id === deckId) {
      setCurrentDeck(decks.find(d => d.id !== deckId) || null);
    }
  }, [currentDeck, decks, refreshDecks]);

  const addItem = useCallback(async (
    word: string,
    translation: string,
    context: string,
    source: VocabularyItem['source']
  ): Promise<VocabularyItem | null> => {
    if (!currentDeck) {
      setError('No deck selected');
      return null;
    }

    const db = await getVocabularyDB();
    
    const item: VocabularyItem = {
      id: crypto.randomUUID(),
      deckId: currentDeck.id,
      word,
      language: currentDeck.language,
      translation,
      context,
      source,
      createdAt: new Date(),
      tags: [],
    };

    await db.addItem(item);

    // Create flashcards for the item
    const basicCard: Flashcard = {
      id: crypto.randomUUID(),
      vocabularyId: item.id,
      type: 'basic',
      front: word,
      back: translation,
      ...initializeNewCard(),
    };

    const reverseCard: Flashcard = {
      id: crypto.randomUUID(),
      vocabularyId: item.id,
      type: 'reverse',
      front: translation,
      back: word,
      ...initializeNewCard(),
    };

    // Add flashcards
    await db.addFlashcard(basicCard);
    await db.addFlashcard(reverseCard);

    // Update deck stats
    const updatedDeck: LanguageDeck = {
      ...currentDeck,
      stats: {
        ...currentDeck.stats,
        totalWords: currentDeck.stats.totalWords + 1,
      },
    };
    await db.updateDeck(updatedDeck);

    await refreshItems();
    await refreshDecks();
    return item;
  }, [currentDeck, refreshItems, refreshDecks]);

  const updateItem = useCallback(async (item: VocabularyItem): Promise<VocabularyItem> => {
    const db = await getVocabularyDB();
    await db.updateItem(item);
    await refreshItems();
    return item;
  }, [refreshItems]);

  const deleteItem = useCallback(async (itemId: string): Promise<void> => {
    if (!currentDeck) return;
    
    const db = await getVocabularyDB();
    
    // Delete associated flashcards
    await db.deleteFlashcardsForVocabulary(itemId);
    await db.deleteItem(itemId);
    
    // Update deck stats
    const updatedDeck: LanguageDeck = {
      ...currentDeck,
      stats: {
        ...currentDeck.stats,
        totalWords: Math.max(0, currentDeck.stats.totalWords - 1),
      },
    };
    await db.updateDeck(updatedDeck);
    
    await refreshItems();
    await refreshDecks();
  }, [currentDeck, refreshItems, refreshDecks]);

  const recalculateDeckStats = useCallback(async (deckId?: string): Promise<void> => {
    const db = await getVocabularyDB();
    
    if (deckId) {
      // Recalculate stats for a specific deck
      await db.recalculateDeckStats(deckId);
    } else {
      // Recalculate stats for all decks
      await db.recalculateAllDeckStats();
    }
    
    await refreshDecks();
  }, [refreshDecks]);

  return {
    decks,
    currentDeck,
    items,
    isLoading,
    error,
    setCurrentDeck,
    createDeck,
    deleteDeck,
    addItem,
    updateItem,
    deleteItem,
    refreshDecks,
    refreshItems,
    recalculateDeckStats,
  };
}