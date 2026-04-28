'use client';

import { useState, useEffect } from 'react';
import { useAdaptivePractice } from '@/hooks/useAdaptivePractice';
import type { GrammarWeakness, VocabularyGap, PronunciationIssue } from '@/types/learning-profile';

interface PracticeRecommendationsProps {
  language: string;
}

export function PracticeRecommendations({ language }: PracticeRecommendationsProps) {
  const { recommendations, getRecommendations, isLoading, error, clearError } = useAdaptivePractice();
  const [activeTab, setActiveTab] = useState<'grammar' | 'vocabulary' | 'pronunciation'>('grammar');

  useEffect(() => {
    getRecommendations(language);
  }, [language, getRecommendations]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Practice Recommendations
        </h3>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        <button
          onClick={() => {
            clearError();
            getRecommendations(language);
          }}
          className="rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <div className="flex min-h-[100px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
        </div>
      </div>
    );
  }

  if (!recommendations || (
    recommendations.grammar.length === 0 &&
    recommendations.vocabulary.length === 0 &&
    recommendations.pronunciation.length === 0
  )) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Practice Recommendations
        </h3>
        <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          Complete more practice sessions to get personalized recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
        Practice Recommendations
      </h3>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-[#efe0c3] p-1 dark:bg-[#2a2218]">
        <button
          onClick={() => setActiveTab('grammar')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'grammar'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Grammar ({recommendations.grammar.length})
        </button>
        <button
          onClick={() => setActiveTab('vocabulary')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'vocabulary'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Vocabulary ({recommendations.vocabulary.length})
        </button>
        <button
          onClick={() => setActiveTab('pronunciation')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'pronunciation'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Pronunciation ({recommendations.pronunciation.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {activeTab === 'grammar' && recommendations.grammar.map((item) => (
          <GrammarRecommendation key={item.pattern} item={item} />
        ))}
        {activeTab === 'vocabulary' && recommendations.vocabulary.map((item) => (
          <VocabularyRecommendation key={item.word} item={item} />
        ))}
        {activeTab === 'pronunciation' && recommendations.pronunciation.map((item) => (
          <PronunciationRecommendation key={item.sound} item={item} />
        ))}
      </div>

      {/* Start Practice Button */}
      <button className="mt-4 w-full rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]">
        Start Focused Practice
      </button>
    </div>
  );
}

function GrammarRecommendation({ item }: { item: GrammarWeakness }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">{item.pattern}</p>
          <p className="text-xs text-red-600 dark:text-red-400">
            {item.category.replace(/_/g, ' ')}
          </p>
        </div>
        <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs text-red-800 dark:bg-red-800 dark:text-red-200">
          {item.errorCount} errors
        </span>
      </div>
      {item.examples.length > 0 && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Example: {String.fromCharCode(8220)}{item.examples[0]}{String.fromCharCode(8221)}
        </p>
      )}
    </div>
  );
}

function VocabularyRecommendation({ item }: { item: VocabularyGap }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">{item.word}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">{item.translation}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          item.priority === 'high' 
            ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
            : item.priority === 'medium'
            ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }`}>
          {item.priority}
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        Seen {item.encounterCount} times
      </p>
    </div>
  );
}

function PronunciationRecommendation({ item }: { item: PronunciationIssue }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-purple-800 dark:text-purple-200">Sound: {item.sound}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Words: {item.wordExamples.slice(0, 3).join(', ')}
          </p>
        </div>
        <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-800 dark:text-purple-200">
          {item.issueCount} issues
        </span>
      </div>
    </div>
  );
}