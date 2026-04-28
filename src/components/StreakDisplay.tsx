'use client';

import { useGamification } from '@/hooks/useGamification';

export function StreakDisplay() {
  const { userProgress } = useGamification();
  
  if (!userProgress) return null;
  
  const { currentStreak, longestStreak } = userProgress;
  
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Current Streak</p>
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">{currentStreak} days</p>
        </div>
      </div>
      
      <div className="h-8 w-px bg-[#d7c7a7] dark:bg-[#3b2f1d]" />
      
      <div>
        <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Longest</p>
        <p className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">{longestStreak} days</p>
      </div>
    </div>
  );
}