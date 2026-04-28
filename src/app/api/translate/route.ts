import { Ollama } from 'ollama';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_OLLAMA_CONFIG,
  DEFAULT_TRANSLATE_PROMPT,
  LANGUAGE_LABELS,
  CONFIG_PATHS,
} from '@/lib/constants';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  context?: string; // Optional context for more accurate translation
};

type AppConfig = {
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  translate_prompt?: string;
};

const resolveLanguageLabel = (code?: string) => {
  if (!code) return 'English';
  return LANGUAGE_LABELS[code] ?? code;
};

function loadConfig(): AppConfig {
  const configPaths = [
    join(process.cwd(), CONFIG_PATHS.primary),
    join(process.cwd(), CONFIG_PATHS.secondary),
    CONFIG_PATHS.docker,
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
          
          if (key === 'ollama_base_url') config.ollama_base_url = value;
          if (key === 'ollama_api_token') config.ollama_api_token = value;
          if (key === 'ollama_translate_model') config.ollama_translate_model = value;
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

  // Load config
  const config = loadConfig();
  
  const sourceLabel = resolveLanguageLabel(sourceLanguage);
  const targetLabel = resolveLanguageLabel(targetLanguage);
  
  // Use configured prompt or default
  const promptTemplate = config.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT;
  
  // Build prompt with optional context
  let prompt = promptTemplate
    .replace(/{source_language}/g, sourceLabel)
    .replace(/{target_language}/g, targetLabel)
    .replace(/{text}/g, text);
  
  // If context is provided, prepend it to help with accurate translation
  if (context && context.trim()) {
    prompt = `Context: ${context}\n\n${prompt}`;
  }

  const ollamaHeaders: Record<string, string> = {};
  const apiToken = process.env.OLLAMA_API_TOKEN ?? config.ollama_api_token;
  if (apiToken) {
    ollamaHeaders['Authorization'] = `Bearer ${apiToken}`;
  }

  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? config.ollama_base_url ?? DEFAULT_OLLAMA_CONFIG.baseUrl,
    headers: ollamaHeaders,
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_TRANSLATE_MODEL ?? config.ollama_translate_model ?? DEFAULT_OLLAMA_CONFIG.translateModel,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      think: false,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of response) {
            const chunk = part?.message?.content ?? '';
            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
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