/**
 * Platform Adapter - Detects runtime environment and provides appropriate implementations
 * 
 * This allows the same code to work in both web and desktop (Tauri) environments
 * by detecting capabilities at runtime and selecting the correct implementation.
 */

import {
  ConfigRepository,
  AudioService,
  TranscriptionRepository,
  TranslationRepository,
  SummarizationRepository,
} from '@/types';

import {
  LocalConfigRepository,
  TauriConfigRepository,
  WebSocketTranscriptionRepository,
  HttpTranslationRepository,
  HttpSummarizationRepository,
} from '@/repositories';

import { WebAudioService, TauriAudioService } from '@/services';

/**
 * Platform adapter that provides environment-specific implementations
 */
export interface PlatformAdapter {
  config: ConfigRepository;
  audio: AudioService;
  transcription: TranscriptionRepository;
  translation: TranslationRepository;
  summarization: SummarizationRepository;
  isDesktop: boolean;
}

let adapterInstance: PlatformAdapter | null = null;

/**
 * Detect if running in Tauri desktop environment
 */
function isTauriEnvironment(): boolean {
  // Check for Tauri-specific globals
  if (typeof window !== 'undefined') {
    // @ts-expect-error - Tauri injects these globals
    return typeof window.__TAURI__ !== 'undefined' ||
           // @ts-expect-error - Tauri internal
           typeof window.__TAURI_INTERNALS__ !== 'undefined';
  }
  return false;
}

/**
 * Create platform adapter based on detected environment
 */
function createAdapter(): PlatformAdapter {
  const isDesktop = isTauriEnvironment();

  if (isDesktop) {
    // Desktop (Tauri) environment
    return {
      config: new TauriConfigRepository(),
      audio: new TauriAudioService(),
      // WebSocket transcription works in both environments
      transcription: new WebSocketTranscriptionRepository(),
      translation: new HttpTranslationRepository(),
      summarization: new HttpSummarizationRepository(),
      isDesktop: true,
    };
  } else {
    // Web environment
    return {
      config: new LocalConfigRepository(),
      audio: new WebAudioService(),
      // Try WebSocket for real-time, fallback to HTTP if needed
      transcription: new WebSocketTranscriptionRepository(),
      translation: new HttpTranslationRepository(),
      summarization: new HttpSummarizationRepository(),
      isDesktop: false,
    };
  }
}

/**
 * Get the platform adapter singleton
 */
export function getPlatformAdapter(): PlatformAdapter {
  if (!adapterInstance) {
    adapterInstance = createAdapter();
  }
  return adapterInstance;
}

/**
 * Reset the adapter (useful for testing)
 */
export function resetAdapter(): void {
  adapterInstance = null;
}