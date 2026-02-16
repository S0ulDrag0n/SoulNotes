/**
 * Web Audio Service - Browser implementation for microphone recording
 * 
 * Uses MediaRecorder API with fallback to POST transcription.
 */
import { AudioService, AudioChunk, CaptureMode } from '@/types';

interface WebAudioState {
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  isRecording: boolean;
  chunks: Blob[];
  callbacks: Set<(chunk: AudioChunk) => void>;
  currentMode: CaptureMode | null;
}

export class WebAudioService implements AudioService {
  private state: WebAudioState = {
    mediaRecorder: null,
    stream: null,
    isRecording: false,
    chunks: [],
    callbacks: new Set(),
    currentMode: null,
  };

  async startRecording(
    mode: CaptureMode,
    _devices?: { mic?: string; system?: string }
  ): Promise<void> {
    if (this.state.isRecording) {
      throw new Error('Already recording');
    }

    if (mode === 'system' || mode === 'dual') {
      console.warn('System audio capture not supported in web mode. Falling back to microphone only.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.state.stream = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.chunks.push(event.data);
          this.notifyAudioChunk(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        this.cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.cleanup();
      };

      // Start recording with 30-second chunks
      mediaRecorder.start(30000);

      this.state.mediaRecorder = mediaRecorder;
      this.state.isRecording = true;
      this.state.currentMode = mode;
      this.state.chunks = [];
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Microphone access denied or unavailable');
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.state.mediaRecorder || !this.state.isRecording) {
      return;
    }

    try {
      this.state.mediaRecorder.stop();
    } catch (error) {
      console.error('Error stopping recorder:', error);
    }

    // Wait for onstop to fire and cleanup
    await new Promise<void>((resolve) => {
      const checkStopped = () => {
        if (!this.state.isRecording) {
          resolve();
        } else {
          setTimeout(checkStopped, 100);
        }
      };
      checkStopped();
    });
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

  getRecordedBlob(): Blob | null {
    if (this.state.chunks.length === 0) {
      return null;
    }
    return new Blob(this.state.chunks, { type: 'audio/webm' });
  }

  private notifyAudioChunk(blob: Blob): void {
    // Convert blob to AudioChunk format
    blob.arrayBuffer().then((buffer) => {
      const uint8Array = new Uint8Array(buffer);
      const chunk: AudioChunk = {
        data: uint8Array,
        sampleRate: 48000, // WebM Opus typically uses 48kHz
        channels: 1,
        source: 'mic',
      };

      this.state.callbacks.forEach((cb) => {
        try {
          cb(chunk);
        } catch (error) {
          console.error('Error in audio chunk callback:', error);
        }
      });
    });
  }

  private cleanup(): void {
    if (this.state.stream) {
      this.state.stream.getTracks().forEach((track) => track.stop());
      this.state.stream = null;
    }

    this.state.mediaRecorder = null;
    this.state.isRecording = false;
    this.state.currentMode = null;
  }
}