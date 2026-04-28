// Vitest globals are available (configured in vitest.config.ts with globals: true)
import { getPlatformAdapter, getPlatform } from '../platform'
import { isDesktopMode } from '@/utils/platform'

// Mock the platform detection
vi.mock('@/utils/platform', () => ({
  isDesktopMode: vi.fn(),
}))

// Mock the API services
vi.mock('../api', () => ({
  webTranslationService: { translate: vi.fn() },
  webSummarizationService: { summarize: vi.fn() },
  webAudioDeviceService: { getAudioDevices: vi.fn() },
}))

vi.mock('../tauri', () => ({
  tauriTranslationService: { translate: vi.fn() },
  tauriSummarizationService: { summarize: vi.fn() },
  tauriAudioDeviceService: { getAudioDevices: vi.fn() },
}))

describe('Platform Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the singleton instance between tests
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getPlatformAdapter', () => {
    it('should return web services when not in desktop mode', async () => {
      vi.mocked(isDesktopMode).mockReturnValue(false)
      
      // Re-import to get fresh module state
      const { getPlatformAdapter } = await import('../platform')
      const adapter = getPlatformAdapter()

      expect(adapter.isDesktop).toBe(false)
      expect(adapter.translation).toHaveProperty('translate')
      expect(adapter.summarization).toHaveProperty('summarize')
      expect(adapter.audioDevices).toHaveProperty('getAudioDevices')
    })

    it('should return tauri services when in desktop mode', async () => {
      vi.mocked(isDesktopMode).mockReturnValue(true)
      
      // Re-import to get fresh module state
      const { getPlatformAdapter } = await import('../platform')
      const adapter = getPlatformAdapter()

      expect(adapter.isDesktop).toBe(true)
      expect(adapter.translation).toHaveProperty('translate')
      expect(adapter.summarization).toHaveProperty('summarize')
      expect(adapter.audioDevices).toHaveProperty('getAudioDevices')
    })

    it('should call isDesktopMode to determine platform', async () => {
      vi.mocked(isDesktopMode).mockReturnValue(false)
      
      const { getPlatformAdapter } = await import('../platform')
      getPlatformAdapter()

      expect(isDesktopMode).toHaveBeenCalled()
    })
  })

  describe('getPlatform', () => {
    it('should return a platform adapter', async () => {
      vi.mocked(isDesktopMode).mockReturnValue(false)
      
      const { getPlatform } = await import('../platform')
      const platform = getPlatform()

      expect(platform).toBeDefined()
      expect(platform.isDesktop).toBe(false)
    })

    it('should return the same instance on multiple calls', async () => {
      vi.mocked(isDesktopMode).mockReturnValue(false)
      
      const { getPlatform } = await import('../platform')
      const platform1 = getPlatform()
      const platform2 = getPlatform()

      expect(platform1).toBe(platform2)
    })
  })
})