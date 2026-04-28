import { vi } from 'vitest'

// Mock invoke function
export const mockInvoke = vi.fn()

// Mock listen function
export const mockListen = vi.fn(() => Promise.resolve(vi.fn()))

// Mock save dialog
export const mockSave = vi.fn()

// Mock writeTextFile
export const mockWriteTextFile = vi.fn()

// Setup default mock implementations
export function setupTauriMocks() {
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
  }))

  vi.mock('@tauri-apps/api/event', () => ({
    listen: mockListen,
  }))

  vi.mock('@tauri-apps/plugin-dialog', () => ({
    save: mockSave,
  }))

  vi.mock('@tauri-apps/plugin-fs', () => ({
    writeTextFile: mockWriteTextFile,
  }))
}

// Helper to reset all mocks between tests
export function resetTauriMocks() {
  mockInvoke.mockReset()
  mockListen.mockReset()
  mockSave.mockReset()
  mockWriteTextFile.mockReset()
}

// Helper to create mock event listener
export function createMockEventListener<T = unknown>() {
  const listeners: Array<(event: { payload: T }) => void> = []
  
  return {
    listen: vi.fn((event: string, callback: (event: { payload: T }) => void) => {
      listeners.push(callback)
      return Promise.resolve(() => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      })
    }),
    emit: (payload: T) => {
      listeners.forEach((listener) => listener({ payload }))
    },
    clearListeners: () => listeners.length = 0,
  }
}

// Default mock implementations for common Tauri commands
export const defaultTauriResponses = {
  get_audio_devices: [['device-1', 'Microphone 1'], ['device-2', 'Microphone 2']] as [string, string][],
  get_system_audio_devices: [['speaker-1', 'Speakers']] as [string, string][],
  get_config: {
    speaches_base_url: 'http://localhost:10300',
    ollama_base_url: 'http://localhost:10102',
  },
  translate_text: 'Translated text result',
  summarize_text: 'Summary result',
}