/**
 * Conversation Store
 * 
 * State for the Conversation page. This is separate from the Transcription
 * page because they are independent modes with different state needs.
 * 
 * Wrapper Pattern: This file exports useConversationState() hook.
 * If we migrate to Redux, only this file changes - components stay the same.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ConversationScenario, DifficultyLevel } from '@/types/conversation';

interface ConversationState {
  // Session state - local to conversation page
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  
  // Session config
  language: string;
  scenario: ConversationScenario;
  difficulty: DifficultyLevel;
  
  // Audio device (desktop only - microphone only for conversation)
  selectedMicDevice: string | null;
  
  // Actions
  setRecording: (recording: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setLanguage: (language: string) => void;
  setScenario: (scenario: ConversationScenario) => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setMicDevice: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,
  language: 'en',
  scenario: 'casual_chat' as ConversationScenario,
  difficulty: 'intermediate' as DifficultyLevel,
  selectedMicDevice: null,
};

// Internal Zustand store - exported for testing
export const useConversationStoreInternal = create<ConversationState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setRecording: (recording) => set(
        { isRecording: recording },
        false,
        'setRecording'
      ),
      
      setProcessing: (processing) => set(
        { isProcessing: processing },
        false,
        'setProcessing'
      ),
      
      setSpeaking: (speaking) => set(
        { isSpeaking: speaking },
        false,
        'setSpeaking'
      ),
      
      setLanguage: (language) => set(
        { language },
        false,
        'setLanguage'
      ),
      
      setScenario: (scenario) => set(
        { scenario },
        false,
        'setScenario'
      ),
      
      setDifficulty: (difficulty) => set(
        { difficulty },
        false,
        'setDifficulty'
      ),
      
      setMicDevice: (id) => set(
        { selectedMicDevice: id },
        false,
        'setMicDevice'
      ),
      
      reset: () => set(
        initialState,
        false,
        'reset'
      ),
    }),
    { name: 'SoulNotes-Conversation' }
  )
);

// ============================================
// PUBLIC API - Wrapper Hook for Future-Proofing
// ============================================

export function useConversationState() {
  const store = useConversationStoreInternal();
  
  return {
    // State
    isRecording: store.isRecording,
    isProcessing: store.isProcessing,
    isSpeaking: store.isSpeaking,
    language: store.language,
    scenario: store.scenario,
    difficulty: store.difficulty,
    selectedMicDevice: store.selectedMicDevice,
    
    // Actions
    setRecording: store.setRecording,
    setProcessing: store.setProcessing,
    setSpeaking: store.setSpeaking,
    setLanguage: store.setLanguage,
    setScenario: store.setScenario,
    setDifficulty: store.setDifficulty,
    setMicDevice: store.setMicDevice,
    reset: store.reset,
  };
}