/**
 * Tauri Audio Service - Desktop implementation supporting system audio capture
 * 
 * Uses Tauri native APIs to capture microphone and/or system audio.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { AudioService, AudioChunk, CaptureMode } from '@/types';

interface TauriAudioState {
  isRecording: boolean;
  callbacks: Set<(chunk: AudioChunk) => void>;
  currentMode: CaptureMode | null;
  unlisten: UnlistenFn | null;
}

export class TauriAudioService implements AudioService {
  private state: TauriAudioState = {
    isRecording: false,
    callbacks: new Set(),
    currentMode: null,
    unlisten: null,
  };

  async startRecording(
    mode: CaptureMode,
    devices?: { mic?: string; system?: string }
  ): Promise<void> {
    if (this.state.isRecording) {
      throw new Error('Already recording');
    }

    try {
      // Listen for audio chunks from Tauri backend
      this.state.unlisten = await listen<{
        data: number[];
        sampleRate: number;
        source: 'mic' | 'system';
      }>('audio-chunk', (event) => {
        const chunk: AudioChunk = {
          data: new Uint8Array(event.payload.data),
          sampleRate: event.payload.sampleRate,
          channels: 1,
          source: event.payload.source,
        };

        this.state.callbacks.forEach((cb) => {
          try {
            cb(chunk);
          } catch (error) {
            console.error('Error in audio chunk callback:', error);
          }
        });
      });

      // Start native audio capture
      await invoke('start_audio_capture', {
        mode,
        micDevice: devices?.mic,
        systemDevice: devices?.system,
      });

      this.state.isRecording = true;
      this.state.currentMode = mode;
    } catch (error) {
      console.error('Failed to start Tauri audio capture:', error);
      throw new Error('Failed to start audio capture');
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.state.isRecording) {
      return;
    }

    try {
      await invoke('stop_audio_capture');
    } catch (error) {
      console.error('Error stopping audio capture:', error);
    }

    if (this.state.unlisten) {
      this.state.unlisten();
      this.state.unlisten = null;
    }

    this.state.isRecording = false;
    this.state.currentMode = null;
  }

  onAudioChunk(callback: (chunk: AudioChunk) => void): () => void {
    this.state.callbacks.add(callback);
    return () => {
      this.state.callbacks.delete(callback);
    };
  }

  isRecording(): boolean {
    return this.state.isRecording;
  }
}