// Vitest globals are available (configured in vitest.config.ts with globals: true)

// Mock Tauri APIs
const mockInvoke = vi.fn()
const mockListen = vi.fn()
const mockSave = vi.fn()
const mockWriteTextFile = vi.fn()

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

describe('Tauri Services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('saveFile', () => {
    it('should save file when user selects a path', async () => {
      const { saveFile } = await import('../tauri')
      
      mockSave.mockResolvedValue('/path/to/file.md')
      mockWriteTextFile.mockResolvedValue(undefined)

      const result = await saveFile('test content', 'test.md')

      expect(result).toBe(true)
      expect(mockSave).toHaveBeenCalledWith({
        defaultPath: 'test.md',
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] },
        ],
      })
      expect(mockWriteTextFile).toHaveBeenCalledWith('/path/to/file.md', 'test content')
    })

    it('should return false when user cancels the dialog', async () => {
      const { saveFile } = await import('../tauri')
      
      mockSave.mockResolvedValue(null)

      const result = await saveFile('test content', 'test.md')

      expect(result).toBe(false)
      expect(mockWriteTextFile).not.toHaveBeenCalled()
    })
  })

  describe('tauriTranslationService', () => {
    it('should call translate_text command with correct parameters', async () => {
      const { tauriTranslationService } = await import('../tauri')
      
      mockInvoke.mockResolvedValue('Translated text')
      mockListen.mockResolvedValue(vi.fn())

      const result = await tauriTranslationService.translate(
        'Hello',
        { sourceLanguage: 'en', targetLanguage: 'es' }
      )

      expect(mockInvoke).toHaveBeenCalledWith('translate_text', {
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      })
      expect(result).toBe('Translated text')
    })

    it('should call onChunk callback when streaming', async () => {
      const { tauriTranslationService } = await import('../tauri')
      
      const chunks: string[] = []
      const onChunk = vi.fn(async (chunk: string) => {
        chunks.push(chunk)
      })

      mockInvoke.mockResolvedValue('')
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: string }) => void) => {
        if (eventName === 'translation-chunk') {
          // Simulate streaming chunks
          setTimeout(() => callback({ payload: 'Hello ' }), 0)
          setTimeout(() => callback({ payload: 'world' }), 10)
        }
        return vi.fn()
      })

      const result = await tauriTranslationService.translate(
        'Hello',
        { sourceLanguage: 'en', targetLanguage: 'es' },
        onChunk
      )

      // Wait for the timeouts
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(onChunk).toHaveBeenCalled()
    })
  })

  describe('tauriSummarizationService', () => {
    it('should call summarize_text command with correct parameters', async () => {
      const { tauriSummarizationService } = await import('../tauri')
      
      mockInvoke.mockResolvedValue('Summary text')

      const result = await tauriSummarizationService.summarize('Long text to summarize')

      expect(mockInvoke).toHaveBeenCalledWith('summarize_text', { text: 'Long text to summarize' })
      expect(result).toBe('Summary text')
    })

    it('should propagate errors from the command', async () => {
      const { tauriSummarizationService } = await import('../tauri')
      
      mockInvoke.mockRejectedValue(new Error('Summarization failed'))

      await expect(
        tauriSummarizationService.summarize('Test')
      ).rejects.toThrow('Summarization failed')
    })
  })

  describe('tauriAudioDeviceService', () => {
    describe('getAudioDevices', () => {
      it('should return audio devices from the command', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockResolvedValue([
          ['device1', 'Microphone 1'],
          ['device2', 'Microphone 2'],
        ])

        const result = await tauriAudioDeviceService.getAudioDevices()

        expect(result).toEqual([
          { id: 'device1', name: 'Microphone 1' },
          { id: 'device2', name: 'Microphone 2' },
        ])
      })

      it('should return empty array on error', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockRejectedValue(new Error('Failed to get devices'))

        const result = await tauriAudioDeviceService.getAudioDevices()

        expect(result).toEqual([])
      })
    })

    describe('getSystemAudioDevices', () => {
      it('should return system audio devices from the command', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockResolvedValue([
          ['sys1', 'System Audio 1'],
        ])

        const result = await tauriAudioDeviceService.getSystemAudioDevices()

        expect(result).toEqual([
          { id: 'sys1', name: 'System Audio 1' },
        ])
      })

      it('should return empty array on error', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockRejectedValue(new Error('Failed to get system devices'))

        const result = await tauriAudioDeviceService.getSystemAudioDevices()

        expect(result).toEqual([])
      })
    })

    describe('saveDeviceSettings', () => {
      it('should call save_device_settings command with correct parameters', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockResolvedValue(undefined)

        await tauriAudioDeviceService.saveDeviceSettings('mic1', 'sys1', 'dual')

        expect(mockInvoke).toHaveBeenCalledWith('save_device_settings', {
          micDevice: 'mic1',
          systemAudioDevice: 'sys1',
          captureMode: 'dual',
        })
      })

      it('should handle null device values', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockResolvedValue(undefined)

        await tauriAudioDeviceService.saveDeviceSettings(null, null, 'microphone')

        expect(mockInvoke).toHaveBeenCalledWith('save_device_settings', {
          micDevice: null,
          systemAudioDevice: null,
          captureMode: 'microphone',
        })
      })
    })

    describe('getConfig', () => {
      it('should return config from the command', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockResolvedValue({
          mic_device: 'mic1',
          system_audio_device: 'sys1',
          capture_mode: 'dual',
        })

        const result = await tauriAudioDeviceService.getConfig()

        expect(result).toEqual({
          mic_device: 'mic1',
          system_audio_device: 'sys1',
          capture_mode: 'dual',
        })
      })

      it('should return empty object on error', async () => {
        const { tauriAudioDeviceService } = await import('../tauri')
        
        mockInvoke.mockRejectedValue(new Error('Failed to get config'))

        const result = await tauriAudioDeviceService.getConfig()

        expect(result).toEqual({})
      })
    })
  })
})