// ---------------------------------------------------------------------------
// LLM Client - Unified interface for Ollama and OpenAI-compatible endpoints
// ---------------------------------------------------------------------------
// Supports two providers:
// - "ollama": Uses the `ollama` npm package (native Ollama API)
// - "openai-compatible": Uses OpenAI chat completions API (/v1/chat/completions)
//   Compatible with llama.cpp, LM Studio, vLLM, text-generation-webui, etc.
// ---------------------------------------------------------------------------

import { Ollama } from 'ollama';
import {
  DEFAULT_OLLAMA_CONFIG,
  OLLAMA_OPTIONS,
} from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMProvider = 'ollama' | 'openai-compatible';

export interface LLMConfig {
  provider: LLMProvider;

  // Ollama settings
  ollamaBaseUrl: string;
  ollamaApiToken?: string;

  // OpenAI-compatible settings
  openaiCompatibleBaseUrl: string;
  openaiCompatibleApiToken?: string;

  // Model names per function
  translateModel: string;
  summarizeModel: string;
  conversationModel: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  numPredict?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Provider-specific clients
// ---------------------------------------------------------------------------

/**
 * Ollama client using the `ollama` npm package
 */
class OllamaLLMClient {
  private client: Ollama;

  constructor(baseUrl: string, apiToken?: string) {
    const headers: Record<string, string> = {};
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }
    this.client = new Ollama({ host: baseUrl, headers });
  }

  async chat(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const response = await this.client.chat({
      model,
      messages,
      stream: false,
      think: false,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        num_predict: options.numPredict,
      },
    });

    return { content: response.message?.content ?? '' };
  }

  async *chatStream(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): AsyncGenerator<LLMStreamChunk> {
    const response = await this.client.chat({
      model,
      messages,
      stream: true,
      think: false,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        num_predict: options.numPredict,
      },
    });

    for await (const part of response) {
      const content = part?.message?.content ?? '';
      if (content) {
        yield { content, done: false };
      }
    }
    yield { content: '', done: true };
  }
}

/**
 * OpenAI-compatible client for llama.cpp, LM Studio, vLLM, etc.
 * Uses the /v1/chat/completions endpoint.
 */
class OpenAICompatibleLLMClient {
  private baseUrl: string;
  private apiToken?: string;

  constructor(baseUrl: string, apiToken?: string) {
    // Normalize: strip trailing slash, ensure /v1 path
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiToken = apiToken;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  async chat(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.numPredict !== undefined) body.max_tokens = options.numPredict;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    return { content };
  }

  async *chatStream(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): AsyncGenerator<LLMStreamChunk> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.numPredict !== undefined) body.max_tokens = options.numPredict;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            yield { content: delta, done: false };
          }
          // Check for finish_reason
          if (parsed.choices?.[0]?.finish_reason === 'stop') {
            yield { content: '', done: true };
            return;
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }

    yield { content: '', done: true };
  }
}

// ---------------------------------------------------------------------------
// Unified LLM Client
// ---------------------------------------------------------------------------

export class LLMClient {
  private ollamaClient: OllamaLLMClient | null = null;
  private openaiCompatibleClient: OpenAICompatibleLLMClient | null = null;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private getOllamaClient(): OllamaLLMClient {
    if (!this.ollamaClient) {
      this.ollamaClient = new OllamaLLMClient(
        this.config.ollamaBaseUrl,
        this.config.ollamaApiToken,
      );
    }
    return this.ollamaClient;
  }

  private getOpenAICompatibleClient(): OpenAICompatibleLLMClient {
    if (!this.openaiCompatibleClient) {
      this.openaiCompatibleClient = new OpenAICompatibleLLMClient(
        this.config.openaiCompatibleBaseUrl,
        this.config.openaiCompatibleApiToken,
      );
    }
    return this.openaiCompatibleClient;
  }

  /**
   * Send a chat request and get a complete response
   */
  async chat(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'ollama':
        return this.getOllamaClient().chat(model, messages, options);
      case 'openai-compatible':
        return this.getOpenAICompatibleClient().chat(model, messages, options);
      default:
        throw new Error(`Unknown LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Send a chat request and stream the response
   */
  async *chatStream(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions = {},
  ): AsyncGenerator<LLMStreamChunk> {
    switch (this.config.provider) {
      case 'ollama':
        yield* this.getOllamaClient().chatStream(model, messages, options);
        break;
      case 'openai-compatible':
        yield* this.getOpenAICompatibleClient().chatStream(model, messages, options);
        break;
      default:
        throw new Error(`Unknown LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Convenience: translate using the configured translate model
   */
  async translate(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.chat(this.config.translateModel, messages, {
      temperature: OLLAMA_OPTIONS.temperature,
      topP: OLLAMA_OPTIONS.topP,
      numPredict: OLLAMA_OPTIONS.numPredict,
    });
  }

  /**
   * Convenience: translate with streaming
   */
  async *translateStream(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk> {
    yield* this.chatStream(this.config.translateModel, messages, {
      temperature: OLLAMA_OPTIONS.temperature,
      topP: OLLAMA_OPTIONS.topP,
      numPredict: OLLAMA_OPTIONS.numPredict,
    });
  }

  /**
   * Convenience: summarize using the configured summarize model
   */
  async summarize(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.chat(this.config.summarizeModel, messages, {
      temperature: OLLAMA_OPTIONS.temperature,
      topP: OLLAMA_OPTIONS.topP,
      numPredict: OLLAMA_OPTIONS.numPredict,
    });
  }

  /**
   * Convenience: conversation using the configured conversation model
   */
  async converse(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.chat(this.config.conversationModel, messages, {
      temperature: 0.7,
      topP: OLLAMA_OPTIONS.topP,
      numPredict: OLLAMA_OPTIONS.numPredict,
    });
  }
}

// ---------------------------------------------------------------------------
// Config loading helper
// ---------------------------------------------------------------------------

type RawAppConfig = {
  llm_provider?: string;
  ollama_base_url?: string;
  ollama_api_token?: string;
  ollama_translate_model?: string;
  ollama_summarize_model?: string;
  ollama_conversation_model?: string;
  openai_compatible_base_url?: string;
  openai_compatible_api_token?: string;
  openai_compatible_translate_model?: string;
  openai_compatible_summarize_model?: string;
  openai_compatible_conversation_model?: string;
};

/**
 * Build an LLMConfig from raw config + env vars
 * Follows the same precedence: env var > config file > defaults
 */
export function buildLLMConfig(raw: RawAppConfig): LLMConfig {
  const provider: LLMProvider =
    (process.env.LLM_PROVIDER as LLMProvider) ??
    (raw.llm_provider as LLMProvider) ??
    'ollama';

  return {
    provider,

    ollamaBaseUrl:
      process.env.OLLAMA_BASE_URL ??
      raw.ollama_base_url ??
      DEFAULT_OLLAMA_CONFIG.baseUrl,
    ollamaApiToken:
      process.env.OLLAMA_API_TOKEN ??
      raw.ollama_api_token ??
      undefined,

    openaiCompatibleBaseUrl:
      process.env.OPENAI_COMPATIBLE_BASE_URL ??
      raw.openai_compatible_base_url ??
      'http://127.0.0.1:8080',
    openaiCompatibleApiToken:
      process.env.OPENAI_COMPATIBLE_API_TOKEN ??
      raw.openai_compatible_api_token ??
      undefined,

    // Model names depend on which provider is active
    translateModel:
      (provider === 'openai-compatible'
        ? (process.env.OPENAI_COMPATIBLE_TRANSLATE_MODEL ?? raw.openai_compatible_translate_model)
        : (process.env.OLLAMA_TRANSLATE_MODEL ?? raw.ollama_translate_model))
      ?? DEFAULT_OLLAMA_CONFIG.translateModel,

    summarizeModel:
      (provider === 'openai-compatible'
        ? (process.env.OPENAI_COMPATIBLE_SUMMARIZE_MODEL ?? raw.openai_compatible_summarize_model)
        : (process.env.OLLAMA_SUMMARIZE_MODEL ?? raw.ollama_summarize_model))
      ?? DEFAULT_OLLAMA_CONFIG.summarizeModel,

    conversationModel:
      (provider === 'openai-compatible'
        ? (process.env.OPENAI_COMPATIBLE_CONVERSATION_MODEL ?? raw.openai_compatible_conversation_model)
        : (process.env.OLLAMA_CONVERSATION_MODEL ?? raw.ollama_conversation_model))
      ?? DEFAULT_OLLAMA_CONFIG.conversationModel,
  };
}