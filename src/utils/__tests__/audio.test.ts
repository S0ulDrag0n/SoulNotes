// Vitest globals are available (configured in vitest.config.ts with globals: true)
import { floatTo16BitPCM, downsampleBuffer, int16ToBase64 } from '../audio'

describe('floatTo16BitPCM', () => {
  describe('basic conversion', () => {
    it('should convert positive float values to Int16 correctly', () => {
      const input = new Float32Array([0.5, 0.25, 0.125])
      const result = floatTo16BitPCM(input)
      
      // 0.5 * 32767 = 16383.5 -> 16383
      // 0.25 * 32767 = 8191.75 -> 8191
      // 0.125 * 32767 = 4095.875 -> 4095
      expect(result[0]).toBe(16383)
      expect(result[1]).toBe(8191)
      expect(result[2]).toBe(4095)
    })

    it('should convert negative float values to Int16 correctly', () => {
      const input = new Float32Array([-0.5, -0.25, -0.125])
      const result = floatTo16BitPCM(input)
      
      // -0.5 * 32768 = -16384
      // -0.25 * 32768 = -8192
      // -0.125 * 32768 = -4096
      expect(result[0]).toBe(-16384)
      expect(result[1]).toBe(-8192)
      expect(result[2]).toBe(-4096)
    })

    it('should handle zero values', () => {
      const input = new Float32Array([0, 0.0, -0])
      const result = floatTo16BitPCM(input)
      
      expect(result[0]).toBe(0)
      expect(result[1]).toBe(0)
      expect(result[2]).toBe(0)
    })

    it('should return Int16Array of same length as input', () => {
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      const result = floatTo16BitPCM(input)
      
      expect(result.length).toBe(input.length)
      expect(result).toBeInstanceOf(Int16Array)
    })
  })

  describe('boundary conditions', () => {
    it('should clip values above 1.0 to Int16 max (32767)', () => {
      const input = new Float32Array([1.0, 1.5, 2.0, 100.0])
      const result = floatTo16BitPCM(input)
      
      expect(result[0]).toBe(32767) // 1.0 * 32767
      expect(result[1]).toBe(32767) // clipped
      expect(result[2]).toBe(32767) // clipped
      expect(result[3]).toBe(32767) // clipped
    })

    it('should clip values below -1.0 to Int16 min (-32768)', () => {
      const input = new Float32Array([-1.0, -1.5, -2.0, -100.0])
      const result = floatTo16BitPCM(input)
      
      expect(result[0]).toBe(-32768) // -1.0 * 32768
      expect(result[1]).toBe(-32768) // clipped
      expect(result[2]).toBe(-32768) // clipped
      expect(result[3]).toBe(-32768) // clipped
    })

    it('should handle maximum Int16 range correctly', () => {
      const input = new Float32Array([1.0, -1.0])
      const result = floatTo16BitPCM(input)
      
      expect(result[0]).toBe(32767)  // Max positive
      expect(result[1]).toBe(-32768) // Max negative (two's complement)
    })
  })

  describe('edge cases', () => {
    it('should handle very small float values', () => {
      const input = new Float32Array([0.00001, -0.00001, 0.0000001])
      const result = floatTo16BitPCM(input)
      
      // Very small values should round to near zero
      expect(Math.abs(result[0])).toBeLessThan(1)
      expect(Math.abs(result[1])).toBeLessThan(1)
      expect(Math.abs(result[2])).toBe(0)
    })

    it('should handle empty array', () => {
      const input = new Float32Array(0)
      const result = floatTo16BitPCM(input)
      
      expect(result.length).toBe(0)
    })

    it('should handle single element array', () => {
      const input = new Float32Array([0.5])
      const result = floatTo16BitPCM(input)
      
      expect(result.length).toBe(1)
      expect(result[0]).toBe(16383)
    })

    it('should handle large arrays', () => {
      const size = 10000
      const input = new Float32Array(size).fill(0.5)
      const result = floatTo16BitPCM(input)
      
      expect(result.length).toBe(size)
      expect(result[0]).toBe(16383)
      expect(result[size - 1]).toBe(16383)
    })

    it('should preserve alternating pattern', () => {
      const input = new Float32Array([0.5, -0.5, 0.5, -0.5])
      const result = floatTo16BitPCM(input)
      
      expect(result[0]).toBe(16383)
      expect(result[1]).toBe(-16384)
      expect(result[2]).toBe(16383)
      expect(result[3]).toBe(-16384)
    })
  })
})

describe('downsampleBuffer', () => {
  describe('same sample rate', () => {
    it('should return the same buffer when input and target rates are equal', () => {
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      const result = downsampleBuffer(input, 44100, 44100)
      
      expect(result).toBe(input) // Should return same reference
    })

    it('should return the same buffer for any equal rates', () => {
      const input = new Float32Array([0.5, -0.5, 0.25])
      const result = downsampleBuffer(input, 16000, 16000)
      
      expect(result).toBe(input)
    })
  })

  describe('downsampling by integer ratio', () => {
    it('should downsample by factor of 2', () => {
      // 44100 -> 22050 (ratio of 2)
      const input = new Float32Array([0.0, 1.0, 0.0, 1.0, 0.0, 1.0])
      const result = downsampleBuffer(input, 44100, 22050)
      
      // Each pair should be averaged
      expect(result.length).toBe(3)
      expect(result[0]).toBeCloseTo(0.5)  // (0 + 1) / 2
      expect(result[1]).toBeCloseTo(0.5)  // (0 + 1) / 2
      expect(result[2]).toBeCloseTo(0.5)  // (0 + 1) / 2
    })

    it('should downsample by factor of 4', () => {
      // 48000 -> 12000 (ratio of 4)
      const input = new Float32Array([0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0])
      const result = downsampleBuffer(input, 48000, 12000)
      
      expect(result.length).toBe(2)
      expect(result[0]).toBeCloseTo(0.5)  // (0 + 0 + 1 + 1) / 4
      expect(result[1]).toBeCloseTo(0.5)  // (0 + 0 + 1 + 1) / 4
    })
  })

  describe('downsampling by non-integer ratio', () => {
    it('should handle non-integer ratio (44100 -> 16000)', () => {
      // Ratio = 2.75625
      const input = new Float32Array(100).fill(0.5)
      const result = downsampleBuffer(input, 44100, 16000)
      
      // Expected length = round(100 / 2.75625) = 36
      expect(result.length).toBe(36)
      
      // All values should be close to 0.5 (averaging same values)
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(0.5, 1)
      }
    })

    it('should handle upsampling (lower to higher rate)', () => {
      // This is technically upsampling, but function should handle it
      const input = new Float32Array([0.5, 0.5, 0.5])
      const result = downsampleBuffer(input, 16000, 44100)
      
      // When upsampling, ratio < 1, newLength > input.length
      // But the function averages, so values should still be close to input
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const input = new Float32Array(0)
      const result = downsampleBuffer(input, 44100, 22050)
      
      expect(result.length).toBe(0)
    })

    it('should handle single sample buffer', () => {
      const input = new Float32Array([0.5])
      const result = downsampleBuffer(input, 44100, 22050)
      
      expect(result.length).toBe(1)
      expect(result[0]).toBe(0.5)
    })

    it('should handle very large ratio', () => {
      // 192000 -> 8000 (ratio of 24)
      const input = new Float32Array(240).fill(1.0)
      const result = downsampleBuffer(input, 192000, 8000)
      
      expect(result.length).toBe(10)
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeCloseTo(1.0)
      }
    })

    it('should handle buffer with varying values', () => {
      const input = new Float32Array([0.0, 0.5, 1.0, 0.5, 0.0, -0.5])
      const result = downsampleBuffer(input, 48000, 24000)
      
      expect(result.length).toBe(3)
      expect(result[0]).toBeCloseTo(0.25)  // (0 + 0.5) / 2
      expect(result[1]).toBeCloseTo(0.75)  // (1.0 + 0.5) / 2
      expect(result[2]).toBeCloseTo(-0.25) // (0.0 + -0.5) / 2
    })
  })
})

describe('int16ToBase64', () => {
  describe('basic conversion', () => {
    it('should convert simple Int16Array to base64', () => {
      const input = new Int16Array([0, 1, -1, 256, -256])
      const result = int16ToBase64(input)
      
      // Base64 encoding of the byte representation
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      
      // Verify it's valid base64
      expect(() => atob(result)).not.toThrow()
    })

    it('should produce valid base64 that can be decoded', () => {
      const input = new Int16Array([0, 1000, -1000, 32767, -32768])
      const result = int16ToBase64(input)
      
      // Decode and verify
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed[0]).toBe(0)
      expect(reconstructed[1]).toBe(1000)
      expect(reconstructed[2]).toBe(-1000)
      expect(reconstructed[3]).toBe(32767)
      expect(reconstructed[4]).toBe(-32768)
    })

    it('should handle all zeros', () => {
      const input = new Int16Array(10).fill(0)
      const result = int16ToBase64(input)
      
      // All zeros should produce a valid base64 string
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('boundary values', () => {
    it('should handle maximum Int16 values', () => {
      const input = new Int16Array([32767, -32768])
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed[0]).toBe(32767)
      expect(reconstructed[1]).toBe(-32768)
    })

    it('should handle alternating max/min values', () => {
      const input = new Int16Array([32767, -32768, 32767, -32768, 32767, -32768])
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed.length).toBe(6)
      expect(reconstructed[0]).toBe(32767)
      expect(reconstructed[1]).toBe(-32768)
    })
  })

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const input = new Int16Array(0)
      const result = int16ToBase64(input)
      
      expect(result).toBe('')
    })

    it('should handle single element', () => {
      const input = new Int16Array([42])
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed[0]).toBe(42)
    })

    it('should handle large arrays (spanning multiple chunks)', () => {
      // AUDIO_ENCODING.base64ChunkSize is 0x8000 (32768)
      // Each Int16 is 2 bytes, so we need more than 16384 elements to span chunks
      const size = 20000
      const input = new Int16Array(size)
      for (let i = 0; i < size; i++) {
        input[i] = i % 65536 - 32768 // Cycle through all values
      }
      
      const result = int16ToBase64(input)
      
      // Verify the result can be decoded back
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed.length).toBe(size)
      expect(reconstructed[0]).toBe(-32768) // 0 - 32768
      expect(reconstructed[1]).toBe(-32767) // 1 - 32768
    })

    it('should handle data exactly at chunk boundary', () => {
      // 16384 Int16 values = 32768 bytes = exactly one chunk
      const size = 16384
      const input = new Int16Array(size).fill(12345)
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      
      const reconstructed = new Int16Array(bytes.buffer)
      expect(reconstructed.length).toBe(size)
      expect(reconstructed[0]).toBe(12345)
      expect(reconstructed[size - 1]).toBe(12345)
    })
  })

  describe('byte order (little-endian)', () => {
    it('should use little-endian byte order', () => {
      // 256 in little-endian is [0, 1] (low byte first)
      const input = new Int16Array([256])
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      // First byte should be 0 (low byte), second should be 1 (high byte)
      expect(decoded.charCodeAt(0)).toBe(0)
      expect(decoded.charCodeAt(1)).toBe(1)
    })

    it('should correctly encode 1 (0x0001 in little-endian)', () => {
      const input = new Int16Array([1])
      const result = int16ToBase64(input)
      
      const decoded = atob(result)
      expect(decoded.charCodeAt(0)).toBe(1)  // Low byte
      expect(decoded.charCodeAt(1)).toBe(0)  // High byte
    })
  })
})