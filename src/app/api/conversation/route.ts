// src/app/api/conversation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  SCENARIO_CONFIGS,
  DIFFICULTY_CONFIGS,
  type ConversationScenario,
  type DifficultyLevel,
  type Correction,
  type LearningProfile,
} from '@/types/conversation';
import { OLLAMA_OPTIONS, LANGUAGE_LABELS, CONFIG_PATHS } from '@/lib/constants';
import { LLMClient, buildLLMConfig } from '@/lib/llm-client';

interface ConversationRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  language: string;
  scenario: ConversationScenario;
  difficulty: DifficultyLevel;
  learningProfile?: LearningProfile;
}

type RawAppConfig = {
  llm_provider?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_conversation_model?: string;
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_conversation_model?: string;
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
            'ollama_conversation_model', 'openai_compatible_base_url',
            'openai_compatible_api_token', 'openai_compatible_conversation_model',
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

export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();
    const { messages, language, scenario, difficulty, learningProfile } = body;

    // Load config and build LLM client
    const rawConfig = loadConfig();
    const llmConfig = buildLLMConfig(rawConfig);
    const llm = new LLMClient(llmConfig);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(language, scenario, difficulty, learningProfile);

    // Call LLM
    const response = await llm.converse([
      { role: 'system', content: systemPrompt },
      ...messages,
    ]);

    const assistantMessage = response.content;

    // Extract corrections and vocabulary from the response
    const { cleanedContent, corrections, vocabulary } = extractMetadata(assistantMessage);

    return NextResponse.json({
      content: cleanedContent,
      corrections,
      vocabulary,
    });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(
  language: string,
  scenario: ConversationScenario,
  difficulty: DifficultyLevel,
  learningProfile?: LearningProfile
): string {
  const scenarioConfig = SCENARIO_CONFIGS[scenario];
  const difficultyConfig = DIFFICULTY_CONFIGS[difficulty];
  const languageLabel = LANGUAGE_LABELS[language] || language;

  let prompt = scenarioConfig.systemPrompt.replace('{language}', languageLabel);

  // Add difficulty instructions
  prompt += `\n\nDifficulty level: ${difficulty}. `;
  prompt += `Use ${difficultyConfig.vocabularyLevel} vocabulary. `;
  prompt += `Provide corrections ${difficultyConfig.correctionFrequency === 'high' ? 'frequently' : difficultyConfig.correctionFrequency === 'moderate' ? 'when significant mistakes occur' : 'only for major errors'}.`;

  // Add learning profile context
  if (learningProfile) {
    const { grammarWeaknesses, vocabularyGaps, confidenceAreas } = learningProfile;

    if (Object.keys(grammarWeaknesses).length > 0) {
      const topWeaknesses = Object.entries(grammarWeaknesses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern]) => pattern);
      prompt += `\n\nThe user struggles with these grammar patterns: ${topWeaknesses.join(', ')}. Help them practice these naturally in conversation.`;
    }

    if (vocabularyGaps.length > 0) {
      prompt += `\n\nThe user has gaps in vocabulary for: ${vocabularyGaps.slice(0, 5).join(', ')}. Introduce related words naturally.`;
    }

    if (confidenceAreas.length > 0) {
      prompt += `\n\nThe user is confident discussing: ${confidenceAreas.join(', ')}. Build on these strengths.`;
    }
  }

  // Add response format instructions
  prompt += `\n\nResponse format:
1. Respond naturally in ${languageLabel}.
2. If you need to correct the user, use this format: [CORRECTION: original → corrected (explanation)]
3. If you introduce new vocabulary, use this format: [VOCAB: word - translation]
4. Keep responses conversational and engaging.
5. Ask follow-up questions to continue the conversation.`;

  return prompt;
}

function extractMetadata(content: string): {
  cleanedContent: string;
  corrections: Correction[];
  vocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }>;
} {
  const corrections: Correction[] = [];
  const vocabulary: Array<{
    word: string;
    translation: string;
    context: string;
  }> = [];

  // Extract corrections: [CORRECTION: original → corrected (explanation)]
  const correctionRegex = /\[CORRECTION:\s*([^→]+?)\s*→\s*([^(]+?)\s*\(([^)]+)\)\]/g;
  let match;
  while ((match = correctionRegex.exec(content)) !== null) {
    corrections.push({
      type: 'grammar',
      original: match[1].trim(),
      corrected: match[2].trim(),
      explanation: match[3].trim(),
      severity: 'moderate',
    });
  }

  // Extract vocabulary: [VOCAB: word - translation]
  const vocabRegex = /\[VOCAB:\s*([^-]+?)\s*-\s*([^\]]+)\]/g;
  while ((match = vocabRegex.exec(content)) !== null) {
    vocabulary.push({
      word: match[1].trim(),
      translation: match[2].trim(),
      context: '',
    });
  }

  // Remove metadata markers from content
  const cleanedContent = content
    .replace(correctionRegex, '')
    .replace(vocabRegex, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanedContent, corrections, vocabulary };
}