// Vitest globals are available (configured in vitest.config.ts with globals: true)
import {
  extractTranslatableChunk,
  generateMessageId,
  formatTranscriptForSave,
} from '../text'

describe('extractTranslatableChunk', () => {
  describe('empty buffer handling', () => {
    it('should return empty chunk and rest for empty buffer', () => {
      const result = extractTranslatableChunk('', false, false, 100)
      expect(result).toEqual({ chunk: '', rest: '' })
    })

    it('should return empty chunk and rest for whitespace-only buffer', () => {
      const result = extractTranslatableChunk('   \t\n  ', false, false, 100)
      expect(result).toEqual({ chunk: '', rest: '' })
    })

    it('should trim leading whitespace from buffer', () => {
      const result = extractTranslatableChunk('   hello world', true, false, 100)
      expect(result.chunk).toBe('hello world')
      expect(result.rest).toBe('')
    })
  })

  describe('trigger conditions', () => {
    it('should not extract when neither idle nor interval elapsed', () => {
      const result = extractTranslatableChunk('hello world', false, false, 100)
      expect(result.chunk).toBe('')
      expect(result.rest).toBe('hello world')
    })

    it('should extract everything on idle', () => {
      const result = extractTranslatableChunk('hello world', true, false, 100)
      expect(result.chunk).toBe('hello world')
      expect(result.rest).toBe('')
    })

    it('should extract everything on idle even when longer than max chunk', () => {
      const longText = 'a'.repeat(200)
      const result = extractTranslatableChunk(longText, true, false, 100)
      expect(result.chunk).toBe(longText)
      expect(result.rest).toBe('')
    })

    it('should extract up to max chunk length on interval elapsed', () => {
      const text = 'a'.repeat(150)
      const result = extractTranslatableChunk(text, false, true, 100)
      expect(result.chunk).toBe('a'.repeat(100))
      expect(result.rest).toBe('a'.repeat(50))
    })

    it('should prioritize idle over interval', () => {
      const text = 'a'.repeat(150)
      const result = extractTranslatableChunk(text, true, true, 100)
      // On idle, should return everything regardless of max chunk
      expect(result.chunk).toBe(text)
      expect(result.rest).toBe('')
    })
  })

  describe('chunk splitting', () => {
    it('should split at max chunk length', () => {
      const text = 'a'.repeat(150)
      const result = extractTranslatableChunk(text, false, true, 100)
      expect(result.chunk.length).toBe(100)
      expect(result.rest.length).toBe(50)
    })

    it('should trim leading whitespace from rest after split', () => {
      const text = 'hello world     remaining text'
      const result = extractTranslatableChunk(text, false, true, 11)
      expect(result.chunk).toBe('hello world')
      expect(result.rest).toBe('remaining text')
    })

    it('should handle text exactly at max chunk length', () => {
      const text = 'a'.repeat(100)
      const result = extractTranslatableChunk(text, false, true, 100)
      expect(result.chunk).toBe(text)
      expect(result.rest).toBe('')
    })

    it('should handle text shorter than max chunk length', () => {
      const text = 'short text'
      const result = extractTranslatableChunk(text, false, true, 100)
      expect(result.chunk).toBe(text)
      expect(result.rest).toBe('')
    })
  })

  describe('unicode and special characters', () => {
    it('should handle unicode characters correctly', () => {
      const text = '你好世界，这是一个测试'
      const result = extractTranslatableChunk(text, true, false, 100)
      expect(result.chunk).toBe(text)
    })

    it('should handle emoji characters', () => {
      const text = 'Hello 👋 World 🌍 Test 🧪'
      const result = extractTranslatableChunk(text, true, false, 100)
      expect(result.chunk).toBe(text)
    })

    it('should split unicode text at max chunk length', () => {
      const text = '你你你你你你你你你你你你你你你你你你你你' // 20 chars
      const result = extractTranslatableChunk(text, false, true, 10)
      expect(result.chunk).toBe('你你你你你你你你你你')
      expect(result.rest).toBe('你你你你你你你你你你')
    })

    it('should handle mixed language text', () => {
      const text = 'Hello 世界 this is a test 测试'
      const result = extractTranslatableChunk(text, true, false, 100)
      expect(result.chunk).toBe(text)
    })

    it('should handle newlines and special whitespace', () => {
      const text = 'Line 1\nLine 2\r\nLine 3\tTabbed'
      const result = extractTranslatableChunk(text, true, false, 100)
      expect(result.chunk).toBe(text)
    })
  })
})

describe('generateMessageId', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('format', () => {
    it('should generate ID in correct format: timestamp-random', () => {
      vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'))
      const id = generateMessageId()
      
      // Format: {timestamp}-{9 char random string} (substring(2, 11) = 9 chars)
      expect(id).toMatch(/^\d{13}-[a-z0-9]{9}$/)
    })

    it('should include current timestamp', () => {
      const timestamp1 = Date.now()
      vi.setSystemTime(timestamp1)
      const id1 = generateMessageId()
      
      const timestamp2 = Date.now() + 1000
      vi.setSystemTime(timestamp2)
      const id2 = generateMessageId()
      
      const ts1 = parseInt(id1.split('-')[0], 10)
      const ts2 = parseInt(id2.split('-')[0], 10)
      
      expect(ts2).toBeGreaterThan(ts1)
    })
  })

  describe('uniqueness', () => {
    it('should generate unique IDs for rapid calls', () => {
      vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'))
      
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateMessageId())
      }
      
      expect(ids.size).toBe(100)
    })

    it('should generate different random parts even with same timestamp', () => {
      vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'))
      
      const id1 = generateMessageId()
      const id2 = generateMessageId()
      
      const random1 = id1.split('-')[1]
      const random2 = id2.split('-')[1]
      
      // Very unlikely to be the same
      expect(random1).not.toBe(random2)
    })
  })
})

describe('formatTranscriptForSave', () => {
  describe('empty input', () => {
    it('should return empty string for empty array', () => {
      const result = formatTranscriptForSave([])
      expect(result).toBe('')
    })
  })

  describe('single message', () => {
    it('should format single message with timestamp', () => {
      const messages = [
        { text: 'Hello world', timestamp: new Date('2024-01-15T10:30:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      // Format: "January 15, 2024 10:30 AM Hello world"
      expect(result).toContain('January 15, 2024')
      expect(result).toContain('10:30')
      expect(result).toContain('AM')
      expect(result).toContain('Hello world')
    })
  })

  describe('multiple messages', () => {
    it('should format multiple messages with timestamps', () => {
      const messages = [
        { text: 'First message', timestamp: new Date('2024-01-15T10:30:00') },
        { text: 'Second message', timestamp: new Date('2024-01-15T11:45:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      expect(result).toContain('First message')
      expect(result).toContain('Second message')
      expect(result).toContain('10:30')
      expect(result).toContain('11:45')
    })

    it('should separate messages with newlines', () => {
      const messages = [
        { text: 'Line 1', timestamp: new Date('2024-01-15T10:30:00') },
        { text: 'Line 2', timestamp: new Date('2024-01-15T10:31:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      const lines = result.split('\n')
      
      expect(lines.length).toBe(2)
    })
  })

  describe('special characters', () => {
    it('should handle text with special characters', () => {
      const messages = [
        { text: 'Hello "world" & <friends>', timestamp: new Date('2024-01-15T10:30:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      expect(result).toContain('Hello "world" & <friends>')
    })

    it('should handle unicode text', () => {
      const messages = [
        { text: '你好世界 🌍', timestamp: new Date('2024-01-15T10:30:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      expect(result).toContain('你好世界 🌍')
    })

    it('should handle multiline text in single message', () => {
      const messages = [
        { text: 'Line 1\nLine 2\nLine 3', timestamp: new Date('2024-01-15T10:30:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 2')
      expect(result).toContain('Line 3')
    })
  })

  describe('date formatting', () => {
    it('should format date in expected locale format', () => {
      const messages = [
        { text: 'Test', timestamp: new Date('2024-06-15T14:30:00') },
      ]
      
      const result = formatTranscriptForSave(messages)
      
      // Should contain month name
      expect(result).toMatch(/June/)
      // Should contain day and year
      expect(result).toMatch(/15/)
      expect(result).toMatch(/2024/)
    })

    it('should format time with AM/PM', () => {
      const morningMessages = [
        { text: 'Morning', timestamp: new Date('2024-01-15T09:30:00') },
      ]
      const eveningMessages = [
        { text: 'Evening', timestamp: new Date('2024-01-15T21:30:00') },
      ]
      
      const morningResult = formatTranscriptForSave(morningMessages)
      const eveningResult = formatTranscriptForSave(eveningMessages)
      
      expect(morningResult).toMatch(/AM/)
      expect(eveningResult).toMatch(/PM/)
    })
  })
})