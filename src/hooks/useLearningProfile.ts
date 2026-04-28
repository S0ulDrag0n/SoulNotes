// src/hooks/useLearningProfile.ts

import { useState, useCallback, useEffect } from 'react';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import type { Correction } from '@/types/conversation';
import type { LearningProfile, GrammarCategory } from '@/types/learning-profile';

interface UseLearningProfileReturn {
  profiles: Map<string, LearningProfile>;
  currentProfile: LearningProfile | null;
  isLoading: boolean;
  updateProfile: (language: string) => Promise<LearningProfile>;
  recordConversationMistakes: (corrections: Correction[], language: string) => Promise<void>;
  markVocabularyKnown: (word: string, language: string) => Promise<void>;
  addConfidenceArea: (area: string, language: string) => Promise<void>;
  setCurrentLanguage: (language: string) => void;
}

export function useLearningProfile(): UseLearningProfileReturn {
  const [profiles, setProfiles] = useState<Map<string, LearningProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and load profiles from IndexedDB
  useEffect(() => {
    async function init() {
      try {
        const service = await getLearningProfileService();
        const allProfiles = await service.getAllProfiles();
        const profileMap = new Map<string, LearningProfile>();
        for (const profile of allProfiles) {
          profileMap.set(profile.language, profile);
        }
        setProfiles(profileMap);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize learning profile service:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const updateProfile = useCallback(async (language: string): Promise<LearningProfile> => {
    const service = await getLearningProfileService();
    let profile = await service.getProfile(language);
    if (!profile) {
      profile = await service.createProfile(language);
    }
    
    // Update local state
    setProfiles(prev => {
      const newMap = new Map(prev);
      newMap.set(language, profile!);
      return newMap;
    });
    
    return profile;
  }, []);

  const recordConversationMistakes = useCallback(async (
    corrections: Correction[],
    language: string
  ) => {
    const service = await getLearningProfileService();
    
    for (const correction of corrections) {
      if (correction.type === 'grammar') {
        // Map correction types to grammar categories
        const category: GrammarCategory = mapCorrectionToCategory(correction);
        await service.recordGrammarError(
          language,
          correction.original,
          category,
          correction.explanation
        );
      }
      
      if (correction.type === 'pronunciation') {
        await service.recordPronunciationIssue(
          language,
          correction.original,
          correction.corrected
        );
      }
    }
    
    // Reload profile after updates
    const profile = await service.getProfile(language);
    if (profile) {
      setProfiles(prev => {
        const newMap = new Map(prev);
        newMap.set(language, profile!);
        return newMap;
      });
    }
  }, []);

  const markVocabularyKnown = useCallback(async (word: string, language: string) => {
    const service = await getLearningProfileService();
    await service.markVocabularyLearned(language, word);
    
    // Reload profile
    const profile = await service.getProfile(language);
    if (profile) {
      setProfiles(prev => {
        const newMap = new Map(prev);
        newMap.set(language, profile!);
        return newMap;
      });
    }
  }, []);

  const addConfidenceArea = useCallback(async (area: string, language: string) => {
    const service = await getLearningProfileService();
    await service.addConfidenceArea(language, area);
    
    // Reload profile
    const profile = await service.getProfile(language);
    if (profile) {
      setProfiles(prev => {
        const newMap = new Map(prev);
        newMap.set(language, profile!);
        return newMap;
      });
    }
  }, []);

  const setCurrentLanguageCallback = useCallback((language: string) => {
    setCurrentLanguage(language);
  }, []);

  const currentProfile = currentLanguage ? profiles.get(currentLanguage) || null : null;

  return {
    profiles,
    currentProfile,
    isLoading: isLoading || !isInitialized,
    updateProfile,
    recordConversationMistakes,
    markVocabularyKnown,
    addConfidenceArea,
    setCurrentLanguage: setCurrentLanguageCallback,
  };
}

// Helper function to map correction types to grammar categories
function mapCorrectionToCategory(correction: Correction): GrammarCategory {
  const original = correction.original.toLowerCase();
  const explanation = correction.explanation.toLowerCase();
  
  // Simple heuristics for categorization
  if (explanation.includes('tense') || original.match(/\b(is|was|were|been|being|have|has|had|do|does|did)\b/)) {
    return 'verb_tense';
  }
  if (explanation.includes('conjugat') || original.match(/\b(go|goes|went|come|comes|came)\b/)) {
    return 'verb_conjugation';
  }
  if (explanation.includes('article') || original.match(/\b(a|an|the)\b/)) {
    return 'article_usage';
  }
  if (explanation.includes('preposition') || original.match(/\b(in|on|at|to|for|with|by|from|of)\b/)) {
    return 'preposition';
  }
  if (explanation.includes('order') || explanation.includes('word order')) {
    return 'word_order';
  }
  if (explanation.includes('gender') || explanation.includes('masculine') || explanation.includes('feminine')) {
    return 'gender';
  }
  if (explanation.includes('singular') || explanation.includes('plural')) {
    return 'number';
  }
  
  return 'other';
}