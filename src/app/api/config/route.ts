export const runtime = 'nodejs';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// Default prompts
const DEFAULT_TRANSLATE_PROMPT = "Translate the following text from {source_language} to {target_language}. Translate as literally as possible. Preserve wording, order, repetition, fragments, and informal phrasing. Do not paraphrase or smooth the text. Do not add explanations or inferred meaning. Only return the translated text. Use clear paragraph breaks with a blank line between paragraphs.\n\n{text}";

const DEFAULT_SUMMARIZE_PROMPT = `SUMMARIZE THE FOLLOWING CONTENT IN EXACTLY THE SAME FORMAT AND STRUCTURE SHOWN BELOW. DO NOT ADD ANY TEXT BEFORE OR AFTER THE SUMMARY.

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

function loadConfig(): AppConfig {
  // Try to load config.yml from various locations
  const configPaths = [
    // Current working directory (for Docker mounts)
    join(process.cwd(), 'config.yml'),
    // Config subdirectory
    join(process.cwd(), 'config', 'config.yml'),
    // Data directory (common in containerized apps)
    join('/app', 'data', 'config.yml'),
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
    speachesBaseUrl: process.env.SPEACHES_BASE_URL ?? fileConfig.speaches_base_url ?? 'http://10.61.46.95:10300',
    speachesTranscribeModel: process.env.SPEACHES_TRANSCRIBE_MODEL ?? fileConfig.speaches_transcribe_model ?? 'Systran/faster-whisper-large-v3',
    speachesTranscribeLanguage: process.env.SPEACHES_TRANSCRIBE_LANGUAGE ?? fileConfig.speaches_transcribe_language ?? 'zh',
    
    // Ollama config
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? fileConfig.ollama_base_url ?? 'http://10.61.46.95:10102',
    ollamaApiToken: process.env.OLLAMA_API_TOKEN ?? fileConfig.ollama_api_token ?? null,
    ollamaTranslateModel: process.env.OLLAMA_TRANSLATE_MODEL ?? fileConfig.ollama_translate_model ?? 'aya-expanse:latest',
    ollamaSummarizeModel: process.env.OLLAMA_SUMMARIZE_MODEL ?? fileConfig.ollama_summarize_model ?? 'phi4:latest',
    
    // Prompts - can be overridden via config file
    translatePrompt: fileConfig.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT,
    summarizePrompt: fileConfig.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT,
  });
}