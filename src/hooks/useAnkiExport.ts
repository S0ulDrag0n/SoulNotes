// src/hooks/useAnkiExport.ts

import { useState, useCallback } from 'react';
import { getAnkiExporter } from '@/lib/anki-export';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

interface UseAnkiExportReturn {
  isExporting: boolean;
  progress: number;
  error: string | null;
  exportDeck: (deck: LanguageDeck, includeAudio: boolean) => Promise<void>;
}

export function useAnkiExport(): UseAnkiExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportDeck = useCallback(async (deck: LanguageDeck, includeAudio: boolean = true) => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      const db = await getVocabularyDB();
      const items = await db.getItems(deck.id);
      setProgress(20);

      // Get all flashcards for items
      const allCards: Flashcard[] = [];
      for (const item of items) {
        const cards = await db.getFlashcards(item.id);
        allCards.push(...cards);
      }
      setProgress(40);

      // Export to Anki
      const exporter = await getAnkiExporter();
      const blob = await exporter.exportDeck(deck, items, allCards, includeAudio);
      setProgress(80);

      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.apkg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setProgress(100);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, progress, error, exportDeck };
}