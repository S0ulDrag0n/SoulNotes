import { DEFAULT_SUMMARIZE_PROMPT } from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';
import { loadConfig } from '@/lib/load-config';

type SummarizeRequest = {
  text?: string;
};

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