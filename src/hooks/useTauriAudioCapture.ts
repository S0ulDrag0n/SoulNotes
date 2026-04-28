// Hook for Tauri audio capture in desktop mode

import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { downsampleBuffer } from '@/utils/audio';
import { REALTIME_AUDIO } from '@/lib/constants';

export type CaptureMode = 'microphone' | 'system' | 'dual';

export interface AudioChunkEvent {
  data: number[];
  sample_rate: number;
  channels: number;
  source: string;
}

export interface UseTauriAudioCaptureReturn {
  isCapturing: boolean;
  startCapture: (
    captureMode: CaptureMode,
    micDevice?: string,
    systemDevice?: string
  ) => Promise<void>;
  stopCapture: () => Promise<void>;
  onAudioChunk: ((chunk: Int16Array, sampleRate: number, source: string) => void) | null;
  setOnAudioChunk: (callback: ((chunk: Int16Array, sampleRate: number, source: string) => void) | null) => void;
}

// ---------------------------------------------------------------------
// Tauri Audio Capture Hook
// ---------------------------------------------------------------------
export function useTauriAudioCapture(): UseTauriAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  // Use a ref to track isCapturing to avoid stale closure issues in callbacks
  const isCapturingRef = useRef(false);
  const onAudioChunkRef = useRef<((chunk: Int16Array, sampleRate: number, source: string) => void) | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const unlistenErrorRef = useRef<UnlistenFn | null>(null);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  
  // Audio buffers per source to accumulate chunks before sending (match web audio buffer size)
  // In dual mode, we need separate buffers for mic and system audio
  const audioBuffersRef = useRef<Map<string, { chunks: Int16Array[], sampleCount: number }>>(new Map());
  // Target buffer size: 4096 samples at 24kHz (matches REALTIME_AUDIO.processorBufferSize)
  const TARGET_BUFFER_SIZE = REALTIME_AUDIO.processorBufferSize; // 4096

  // ---------------------------------------------------------------------
  // Set audio chunk callback
  // ---------------------------------------------------------------------
  const setOnAudioChunk = useCallback((callback: ((chunk: Int16Array, sampleRate: number, source: string) => void) | null) => {
    console.error('[TauriAudio] setOnAudioChunk called, callback:', callback ? 'provided' : 'null');
    onAudioChunkRef.current = callback;
  }, []);

  // ---------------------------------------------------------------------
  // Start audio capture
  // ---------------------------------------------------------------------
  const startCapture = useCallback(async (
    captureMode: CaptureMode,
    micDevice?: string,
    systemDevice?: string
  ): Promise<void> => {
    console.error('[TauriAudio] startCapture called, mode:', captureMode, 'mic:', micDevice, 'system:', systemDevice);
    console.error('[TauriAudio] onAudioChunkRef.current:', onAudioChunkRef.current ? 'set' : 'null');
    
    // Prevent double-starts (but allow restart with new parameters)
    if (isStartingRef.current) {
      // Reset the stuck ref and continue
      isStartingRef.current = false;
    }

    // If already capturing, stop first to restart with new parameters
    if (isCapturingRef.current) {
      try {
        await invoke('stop_audio_capture');
      } catch (err) {
        // Continue even if stop fails
      }
      // Clear buffers
      audioBuffersRef.current.clear();
      // Clean up event listeners
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (unlistenErrorRef.current) {
        unlistenErrorRef.current();
        unlistenErrorRef.current = null;
      }
      setIsCapturing(false);
      isCapturingRef.current = false;
    }

    isStartingRef.current = true;

    try {
      // Set up event listener for audio chunks before starting capture
      console.error('[TauriAudio] Setting up audio-chunk event listener...');
      unlistenRef.current = await listen<AudioChunkEvent>('audio-chunk', (event) => {
        const { data, sample_rate, source } = event.payload;
        // Use console.error for visibility in Tauri (console.log may be filtered)
        console.error('[TauriAudio] Audio chunk event received, samples:', data.length, 'rate:', sample_rate, 'source:', source);

        if (!onAudioChunkRef.current) {
          console.error('[TauriAudio] No audio chunk callback set - audio will be dropped');
          return;
        }

        // Convert the byte array to Float32Array
        // The data is little-endian bytes of f32 samples
        const byteData = new Uint8Array(data);
        const f32Data = new Float32Array(byteData.buffer);
        
        // Get channel count from event payload
        const channels = event.payload.channels || 1;
        
        // Convert stereo to mono if needed (transcription expects mono)
        // WASAPI loopback captures stereo (2 channels) interleaved: [L, R, L, R, ...]
        let monoData: Float32Array;
        if (channels === 2) {
          // Average left and right channels
          const monoLength = Math.floor(f32Data.length / 2);
          monoData = new Float32Array(monoLength);
          for (let i = 0; i < monoLength; i++) {
            const left = f32Data[i * 2];
            const right = f32Data[i * 2 + 1];
            monoData[i] = (left + right) / 2;
          }
        } else {
          monoData = f32Data;
        }
        
        // Resample from native sample rate to 24kHz (expected by transcription service)
        // This is critical - WASAPI captures at device native rate (typically 48kHz)
        // but the transcription service expects 24kHz
        const targetSampleRate = REALTIME_AUDIO.sampleRate; // 24000
        const resampledData = sample_rate !== targetSampleRate
          ? downsampleBuffer(monoData, sample_rate, targetSampleRate)
          : monoData;
        
        // Convert f32 to i16 (same as web audio does)
        const i16Data = new Int16Array(resampledData.length);
        for (let i = 0; i < resampledData.length; i++) {
          // Clamp and convert to 16-bit signed integer
          const sample = Math.max(-1, Math.min(1, resampledData[i]));
          i16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Buffer the audio per source to match web audio buffer size (4096 samples)
        // This prevents sending too many small chunks to the transcription service
        // Each source (mic, system) has its own buffer to avoid mixing audio in dual mode
        let bufferState = audioBuffersRef.current.get(source);
        if (!bufferState) {
          bufferState = { chunks: [], sampleCount: 0 };
          audioBuffersRef.current.set(source, bufferState);
        }
        bufferState.chunks.push(i16Data);
        bufferState.sampleCount += i16Data.length;
        
        // Send when we have enough samples buffered for this source
        if (bufferState.sampleCount >= TARGET_BUFFER_SIZE) {
          // Combine all buffered chunks for this source
          const combined = new Int16Array(bufferState.sampleCount);
          let offset = 0;
          for (const chunk of bufferState.chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          
          // Reset buffer for this source
          bufferState.chunks = [];
          bufferState.sampleCount = 0;
          
          // Call the callback with the buffered audio data
          console.error('[TauriAudio] Calling onAudioChunk callback, samples:', combined.length, 'rate:', targetSampleRate, 'source:', source);
          onAudioChunkRef.current(combined, targetSampleRate, source);
        }
      });
      console.error('[TauriAudio] Event listener registered, waiting for audio-chunk events...');

      // Also listen for audio errors
      const unlistenError = await listen<string>('audio-error', (event) => {
        console.error('[TauriAudio] Audio error:', event.payload);
      });

      // Start the appropriate capture based on mode
      console.error('[TauriAudio] Invoking Tauri command for mode:', captureMode);
      if (captureMode === 'dual') {
        await invoke('start_dual_audio_capture', {
          micDevice: micDevice || null,
          systemDevice: systemDevice || null,
        });
      } else if (captureMode === 'system') {
        await invoke('start_audio_capture', {
          deviceName: systemDevice || null,
          isSystemAudio: true,
        });
      } else {
        // captureMode === 'microphone'
        await invoke('start_audio_capture', {
          deviceName: micDevice || null,
          isSystemAudio: false,
        });
      }

      setIsCapturing(true);
      isCapturingRef.current = true;
      console.error('[TauriAudio] Capture started successfully');

      // Store error unlistener for cleanup
      unlistenErrorRef.current = unlistenError;

    } catch (error) {
      // Clean up event listener on failure
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      
      throw error;
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Stop audio capture
  // ---------------------------------------------------------------------
  const stopCapture = useCallback(async (): Promise<void> => {
    // Prevent double-stops
    if (isStoppingRef.current || !isCapturingRef.current) {
      return;
    }

    isStoppingRef.current = true;

    try {
      await invoke('stop_audio_capture');
    } catch (error) {
      console.error('[TauriAudio] Stop error:', error);
      // Continue with cleanup even if stop fails
    }
    
    // Always reset refs and state, even if there were errors
    // Clear all audio buffers
    audioBuffersRef.current.clear();

    // Clean up event listeners
    if (unlistenRef.current) {
      try {
        unlistenRef.current();
      } catch (e) {
        // Ignore cleanup errors
      }
      unlistenRef.current = null;
    }
    if (unlistenErrorRef.current) {
      try {
        unlistenErrorRef.current();
      } catch (e) {
        // Ignore cleanup errors
      }
      unlistenErrorRef.current = null;
    }

    setIsCapturing(false);
    isCapturingRef.current = false;
    
    // Always reset this last
    isStoppingRef.current = false;
  }, []);

  // ---------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (unlistenErrorRef.current) {
        unlistenErrorRef.current();
        unlistenErrorRef.current = null;
      }
    };
  }, []);

  return {
    isCapturing,
    startCapture,
    stopCapture,
    onAudioChunk: onAudioChunkRef.current,
    setOnAudioChunk,
  };
}