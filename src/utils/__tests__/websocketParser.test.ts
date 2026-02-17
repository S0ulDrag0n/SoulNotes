import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TranscriptAppender } from '../websocketParser';
import {
  parseRealtimeMessage,
  buildSessionInstructions,
  createRealtimeWebSocketUrl,
} from '../websocketParser';

describe('parseRealtimeMessage', () => {
  let mockAppender: TranscriptAppender;

  beforeEach(() => {
    mockAppender = vi.fn() as unknown as TranscriptAppender;
  });

  it('handles streaming delta messages', () => {
    const message = JSON.stringify({
      type: 'conversation.item.input_audio_transcription.delta',
      delta: 'partial text',
    });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('partial text', false);
  });

  it('handles completed transcription messages', () => {
    const message = JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'final text',
    });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('final text', true);
  });

  it('handles string-only messages', () => {
    parseRealtimeMessage('plain text', mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('plain text', true);
  });

  it('handles JSON string messages', () => {
    parseRealtimeMessage('"json string"', mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('json string', true);
  });

  it('handles fallback text fields', () => {
    const message = JSON.stringify({ text: 'fallback text' });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('fallback text', true);
  });

  it('handles transcript fallback field', () => {
    const message = JSON.stringify({ transcript: 'transcript field' });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('transcript field', true);
  });

  it('handles output_text fallback field', () => {
    const message = JSON.stringify({ output_text: 'output text' });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('output text', true);
  });

  it('ignores empty delta messages', () => {
    const message = JSON.stringify({
      type: 'conversation.item.input_audio_transcription.delta',
      delta: '',
    });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).not.toHaveBeenCalled();
  });

  it('handles invalid JSON as plain text', () => {
    parseRealtimeMessage('invalid { json', mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('invalid { json', true);
  });

  it('handles nested item structure', () => {
    const message = JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      item: {
        content: [{ transcript: 'nested text' }],
      },
    });
    parseRealtimeMessage(message, mockAppender);
    expect(mockAppender).toHaveBeenCalledWith('nested text', true);
  });
});

describe('buildSessionInstructions', () => {
  it('includes base instructions for English', () => {
    const result = buildSessionInstructions('en', 'traditional');
    expect(result).toContain('Your knowledge cutoff is 2023-10');
    expect(result).not.toContain('Chinese');
  });

  it('adds Traditional Chinese instruction', () => {
    const result = buildSessionInstructions('zh', 'traditional');
    expect(result).toContain('Traditional Chinese');
  });

  it('adds Simplified Chinese instruction', () => {
    const result = buildSessionInstructions('zh', 'simplified');
    expect(result).toContain('Simplified Chinese');
  });
});

describe('createRealtimeWebSocketUrl', () => {
  it('creates ws URL for http base', () => {
    const result = createRealtimeWebSocketUrl('http://localhost:8080', 'model1', 'en');
    expect(result).toBe('ws://localhost:8080/v1/realtime?intent=transcription&model=model1&language=en');
  });

  it('creates wss URL for https base', () => {
    const result = createRealtimeWebSocketUrl('https://api.example.com', 'model2', 'zh');
    expect(result).toBe('wss://api.example.com/v1/realtime?intent=transcription&model=model2&language=zh');
  });
});