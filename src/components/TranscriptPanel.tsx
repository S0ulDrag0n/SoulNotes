// Transcript panel component showing live transcript with text selection support

import { useRef, useEffect } from 'react';
import type { TranscriptMessage } from '@/hooks/useRealtimeTranscription';
import { UI_SCROLL } from '@/lib/constants';
import { SelectableText } from '@/components/SelectableText';

interface TranscriptPanelProps {
  readonly transcriptMessages: TranscriptMessage[];
  readonly isTranscribing: boolean;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly onSave: () => void;
  readonly onClear: () => void;
  readonly onAddToFlashcards?: () => void;
}

function isNearBottom(element: HTMLElement, threshold = UI_SCROLL.autoScrollThreshold): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function scrollToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

export function TranscriptPanel({ 
  transcriptMessages, 
  isTranscribing, 
  sourceLanguage,
  targetLanguage,
  onSave, 
  onClear,
  onAddToFlashcards,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (autoScrollRef.current) {
      scrollToBottom(element);
    }
  }, [transcriptMessages, isTranscribing]);

  return (
    <div className="flex-1 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(51,41,25,0.6)] backdrop-blur dark:border-white/10 dark:bg-[#15120d]/85">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Transcript</h2>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#a08a68] dark:text-[#c1ab88]">
            Live
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={transcriptMessages.length === 0}
            className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
            title="Clear transcript"
          >
            🗑️ Clear
          </button>
          <button
            onClick={onSave}
            disabled={transcriptMessages.length === 0}
            className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
            title="Save transcript to file"
          >
            💾 Save
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          autoScrollRef.current = isNearBottom(element);
        }}
        className="mt-4 min-h-[160px] max-h-[min(45vh,360px)] overflow-auto"
      >
        {transcriptMessages.length > 0 ? (
          <SelectableText
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            source="transcript"
            onAddToFlashcards={onAddToFlashcards}
          >
            <div className="flex flex-col gap-3">
              {transcriptMessages.map((msg) => {
                const isStreaming = msg.id.startsWith('streaming-');
                const timeStr = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div 
                    key={msg.id} 
                    className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
                      isStreaming 
                        ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700' 
                        : 'bg-[#efe0c3]/50 dark:bg-[#2a2218]/50'
                    }`}
                  >
                    <span className="shrink-0 text-xs text-[#a08a68] dark:text-[#8b7355]">
                      {timeStr}
                    </span>
                    <p className="whitespace-pre-wrap text-[#2a241b] dark:text-[#f0e6d5] flex-1">
                      {msg.text}
                    </p>
                    {isStreaming && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                        …
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </SelectableText>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[#2a241b] dark:text-[#f0e6d5]">
            {isTranscribing ? 'Transcribing…' : 'No transcript yet.'}
          </p>
        )}
      </div>
    </div>
  );
}