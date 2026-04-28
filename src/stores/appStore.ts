/**
 * App Store
 * 
 * Global application state for settings that span across pages.
 * 
 * IMPORTANT: Language settings are NOT persisted because:
 * - Meetings may use different languages
 * - Learning sessions may use different languages
 * - Users should start fresh each session
 * 
 * Wrapper Pattern: This file exports useAppState() hook.
 * If we migrate to Redux, only this file changes - components stay the same.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChineseVariant, RealtimeConfig, ActivePanel } from './types';
import { DEFAULT_REALTIME_CONFIG, DEFAULT_LANGUAGE_SETTINGS } from '@/lib/constants';

interface AppState {
  // Language settings - NOT persisted (meetings/learning can differ)
  sourceLanguage: string;
  chineseVariant: ChineseVariant;
  targetLanguage: string;
  
  // UI state
  activePanel: ActivePanel;
  
  // Config
  realtimeConfig: RealtimeConfig;
  
  // Actions
  setSourceLanguage: (lang: string, variant?: ChineseVariant) => void;
  setTargetLanguage: (lang: string) => void;
  setActivePanel: (panel: ActivePanel) => void;
  updateRealtimeConfig: (config: Partial<RealtimeConfig>) => void;
  resetToDefaults: () => void;
}

const initialState = {
  sourceLanguage: DEFAULT_LANGUAGE_SETTINGS.realtime,
  chineseVariant: DEFAULT_LANGUAGE_SETTINGS.chineseVariant as ChineseVariant,
  targetLanguage: DEFAULT_LANGUAGE_SETTINGS.target,
  activePanel: 'translation' as ActivePanel,
  realtimeConfig: {
    baseUrl: DEFAULT_REALTIME_CONFIG.baseUrl,
    transcribeModel: DEFAULT_REALTIME_CONFIG.transcribeModel,
    defaultLanguage: DEFAULT_REALTIME_CONFIG.defaultLanguage,
  },
};

// Internal Zustand store - exported for testing only
export const useAppStoreInternal = create<AppState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setSourceLanguage: (lang, variant) => set(
        (state) => ({
          sourceLanguage: lang,
          chineseVariant: variant ?? state.chineseVariant,
        }),
        false,
        'setSourceLanguage'
      ),
      
      setTargetLanguage: (lang) => set(
        { targetLanguage: lang },
        false,
        'setTargetLanguage'
      ),
      
      setActivePanel: (panel) => set(
        { activePanel: panel },
        false,
        'setActivePanel'
      ),
      
      updateRealtimeConfig: (config) => set(
        (state) => ({
          realtimeConfig: { ...state.realtimeConfig, ...config },
        }),
        false,
        'updateRealtimeConfig'
      ),
      
      resetToDefaults: () => set(
        initialState,
        false,
        'resetToDefaults'
      ),
    }),
    { name: 'SoulNotes-App' }
  )
);

// ============================================
// PUBLIC API - Wrapper Hook for Future-Proofing
// ============================================
// This hook wraps the Zustand store. If we ever migrate to Redux,
// only this file needs to change - components stay the same.

export function useAppState() {
  const store = useAppStoreInternal();
  
  return {
    // State
    sourceLanguage: store.sourceLanguage,
    chineseVariant: store.chineseVariant,
    targetLanguage: store.targetLanguage,
    activePanel: store.activePanel,
    realtimeConfig: store.realtimeConfig,
    
    // Actions
    setSourceLanguage: store.setSourceLanguage,
    setTargetLanguage: store.setTargetLanguage,
    setActivePanel: store.setActivePanel,
    updateRealtimeConfig: store.updateRealtimeConfig,
    resetToDefaults: store.resetToDefaults,
  };
}

// Selector hooks for performance optimization
export const useSourceLanguage = () => useAppStoreInternal((s) => s.sourceLanguage);
export const useTargetLanguage = () => useAppStoreInternal((s) => s.targetLanguage);
export const useActivePanel = () => useAppStoreInternal((s) => s.activePanel);