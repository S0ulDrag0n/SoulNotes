import { Ollama } from 'ollama';

type SummarizeRequest = {
  text?: string;
};

export async function POST(req: Request) {
  const { text } = (await req.json()) as SummarizeRequest;

  if (!text) {
    return new Response('Missing text', { status: 400 });
  }

  const prompt = `SUMMARIZE THE FOLLOWING CONTENT IN EXACTLY THE SAME FORMAT AND STRUCTURE SHOWN BELOW. DO NOT ADD ANY TEXT BEFORE OR AFTER THE SUMMARY.

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
${text}`;

  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? 'http://10.61.46.95:10102',
  });

  try {
    const response = await ollama.chat({
      model: process.env.OLLAMA_SUMMARIZE_MODEL ?? 'gemma3:12b',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      temperature: 0.3,
      num_predict: 2048,
      top_p: 0.9,
      top_k: 50,
    });

    return new Response(response.message.content ?? '', {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err) {
    return new Response('Summarization failed', { status: 500 });
  }
}