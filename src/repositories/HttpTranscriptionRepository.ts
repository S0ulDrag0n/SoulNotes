/**
 * HTTP Transcription Repository - Fallback transcription using POST requests
 * 
 * Sends audio chunks to backend for transcription using the /api/transcribe endpoint.
 */
import { TranscriptionRepository, LanguageCode } from '@/types';

export class HttpTranscriptionRepository implements TranscriptionRepository {
  private abortController: AbortController | null = null;

  async transcribeFile(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription API failed: ${response.status}`);
    }

    const text = await response.text();
    return text.trim();
  }

  // HTTP doesn't support streaming - this is a no-op
  // The caller should poll or use WebSocket for real-time
  async startStream(
    _language: LanguageCode,
    _onTranscript: (text: string) => void,
  ): Promise<void> {
    // HTTP fallback doesn't support streaming
    // Use transcribeFile() for batch transcription
    throw new Error(
      'HTTP transcription does not support streaming. Use WebSocketTranscriptionRepository for real-time transcription.'
    );
  }

  stopStream(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}