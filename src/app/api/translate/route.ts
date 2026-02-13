import { Ollama } from 'ollama';

type TranslateRequest = {
  text?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
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

export async function POST(req: Request) {
  const { text, sourceLanguage, targetLanguage } =
    (await req.json()) as TranslateRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  const sourceLabel = resolveLanguageLabel(sourceLanguage);
  const targetLabel = resolveLanguageLabel(targetLanguage);
  const prompt = `Translate the following text from ${sourceLabel} to ${targetLabel}. Only return the translated text.\n\n${text}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ollama = new Ollama({
          host: process.env.OLLAMA_BASE_URL ?? 'http://10.61.46.95:10102',
        });
        const response = await ollama.chat({
          model: process.env.OLLAMA_TRANSLATE_MODEL ?? 'gemma3:12b',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });

        for await (const chunk of response) {
          controller.enqueue(encoder.encode(chunk.message.content));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' }
  });
}