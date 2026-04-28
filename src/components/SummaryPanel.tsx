// Summary panel component showing meeting summary
// Extracted from OutputPanel for the new layout

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from '@/lib/markdown-components';

interface SummaryPanelProps {
  readonly summary: string;
  readonly isSummarizing: boolean;
  readonly onSave: (content: string, filename: string) => void;
}

export function SummaryPanel({ summary, isSummarizing, onSave }: SummaryPanelProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(51,41,25,0.6)] backdrop-blur dark:border-white/10 dark:bg-[#15120d]/85">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Summary</h2>
          {isSummarizing && (
            <span className="animate-pulse rounded-full border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 shadow-lg shadow-amber-400/25 dark:border-amber-500 dark:bg-amber-900/60 dark:text-amber-200">
              ⚡ Summarizing…
            </span>
          )}
        </div>
        <button
          onClick={() => onSave(summary, 'summary.md')}
          disabled={!summary.trim()}
          className="rounded-lg border border-[#d7c7a7] bg-white/70 px-2 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
          title="Save summary to file"
        >
          💾 Save
        </button>
      </div>
      <div className="mt-4 min-h-[120px] overflow-auto">
        {summary ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {summary}
          </ReactMarkdown>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[#2a241b] dark:text-[#f0e6d5]">
            {isSummarizing ? 'Summarizing…' : 'Summary will appear here after recording stops.'}
          </p>
        )}
      </div>
    </div>
  );
}