// Vitest globals are available (configured in vitest.config.ts with globals: true)
import {
  webTranslationService,
  webSummarizationService,
  webAudioDeviceService,
} from '../api'

// Mock fetch globally
const originalFetch = globalThis.fetch

describe('Web API Services', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('webTranslationService', () => {
    describe('translate', () => {
      it('should make POST request to translate endpoint', async () => {
        const mockResponse = 'Translated text'
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockResponse) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            }),
          },
        })

        const result = await webTranslationService.translate(
          'Hello world',
          { sourceLanguage: 'en', targetLanguage: 'es' }
        )

        expect(fetch).toHaveBeenCalledWith('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hello world',
            sourceLanguage: 'en',
            targetLanguage: 'es',
          }),
          signal: undefined,
        })
        expect(result).toBe(mockResponse)
      })

      it('should call onChunk callback for streaming responses', async () => {
        const chunks = ['Hello ', 'world', '!']
        let readIndex = 0
        
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn().mockImplementation(async () => {
                if (readIndex < chunks.length) {
                  return { done: false, value: new TextEncoder().encode(chunks[readIndex++]) }
                }
                return { done: true, value: undefined }
              }),
            }),
          },
        })

        const receivedChunks: string[] = []
        const result = await webTranslationService.translate(
          'Test',
          { sourceLanguage: 'en', targetLanguage: 'es' },
          async (chunk) => { receivedChunks.push(chunk) }
        )

        expect(receivedChunks).toEqual(chunks)
        expect(result).toBe('Hello world!')
      })

      it('should throw error when API request fails', async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })

        await expect(
          webTranslationService.translate('Test', { sourceLanguage: 'en', targetLanguage: 'es' })
        ).rejects.toThrow('API request failed')
      })

      it('should throw error when response body is null', async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          body: null,
        })

        await expect(
          webTranslationService.translate('Test', { sourceLanguage: 'en', targetLanguage: 'es' })
        ).rejects.toThrow('Failed to get response stream')
      })

      it('should handle network errors gracefully', async () => {
        globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

        await expect(
          webTranslationService.translate('Test', { sourceLanguage: 'en', targetLanguage: 'es' })
        ).rejects.toThrow('Network error')
      })
    })
  })

  describe('webSummarizationService', () => {
    describe('summarize', () => {
      it('should make POST request to summarize endpoint', async () => {
        const mockSummary = 'This is a summary.'
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(mockSummary) })
                .mockResolvedValueOnce({ done: true, value: undefined }),
            }),
          },
        })

        const result = await webSummarizationService.summarize('Long text to summarize')

        expect(fetch).toHaveBeenCalledWith('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Long text to summarize' }),
          signal: undefined,
        })
        expect(result).toBe(mockSummary)
      })

      it('should throw error when summarization fails', async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

        await expect(
          webSummarizationService.summarize('Test')
        ).rejects.toThrow('API request failed')
      })

      it('should handle empty response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          body: {
            getReader: () => ({
              read: vi.fn()
                .mockResolvedValueOnce({ done: true, value: undefined }),
            }),
          },
        })

        const result = await webSummarizationService.summarize('Test')
        expect(result).toBe('')
      })
    })
  })

  describe('webAudioDeviceService', () => {
    describe('getAudioDevices', () => {
      it('should return audio input devices', async () => {
        const mockDevices = [
          { deviceId: 'default', kind: 'audioinput', label: 'Default' },
          { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone 1' },
          { deviceId: 'speaker1', kind: 'audiooutput', label: 'Speakers' },
        ]
        
        vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValueOnce(
          mockDevices as unknown as MediaDeviceInfo[]
        )

        const result = await webAudioDeviceService.getAudioDevices()

        expect(result).toEqual([
          { id: 'default', name: 'Default' },
          { id: 'mic1', name: 'Microphone 1' },
        ])
      })

      it('should handle devices without labels', async () => {
        const mockDevices = [
          { deviceId: 'abc123', kind: 'audioinput', label: '' },
        ]
        
        vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockResolvedValueOnce(
          mockDevices as unknown as MediaDeviceInfo[]
        )

        const result = await webAudioDeviceService.getAudioDevices()

        expect(result).toEqual([
          { id: 'abc123', name: 'Microphone abc123' },
        ])
      })

      it('should return empty array on error', async () => {
        vi.spyOn(navigator.mediaDevices, 'enumerateDevices').mockRejectedValueOnce(
          new Error('Permission denied')
        )

        const result = await webAudioDeviceService.getAudioDevices()

        expect(result).toEqual([])
      })
    })

    describe('getSystemAudioDevices', () => {
      it('should return empty array (not supported in browser)', async () => {
        const result = await webAudioDeviceService.getSystemAudioDevices()
        expect(result).toEqual([])
      })
    })

    describe('saveDeviceSettings', () => {
      it('should be a no-op in browser mode', async () => {
        // Should not throw
        await webAudioDeviceService.saveDeviceSettings('mic1', null, 'microphone')
      })
    })

    describe('getConfig', () => {
      it('should return empty object in browser mode', async () => {
        const result = await webAudioDeviceService.getConfig()
        expect(result).toEqual({})
      })
    })
  })
})