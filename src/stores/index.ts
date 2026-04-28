/**
 * Store exports
 * 
 * This file exports all Zustand stores with their wrapper hooks.
 * Components should import from this file, not directly from store files.
 * 
 * If we ever migrate to Redux, only the store files need to change,
 * not the components that use these hooks.
 */

// App-wide settings store
export { useAppState, useSourceLanguage, useTargetLanguage, useActivePanel } from './appStore';

// Transcription page store
export { 
  useTranscribeState, 
  useIsRecording, 
  useTranscript 
} from './transcribeStore';

// Conversation page store
export { useConversationState } from './conversationStore';

// Shared types
export type { 
  ChineseVariant, 
  RealtimeConfig, 
  TranscriptMessage, 
  CaptureMode, 
  ActivePanel 
} from './types';