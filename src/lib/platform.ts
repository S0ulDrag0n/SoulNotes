// Platform adapter factory - returns the correct implementation based on environment

import { isDesktopMode } from '@/utils/platform';
import type { PlatformAdapter } from './types';

import {
  webTranslationService,
  webSummarizationService,
  webAudioDeviceService,
} from './api';

import {
  tauriTranslationService,
  tauriSummarizationService,
  tauriAudioDeviceService,
} from './tauri';

// ---------------------------------------------------------------------
// Get platform adapter based on environment
// ---------------------------------------------------------------------
export function getPlatformAdapter(): PlatformAdapter {
  const isDesktop = isDesktopMode();

  if (isDesktop) {
    return {
      translation: tauriTranslationService,
      summarization: tauriSummarizationService,
      audioDevices: tauriAudioDeviceService,
      isDesktop: true,
    };
  }

  return {
    translation: webTranslationService,
    summarization: webSummarizationService,
    audioDevices: webAudioDeviceService,
    isDesktop: false,
  };
}

// ---------------------------------------------------------------------
// Singleton instance - use this throughout the app
// ---------------------------------------------------------------------
let platformAdapterInstance: PlatformAdapter | null = null;

export function getPlatform(): PlatformAdapter {
  if (!platformAdapterInstance) {
    platformAdapterInstance = getPlatformAdapter();
  }
  return platformAdapterInstance;
}