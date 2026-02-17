/**
 * HTTP Summarization Repository - Meeting notes generation
 * 
 * Connects to /api/summarize endpoint for generating meeting summaries.
 */
import { SummarizationRepository } from '@/types';

export class HttpSummarizationRepository implements SummarizationRepository {
  private abortController: AbortController | null = null;

  async summarize(text: string): Promise<string> {
    this.abortController = new AbortController();

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Summarization API failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          result += chunk;
        }

        // Process any remaining data
        const tail = decoder.decode();
        if (tail) {
          result += tail;
        }

        return result;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return '';
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