'use client';

import { useState } from 'react';
import { useGamification } from '@/hooks/useGamification';
import type { Achievement } from '@/types/gamification';

export function AchievementsDisplay() {
  const { achievements } = useGamification();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  
  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  
  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Achievements</h3>
        <span className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          {unlockedCount} / {achievements.length}
        </span>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {achievements.map((achievement) => (
          <button
            key={achievement.id}
            onClick={() => setSelectedAchievement(achievement)}
            className={`relative flex h-12 w-12 items-center justify-center rounded-lg text-2xl transition ${
              achievement.unlockedAt
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-800/30 grayscale'
            }`}
            title={achievement.name}
          >
            {achievement.icon}
            {achievement.unlockedAt && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
      
      {selectedAchievement && (
        <div className="mt-4 rounded-lg bg-[#efe0c3]/50 p-3 dark:bg-[#2a2218]/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedAchievement.icon}</span>
            <div>
              <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                {selectedAchievement.name}
              </p>
              <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                {selectedAchievement.description}
              </p>
            </div>
          </div>
          
          {!selectedAchievement.unlockedAt && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                <span>Progress</span>
                <span>{Math.round(selectedAchievement.progress)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#d7c7a7] dark:bg-[#3b2f1d]">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${selectedAchievement.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {selectedAchievement.unlockedAt && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              Unlocked {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}