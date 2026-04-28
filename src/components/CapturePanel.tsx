// Capture panel component - source language and recording controls
// Refactored to use Zustand stores

import { AudioDeviceSelector } from './AudioDeviceSelector';
import { useAppState } from '@/stores/appStore';
import { useTranscribeState } from '@/stores/transcribeStore';
import type { AudioDevice } from '@/lib/types';

export type ChineseVariant = 'simplified' | 'traditional';

interface CapturePanelProps {
  isDesktop: boolean;
  // Audio device props (still passed from parent - could be moved to store later)
  micDevices: AudioDevice[];
  systemDevices: AudioDevice[];
  // Event handlers
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function CapturePanel({
  isDesktop,
  micDevices,
  systemDevices,
  onStartRecording,
  onStopRecording,
}: CapturePanelProps) {
  // Get state from stores
  const { sourceLanguage, chineseVariant, setSourceLanguage } = useAppState();
  const {
    isRecording,
    isProcessing,
    selectedMicDevice,
    selectedSystemDevice,
    captureMode,
    setMicDevice,
    setSystemDevice,
    setCaptureMode,
  } = useTranscribeState();

  const selectedLanguage =
    sourceLanguage === 'zh' ? `zh-${chineseVariant}` : sourceLanguage;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(51,41,25,0.6)] backdrop-blur dark:border-white/10 dark:bg-[#15120d]/85">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">Capture</h2>
          <p className="text-sm text-[#6b5a3f] dark:text-[#c8b7a0]">
            Choose the source language and start recording.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
          Source Language
          <select
            value={selectedLanguage}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'zh-simplified') {
                setSourceLanguage('zh', 'simplified');
                return;
              }
              if (value === 'zh-traditional') {
                setSourceLanguage('zh', 'traditional');
                return;
              }
              setSourceLanguage(value);
            }}
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

        {/* Audio Device Selector - Only in desktop mode */}
        <AudioDeviceSelector
          isDesktop={isDesktop}
          micDevices={micDevices}
          systemDevices={systemDevices}
          selectedMicDevice={selectedMicDevice ?? ''}
          selectedSystemDevice={selectedSystemDevice ?? ''}
          captureMode={captureMode}
          onMicDeviceChange={setMicDevice}
          onSystemDeviceChange={setSystemDevice}
          onCaptureModeChange={setCaptureMode}
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onStartRecording}
            disabled={isRecording || isProcessing}
            className="flex-1 rounded-xl bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            {isRecording ? 'Recording…' : isProcessing ? 'Processing…' : 'Start Recording'}
          </button>
          <button
            onClick={onStopRecording}
            disabled={!isRecording}
            className="flex-1 rounded-xl border border-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#1f1c16] transition hover:bg-[#1f1c16] hover:text-[#f6e9cc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#f6e9cc] dark:text-[#f6e9cc] dark:hover:bg-[#f6e9cc] dark:hover:text-[#1f1c16]"
          >
            Stop Recording
          </button>
        </div>
      </div>
    </div>
  );
}