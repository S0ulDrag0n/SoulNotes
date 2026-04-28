// src/components/ScenarioSelector.tsx
// Refactored to use Zustand stores

'use client';

import { useState } from 'react';
import { 
  SCENARIO_CONFIGS, 
  DIFFICULTY_CONFIGS, 
  type ConversationScenario, 
  type DifficultyLevel 
} from '@/types/conversation';
import { useConversationState } from '@/stores/conversationStore';

interface ScenarioSelectorProps {
  onStart: (language: string, scenario: ConversationScenario, difficulty: DifficultyLevel) => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
];

export function ScenarioSelector({ onStart }: ScenarioSelectorProps) {
  // Get state from store
  const { language, scenario, difficulty, setLanguage, setScenario, setDifficulty } = useConversationState();
  
  const [customTopic, setCustomTopic] = useState('');

  const handleStart = () => {
    onStart(language, scenario, difficulty);
  };

  return (
    <div className="space-y-6">
      {/* Language Selection */}
      <div className="rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
        <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Select Language
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                language === lang.code
                  ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                  : 'border border-[#d7c7a7] text-[#5c4d39] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Selection */}
      <div className="rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
        <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Choose Scenario
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(SCENARIO_CONFIGS).map((config) => (
            <button
              key={config.id}
              onClick={() => setScenario(config.id)}
              className={`flex items-start gap-3 rounded-xl p-4 text-left transition ${
                scenario === config.id
                  ? 'border-2 border-[#f3b34b] bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20'
                  : 'border border-[#d7c7a7] hover:border-[#f3b34b] hover:bg-amber-50/50 dark:border-[#3b2f1d] dark:hover:border-amber-500 dark:hover:bg-amber-900/10'
              }`}
            >
              <span className="text-2xl">{config.icon}</span>
              <div>
                <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                  {config.name}
                </p>
                <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                  {config.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {scenario === 'custom' && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              What would you like to talk about?
            </label>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g., Discussing climate change solutions..."
              className="w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
            />
          </div>
        )}
      </div>

      {/* Difficulty Selection */}
      <div className="rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
        <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Difficulty Level
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {Object.entries(DIFFICULTY_CONFIGS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key as DifficultyLevel)}
              className={`flex-1 rounded-xl p-4 text-center transition ${
                difficulty === key
                  ? 'border-2 border-[#f3b34b] bg-amber-50 dark:border-amber-500 dark:bg-amber-900/20'
                  : 'border border-[#d7c7a7] hover:border-[#f3b34b] dark:border-[#3b2f1d]'
              }`}
            >
              <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
                {config.name}
              </p>
              <p className="mt-1 text-xs text-[#5c4d39] dark:text-[#c8b7a0]">
                {config.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        className="w-full rounded-xl bg-[#1f1c16] px-6 py-3 text-lg font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
      >
        Start Conversation
      </button>
    </div>
  );
}