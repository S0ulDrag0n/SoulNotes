// Shared interfaces for platform adapters

export interface AudioDevice {
  id: string;
  name: string;
}

export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export type SummarizationOptions = Record<string, never>;

export interface ITranslationService {
  translate(
    text: string,
    options: TranslationOptions,
    onChunk?: (chunk: string) => Promise<void>
  ): Promise<string>;
}

export interface ISummarizationService {
  summarize(text: string, options?: SummarizationOptions): Promise<string>;
}

export interface IAudioDeviceService {
  getAudioDevices(): Promise<AudioDevice[]>;
  getSystemAudioDevices(): Promise<AudioDevice[]>;
  saveDeviceSettings(
    micDevice: string | null,
    systemAudioDevice: string | null,
    captureMode: 'microphone' | 'system' | 'dual'
  ): Promise<void>;
  getConfig(): Promise<{
    mic_device?: string;
    system_audio_device?: string;
    capture_mode?: string;
  }>;
}

export interface PlatformAdapter {
  translation: ITranslationService;
  summarization: ISummarizationService;
  audioDevices: IAudioDeviceService;
  isDesktop: boolean;
}