import { Ollama } from 'ollama';
import { getOllamaConfig } from '@/utils/configLoader';

type SummarizeRequest = {
  text?: string;
};

export async function POST(req: Request) {
  const { text } = (await req.json()) as SummarizeRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  const ollamaConfig = getOllamaConfig();
  
  // Use configured prompt or default
  const promptTemplate = ollamaConfig.summarizePrompt;
  const prompt = promptTemplate.replace(/{text}/g, text);

  const ollama = new Ollama({
    host: ollamaConfig.host,
    headers: ollamaConfig.headers,
  });

  try {
    const response = await ollama.chat({
      model: ollamaConfig.summarizeModel,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = (response as { message?: { content?: string } })?.message?.content ?? '';
    return new Response(content, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch {
    return new Response('Summarization failed', { status: 500 });
  }
}
