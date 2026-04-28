import { vi } from 'vitest'

// Types for mock responses
interface MockFetchOptions {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  delay?: number
}

// Store for mock responses
const mockResponses = new Map<string, {
  response: string | object | (() => Promise<Response>)
  options?: MockFetchOptions
}>()

// Original fetch reference
const originalFetch = globalThis.fetch

/**
 * Mock fetch implementation that returns predefined responses
 */
export function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
  
  for (const [pattern, config] of mockResponses) {
    if (urlStr.includes(pattern)) {
      const { response, options = {} } = config
      
      return Promise.resolve(createMockResponse(response, options, init))
    }
  }
  
  // Fall through to original fetch if no mock matches
  return originalFetch(url, init)
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  data: string | object | (() => Promise<Response>),
  options: MockFetchOptions = {},
  init?: RequestInit
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options
  
  if (typeof data === 'function') {
    return data() as Response
  }
  
  const body = typeof data === 'string' ? data : JSON.stringify(data)
  
  return new Response(body, {
    status,
    statusText,
    headers: {
      'Content-Type': typeof data === 'string' ? 'text/plain' : 'application/json',
      ...headers,
    },
  })
}

/**
 * Create a mock ReadableStream for streaming responses
 */
export function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

/**
 * Create a streaming Response
 */
export function createMockStreamResponse(chunks: string[], options: MockFetchOptions = {}): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options
  
  return new Response(createMockStream(chunks), {
    status,
    statusText,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
  })
}

/**
 * Set up a mock response for a URL pattern
 */
export function setMockResponse(
  pattern: string,
  response: string | object | (() => Promise<Response>),
  options?: MockFetchOptions
): void {
  mockResponses.set(pattern, { response, options })
}

/**
 * Clear all mock responses
 */
export function clearMockResponses(): void {
  mockResponses.clear()
}

/**
 * Enable fetch mocking
 */
export function enableFetchMock(): void {
  globalThis.fetch = mockFetch
}

/**
 * Disable fetch mocking (restore original fetch)
 */
export function disableFetchMock(): void {
  globalThis.fetch = originalFetch
}

/**
 * Helper to create Ollama chat response chunks
 */
export function createOllamaChunks(text: string, chunkSize = 10): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    const content = text.slice(i, i + chunkSize)
    chunks.push(JSON.stringify({
      message: { role: 'assistant', content },
      done: i + chunkSize >= text.length,
    }))
  }
  return chunks
}

/**
 * Helper to create a mock Ollama streaming response
 */
export function mockOllamaStreamResponse(text: string, options: MockFetchOptions = {}): Response {
  const chunks = createOllamaChunks(text)
  return createMockStreamResponse(chunks, options)
}