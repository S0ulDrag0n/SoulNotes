// ---------------------------------------------------------------------------
// Shared config loader for API routes
// ---------------------------------------------------------------------------
// Loads config from config.yml with proper key mapping.
// Env var precedence is handled by buildLLMConfig() in llm-client.ts
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONFIG_PATHS } from './constants';

export type RawAppConfig = {
  llm_provider?: string;
  // Ollama
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  ollama_summarize_model?: string;
  ollama_conversation_model?: string;
  // OpenAI-compatible
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_translate_model?: string;
  openai_compatible_summarize_model?: string;
  openai_compatible_conversation_model?: string;
  // Prompts
  translate_prompt?: string;
  summarize_prompt?: string;
  // Speaches
  speaches_base_url?: string;
  speaches_transcribe_model?: string;
  speaches_transcribe_language?: string;
};

/** All known YAML config keys that map to RawAppConfig fields */
const KNOWN_CONFIG_KEYS: Record<string, keyof RawAppConfig> = {
  'llm_provider': 'llm_provider',
  'ollama_base_url': 'ollama_base_url',
  'ollama_api_token': 'ollama_api_token',
  'ollama_translate_model': 'ollama_translate_model',
  'ollama_summarize_model': 'ollama_summarize_model',
  'ollama_conversation_model': 'ollama_conversation_model',
  'openai_compatible_base_url': 'openai_compatible_base_url',
  'openai_compatible_api_token': 'openai_compatible_api_token',
  'openai_compatible_translate_model': 'openai_compatible_translate_model',
  'openai_compatible_summarize_model': 'openai_compatible_summarize_model',
  'openai_compatible_conversation_model': 'openai_compatible_conversation_model',
  'speaches_base_url': 'speaches_base_url',
  'speaches_transcribe_model': 'speaches_transcribe_model',
  'speaches_transcribe_language': 'speaches_transcribe_language',
};

/**
 * Load config from config.yml (YAML format).
 * Searches CONFIG_PATHS.primary, CONFIG_PATHS.secondary, CONFIG_PATHS.docker.
 * Returns the first found config, or empty object if none found.
 */
export function loadConfig(): RawAppConfig {
  const configPaths = [
    join(process.cwd(), CONFIG_PATHS.primary),
    join(process.cwd(), CONFIG_PATHS.secondary),
    CONFIG_PATHS.docker,
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config: RawAppConfig = {};
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const colonIndex = trimmed.indexOf(':');
          if (colonIndex === -1) continue;

          const key = trimmed.slice(0, colonIndex).trim();
          let value = trimmed.slice(colonIndex + 1).trim();

          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          // Handle null
          if (value === 'null' || value === '~') continue;

          // Multi-line string values (e.g. translate_prompt: |)
          if (key === 'translate_prompt' || key === 'summarize_prompt') {
            if (value.startsWith('|')) continue;
            config[key as keyof RawAppConfig] = value;
            continue;
          }

          const mappedKey = KNOWN_CONFIG_KEYS[key];
          if (mappedKey) {
            config[mappedKey] = value;
          }
        }

        console.log(`Loaded config from: ${configPath}`);
        return config;
      } catch (error) {
        console.error(`Error loading config from ${configPath}:`, error);
      }
    }
  }

  return {};
}