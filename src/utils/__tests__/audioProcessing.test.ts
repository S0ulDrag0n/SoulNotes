import { describe, it, expect } from 'vitest';
import {
  floatTo16BitPCM,
  downsampleBuffer,
  int16ToBase64,
} from '../audioProcessing';

describe('floatTo16BitPCM', () => {
  it('converts positive values correctly', () => {
    const input = new Float32Array([0, 0.5, 1]);
    const result = floatTo16BitPCM(input);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(Math.floor(0.5 * 0x7fff));
    expect(result[2]).toBe(0x7fff);
  });

  it('converts negative values correctly', () => {
    const input = new Float32Array([-0.5, -1]);
    const result = floatTo16BitPCM(input);
    expect(result[0]).toBe(Math.floor(-0.5 * 0x8000));
    expect(result[1]).toBe(-0x8000);
  });

  it('clamps values outside [-1, 1]', () => {
    const input = new Float32Array([2, -2]);
    const result = floatTo16BitPCM(input);
    expect(result[0]).toBe(0x7fff); // clamped to 1
    expect(result[1]).toBe(-0x8000); // clamped to -1
  });

  it('handles empty array', () => {
    const input = new Float32Array(0);
    const result = floatTo16BitPCM(input);
    expect(result.length).toBe(0);
  });
});

describe('downsampleBuffer', () => {
  it('returns same buffer when sample rates match', () => {
    const input = new Float32Array([1, 2, 3, 4, 5]);
    const result = downsampleBuffer(input, 24000, 24000);
    expect(result).toBe(input); // same reference
  });

  it('downsamples correctly with 2:1 ratio', () => {
    const input = new Float32Array([1, 2, 3, 4]); // 4 samples at 48k
    const result = downsampleBuffer(input, 48000, 24000); // to 2 samples
    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(1.5); // average of [1, 2]
    expect(result[1]).toBeCloseTo(3.5); // average of [3, 4]
  });

  it('handles non-integer ratios', () => {
    const input = new Float32Array([1, 2, 3, 4, 5, 6]); // 6 samples at 48k
    const result = downsampleBuffer(input, 48000, 16000); // 3:1 ratio = 2 samples
    expect(result.length).toBe(2);
  });
});

describe('int16ToBase64', () => {
  it('converts Int16Array to base64', () => {
    const input = new Int16Array([0, 1, -1, 32767, -32768]);
    const result = int16ToBase64(input);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should be valid base64
    expect(() => atob(result)).not.toThrow();
  });

  it('handles empty array', () => {
    const input = new Int16Array(0);
    const result = int16ToBase64(input);
    expect(result).toBe('');
  });

  it('produces consistent results', () => {
    const input = new Int16Array([1000, -2000, 3000]);
    const result1 = int16ToBase64(input);
    const result2 = int16ToBase64(input);
    expect(result1).toBe(result2);
  });
});