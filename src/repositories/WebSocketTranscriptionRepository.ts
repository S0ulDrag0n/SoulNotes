/**
 * WebSocket Transcription Repository - Real-time streaming transcription
 * 
 * Connects to Speaches WebSocket endpoint for live audio transcription.
 */
import { TranscriptionRepository, LanguageCode, DEFAULT_CONFIG } from '@/types';

export class WebSocketTranscriptionRepository implements TranscriptionRepository {
  private ws: WebSocket | null = null;
  private onTranscript: ((text: string) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private language: LanguageCode = 'en';

  async startStream(
    language: LanguageCode,
    onTranscript: (text: string) => void
  ): Promise<void> {
    this.language = language;
    this.onTranscript = onTranscript;
    this.reconnectAttempts = 0;

    return this.connect();
  }

  private async connect(): Promise<void> {
    const baseUrl = DEFAULT_CONFIG.speachesBaseUrl;
    const wsUrl = new URL('/v1/realtime', baseUrl);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const wsUrlWithParams = `${wsUrl.toString()}?intent=transcription&model=${encodeURIComponent(
      DEFAULT_CONFIG.speachesTranscribeModel
    )}&language=${encodeURIComponent(this.language)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrlWithParams);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            this.parseMessage(event.data);
          }
        };

        this.ws.onclose = () => {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              this.connect().catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        this.ws.onerror = (error) => {
          reject(new Error(`WebSocket error: ${error.type}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  stopStream(): void {
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        this.ws.close();
      } catch {
        // Ignore cleanup errors
      }
      this.ws = null;
    }
    this.onTranscript = null;
    this.reconnectAttempts = 0;
  }

  sendAudio(audio: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const base64 = this.uint8ToBase64(audio);
      this.ws.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
      );
    } catch (error) {
      console.error('Failed to send audio:', error);
    }
  }

  private uint8ToBase64(data: Uint8Array): string {
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  }

  private parseMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      // Handle transcription completed event
      if (data?.type === 'conversation.item.input_audio_transcription.completed') {
        const text =
          data.transcript ??
          data.item?.transcript ??
          data.item?.content?.[0]?.transcript;
        if (text && this.onTranscript) {
          this.onTranscript(text);
        }
        return;
      }

      // Handle text/transcript fields directly
      const text =
        data.text ?? data.transcript ?? data.output_text ?? data.delta ?? data.content;
      if (typeof text === 'string' && this.onTranscript) {
        this.onTranscript(text);
      }
    } catch {
      // If JSON parsing fails, treat as raw text
      if (this.onTranscript) {
        this.onTranscript(message);
      }
    }
  }

  async transcribeFile(_audioBlob: Blob): Promise<string> {
    // WebSocket is for streaming, not batch
    throw new Error(
      'WebSocket transcription does not support file transcription. Use HttpTranscriptionRepository for batch transcription.'
    );
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}