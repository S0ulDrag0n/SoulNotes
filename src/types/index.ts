// ============================================================================
// Domain Types - Core business entities (pure data structures)
// ============================================================================

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'zh'
  | 'zh-simplified'
  | 'zh-traditional';

export type ChineseVariant = 'simplified' | 'traditional';

export type CaptureMode = 'mic' | 'system' | 'dual';

export type MessageType = 'transcript' | 'translation';

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  language?: LanguageCode;
  isComplete: boolean;
}

export interface AudioChunk {
  data: Uint8Array;
  sampleRate: number;
  channels: number;
  source: 'mic' | 'system';
}

export interface RecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  captureMode: CaptureMode | null;
  startTime: number | null;
}

// ============================================================================
// Config Types - Application configuration
// ============================================================================

export interface AppConfig {
  // Speaches/Transcription settings
  speachesBaseUrl: string;
  speachesTranscribeModel: string;
  speachesTranscribeLanguage: LanguageCode;

  // Ollama settings
  ollamaBaseUrl: string;
  ollamaApiToken: string | null;
  ollamaTranslateModel: string;
  ollamaSummarizeModel: string;

  // Prompts
  translatePrompt: string | null;
  summarizePrompt: string | null;

  // Audio device settings
  micDevice: string | null;
  systemAudioDevice: string | null;
  captureMode: CaptureMode | null;
}

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
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

// ============================================================================
// Translation Types
// ============================================================================

export interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface TranslationChunk {
  text: string;
  isComplete: boolean;
}

// ============================================================================
// Summarization Types
// ============================================================================

export interface SummarizationRequest {
  text: string;
}

export interface SummarySection {
  title: string;
  items: string[];
}

export interface MeetingSummary {
  title: string;
  actionItems: string[];
  purpose: string;
  keyTakeaways: string[];
  topics: string[];
  nextSteps: string[];
}

// ============================================================================
// Audio Device Types
// ============================================================================

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AudioDeviceList {
  inputs: AudioDevice[];
  outputs: AudioDevice[]; // For system audio capture
}

// ============================================================================
// Repository Interfaces - Abstract data access
// ============================================================================

export interface ConfigRepository {
  get(): Promise<AppConfig>;
  save(config: Partial<AppConfig>): Promise<void>;
  getDefaults(): AppConfig;
}

export interface TranscriptionRepository {
  startStream(language: LanguageCode, onTranscript: (text: string) => void): Promise<void>;
  stopStream(): void;
  transcribeFile(audioBlob: Blob): Promise<string>;
}

export interface TranslationRepository {
  translateStream(
    request: TranslationRequest,
    onChunk: (chunk: TranslationChunk) => void
  ): Promise<void>;
}

export interface SummarizationRepository {
  summarize(text: string): Promise<string>;
}

export interface AudioDeviceRepository {
  getInputDevices(): Promise<AudioDevice[]>;
  getOutputDevices(): Promise<AudioDevice[]>; // For system audio
}

// ============================================================================
// Service Interfaces - Business logic abstraction
// ============================================================================

export interface AudioService {
  startRecording(mode: CaptureMode, devices?: { mic?: string; system?: string }): Promise<void>;
  stopRecording(): Promise<void>;
  onAudioChunk(callback: (chunk: AudioChunk) => void): () => void;
  isRecording(): boolean;
}

export interface TranslationService {
  translate(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    onProgress: (translated: string, isComplete: boolean) => void
  ): Promise<void>;
  cancel(): void;
}

export interface MessageService {
  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message;
  updateMessage(id: string, updates: Partial<Message>): void;
  getMessages(): Message[];
  clearMessages(): void;
  onMessagesChange(callback: (messages: Message[]) => void): () => void;
}

// ============================================================================
// Platform Adapter Interface - Web vs Desktop abstraction
// ============================================================================

export interface PlatformAdapter {
  // Config
  config: ConfigRepository;

  // Audio
  audio: AudioService;

  // AI Services
  transcription: TranscriptionRepository;
  translation: TranslationRepository;
  summarization: SummarizationRepository;

  // Devices
  devices: AudioDeviceRepository;

  // Platform detection
  isDesktop(): boolean;
}