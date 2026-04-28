// ---------------------------------------------------------------------------
// useVAD Hook - React hook for Voice Activity Detection
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  VadService,
  VADResult,
  getVadService,
  downsample24to16,
} from '@/lib/vad-service';
import { VAD_CONFIG } from '@/lib/constants';

/**
 * Options for the useVAD hook
 */
export interface UseVADOptions {
  /** Enable VAD filtering (default: true) */
  enabled?: boolean;
  /** Speech detection threshold (0.0-1.0) */
  threshold?: number;
  /** Minimum speech duration in ms to trigger speech start */
  minSpeechDurationMs?: number;
  /** Minimum silence duration in ms to trigger speech end */
  minSilenceDurationMs?: number;
  /** Pre-buffer duration in ms */
  preBufferMs?: number;
  /** Callback when speech starts */
  onSpeechStart?: () => void;
  /** Callback when speech ends */
  onSpeechEnd?: () => void;
}

/**
 * Return type for the useVAD hook
 */
export interface UseVADReturn {
  /** Whether VAD is initialized and ready */
  isReady: boolean;
  /** Whether speech is currently detected */
  isSpeech: boolean;
  /** Whether VAD is enabled */
  isEnabled: boolean;
  /** Initialize the VAD model */
  initialize: () => Promise<void>;
  /** Process audio chunk and return speech detection result */
  processAudio: (pcm16: Int16Array, sampleRate: number) => Promise<VADResult>;
  /** Reset VAD state */
  reset: () => void;
  /** Enable/disable VAD */
  setEnabled: (enabled: boolean) => void;
  /** Get pre-buffered audio (audio before speech started) */
  getPreBuffer: () => Int16Array;
}

/**
 * Hook for Voice Activity Detection
 * 
 * This hook wraps the VadService and provides a React-friendly interface
 * for detecting speech in audio streams. It handles:
 * - Lazy initialization of the ONNX model
 * - Audio resampling from 24kHz to 16kHz for VAD
 * - Pre-buffering audio before speech starts
 * - Speech start/end event callbacks
 * 
 * @param options - VAD configuration options
 * @returns VAD hook interface
 */
export function useVAD(options: UseVADOptions = {}): UseVADReturn {
  const {
    enabled = true,
    threshold = VAD_CONFIG.threshold,
    minSpeechDurationMs = VAD_CONFIG.minSpeechDurationMs,
    minSilenceDurationMs = VAD_CONFIG.minSilenceDurationMs,
    preBufferMs = VAD_CONFIG.preBufferMs,
    onSpeechStart,
    onSpeechEnd,
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [isSpeech, setIsSpeech] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const vadServiceRef = useRef<VadService | null>(null);
  const isInitializingRef = useRef(false);
  const lastSpeechStateRef = useRef(false);

  // Initialize VAD service
  const initialize = useCallback(async () => {
    if (isReady || isInitializingRef.current) return;

    isInitializingRef.current = true;
    try {
      const service = getVadService({
        threshold,
        minSpeechDurationMs,
        minSilenceDurationMs,
        preBufferMs,
      });

      await service.initialize();
      vadServiceRef.current = service;
      setIsReady(true);
      console.log('[useVAD] VAD service initialized');
    } catch (error) {
      console.error('[useVAD] Failed to initialize VAD service:', error);
      throw error;
    } finally {
      isInitializingRef.current = false;
    }
  }, [isReady, threshold, minSpeechDurationMs, minSilenceDurationMs, preBufferMs]);

  // Process audio chunk
  const processAudio = useCallback(async (
    pcm16: Int16Array,
    sampleRate: number
  ): Promise<VADResult> => {
    // If VAD is disabled, return speech always (pass-through)
    if (!isEnabled) {
      return {
        isSpeech: true,
        confidence: 1.0,
        speechStart: false,
        speechEnd: false,
      };
    }

    // If not ready, initialize first
    if (!isReady || !vadServiceRef.current) {
      await initialize();
    }

    if (!vadServiceRef.current) {
      console.warn('[useVAD] VAD service not available, passing audio through');
      return {
        isSpeech: true,
        confidence: 1.0,
        speechStart: false,
        speechEnd: false,
      };
    }

    // Resample audio if needed (VAD requires 16kHz)
    let audioForVad: Int16Array;
    if (sampleRate === 24000) {
      audioForVad = downsample24to16(pcm16);
    } else if (sampleRate === 16000) {
      audioForVad = pcm16;
    } else {
      console.warn(`[useVAD] Unsupported sample rate ${sampleRate}, expected 16000 or 24000`);
      // Pass through as fallback
      return {
        isSpeech: true,
        confidence: 1.0,
        speechStart: false,
        speechEnd: false,
      };
    }

    // Add to pre-buffer (for capturing audio before speech starts)
    vadServiceRef.current.addToPreBuffer(audioForVad);

    // Process through VAD
    const result = await vadServiceRef.current.processInt16(audioForVad);

    // Update speech state
    setIsSpeech(result.isSpeech);

    // Fire callbacks on state transitions
    if (result.speechStart && !lastSpeechStateRef.current) {
      lastSpeechStateRef.current = true;
      onSpeechStart?.();
    }
    if (result.speechEnd && lastSpeechStateRef.current) {
      lastSpeechStateRef.current = false;
      onSpeechEnd?.();
    }

    return result;
  }, [isReady, isEnabled, initialize, onSpeechStart, onSpeechEnd]);

  // Reset VAD state
  const reset = useCallback(() => {
    if (vadServiceRef.current) {
      vadServiceRef.current.reset();
    }
    setIsSpeech(false);
    lastSpeechStateRef.current = false;
  }, []);

  // Enable/disable VAD
  const setEnabled = useCallback((newEnabled: boolean) => {
    setIsEnabled(newEnabled);
    if (!newEnabled) {
      reset();
    }
  }, [reset]);

  // Get pre-buffered audio
  const getPreBuffer = useCallback((): Int16Array => {
    if (!vadServiceRef.current) {
      return new Int16Array(0);
    }
    return vadServiceRef.current.getAndClearPreBuffer();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't dispose the singleton on unmount - it can be reused
      // Just reset the state
      if (vadServiceRef.current) {
        vadServiceRef.current.reset();
      }
    };
  }, []);

  return {
    isReady,
    isSpeech,
    isEnabled,
    initialize,
    processAudio,
    reset,
    setEnabled,
    getPreBuffer,
  };
}

// ---------------------------------------------------------------------------
// Utility function for filtering audio based on VAD
// ---------------------------------------------------------------------------

/**
 * Filter audio chunks based on VAD results
 * 
 * This function accumulates audio chunks and only returns audio
 * when speech is detected. It handles:
 * - Pre-buffering audio before speech starts
 * - Accumulating audio during speech
 * - Returning audio when speech ends
 * 
 * @param vadResult - Result from VAD processing
 * @param currentChunk - Current audio chunk
 * @param preBuffer - Pre-buffered audio from before speech
 * @param speechBuffer - Buffer of speech audio
 * @returns Audio to send to transcription (null if no speech)
 */
export function filterAudioByVAD(
  vadResult: VADResult,
  currentChunk: Int16Array,
  preBuffer: Int16Array,
  speechBuffer: Int16Array[]
): Int16Array | null {
  // If speech just started, include pre-buffer
  if (vadResult.speechStart) {
    // Combine pre-buffer with current chunk
    const combined = new Int16Array(preBuffer.length + currentChunk.length);
    combined.set(preBuffer, 0);
    combined.set(currentChunk, preBuffer.length);
    return combined;
  }

  // If speech is ongoing, return current chunk
  if (vadResult.isSpeech) {
    return currentChunk;
  }

  // If speech just ended, return accumulated speech buffer
  if (vadResult.speechEnd && speechBuffer.length > 0) {
    // Combine all buffered speech chunks
    const totalLength = speechBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of speechBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  // No speech detected
  return null;
}