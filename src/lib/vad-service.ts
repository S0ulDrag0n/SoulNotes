// ---------------------------------------------------------------------------
// VAD Service - Voice Activity Detection using Energy-based detection
// ---------------------------------------------------------------------------

import { VAD_CONFIG } from './constants';

/**
 * Result from processing an audio chunk through VAD
 */
export interface VADResult {
  /** Whether speech is currently detected */
  isSpeech: boolean;
  /** Confidence score (0.0-1.0) */
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
  /** Speech detection threshold (0.0-1.0) - energy level to consider as speech */
  threshold?: number;
  /** Minimum speech duration in ms to trigger speech start */
  minSpeechDurationMs?: number;
  /** Minimum silence duration in ms to trigger speech end */
  minSilenceDurationMs?: number;
  /** Sample rate for VAD (must be 8000 or 16000) */
  sampleRate?: number;
  /** Pre-buffer duration in ms */
  preBufferMs?: number;
}

/**
 * Internal state for VAD processing
 */
interface VADState {
  /** Whether currently in speech state */
  isSpeech: boolean;
  /** Samples of speech accumulated */
  speechSampleCount: number;
  /** Samples of silence accumulated */
  silenceSampleCount: number;
  /** Pre-buffer for audio before speech starts */
  preBuffer: Int16Array[];
  /** Pre-buffer total samples */
  preBufferSamples: number;
  /** Running average of energy for adaptive threshold */
  energyAverage: number;
  /** Number of frames processed for averaging */
  frameCount: number;
}

// Singleton VAD instance
let vadServiceInstance: VadService | null = null;

/**
 * Service for Voice Activity Detection using energy-based detection
 * 
 * This is a simple but effective VAD that uses audio energy levels
 * to detect speech. It works without downloading any models and is
 * suitable for real-time applications.
 */
export class VadService {
  private state: VADState;
  private config: Required<VADServiceConfig>;
  private initialized = false;

  constructor(config: VADServiceConfig = {}) {
    this.config = {
      threshold: config.threshold ?? VAD_CONFIG.threshold,
      minSpeechDurationMs: config.minSpeechDurationMs ?? VAD_CONFIG.minSpeechDurationMs,
      minSilenceDurationMs: config.minSilenceDurationMs ?? VAD_CONFIG.minSilenceDurationMs,
      sampleRate: config.sampleRate ?? VAD_CONFIG.sampleRate,
      preBufferMs: config.preBufferMs ?? VAD_CONFIG.preBufferMs,
    };

    // Initialize state
    this.state = {
      isSpeech: false,
      speechSampleCount: 0,
      silenceSampleCount: 0,
      preBuffer: [],
      preBufferSamples: 0,
      energyAverage: 0,
      frameCount: 0,
    };
  }

  /**
   * Initialize the VAD service
   * For energy-based VAD, this is a no-op but maintains API compatibility
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.error('[VAD] Initializing energy-based VAD (no model download required)');
    this.initialized = true;
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Calculate the energy (RMS) of an audio frame
   * @param frame Float32Array of audio samples
   * @returns RMS energy value
   */
  private calculateEnergy(frame: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < frame.length; i++) {
      sumSquares += frame[i] * frame[i];
    }
    return Math.sqrt(sumSquares / frame.length);
  }

  /**
   * Process a frame of audio through VAD
   * @param frame Float32Array of audio samples at 16kHz
   * @returns VAD result indicating speech detection
   */
  async processFrame(frame: Float32Array): Promise<VADResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Calculate energy
    const energy = this.calculateEnergy(frame);
    
    // Update running average for adaptive threshold
    this.state.frameCount++;
    const alpha = 0.95; // Smoothing factor
    this.state.energyAverage = alpha * this.state.energyAverage + (1 - alpha) * energy;
    
    // Adaptive threshold: use configured threshold as base, but adapt to noise level
    // The threshold is relative to the running average
    const adaptiveThreshold = Math.max(
      this.config.threshold * 0.01, // Minimum absolute threshold
      this.state.energyAverage * this.config.threshold // Relative to noise floor
    );
    
    // Determine if this frame contains speech
    const isSpeech = energy > adaptiveThreshold;
    
    // Track state transitions
    const wasSpeech = this.state.isSpeech;
    
    // Update speech/silence counters
    if (isSpeech) {
      this.state.speechSampleCount += frame.length;
      this.state.silenceSampleCount = 0;
    } else {
      this.state.silenceSampleCount += frame.length;
      this.state.speechSampleCount = 0;
    }
    
    // Calculate frame duration in ms
    const frameDurationMs = (frame.length / this.config.sampleRate) * 1000;
    
    // Determine speech start/end based on duration thresholds
    let speechStart = false;
    let speechEnd = false;
    
    if (!wasSpeech && isSpeech) {
      // Potential speech start - check if duration threshold met
      if (this.state.speechSampleCount * frameDurationMs / frame.length >= this.config.minSpeechDurationMs) {
        speechStart = true;
        this.state.isSpeech = true;
      }
    } else if (wasSpeech && !isSpeech) {
      // Potential speech end - check if duration threshold met
      if (this.state.silenceSampleCount * frameDurationMs / frame.length >= this.config.minSilenceDurationMs) {
        speechEnd = true;
        this.state.isSpeech = false;
      }
    }
    
    // Calculate confidence (normalized energy relative to threshold)
    const confidence = Math.min(1.0, energy / adaptiveThreshold);
    
    return {
      isSpeech: this.state.isSpeech,
      confidence,
      speechStart,
      speechEnd,
    };
  }

  /**
   * Process Int16Array audio (converts to Float32 internally)
   * @param pcm16 Int16Array of audio samples at 16kHz
   * @returns VAD result indicating speech detection
   */
  async processInt16(pcm16: Int16Array): Promise<VADResult> {
    // Convert Int16 to Float32
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    return this.processFrame(float32);
  }

  /**
   * Add audio to pre-buffer (for capturing audio before speech starts)
   * @param pcm16 Int16Array of audio samples at 16kHz
   */
  addToPreBuffer(pcm16: Int16Array): void {
    const maxSamples = Math.floor(this.config.preBufferMs * this.config.sampleRate / 1000);
    
    // Add to buffer
    this.state.preBuffer.push(pcm16);
    this.state.preBufferSamples += pcm16.length;
    
    // Trim if too large
    while (this.state.preBufferSamples > maxSamples && this.state.preBuffer.length > 1) {
      const removed = this.state.preBuffer.shift()!;
      this.state.preBufferSamples -= removed.length;
    }
  }

  /**
   * Get and clear the pre-buffer
   * @returns Combined Int16Array of pre-buffered audio
   */
  getAndClearPreBuffer(): Int16Array {
    if (this.state.preBuffer.length === 0) {
      return new Int16Array(0);
    }
    
    // Combine all buffers
    const combined = new Int16Array(this.state.preBufferSamples);
    let offset = 0;
    for (const chunk of this.state.preBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Clear buffer
    this.state.preBuffer = [];
    this.state.preBufferSamples = 0;
    
    return combined;
  }

  /**
   * Reset VAD state (call when speech ends)
   */
  reset(): void {
    this.state = {
      isSpeech: false,
      speechSampleCount: 0,
      silenceSampleCount: 0,
      preBuffer: [],
      preBufferSamples: 0,
      energyAverage: 0,
      frameCount: 0,
    };
  }

  /**
   * Dispose of VAD resources
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    this.reset();
  }
}

/**
 * Downsample 24kHz Int16Array to 16kHz for VAD
 * @param audio24k Int16Array at 24kHz
 * @returns Int16Array at 16kHz
 */
export function downsample24to16(audio24k: Int16Array): Int16Array {
  // 24kHz to 16kHz = 3:2 ratio
  // For every 3 samples at 24kHz, we need 2 samples at 16kHz
  const outputLength = Math.floor(audio24k.length * 2 / 3);
  const result = new Int16Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    // Linear interpolation
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
  // For every 2 samples at 16kHz, we need 3 samples at 24kHz
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
 * @param config Optional configuration (only used on first call)
 * @returns VadService instance
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