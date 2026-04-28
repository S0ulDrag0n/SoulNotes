// src/hooks/useAdaptivePractice.ts

import { useState, useCallback } from 'react';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import type { 
  PracticeType, 
  PracticeSession, 
  PracticeResult,
  GrammarWeakness,
  VocabularyGap,
  PronunciationIssue,
} from '@/types/learning-profile';

interface UseAdaptivePracticeReturn {
  isLoading: boolean;
  error: string | null;
  recommendations: {
    grammar: GrammarWeakness[];
    vocabulary: VocabularyGap[];
    pronunciation: PronunciationIssue[];
  } | null;
  currentSession: PracticeSession | null;
  
  getRecommendations: (language: string) => Promise<void>;
  startPracticeSession: (language: string, type: PracticeType) => Promise<PracticeSession>;
  recordResult: (result: PracticeResult) => void;
  endPracticeSession: () => Promise<PracticeSession>;
  clearError: () => void;
}

export function useAdaptivePractice(): UseAdaptivePracticeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<UseAdaptivePracticeReturn['recommendations']>(null);
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [results, setResults] = useState<PracticeResult[]>([]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getRecommendations = useCallback(async (language: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const service = await getLearningProfileService();
      const recs = await service.getPracticeRecommendations(language);
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setError('Failed to load practice recommendations. Please try again.');
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

    const session = await service.createPracticeSession(language, type, focusAreas);
    setCurrentSession(session);
    setResults([]);
    
    return session;
  }, []);

  const recordResult = useCallback((result: PracticeResult) => {
    setResults(prev => [...prev, result]);
  }, []);

  const endPracticeSession = useCallback(async (): Promise<PracticeSession> => {
    if (!currentSession) {
      throw new Error('No active session');
    }

    const service = await getLearningProfileService();
    const endedSession = await service.endPracticeSession(currentSession.id, results);

    setCurrentSession(null);
    setResults([]);

    return endedSession;
  }, [currentSession, results]);

  return {
    isLoading,
    error,
    recommendations,
    currentSession,
    getRecommendations,
    startPracticeSession,
    recordResult,
    endPracticeSession,
    clearError,
  };
}