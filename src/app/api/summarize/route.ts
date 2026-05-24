import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DEFAULT_SUMMARIZE_PROMPT, CONFIG_PATHS } from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';

type SummarizeRequest = {
  text?: string;
};

type RawAppConfig = {
  llm_provider?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_summarize_model?: string;
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_summarize_model?: string;
  summarize_prompt?: string;
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
            'ollama_summarize_model', 'openai_compatible_base_url',
            'openai_compatible_api_token', 'openai_compatible_summarize_model',
          ];
          if (knownKeys.includes(key)) {
            (config as Record<string, string>)[key] = value;
          }
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

  // Load config and build LLM client
  const rawConfig = loadConfig();
  const llmConfig = buildLLMConfig(rawConfig);
  const llm = new LLMClient(llmConfig);
  
  // Use configured prompt or default
  const promptTemplate = rawConfig.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT;
  const prompt = promptTemplate.replace(/{text}/g, text);

  try {
    const response = await llm.summarize([{ role: 'user', content: prompt }]);
    return new Response(response.content, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err) {
    return new Response('Summarization failed', { status: 500 });
  }
}