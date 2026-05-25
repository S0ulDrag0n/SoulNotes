// ---------------------------------------------------------------------------
// VAD Service - Voice Activity Detection using Silero ONNX model
// ---------------------------------------------------------------------------
// Silero VAD is a small (~2.2MB) neural network that accurately detects speech
// in audio streams. It's stateful (recurrent) — it maintains hidden state
// across frames for continuous processing.
//
// Model requirements:
// - Input: 512 samples at 16kHz (32ms frames)
// - Output: Speech probability (0.0-1.0)
// - Stateful: combined state tensor [2, 1, 128] carried across frames
// - Sample rate: 16kHz
//
// Model format (v4):
//   Inputs:  input [1, 512], state [2, 1, 128], sr [1] (int64)
//   Outputs: output [1, 1], stateN [2, 1, 128]
// ---------------------------------------------------------------------------

import { VAD_CONFIG } from './constants';

// Lazy-load onnxruntime-web only when needed (avoids loading WASM for web path)
let ort: typeof import('onnxruntime-web') | null = null;
let ortLoading = false;

async function getOrt() {
  if (ort) return ort;
  if (ortLoading) {
    while (ortLoading) await new Promise(r => setTimeout(r, 50));
    return ort!;
  }
  ortLoading = true;
  try {
    ort = await import('onnxruntime-web');
    // Configure WASM paths — resolve from public/models/ directory
    ort.env.wasm.wasmPaths = '/models/';
    return ort;
  } finally {
    ortLoading = false;
  }
}

/**
 * Result from processing an audio chunk through VAD
 */
export interface VADResult {
  /** Whether speech is currently detected (after debounce) */
  isSpeech: boolean;
  /** Confidence score (0.0-1.0) — raw speech probability from model */
  confidence: number;
  /** True when speech starts (transition from silence to speech) */
  speechStart: boolean;
  /** True when speech ends (transition from speech to silence) */
  speechEnd: boolean;
}

/**
 * Configuration for VAD service initialization
 */
export interface VADServiceConfig {
  /** Speech probability threshold (0.0-1.0) */
  threshold?: number;
  /** Minimum speech duration in ms to trigger speech start */
  minSpeechDurationMs?: number;
  /** Minimum silence duration in ms to trigger speech end */
  minSilenceDurationMs?: number;
  /** Sample rate for VAD (must be 16000 for Silero) */
  sampleRate?: number;
  /** Frame size in samples (512 for 16kHz Silero) */
  frameSize?: number;
  /** Pre-buffer duration in ms */
  preBufferMs?: number;
}

/**
 * Internal state for VAD debounce logic
 */
interface VADDebounceState {
  /** Whether currently in speech state (after debounce) */
  isSpeech: boolean;
  /** Consecutive frames with speech probability above threshold */
  speechFrameCount: number;
  /** Consecutive frames with speech probability below threshold */
  silenceFrameCount: number;
  /** Pre-buffer for audio before speech starts */
  preBuffer: Int16Array[];
  /** Pre-buffer total samples */
  preBufferSamples: number;
}

// Silero model state dimensions
const STATE_DIMS = [2, 1, 128] as const;
const STATE_SIZE = 2 * 1 * 128; // 256
const FRAME_SIZE = 512; // Silero v4 requires exactly 512 samples at 16kHz

// Singleton VAD instance
let vadServiceInstance: VadService | null = null;

/**
 * Service for Voice Activity Detection using Silero ONNX model
 *
 * The Silero VAD model is a small recurrent neural network (~2.2MB) that
 * provides accurate speech detection. It requires:
 * - ONNX Runtime Web (loaded lazily, WASM backend)
 * - silero_vad.onnx model file in public/models/
 * - Audio at 16kHz, in frames of exactly 512 samples (32ms)
 *
 * The model is stateful — it carries a combined state tensor [2,1,128]
 * across frames for accurate continuous detection.
 */
export class VadService {
  private session: any | null = null; // InferenceSession
  private stateTensor: Float32Array;  // Combined state [2, 1, 128]
  private debounce: VADDebounceState;
  private config: Required<VADServiceConfig>;
  private initialized = false;
  private modelLoading = false;

  constructor(config: VADServiceConfig = {}) {
    this.config = {
      threshold: config.threshold ?? VAD_CONFIG.threshold,
      minSpeechDurationMs: config.minSpeechDurationMs ?? VAD_CONFIG.minSpeechDurationMs,
      minSilenceDurationMs: config.minSilenceDurationMs ?? VAD_CONFIG.minSilenceDurationMs,
      sampleRate: config.sampleRate ?? VAD_CONFIG.sampleRate,
      frameSize: config.frameSize ?? VAD_CONFIG.frameSize,
      preBufferMs: config.preBufferMs ?? VAD_CONFIG.preBufferMs,
    };

    // Initialize Silero combined state tensor (zeros)
    this.stateTensor = new Float32Array(STATE_SIZE);

    // Initialize debounce state
    this.debounce = {
      isSpeech: false,
      speechFrameCount: 0,
      silenceFrameCount: 0,
      preBuffer: [],
      preBufferSamples: 0,
    };
  }

  /**
   * Initialize the VAD service — loads Silero ONNX model
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.modelLoading) {
      while (this.modelLoading) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }

    this.modelLoading = true;
    try {
      const ortModule = await getOrt();

      this.session = await ortModule.InferenceSession.create('/models/silero_vad.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.initialized = true;
      console.error('[VAD] Silero ONNX model loaded successfully');
    } catch (error) {
      console.error('[VAD] Failed to load Silero ONNX model:', error);
      throw error;
    } finally {
      this.modelLoading = false;
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Run Silero inference on a single 512-sample frame at 16kHz
   * @param frame Int16Array of exactly 512 samples at 16kHz
   * @returns Speech probability (0.0-1.0)
   */
  private async runInference(frame: Int16Array): Promise<number> {
    if (!this.session) {
      throw new Error('VAD session not initialized');
    }

    const ortModule = await getOrt();

    // Convert Int16 to Float32 normalized to [-1, 1]
    const floatData = new Float32Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
      floatData[i] = (i < frame.length ? frame[i] : 0) / 32768.0;
    }

    // Create input tensors
    const inputTensor = new ortModule.Tensor('float32', floatData, [1, FRAME_SIZE]);
    const stateTensor = new ortModule.Tensor('float32', this.stateTensor, [...STATE_DIMS]);
    const srTensor = new ortModule.Tensor('int64', BigInt64Array.from([BigInt(this.config.sampleRate)]), [1]);

    // Run inference
    const results = await this.session.run({
      input: inputTensor,
      state: stateTensor,
      sr: srTensor,
    });

    // Update state tensor from model output
    if (results.stateN) {
      this.stateTensor = new Float32Array(results.stateN.data);
    }

    // Extract speech probability
    if (results.output && results.output.data) {
      return results.output.data[0] as number;
    }

    return 0;
  }

  /**
   * Process an audio chunk through VAD
   *
   * Handles:
   * - Slicing the chunk into 512-sample frames for Silero
   * - Running inference on each frame
   * - Debouncing speech start/end based on min duration thresholds
   * - Pre-buffering audio before speech starts
   *
   * @param pcm16 Int16Array of audio at 16kHz (any length, will be sliced into frames)
   * @returns VAD result with speech detection state
   */
  async processInt16(pcm16: Int16Array): Promise<VADResult> {
    if (!this.initialized || !this.session) {
      // Not ready — return "speech detected" as passthrough
      // Caller should send audio directly when VAD isn't available
      return {
        isSpeech: true,
        confidence: 1.0,
        speechStart: false,
        speechEnd: false,
      };
    }

    // Add to pre-buffer
    this.addToPreBuffer(pcm16);

    // Process in 512-sample frames
    let lastSpeechProb = 0;
    let hadSpeech = false;
    let hadSilence = false;

    for (let offset = 0; offset < pcm16.length; offset += FRAME_SIZE) {
      const end = Math.min(offset + FRAME_SIZE, pcm16.length);
      const frame = pcm16.slice(offset, end);

      // Skip frames that are too short (< 75% of required size)
      if (frame.length < FRAME_SIZE * 0.75) {
        continue;
      }

      // Pad short frames with zeros (Silero requires exactly 512 samples)
      let processFrame: Int16Array;
      if (frame.length < FRAME_SIZE) {
        processFrame = new Int16Array(FRAME_SIZE);
        processFrame.set(frame);
      } else {
        processFrame = frame;
      }

      try {
        const prob = await this.runInference(processFrame);
        lastSpeechProb = prob;

        if (prob >= this.config.threshold) {
          hadSpeech = true;
          this.debounce.speechFrameCount++;
          this.debounce.silenceFrameCount = 0;
        } else {
          hadSilence = true;
          this.debounce.silenceFrameCount++;
          this.debounce.speechFrameCount = 0;
        }
      } catch (error) {
        console.error('[VAD] Inference error:', error);
        // On error, pass audio through
        return {
          isSpeech: true,
          confidence: 1.0,
          speechStart: false,
          speechEnd: false,
        };
      }
    }

    // Calculate frame duration for debounce
    const frameDurationMs = (FRAME_SIZE / this.config.sampleRate) * 1000; // 32ms per frame

    // Determine speech start/end with debounce
    let speechStart = false;
    let speechEnd = false;
    const wasSpeech = this.debounce.isSpeech;

    if (!wasSpeech && hadSpeech) {
      const speechDurationMs = this.debounce.speechFrameCount * frameDurationMs;
      if (speechDurationMs >= this.config.minSpeechDurationMs) {
        this.debounce.isSpeech = true;
        speechStart = true;
      }
    }

    if (wasSpeech && hadSilence) {
      const silenceDurationMs = this.debounce.silenceFrameCount * frameDurationMs;
      if (silenceDurationMs >= this.config.minSilenceDurationMs) {
        this.debounce.isSpeech = false;
        speechEnd = true;
      }
    }

    return {
      isSpeech: this.debounce.isSpeech,
      confidence: lastSpeechProb,
      speechStart,
      speechEnd,
    };
  }

  /**
   * Process Float32Array audio (converts to Int16 internally)
   * Kept for API compatibility with useVAD hook
   */
  async processFrame(frame: Float32Array): Promise<VADResult> {
    const pcm16 = new Int16Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const sample = Math.max(-1, Math.min(1, frame[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return this.processInt16(pcm16);
  }

  /**
   * Add audio to pre-buffer (for capturing audio before speech starts)
   */
  addToPreBuffer(pcm16: Int16Array): void {
    const maxSamples = Math.floor(this.config.preBufferMs * this.config.sampleRate / 1000);

    this.debounce.preBuffer.push(pcm16);
    this.debounce.preBufferSamples += pcm16.length;

    // Trim if too large
    while (this.debounce.preBufferSamples > maxSamples && this.debounce.preBuffer.length > 1) {
      const removed = this.debounce.preBuffer.shift()!;
      this.debounce.preBufferSamples -= removed.length;
    }
  }

  /**
   * Get and clear the pre-buffer
   */
  getAndClearPreBuffer(): Int16Array {
    if (this.debounce.preBuffer.length === 0) {
      return new Int16Array(0);
    }

    const combined = new Int16Array(this.debounce.preBufferSamples);
    let offset = 0;
    for (const chunk of this.debounce.preBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    this.debounce.preBuffer = [];
    this.debounce.preBufferSamples = 0;

    return combined;
  }

  /**
   * Reset debounce state after speech ends.
   *
   * IMPORTANT: This does NOT reset the Silero model hidden state.
   * The recurrent model needs its hidden state to maintain context across
   * speech segments — resetting it causes the model to go "cold", leading
   * to false negatives (missed speech) for several frames after reset.
   * This was the root cause of the "app stops picking up sound after silence" bug.
   *
   * Only reset the full model state when explicitly stopping capture
   * (see `resetFull()`).
   */
  reset(): void {
    this.debounce = {
      isSpeech: false,
      speechFrameCount: 0,
      silenceFrameCount: 0,
      // Keep the pre-buffer rolling — don't clear it on speech end.
      // Audio already in the pre-buffer belongs to the gap between segments,
      // which is useful context if speech starts again soon.
      preBuffer: this.debounce.preBuffer,
      preBufferSamples: this.debounce.preBufferSamples,
    };
  }

  /**
   * Full reset including Silero model hidden state.
   * Use only when stopping capture entirely (e.g., user stops recording),
   * NOT between speech segments.
   */
  resetFull(): void {
    this.debounce = {
      isSpeech: false,
      speechFrameCount: 0,
      silenceFrameCount: 0,
      preBuffer: [],
      preBufferSamples: 0,
    };

    // Reset Silero state tensor
    this.stateTensor = new Float32Array(STATE_SIZE);
  }

  /**
   * Dispose of VAD resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      this.session = null;
    }
    this.initialized = false;
    this.resetFull();
  }
}

/**
 * Downsample 24kHz Int16Array to 16kHz for VAD
 * @param audio24k Int16Array at 24kHz
 * @returns Int16Array at 16kHz
 */
export function downsample24to16(audio24k: Int16Array): Int16Array {
  // 24kHz to 16kHz = 3:2 ratio
  const outputLength = Math.floor(audio24k.length * 2 / 3);
  const result = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * 3 / 2;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audio24k.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    result[i] = Math.round(
      audio24k[srcIndexFloor] * (1 - fraction) +
      audio24k[srcIndexCeil] * fraction
    );
  }

  return result;
}

/**
 * Upsample 16kHz Int16Array to 24kHz for Whisper
 * @param audio16k Int16Array at 16kHz
 * @returns Int16Array at 24kHz
 */
export function upsample16to24(audio16k: Int16Array): Int16Array {
  // 16kHz to 24kHz = 2:3 ratio
  const outputLength = Math.floor(audio16k.length * 3 / 2);
  const result = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * 2 / 3;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audio16k.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    result[i] = Math.round(
      audio16k[srcIndexFloor] * (1 - fraction) +
      audio16k[srcIndexCeil] * fraction
    );
  }

  return result;
}

/**
 * Get the singleton VAD service instance
 */
export function getVadService(config?: VADServiceConfig): VadService {
  if (!vadServiceInstance) {
    vadServiceInstance = new VadService(config);
  }
  return vadServiceInstance;
}

/**
 * Dispose of the singleton VAD service instance
 */
export async function disposeVadService(): Promise<void> {
  if (vadServiceInstance) {
    await vadServiceInstance.dispose();
    vadServiceInstance = null;
  }
}