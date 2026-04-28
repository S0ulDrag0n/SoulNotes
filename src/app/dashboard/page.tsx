'use client';

import { useState, useEffect } from 'react';
import { StreakDisplay } from '@/components/StreakDisplay';
import { XPDisplay } from '@/components/XPDisplay';
import { AchievementsDisplay } from '@/components/AchievementsDisplay';
import { WeeklyProgressChart } from '@/components/WeeklyProgressChart';
import { LearningProfileCard } from '@/components/LearningProfileCard';
import { PracticeRecommendations } from '@/components/PracticeRecommendations';
import { useGamification } from '@/hooks/useGamification';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import type { LearningProfile, WeeklyProgress } from '@/types/learning-profile';

export default function DashboardPage() {
  const { userProgress } = useGamification();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [currentProfile, setCurrentProfile] = useState<LearningProfile | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['en']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const service = await getLearningProfileService();
        
        // Get all profiles to find available languages
        const allProfiles = await service.getAllProfiles();
        if (allProfiles.length > 0) {
          setAvailableLanguages(allProfiles.map(p => p.language));
          // Select the first language if current one doesn't exist
          if (!allProfiles.find(p => p.language === selectedLanguage)) {
            setSelectedLanguage(allProfiles[0].language);
          }
        }
        
        const profile = await service.getProfile(selectedLanguage);
        setCurrentProfile(profile);
        
        if (profile) {
          const progress = await service.getWeeklyProgress(selectedLanguage);
          setWeeklyProgress(progress);
        } else {
          setWeeklyProgress([]);
        }
      } catch (error) {
        console.error('Failed to load learning profile:', error);
        setError('Failed to load your learning profile. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [selectedLanguage]);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
              Dashboard
            </h1>
            <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
              Track your language learning progress
            </p>
          </div>

          {availableLanguages.length > 1 && (
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
          </div>
        ) : error ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-4xl">⚠️</div>
              <h2 className="mb-2 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
                Something went wrong
              </h2>
              <p className="mb-4 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
              >
                Refresh Page
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Stats */}
            <div className="space-y-6">
              <StreakDisplay />
              <XPDisplay />
              <AchievementsDisplay />
            </div>

            {/* Middle Column - Progress */}
            <div className="space-y-6">
              <WeeklyProgressChart data={weeklyProgress} />
              
              {currentProfile && (
                <LearningProfileCard profile={currentProfile} />
              )}

              {!currentProfile && (
                <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
                  <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
                    Learning Profile
                  </h3>
                  <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                    Start practicing to build your learning profile. Your strengths and areas for improvement will appear here.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Recommendations */}
            <div>
              <PracticeRecommendations language={selectedLanguage} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}