// src/app/api/meeting-report/route.ts

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DEFAULT_OLLAMA_CONFIG, CONFIG_PATHS } from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';
import { NextResponse } from 'next/server';

interface MeetingReportRequest {
  transcript: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface ExtractedVocabulary {
  word: string;
  translation: string;
  definition: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usefulness: string;
}

interface KeyPhrase {
  phrase: string;
  translation: string;
  usage: string;
}

interface TechnicalTerm {
  term: string;
  definition: string;
  field: string;
}

type RawAppConfig = {
  llm_provider?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_summarize_model?: string;
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_summarize_model?: string;
};

function loadConfig(): RawAppConfig {
  const configPaths = [
    join(process.cwd(), CONFIG_PATHS.primary),
    join(process.cwd(), CONFIG_PATHS.secondary),
    CONFIG_PATHS.docker,
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config: RawAppConfig = {};
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
          
          const knownKeys = [
            'llm_provider', 'ollama_base_url', 'ollama_api_token',
            'ollama_summarize_model', 'openai_compatible_base_url',
            'openai_compatible_api_token', 'openai_compatible_summarize_model',
          ];
          if (knownKeys.includes(key)) {
            (config as Record<string, string>)[key] = value;
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

function calculateWordFrequency(text: string): Record<string, number> {
  const words = text.toLowerCase().split(/\s+/);
  const frequency: Record<string, number> = {};
  
  for (const word of words) {
    const cleaned = word.replace(/[^\w]/g, '');
    if (cleaned.length > 2) {
      frequency[cleaned] = (frequency[cleaned] || 0) + 1;
    }
  }
  
  return frequency;
}

function generateSummary(translation: string): string {
  // Return first 200 chars of translation as summary
  return translation.slice(0, 200) + (translation.length > 200 ? '...' : '');
}

export async function POST(request: Request) {
  try {
    const body: MeetingReportRequest = await request.json();
    const { transcript, translation, sourceLanguage, targetLanguage } = body;

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    // Load config and build LLM client
    const rawConfig = loadConfig();
    const llmConfig = buildLLMConfig(rawConfig);
    const llm = new LLMClient(llmConfig);

    // Extract vocabulary from the meeting
    const vocabularyPrompt = `Analyze the following ${sourceLanguage} text and extract vocabulary words that would be useful for a language learner.

For each word, provide:
1. The word in ${sourceLanguage}
2. Translation in ${targetLanguage}
3. Definition in ${targetLanguage}
4. Difficulty level (beginner/intermediate/advanced)
5. Why this word is useful

Text:
${transcript}

Respond in JSON format:
{
  "vocabulary": [
    {
      "word": "word",
      "translation": "translation",
      "definition": "definition",
      "difficulty": "beginner|intermediate|advanced",
      "usefulness": "why useful"
    }
  ]
}`;

    const vocabResponse = await llm.chat(llmConfig.summarizeModel, [
      { role: 'user', content: vocabularyPrompt },
    ]);

    const vocabData = JSON.parse(vocabResponse.content ?? '{"vocabulary": []}');
    const vocabulary: ExtractedVocabulary[] = vocabData.vocabulary || [];

    // Extract key phrases
    const phrasesPrompt = `Extract key phrases and expressions from the following ${sourceLanguage} text.

For each phrase, provide:
1. The phrase in ${sourceLanguage}
2. Translation in ${targetLanguage}
3. Context/usage notes

Text:
${transcript}

Respond in JSON format:
{
  "phrases": [
    {
      "phrase": "phrase",
      "translation": "translation",
      "usage": "context notes"
    }
  ]
}`;

    const phrasesResponse = await llm.chat(llmConfig.summarizeModel, [
      { role: 'user', content: phrasesPrompt },
    ]);

    const phrasesData = JSON.parse(phrasesResponse.content ?? '{"phrases": []}');
    const phrases: KeyPhrase[] = phrasesData.phrases || [];

    // Extract technical terms
    const termsPrompt = `Identify technical or specialized terms from the following text.

For each term, provide:
1. The term
2. Definition
3. Field/domain (e.g., technology, finance, medicine)

Text:
${transcript}

Respond in JSON format:
{
  "terms": [
    {
      "term": "term",
      "definition": "definition",
      "field": "domain"
    }
  ]
}`;

    const termsResponse = await llm.chat(llmConfig.summarizeModel, [
      { role: 'user', content: termsPrompt },
    ]);

    const termsData = JSON.parse(termsResponse.content ?? '{"terms": []}');
    const terms: TechnicalTerm[] = termsData.terms || [];

    // Calculate word frequency
    const wordFrequency = calculateWordFrequency(transcript);

    return NextResponse.json({
      vocabulary: vocabulary.map((v) => ({
        ...v,
        frequency: wordFrequency[v.word.toLowerCase()] || 1,
        isKnown: false,
        isSaved: false,
      })),
      keyPhrases: phrases,
      technicalTerms: terms,
      summary: generateSummary(translation || transcript),
    });
  } catch (error) {
    console.error('Meeting report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate meeting report' },
      { status: 500 }
    );
  }
}