// Tauri command wrappers for desktop mode

import type {
  ITranslationService,
  ISummarizationService,
  IAudioDeviceService,
  TranslationOptions,
  SummarizationOptions,
  AudioDevice,
} from './types';
import type { LearningProfile } from '@/types/conversation';

// ---------------------------------------------------------------------
// Lazy import Tauri APIs to avoid errors in browser mode
// ---------------------------------------------------------------------
async function getTauri(): Promise<{
  invoke: typeof import('@tauri-apps/api/core').invoke;
  listen: typeof import('@tauri-apps/api/event').listen;
}> {
  const { invoke } = await import('@tauri-apps/api/core');
  const { listen } = await import('@tauri-apps/api/event');
  return { invoke, listen };
}

// ---------------------------------------------------------------------
// File Save Service (Tauri)
// Uses dialog plugin for save dialog and fs plugin for writing files
// ---------------------------------------------------------------------
/**
 * Save content to a file using Tauri's dialog and fs plugins
 * Shows a native save dialog and writes the content to the selected path
 * @returns true if file was saved successfully, false if user cancelled
 */
export async function saveFile(content: string, defaultFilename: string): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');

  // Show save dialog
  const filePath = await save({
    defaultPath: defaultFilename,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  });

  // User cancelled the dialog
  if (!filePath) {
    return false;
  }

  // Write the file
  await writeTextFile(filePath, content);
  return true;
}

// ---------------------------------------------------------------------
// Translation Service (Tauri)
// ---------------------------------------------------------------------
export const tauriTranslationService: ITranslationService = {
  async translate(
    text: string,
    options: TranslationOptions,
    onChunk?: (chunk: string) => Promise<void>
  ): Promise<string> {
    const { invoke, listen } = await getTauri();
    let accumulatedText = '';
    let chunkUnlisten: (() => void) | null = null;
    let completeUnlisten: (() => void) | null = null;

    try {
      if (onChunk) {
        // Set up event listeners for streaming
        chunkUnlisten = await listen<string>('translation-chunk', (event: { payload: string }) => {
          accumulatedText += event.payload;
          onChunk(event.payload);
        });

        completeUnlisten = await listen<string>('translation-complete', () => {
          // Translation complete
        });
      }

      // Call the translate command (it will stream events)
      const result = await invoke<string>('translate_text', {
        text,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      });

      return result || accumulatedText;
    } finally {
      if (chunkUnlisten) chunkUnlisten();
      if (completeUnlisten) completeUnlisten();
    }
  },
};

// ---------------------------------------------------------------------
// Summarization Service (Tauri)
// ---------------------------------------------------------------------
export const tauriSummarizationService: ISummarizationService = {
  async summarize(text: string, _options?: SummarizationOptions): Promise<string> {
    const { invoke } = await getTauri();
    const result = await invoke<string>('summarize_text', { text });
    return result;
  },
};

// ---------------------------------------------------------------------
// Audio Device Service (Tauri)
// ---------------------------------------------------------------------
export const tauriAudioDeviceService: IAudioDeviceService = {
  async getAudioDevices(): Promise<AudioDevice[]> {
    const { invoke } = await getTauri();
    try {
      const devices = await invoke<[string, string][]>('get_audio_devices');
      return devices.map(([id, name]) => ({ id, name }));
    } catch {
      return [];
    }
  },

  async getSystemAudioDevices(): Promise<AudioDevice[]> {
    const { invoke } = await getTauri();
    try {
      const devices = await invoke<[string, string][]>('get_system_audio_devices');
      return devices.map(([id, name]) => ({ id, name }));
    } catch {
      return [];
    }
  },

  async saveDeviceSettings(
    micDevice: string | null,
    systemAudioDevice: string | null,
    captureMode: 'microphone' | 'system' | 'dual'
  ): Promise<void> {
    const { invoke } = await getTauri();
    await invoke('save_device_settings', {
      micDevice,
      systemAudioDevice,
      captureMode,
    });
  },

  async getConfig(): Promise<{
    mic_device?: string;
    system_audio_device?: string;
    capture_mode?: string;
    ollama_base_url?: string;
    ollama_api_token?: string;
    ollama_translate_model?: string;
    ollama_summarize_model?: string;
    ollama_conversation_model?: string;
    speaches_base_url?: string;
    speaches_transcribe_model?: string;
    speaches_transcribe_language?: string;
  }> {
    const { invoke } = await getTauri();
    try {
      return await invoke<{
        mic_device?: string;
        system_audio_device?: string;
        capture_mode?: string;
        ollama_base_url?: string;
        ollama_api_token?: string;
        ollama_translate_model?: string;
        ollama_summarize_model?: string;
        ollama_conversation_model?: string;
        speaches_base_url?: string;
        speaches_transcribe_model?: string;
        speaches_transcribe_language?: string;
      }>('get_config');
    } catch {
      return {};
    }
  },
};

// ---------------------------------------------------------------------
// Conversation Service (Tauri)
// ---------------------------------------------------------------------
export interface TauriConversationMessage {
  role: string;
  content: string;
}

export interface TauriConversationResponse {
  content: string;
  corrections: Array<{
    type: string;
    original: string;
    corrected: string;
    explanation: string;
    severity: string;
  }>;
  vocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }>;
}

export interface TauriLearningProfile {
  grammar_weaknesses: Record<string, number>;
  vocabulary_gaps: string[];
  confidence_areas: string[];
}

export async function tauriConversation(
  messages: TauriConversationMessage[],
  language: string,
  scenario: string,
  difficulty: string,
  learningProfile?: LearningProfile
): Promise<TauriConversationResponse> {
  const { invoke } = await getTauri();
  
  // Convert LearningProfile to Tauri format
  const tauriProfile: TauriLearningProfile | undefined = learningProfile ? {
    grammar_weaknesses: learningProfile.grammarWeaknesses || {},
    vocabulary_gaps: learningProfile.vocabularyGaps || [],
    confidence_areas: learningProfile.confidenceAreas || [],
  } : undefined;
  
  const result = await invoke<TauriConversationResponse>('conversation_text', {
    messages,
    language,
    scenario,
    difficulty,
    learningProfile: tauriProfile,
  });
  
  return result;
}