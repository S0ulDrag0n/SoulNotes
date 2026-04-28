import { Ollama } from 'ollama';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DEFAULT_OLLAMA_CONFIG, DEFAULT_SUMMARIZE_PROMPT, CONFIG_PATHS } from '@/lib/constants';

type SummarizeRequest = {
  text?: string;
};

type AppConfig = {
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_summarize_model?: string;
  summarize_prompt?: string;
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
          if (key === 'ollama_summarize_model') config.ollama_summarize_model = value;
          if (key === 'summarize_prompt' && !value.startsWith('|')) {
            config.summarize_prompt = value;
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
  const { text } = (await req.json()) as SummarizeRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  // Load config
  const config = loadConfig();
  
  // Use configured prompt or default
  const promptTemplate = config.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT;
  const prompt = promptTemplate.replace(/{text}/g, text);

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
      model: process.env.OLLAMA_SUMMARIZE_MODEL ?? config.ollama_summarize_model ?? DEFAULT_OLLAMA_CONFIG.summarizeModel,
      messages: [{ role: 'user', content: prompt }],
      think: false,
    });
    
    const content = response.message?.content ?? '';
    return new Response(content, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err) {
    return new Response('Summarization failed', { status: 500 });
  }
}