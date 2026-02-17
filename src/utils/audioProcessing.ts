/**
 * Audio processing utilities for Web Audio API
 */

/**
 * Convert Float32Array to 16-bit PCM Int16Array
 */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Downsample audio buffer to target sample rate using averaging
 */
export function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return buffer;
  }
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offset = 0;
  for (let i = 0; i < newLength; i += 1) {
    const nextOffset = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = offset; j < nextOffset && j < buffer.length; j += 1) {
      sum += buffer[j];
      count += 1;
    }
    result[i] = count > 0 ? sum / count : 0;
    offset = nextOffset;
  }
  return result;
}

/**
 * Convert Int16Array to base64 string for WebSocket transmission
 */
export function int16ToBase64(input: Int16Array): string {
  const byteView = new Uint8Array(input.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < byteView.length; i += chunkSize) {
    const slice = byteView.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}