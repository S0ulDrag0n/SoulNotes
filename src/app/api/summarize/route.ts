import { Ollama } from 'ollama';

type SummarizeRequest = {
  text?: string;
};

export async function POST(req: Request) {
  const { text } = (await req.json()) as SummarizeRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  const prompt = `Summarize the following content using Markdown and the exact format and headings below.
Use concise, factual language. Do not add explanations. Do not include any placeholders like [Meeting Title]. If a field is unknown, omit that line entirely.
Preserve section spacing with a blank line between sections. Use the following format:

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

CONTENT:
${text}`;

  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? 'http://10.61.46.95:10102',
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_SUMMARIZE_MODEL ?? 'gemma3:12b',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    return new Response(response.message.content ?? '', {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err) {
    return new Response('Summarization failed', { status: 500 });
  }
}