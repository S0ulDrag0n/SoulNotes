// Hook for audio device management

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPlatform } from '@/lib/platform';
import type { AudioDevice } from '@/lib/types';

export type CaptureMode = 'microphone' | 'system' | 'dual';

export interface UseAudioDevicesReturn {
  micDevices: AudioDevice[];
  systemDevices: AudioDevice[];
  selectedMicDevice: string;
  selectedSystemDevice: string;
  captureMode: CaptureMode;
  isLoading: boolean;
  setSelectedMicDevice: (id: string) => void;
  setSelectedSystemDevice: (id: string) => void;
  setCaptureMode: (mode: CaptureMode) => void;
}

// ---------------------------------------------------------------------
// Audio devices hook
// ---------------------------------------------------------------------
export function useAudioDevices(): UseAudioDevicesReturn {
  const [micDevices, setMicDevices] = useState<AudioDevice[]>([]);
  const [systemDevices, setSystemDevices] = useState<AudioDevice[]>([]);
  const [selectedMicDevice, setSelectedMicDevice] = useState('');
  const [selectedSystemDevice, setSelectedSystemDevice] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('dual');
  const [isLoading, setIsLoading] = useState(true);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const platform = getPlatform();

  // ---------------------------------------------------------------------
  // Load devices and config on mount
  // ---------------------------------------------------------------------
  useEffect(() => {
    const loadDevices = async () => {
      setIsLoading(true);
      try {
        // Get saved config
        const savedConfig = await platform.audioDevices.getConfig();

        // Get mic devices
        const micDevicesResult = await platform.audioDevices.getAudioDevices();
        setMicDevices(micDevicesResult);

        // Get system audio devices
        const systemDevicesResult = await platform.audioDevices.getSystemAudioDevices();
        setSystemDevices(systemDevicesResult);

        // Apply saved config
        if (savedConfig) {
          if (savedConfig.capture_mode) {
            // Normalize capture mode: backend uses "mic", frontend uses "microphone"
            const normalizedMode = savedConfig.capture_mode === 'mic'
              ? 'microphone'
              : savedConfig.capture_mode as CaptureMode;
            setCaptureMode(normalizedMode);
          }

          // Set mic device - verify it exists
          if (savedConfig.mic_device && micDevicesResult.some(d => d.id === savedConfig.mic_device)) {
            setSelectedMicDevice(savedConfig.mic_device);
          } else if (micDevicesResult.length > 0) {
            setSelectedMicDevice(micDevicesResult[0].id);
          }

          // Set system audio device - verify it exists
          if (savedConfig.system_audio_device && systemDevicesResult.some(d => d.id === savedConfig.system_audio_device)) {
            setSelectedSystemDevice(savedConfig.system_audio_device);
          } else if (systemDevicesResult.length > 0) {
            setSelectedSystemDevice(systemDevicesResult[0].id);
          }
        } else {
          // Default to first device
          if (micDevicesResult.length > 0) {
            setSelectedMicDevice(micDevicesResult[0].id);
          }
          if (systemDevicesResult.length > 0) {
            setSelectedSystemDevice(systemDevicesResult[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load audio devices:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Only load if in desktop mode
    if (platform.isDesktop) {
      loadDevices();
    } else {
      setIsLoading(false);
    }
  }, [platform]);

  // ---------------------------------------------------------------------
  // Save device settings (debounced)
  // ---------------------------------------------------------------------
  const saveSettings = useCallback(async () => {
    if (!platform.isDesktop) return;

    try {
      // Normalize capture mode: frontend uses "microphone", backend uses "mic"
      const backendCaptureMode = captureMode === 'microphone' ? 'mic' : captureMode;
      await platform.audioDevices.saveDeviceSettings(
        selectedMicDevice || null,
        selectedSystemDevice || null,
        backendCaptureMode as 'microphone' | 'system' | 'dual'
      );
    } catch (err) {
      console.error('Failed to save device settings:', err);
    }
  }, [platform, selectedMicDevice, selectedSystemDevice, captureMode]);

  // Debounced save
  useEffect(() => {
    if (isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [selectedMicDevice, selectedSystemDevice, captureMode, isLoading, saveSettings]);

  return {
    micDevices,
    systemDevices,
    selectedMicDevice,
    selectedSystemDevice,
    captureMode,
    isLoading,
    setSelectedMicDevice,
    setSelectedSystemDevice,
    setCaptureMode,
  };
}