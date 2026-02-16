import { Ollama } from 'ollama';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type SummarizeRequest = {
  text?: string;
};

type AppConfig = {
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_summarize_model?: string;
  summarize_prompt?: string;
};

// Default prompt template
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
    host: process.env.OLLAMA_BASE_URL ?? config.ollama_base_url ?? 'http://10.61.46.95:10102',
    headers: ollamaHeaders,
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_SUMMARIZE_MODEL ?? config.ollama_summarize_model ?? 'phi4:latest',
      messages: [{ role: 'user', content: prompt }],
    }) as { message?: { content?: string } };

    const content = response?.message?.content ?? '';
    return new Response(content, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err) {
    return new Response('Summarization failed', { status: 500 });
  }
}