// Status bar component showing current state
// Refactored to use Zustand stores

import { useTranscribeState } from '@/stores/transcribeStore';

interface StatusBarProps {
  isDesktop: boolean;
  isRealtime: boolean;
  isTranscribing: boolean;
  isProcessing: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function StatusBar({
  isDesktop,
  isRealtime,
  isTranscribing,
  isProcessing,
  isDarkMode,
  onToggleDarkMode,
}: StatusBarProps) {
  // Get recording state from store
  const { isRecording } = useTranscribeState();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleDarkMode}
        className="rounded-full border border-[#d7c7a7] bg-white/70 px-3 py-1 text-xs font-medium text-[#6b5a3f] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6] dark:hover:bg-[#2a2218]"
      >
        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      {isDesktop && (
        <span className="rounded-full border border-green-500/50 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-400/50 dark:bg-green-400/10 dark:text-green-400">
          Desktop Mode
        </span>
      )}
      <span className="rounded-full border border-[#d7c7a7] bg-white/70 px-3 py-1 text-xs font-medium text-[#6b5a3f] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6]">
        {isRealtime ? 'Realtime' : 'Fallback'}
      </span>
      <span className="rounded-full border border-[#d7c7a7] bg-white/70 px-3 py-1 text-xs font-medium text-[#6b5a3f] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6]">
        {isRecording ? 'Recording' : 'Idle'}
      </span>
      <span className="rounded-full border border-[#d7c7a7] bg-white/70 px-3 py-1 text-xs font-medium text-[#6b5a3f] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#cdbda6]">
        {isProcessing ? 'Processing' : isTranscribing ? 'Transcribing' : 'Ready'}
      </span>
    </div>
  );
}