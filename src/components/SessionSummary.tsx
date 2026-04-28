// src/components/SessionSummary.tsx

'use client';

import type { ConversationSession } from '@/types/conversation';

interface SessionSummaryProps {
  session: ConversationSession;
  onClose: () => void;
}

export function SessionSummary({ session, onClose }: SessionSummaryProps) {
  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]">
        <h2 className="text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Session Complete! 🎉
        </h2>
        <p className="mt-1 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          Great practice session! Here's how you did:
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {duration}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">Minutes</p>
          </div>

          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {session.analytics.userMessages}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">Messages</p>
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {session.analytics.fluencyScore}%
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Fluency</p>
          </div>

          <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {session.analytics.grammarAccuracy}%
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">Grammar</p>
          </div>
        </div>

        {session.analytics.correctionsCount > 0 && (
          <div className="mt-4 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              📝 {session.analytics.correctionsCount} corrections made during this session.
              These have been added to your learning profile for targeted practice.
            </p>
          </div>
        )}

        {session.analytics.vocabularyIntroduced > 0 && (
          <div className="mt-4 rounded-lg bg-teal-50 p-3 dark:bg-teal-900/20">
            <p className="text-sm text-teal-800 dark:text-teal-200">
              📚 {session.analytics.vocabularyIntroduced} new vocabulary words introduced.
              Click any word during conversation to save it to your flashcards.
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
          >
            Start New Session
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
