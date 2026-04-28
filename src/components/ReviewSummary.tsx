'use client';

import type { ReviewSession } from '@/types/gamification';

interface ReviewSummaryProps {
  session: ReviewSession;
  onClose: () => void;
}

export function ReviewSummary({ session, onClose }: ReviewSummaryProps) {
  const accuracy = session.cardsReviewed > 0
    ? Math.round((session.correctAnswers / session.cardsReviewed) * 100)
    : 0;
  
  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]">
        <h2 className="text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Session Complete! 🎉
        </h2>
        
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {session.cardsReviewed}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Cards Reviewed</p>
          </div>
          
          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {accuracy}%
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">Accuracy</p>
          </div>
          
          <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {session.xpEarned}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">XP Earned</p>
          </div>
          
          <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {duration}
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">Minutes</p>
          </div>
        </div>
        
        {session.perfectStreak >= 10 && (
          <div className="mt-4 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 p-3 text-center dark:from-amber-900/30 dark:to-amber-800/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              🔥 Perfect Streak: {session.perfectStreak} correct in a row!
            </p>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}