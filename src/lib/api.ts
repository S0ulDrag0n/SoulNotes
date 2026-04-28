// Web API implementations for browser mode

import type {
  ITranslationService,
  ISummarizationService,
  IAudioDeviceService,
  TranslationOptions,
  SummarizationOptions,
  AudioDevice,
} from './types';
import { API_ROUTES } from './constants';

// ---------------------------------------------------------------------
// Helper: Stream text from API
// ---------------------------------------------------------------------
async function streamTextFromApi(
  url: string,
  body: Record<string, string>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error('API request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response stream');
  }

  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      result += chunk;
      onChunk(chunk);
    }
  }

  const tail = decoder.decode();
  if (tail) {
    result += tail;
    onChunk(tail);
  }

  return result;
}

// ---------------------------------------------------------------------
// Translation Service (Web API)
// ---------------------------------------------------------------------
export const webTranslationService: ITranslationService = {
  async translate(
    text: string,
    options: TranslationOptions,
    onChunk?: (chunk: string) => Promise<void>
  ): Promise<string> {
    let accumulatedText = '';

    await streamTextFromApi(
      API_ROUTES.translate,
      {
        text,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      },
      (chunk) => {
        accumulatedText += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }
    );

    return accumulatedText;
  },
};

// ---------------------------------------------------------------------
// Summarization Service (Web API)
// ---------------------------------------------------------------------
export const webSummarizationService: ISummarizationService = {
  async summarize(text: string, _options?: SummarizationOptions): Promise<string> {
    let result = '';

    await streamTextFromApi(
      API_ROUTES.summarize,
      { text },
      (chunk) => {
        result += chunk;
      }
    );

    return result;
  },
};

// ---------------------------------------------------------------------
// Audio Device Service (Web API - not available in browser)
// ---------------------------------------------------------------------
export const webAudioDeviceService: IAudioDeviceService = {
  async getAudioDevices(): Promise<AudioDevice[]> {
    // Use browser's media devices API
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ id: d.deviceId, name: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
    } catch {
      return [];
    }
  },

  async getSystemAudioDevices(): Promise<AudioDevice[]> {
    // System audio capture not available in browser
    return [];
  },

  async saveDeviceSettings(): Promise<void> {
    // No-op in browser mode
  },

  async getConfig(): Promise<{ mic_device?: string; system_audio_device?: string; capture_mode?: string }> {
    return {};
  },
};