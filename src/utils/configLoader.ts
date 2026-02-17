/**
 * Config Loader - Server-side configuration loading
 * 
 * Reads config from YAML files and environment variables.
 * Used by Next.js API routes.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AppConfig {
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  ollama_summarize_model?: string;
  translate_prompt?: string;
  summarize_prompt?: string;
  speaches_base_url?: string;
  speaches_transcribe_model?: string;
  speaches_transcribe_language?: string;
}

const languageLabels: Record<string, string> = {
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
  'zh-traditional': 'Traditional Chinese'
};

export function resolveLanguageLabel(code?: string): string {
  if (!code) return 'English';
  return languageLabels[code] ?? code;
}

// Default prompt templates
export const DEFAULT_TRANSLATE_PROMPT = `Translate the following text from {source_language} to {target_language}. Translate as literally as possible. Preserve wording, order, repetition, fragments, and informal phrasing. Do not paraphrase or smooth the text. Do not add explanations or inferred meaning. Only return the translated text. Use clear paragraph breaks with a blank line between paragraphs.

{text}`;

export const DEFAULT_SUMMARIZE_PROMPT = `SUMMARIZE THE FOLLOWING CONTENT IN EXACTLY THE SAME FORMAT AND STRUCTURE SHOWN BELOW. DO NOT ADD ANY TEXT BEFORE OR AFTER THE SUMMARY.

FORMAT (MUST FOLLOW EXACTLY):
# [Meeting Title]

## ACTION ITEMS
- [Action item]

## MEETING SUMMARY
### Meeting Purpose
[Purpose]

### Key Takeaways
- [Takeaway]

### Topics
- [Topic]

### Next Steps
- [Next step]

RULES:
- Use concise, factual language - no fluff or explanations
- Each bullet should be 1-2 sentences with concrete details
- Do not include placeholder text like [Meeting Title] - use actual content
- If a field is unknown, omit that section entirely
- Preserve exact section spacing with blank lines between sections
- Output ONLY the summary in the exact format - no other text

CONTENT:
{text}`;

export function loadConfig(): AppConfig {
  const configPaths = [
    join(process.cwd(), 'config.yml'),
    join(process.cwd(), 'config', 'config.yml'),
    join('/app', 'data', 'config.yml'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config: AppConfig = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex === -1) continue;
          
          const key = trimmed.slice(0, colonIndex).trim();
          let value = trimmed.slice(colonIndex + 1).trim();
          
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (value === 'null' || value === '~') continue;
          
          // Map config keys
          switch (key) {
            case 'ollama_base_url':
              config.ollama_base_url = value;
              break;
            case 'ollama_api_token':
              config.ollama_api_token = value;
              break;
            case 'ollama_translate_model':
              config.ollama_translate_model = value;
              break;
            case 'ollama_summarize_model':
              config.ollama_summarize_model = value;
              break;
            case 'translate_prompt':
              if (!value.startsWith('|')) {
                config.translate_prompt = value;
              }
              break;
            case 'summarize_prompt':
              if (!value.startsWith('|')) {
                config.summarize_prompt = value;
              }
              break;
            case 'speaches_base_url':
              config.speaches_base_url = value;
              break;
            case 'speaches_transcribe_model':
              config.speaches_transcribe_model = value;
              break;
            case 'speaches_transcribe_language':
              config.speaches_transcribe_language = value;
              break;
          }
        }
        
        return config;
      } catch (error) {
        console.error(`Error loading config from ${configPath}:`, error);
      }
    }
  }
  
  return {};
}

/**
 * Get Ollama client configuration
 */
export function getOllamaConfig() {
  const config = loadConfig();
  
  const headers: Record<string, string> = {};
  const apiToken = process.env.OLLAMA_API_TOKEN ?? config.ollama_api_token;
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  return {
    host: process.env.OLLAMA_BASE_URL ?? config.ollama_base_url ?? 'http://10.61.46.95:10102',
    headers,
    translateModel: process.env.OLLAMA_TRANSLATE_MODEL ?? config.ollama_translate_model ?? 'aya-expanse:latest',
    summarizeModel: process.env.OLLAMA_SUMMARIZE_MODEL ?? config.ollama_summarize_model ?? 'phi4:latest',
    translatePrompt: config.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT,
    summarizePrompt: config.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT,
  };
}