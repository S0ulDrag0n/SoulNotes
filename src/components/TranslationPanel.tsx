// Translation panel component showing live translation with text selection support

import { useRef, useEffect } from 'react';
import type { TranslationMessage } from '@/hooks/useTranslation';
import { UI_SCROLL } from '@/lib/constants';
import { SelectableText } from '@/components/SelectableText';

interface TranslationPanelProps {
  readonly translationMessages: TranslationMessage[];
  readonly isTranslating: boolean;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly onTargetLanguageChange: (lang: string) => void;
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

export function TranslationPanel({
  translationMessages,
  isTranslating,
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
  onSave,
  onClear,
  onAddToFlashcards,
}: TranslationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (translationMessages.length > 0 && autoScrollRef.current) {
      scrollToBottom(element);
    }
  }, [translationMessages]);

  return (
    <div className="flex-1 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(51,41,25,0.6)] backdrop-blur dark:border-white/10 dark:bg-[#15120d]/85">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Translation</h2>
          {isTranslating && (
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 animate-pulse">
              Translating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
            <span className="sr-only">Target Language</span>
            <select
              value={targetLanguage}
              onChange={(event) => onTargetLanguageChange(event.target.value)}
              className="rounded-lg border border-[#d7c7a7] bg-white px-2 py-1 text-xs text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
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
          <button
            onClick={onClear}
            disabled={translationMessages.length === 0}
            className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
            title="Clear translation"
          >
            🗑️ Clear
          </button>
          <button
            onClick={onSave}
            disabled={translationMessages.length === 0}
            className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
            title="Save translation to file"
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
        {translationMessages.length > 0 ? (
          <SelectableText
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            source="translation"
            onAddToFlashcards={onAddToFlashcards}
          >
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
          </SelectableText>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[#2a241b] dark:text-[#f0e6d5]">
            {isTranslating ? 'Translating…' : 'No translation yet.'}
          </p>
        )}
      </div>
    </div>
  );
}