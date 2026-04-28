# Phase 4 Implementation Specifications: Adaptive Learning

## Overview

Phase 4 implements adaptive learning features that personalize the experience:
- Learning profile tracking (grammar, vocabulary, pronunciation weaknesses)
- Tailored practice sessions based on weak areas
- Meeting vocabulary reports
- Progress dashboard with analytics

---

## 1. Learning Profile Types

```typescript
// src/types/learning-profile.ts

export interface LearningProfile {
  id: string;
  language: string;
  
  // Weakness tracking
  grammarWeaknesses: GrammarWeakness[];
  vocabularyGaps: VocabularyGap[];
  pronunciationIssues: PronunciationIssue[];
  
  // Strengths
  confidenceAreas: string[];
  
  // Scores (0-100)
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  
  // History
  sessionsCompleted: number;
  totalPracticeMinutes: number;
  wordsLearned: number;
  wordsMastered: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastPracticeAt: Date | null;
}

export interface GrammarWeakness {
  pattern: string;           // e.g., "verb conjugation", "article usage"
  category: GrammarCategory;
  errorCount: number;
  correctCount: number;
  lastOccurred: Date;
  examples: string[];        // Recent mistakes
  improvement: number;       // -100 to 100 (negative = getting worse)
}

export type GrammarCategory = 
  | 'verb_tense'
  | 'verb_conjugation'
  | 'article_usage'
  | 'preposition'
  | 'word_order'
  | 'gender'
  | 'number'
  | 'case'
  | 'mood'
  | 'voice'
  | 'other';

export interface VocabularyGap {
  word: string;
  translation: string;
  context: string;           // Where it was encountered
  encounterCount: number;    // How many times seen but not known
  lastEncountered: Date;
  priority: 'high' | 'medium' | 'low';
  relatedWords: string[];    // Similar words to learn together
}

export interface PronunciationIssue {
  sound: string;             // IPA or description
  wordExamples: string[];
  issueCount: number;
  lastOccurred: Date;
  improvement: number;
}

export interface PracticeSession {
  id: string;
  profileId: string;
  type: PracticeType;
  startedAt: Date;
  endedAt: Date | null;
  focusAreas: string[];
  results: PracticeResult[];
  overallScore: number;
}

export type PracticeType = 
  | 'grammar_focus'
  | 'vocabulary_focus'
  | 'pronunciation_focus'
  | 'mixed'
  | 'conversation'
  | 'flashcard_review';

export interface PracticeResult {
  item: string;              // Word, grammar pattern, or sound
  type: 'grammar' | 'vocabulary' | 'pronunciation';
  correct: boolean;
  responseTime: number;      // milliseconds
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface WeeklyProgress {
  weekStart: Date;
  weekEnd: Date;
  totalMinutes: number;
  sessionsCompleted: number;
  wordsLearned: number;
  wordsReviewed: number;
  averageScore: number;
  streakDays: number;
  improvement: {
    grammar: number;         // percentage change
    vocabulary: number;
    pronunciation: number;
    fluency: number;
  };
}

export interface MeetingReport {
  id: string;
  language: string;
  date: Date;
  duration: number;          // minutes
  transcript: string;
  vocabulary: ExtractedVocabulary[];
  keyPhrases: KeyPhrase[];
  technicalTerms: TechnicalTerm[];
  summary: string;
}

export interface ExtractedVocabulary {
  word: string;
  translation: string;
  definition: string;
  context: string;
  frequency: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isKnown: boolean;
  isSaved: boolean;
}

export interface KeyPhrase {
  phrase: string;
  translation: string;
  context: string;
  usage: string;             // How/when to use
}

export interface TechnicalTerm {
  term: string;
  definition: string;
  context: string;
  field: string;             // e.g., "technology", "finance", "medicine"
}
```

---

## 2. Learning Profile Service

```typescript
// src/lib/learning-profile-service.ts

import type { 
  LearningProfile, 
  GrammarWeakness, 
  VocabularyGap, 
  PronunciationIssue,
  PracticeResult,
  WeeklyProgress 
} from '@/types/learning-profile';

const DB_NAME = 'soulnotes-learning-profiles';
const DB_VERSION = 1;

class LearningProfileService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', { keyPath: 'id' });
          profileStore.createIndex('language', 'language', { unique: false });
        }

        if (!db.objectStoreNames.contains('practiceSessions')) {
          const sessionStore = db.createObjectStore('practiceSessions', { keyPath: 'id' });
          sessionStore.createIndex('profileId', 'profileId', { unique: false });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('weeklyProgress')) {
          const progressStore = db.createObjectStore('weeklyProgress', { keyPath: 'id' });
          progressStore.createIndex('profileId', 'profileId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // Profile CRUD
  async getProfile(language: string): Promise<LearningProfile | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readonly');
      const store = transaction.objectStore('profiles');
      const index = store.index('language');
      const request = index.get(language);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async createProfile(language: string): Promise<LearningProfile> {
    const db = this.ensureDb();
    const profile: LearningProfile = {
      id: crypto.randomUUID(),
      language,
      grammarWeaknesses: [],
      vocabularyGaps: [],
      pronunciationIssues: [],
      confidenceAreas: [],
      overallScore: 100,
      grammarScore: 100,
      vocabularyScore: 100,
      pronunciationScore: 100,
      fluencyScore: 100,
      sessionsCompleted: 0,
      totalPracticeMinutes: 0,
      wordsLearned: 0,
      wordsMastered: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastPracticeAt: null,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.add(profile);

      request.onsuccess = () => resolve(profile);
      request.onerror = () => reject(request.error);
    });
  }

  async updateProfile(profile: LearningProfile): Promise<void> {
    const db = this.ensureDb();
    profile.updatedAt = new Date();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.put(profile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Grammar weakness tracking
  async recordGrammarError(
    language: string,
    pattern: string,
    category: GrammarWeakness['category'],
    example: string
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    const existingIndex = profile.grammarWeaknesses.findIndex(
      w => w.pattern.toLowerCase() === pattern.toLowerCase()
    );

    if (existingIndex >= 0) {
      const weakness = profile.grammarWeaknesses[existingIndex];
      weakness.errorCount += 1;
      weakness.lastOccurred = new Date();
      if (!weakness.examples.includes(example)) {
        weakness.examples.push(example);
        if (weakness.examples.length > 5) weakness.examples.shift();
      }
      // Calculate improvement (negative = getting worse)
      const total = weakness.errorCount + weakness.correctCount;
      const recentErrorRate = weakness.errorCount / total;
      weakness.improvement = -Math.round(recentErrorRate * 100);
    } else {
      profile.grammarWeaknesses.push({
        pattern,
        category,
        errorCount: 1,
        correctCount: 0,
        lastOccurred: new Date(),
        examples: [example],
        improvement: -100,
      });
    }

    // Update grammar score
    profile.grammarScore = this.calculateGrammarScore(profile.grammarWeaknesses);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  async recordGrammarCorrect(
    language: string,
    pattern: string
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) return;

    const existingIndex = profile.grammarWeaknesses.findIndex(
      w => w.pattern.toLowerCase() === pattern.toLowerCase()
    );

    if (existingIndex >= 0) {
      const weakness = profile.grammarWeaknesses[existingIndex];
      weakness.correctCount += 1;
      
      // Calculate improvement
      const total = weakness.errorCount + weakness.correctCount;
      const recentCorrectRate = weakness.correctCount / total;
      weakness.improvement = Math.round(recentCorrectRate * 100) - 50;

      // Remove if fully mastered (10+ correct, < 20% error rate)
      if (weakness.correctCount >= 10 && weakness.errorCount / total < 0.2) {
        profile.grammarWeaknesses.splice(existingIndex, 1);
      }
    }

    profile.grammarScore = this.calculateGrammarScore(profile.grammarWeaknesses);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // Vocabulary gap tracking
  async recordVocabularyGap(
    language: string,
    word: string,
    translation: string,
    context: string
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    const existingIndex = profile.vocabularyGaps.findIndex(
      g => g.word.toLowerCase() === word.toLowerCase()
    );

    if (existingIndex >= 0) {
      const gap = profile.vocabularyGaps[existingIndex];
      gap.encounterCount += 1;
      gap.lastEncountered = new Date();
      gap.priority = this.calculateVocabularyPriority(gap);
    } else {
      profile.vocabularyGaps.push({
        word,
        translation,
        context,
        encounterCount: 1,
        lastEncountered: new Date(),
        priority: 'medium',
        relatedWords: [],
      });
    }

    profile.vocabularyScore = this.calculateVocabularyScore(profile.vocabularyGaps);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  async markVocabularyLearned(language: string, word: string): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) return;

    const index = profile.vocabularyGaps.findIndex(
      g => g.word.toLowerCase() === word.toLowerCase()
    );

    if (index >= 0) {
      profile.vocabularyGaps.splice(index, 1);
      profile.wordsLearned += 1;
    }

    profile.vocabularyScore = this.calculateVocabularyScore(profile.vocabularyGaps);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // Pronunciation tracking
  async recordPronunciationIssue(
    language: string,
    sound: string,
    word: string
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    const existingIndex = profile.pronunciationIssues.findIndex(
      p => p.sound === sound
    );

    if (existingIndex >= 0) {
      const issue = profile.pronunciationIssues[existingIndex];
      issue.issueCount += 1;
      issue.lastOccurred = new Date();
      if (!issue.wordExamples.includes(word)) {
        issue.wordExamples.push(word);
        if (issue.wordExamples.length > 10) issue.wordExamples.shift();
      }
    } else {
      profile.pronunciationIssues.push({
        sound,
        wordExamples: [word],
        issueCount: 1,
        lastOccurred: new Date(),
        improvement: -100,
      });
    }

    profile.pronunciationScore = this.calculatePronunciationScore(profile.pronunciationIssues);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // Get practice recommendations
  async getPracticeRecommendations(language: string): Promise<{
    grammar: GrammarWeakness[];
    vocabulary: VocabularyGap[];
    pronunciation: PronunciationIssue[];
  }> {
    const profile = await this.getProfile(language);
    if (!profile) {
      return { grammar: [], vocabulary: [], pronunciation: [] };
    }

    // Sort by priority (most problematic first)
    const grammar = profile.grammarWeaknesses
      .sort((a, b) => a.improvement - b.improvement)
      .slice(0, 5);

    const vocabulary = profile.vocabularyGaps
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10);

    const pronunciation = profile.pronunciationIssues
      .sort((a, b) => a.improvement - b.improvement)
      .slice(0, 5);

    return { grammar, vocabulary, pronunciation };
  }

  // Weekly progress
  async recordPracticeSession(
    language: string,
    minutes: number,
    results: PracticeResult[]
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    profile.sessionsCompleted += 1;
    profile.totalPracticeMinutes += minutes;
    profile.lastPracticeAt = new Date();

    // Process results
    for (const result of results) {
      if (result.type === 'grammar') {
        if (result.correct) {
          await this.recordGrammarCorrect(language, result.item);
        }
        // Errors are recorded separately with context
      }
    }

    await this.updateProfile(profile);
    await this.updateWeeklyProgress(profile.id, minutes, results);
  }

  private async updateWeeklyProgress(
    profileId: string,
    minutes: number,
    results: PracticeResult[]
  ): Promise<void> {
    const db = this.ensureDb();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekId = `${profileId}-${weekStart.toISOString().split('T')[0]}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('weeklyProgress', 'readwrite');
      const store = transaction.objectStore('weeklyProgress');
      const getRequest = store.get(weekId);

      getRequest.onsuccess = () => {
        let progress = getRequest.result as WeeklyProgress | undefined;

        if (!progress) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);

          progress = {
            weekStart,
            weekEnd,
            totalMinutes: 0,
            sessionsCompleted: 0,
            wordsLearned: 0,
            wordsReviewed: 0,
            averageScore: 0,
            streakDays: 0,
            improvement: { grammar: 0, vocabulary: 0, pronunciation: 0, fluency: 0 },
          } as WeeklyProgress & { id: string };
          (progress as any).id = weekId;
          (progress as any).profileId = profileId;
        }

        progress.totalMinutes += minutes;
        progress.sessionsCompleted += 1;

        const correctCount = results.filter(r => r.correct).length;
        progress.averageScore = Math.round((correctCount / results.length) * 100);

        store.put(progress);
        resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getWeeklyProgress(language: string, weeks: number = 4): Promise<WeeklyProgress[]> {
    const db = this.ensureDb();
    const profile = await this.getProfile(language);
    if (!profile) return [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('weeklyProgress', 'readonly');
      const store = transaction.objectStore('weeklyProgress');
      const request = store.getAll();

      request.onsuccess = () => {
        const allProgress = request.result as (WeeklyProgress & { profileId: string })[];
        const filtered = allProgress
          .filter(p => p.profileId === profile.id)
          .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
          .slice(0, weeks);
        resolve(filtered);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Score calculations
  private calculateGrammarScore(weaknesses: GrammarWeakness[]): number {
    if (weaknesses.length === 0) return 100;
    const avgImprovement = weaknesses.reduce((sum, w) => sum + w.improvement, 0) / weaknesses.length;
    return Math.max(0, Math.min(100, 100 + avgImprovement));
  }

  private calculateVocabularyScore(gaps: VocabularyGap[]): number {
    if (gaps.length === 0) return 100;
    // More gaps = lower score
    const highPriority = gaps.filter(g => g.priority === 'high').length;
    const mediumPriority = gaps.filter(g => g.priority === 'medium').length;
    const penalty = (highPriority * 5) + (mediumPriority * 2);
    return Math.max(0, 100 - penalty);
  }

  private calculatePronunciationScore(issues: PronunciationIssue[]): number {
    if (issues.length === 0) return 100;
    const avgImprovement = issues.reduce((sum, i) => sum + i.improvement, 0) / issues.length;
    return Math.max(0, Math.min(100, 100 + avgImprovement));
  }

  private calculateOverallScore(profile: LearningProfile): number {
    return Math.round(
      (profile.grammarScore + profile.vocabularyScore + profile.pronunciationScore + profile.fluencyScore) / 4
    );
  }

  private calculateVocabularyPriority(gap: VocabularyGap): 'high' | 'medium' | 'low' {
    if (gap.encounterCount >= 3) return 'high';
    if (gap.encounterCount >= 2) return 'medium';
    return 'low';
  }
}

let serviceInstance: LearningProfileService | null = null;

export async function getLearningProfileService(): Promise<LearningProfileService> {
  if (!serviceInstance) {
    serviceInstance = new LearningProfileService();
    await serviceInstance.init();
  }
  return serviceInstance;
}
```

---

## 3. Adaptive Practice Hook

```typescript
// src/hooks/useAdaptivePractice.ts

import { useState, useCallback } from 'react';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import { useVocabulary } from './useVocabulary';
import type { 
  PracticeType, 
  PracticeSession, 
  PracticeResult,
  GrammarWeakness,
  VocabularyGap,
  PronunciationIssue 
} from '@/types/learning-profile';

interface UseAdaptivePracticeReturn {
  isLoading: boolean;
  recommendations: {
    grammar: GrammarWeakness[];
    vocabulary: VocabularyGap[];
    pronunciation: PronunciationIssue[];
  } | null;
  currentSession: PracticeSession | null;
  
  getRecommendations: (language: string) => Promise<void>;
  startPracticeSession: (language: string, type: PracticeType) => Promise<void>;
  recordResult: (result: PracticeResult) => void;
  endPracticeSession: () => Promise<PracticeSession>;
}

export function useAdaptivePractice(): UseAdaptivePracticeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<UseAdaptivePracticeReturn['recommendations']>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const { items, addItem } = useVocabulary();

  const getRecommendations = useCallback(async (language: string) => {
    setIsLoading(true);
    try {
      const service = await getLearningProfileService();
      const recs = await service.getPracticeRecommendations(language);
      setRecommendations(recs);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startPracticeSession = useCallback(async (language: string, type: PracticeType) => {
    const service = await getLearningProfileService();
    let profile = await service.getProfile(language);
    if (!profile) profile = await service.createProfile(language);

    const focusAreas: string[] = [];
    
    if (type === 'grammar_focus' || type === 'mixed') {
      const recs = await service.getPracticeRecommendations(language);
      focusAreas.push(...recs.grammar.slice(0, 3).map(g => g.pattern));
    }
    
    if (type === 'vocabulary_focus' || type === 'mixed') {
      const recs = await service.getPracticeRecommendations(language);
      focusAreas.push(...recs.vocabulary.slice(0, 5).map(v => v.word));
    }

    const session: PracticeSession = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      type,
      startedAt: new Date(),
      endedAt: null,
      focusAreas,
      results: [],
      overallScore: 0,
    };

    setCurrentSession(session);
    setResults([]);
  }, []);

  const recordResult = useCallback((result: PracticeResult) => {
    setResults(prev => [...prev, result]);
  }, []);

  const endPracticeSession = useCallback(async (): Promise<PracticeSession> => {
    if (!currentSession) {
      throw new Error('No active session');
    }

    const service = await getLearningProfileService();
    const endedAt = new Date();
    const minutes = Math.round(
      (endedAt.getTime() - new Date(currentSession.startedAt).getTime()) / 60000
    );

    const correctCount = results.filter(r => r.correct).length;
    const overallScore = results.length > 0 
      ? Math.round((correctCount / results.length) * 100) 
      : 0;

    const session: PracticeSession = {
      ...currentSession,
      endedAt,
      results,
      overallScore,
    };

    // Record in learning profile
    const profile = await service.getProfile(currentSession.profileId);
    if (profile) {
      await service.recordPracticeSession(profile.language, minutes, results);
    }

    setCurrentSession(null);
    setResults([]);

    return session;
  }, [currentSession, results]);

  return {
    isLoading,
    recommendations,
    currentSession,
    getRecommendations,
    startPracticeSession,
    recordResult,
    endPracticeSession,
  };
}
```

---

## 4. Meeting Vocabulary Report

```typescript
// src/app/api/meeting-report/route.ts

import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:10102';
const OLLAMA_MODEL = process.env.OLLAMA_SUMMARIZE_MODEL || 'phi4:latest';

interface MeetingReportRequest {
  transcript: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MeetingReportRequest = await request.json();
    const { transcript, translation, sourceLanguage, targetLanguage } = body;

    // Extract vocabulary from the meeting
    const vocabularyPrompt = `Analyze the following ${sourceLanguage} text and extract vocabulary words that would be useful for a language learner.

For each word, provide:
1. The word in ${sourceLanguage}
2. Translation in ${targetLanguage}
3. Definition in ${targetLanguage}
4. Difficulty level (beginner/intermediate/advanced)
5. Why this word is useful

Text:
${transcript}

Respond in JSON format:
{
  "vocabulary": [
    {
      "word": "word",
      "translation": "translation",
      "definition": "definition",
      "difficulty": "beginner|intermediate|advanced",
      "usefulness": "why useful"
    }
  ]
}`;

    const vocabResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: vocabularyPrompt,
        stream: false,
        format: 'json',
      }),
    });

    const vocabData = await vocabResponse.json();
    const vocabulary = JSON.parse(vocabData.response || '{"vocabulary": []}').vocabulary || [];

    // Extract key phrases
    const phrasesPrompt = `Extract key phrases and expressions from the following ${sourceLanguage} text.

For each phrase, provide:
1. The phrase in ${sourceLanguage}
2. Translation in ${targetLanguage}
3. Context/usage notes

Text:
${transcript}

Respond in JSON format:
{
  "phrases": [
    {
      "phrase": "phrase",
      "translation": "translation",
      "usage": "context notes"
    }
  ]
}`;

    const phrasesResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: phrasesPrompt,
        stream: false,
        format: 'json',
      }),
    });

    const phrasesData = await phrasesResponse.json();
    const phrases = JSON.parse(phrasesData.response || '{"phrases": []}').phrases || [];

    // Extract technical terms
    const termsPrompt = `Identify technical or specialized terms from the following text.

For each term, provide:
1. The term
2. Definition
3. Field/domain (e.g., technology, finance, medicine)

Text:
${transcript}

Respond in JSON format:
{
  "terms": [
    {
      "term": "term",
      "definition": "definition",
      "field": "domain"
    }
  ]
}`;

    const termsResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: termsPrompt,
        stream: false,
        format: 'json',
      }),
    });

    const termsData = await termsResponse.json();
    const terms = JSON.parse(termsData.response || '{"terms": []}').terms || [];

    // Calculate word frequency
    const wordFrequency = calculateWordFrequency(transcript);

    return NextResponse.json({
      vocabulary: vocabulary.map((v: any) => ({
        ...v,
        frequency: wordFrequency[v.word.toLowerCase()] || 1,
        isKnown: false,
        isSaved: false,
      })),
      keyPhrases: phrases,
      technicalTerms: terms,
      summary: generateSummary(transcript, translation),
    });
  } catch (error) {
    console.error('Meeting report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate meeting report' },
      { status: 500 }
    );
  }
}

function calculateWordFrequency(text: string): Record<string, number> {
  const words = text.toLowerCase().split(/\s+/);
  const frequency: Record<string, number> = {};
  
  for (const word of words) {
    const cleaned = word.replace(/[^\w]/g, '');
    if (cleaned.length > 2) {
      frequency[cleaned] = (frequency[cleaned] || 0) + 1;
    }
  }
  
  return frequency;
}

function generateSummary(transcript: string, translation: string): string {
  // Return first 200 chars of translation as summary
  return translation.slice(0, 200) + (translation.length > 200 ? '...' : '');
}
```

---

## 5. Dashboard Page

```typescript
// src/app/dashboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { PremiumGate } from '@/components/PremiumGate';
import { AppHeader } from '@/components/AppHeader';
import { StreakDisplay } from '@/components/StreakDisplay';
import { XPDisplay } from '@/components/XPDisplay';
import { AchievementsDisplay } from '@/components/AchievementsDisplay';
import { WeeklyProgressChart } from '@/components/WeeklyProgressChart';
import { LearningProfileCard } from '@/components/LearningProfileCard';
import { PracticeRecommendations } from '@/components/PracticeRecommendations';
import { useGamification } from '@/hooks/useGamification';
import { useLearningProfile } from '@/hooks/useLearningProfile';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import type { LearningProfile, WeeklyProgress } from '@/types/learning-profile';

export default function DashboardPage() {
  const { userProgress, languageProgress } = useGamification();
  const { profiles } = useLearningProfile();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [currentProfile, setCurrentProfile] = useState<LearningProfile | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      const service = await getLearningProfileService();
      const profile = await service.getProfile(selectedLanguage);
      setCurrentProfile(profile);
      
      if (profile) {
        const progress = await service.getWeeklyProgress(selectedLanguage);
        setWeeklyProgress(progress);
      }
      setIsLoading(false);
    }
    loadProfile();
  }, [selectedLanguage]);

  const languages = Array.from(profiles.keys());

  return (
    <PremiumGate>
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
        <AppHeader />
        
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

            {languages.length > 0 && (
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                ))}
              </select>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
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
              </div>

              {/* Right Column - Recommendations */}
              <div>
                <PracticeRecommendations language={selectedLanguage} />
              </div>
            </div>
          )}
        </main>
      </div>
    </PremiumGate>
  );
}
```

---

## 6. Learning Profile Card

```typescript
// src/components/LearningProfileCard.tsx

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
    </div>
  );
}
```

---

## 7. Practice Recommendations

```typescript
// src/components/PracticeRecommendations.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAdaptivePractice } from '@/hooks/useAdaptivePractice';
import type { GrammarWeakness, VocabularyGap, PronunciationIssue } from '@/types/learning-profile';

interface PracticeRecommendationsProps {
  language: string;
}

export function PracticeRecommendations({ language }: PracticeRecommendationsProps) {
  const { recommendations, getRecommendations, isLoading } = useAdaptivePractice();
  const [activeTab, setActiveTab] = useState<'grammar' | 'vocabulary' | 'pronunciation'>('grammar');

  useEffect(() => {
    getRecommendations(language);
  }, [language, getRecommendations]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
      </div>
    );
  }

  if (!recommendations || (
    recommendations.grammar.length === 0 &&
    recommendations.vocabulary.length === 0 &&
    recommendations.pronunciation.length === 0
  )) {
    return (
      <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Practice Recommendations
        </h3>
        <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          Complete more practice sessions to get personalized recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
      <h3 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
        Practice Recommendations
      </h3>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-[#efe0c3] p-1 dark:bg-[#2a2218]">
        <button
          onClick={() => setActiveTab('grammar')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'grammar'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Grammar ({recommendations.grammar.length})
        </button>
        <button
          onClick={() => setActiveTab('vocabulary')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'vocabulary'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Vocabulary ({recommendations.vocabulary.length})
        </button>
        <button
          onClick={() => setActiveTab('pronunciation')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'pronunciation'
              ? 'bg-white text-[#1f1c16] shadow dark:bg-[#1b1711] dark:text-[#f3e9d8]'
              : 'text-[#5c4d39] dark:text-[#c8b7a0]'
          }`}
        >
          Pronunciation ({recommendations.pronunciation.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {activeTab === 'grammar' && recommendations.grammar.map((item) => (
          <GrammarRecommendation key={item.pattern} item={item} />
        ))}
        {activeTab === 'vocabulary' && recommendations.vocabulary.map((item) => (
          <VocabularyRecommendation key={item.word} item={item} />
        ))}
        {activeTab === 'pronunciation' && recommendations.pronunciation.map((item) => (
          <PronunciationRecommendation key={item.sound} item={item} />
        ))}
      </div>

      {/* Start Practice Button */}
      <button className="mt-4 w-full rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]">
        Start Focused Practice
      </button>
    </div>
  );
}

function GrammarRecommendation({ item }: { item: GrammarWeakness }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">{item.pattern}</p>
          <p className="text-xs text-red-600 dark:text-red-400">
            {item.category.replace(/_/g, ' ')}
          </p>
        </div>
        <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs text-red-800 dark:bg-red-800 dark:text-red-200">
          {item.errorCount} errors
        </span>
      </div>
      {item.examples.length > 0 && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Example: "{item.examples[0]}"
        </p>
      )}
    </div>
  );
}

function VocabularyRecommendation({ item }: { item: VocabularyGap }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">{item.word}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">{item.translation}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          item.priority === 'high' 
            ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
            : item.priority === 'medium'
            ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }`}>
          {item.priority}
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        Seen {item.encounterCount} times
      </p>
    </div>
  );
}

function PronunciationRecommendation({ item }: { item: PronunciationIssue }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-purple-800 dark:text-purple-200">Sound: {item.sound}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Words: {item.wordExamples.slice(0, 3).join(', ')}
          </p>
        </div>
        <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-800 dark:text-purple-200">
          {item.issueCount} issues
        </span>
      </div>
    </div>
  );
}
```

---

## 8. Implementation Checklist

### Phase 4A: Learning Profile Service (Week 1)
- [ ] Create learning profile types (`src/types/learning-profile.ts`)
- [ ] Create learning profile service (`src/lib/learning-profile-service.ts`)
- [ ] Implement grammar weakness tracking
- [ ] Implement vocabulary gap tracking
- [ ] Implement pronunciation issue tracking
- [ ] Implement score calculations

### Phase 4B: Adaptive Practice (Week 1)
- [ ] Create useAdaptivePractice hook
- [ ] Implement practice recommendations
- [ ] Implement practice session tracking
- [ ] Integrate with conversation corrections
- [ ] Integrate with flashcard reviews

### Phase 4C: Meeting Reports (Week 2)
- [ ] Create meeting report API endpoint
- [ ] Implement vocabulary extraction
- [ ] Implement key phrase extraction
- [ ] Implement technical term detection
- [ ] Create meeting report UI component

### Phase 4D: Dashboard (Week 2)
- [ ] Create dashboard page
- [ ] Create LearningProfileCard component
- [ ] Create PracticeRecommendations component
- [ ] Create WeeklyProgressChart component
- [ ] Integrate all components

### Phase 4E: Polish (Week 3)
- [ ] Add data visualization
- [ ] Add progress animations
- [ ] Optimize performance
- [ ] Add error handling
- [ ] Test all features