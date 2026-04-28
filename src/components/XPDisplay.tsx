'use client';

import { useGamification } from '@/hooks/useGamification';

export function XPDisplay() {
  const { userProgress, getLevelName, getXPProgress } = useGamification();
  
  if (!userProgress) return null;
  
  const { current, needed, percentage } = getXPProgress();
  const levelName = getLevelName(userProgress.currentLevel);
  
  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">Level {userProgress.currentLevel}</p>
          <p className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">{levelName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">{userProgress.totalXP.toLocaleString()} XP</p>
        </div>
      </div>
      
      <div className="mt-3">
        <div className="flex justify-between text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
          <span>{current} XP</span>
          <span>{needed} XP to next level</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}