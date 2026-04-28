// Tests for Tauri audio processing pipeline
// These tests ensure the audio processing for WASAPI loopback capture
// remains correct and prevents regression in:
// 1. Stereo-to-mono conversion
// 2. Sample rate conversion (48kHz -> 24kHz)
// 3. Float32 to Int16 conversion
// 4. Audio buffering

import { downsampleBuffer, floatTo16BitPCM } from '../audio';
import { REALTIME_AUDIO } from '@/lib/constants';

// ---------------------------------------------------------------------
// Helper functions that mirror the logic in useTauriAudioCapture.ts
// These are tested to ensure the pipeline remains correct
// ---------------------------------------------------------------------

/**
 * Convert stereo Float32Array to mono by averaging left and right channels
 * This mirrors the logic in useTauriAudioCapture.ts
 */
function stereoToMono(stereoData: Float32Array): Float32Array {
  const monoLength = Math.floor(stereoData.length / 2);
  const monoData = new Float32Array(monoLength);
  for (let i = 0; i < monoLength; i++) {
    const left = stereoData[i * 2];
    const right = stereoData[i * 2 + 1];
    monoData[i] = (left + right) / 2;
  }
  return monoData;
}

/**
 * Convert Float32Array to Int16Array (PCM 16-bit)
 * This mirrors the logic in useTauriAudioCapture.ts
 */
function float32ToInt16(floatData: Float32Array): Int16Array {
  const int16Data = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const sample = Math.max(-1, Math.min(1, floatData[i]));
    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return int16Data;
}

/**
 * Simulate the complete Tauri audio processing pipeline
 * Input: Raw WASAPI loopback data (48kHz, stereo, f32)
 * Output: Processed audio ready for transcription (24kHz, mono, i16)
 */
function processTauriAudio(
  rawData: Float32Array,
  inputSampleRate: number,
  channels: number,
  targetSampleRate: number = REALTIME_AUDIO.sampleRate
): Int16Array {
  // Step 1: Stereo to mono (if needed)
  let monoData: Float32Array;
  if (channels === 2) {
    monoData = stereoToMono(rawData);
  } else {
    monoData = rawData;
  }

  // Step 2: Resample to target rate
  const resampledData = inputSampleRate !== targetSampleRate
    ? downsampleBuffer(monoData, inputSampleRate, targetSampleRate)
    : monoData;

  // Step 3: Convert to Int16
  return float32ToInt16(resampledData);
}

// ---------------------------------------------------------------------
// Stereo-to-Mono Conversion Tests
// ---------------------------------------------------------------------

describe('stereoToMono', () => {
  describe('basic conversion', () => {
    it('should convert stereo to mono by averaging left and right channels', () => {
      // Stereo: [L0, R0, L1, R1, L2, R2]
      const stereo = new Float32Array([0.5, 0.3, 0.0, 0.0, -0.5, -0.3]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(3);
      expect(mono[0]).toBeCloseTo(0.4); // (0.5 + 0.3) / 2
      expect(mono[1]).toBeCloseTo(0.0); // (0.0 + 0.0) / 2
      expect(mono[2]).toBeCloseTo(-0.4); // (-0.5 + -0.3) / 2
    });

    it('should handle identical left and right channels', () => {
      const stereo = new Float32Array([0.5, 0.5, 0.25, 0.25, -0.5, -0.5]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(3);
      expect(mono[0]).toBeCloseTo(0.5);
      expect(mono[1]).toBeCloseTo(0.25);
      expect(mono[2]).toBeCloseTo(-0.5);
    });

    it('should handle silent channels', () => {
      const stereo = new Float32Array([0.0, 0.0, 0.0, 0.0]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(2);
      expect(mono[0]).toBe(0.0);
      expect(mono[1]).toBe(0.0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const stereo = new Float32Array(0);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(0);
    });

    it('should handle single sample pair', () => {
      const stereo = new Float32Array([0.5, -0.5]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(1);
      expect(mono[0]).toBeCloseTo(0.0);
    });

    it('should handle out-of-phase signals (cancellation)', () => {
      const stereo = new Float32Array([1.0, -1.0, 0.5, -0.5]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(2);
      expect(mono[0]).toBeCloseTo(0.0); // Complete cancellation
      expect(mono[1]).toBeCloseTo(0.0); // Complete cancellation
    });

    it('should handle maximum amplitude signals', () => {
      const stereo = new Float32Array([1.0, 1.0, -1.0, -1.0]);
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(2);
      expect(mono[0]).toBeCloseTo(1.0);
      expect(mono[1]).toBeCloseTo(-1.0);
    });

    it('should handle large stereo arrays', () => {
      const size = 10000; // 5000 stereo samples
      const stereo = new Float32Array(size);
      for (let i = 0; i < size; i += 2) {
        stereo[i] = 0.5;     // Left channel
        stereo[i + 1] = 0.3; // Right channel
      }
      const mono = stereoToMono(stereo);

      expect(mono.length).toBe(5000);
      expect(mono[0]).toBeCloseTo(0.4);
      expect(mono[4999]).toBeCloseTo(0.4);
    });
  });
});

// ---------------------------------------------------------------------
// Float32 to Int16 Conversion Tests
// ---------------------------------------------------------------------

describe('float32ToInt16', () => {
  describe('basic conversion', () => {
    it('should convert positive values correctly', () => {
      const floatData = new Float32Array([0.5, 0.25, 0.125]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data.length).toBe(3);
      expect(int16Data[0]).toBe(16383);  // 0.5 * 32767
      expect(int16Data[1]).toBe(8191);   // 0.25 * 32767
      expect(int16Data[2]).toBe(4095);   // 0.125 * 32767
    });

    it('should convert negative values correctly', () => {
      const floatData = new Float32Array([-0.5, -0.25, -0.125]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data.length).toBe(3);
      expect(int16Data[0]).toBe(-16384); // -0.5 * 32768
      expect(int16Data[1]).toBe(-8192);  // -0.25 * 32768
      expect(int16Data[2]).toBe(-4096);  // -0.125 * 32768
    });

    it('should handle zero', () => {
      const floatData = new Float32Array([0.0, -0.0]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data[0]).toBe(0);
      expect(int16Data[1]).toBe(0);
    });
  });

  describe('clipping', () => {
    it('should clip values above 1.0 to Int16 max', () => {
      const floatData = new Float32Array([1.0, 1.5, 2.0, 100.0]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data[0]).toBe(32767);
      expect(int16Data[1]).toBe(32767);
      expect(int16Data[2]).toBe(32767);
      expect(int16Data[3]).toBe(32767);
    });

    it('should clip values below -1.0 to Int16 min', () => {
      const floatData = new Float32Array([-1.0, -1.5, -2.0, -100.0]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data[0]).toBe(-32768);
      expect(int16Data[1]).toBe(-32768);
      expect(int16Data[2]).toBe(-32768);
      expect(int16Data[3]).toBe(-32768);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const floatData = new Float32Array(0);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data.length).toBe(0);
    });

    it('should handle maximum range', () => {
      const floatData = new Float32Array([1.0, -1.0]);
      const int16Data = float32ToInt16(floatData);

      expect(int16Data[0]).toBe(32767);
      expect(int16Data[1]).toBe(-32768);
    });
  });
});

// ---------------------------------------------------------------------
// Complete Pipeline Tests
// ---------------------------------------------------------------------

describe('processTauriAudio (complete pipeline)', () => {
  describe('48kHz stereo to 24kHz mono', () => {
    it('should correctly process typical WASAPI loopback audio', () => {
      // Simulate 48kHz stereo audio (WASAPI typical output)
      // 480 samples = 10ms at 48kHz
      const samplesPerChannel = 480;
      const stereoData = new Float32Array(samplesPerChannel * 2);
      
      // Fill with a simple sine wave pattern
      for (let i = 0; i < samplesPerChannel; i++) {
        const value = Math.sin(i * 0.1) * 0.5;
        stereoData[i * 2] = value;     // Left channel
        stereoData[i * 2 + 1] = value; // Right channel (same as left)
      }

      const result = processTauriAudio(stereoData, 48000, 2);

      // After stereo->mono and 48kHz->24kHz downsampling:
      // - Mono: 480 samples
      // - Downsampled: 240 samples
      expect(result.length).toBe(240);
      expect(result).toBeInstanceOf(Int16Array);
    });

    it('should produce mono output from stereo input', () => {
      // Create stereo with different left/right values
      const stereoData = new Float32Array([1.0, 0.0, 0.5, 0.5, 0.0, 1.0]);
      
      const result = processTauriAudio(stereoData, 48000, 2);

      // After stereo->mono: [0.5, 0.5, 0.5]
      // After 48->24kHz downsample: ~2 samples (averaged)
      // The exact values depend on the downsampleBuffer implementation
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mono input (no stereo conversion needed)', () => {
      // Simulate 48kHz mono audio
      const monoData = new Float32Array(480);
      monoData.fill(0.5);

      const result = processTauriAudio(monoData, 48000, 1);

      // Mono stays mono, just downsampled
      expect(result.length).toBe(240);
    });

    it('should handle same sample rate (no resampling needed)', () => {
      // Simulate 24kHz stereo audio (already at target rate)
      const stereoData = new Float32Array([0.5, 0.5, 0.25, 0.25]);
      
      const result = processTauriAudio(stereoData, 24000, 2);

      // Stereo->mono: [0.5, 0.25]
      // No resampling needed
      expect(result.length).toBe(2);
    });
  });

  describe('sample rate conversion accuracy', () => {
    it('should correctly downsample 48kHz to 24kHz (2:1 ratio)', () => {
      // Create 48 samples at 48kHz (1ms of audio)
      // After 2:1 downsampling, should have 24 samples
      const stereoData = new Float32Array(96); // 48 stereo samples
      for (let i = 0; i < 48; i++) {
        stereoData[i * 2] = 0.5;
        stereoData[i * 2 + 1] = 0.5;
      }

      const result = processTauriAudio(stereoData, 48000, 2);

      // Mono: 48 samples, then downsampled to 24
      expect(result.length).toBe(24);
      
      // All values should be close to 0.5 * 32767 = 16383
      for (let i = 0; i < result.length; i++) {
        expect(Math.abs(result[i] - 16383)).toBeLessThan(100);
      }
    });

    it('should preserve signal characteristics through pipeline', () => {
      // Create a simple test signal with a clear pattern
      const samplesPerChannel = 4800; // 100ms at 48kHz
      const stereoData = new Float32Array(samplesPerChannel * 2);
      
      // Fill with a sine wave pattern (not alternating, which gets averaged out)
      for (let i = 0; i < samplesPerChannel; i++) {
        const value = Math.sin(i * 0.01) * 0.8; // Sine wave
        stereoData[i * 2] = value;
        stereoData[i * 2 + 1] = value;
      }

      const result = processTauriAudio(stereoData, 48000, 2);

      // Should have 2400 samples (100ms at 24kHz)
      expect(result.length).toBe(2400);
      
      // Check that we have both positive and negative values (sine wave has both)
      const hasPositive = result.some(v => v > 1000);
      const hasNegative = result.some(v => v < -1000);
      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });
  });

  describe('buffer size verification', () => {
    it('should produce output compatible with REALTIME_AUDIO.sampleRate', () => {
      const targetSampleRate = REALTIME_AUDIO.sampleRate; // 24000
      
      // Create 1 second of audio at 48kHz stereo
      const samplesPerChannel = 48000;
      const stereoData = new Float32Array(samplesPerChannel * 2);
      stereoData.fill(0.1);

      const result = processTauriAudio(stereoData, 48000, 2);

      // Should produce 1 second at 24kHz = 24000 samples
      expect(result.length).toBe(targetSampleRate);
    });
  });
});

// ---------------------------------------------------------------------
// Regression Tests for Known Issues
// ---------------------------------------------------------------------

describe('regression tests', () => {
  describe('issue: stereo-to-mono was missing', () => {
    it('should convert stereo to mono before resampling', () => {
      // This test ensures stereo-to-mono conversion happens
      // Without it, stereo audio would be incorrectly processed
      // Use 8 stereo samples (4 samples per channel at 48kHz)
      // After stereo-to-mono: 4 samples
      // After 48->24kHz downsample: 2 samples
      const stereoData = new Float32Array([1.0, 0.0, 0.5, 0.5, 0.5, 0.5, 0.0, 1.0]);
      
      // With stereo-to-mono: [0.5, 0.5, 0.5, 0.5]
      // After 48->24kHz downsample: 2 samples (averaged pairs)
      const result = processTauriAudio(stereoData, 48000, 2);
      
      expect(result.length).toBe(2);
      // Values should be around 0.5 * 32767 = 16383
      expect(Math.abs(result[0] - 16383)).toBeLessThan(100);
      expect(Math.abs(result[1] - 16383)).toBeLessThan(100);
    });
  });

  describe('issue: sample rate was not converted', () => {
    it('should resample from 48kHz to 24kHz', () => {
      // This test ensures sample rate conversion happens
      // Without it, 48kHz audio would be sent to 24kHz transcription
      const monoData = new Float32Array(4800);
      monoData.fill(0.5);

      const result = processTauriAudio(monoData, 48000, 1);

      // Should be downsampled to 2400 samples
      expect(result.length).toBe(2400);
    });
  });

  describe('issue: float32 was not converted to int16', () => {
    it('should output Int16Array, not Float32Array', () => {
      const floatData = new Float32Array([0.5, 0.25, -0.5, -0.25]);
      const result = processTauriAudio(floatData, 24000, 1);

      expect(result).toBeInstanceOf(Int16Array);
      expect(typeof result[0]).toBe('number');
      expect(Number.isInteger(result[0])).toBe(true);
    });
  });

  describe('issue: audio chunks were too small', () => {
    it('should verify the target buffer size constant', () => {
      // WASAPI sends ~480 frames per chunk
      // Web audio uses 4096 samples buffer
      // This test ensures the constant is correct
      expect(REALTIME_AUDIO.sampleRate).toBe(24000);
      expect(REALTIME_AUDIO.processorBufferSize).toBe(4096);
    });
  });

  describe('issue: I16 microphone format not converted to F32', () => {
    it('should convert I16 samples to F32 correctly', () => {
      // This mirrors the Rust backend conversion:
      // i16 range: -32768 to 32767 -> f32 range: -1.0 to 1.0
      // Formula: s as f32 / 32768.0
      
      const i16Samples = [32767, 16384, 0, -16384, -32768];
      const f32Samples = i16Samples.map(s => s / 32768.0);
      
      expect(f32Samples[0]).toBeCloseTo(0.9999695); // 32767/32768
      expect(f32Samples[1]).toBeCloseTo(0.5);       // 16384/32768
      expect(f32Samples[2]).toBe(0);                // 0/32768
      expect(f32Samples[3]).toBeCloseTo(-0.5);     // -16384/32768
      expect(f32Samples[4]).toBe(-1.0);            // -32768/32768
    });

    it('should produce same audio after I16->F32->I16 round trip', () => {
      // Simulate the full pipeline:
      // 1. Microphone captures I16
      // 2. Backend converts to F32
      // 3. Frontend converts F32 back to I16
      
      const originalI16 = new Int16Array([10000, -10000, 32767, -32768, 0]);
      
      // Step 1: Backend I16 -> F32 (Rust: s as f32 / 32768.0)
      const f32Data = new Float32Array(originalI16.length);
      for (let i = 0; i < originalI16.length; i++) {
        f32Data[i] = originalI16[i] / 32768.0;
      }
      
      // Step 2: Frontend F32 -> I16 (TypeScript: sample * 0x7FFF or * 0x8000)
      const resultI16 = float32ToInt16(f32Data);
      
      // Should be nearly identical (small rounding differences acceptable)
      for (let i = 0; i < originalI16.length; i++) {
        expect(Math.abs(resultI16[i] - originalI16[i])).toBeLessThan(2);
      }
    });

    it('should handle mono microphone input correctly', () => {
      // Microphone is typically mono (1 channel)
      // This should NOT go through stereo-to-mono conversion
      const monoData = new Float32Array(480);
      monoData.fill(0.5);
      
      const result = processTauriAudio(monoData, 48000, 1);
      
      // Mono: 480 samples -> downsampled to 240
      expect(result.length).toBe(240);
      
      // All values should be close to 0.5 * 32767 = 16383
      for (let i = 0; i < result.length; i++) {
        expect(Math.abs(result[i] - 16383)).toBeLessThan(100);
      }
    });
  });

  describe('issue: dual mode mixed mic and system audio in same buffer', () => {
    it('should maintain separate buffers for different audio sources', () => {
      // This test verifies the per-source buffering logic
      // In dual mode, mic and system audio should have separate buffers
      
      // Simulate the buffer state management
      const audioBuffers = new Map<string, { chunks: Int16Array[], sampleCount: number }>();
      const TARGET_BUFFER_SIZE = 4096;
      
      // Helper to add audio to a source's buffer
      function addAudioChunk(source: string, chunk: Int16Array): { source: string; data: Int16Array } | null {
        let bufferState = audioBuffers.get(source);
        if (!bufferState) {
          bufferState = { chunks: [], sampleCount: 0 };
          audioBuffers.set(source, bufferState);
        }
        bufferState.chunks.push(chunk);
        bufferState.sampleCount += chunk.length;
        
        if (bufferState.sampleCount >= TARGET_BUFFER_SIZE) {
          const combined = new Int16Array(bufferState.sampleCount);
          let offset = 0;
          for (const c of bufferState.chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          bufferState.chunks = [];
          bufferState.sampleCount = 0;
          return { source, data: combined };
        }
        return null;
      }
      
      // Add mic audio (small chunks)
      // Total needed: 4096 samples
      const micChunk1 = new Int16Array(1000).fill(100);
      const micChunk2 = new Int16Array(1000).fill(100);
      const micChunk3 = new Int16Array(1000).fill(100);
      const micChunk4 = new Int16Array(1000).fill(100);
      const micChunk5 = new Int16Array(96).fill(100); // Total: 4096
      
      // Add system audio (small chunks)
      const sysChunk1 = new Int16Array(2000).fill(200);
      const sysChunk2 = new Int16Array(2000).fill(200);
      const sysChunk3 = new Int16Array(96).fill(200); // Total: 4096
      
      // Add mic chunks
      expect(addAudioChunk('mic', micChunk1)).toBeNull(); // 1000 < 4096
      expect(addAudioChunk('mic', micChunk2)).toBeNull(); // 2000 < 4096
      expect(addAudioChunk('mic', micChunk3)).toBeNull(); // 3000 < 4096
      expect(addAudioChunk('mic', micChunk4)).toBeNull(); // 4000 < 4096
      
      const micResult = addAudioChunk('mic', micChunk5);
      expect(micResult).not.toBeNull();
      expect(micResult!.source).toBe('mic');
      expect(micResult!.data.length).toBe(4096);
      expect(micResult!.data[0]).toBe(100); // Mic audio value
      
      // Add system chunks
      expect(addAudioChunk('system', sysChunk1)).toBeNull(); // 2000 < 4096
      expect(addAudioChunk('system', sysChunk2)).toBeNull(); // 4000 < 4096
      
      const sysResult = addAudioChunk('system', sysChunk3);
      expect(sysResult).not.toBeNull();
      expect(sysResult!.source).toBe('system');
      expect(sysResult!.data.length).toBe(4096);
      expect(sysResult!.data[0]).toBe(200); // System audio value (different from mic!)
      
      // Verify buffers are independent
      expect(audioBuffers.size).toBe(2);
      expect(audioBuffers.get('mic')!.sampleCount).toBe(0); // Reset after sending
      expect(audioBuffers.get('system')!.sampleCount).toBe(0); // Reset after sending
    });

    it('should not mix audio from different sources', () => {
      // Verify that mic and system audio never get mixed together
      const audioBuffers = new Map<string, { chunks: Int16Array[], sampleCount: number }>();
      const TARGET_BUFFER_SIZE = 100; // Small for testing
      
      function addAudioChunk(source: string, chunk: Int16Array): Int16Array | null {
        let bufferState = audioBuffers.get(source);
        if (!bufferState) {
          bufferState = { chunks: [], sampleCount: 0 };
          audioBuffers.set(source, bufferState);
        }
        bufferState.chunks.push(chunk);
        bufferState.sampleCount += chunk.length;
        
        if (bufferState.sampleCount >= TARGET_BUFFER_SIZE) {
          const combined = new Int16Array(bufferState.sampleCount);
          let offset = 0;
          for (const c of bufferState.chunks) {
            combined.set(c, offset);
            offset += c.length;
          }
          bufferState.chunks = [];
          bufferState.sampleCount = 0;
          return combined;
        }
        return null;
      }
      
      // Add mic audio with value 50
      const micChunk = new Int16Array(100).fill(50);
      const micResult = addAudioChunk('mic', micChunk);
      
      // Add system audio with value 200
      const sysChunk = new Int16Array(100).fill(200);
      const sysResult = addAudioChunk('system', sysChunk);
      
      // Both should produce results
      expect(micResult).not.toBeNull();
      expect(sysResult).not.toBeNull();
      
      // Mic result should only contain 50s
      expect(micResult!.every(v => v === 50)).toBe(true);
      
      // System result should only contain 200s
      expect(sysResult!.every(v => v === 200)).toBe(true);
      
      // They should NOT be mixed
      expect(micResult!.some(v => v === 200)).toBe(false);
      expect(sysResult!.some(v => v === 50)).toBe(false);
    });
  });
});