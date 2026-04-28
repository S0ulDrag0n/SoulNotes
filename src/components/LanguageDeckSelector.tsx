'use client';

import { useState } from 'react';
import type { LanguageDeck } from '@/types/vocabulary';

interface LanguageDeckSelectorProps {
  decks: LanguageDeck[];
  currentDeck: LanguageDeck | null;
  onSelect: (deck: LanguageDeck) => void;
  onCreate: (language: string, name: string) => Promise<LanguageDeck>;
}

const COMMON_LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
];

export function LanguageDeckSelector({
  decks,
  currentDeck,
  onSelect,
  onCreate,
}: LanguageDeckSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLanguage, setNewLanguage] = useState('es');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    setIsCreating(true);
    try {
      const deck = await onCreate(newLanguage, newName.trim());
      onSelect(deck);
      setShowCreateForm(false);
      setNewName('');
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-[#d7c7a7] bg-white/70 px-3 py-1.5 text-sm font-medium text-[#1f1c16] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6] dark:hover:bg-[#2a2218]"
      >
        <span>📚</span>
        <span>{currentDeck?.name || 'Select Deck'}</span>
        <span className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
          ({currentDeck?.stats?.totalWords || 0} words)
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-[#d7c7a7] bg-white p-2 shadow-lg dark:border-[#3b2f1d] dark:bg-[#1b1711]">
          {!showCreateForm ? (
            <>
              <div className="max-h-48 overflow-y-auto">
                {decks.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[#8b7a5a] dark:text-[#6b5a3f]">
                    No decks yet. Create one to get started.
                  </p>
                ) : (
                  decks.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => {
                        onSelect(deck);
                        setIsOpen(false);
                      }}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        currentDeck?.id === deck.id
                          ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                          : 'text-[#1f1c16] hover:bg-[#efe0c3] dark:text-[#f6f1e6] dark:hover:bg-[#2a2218]'
                      }`}
                    >
                      <div className="font-medium">{deck.name}</div>
                      <div className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                        {deck.language}
                      </div>
                    </button>
                  ))
                )}
              </div>
              
              <div className="mt-2 border-t border-[#d7c7a7] pt-2 dark:border-[#3b2f1d]">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#1f1c16] transition hover:bg-[#efe0c3] dark:text-[#f6f1e6] dark:hover:bg-[#2a2218]"
                >
                  + New Deck
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
                  Language
                </label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#d7c7a7] bg-white px-2 py-1.5 text-sm text-[#1f1c16] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                >
                  {COMMON_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
                  Deck Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Spanish Basics"
                  className="mt-1 w-full rounded-md border border-[#d7c7a7] bg-white px-2 py-1.5 text-sm text-[#1f1c16] placeholder:text-[#a08a68] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6] dark:placeholder:text-[#6b5a3f]"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded-md border border-[#d7c7a7] px-3 py-1.5 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                  className="flex-1 rounded-md bg-[#1f1c16] px-3 py-1.5 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}