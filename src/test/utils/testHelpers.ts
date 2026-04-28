import { vi } from 'vitest'

/**
 * Wait for all pending promises to resolve
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a mock AbortSignal
 */
export function createMockAbortSignal(aborted = false): AbortSignal {
  return {
    aborted,
    onabort: null,
    reason: undefined,
    throwIfAborted: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as AbortSignal
}

/**
 * Create a mock ReadableStream reader
 */
export function createMockStreamReader(chunks: string[], delay = 0) {
  let index = 0
  
  return {
    read: vi.fn(async () => {
      if (delay > 0) {
        await wait(delay)
      }
      
      if (index >= chunks.length) {
        return { done: true, value: undefined }
      }
      
      const value = new TextEncoder().encode(chunks[index])
      index++
      return { done: false, value }
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  }
}

/**
 * Create a mock Response with a streaming body
 */
export function createMockStreamResponse(chunks: string[], options: ResponseInit = {}) {
  const reader = createMockStreamReader(chunks)
  
  return new Response(
    {
      getReader: () => reader,
    } as unknown as ReadableStream,
    options
  )
}

/**
 * Helper to create a sequence of mock responses
 */
export class MockResponseSequence {
  private responses: Response[] = []
  private index = 0
  
  add(response: Response): this {
    this.responses.push(response)
    return this
  }
  
  addJson(data: unknown, options: ResponseInit = {}): this {
    this.responses.push(new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    }))
    return this
  }
  
  addText(text: string, options: ResponseInit = {}): this {
    this.responses.push(new Response(text, options))
    return this
  }
  
  addError(status: number, message: string): this {
    this.responses.push(new Response(message, { status }))
    return this
  }
  
  next(): Response {
    const response = this.responses[this.index]
    this.index = (this.index + 1) % this.responses.length
    return response
  }
  
  reset(): void {
    this.index = 0
  }
}

/**
 * Helper to track function call order
 */
export class CallTracker {
  private calls: string[] = []
  
  track(name: string): void {
    this.calls.push(name)
  }
  
  getCalls(): string[] {
    return [...this.calls]
  }
  
  reset(): void {
    this.calls = []
  }
}

/**
 * Create a mock MediaStream
 */
export function createMockMediaStream(tracks: MediaStreamTrack[] = []): MediaStream {
  return {
    getTracks: vi.fn(() => tracks),
    getAudioTracks: vi.fn(() => tracks.filter(t => t.kind === 'audio')),
    getVideoTracks: vi.fn(() => tracks.filter(t => t.kind === 'video')),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    id: 'mock-stream-id',
    active: true,
    onaddtrack: null,
    onremovetrack: null,
    onactive: null,
    oninactive: null,
    clone: vi.fn(),
    getTrackById: vi.fn(),
  } as unknown as MediaStream
}

/**
 * Create a mock MediaStreamTrack
 */
export function createMockMediaStreamTrack(kind: 'audio' | 'video' = 'audio'): MediaStreamTrack {
  return {
    kind,
    id: `mock-track-${Date.now()}`,
    label: `Mock ${kind} track`,
    enabled: true,
    muted: false,
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getCapabilities: vi.fn(),
    getConstraints: vi.fn(),
    getSettings: vi.fn(),
    applyConstraints: vi.fn(),
    clone: vi.fn(),
    onended: null,
    onmute: null,
    onunmute: null,
    onoverconstrained: null,
  } as unknown as MediaStreamTrack
}