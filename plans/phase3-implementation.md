# Phase 3 Implementation Specifications: AI Conversation Partner

## Overview

Phase 3 implements the AI Conversation Partner feature:
- Real-time voice conversation with AI
- Scenario-based practice sessions
- Adaptive difficulty and corrections
- Learning profile integration
- TTS audio responses via Speaches

---

## 1. Conversation Types

```typescript
// src/types/conversation.ts

export type ConversationScenario = 
  | 'business_meeting'
  | 'casual_chat'
  | 'technical_discussion'
  | 'travel_restaurant'
  | 'job_interview'
  | 'doctor_appointment'
  | 'shopping'
  | 'custom';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ScenarioConfig {
  id: ConversationScenario;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  suggestedTopics: string[];
  vocabularyFocus: string[];
}

export interface ConversationSession {
  id: string;
  language: string;
  scenario: ConversationScenario;
  difficulty: DifficultyLevel;
  startedAt: Date;
  endedAt: Date | null;
  messages: ConversationMessage[];
  analytics: SessionAnalytics;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  translation?: string;
  timestamp: Date;
  corrections?: Correction[];
  vocabulary?: ExtractedVocabulary[];
  audioUrl?: string;
}

export interface Correction {
  type: 'grammar' | 'vocabulary' | 'pronunciation' | 'style';
  original: string;
  corrected: string;
  explanation: string;
  severity: 'minor' | 'moderate' | 'major';
}

export interface ExtractedVocabulary {
  word: string;
  translation: string;
  context: string;
  isKnown: boolean;
}

export interface SessionAnalytics {
  totalMessages: number;
  userMessages: number;
  averageResponseLength: number;
  correctionsCount: number;
  vocabularyIntroduced: number;
  fluencyScore: number; // 0-100
  grammarAccuracy: number; // 0-100
  vocabularyDiversity: number; // 0-100
}

export interface ConversationState {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentSession: ConversationSession | null;
  error: string | null;
}

// Scenario configurations
export const SCENARIO_CONFIGS: Record<ConversationScenario, ScenarioConfig> = {
  business_meeting: {
    id: 'business_meeting',
    name: 'Business Meeting',
    description: 'Practice professional discussions, presentations, and negotiations',
    icon: '💼',
    systemPrompt: `You are a professional colleague in a business meeting. The user is practicing {language}. 
    Engage in realistic business discussions about projects, deadlines, and decisions.
    Use professional vocabulary and formal register appropriate for business settings.
    Gently correct mistakes and suggest more professional alternatives when appropriate.`,
    suggestedTopics: ['project updates', 'budget discussions', 'deadline negotiations', 'team coordination'],
    vocabularyFocus: ['business', 'finance', 'management', 'communication'],
  },
  casual_chat: {
    id: 'casual_chat',
    name: 'Casual Chat',
    description: 'Everyday conversations, small talk, and social situations',
    icon: '☕',
    systemPrompt: `You are a friendly acquaintance chatting casually. The user is practicing {language}.
    Have natural, relaxed conversations about daily life, hobbies, weather, and common interests.
    Use informal language and colloquialisms appropriate for casual settings.
    Correct mistakes naturally without breaking the flow of conversation.`,
    suggestedTopics: ['weekend plans', 'hobbies', 'weather', 'family', 'entertainment'],
    vocabularyFocus: ['daily life', 'emotions', 'activities', 'social'],
  },
  technical_discussion: {
    id: 'technical_discussion',
    name: 'Technical Discussion',
    description: 'Industry-specific vocabulary and technical concepts',
    icon: '🔧',
    systemPrompt: `You are a technical colleague discussing work-related topics. The user is practicing {language}.
    Engage in detailed technical discussions about software, engineering, or the user's field.
    Use precise technical vocabulary and explain complex concepts when needed.
    Correct technical terminology and help the user express technical ideas clearly.`,
    suggestedTopics: ['software development', 'system architecture', 'debugging', 'best practices'],
    vocabularyFocus: ['technology', 'engineering', 'science', 'methodology'],
  },
  travel_restaurant: {
    id: 'travel_restaurant',
    name: 'Travel & Restaurant',
    description: 'Practical travel scenarios and dining situations',
    icon: '✈️',
    systemPrompt: `You are a local person the user meets while traveling. The user is practicing {language}.
    Help the user navigate travel situations like ordering food, asking directions, booking hotels.
    Use practical, everyday language a traveler would need.
    Correct mistakes and teach useful travel phrases.`,
    suggestedTopics: ['ordering food', 'asking directions', 'hotel check-in', 'shopping'],
    vocabularyFocus: ['travel', 'food', 'directions', 'money', 'accommodation'],
  },
  job_interview: {
    id: 'job_interview',
    name: 'Job Interview',
    description: 'Practice job interviews and professional self-presentation',
    icon: '🎯',
    systemPrompt: `You are an interviewer at a company. The user is practicing {language} for a job interview.
    Ask common interview questions about experience, skills, and career goals.
    Provide feedback on how the user could improve their answers professionally.
    Correct language mistakes and suggest more professional phrasing.`,
    suggestedTopics: ['experience', 'strengths/weaknesses', 'career goals', 'salary negotiation'],
    vocabularyFocus: ['professional', 'career', 'skills', 'achievements'],
  },
  doctor_appointment: {
    id: 'doctor_appointment',
    name: 'Doctor Appointment',
    description: 'Medical conversations and health-related vocabulary',
    icon: '🏥',
    systemPrompt: `You are a healthcare provider. The user is practicing {language} for medical situations.
    Help the user describe symptoms, understand diagnoses, and discuss treatments.
    Use clear, accessible language while introducing medical vocabulary.
    Correct mistakes and help the user communicate health concerns effectively.`,
    suggestedTopics: ['describing symptoms', 'medical history', 'medication', 'follow-up care'],
    vocabularyFocus: ['health', 'body', 'symptoms', 'treatment', 'medicine'],
  },
  shopping: {
    id: 'shopping',
    name: 'Shopping',
    description: 'Retail interactions and purchasing conversations',
    icon: '🛍️',
    systemPrompt: `You are a shop assistant or market vendor. The user is practicing {language} for shopping.
    Help the user ask about products, prices, sizes, and make purchases.
    Use common shopping phrases and negotiate if appropriate.
    Correct mistakes and teach useful shopping vocabulary.`,
    suggestedTopics: ['asking prices', 'trying on clothes', 'returns', 'comparing products'],
    vocabularyFocus: ['shopping', 'money', 'clothing', 'products', 'numbers'],
  },
  custom: {
    id: 'custom',
    name: 'Custom Scenario',
    description: 'Define your own conversation topic',
    icon: '✨',
    systemPrompt: `You are a helpful conversation partner. The user is practicing {language}.
    Adapt to the topic the user wants to discuss.
    Be supportive and provide gentle corrections.
    Help the user improve their language skills naturally.`,
    suggestedTopics: [],
    vocabularyFocus: [],
  },
};

// Difficulty configurations
export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, {
  name: string;
  description: string;
  correctionFrequency: 'high' | 'moderate' | 'low';
  vocabularyLevel: 'basic' | 'intermediate' | 'advanced';
  speechPace: 'slow' | 'normal' | 'natural';
}> = {
  beginner: {
    name: 'Beginner',
    description: 'Simple vocabulary, slow pace, frequent corrections',
    correctionFrequency: 'high',
    vocabularyLevel: 'basic',
    speechPace: 'slow',
  },
  intermediate: {
    name: 'Intermediate',
    description: 'Complex sentences, moderate pace, selective corrections',
    correctionFrequency: 'moderate',
    vocabularyLevel: 'intermediate',
    speechPace: 'normal',
  },
  advanced: {
    name: 'Advanced',
    description: 'Native-level discourse, idioms, minimal corrections',
    correctionFrequency: 'low',
    vocabularyLevel: 'advanced',
    speechPace: 'natural',
  },
};
```

---

## 2. Conversation API Endpoint

```typescript
// src/app/api/conversation/route.ts

import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:10102';
const OLLAMA_MODEL = process.env.OLLAMA_CONVERSATION_MODEL || 'aya-expanse:latest';

interface ConversationRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  language: string;
  scenario: string;
  difficulty: string;
  learningProfile?: {
    grammarWeaknesses: Record<string, number>;
    vocabularyGaps: string[];
    pronunciationIssues: Record<string, number>;
    confidenceAreas: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();
    const { messages, language, scenario, difficulty, learningProfile } = body;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(language, scenario, difficulty, learningProfile);

    // Call Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.message?.content || '';

    // Extract corrections and vocabulary from the response
    const { cleanedContent, corrections, vocabulary } = extractMetadata(assistantMessage);

    return NextResponse.json({
      content: cleanedContent,
      corrections,
      vocabulary,
    });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(
  language: string,
  scenario: string,
  difficulty: string,
  learningProfile?: ConversationRequest['learningProfile']
): string {
  const scenarioConfig = SCENARIO_CONFIGS[scenario as keyof typeof SCENARIO_CONFIGS];
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty as keyof typeof DIFFICULTY_CONFIGS];

  let prompt = scenarioConfig.systemPrompt.replace('{language}', language);

  // Add difficulty instructions
  prompt += `\n\nDifficulty level: ${difficulty}. `;
  prompt += `Use ${difficultyConfig.vocabularyLevel} vocabulary. `;
  prompt += `Provide corrections ${difficultyConfig.correctionFrequency === 'high' ? 'frequently' : difficultyConfig.correctionFrequency === 'moderate' ? 'when significant mistakes occur' : 'only for major errors'}.`;

  // Add learning profile context
  if (learningProfile) {
    const { grammarWeaknesses, vocabularyGaps, confidenceAreas } = learningProfile;

    if (Object.keys(grammarWeaknesses).length > 0) {
      const topWeaknesses = Object.entries(grammarWeaknesses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern]) => pattern);
      prompt += `\n\nThe user struggles with these grammar patterns: ${topWeaknesses.join(', ')}. Help them practice these naturally in conversation.`;
    }

    if (vocabularyGaps.length > 0) {
      prompt += `\n\nThe user has gaps in vocabulary for: ${vocabularyGaps.slice(0, 5).join(', ')}. Introduce related words naturally.`;
    }

    if (confidenceAreas.length > 0) {
      prompt += `\n\nThe user is confident discussing: ${confidenceAreas.join(', ')}. Build on these strengths.`;
    }
  }

  // Add response format instructions
  prompt += `\n\nResponse format:
1. Respond naturally in ${language}.
2. If you need to correct the user, use this format: [CORRECTION: original → corrected (explanation)]
3. If you introduce new vocabulary, use this format: [VOCAB: word - translation]
4. Keep responses conversational and engaging.
5. Ask follow-up questions to continue the conversation.`;

  return prompt;
}

function extractMetadata(content: string): {
  cleanedContent: string;
  corrections: Array<{
    type: 'grammar' | 'vocabulary' | 'pronunciation' | 'style';
    original: string;
    corrected: string;
    explanation: string;
    severity: 'minor' | 'moderate' | 'major';
  }>;
  vocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }>;
} {
  const corrections: Array<typeof corrections extends (infer T)[] ? T : never> = [];
  const vocabulary: Array<typeof vocabulary extends (infer T)[] ? T : never> = [];

  // Extract corrections: [CORRECTION: original → corrected (explanation)]
  const correctionRegex = /\[CORRECTION:\s*([^→]+?)\s*→\s*([^(]+?)\s*\(([^)]+)\)\]/g;
  let match;
  while ((match = correctionRegex.exec(content)) !== null) {
    corrections.push({
      type: 'grammar', // Default to grammar, could be enhanced
      original: match[1].trim(),
      corrected: match[2].trim(),
      explanation: match[3].trim(),
      severity: 'moderate',
    });
  }

  // Extract vocabulary: [VOCAB: word - translation]
  const vocabRegex = /\[VOCAB:\s*([^-]+?)\s*-\s*([^\]]+)\]/g;
  while ((match = vocabRegex.exec(content)) !== null) {
    vocabulary.push({
      word: match[1].trim(),
      translation: match[2].trim(),
      context: '', // Could extract surrounding context
    });
  }

  // Remove metadata markers from content
  const cleanedContent = content
    .replace(correctionRegex, '')
    .replace(vocabRegex, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanedContent, corrections, vocabulary };
}

// Import scenario configs (would be in separate file in production)
const SCENARIO_CONFIGS = {
  business_meeting: {
    systemPrompt: `You are a professional colleague in a business meeting...`,
  },
  // ... other scenarios
} as const;

const DIFFICULTY_CONFIGS = {
  beginner: {
    vocabularyLevel: 'basic',
    correctionFrequency: 'high',
  },
  intermediate: {
    vocabularyLevel: 'intermediate',
    correctionFrequency: 'moderate',
  },
  advanced: {
    vocabularyLevel: 'advanced',
    correctionFrequency: 'low',
  },
} as const;
```

---

## 3. Conversation Hook

```typescript
// src/hooks/useConversation.ts

import { useState, useCallback, useRef } from 'react';
import { useRealtimeTranscription } from './useRealtimeTranscription';
import { useTTS } from './useTTS';
import { useLearningProfile } from './useLearningProfile';
import { useGamification } from './useGamification';
import { useVocabulary } from './useVocabulary';
import type { 
  ConversationSession, 
  ConversationMessage, 
  ConversationScenario, 
  DifficultyLevel 
} from '@/types/conversation';

interface UseConversationReturn {
  // State
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentSession: ConversationSession | null;
  error: string | null;
  
  // Actions
  startSession: (language: string, scenario: ConversationScenario, difficulty: DifficultyLevel) => void;
  endSession: () => Promise<ConversationSession>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  saveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
}

export function useConversation(): UseConversationReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { isRecording, startTranscription, stopTranscription, transcript } = useRealtimeTranscription({
    baseUrl: process.env.NEXT_PUBLIC_SPEACHES_BASE_URL || '',
    model: process.env.NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL || '',
    language: currentSession?.language || 'en',
  });
  
  const { generateAudio, playAudio } = useTTS();
  const { updateProfile, recordConversationMistakes } = useLearningProfile();
  const { addConversationXP } = useGamification();
  const { addItem, currentDeck } = useVocabulary();
  
  const sessionStartTime = useRef<Date | null>(null);
  const messageQueue = useRef<ConversationMessage[]>([]);

  const startSession = useCallback((
    language: string, 
    scenario: ConversationScenario, 
    difficulty: DifficultyLevel
  ) => {
    const session: ConversationSession = {
      id: crypto.randomUUID(),
      language,
      scenario,
      difficulty,
      startedAt: new Date(),
      endedAt: null,
      messages: [],
      analytics: {
        totalMessages: 0,
        userMessages: 0,
        averageResponseLength: 0,
        correctionsCount: 0,
        vocabularyIntroduced: 0,
        fluencyScore: 100,
        grammarAccuracy: 100,
        vocabularyDiversity: 100,
      },
    };
    
    setCurrentSession(session);
    sessionStartTime.current = new Date();
    messageQueue.current = [];
    setError(null);
  }, []);

  const endSession = useCallback(async (): Promise<ConversationSession> => {
    if (!currentSession) {
      throw new Error('No active session');
    }
    
    // Stop any ongoing recording
    if (isRecording) {
      stopTranscription();
    }
    
    // Calculate final analytics
    const endedSession: ConversationSession = {
      ...currentSession,
      endedAt: new Date(),
      messages: messageQueue.current,
      analytics: calculateAnalytics(messageQueue.current),
    };
    
    // Update learning profile
    const corrections = messageQueue.current
      .filter(m => m.role === 'assistant' && m.corrections)
      .flatMap(m => m.corrections || []);
    
    await recordConversationMistakes(corrections, currentSession.language);
    
    // Add XP
    const durationMinutes = Math.round(
      (endedSession.endedAt!.getTime() - endedSession.startedAt.getTime()) / 60000
    );
    await addConversationXP(durationMinutes);
    
    setCurrentSession(null);
    return endedSession;
  }, [currentSession, isRecording, stopTranscription, recordConversationMistakes, addConversationXP]);

  const processUserMessage = useCallback(async (text: string) => {
    if (!currentSession || !text.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    // Add user message
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    messageQueue.current.push(userMessage);
    
    try {
      // Get learning profile for context
      const profile = await updateProfile(currentSession.language);
      
      // Call conversation API
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messageQueue.current.map(m => ({
            role: m.role,
            content: m.content,
          })),
          language: currentSession.language,
          scenario: currentSession.scenario,
          difficulty: currentSession.difficulty,
          learningProfile: profile,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant message
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        corrections: data.corrections,
        vocabulary: data.vocabulary,
        timestamp: new Date(),
      };
      messageQueue.current.push(assistantMessage);
      
      // Generate and play TTS
      setIsSpeaking(true);
      const audio = await generateAudio(data.content, currentSession.language);
      if (audio) {
        playAudio(audio);
      }
      setIsSpeaking(false);
      
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession, generateAudio, playAudio, updateProfile]);

  const startRecording = useCallback(async () => {
    await startTranscription();
  }, [startTranscription]);

  const stopRecording = useCallback(async () => {
    stopTranscription();
    
    // Process the transcript
    if (transcript.trim()) {
      await processUserMessage(transcript);
    }
  }, [stopTranscription, transcript, processUserMessage]);

  const sendMessage = useCallback(async (text: string) => {
    await processUserMessage(text);
  }, [processUserMessage]);

  const saveVocabulary = useCallback(async (
    word: string, 
    translation: string, 
    context: string
  ) => {
    if (!currentDeck) return;
    await addItem(word, translation, context, 'conversation');
  }, [currentDeck, addItem]);

  return {
    isRecording,
    isProcessing,
    isSpeaking,
    currentSession,
    error,
    startSession,
    endSession,
    startRecording,
    stopRecording,
    sendMessage,
    saveVocabulary,
  };
}

function calculateAnalytics(messages: ConversationMessage[]): SessionAnalytics {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  const totalCorrections = assistantMessages.reduce(
    (sum, m) => sum + (m.corrections?.length || 0), 
    0
  );
  
  const totalVocabulary = assistantMessages.reduce(
    (sum, m) => sum + (m.vocabulary?.length || 0), 
    0
  );
  
  const averageLength = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
    : 0;
  
  // Calculate scores (simplified - would be more sophisticated in production)
  const grammarAccuracy = Math.max(0, 100 - (totalCorrections * 5));
  const vocabularyDiversity = Math.min(100, averageLength * 2);
  const fluencyScore = (grammarAccuracy + vocabularyDiversity) / 2;
  
  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    averageResponseLength: Math.round(averageLength),
    correctionsCount: totalCorrections,
    vocabularyIntroduced: totalVocabulary,
    fluencyScore: Math.round(fluencyScore),
    grammarAccuracy: Math.round(grammarAccuracy),
    vocabularyDiversity: Math.round(vocabularyDiversity),
  };
}
```

---

## 4. Learning Profile Hook

```typescript
// src/hooks/useLearningProfile.ts

import { useState, useCallback } from 'react';
import type { Correction } from '@/types/conversation';

interface LearningProfile {
  language: string;
  grammarWeaknesses: Record<string, number>;
  vocabularyGaps: string[];
  pronunciationIssues: Record<string, number>;
  fluencyScore: number;
  confidenceAreas: string[];
  lastUpdated: Date;
}

interface UseLearningProfileReturn {
  profiles: Map<string, LearningProfile>;
  currentProfile: LearningProfile | null;
  isLoading: boolean;
  updateProfile: (language: string) => Promise<LearningProfile>;
  recordConversationMistakes: (corrections: Correction[], language: string) => Promise<void>;
  markVocabularyKnown: (word: string, language: string) => Promise<void>;
  addConfidenceArea: (area: string, language: string) => Promise<void>;
}

const STORAGE_KEY = 'soulnotes-learning-profiles';

export function useLearningProfile(): UseLearningProfileReturn {
  const [profiles, setProfiles] = useState<Map<string, LearningProfile>>(() => {
    if (typeof window === 'undefined') return new Map();
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    return new Map();
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const saveProfiles = useCallback((newProfiles: Map<string, LearningProfile>) => {
    setProfiles(newProfiles);
    const obj = Object.fromEntries(newProfiles);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }, []);

  const getOrCreateProfile = useCallback((language: string): LearningProfile => {
    const existing = profiles.get(language);
    if (existing) return existing;
    
    return {
      language,
      grammarWeaknesses: {},
      vocabularyGaps: [],
      pronunciationIssues: {},
      fluencyScore: 100,
      confidenceAreas: [],
      lastUpdated: new Date(),
    };
  }, [profiles]);

  const updateProfile = useCallback(async (language: string): Promise<LearningProfile> => {
    const profile = getOrCreateProfile(language);
    return profile;
  }, [getOrCreateProfile]);

  const recordConversationMistakes = useCallback(async (
    corrections: Correction[], 
    language: string
  ) => {
    const profile = getOrCreateProfile(language);
    
    // Update grammar weaknesses
    for (const correction of corrections) {
      if (correction.type === 'grammar') {
        const key = correction.original.toLowerCase();
        profile.grammarWeaknesses[key] = (profile.grammarWeaknesses[key] || 0) + 1;
      }
      
      if (correction.type === 'pronunciation') {
        const key = correction.original.toLowerCase();
        profile.pronunciationIssues[key] = (profile.pronunciationIssues[key] || 0) + 1;
      }
    }
    
    // Update fluency score
    const totalMistakes = corrections.length;
    profile.fluencyScore = Math.max(0, profile.fluencyScore - (totalMistakes * 2));
    
    profile.lastUpdated = new Date();
    
    const newProfiles = new Map(profiles);
    newProfiles.set(language, profile);
    saveProfiles(newProfiles);
  }, [profiles, getOrCreateProfile, saveProfiles]);

  const markVocabularyKnown = useCallback(async (word: string, language: string) => {
    const profile = getOrCreateProfile(language);
    
    // Remove from gaps if present
    profile.vocabularyGaps = profile.vocabularyGaps.filter(w => w !== word);
    profile.lastUpdated = new Date();
    
    const newProfiles = new Map(profiles);
    newProfiles.set(language, profile);
    saveProfiles(newProfiles);
  }, [profiles, getOrCreateProfile, saveProfiles]);

  const addConfidenceArea = useCallback(async (area: string, language: string) => {
    const profile = getOrCreateProfile(language);
    
    if (!profile.confidenceAreas.includes(area)) {
      profile.confidenceAreas.push(area);
      profile.lastUpdated = new Date();
      
      const newProfiles = new Map(profiles);
      newProfiles.set(language, profile);
      saveProfiles(newProfiles);
    }
  }, [profiles, getOrCreateProfile, saveProfiles]);

  return {
    profiles,
    currentProfile: null, // Set by conversation hook
    isLoading,
    updateProfile,
    recordConversationMistakes,
    markVocabularyKnown,
    addConfidenceArea,
  };
}
```

---

## 5. Conversation Page

```typescript
// src/app/conversation/page.tsx

'use client';

import { useState } from 'react';
import { PremiumGate } from '@/components/PremiumGate';
import { AppHeader } from '@/components/AppHeader';
import { ConversationPanel } from '@/components/ConversationPanel';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { ConversationSession } from '@/components/ConversationSession';
import { SessionSummary } from '@/components/SessionSummary';
import { useConversation } from '@/hooks/useConversation';
import type { ConversationScenario, DifficultyLevel } from '@/types/conversation';

export default function ConversationPage() {
  const {
    isRecording,
    isProcessing,
    isSpeaking,
    currentSession,
    error,
    startSession,
    endSession,
    startRecording,
    stopRecording,
    sendMessage,
    saveVocabulary,
  } = useConversation();
  
  const [showSummary, setShowSummary] = useState(false);
  const [sessionResult, setSessionResult] = useState<ReturnType<typeof endSession> extends Promise<infer T> ? T : never | null>(null);

  const handleStartSession = (language: string, scenario: ConversationScenario, difficulty: DifficultyLevel) => {
    startSession(language, scenario, difficulty);
  };

  const handleEndSession = async () => {
    try {
      const result = await endSession();
      setSessionResult(result);
      setShowSummary(true);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    setSessionResult(null);
  };

  return (
    <PremiumGate>
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
        <AppHeader />
        
        <main className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
              AI Conversation Partner
            </h1>
            <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
              Practice speaking with an AI that adapts to your level
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          {!currentSession ? (
            <ScenarioSelector onStart={handleStartSession} />
          ) : (
            <ConversationSession
              session={currentSession}
              isRecording={isRecording}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSendMessage={sendMessage}
              onEndSession={handleEndSession}
              onSaveVocabulary={saveVocabulary}
            />
          )}

          {showSummary && sessionResult && (
            <SessionSummary
              session={sessionResult}
              onClose={handleCloseSummary}
            />
          )}
        </main>
      </div>
    </PremiumGate>
  );
}
```

---

## 6. Scenario Selector Component

```typescript
// src/components/ScenarioSelector.tsx

'use client';

import { useState } from 'react';
import { SCENARIO_CONFIGS, DIFFICULTY_CONFIGS, type ConversationScenario, type DifficultyLevel } from '@/types/conversation';

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
  const [language, setLanguage] = useState('en');
  const [scenario, setScenario] = useState<ConversationScenario>('casual_chat');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('intermediate');
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
        <div className="flex gap-3">
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
```

---

## 7. Conversation Session Component

```typescript
// src/components/ConversationSession.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import type { ConversationSession, ConversationMessage } from '@/types/conversation';

interface ConversationSessionProps {
  session: ConversationSession;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onEndSession: () => void;
  onSaveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
}

export function ConversationSession({
  session,
  isRecording,
  isProcessing,
  isSpeaking,
  onStartRecording,
  onStopRecording,
  onSendMessage,
  onEndSession,
  onSaveVocabulary,
}: ConversationSessionProps) {
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages]);

  const handleSendText = () => {
    if (textInput.trim()) {
      onSendMessage(textInput);
      setTextInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Session Info */}
      <div className="flex items-center justify-between rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {session.scenario === 'business_meeting' ? '💼' : 
             session.scenario === 'casual_chat' ? '☕' : 
             session.scenario === 'technical_discussion' ? '🔧' : '✨'}
          </span>
          <div>
            <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
              {session.scenario.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
              {session.language.toUpperCase()} • {session.difficulty}
            </p>
          </div>
        </div>
        <button
          onClick={onEndSession}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          End Session
        </button>
      </div>

      {/* Messages */}
      <div className="h-[400px] overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-[#15120d]/85">
        {session.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-[#8b7a5a] dark:text-[#6b5a3f]">
              Start speaking or type a message to begin the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {session.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onSaveVocabulary={onSaveVocabulary}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {isProcessing && (
          <div className="flex items-center gap-2 text-[#8b7a5a] dark:text-[#6b5a3f]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
        
        {isSpeaking && (
          <div className="flex items-center gap-2 text-[#8b7a5a] dark:text-[#6b5a3f]">
            <span className="text-sm">🔊 Speaking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-3">
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isProcessing || isSpeaking}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            isRecording
              ? 'animate-pulse bg-red-500 text-white'
              : 'bg-[#1f1c16] text-[#f6e9cc] hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>
        
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isProcessing || isSpeaking}
            className="flex-1 rounded-xl border border-[#d7c7a7] bg-white px-4 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
          />
          <button
            onClick={handleSendText}
            disabled={!textInput.trim() || isProcessing || isSpeaking}
            className="rounded-xl bg-[#1f1c16] px-6 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ 
  message, 
  onSaveVocabulary 
}: { 
  message: ConversationMessage;
  onSaveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
}) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
          : 'bg-[#efe0c3] text-[#1f1c16] dark:bg-[#2a2218] dark:text-[#f0e6d5]'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        
        {/* Corrections */}
        {message.corrections && message.corrections.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-black/10 pt-2 dark:border-white/10">
            {message.corrections.map((correction, i) => (
              <div key={i} className="text-xs">
                <span className="line-through opacity-60">{correction.original}</span>
                <span className="mx-1">→</span>
                <span className="font-medium text-green-700 dark:text-green-400">
                  {correction.corrected}
                </span>
                <p className="mt-0.5 opacity-70">{correction.explanation}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Vocabulary */}
        {message.vocabulary && message.vocabulary.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-black/10 pt-2 dark:border-white/10">
            {message.vocabulary.map((vocab, i) => (
              <button
                key={i}
                onClick={() => onSaveVocabulary(vocab.word, vocab.translation, vocab.context)}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
              >
                {vocab.word} - {vocab.translation} +
              </button>
            ))}
          </div>
        )}
        
        <p className="mt-1 text-xs opacity-50">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
```

---

## 8. Session Summary Component

```typescript
// src/components/SessionSummary.tsx

'use client';

import type { ConversationSession } from '@/types/conversation';

interface SessionSummaryProps {
  session: ConversationSession;
  onClose: () => void;
}

export function SessionSummary({ session, onClose }: SessionSummaryProps) {
  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]">
        <h2 className="text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Session Complete! 🎉
        </h2>
        <p className="mt-1 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          Great practice session! Here's how you did:
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {duration}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">Minutes</p>
          </div>

          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {session.analytics.userMessages}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">Messages</p>
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {session.analytics.fluencyScore}%
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">Fluency</p>
          </div>

          <div className="rounded-lg bg-purple-50 p-4 text-center dark:bg-purple-900/20">
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {session.analytics.grammarAccuracy}%
            </p>
            <p className="text-sm text-purple-700 dark:text-purple-300">Grammar</p>
          </div>
        </div>

        {session.analytics.correctionsCount > 0 && (
          <div className="mt-4 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              📝 {session.analytics.correctionsCount} corrections made during this session.
              These have been added to your learning profile for targeted practice.
            </p>
          </div>
        )}

        {session.analytics.vocabularyIntroduced > 0 && (
          <div className="mt-4 rounded-lg bg-teal-50 p-3 dark:bg-teal-900/20">
            <p className="text-sm text-teal-800 dark:text-teal-200">
              📚 {session.analytics.vocabularyIntroduced} new vocabulary words introduced.
              Click any word during conversation to save it to your flashcards.
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
          >
            Start New Session
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Implementation Checklist

### Phase 3A: Types & API (Week 1)
- [ ] Create conversation types (`src/types/conversation.ts`)
- [ ] Create conversation API endpoint (`/api/conversation`)
- [ ] Define scenario configurations
- [ ] Define difficulty configurations
- [ ] Test Ollama integration with Aya model

### Phase 3B: Hooks (Week 1)
- [ ] Create useConversation hook
- [ ] Create useLearningProfile hook
- [ ] Integrate with useRealtimeTranscription
- [ ] Integrate with useTTS
- [ ] Test conversation flow

### Phase 3C: UI Components (Week 2)
- [ ] Create ScenarioSelector component
- [ ] Create ConversationSession component
- [ ] Create MessageBubble component
- [ ] Create SessionSummary component
- [ ] Create conversation page

### Phase 3D: Integration (Week 2)
- [ ] Integrate with vocabulary system
- [ ] Integrate with gamification (XP for conversations)
- [ ] Add vocabulary save functionality
- [ ] Add corrections to learning profile
- [ ] Test full conversation flow

### Phase 3E: Polish (Week 3)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add animations for messages
- [ ] Optimize TTS performance
- [ ] Test all scenarios and difficulties