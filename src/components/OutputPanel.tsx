// Output panel component - translation and summary views
// Refactored to use Zustand stores

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TranslationMessage } from '@/hooks/useTranslation';
import { UI_SCROLL } from '@/lib/constants';
import { useAppState } from '@/stores/appStore';
import { markdownComponents } from '@/lib/markdown-components';

interface OutputPanelProps {
  readonly translationMessages: TranslationMessage[];
  readonly summary: string;
  readonly isSummarizing: boolean;
  readonly onSave: (content: string, filename: string) => Promise<void> | void;
}

function isNearBottom(element: HTMLElement, threshold = UI_SCROLL.autoScrollThreshold): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function scrollToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

export function OutputPanel({
  translationMessages,
  summary,
  isSummarizing,
  onSave,
}: OutputPanelProps) {
  // Get state from store
  const { activePanel, targetLanguage, setActivePanel, setTargetLanguage } = useAppState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (activePanel === 'translation' && translationMessages.length > 0) {
      if (autoScrollRef.current) {
        scrollToBottom(element);
      }
      return;
    }
    if (activePanel === 'summary' && summary.trim()) {
      if (autoScrollRef.current) {
        scrollToBottom(element);
      }
    }
  }, [activePanel, translationMessages, summary]);

  const currentContent = activePanel === 'translation'
    ? translationMessages.map(m => m.text).join(' ')
    : summary;

  const translationContent = translationMessages.length > 0 ? (
    <div className="flex flex-col gap-3">
      {translationMessages.map((msg) => {
        const isTranslating = msg.id.startsWith('translating-');
        const timeStr = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
              isTranslating
                ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-700'
                : 'bg-white dark:bg-[#2a2218]/50'
            }`}
          >
            <span className="shrink-0 text-xs text-[#a08a68] dark:text-[#8b7355]">
              {timeStr}
            </span>
            <p className="whitespace-pre-wrap text-[#2a241b] dark:text-[#f0e6d5] flex-1">
              {msg.text}
            </p>
            {isTranslating && (
              <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                …
              </span>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="whitespace-pre-wrap text-sm text-[#2a241b] dark:text-[#f0e6d5]">
      Translation will appear here.
    </p>
  );

  const summaryContent = summary ? (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {summary}
    </ReactMarkdown>
  ) : (
    'Summary will appear here.'
  );

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(51,41,25,0.6)] backdrop-blur dark:border-white/10 dark:bg-[#15120d]/85">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Output</h2>
          <p className="text-sm text-[#6b5a3f] dark:text-[#c8b7a0]">
            Switch between translation and summary views.
          </p>
        </div>
        {isSummarizing && (
          <span className="animate-pulse rounded-full border border-amber-400 bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800 shadow-lg shadow-amber-400/25 dark:border-amber-500 dark:bg-amber-900/60 dark:text-amber-200">
            ⚡ Summarizing…
          </span>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
          <span>Target Language</span>
          <select
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            className="rounded-xl border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh-simplified">Chinese (Simplified)</option>
            <option value="zh-traditional">Chinese (Traditional)</option>
            <option value="ar">Arabic</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActivePanel('translation')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              activePanel === 'translation'
                ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                : 'border border-[#d7c7a7] text-[#6b5a3f] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
            }`}
          >
            Translation
          </button>
          <button
            onClick={() => setActivePanel('summary')}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              activePanel === 'summary'
                ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                : 'border border-[#d7c7a7] text-[#6b5a3f] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
            }`}
          >
            Summary
          </button>
        </div>
        <button
          onClick={() => onSave(currentContent, activePanel === 'translation' ? 'translation.md' : 'summary.md')}
          disabled={!currentContent.trim()}
          className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
          title={`Save ${activePanel} to file`}
        >
          💾 Save
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          autoScrollRef.current = isNearBottom(element);
        }}
        className="mt-6 min-h-[280px] max-h-[min(55vh,520px)] overflow-auto"
      >
        {activePanel === 'translation' ? translationContent : summaryContent}
      </div>
    </div>
  );
}