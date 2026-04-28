'use client';

import { useState } from 'react';
import type { VocabularyItem } from '@/types/vocabulary';

interface VocabularyPanelProps {
  deck: { id: string; name: string; language: string } | null;
  items: VocabularyItem[];
  onAddItem: (word: string, translation: string, context: string, source: VocabularyItem['source']) => Promise<VocabularyItem | null>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

export function VocabularyPanel({
  deck,
  items,
  onAddItem,
  onDeleteItem,
}: VocabularyPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newContext, setNewContext] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newWord.trim() || !newTranslation.trim()) return;
    
    setIsAdding(true);
    try {
      const item = await onAddItem(
        newWord.trim(),
        newTranslation.trim(),
        newContext.trim(),
        'manual'
      );
      if (item) {
        setNewWord('');
        setNewTranslation('');
        setNewContext('');
        setShowAddForm(false);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      await onDeleteItem(itemId);
    } finally {
      setDeletingId(null);
    }
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
            Create a vocabulary deck to start adding words for review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
            {deck.name}
          </h2>
          <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
            {items.length} words • {deck.language}
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-[#1f1c16] px-3 py-1.5 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
        >
          + Add Word
        </button>
      </div>

      {/* Add Word Form */}
      {showAddForm && (
        <div className="rounded-lg border border-[#d7c7a7] bg-white/80 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
          <h3 className="mb-3 font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
            Add New Word
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
                Word *
              </label>
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Enter the word"
                className="mt-1 w-full rounded-md border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#1f1c16] placeholder:text-[#a08a68] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6] dark:placeholder:text-[#6b5a3f]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
                Translation *
              </label>
              <input
                type="text"
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                placeholder="Enter the translation"
                className="mt-1 w-full rounded-md border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#1f1c16] placeholder:text-[#a08a68] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6] dark:placeholder:text-[#6b5a3f]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
                Context (optional)
              </label>
              <input
                type="text"
                value={newContext}
                onChange={(e) => setNewContext(e.target.value)}
                placeholder="Example sentence or context"
                className="mt-1 w-full rounded-md border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#1f1c16] placeholder:text-[#a08a68] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6] dark:placeholder:text-[#6b5a3f]"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 rounded-md border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={isAdding || !newWord.trim() || !newTranslation.trim()}
                className="flex-1 rounded-md bg-[#1f1c16] px-4 py-2 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
              >
                {isAdding ? 'Adding...' : 'Add Word'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word List */}
      {items.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[#d7c7a7] dark:border-[#3b2f1d]">
          <div className="text-center">
            <p className="text-sm text-[#8b7a5a] dark:text-[#6b5a3f]">
              No words yet. Add your first word to start learning!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[#d7c7a7] bg-white/80 p-3 dark:border-[#3b2f1d] dark:bg-[#1b1711]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                    {item.word}
                  </span>
                  <span className="text-[#8b7a5a] dark:text-[#6b5a3f]">→</span>
                  <span className="text-[#5c4d39] dark:text-[#c8b7a0]">
                    {item.translation}
                  </span>
                </div>
                {item.context && (
                  <p className="mt-1 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                    {item.context}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="rounded p-1 text-[#a08a68] transition hover:bg-red-50 hover:text-red-600 dark:text-[#6b5a3f] dark:hover:bg-red-900/20 dark:hover:text-red-400"
                title="Delete word"
              >
                {deletingId === item.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}