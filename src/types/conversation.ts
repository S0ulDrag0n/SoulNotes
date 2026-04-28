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

// Learning profile for personalization (API format - simplified)
export interface LearningProfile {
  language: string;
  grammarWeaknesses: Record<string, number>;
  vocabularyGaps: string[];
  pronunciationIssues: Record<string, number>;
  fluencyScore: number;
  confidenceAreas: string[];
  lastUpdated: Date;
}

// Import the comprehensive profile type for conversion
import type { LearningProfile as ComprehensiveLearningProfile } from './learning-profile';

// Convert comprehensive profile to API format
export function toApiLearningProfile(profile: ComprehensiveLearningProfile): LearningProfile {
  return {
    language: profile.language,
    grammarWeaknesses: Object.fromEntries(
      profile.grammarWeaknesses.map(w => [w.pattern, w.errorCount])
    ),
    vocabularyGaps: profile.vocabularyGaps.map(g => g.word),
    pronunciationIssues: Object.fromEntries(
      profile.pronunciationIssues.map(p => [p.sound, p.issueCount])
    ),
    fluencyScore: profile.fluencyScore,
    confidenceAreas: profile.confidenceAreas,
    lastUpdated: profile.updatedAt,
  };
}

// API request/response types
export interface ConversationApiRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  language: string;
  scenario: ConversationScenario;
  difficulty: DifficultyLevel;
  learningProfile?: LearningProfile;
}

export interface ConversationApiResponse {
  content: string;
  corrections: Correction[];
  vocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }>;
}