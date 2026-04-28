'use client';

import { useState } from 'react';
import type { ExtractedVocabulary, KeyPhrase, TechnicalTerm } from '@/types/learning-profile';

interface MeetingReportProps {
  vocabulary: ExtractedVocabulary[];
  keyPhrases: KeyPhrase[];
  technicalTerms: TechnicalTerm[];
  summary: string;
  onSaveVocabulary?: (words: ExtractedVocabulary[]) => Promise<void>;
  onMarkKnown?: (word: string) => Promise<void>;
}

type TabType = 'vocabulary' | 'phrases' | 'terms';

export function MeetingReport({
  vocabulary,
  keyPhrases,
  technicalTerms,
  summary,
  onSaveVocabulary,
  onMarkKnown,
}: MeetingReportProps) {
  const [activeTab, setActiveTab] = useState<TabType>('vocabulary');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());

  const toggleWordSelection = (word: string) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) {
      newSelected.delete(word);
    } else {
      newSelected.add(word);
    }
    setSelectedWords(newSelected);
  };

  const handleSaveSelected = async () => {
    if (!onSaveVocabulary || selectedWords.size === 0) return;
    
    setIsSaving(true);
    try {
      const wordsToSave = vocabulary.filter(v => selectedWords.has(v.word));
      await onSaveVocabulary(wordsToSave);
      setSelectedWords(new Set());
    } catch (error) {
      console.error('Failed to save vocabulary:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkKnown = async (word: string) => {
    if (!onMarkKnown) return;
    
    try {
      await onMarkKnown(word);
      setKnownWords(prev => new Set([...prev, word]));
    } catch (error) {
      console.error('Failed to mark word as known:', error);
    }
  };

  const getDifficultyColor = (difficulty: ExtractedVocabulary['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'advanced':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      {/* Header */}
      <div className="border-b border-[#d7c7a7] p-4 dark:border-[#3b2f1d]">
        <h3 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Meeting Report
        </h3>
        {summary && (
          <p className="mt-2 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
            {summary}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-[#d7c7a7] dark:border-[#3b2f1d]">
        <div className="flex">
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'vocabulary'
                ? 'border-b-2 border-[#f3b34b] text-[#1f1c16] dark:text-[#f3e9d8]'
                : 'text-[#5c4d39] hover:text-[#1f1c16] dark:text-[#c8b7a0] dark:hover:text-[#f3e9d8]'
            }`}
          >
            Vocabulary ({vocabulary.length})
          </button>
          <button
            onClick={() => setActiveTab('phrases')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'phrases'
                ? 'border-b-2 border-[#f3b34b] text-[#1f1c16] dark:text-[#f3e9d8]'
                : 'text-[#5c4d39] hover:text-[#1f1c16] dark:text-[#c8b7a0] dark:hover:text-[#f3e9d8]'
            }`}
          >
            Key Phrases ({keyPhrases.length})
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'terms'
                ? 'border-b-2 border-[#f3b34b] text-[#1f1c16] dark:text-[#f3e9d8]'
                : 'text-[#5c4d39] hover:text-[#1f1c16] dark:text-[#c8b7a0] dark:hover:text-[#f3e9d8]'
            }`}
          >
            Technical Terms ({technicalTerms.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Vocabulary Tab */}
        {activeTab === 'vocabulary' && (
          <div className="space-y-4">
            {vocabulary.length === 0 ? (
              <p className="text-center text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                No vocabulary extracted from this meeting.
              </p>
            ) : (
              <>
                {/* Selection actions */}
                {selectedWords.size > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-[#efe0c3] p-2 dark:bg-[#2a2218]">
                    <span className="text-sm text-[#1f1c16] dark:text-[#f3e9d8]">
                      {selectedWords.size} selected
                    </span>
                    <button
                      onClick={handleSaveSelected}
                      disabled={isSaving}
                      className="rounded-lg bg-[#1f1c16] px-3 py-1 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
                    >
                      {isSaving ? 'Saving...' : 'Save to Deck'}
                    </button>
                  </div>
                )}

                {/* Vocabulary list */}
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {vocabulary.map((item, index) => (
                    <div
                      key={`${item.word}-${index}`}
                      className={`rounded-lg border p-3 transition ${
                        selectedWords.has(item.word)
                          ? 'border-[#f3b34b] bg-amber-50 dark:bg-amber-900/20'
                          : 'border-[#d7c7a7] bg-white/50 dark:border-[#3b2f1d] dark:bg-[#1b1711]/50'
                      } ${knownWords.has(item.word) ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedWords.has(item.word)}
                              onChange={() => toggleWordSelection(item.word)}
                              className="h-4 w-4 rounded border-[#d7c7a7]"
                            />
                            <span className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                              {item.word}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${getDifficultyColor(item.difficulty)}`}>
                              {item.difficulty}
                            </span>
                            {item.frequency > 1 && (
                              <span className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                                ×{item.frequency}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                            {item.translation}
                          </p>
                          {item.definition && (
                            <p className="mt-1 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                              {item.definition}
                            </p>
                          )}
                          {item.context && (
                            <p className="mt-1 text-xs italic text-[#8b7a5a] dark:text-[#6b5a3f]">
                              &ldquo;{item.context}&rdquo;
                            </p>
                          )}
                        </div>
                        {!knownWords.has(item.word) && onMarkKnown && (
                          <button
                            onClick={() => handleMarkKnown(item.word)}
                            className="text-xs text-[#f3b34b] hover:text-[#d9a040]"
                          >
                            Mark Known
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Key Phrases Tab */}
        {activeTab === 'phrases' && (
          <div className="space-y-4">
            {keyPhrases.length === 0 ? (
              <p className="text-center text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                No key phrases extracted from this meeting.
              </p>
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto">
                {keyPhrases.map((item, index) => (
                  <div
                    key={`${item.phrase}-${index}`}
                    className="rounded-lg border border-[#d7c7a7] bg-white/50 p-3 dark:border-[#3b2f1d] dark:bg-[#1b1711]/50"
                  >
                    <div className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                      {item.phrase}
                    </div>
                    <div className="mt-1 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                      {item.translation}
                    </div>
                    {item.usage && (
                      <div className="mt-2 rounded bg-[#efe0c3] p-2 text-xs text-[#5c4d39] dark:bg-[#2a2218] dark:text-[#c8b7a0]">
                        <strong>Usage:</strong> {item.usage}
                      </div>
                    )}
                    {item.context && (
                      <p className="mt-1 text-xs italic text-[#8b7a5a] dark:text-[#6b5a3f]">
                        &ldquo;{item.context}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Technical Terms Tab */}
        {activeTab === 'terms' && (
          <div className="space-y-4">
            {technicalTerms.length === 0 ? (
              <p className="text-center text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                No technical terms extracted from this meeting.
              </p>
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto">
                {technicalTerms.map((item, index) => (
                  <div
                    key={`${item.term}-${index}`}
                    className="rounded-lg border border-[#d7c7a7] bg-white/50 p-3 dark:border-[#3b2f1d] dark:bg-[#1b1711]/50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                          {item.term}
                        </span>
                        <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          {item.field}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                      {item.definition}
                    </p>
                    {item.context && (
                      <p className="mt-1 text-xs italic text-[#8b7a5a] dark:text-[#6b5a3f]">
                        &ldquo;{item.context}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}