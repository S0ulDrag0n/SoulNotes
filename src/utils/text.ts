// Text processing utilities for translation and summarization

import { isDesktopMode } from './platform';

// ---------------------------------------------------------------------
// Extract a translatable chunk from buffer
// ---------------------------------------------------------------------
export interface ExtractChunkResult {
  chunk: string;
  rest: string;
}

export function extractTranslatableChunk(
  buffer: string,
  isIdle: boolean,
  intervalElapsed: boolean,
  maxChunkLength: number
): ExtractChunkResult {
  const trimmed = buffer.replace(/^\s+/, '');
  if (!trimmed) {
    return { chunk: '', rest: '' };
  }

  // Only send on idle or interval
  if (!isIdle && !intervalElapsed) {
    return { chunk: '', rest: trimmed };
  }

  // On idle, send everything
  if (isIdle) {
    return { chunk: trimmed, rest: '' };
  }

  // Otherwise, split into chunks
  const chunk = trimmed.slice(0, maxChunkLength);
  const rest = trimmed.slice(chunk.length).replace(/^\s+/, '');
  return { chunk, rest };
}

// ---------------------------------------------------------------------
// Generate a unique message ID
// ---------------------------------------------------------------------
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ---------------------------------------------------------------------
// Format transcript messages for saving to markdown file
// ---------------------------------------------------------------------
export interface TranscriptMessage {
  text: string;
  timestamp: Date;
}

/**
 * Format transcript messages for saving to markdown file
 * Each line prefixed with date/time from the message timestamp
 */
export function formatTranscriptForSave(
  messages: TranscriptMessage[]
): string {
  if (messages.length === 0) return '';
  
  // Format each message with its own timestamp prefix
  const lines = messages.map(m => {
    const dateStr = m.timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = m.timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} ${timeStr} ${m.text}`;
  });
  
  return lines.join('\n');
}

// ---------------------------------------------------------------------
// Save content to file (platform-aware)
// In desktop mode: uses Tauri dialog + fs plugins for native save dialog
// In web mode: triggers browser download
// ---------------------------------------------------------------------
export async function saveToFile(content: string, filename: string): Promise<void> {
  if (!content.trim()) {
    alert('No content to save');
    return;
  }

  // Desktop mode: use Tauri dialog + fs plugins
  if (isDesktopMode()) {
    const { saveFile: tauriSave } = await import('@/lib/tauri');
    await tauriSave(content, filename);
    return;
  }

  // Web mode: use browser download
  const isMarkdown = filename.endsWith('.md');
  const mimeType = isMarkdown ? 'text/markdown' : 'text/plain';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
