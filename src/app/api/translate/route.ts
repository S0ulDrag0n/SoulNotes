import {
  DEFAULT_TRANSLATE_PROMPT,
  LANGUAGE_LABELS,
} from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';
import { loadConfig } from '@/lib/load-config';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  context?: string; // Optional context for more accurate translation
};

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