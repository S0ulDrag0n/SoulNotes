'use client';

import { useState, useEffect } from 'react';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { ConversationSession } from '@/components/ConversationSession';
import { SessionSummary } from '@/components/SessionSummary';
import { AudioDeviceSelector } from '@/components/AudioDeviceSelector';
import { useConversation } from '@/hooks/useConversation';
import { useAudioDevices } from '@/hooks/useAudioDevices';
import { useConversationState } from '@/stores/conversationStore';
import { isDesktopMode } from '@/utils/platform';
import type { ConversationScenario, DifficultyLevel, ConversationSession as ConversationSessionType } from '@/types/conversation';

export default function ConversationPage() {
  const isDesktop = isDesktopMode();
  
  // Get audio devices for desktop mode
  const { micDevices } = useAudioDevices();
  const { selectedMicDevice, setMicDevice } = useConversationState();
  
  const {
    isRecording,
    isProcessing,
    isSpeaking,
    currentSession,
    error,
    startSession,
    endSession,
    startRecording,
    stopRecording,
    sendMessage,
    saveVocabulary,
  } = useConversation();
  
  const [showSummary, setShowSummary] = useState(false);
  const [sessionResult, setSessionResult] = useState<ConversationSessionType | null>(null);

  // Reset recording state on unmount to prevent stale state
  // Note: useConversation hook handles stopping transcription and Tauri audio capture
  useEffect(() => {
    return () => {
      // The useConversation hook's cleanup will handle stopping audio
      // This is just for any additional page-level cleanup if needed
    };
  }, []);

  const handleStartSession = (language: string, scenario: ConversationScenario, difficulty: DifficultyLevel) => {
    startSession(language, scenario, difficulty);
  };

  const handleEndSession = async () => {
    try {
      const result = await endSession();
      setSessionResult(result);
      setShowSummary(true);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  };

  const handleCloseSummary = () => {
    setShowSummary(false);
    setSessionResult(null);
  };

  const handleStartRecording = async () => {
    // Pass the selected mic device in desktop mode
    await startRecording(selectedMicDevice || undefined);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
            AI Conversation Partner
          </h1>
          <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
            Practice speaking with an AI that adapts to your level
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {!currentSession ? (
          <ScenarioSelector onStart={handleStartSession} />
        ) : (
          <>
            {/* Audio Device Selector - Only in desktop mode */}
            {isDesktop && (
              <div className="mb-4">
                <AudioDeviceSelector
                  isDesktop={isDesktop}
                  micDevices={micDevices}
                  systemDevices={[]}
                  selectedMicDevice={selectedMicDevice ?? ''}
                  selectedSystemDevice=""
                  captureMode="microphone"
                  onMicDeviceChange={setMicDevice}
                  onSystemDeviceChange={() => {}}
                  onCaptureModeChange={() => {}}
                  microphoneOnly={true}
                />
              </div>
            )}
            
            <ConversationSession
              session={currentSession}
              isRecording={isRecording}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              sourceLanguage={currentSession.language}
              targetLanguage="en"
              onStartRecording={handleStartRecording}
              onStopRecording={stopRecording}
              onSendMessage={sendMessage}
              onEndSession={handleEndSession}
              onSaveVocabulary={saveVocabulary}
            />
          </>
        )}

        {showSummary && sessionResult && (
          <SessionSummary
            session={sessionResult}
            onClose={handleCloseSummary}
          />
        )}
      </main>
    </div>
  );
}