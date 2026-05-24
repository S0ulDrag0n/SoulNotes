// ---------------------------------------------------------------------------
// Language & Locale Constants
// ---------------------------------------------------------------------------

/** Supported languages for speech recognition and translation */
export const SUPPORTED_LANGUAGES = [
  { code: 'zh', label: 'Chinese', variants: ['simplified', 'traditional'] as const },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ms', label: 'Malay' },
  { code: 'hi', label: 'Hindi' },
] as const;

/** Supported translation target languages with display labels */
export const TRANSLATION_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-simplified', label: 'Chinese (Simplified)' },
  { code: 'zh-traditional', label: 'Chinese (Traditional)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'hi', label: 'Hindi' },
] as const;

/** Chinese script variants */
export const CHINESE_VARIANTS = {
  SIMPLIFIED: 'simplified',
  TRADITIONAL: 'traditional',
} as const;

export type ChineseVariant = typeof CHINESE_VARIANTS[keyof typeof CHINESE_VARIANTS];

/** Default language settings */
export const DEFAULT_LANGUAGE_SETTINGS = {
  realtime: 'zh',
  chineseVariant: CHINESE_VARIANTS.TRADITIONAL as ChineseVariant,
  target: 'en',
} as const;

// ---------------------------------------------------------------------------
// API Configuration Defaults
// ---------------------------------------------------------------------------

/** Default configuration for realtime transcription service */
export const DEFAULT_REALTIME_CONFIG = {
  baseUrl: 'http://127.0.0.1:10300',
  transcribeModel: 'Systran/faster-whisper-large-v3',
  defaultLanguage: 'zh',
} as const;

/** Default TTS configuration */
export const DEFAULT_TTS_CONFIG = {
  model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
} as const;

/** Default configuration for Ollama service */
export const DEFAULT_OLLAMA_CONFIG = {
  baseUrl: 'http://127.0.0.1:10102',
  translateModel: 'qwen3.5:latest',
  summarizeModel: 'qwen3.5:latest',
  conversationModel: 'qwen3.5:latest',
} as const;

/** Default configuration for OpenAI-compatible service (llama.cpp, LM Studio, vLLM, etc.) */
export const DEFAULT_OPENAI_COMPATIBLE_CONFIG = {
  baseUrl: 'http://127.0.0.1:8080',
  translateModel: '',
  summarizeModel: '',
  conversationModel: '',
} as const;

/** Available LLM providers */
export const LLM_PROVIDERS = {
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI Compatible (llama.cpp, LM Studio, vLLM)',
} as const;

export type LLMProviderKey = keyof typeof LLM_PROVIDERS;

/** Ollama API options */
export const OLLAMA_OPTIONS = {
  temperature: 0.3,
  numPredict: 2048,
  topP: 0.9,
  topK: 50,
} as const;

/** API routes */
export const API_ROUTES = {
  config: '/api/config',
  translate: '/api/translate',
  summarize: '/api/summarize',
} as const;

// ---------------------------------------------------------------------------
// Audio Processing Constants
// ---------------------------------------------------------------------------

/** Audio processing defaults */
export const AUDIO_DEFAULTS = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  // Chunk size for streaming (in bytes)
  chunkSize: 4096,
  // Buffer size for Web Audio API
  bufferSize: 4096,
} as const;

/** Realtime transcription audio settings */
export const REALTIME_AUDIO = {
  sampleRate: 24000,
  processorBufferSize: 4096,
} as const;

/** WebSocket connection settings */
export const WEBSOCKET_CONFIG = {
  // Reconnection attempts
  maxRetries: 3,
  // Retry delay in ms
  retryDelay: 1000,
  // Connection timeout in ms
  connectionTimeout: 10000,
  // Ping interval in ms
  pingInterval: 30000,
  // Auto-reset interval in ms (5 minutes) - to release server GPU memory
  autoResetInterval: 5 * 60 * 1000,
} as const;

// ---------------------------------------------------------------------------
// UI Constants
// ---------------------------------------------------------------------------

/** Theme values */
export const THEME = {
  DARK: 'dark',
  LIGHT: 'light',
} as const;

export type ThemeValue = typeof THEME[keyof typeof THEME];

/** Animation durations (ms) */
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

/** Local storage keys */
export const STORAGE_KEYS = {
  audioDeviceId: 'soulnotes-audio-device-id',
  theme: 'theme',
} as const;

// ---------------------------------------------------------------------------
// Text Processing Constants
// ---------------------------------------------------------------------------

/** Text chunking configuration */
export const TEXT_CHUNKING = {
  maxChunkSize: 1000,
  overlap: 100,
} as const;

/** Debounce delays (ms) */
export const DEBOUNCE_DELAY = {
  translation: 300,
  summarization: 500,
} as const;

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

/** Language labels for prompts */
export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  zh: 'Chinese',
  'zh-simplified': 'Simplified Chinese',
  'zh-traditional': 'Traditional Chinese',
} as const;

/** Default translation prompt template */
export const DEFAULT_TRANSLATE_PROMPT =
  `You are a professional translator. Translate the following text from {source_language} to {target_language}.

## TRANSLATION GUIDELINES

### Accuracy
- Translate meaning and intent, not just words
- Preserve the original tone (formal, casual, technical, etc.)
- Maintain speaker attribution if present (e.g., "John:", "Speaker 1:")

### Technical Terms
- Keep domain-specific technical terms in their original form if commonly used
- Provide brief context in parentheses for unfamiliar terms: "term (context)"
- Preserve acronyms unless there's a well-known translation

### Structure
- Maintain original paragraph breaks and formatting
- Preserve bullet points, numbering, and indentation
- Keep timestamps or time references in original format

### Idioms & Cultural Context
- Translate idioms to their closest equivalent in the target language
- If no equivalent exists, provide a literal translation with context
- Preserve cultural references with brief explanation if needed

### Output Format
- Output ONLY the translated text
- Use clear paragraph breaks with blank lines between paragraphs
- Do not add explanations, notes, or commentary

## TEXT TO TRANSLATE:
{text}`;

/** Default summarization prompt template */
export const DEFAULT_SUMMARIZE_PROMPT =
  `Analyze the following transcribed content and create a comprehensive summary. First, identify the content type, then structure your response accordingly.

## CONTENT TYPE DETECTION
Determine if this is:
- MEETING: Multi-party discussion with decisions/action items
- LECTURE: Educational presentation with concepts to learn
- INTERVIEW: Q&A format between parties
- PERSONAL: Single speaker notes, thoughts, or reminders
- DISCUSSION: Multiple viewpoints on topics without formal decisions

## OUTPUT FORMAT

# [Appropriate Title Based on Content]

## CONTENT TYPE: [Detected Type]

## EXECUTIVE SUMMARY
[2-3 sentence overview of the main purpose and outcome]

## KEY INFORMATION

### Main Topics Covered
- [Topic with brief context]

### Important Points
- [Key point with attribution if identifiable]

## ACTION ITEMS & COMMITMENTS
- [ ] [Action item] - [Owner if identifiable] - [Due date if mentioned]
- [ ] [Action item] - [Owner if identifiable] - [Due date if mentioned]

## DECISIONS MADE
- **Decision**: [What was decided]
  - **Context**: [Why this decision was made]
  - **Impact**: [Who/what is affected]

## DEADLINES & TIME REFERENCES
| When | What | Context |
|------|------|---------|
| [Date/Time] | [Event/Deadline] | [Additional context] |

## SPEAKERS & CONTRIBUTIONS
[If multiple speakers identified]
- **[Speaker identifier]**: [Key points they made]

## TECHNICAL TERMS & CONCEPTS
- **[Term]**: [Definition or context from content]

## OPEN QUESTIONS & FOLLOW-UPS
- [ ] [Unresolved question requiring follow-up]
- [ ] [Topic that needs further discussion]

## PROACTIVE RECOMMENDATIONS
Based on the content, consider:
1. [Suggested next step]
2. [Related topic to explore]
3. [Potential risk or opportunity to address]

## TONE & URGENCY
- **Overall Tone**: [Formal/Casual/Technical/Collaborative/etc.]
- **Urgency Level**: [High/Medium/Low] - [Reasoning]
- **Emotional Indicators**: [Any notable emotional context]

---

## RULES:
1. Adapt sections based on content type - omit irrelevant sections
2. Extract ALL dates, times, and deadlines mentioned
3. Preserve speaker attribution when identifiable
4. Capture technical terms with their contextual meaning
5. Be proactive - suggest follow-ups and highlight risks
6. Use concrete, specific language - avoid vague statements
7. If information is unclear, note it rather than guessing
8. Maintain chronological order for events/deadlines
9. Format action items as checkboxes for usability
10. Output ONLY the summary - no meta-commentary

## CONTENT TO ANALYZE:
{text}`;

// ---------------------------------------------------------------------------
// Config File Paths
// ---------------------------------------------------------------------------

/** Configuration file search paths (in order of priority) */
export const CONFIG_PATHS = {
  /** Primary config in project root */
  primary: 'config.yml',
  /** Secondary config in config directory */
  secondary: 'config/config.yml',
  /** Docker/container config path */
  docker: '/app/data/config.yml',
} as const;

// ---------------------------------------------------------------------------
// UI Scroll Settings
// ---------------------------------------------------------------------------

/** UI scroll behavior settings */
export const UI_SCROLL = {
  /** Threshold in pixels for determining if element is near bottom */
  autoScrollThreshold: 48,
} as const;

// ---------------------------------------------------------------------------
// Translation Timing Multipliers
// ---------------------------------------------------------------------------

/** Translation timing multipliers (applied to DEBOUNCE_DELAY values) */
export const TRANSLATION_TIMING = {
  /** Multiplier for max chunk length calculation */
  chunkLengthMultiplier: 6,
  /** Multiplier for idle detection */
  idleMultiplier: 3,
  /** Multiplier for max interval between translations */
  maxIntervalMultiplier: 5,
} as const;

// ---------------------------------------------------------------------------
// Cookie Settings
// ---------------------------------------------------------------------------

/** Cookie configuration settings */
export const COOKIE_SETTINGS = {
  /** Cookie max age in seconds (1 year) */
  maxAge: 31536000,
  /** Cookie path */
  path: '/',
} as const;

// ---------------------------------------------------------------------------
// Realtime Session Defaults
// ---------------------------------------------------------------------------

/** Base instructions for realtime transcription session */
export const REALTIME_SESSION_INSTRUCTIONS =
  `You are an AI transcription assistant. Your role is to accurately capture and transcribe spoken content.

## TRANSCRIPTION GUIDELINES

### Accuracy First
- Capture exactly what is said, including fillers, repetitions, and corrections
- Preserve speaker turns and dialogue flow
- Note non-verbal cues when relevant: [laughter], [pause], [overlap]

### Language Handling
- Auto-detect the primary language being spoken
- Maintain the original language - do not translate unless explicitly requested
- Handle code-switching (language mixing) naturally
- Preserve dialect and accent characteristics in writing style

### Speaker Identification
- Differentiate between speakers when possible: Speaker 1, Speaker 2, etc.
- Note speaker changes with line breaks or labels
- If speakers identify themselves, use their names

### Technical Content
- Preserve technical terms, product names, and proper nouns exactly
- Capture numbers, dates, and measurements accurately
- Note uncertainty with [?] for unclear words

### Formatting
- Use natural paragraph breaks for topic changes
- Preserve the flow and rhythm of speech
- Include timestamps if available in the format [HH:MM:SS]

### Context Awareness
- Learn and remember names, terms, and acronyms introduced early in the session
- Maintain consistency with terminology throughout
- Adapt to the domain (medical, legal, technical, casual) as appropriate

## PERSONALITY
- Be accurate and thorough in transcription
- Do not summarize or interpret during active transcription
- Wait for explicit requests to summarize or translate
- Your knowledge cutoff is 2023-10`;

// ---------------------------------------------------------------------------
// Audio Encoding Constants
// ---------------------------------------------------------------------------

/** Audio encoding settings */
export const AUDIO_ENCODING = {
  /** Chunk size for base64 encoding (32KB) */
  base64ChunkSize: 0x8000,
} as const;

// ---------------------------------------------------------------------------
// VAD (Voice Activity Detection) Constants
// ---------------------------------------------------------------------------

/** VAD configuration for energy-based voice activity detection */
export const VAD_CONFIG = {
  /** Speech detection threshold (0.0-1.0) - higher = less sensitive */
  threshold: 0.5,
  /** Minimum speech duration in ms to trigger speech start */
  minSpeechDurationMs: 250,
  /** Minimum silence duration in ms to trigger speech end */
  minSilenceDurationMs: 100,
  /** VAD model sample rate (Silero requires 8kHz or 16kHz) */
  sampleRate: 16000,
  /** Frame size in samples for VAD processing (512, 768, or 1024 for 16kHz) */
  frameSize: 512,
  /** Pre-buffer duration in ms - audio to keep before speech starts */
  preBufferMs: 200,
} as const;
