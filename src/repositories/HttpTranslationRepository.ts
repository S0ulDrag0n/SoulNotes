/**
 * HTTP Translation Repository - Server-sent events for streaming translation
 * 
 * Connects to /api/translate endpoint for streaming translation.
 */
import {
  TranslationRepository,
  TranslationRequest,
  TranslationChunk,
  DEFAULT_CONFIG,
} from '@/types';

export class HttpTranslationRepository implements TranslationRepository {
  private abortController: AbortController | null = null;

  async translateStream(
    request: TranslationRequest,
    onChunk: (chunk: TranslationChunk) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: request.text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Translation API failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onChunk({ text: '', isComplete: true });
                return;
              }
              onChunk({ text: data, isComplete: false });
            }
          }
        }

        // Process any remaining data
        const tail = decoder.decode();
        if (tail) {
          buffer += tail;
          if (buffer.trim()) {
            onChunk({ text: buffer, isComplete: true });
          }
        }

        onChunk({ text: '', isComplete: true });
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}