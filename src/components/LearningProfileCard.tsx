'use client';

import type { LearningProfile } from '@/types/learning-profile';

interface LearningProfileCardProps {
  profile: LearningProfile;
}

export function LearningProfileCard({ profile }: LearningProfileCardProps) {
  const scores = [
    { label: 'Grammar', score: profile.grammarScore, color: 'bg-blue-500' },
    { label: 'Vocabulary', score: profile.vocabularyScore, color: 'bg-green-500' },
    { label: 'Pronunciation', score: profile.pronunciationScore, color: 'bg-purple-500' },
    { label: 'Fluency', score: profile.fluencyScore, color: 'bg-amber-500' },
  ];

  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
        Learning Profile
      </h3>

      {/* Overall Score */}
      <div className="mb-4 flex items-center justify-center">
        <div className="relative h-24 w-24">
          <svg className="h-24 w-24 -rotate-90 transform">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${profile.overallScore * 2.51} 251`}
              className="text-amber-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
              {profile.overallScore}
            </span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        {scores.map(({ label, score, color }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[#5c4d39] dark:text-[#c8b7a0]">{label}</span>
              <span className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">{score}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#d7c7a7] pt-4 dark:border-[#3b2f1d]">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {profile.sessionsCompleted}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Sessions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {profile.totalPracticeMinutes}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Minutes</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {profile.wordsLearned}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Words Learned</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {profile.wordsMastered}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Mastered</p>
        </div>
      </div>

      {/* Weak Areas */}
      {profile.grammarWeaknesses.length > 0 && (
        <div className="mt-4 border-t border-[#d7c7a7] pt-4 dark:border-[#3b2f1d]">
          <p className="mb-2 text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
            Areas to Improve
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.grammarWeaknesses.slice(0, 3).map((weakness) => (
              <span
                key={weakness.pattern}
                className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300"
              >
                {weakness.pattern}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Areas */}
      {profile.confidenceAreas.length > 0 && (
        <div className="mt-4 border-t border-[#d7c7a7] pt-4 dark:border-[#3b2f1d]">
          <p className="mb-2 text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
            Strengths
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.confidenceAreas.slice(0, 5).map((area) => (
              <span
                key={area}
                className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}