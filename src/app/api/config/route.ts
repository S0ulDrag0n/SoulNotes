export const runtime = 'nodejs';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_REALTIME_CONFIG,
  DEFAULT_OLLAMA_CONFIG,
  DEFAULT_LANGUAGE_SETTINGS,
  DEFAULT_TRANSLATE_PROMPT,
  DEFAULT_SUMMARIZE_PROMPT,
  CONFIG_PATHS,
} from '@/lib/constants';

interface AppConfig {
  speaches_base_url?: string;
  speaches_transcribe_model?: string;
  speaches_transcribe_language?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  ollama_summarize_model?: string;
  translate_prompt?: string;
  summarize_prompt?: string;
}

function loadConfig(): AppConfig {
  // Try to load config.yml from various locations
  const configPaths = [
    // Current working directory (for Docker mounts)
    join(process.cwd(), CONFIG_PATHS.primary),
    // Config subdirectory
    join(process.cwd(), CONFIG_PATHS.secondary),
    // Data directory (common in containerized apps)
    CONFIG_PATHS.docker,
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        // Parse YAML manually (simple key-value pairs)
        const config: AppConfig = {};
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
          if (value === 'null' || value === '~') {
            continue;
          }
          
          // Map YAML keys to config keys
          const keyMapping: Record<string, keyof AppConfig> = {
            'speaches_base_url': 'speaches_base_url',
            'speaches_transcribe_model': 'speaches_transcribe_model',
            'speaches_transcribe_language': 'speaches_transcribe_language',
            'ollama_base_url': 'ollama_base_url',
            'ollama_api_token': 'ollama_api_token',
            'ollama_translate_model': 'ollama_translate_model',
            'ollama_summarize_model': 'ollama_summarize_model',
            'translate_prompt': 'translate_prompt',
            'summarize_prompt': 'summarize_prompt',
          };
          
          const mappedKey = keyMapping[key];
          if (mappedKey) {
            // Handle multi-line prompts (detect if next lines are indented)
            if (key === 'translate_prompt' || key === 'summarize_prompt') {
              // For now, just use the single-line value
              // Multi-line YAML would need more complex parsing
              if (value.startsWith('|')) {
                // Multi-line literal block - need to find the actual content
                // This is a simplified version
                continue;
              }
            }
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

export async function GET() {
  const fileConfig = loadConfig();
  
  return Response.json({
    // Speaches config - env vars take precedence, then config file, then defaults
    speachesBaseUrl: process.env.SPEACHES_BASE_URL ?? fileConfig.speaches_base_url ?? DEFAULT_REALTIME_CONFIG.baseUrl,
    speachesTranscribeModel: process.env.SPEACHES_TRANSCRIBE_MODEL ?? fileConfig.speaches_transcribe_model ?? DEFAULT_REALTIME_CONFIG.transcribeModel,
    speachesTranscribeLanguage: process.env.SPEACHES_TRANSCRIBE_LANGUAGE ?? fileConfig.speaches_transcribe_language ?? DEFAULT_LANGUAGE_SETTINGS.realtime,
    
    // Ollama config
    // Note: ollamaApiToken is NOT exposed to the client for security reasons
    // It's only used server-side for API calls
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? fileConfig.ollama_base_url ?? DEFAULT_OLLAMA_CONFIG.baseUrl,
    ollamaTranslateModel: process.env.OLLAMA_TRANSLATE_MODEL ?? fileConfig.ollama_translate_model ?? DEFAULT_OLLAMA_CONFIG.translateModel,
    ollamaSummarizeModel: process.env.OLLAMA_SUMMARIZE_MODEL ?? fileConfig.ollama_summarize_model ?? DEFAULT_OLLAMA_CONFIG.summarizeModel,
    
    // Prompts - can be overridden via config file
    translatePrompt: fileConfig.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT,
    summarizePrompt: fileConfig.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT,
  });
}