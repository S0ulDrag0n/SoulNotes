// SoulNotes - Main page component
// Refactored to use Zustand stores

"use client";

import { useEffect, useCallback, useRef } from 'react';
import { isDesktopMode } from '@/utils/platform';
import { saveToFile, formatTranscriptForSave } from '@/utils/text';
import { useRealtimeTranscription } from '@/hooks/useRealtimeTranscription';
import { useTranslation } from '@/hooks/useTranslation';
import { useSummarization } from '@/hooks/useSummarization';
import { useTheme } from '@/hooks/useTheme';
import { useAudioDevices, CaptureMode } from '@/hooks/useAudioDevices';
import { useTauriAudioCapture } from '@/hooks/useTauriAudioCapture';

// Import stores
import { useAppState } from '@/stores/appStore';
import { useTranscribeState } from '@/stores/transcribeStore';

import { StatusBar } from '@/components/StatusBar';
import { CapturePanel } from '@/components/CapturePanel';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { TranslationPanel } from '@/components/TranslationPanel';
import { SummaryPanel } from '@/components/SummaryPanel';

export default function Home() {
  // Platform detection
  const isDesktop = isDesktopMode();

  // Theme from context
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Get state from stores
  const {
    sourceLanguage,
    chineseVariant,
    targetLanguage,
    activePanel,
    realtimeConfig,
    setSourceLanguage,
    setTargetLanguage,
    setActivePanel,
    updateRealtimeConfig,
  } = useAppState();

  const {
    isRecording,
    captureMode,
    selectedMicDevice,
    selectedSystemDevice,
    setRecording,
  } = useTranscribeState();

  // Derived language for API
  const selectedLanguage = sourceLanguage === 'zh' ? `zh-${chineseVariant}` : sourceLanguage;

  // ---------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------
  
  // Audio device selection (desktop only)
  const {
    micDevices,
    systemDevices,
  } = useAudioDevices();
  
  // Use refs to ensure we always have the latest values in callbacks
  const captureModeRef = useRef<CaptureMode>(captureMode);
  const selectedMicDeviceRef = useRef<string | null>(selectedMicDevice);
  const selectedSystemDeviceRef = useRef<string | null>(selectedSystemDevice);
  
  // Update refs when values change
  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);
  
  useEffect(() => {
    selectedMicDeviceRef.current = selectedMicDevice;
  }, [selectedMicDevice]);
  
  useEffect(() => {
    selectedSystemDeviceRef.current = selectedSystemDevice;
  }, [selectedSystemDevice]);
  
  // Tauri audio capture (desktop only)
  const {
    startCapture,
    stopCapture,
    setOnAudioChunk,
  } = useTauriAudioCapture();
  
  // Realtime transcription - use external audio in desktop mode
  const {
    isRealtime,
    isTranscribing,
    transcript,
    transcriptMessages,
    startTranscription,
    stopTranscription,
    sendAudioData,
    clearTranscript,
  } = useRealtimeTranscription({
    baseUrl: realtimeConfig.baseUrl,
    model: realtimeConfig.transcribeModel,
    language: sourceLanguage,
    useExternalAudio: isDesktop,
  });

  const {
    translation,
    translationMessages,
    isTranslating,
    triggerTranslate,
    clearTranslation,
  } = useTranslation({
    sourceLanguage: selectedLanguage,
    targetLanguage: targetLanguage,
  });

  const {
    summary,
    isSummarizing,
    triggerSummarize,
  } = useSummarization();
  
  // Connect Tauri audio capture to transcription (desktop only)
  useEffect(() => {
    if (!isDesktop) {
      console.log('[Page] Not desktop mode, skipping Tauri audio setup');
      return;
    }
    
    console.error('[Page] Setting up Tauri audio chunk callback');
    setOnAudioChunk((pcm16: Int16Array, sampleRate: number, source: string) => {
      console.error('[Page] Audio chunk received, samples:', pcm16.length, 'rate:', sampleRate, 'source:', source);
      sendAudioData(pcm16);
    });
  }, [isDesktop, setOnAudioChunk, sendAudioData]);

  // Reset recording state and stop audio capture on unmount to prevent stale state
  // This handles the case where user navigates away while recording
  useEffect(() => {
    return () => {
      if (isRecording) {
        setRecording(false);
        stopTranscription();
        // In desktop mode, also stop Tauri audio capture
        if (isDesktop) {
          stopCapture();
        }
      }
    };
  }, [isRecording, setRecording, stopTranscription, isDesktop, stopCapture]);

  // ---------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) return;
        const data = await response.json();
        updateRealtimeConfig({
          baseUrl: data.speachesBaseUrl ?? realtimeConfig.baseUrl,
          transcribeModel: data.speachesTranscribeModel ?? realtimeConfig.transcribeModel,
          defaultLanguage: data.speachesTranscribeLanguage ?? realtimeConfig.defaultLanguage,
        });
        // Set initial language from config if available
        if (data.speachesTranscribeLanguage) {
          setSourceLanguage(data.speachesTranscribeLanguage);
        }
      } catch {
        // Ignore config fetch failures
      }
    };
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger translation when transcript changes
  useEffect(() => {
    if (transcript.trim()) {
      triggerTranslate(transcript);
    }
  }, [transcript, triggerTranslate]);

  // Trigger summarization when translation changes (only when not recording)
  useEffect(() => {
    if (!isRecording && translation.trim()) {
      triggerSummarize(translation);
    }
  }, [isRecording, translation, triggerSummarize]);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------

  const handleStartRecording = useCallback(async () => {
    console.error('[Page] handleStartRecording called, isDesktop:', isDesktop);
    
    if (activePanel === 'summary') {
      setActivePanel('translation');
    }
    setRecording(true);
    
    // Use refs to get the latest values (avoids stale closure issues)
    const currentCaptureMode = captureModeRef.current;
    const currentMicDevice = selectedMicDeviceRef.current;
    const currentSystemDevice = selectedSystemDeviceRef.current;
    
    console.error('[Page] Capture mode:', currentCaptureMode, 'mic:', currentMicDevice, 'system:', currentSystemDevice);
    
    try {
      // Start transcription WebSocket connection
      await startTranscription();
      console.error('[Page] Transcription started');
      
      // In desktop mode, also start Tauri audio capture
      if (isDesktop) {
        console.error('[Page] Starting Tauri audio capture...');
        await startCapture(currentCaptureMode, currentMicDevice || undefined, currentSystemDevice || undefined);
        console.error('[Page] Tauri audio capture started');
      }
    } catch (err) {
      console.error('[Page] Failed to start recording:', err);
      setRecording(false);
    }
  }, [activePanel, startTranscription, isDesktop, startCapture, setActivePanel, setRecording]);

  const handleStopRecording = useCallback(async () => {
    setRecording(false);
    stopTranscription();
    
    // In desktop mode, also stop Tauri audio capture
    if (isDesktop) {
      await stopCapture();
    }
    
    setActivePanel('summary');
  }, [stopTranscription, isDesktop, stopCapture, setActivePanel, setRecording]);

  const handleToggleDarkMode = useCallback(() => {
    toggleDarkMode();
  }, [toggleDarkMode]);

  const handleSave = useCallback(async (content: string, filename: string) => {
    await saveToFile(content, filename);
  }, []);

  const handleTranscriptSave = useCallback(async () => {
    const content = formatTranscriptForSave(transcriptMessages);
    await saveToFile(content, 'transcript.md');
  }, [transcriptMessages]);

  const handleTranslationSave = useCallback(async () => {
    const content = translationMessages.map(m => m.text).join(' ');
    await saveToFile(content, 'translation.md');
  }, [translationMessages]);

  const handleTranscriptClear = useCallback(() => {
    clearTranscript();
  }, [clearTranscript]);

  const handleTranslationClear = useCallback(() => {
    clearTranslation();
  }, [clearTranslation]);

  const isProcessing = isTranscribing || isTranslating;

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#8b7a5a] dark:text-[#c9b89f]">
              SoulNotes
            </p>
            <h1 className="text-3xl font-semibold text-[#1b1a16] dark:text-[#f4e9da] sm:text-4xl">
              Live Transcribe. Translate. Summarize.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#524637] dark:text-[#c8b7a0]">
              Capture realtime speech, translate on the fly, and get structured notes
              without leaving the page.
            </p>
          </div>
          <StatusBar
            isDesktop={isDesktop}
            isRealtime={isRealtime}
            isTranscribing={isTranscribing}
            isProcessing={isProcessing}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </header>

        {/* Capture Panel - Full Width */}
        <section className="mt-10">
          <CapturePanel
            isDesktop={isDesktop}
            micDevices={micDevices}
            systemDevices={systemDevices}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </section>

        {/* Transcript and Translation Panels - Side by Side */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TranscriptPanel
            transcriptMessages={transcriptMessages}
            isTranscribing={isTranscribing}
            sourceLanguage={selectedLanguage}
            targetLanguage={targetLanguage}
            onSave={handleTranscriptSave}
            onClear={handleTranscriptClear}
          />

          <TranslationPanel
            translationMessages={translationMessages}
            isTranslating={isTranslating}
            sourceLanguage={selectedLanguage}
            targetLanguage={targetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            onSave={handleTranslationSave}
            onClear={handleTranslationClear}
          />
        </div>

        {/* Summary Panel - Below */}
        <section className="mt-6">
          <SummaryPanel
            summary={summary}
            isSummarizing={isSummarizing}
            onSave={handleSave}
          />
        </section>
      </main>
    </div>
  );
}