// SelectableText - Reusable wrapper component for text selection with toolbar support

'use client';

import { useState, useCallback } from 'react';
import { useTextSelection } from '@/hooks/useTextSelection';
import { TextSelectionToolbar } from '@/components/TextSelectionToolbar';

export interface SelectableTextProps {
  readonly children: React.ReactNode;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly source: 'transcript' | 'translation' | 'conversation';
  readonly onAddToFlashcards?: () => void;
  readonly className?: string;
}

export function SelectableText({
  children,
  sourceLanguage,
  targetLanguage,
  source,
  onAddToFlashcards,
  className,
}: SelectableTextProps) {
  const { selection, selectionRef, clearSelection } = useTextSelection();

  const handleDismiss = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleAddToFlashcards = useCallback(() => {
    onAddToFlashcards?.();
    clearSelection();
  }, [onAddToFlashcards, clearSelection]);

  return (
    <div ref={selectionRef} className={className}>
      {children}
      {selection && (
        <TextSelectionToolbar
          selectedText={selection.selectedText}
          context={selection.context}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          position={selection.position}
          source={source}
          onAddToFlashcards={handleAddToFlashcards}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}