// Test setup file for Vitest
// This file runs before each test file

// Mock Web Audio API
class MockAudioContext {
  sampleRate = 24000
  createMediaStreamSource() {
    return { connect: () => {} }
  }
  createScriptProcessor() {
    return { connect: () => {}, onaudioprocess: null, disconnect: () => {} }
  }
  destination = {}
  close() {}
}

// @ts-expect-error - Mock for testing
globalThis.AudioContext = MockAudioContext

// Mock navigator.mediaDevices
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: () =>
      Promise.resolve({
        getTracks: () => [{ stop: () => {} }],
      }),
    enumerateDevices: () =>
      Promise.resolve([
        { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone' },
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Microphone 1' },
      ]),
  },
  writable: true,
})

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  url: string
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 0)
  }

  send() {}
  close() {
    this.readyState = MockWebSocket.CLOSED
  }
}

// @ts-expect-error - Mock for testing
globalThis.WebSocket = MockWebSocket

// Mock matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})