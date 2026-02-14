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
  const prompt = `Translate the following text from ${sourceLabel} to ${targetLabel}. Translate as literally as possible. Preserve wording, order, repetition, fragments, and informal phrasing. Do not paraphrase or smooth the text. Do not add explanations or inferred meaning. Only return the translated text. Use clear paragraph breaks with a blank line between paragraphs.\n\n${text}`;

  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? 'http://10.61.46.95:10102',
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_TRANSLATE_MODEL ?? 'aya-expanse:latest',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
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