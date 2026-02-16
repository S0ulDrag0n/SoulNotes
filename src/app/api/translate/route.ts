import { Ollama } from 'ollama';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
};

type AppConfig = {
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  translate_prompt?: string;
};

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

const resolveLanguageLabel = (code?: string) => {
  if (!code) return 'English';
  return languageLabels[code] ?? code;
};

// Default prompt template
const DEFAULT_TRANSLATE_PROMPT = "Translate the following text from {source_language} to {target_language}. Translate as literally as possible. Preserve wording, order, repetition, fragments, and informal phrasing. Do not paraphrase or smooth the text. Do not add explanations or inferred meaning. Only return the translated text. Use clear paragraph breaks with a blank line between paragraphs.\n\n{text}";

function loadConfig(): AppConfig {
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
  const { text, sourceLanguage, targetLanguage } =
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
  const prompt = promptTemplate
    .replace(/{source_language}/g, sourceLabel)
    .replace(/{target_language}/g, targetLabel)
    .replace(/{text}/g, text);

  const ollamaHeaders: Record<string, string> = {};
  const apiToken = process.env.OLLAMA_API_TOKEN ?? config.ollama_api_token;
  if (apiToken) {
    ollamaHeaders['Authorization'] = `Bearer ${apiToken}`;
  }

  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? config.ollama_base_url ?? 'http://10.61.46.95:10102',
    headers: ollamaHeaders,
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_TRANSLATE_MODEL ?? config.ollama_translate_model ?? 'aya-expanse:latest',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.3,
      num_predict: 2048,
      top_p: 0.9,
      top_k: 50,
    } as any);

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