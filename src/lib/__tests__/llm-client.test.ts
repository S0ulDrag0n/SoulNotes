// Tests for LLM Client
// Vitest globals are available (configured in vitest.config.ts with globals: true)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMClient, buildLLMConfig, type LLMConfig, type LLMProvider } from '../llm-client'
import { DEFAULT_OLLAMA_CONFIG, DEFAULT_OPENAI_COMPATIBLE_CONFIG } from '../constants'

// ---------------------------------------------------------------------------
// buildLLMConfig
// ---------------------------------------------------------------------------

describe('buildLLMConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset env vars before each test
    vi.resetModules()
    process.env = { ...originalEnv }
    // Remove any LLM-related env vars that might interfere
    delete process.env.LLM_PROVIDER
    delete process.env.OLLAMA_BASE_URL
    delete process.env.OLLAMA_API_TOKEN
    delete process.env.OLLAMA_TRANSLATE_MODEL
    delete process.env.OLLAMA_SUMMARIZE_MODEL
    delete process.env.OLLAMA_CONVERSATION_MODEL
    delete process.env.OPENAI_COMPATIBLE_BASE_URL
    delete process.env.OPENAI_COMPATIBLE_API_TOKEN
    delete process.env.OPENAI_COMPATIBLE_TRANSLATE_MODEL
    delete process.env.OPENAI_COMPATIBLE_SUMMARIZE_MODEL
    delete process.env.OPENAI_COMPATIBLE_CONVERSATION_MODEL
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('should use defaults when no config or env vars provided', () => {
    const config = buildLLMConfig({})
    expect(config.provider).toBe('ollama')
    expect(config.ollamaBaseUrl).toBe(DEFAULT_OLLAMA_CONFIG.baseUrl)
    expect(config.translateModel).toBe(DEFAULT_OLLAMA_CONFIG.translateModel)
    expect(config.summarizeModel).toBe(DEFAULT_OLLAMA_CONFIG.summarizeModel)
    expect(config.conversationModel).toBe(DEFAULT_OLLAMA_CONFIG.conversationModel)
  })

  it('should use env vars over config file values', () => {
    process.env.LLM_PROVIDER = 'openai-compatible'
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'http://my-llm:1234'
    process.env.OPENAI_COMPATIBLE_API_TOKEN = 'test-token'
    process.env.OPENAI_COMPATIBLE_TRANSLATE_MODEL = 'my-translate-model'

    const config = buildLLMConfig({
      openai_compatible_base_url: 'http://from-config:5678',
    })

    // Env var takes precedence
    expect(config.provider).toBe('openai-compatible')
    expect(config.openaiCompatibleBaseUrl).toBe('http://my-llm:1234')
    expect(config.openaiCompatibleApiToken).toBe('test-token')
    expect(config.translateModel).toBe('my-translate-model')
  })

  it('should use config file values when no env vars set', () => {
    const config = buildLLMConfig({
      llm_provider: 'openai-compatible',
      openai_compatible_base_url: 'http://from-config:5678',
      openai_compatible_api_token: 'config-token',
      openai_compatible_translate_model: 'config-translate',
    })

    expect(config.provider).toBe('openai-compatible')
    expect(config.openaiCompatibleBaseUrl).toBe('http://from-config:5678')
    expect(config.openaiCompatibleApiToken).toBe('config-token')
    expect(config.translateModel).toBe('config-translate')
  })

  it('should select OC model names when provider is openai-compatible', () => {
    const config = buildLLMConfig({
      llm_provider: 'openai-compatible',
      ollama_translate_model: 'ollama-model',
      openai_compatible_translate_model: 'oc-model',
    })

    expect(config.provider).toBe('openai-compatible')
    expect(config.translateModel).toBe('oc-model')
  })

  it('should select Ollama model names when provider is ollama', () => {
    const config = buildLLMConfig({
      llm_provider: 'ollama',
      ollama_translate_model: 'ollama-model',
      openai_compatible_translate_model: 'oc-model',
    })

    expect(config.provider).toBe('ollama')
    expect(config.translateModel).toBe('ollama-model')
  })

  it('should fall back to defaults when model name is not set for active provider', () => {
    const config = buildLLMConfig({
      llm_provider: 'openai-compatible',
      // No OC model names set
    })

    // Should fall back to Ollama defaults as last resort
    expect(config.translateModel).toBe(DEFAULT_OLLAMA_CONFIG.translateModel)
    expect(config.summarizeModel).toBe(DEFAULT_OLLAMA_CONFIG.summarizeModel)
    expect(config.conversationModel).toBe(DEFAULT_OLLAMA_CONFIG.conversationModel)
  })

  it('should fall back to OC default base URL when not configured', () => {
    const config = buildLLMConfig({
      llm_provider: 'openai-compatible',
    })

    expect(config.openaiCompatibleBaseUrl).toBe(DEFAULT_OPENAI_COMPATIBLE_CONFIG.baseUrl)
  })
})

// ---------------------------------------------------------------------------
// OpenAICompatibleLLMClient URL normalization
// ---------------------------------------------------------------------------

describe('OpenAICompatibleLLMClient URL normalization', () => {
  // We test this by creating an LLMClient and checking chat URL construction
  // Since the baseUrl is private, we test it indirectly through the chat method

  it('should strip trailing slash from base URL', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080/',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    // Mock fetch to capture the URL
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'test' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.any(Object)
    )
  })

  it('should strip /v1 suffix to prevent double /v1/v1', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080/v1',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'test' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.any(Object)
    )
  })

  it('should handle base URL without /v1', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'test' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.any(Object)
    )
  })

  it('should handle base URL with /v1 and trailing slash', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080/v1/',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'test' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.any(Object)
    )
  })
})

// ---------------------------------------------------------------------------
// LLMClient - convenience methods
// ---------------------------------------------------------------------------

describe('LLMClient convenience methods', () => {
  it('should throw error when translate model is empty', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: '', // empty
      summarizeModel: 'sum-model',
      conversationModel: 'conv-model',
    }
    const client = new LLMClient(config)

    await expect(client.translate([{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('No translate model configured')
  })

  it('should throw error when summarize model is empty', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'trans-model',
      summarizeModel: '', // empty
      conversationModel: 'conv-model',
    }
    const client = new LLMClient(config)

    await expect(client.summarize([{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('No summarize model configured')
  })

  it('should throw error when conversation model is empty', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'trans-model',
      summarizeModel: 'sum-model',
      conversationModel: '', // empty
    }
    const client = new LLMClient(config)

    await expect(client.converse([{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('No conversation model configured')
  })
})

// ---------------------------------------------------------------------------
// LLMClient - provider routing
// ---------------------------------------------------------------------------

describe('LLMClient provider routing', () => {
  it('should throw error for unknown provider', async () => {
    const config = {
      provider: 'unknown' as LLMProvider,
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test',
      summarizeModel: 'test',
      conversationModel: 'test',
    }
    const client = new LLMClient(config)

    await expect(client.chat('test', [{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('Unknown LLM provider')
  })

  it('should route to OpenAI-compatible when provider is set', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    // Should have called fetch (OpenAI-compatible path), not Ollama
    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/v1/chat/completions')
  })
})

// ---------------------------------------------------------------------------
// OpenAICompatibleLLMClient - auth header
// ---------------------------------------------------------------------------

describe('OpenAICompatibleLLMClient auth header', () => {
  it('should include Authorization header when API token is set', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      openaiCompatibleApiToken: 'my-secret-token',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('test-model')
    expect(callArgs[1].headers.Authorization).toBe('Bearer my-secret-token')
  })

  it('should not include Authorization header when no API token', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      // No API token
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].headers.Authorization).toBeUndefined()
  })

  it('should pass optional parameters to OpenAI-compatible API', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }], {
      temperature: 0.7,
      topP: 0.9,
      numPredict: 100,
    })

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.temperature).toBe(0.7)
    expect(body.top_p).toBe(0.9)
    expect(body.max_tokens).toBe(100)
    expect(body.stream).toBe(false)
  })

  it('should not include optional parameters when undefined', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await client.chat('test-model', [{ role: 'user', content: 'hello' }])

    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.temperature).toBeUndefined()
    expect(body.top_p).toBeUndefined()
    expect(body.max_tokens).toBeUndefined()
  })

  it('should throw descriptive error on API failure', async () => {
    const config: LLMConfig = {
      provider: 'openai-compatible',
      ollamaBaseUrl: 'http://localhost:11434',
      openaiCompatibleBaseUrl: 'http://localhost:8080',
      translateModel: 'test-model',
      summarizeModel: 'test-model',
      conversationModel: 'test-model',
    }
    const client = new LLMClient(config)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(client.chat('test-model', [{ role: 'user', content: 'hello' }]))
      .rejects.toThrow('OpenAI-compatible API error (401)')
  })
})