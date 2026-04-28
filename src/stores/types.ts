/**
 * Shared types for Zustand stores
 */

export type ChineseVariant = 'simplified' | 'traditional';

export interface RealtimeConfig {
  baseUrl: string;
  transcribeModel: string;
  defaultLanguage: string;
}

export interface TranscriptMessage {
  id: string;
  text: string;
  timestamp: Date;
}

// Match the CaptureMode from useAudioDevices hook
export type CaptureMode = 'microphone' | 'system' | 'dual';
export type ActivePanel = 'translation' | 'summary';