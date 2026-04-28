// Audio device selector component for desktop mode

import { CaptureMode } from '@/hooks/useAudioDevices';

interface AudioDeviceSelectorProps {
  isDesktop: boolean;
  micDevices: { id: string; name: string }[];
  systemDevices: { id: string; name: string }[];
  selectedMicDevice: string;
  selectedSystemDevice: string;
  captureMode: CaptureMode;
  onMicDeviceChange: (id: string) => void;
  onSystemDeviceChange: (id: string) => void;
  onCaptureModeChange: (mode: CaptureMode) => void;
  /** If true, only show microphone selector (for conversation mode) */
  microphoneOnly?: boolean;
}

export function AudioDeviceSelector({
  isDesktop,
  micDevices,
  systemDevices,
  selectedMicDevice,
  selectedSystemDevice,
  captureMode,
  onMicDeviceChange,
  onSystemDeviceChange,
  onCaptureModeChange,
  microphoneOnly = false,
}: AudioDeviceSelectorProps) {
  if (!isDesktop) return null;

  // In microphoneOnly mode, we only show the mic device selector
  if (microphoneOnly) {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">
          <span>🎤 Microphone Device</span>
          <select
            value={selectedMicDevice}
            onChange={(e) => onMicDeviceChange(e.target.value)}
            className="rounded-lg border border-[#d7c7a7] bg-white px-2 py-1.5 text-xs text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
          >
            {micDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
            {micDevices.length === 0 && (
              <option value="">No devices found</option>
            )}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
        Audio Source
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCaptureModeChange('microphone')}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
            captureMode === 'microphone'
              ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
              : 'border border-[#d7c7a7] text-[#6b5a3f] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
          }`}
        >
          🎤 Mic
        </button>
        <button
          type="button"
          onClick={() => onCaptureModeChange('system')}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
            captureMode === 'system'
              ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
              : 'border border-[#d7c7a7] text-[#6b5a3f] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
          }`}
        >
          🔊 System
        </button>
        <button
          type="button"
          onClick={() => onCaptureModeChange('dual')}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
            captureMode === 'dual'
              ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
              : 'border border-[#d7c7a7] text-[#6b5a3f] hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]'
          }`}
        >
          🎧 Both
        </button>
      </div>

      {/* Device selection dropdowns */}
      <div className="grid gap-2">
        {/* Microphone device selector */}
        {(captureMode === 'microphone' || captureMode === 'dual') && (
          <label className="flex flex-col gap-1 text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">
            <span>🎤 Microphone Device</span>
            <select
              value={selectedMicDevice}
              onChange={(e) => onMicDeviceChange(e.target.value)}
              className="rounded-lg border border-[#d7c7a7] bg-white px-2 py-1.5 text-xs text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
            >
              {micDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
              {micDevices.length === 0 && (
                <option value="">No devices found</option>
              )}
            </select>
          </label>
        )}

        {/* System audio device selector */}
        {(captureMode === 'system' || captureMode === 'dual') && (
          <label className="flex flex-col gap-1 text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">
            <span>🔊 System Audio Device</span>
            <select
              value={selectedSystemDevice}
              onChange={(e) => onSystemDeviceChange(e.target.value)}
              className="rounded-lg border border-[#d7c7a7] bg-white px-2 py-1.5 text-xs text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
            >
              {systemDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
              {systemDevices.length === 0 && (
                <option value="">No devices found</option>
              )}
            </select>
          </label>
        )}
      </div>

      <p className="text-xs text-[#8b7a5a] dark:text-[#a08a68]">
        {captureMode === 'microphone'
          ? 'Capture from your microphone only'
          : captureMode === 'system'
          ? 'Capture system audio output only'
          : 'Capture both microphone and system audio'}
      </p>
    </div>
  );
}