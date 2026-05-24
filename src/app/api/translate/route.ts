import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_OLLAMA_CONFIG,
  DEFAULT_TRANSLATE_PROMPT,
  LANGUAGE_LABELS,
  CONFIG_PATHS,
} from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  context?: string; // Optional context for more accurate translation
};

type RawAppConfig = {
  llm_provider?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_translate_model?: string;
  translate_prompt?: string;
};

function loadConfig(): RawAppConfig {
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
          
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          if (value === 'null' || value === '~') continue;
          
          const knownKeys = [
            'llm_provider', 'ollama_base_url', 'ollama_api_token',
            'ollama_translate_model', 'openai_compatible_base_url',
            'openai_compatible_api_token', 'openai_compatible_translate_model',
          ];
          if (knownKeys.includes(key)) {
            (config as Record<string, string>)[key] = value;
          }
          if (key === 'translate_prompt' && !value.startsWith('|')) {
            config.translate_prompt = value;
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

export async function POST(req: Request) {
  const { text, sourceLanguage, targetLanguage, context } =
    (await req.json()) as TranslateRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  // Load config and build LLM client
  const rawConfig = loadConfig();
  const llmConfig = buildLLMConfig(rawConfig);
  const llm = new LLMClient(llmConfig);
  
  const sourceLabel = LANGUAGE_LABELS[sourceLanguage ?? ''] ?? sourceLanguage ?? 'English';
  const targetLabel = LANGUAGE_LABELS[targetLanguage ?? ''] ?? targetLanguage ?? 'English';
  
  // Use configured prompt or default
  const promptTemplate = rawConfig.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT;
  
  // Build prompt with optional context
  let prompt = promptTemplate
    .replace(/{source_language}/g, sourceLabel)
    .replace(/{target_language}/g, targetLabel)
    .replace(/{text}/g, text);
  
  // If context is provided, prepend it to help with accurate translation
  if (context && context.trim()) {
    prompt = `Context: ${context}\n\n${prompt}`;
  }

  try {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of llm.translateStream([{ role: 'user', content: prompt }])) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(chunk.content));
            }
            if (chunk.done) break;
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (err) {
    return new Response('Translation failed', { status: 500 });
  }
}