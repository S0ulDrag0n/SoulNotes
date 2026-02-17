import { Ollama } from 'ollama';
import {
  getOllamaConfig,
  resolveLanguageLabel,
} from '@/utils/configLoader';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
};

export async function POST(req: Request) {
  const { text, sourceLanguage, targetLanguage } =
    (await req.json()) as TranslateRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  const ollamaConfig = getOllamaConfig();
  
  const sourceLabel = resolveLanguageLabel(sourceLanguage);
  const targetLabel = resolveLanguageLabel(targetLanguage);
  
  // Use configured prompt or default
  const promptTemplate = ollamaConfig.translatePrompt;
  const prompt = promptTemplate
    .replace(/{source_language}/g, sourceLabel)
    .replace(/{target_language}/g, targetLabel)
    .replace(/{text}/g, text);

  const ollama = new Ollama({
    host: ollamaConfig.host,
    headers: ollamaConfig.headers,
  });

  try {
    const response = await ollama.chat({
      model: ollamaConfig.translateModel,
      messages: [{ role: 'user', content: prompt }],
      stream: true as const,
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
  } catch {
    return new Response('Translation failed', { status: 500 });
  }
}
