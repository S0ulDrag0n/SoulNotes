'use client';

import type { WeeklyProgress } from '@/types/learning-profile';

interface WeeklyProgressChartProps {
  data: WeeklyProgress[];
}

export function WeeklyProgressChart({ data }: WeeklyProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Weekly Progress
        </h3>
        <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          No progress data available yet. Start practicing to see your progress!
        </p>
      </div>
    );
  }

  // Calculate max values for scaling
  const maxMinutes = Math.max(...data.map(d => d.totalMinutes), 1);
  const maxSessions = Math.max(...data.map(d => d.sessionsCompleted), 1);
  const totalMinutes = data.reduce((sum, d) => sum + d.totalMinutes, 0);
  const totalSessions = data.reduce((sum, d) => sum + d.sessionsCompleted, 0);
  const avgScore = data.length > 0 
    ? Math.round(data.reduce((sum, d) => sum + d.averageScore, 0) / data.length)
    : 0;

  // Format week label
  const formatWeekLabel = (weekStart: Date): string => {
    const date = new Date(weekStart);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
        Weekly Progress
      </h3>

      {/* Summary Stats */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {totalMinutes}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Total Minutes</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {totalSessions}
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Sessions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            {avgScore}%
          </p>
          <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">Avg Score</p>
        </div>
      </div>

      {/* Bar Chart - Practice Minutes */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
          Practice Minutes
        </p>
        <div className="flex h-24 items-end gap-2">
          {data.slice().reverse().map((week, index) => {
            const height = (week.totalMinutes / maxMinutes) * 100;
            return (
              <div key={week.id} className="flex flex-1 flex-col items-center">
                <div className="w-full rounded-t bg-amber-500" style={{ height: `${height}%` }} />
                <span className="mt-1 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions Chart */}
      <div>
        <p className="mb-2 text-xs font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
          Sessions Completed
        </p>
        <div className="flex h-16 items-end gap-2">
          {data.slice().reverse().map((week) => {
            const height = (week.sessionsCompleted / maxSessions) * 100;
            return (
              <div key={week.id} className="flex flex-1 flex-col items-center">
                <div className="w-full rounded-t bg-blue-500" style={{ height: `${height}%` }} />
                <span className="mt-1 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                  {week.sessionsCompleted}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Improvement Indicators */}
      {data.length >= 2 && (
        <div className="mt-4 border-t border-[#d7c7a7] pt-4 dark:border-[#3b2f1d]">
          <p className="mb-2 text-xs font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
            Week-over-Week Improvement
          </p>
          <div className="grid grid-cols-4 gap-2">
            <ImprovementIndicator label="Grammar" value={data[0].improvement.grammar} />
            <ImprovementIndicator label="Vocab" value={data[0].improvement.vocabulary} />
            <ImprovementIndicator label="Pronunciation" value={data[0].improvement.pronunciation} />
            <ImprovementIndicator label="Fluency" value={data[0].improvement.fluency} />
          </div>
        </div>
      )}
    </div>
  );
}

function ImprovementIndicator({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <div className="text-center">
      <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">{label}</p>
      <p className={`text-sm font-semibold ${
        isPositive 
          ? 'text-green-600 dark:text-green-400' 
          : isNeutral 
            ? 'text-[#5c4d39] dark:text-[#c8b7a0]'
            : 'text-red-600 dark:text-red-400'
      }`}>
        {isPositive ? '+' : ''}{value}%
      </p>
    </div>
  );
}