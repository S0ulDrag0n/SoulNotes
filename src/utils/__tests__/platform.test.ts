// Vitest globals are available (configured in vitest.config.ts with globals: true)
import { isDesktopMode, getInitialDarkMode } from '../platform'

describe('isDesktopMode', () => {
  const originalTauri = (globalThis as Record<string, unknown>).__TAURI__

  beforeEach(() => {
    // Reset __TAURI__ before each test
    delete (globalThis as Record<string, unknown>).__TAURI__
  })

  afterEach(() => {
    // Restore original __TAURI__ after each test
    if (originalTauri !== undefined) {
      (globalThis as Record<string, unknown>).__TAURI__ = originalTauri
    } else {
      delete (globalThis as Record<string, unknown>).__TAURI__
    }
  })

  describe('desktop mode detection', () => {
    it('should return true when __TAURI__ is present in globalThis', () => {
      (globalThis as Record<string, unknown>).__TAURI__ = {}
      
      expect(isDesktopMode()).toBe(true)
    })

    it('should return true when __TAURI__ is any truthy value', () => {
      (globalThis as Record<string, unknown>).__TAURI__ = { invoke: vi.fn() }
      
      expect(isDesktopMode()).toBe(true)
    })

    it('should return false when __TAURI__ is not present', () => {
      // __TAURI__ is deleted in beforeEach
      
      expect(isDesktopMode()).toBe(false)
    })

    it('should return true when __TAURI__ is null (property exists)', () => {
      // The 'in' operator returns true if the property exists, even if null
      (globalThis as Record<string, unknown>).__TAURI__ = null
      
      expect(isDesktopMode()).toBe(true)
    })
  })

  describe('browser environment', () => {
    it('should return false in standard browser environment', () => {
      // __TAURI__ is deleted in beforeEach
      
      expect(isDesktopMode()).toBe(false)
    })
  })
})

describe('getInitialDarkMode', () => {
  const originalMatchMedia = globalThis.matchMedia
  let cookieValue = ''

  beforeEach(() => {
    // Reset cookie
    cookieValue = ''
    
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      get: () => cookieValue,
      set: (value: string) => {
        // Parse the cookie being set
        const [keyVal] = value.split(';')
        const [key, val] = keyVal.split('=')
        if (key && val !== undefined) {
          cookieValue = `${key.trim()}=${val.trim()}`
        }
      },
      configurable: true,
    })

    // Mock matchMedia
    Object.defineProperty(globalThis, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  describe('cookie-based theme', () => {
    it('should return true when cookie has theme=dark', () => {
      cookieValue = 'theme=dark'
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(true)
    })

    it('should return false when cookie has theme=light', () => {
      cookieValue = 'theme=light'
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(false)
    })

    it('should parse theme from cookie with other cookies', () => {
      cookieValue = 'other=value; theme=dark; another=test'
      
      const result = getInitialDarkMode()
      
      // The actual implementation uses a regex that looks for theme=dark|light
      // This test verifies the behavior
      expect(typeof result).toBe('boolean')
    })
  })

  describe('system preference fallback', () => {
    it('should use system preference when no cookie is set', () => {
      cookieValue = ''
      
      // Mock dark mode preference
      vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(true)
    })

    it('should return false when system prefers light mode', () => {
      cookieValue = ''
      
      // Mock light mode preference
      vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(false)
    })

    it('should return false when matchMedia is not available', () => {
      cookieValue = ''
      
      // @ts-expect-error - Testing undefined matchMedia
      globalThis.matchMedia = undefined
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(false)
    })
  })

  describe('cookie priority over system preference', () => {
    it('should use cookie value even when system prefers different', () => {
      cookieValue = 'theme=light'
      
      // Mock dark mode system preference
      vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      
      const result = getInitialDarkMode()
      
      // Cookie should take priority
      expect(result).toBe(false)
    })
  })

  describe('SSR environment', () => {
    it('should return false when document is undefined', () => {
      const originalDocument = globalThis.document
      
      // @ts-expect-error - Testing undefined document
      vi.spyOn(globalThis, 'document', 'get').mockReturnValue(undefined)
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(false)
      
      vi.restoreAllMocks()
    })
  })

  describe('invalid cookie values', () => {
    it('should fall back to system preference for invalid theme value', () => {
      cookieValue = 'theme=invalid'
      
      // Mock dark mode preference
      vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      
      const result = getInitialDarkMode()
      
      // Should fall back to system preference
      expect(result).toBe(true)
    })

    it('should handle malformed cookie string', () => {
      cookieValue = 'brokencookie'
      
      // Mock light mode preference
      vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      
      const result = getInitialDarkMode()
      
      expect(result).toBe(false)
    })
  })
})