'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AppConfig } from '../types';

const DEFAULT_CONFIG: AppConfig = {
  speachesBaseUrl: 'http://10.61.46.95:10300',
  speachesTranscribeModel: 'Systran/faster-whisper-large-v3',
  speachesTranscribeLanguage: 'zh',

  ollamaBaseUrl: 'http://10.61.46.95:10102',
  ollamaApiToken: null,
  ollamaTranslateModel: 'aya-expanse:latest',
  ollamaSummarizeModel: 'phi4:latest',

  translatePrompt: null,
  summarizePrompt: null,

  micDevice: null,
  systemAudioDevice: null,
  captureMode: null,
};

interface UseConfigReturn {
  config: AppConfig;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook for loading application configuration
 */
export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`);
      }

      const data = await response.json();
      setConfig({
        speachesBaseUrl: data.speachesBaseUrl ?? DEFAULT_CONFIG.speachesBaseUrl,
        speachesTranscribeModel: data.speachesTranscribeModel ?? DEFAULT_CONFIG.speachesTranscribeModel,
        speachesTranscribeLanguage: data.speachesTranscribeLanguage ?? DEFAULT_CONFIG.speachesTranscribeLanguage,

        ollamaBaseUrl: data.ollamaBaseUrl ?? DEFAULT_CONFIG.ollamaBaseUrl,
        ollamaApiToken: data.ollamaApiToken ?? DEFAULT_CONFIG.ollamaApiToken,
        ollamaTranslateModel: data.ollamaTranslateModel ?? DEFAULT_CONFIG.ollamaTranslateModel,
        ollamaSummarizeModel: data.ollamaSummarizeModel ?? DEFAULT_CONFIG.ollamaSummarizeModel,

        translatePrompt: data.translatePrompt ?? DEFAULT_CONFIG.translatePrompt,
        summarizePrompt: data.summarizePrompt ?? DEFAULT_CONFIG.summarizePrompt,

        micDevice: data.micDevice ?? DEFAULT_CONFIG.micDevice,
        systemAudioDevice: data.systemAudioDevice ?? DEFAULT_CONFIG.systemAudioDevice,
        captureMode: data.captureMode ?? DEFAULT_CONFIG.captureMode,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      // Keep default config on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    isLoading,
    error,
    reload: loadConfig,
  };
}