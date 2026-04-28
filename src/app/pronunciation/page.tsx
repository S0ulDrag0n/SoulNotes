'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePronunciationPractice } from '@/hooks/usePronunciationPractice';
import type { PronunciationWord, PronunciationAttempt } from '@/types/pronunciation';

// Sample words for different languages
const SAMPLE_WORDS: Record<string, string[]> = {
  en: ['hello', 'world', 'beautiful', 'knowledge', 'opportunity'],
  es: ['hola', 'mundo', 'hermoso', 'conocimiento', 'oportunidad'],
  fr: ['bonjour', 'monde', 'beau', 'connaissance', 'opportunité'],
  de: ['hallo', 'welt', 'schön', 'wissen', 'möglichkeit'],
  zh: ['你好', '世界', '美丽', '知识', '机会'],
  ja: ['こんにちは', '世界', '美しい', '知識', '機会'],
  ko: ['안녕하세요', '세계', '아름다운', '지식', '기회'],
};

export default function PronunciationPage() {
  const [language, setLanguage] = useState('en');
  const [customWords, setCustomWords] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  
  const {
    isRecording,
    isPlaying,
    isAnalyzing,
    currentWord,
    session,
    error,
    startSession,
    endSession,
    playWord,
    playWordSlow,
    startRecording,
    stopRecording,
    nextWord,
    previousWord,
  } = usePronunciationPractice();

  const handleStartSession = useCallback(async () => {
    const words = customWords
      ? customWords.split(',').map(w => w.trim()).filter(w => w)
      : SAMPLE_WORDS[language] || SAMPLE_WORDS.en;
    
    await startSession(language, words);
    setIsStarted(true);
  }, [language, customWords, startSession]);

  const handleEndSession = useCallback(() => {
    const endedSession = endSession();
    setIsStarted(false);
    // Could show summary here
    console.log('Session ended:', endedSession);
  }, [endSession]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (session) {
        endSession();
      }
    };
  }, [session, endSession]);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Pronunciation Practice</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!isStarted ? (
          // Setup screen
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-[#e7d8a6] dark:border-[#3d3d3d] bg-white dark:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Custom Words (optional, comma-separated)
              </label>
              <textarea
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
                placeholder={SAMPLE_WORDS[language]?.join(', ') || 'Enter words to practice'}
                className="w-full px-3 py-2 rounded-lg border border-[#e7d8a6] dark:border-[#3d3d3d] bg-white dark:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] min-h-[100px]"
              />
              <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0] mt-1">
                Leave empty to use sample words for {language}
              </p>
            </div>

            <button
              onClick={handleStartSession}
              className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg font-medium transition-colors"
            >
              Start Practice
            </button>
          </div>
        ) : (
          // Practice screen
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Word {session ? session.words.findIndex(w => w.word === currentWord?.word) + 1 : 0} of {session?.words.length || 0}
                </span>
                <span className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">
                  Score: {session?.overallScore || 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f59e0b] transition-all"
                  style={{
                    width: session
                      ? `${((session.words.findIndex(w => w.word === currentWord?.word) + 1) / session.words.length) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            {/* Current word */}
            {currentWord && (
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-8 text-center">
                <h2 className="text-4xl font-bold mb-4">{currentWord.word}</h2>
                {currentWord.ipa && (
                  <p className="text-lg text-[#8b7355] dark:text-[#a0a0a0] mb-4">
                    /{currentWord.ipa}/
                  </p>
                )}

                {/* Controls */}
                <div className="flex justify-center gap-4 mb-6">
                  <button
                    onClick={playWord}
                    disabled={isPlaying || isRecording}
                    className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? 'Playing...' : '🔊 Listen'}
                  </button>
                  <button
                    onClick={playWordSlow}
                    disabled={isPlaying || isRecording}
                    className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🐢 Slow
                  </button>
                </div>

                {/* Recording */}
                <div className="mb-6">
                  <button
                    onClick={handleRecordToggle}
                    disabled={isPlaying || isAnalyzing}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-[#f59e0b] hover:bg-[#d97706] text-white'
                    }`}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '🎤 Record'}
                  </button>
                  {isAnalyzing && (
                    <p className="mt-2 text-sm text-[#8b7355] dark:text-[#a0a0a0]">
                      Analyzing pronunciation...
                    </p>
                  )}
                </div>

                {/* Last attempt feedback */}
                {currentWord.attempts.length > 0 && (
                  <AttemptFeedback attempt={currentWord.attempts[currentWord.attempts.length - 1]} />
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={previousWord}
                disabled={!session || session.words.findIndex(w => w.word === currentWord?.word) === 0}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={handleEndSession}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                End Session
              </button>
              <button
                onClick={nextWord}
                disabled={!session || session.words.findIndex(w => w.word === currentWord?.word) === session.words.length - 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>

            {/* Session summary */}
            {session && session.words.some(w => w.attempts.length > 0) && (
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Session Progress</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#f59e0b]">
                      {session.words.filter(w => w.mastered).length}
                    </p>
                    <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">Mastered</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#10b981]">
                      {session.words.filter(w => w.attempts.length > 0).length}
                    </p>
                    <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">Attempted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#6366f1]">
                      {session.words.reduce((sum, w) => sum + w.attempts.length, 0)}
                    </p>
                    <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">Total Attempts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#f59e0b]">
                      {session.overallScore}%
                    </p>
                    <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">Avg Score</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AttemptFeedback({ attempt }: { attempt: PronunciationAttempt }) {
  const score = attempt.score;
  const feedback = attempt.feedback;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="mt-4 p-4 bg-white/80 dark:bg-black/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Last Attempt</span>
        <span className={`text-xl font-bold ${getScoreColor(score)}`}>
          {score}%
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div className="text-center">
          <p className="font-medium">Accuracy</p>
          <p className={getScoreColor(feedback.accuracy)}>{feedback.accuracy}%</p>
        </div>
        <div className="text-center">
          <p className="font-medium">Fluency</p>
          <p className={getScoreColor(feedback.fluency)}>{feedback.fluency}%</p>
        </div>
        <div className="text-center">
          <p className="font-medium">Completeness</p>
          <p className={getScoreColor(feedback.completeness)}>{feedback.completeness}%</p>
        </div>
      </div>

      {feedback.issues.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium mb-1">Issues:</p>
          <ul className="text-sm text-[#8b7355] dark:text-[#a0a0a0] list-disc list-inside">
            {feedback.issues.map((issue, i) => (
              <li key={i}>
                {issue.type}: expected {String.fromCharCode(34)}{issue.expected}{String.fromCharCode(34)} but got {String.fromCharCode(34)}{issue.actual}{String.fromCharCode(34)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.suggestions.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Suggestions:</p>
          <ul className="text-sm text-[#8b7355] dark:text-[#a0a0a0] list-disc list-inside">
            {feedback.suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}