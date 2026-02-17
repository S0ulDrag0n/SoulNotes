export const runtime = 'nodejs';

import { loadConfig, DEFAULT_TRANSLATE_PROMPT, DEFAULT_SUMMARIZE_PROMPT } from '@/utils/configLoader';

export async function GET() {
  const fileConfig = loadConfig();
  
  return Response.json({
    // Speaches config - env vars take precedence, then config file, then defaults
    speachesBaseUrl: process.env.SPEACHES_BASE_URL ?? fileConfig.speaches_base_url ?? 'http://10.61.46.95:10300',
    speachesTranscribeModel: process.env.SPEACHES_TRANSCRIBE_MODEL ?? fileConfig.speaches_transcribe_model ?? 'Systran/faster-whisper-large-v3',
    speachesTranscribeLanguage: process.env.SPEACHES_TRANSCRIBE_LANGUAGE ?? fileConfig.speaches_transcribe_language ?? 'zh',
    
    // Ollama config
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? fileConfig.ollama_base_url ?? 'http://10.61.46.95:10102',
    ollamaApiToken: process.env.OLLAMA_API_TOKEN ?? fileConfig.ollama_api_token ?? null,
    ollamaTranslateModel: process.env.OLLAMA_TRANSLATE_MODEL ?? fileConfig.ollama_translate_model ?? 'aya-expanse:latest',
    ollamaSummarizeModel: process.env.OLLAMA_SUMMARIZE_MODEL ?? fileConfig.ollama_summarize_model ?? 'phi4:latest',
    
    // Prompts - can be overridden via config file
    translatePrompt: fileConfig.translate_prompt ?? DEFAULT_TRANSLATE_PROMPT,
    summarizePrompt: fileConfig.summarize_prompt ?? DEFAULT_SUMMARIZE_PROMPT,
  });
}
