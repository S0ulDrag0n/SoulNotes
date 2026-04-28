// src/hooks/useConversation.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRealtimeTranscription } from './useRealtimeTranscription';
import { useTauriAudioCapture } from './useTauriAudioCapture';
import { useTTS } from './useTTS';
import { useLearningProfile } from './useLearningProfile';
import { useGamification } from './useGamification';
import { useVocabulary } from './useVocabulary';
import { DEFAULT_REALTIME_CONFIG, DEFAULT_LANGUAGE_SETTINGS } from '@/lib/constants';
import { isDesktopMode } from '@/utils/platform';
import { tauriConversation } from '@/lib/tauri';
import type {
  ConversationSession,
  ConversationMessage,
  ConversationScenario,
  DifficultyLevel,
  SessionAnalytics,
  Correction,
} from '@/types/conversation';
import { toApiLearningProfile as convertToApiProfile } from '@/types/conversation';

interface UseConversationReturn {
  // State
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentSession: ConversationSession | null;
  error: string | null;
  
  // Actions
  startSession: (language: string, scenario: ConversationScenario, difficulty: DifficultyLevel) => void;
  endSession: () => Promise<ConversationSession>;
  startRecording: (micDevice?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  saveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
}

export function useConversation(): UseConversationReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Tauri audio capture for desktop mode
  const {
    isCapturing,
    startCapture,
    stopCapture,
    setOnAudioChunk,
  } = useTauriAudioCapture();
  
  const {
    isTranscribing: isRecording,
    startTranscription,
    stopTranscription,
    sendAudioData,
    transcript,
    transcriptMessages,
  } = useRealtimeTranscription({
    baseUrl: process.env.NEXT_PUBLIC_SPEACHES_BASE_URL || DEFAULT_REALTIME_CONFIG.baseUrl,
    model: process.env.NEXT_PUBLIC_SPEACHES_TRANSCRIBE_MODEL || DEFAULT_REALTIME_CONFIG.transcribeModel,
    language: currentSession?.language || DEFAULT_LANGUAGE_SETTINGS.realtime,
    useExternalAudio: isDesktopMode(), // Use Tauri audio in desktop mode
  });
  
  // Connect Tauri audio capture to transcription (desktop only)
  useEffect(() => {
    if (!isDesktopMode()) return;
    
    setOnAudioChunk((pcm16: Int16Array) => {
      sendAudioData(pcm16);
    });
  }, [setOnAudioChunk, sendAudioData]);
  
  const { generateAudio, playAudio, isPlaying: isSpeaking, stopAudio } = useTTS();
  const { updateProfile, recordConversationMistakes } = useLearningProfile();
  const { addConversationXP } = useGamification();
  const { addItem, currentDeck } = useVocabulary();
  
  const sessionStartTime = useRef<Date | null>(null);
  const messageQueue = useRef<ConversationMessage[]>([]);
  const lastTranscriptRef = useRef<string>('');

  // Update session when transcript changes
  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current && currentSession) {
      lastTranscriptRef.current = transcript;
    }
  }, [transcript, currentSession]);

  const startSession = useCallback((
    language: string, 
    scenario: ConversationScenario, 
    difficulty: DifficultyLevel
  ) => {
    const session: ConversationSession = {
      id: crypto.randomUUID(),
      language,
      scenario,
      difficulty,
      startedAt: new Date(),
      endedAt: null,
      messages: [],
      analytics: {
        totalMessages: 0,
        userMessages: 0,
        averageResponseLength: 0,
        correctionsCount: 0,
        vocabularyIntroduced: 0,
        fluencyScore: 100,
        grammarAccuracy: 100,
        vocabularyDiversity: 100,
      },
    };
    
    setCurrentSession(session);
    sessionStartTime.current = new Date();
    messageQueue.current = [];
    setError(null);
    lastTranscriptRef.current = '';
  }, []);

  const endSession = useCallback(async (): Promise<ConversationSession> => {
    if (!currentSession) {
      throw new Error('No active session');
    }
    
    // Stop any ongoing recording
    if (isRecording) {
      stopTranscription();
    }
    
    // Stop any playing audio
    stopAudio();
    
    // Calculate final analytics
    const endedSession: ConversationSession = {
      ...currentSession,
      endedAt: new Date(),
      messages: messageQueue.current,
      analytics: calculateAnalytics(messageQueue.current),
    };
    
    // Update learning profile
    const corrections = messageQueue.current
      .filter(m => m.role === 'assistant' && m.corrections)
      .flatMap(m => m.corrections || []);
    
    await recordConversationMistakes(corrections as Correction[], currentSession.language);
    
    // Add XP
    const durationMinutes = Math.round(
      (endedSession.endedAt!.getTime() - endedSession.startedAt.getTime()) / 60000
    );
    await addConversationXP(Math.max(1, durationMinutes));
    
    setCurrentSession(null);
    return endedSession;
  }, [currentSession, isRecording, stopTranscription, stopAudio, recordConversationMistakes, addConversationXP]);

  const processUserMessage = useCallback(async (text: string) => {
    if (!currentSession || !text.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    
    // Add user message
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    messageQueue.current.push(userMessage);
    
    // Update session with new message
    setCurrentSession(prev => prev ? {
      ...prev,
      messages: [...messageQueue.current],
    } : null);
    
    try {
      // Get learning profile for context
      const profile = await updateProfile(currentSession.language);
      const apiProfile = convertToApiProfile(profile);
      
      type ConversationData = {
        content: string;
        corrections: Correction[];
        vocabulary: Array<{ word: string; translation: string; context: string; isKnown: boolean }>
      };
      
      let data: ConversationData;
      
      if (isDesktopMode()) {
        // Use Tauri command in desktop mode
        const result = await tauriConversation(
          messageQueue.current.map(m => ({
            role: m.role,
            content: m.content,
          })),
          currentSession.language,
          currentSession.scenario,
          currentSession.difficulty,
          apiProfile
        );
        
        data = {
          content: result.content,
          corrections: result.corrections.map(c => ({
            type: c.type as Correction['type'],
            original: c.original,
            corrected: c.corrected,
            explanation: c.explanation,
            severity: c.severity as Correction['severity'],
          })),
          vocabulary: result.vocabulary.map(v => ({
            word: v.word,
            translation: v.translation,
            context: v.context,
            isKnown: false,
          })),
        };
      } else {
        // Use Next.js API in web mode
        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messageQueue.current.map(m => ({
              role: m.role,
              content: m.content,
            })),
            language: currentSession.language,
            scenario: currentSession.scenario,
            difficulty: currentSession.difficulty,
            learningProfile: apiProfile,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to get response');
        }
        
        const responseData = await response.json();
        data = {
          content: responseData.content,
          corrections: responseData.corrections,
          vocabulary: responseData.vocabulary.map((v: { word: string; translation: string; context: string }) => ({
            word: v.word,
            translation: v.translation,
            context: v.context,
            isKnown: false,
          })),
        };
      }
      
      // Add assistant message
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        corrections: data.corrections,
        vocabulary: data.vocabulary,
        timestamp: new Date(),
      };
      messageQueue.current.push(assistantMessage);
      
      // Update session with new message
      setCurrentSession(prev => prev ? {
        ...prev,
        messages: [...messageQueue.current],
      } : null);
      
      // Generate and play TTS
      const audio = await generateAudio(data.content, currentSession.language);
      if (audio) {
        playAudio(audio);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession, generateAudio, playAudio, updateProfile]);

  const startRecording = useCallback(async (micDevice?: string) => {
    lastTranscriptRef.current = '';
    await startTranscription();
    
    // Start Tauri audio capture in desktop mode
    // Pass the device if specified, otherwise let Tauri use the default device
    if (isDesktopMode()) {
      await startCapture('microphone', micDevice || undefined);
    }
  }, [startTranscription, startCapture]);

  const stopRecording = useCallback(async () => {
    stopTranscription();
    
    // Stop Tauri audio capture in desktop mode
    if (isDesktopMode()) {
      await stopCapture();
    }
    
    // Get the final transcript from transcriptMessages
    const finalTranscript = transcriptMessages
      .map(m => m.text)
      .join(' ')
      .trim();
    
    // Process the transcript
    if (finalTranscript) {
      await processUserMessage(finalTranscript);
    }
  }, [stopTranscription, stopCapture, transcriptMessages, processUserMessage]);

  // Use refs to track current state for cleanup (avoids stale closure issues)
  const isRecordingRef = useRef(isRecording);
  const isCapturingRef = useRef(isCapturing);
  
  // Update refs when state changes
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);
  
  // Cleanup on unmount only - stop recording and reset state
  useEffect(() => {
    return () => {
      // Use refs to get current values at cleanup time
      if (isRecordingRef.current) {
        stopTranscription();
      }
      if (isDesktopMode() && isCapturingRef.current) {
        stopCapture();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only runs on unmount

  const sendMessage = useCallback(async (text: string) => {
    await processUserMessage(text);
  }, [processUserMessage]);

  const saveVocabulary = useCallback(async (
    word: string, 
    translation: string, 
    context: string
  ) => {
    if (!currentDeck) {
      setError('No vocabulary deck selected');
      return;
    }
    await addItem(word, translation, context, 'conversation');
  }, [currentDeck, addItem]);

  return {
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
  };
}

function calculateAnalytics(messages: ConversationMessage[]): SessionAnalytics {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  const totalCorrections = assistantMessages.reduce(
    (sum, m) => sum + (m.corrections?.length || 0), 
    0
  );
  
  const totalVocabulary = assistantMessages.reduce(
    (sum, m) => sum + (m.vocabulary?.length || 0), 
    0
  );
  
  const averageLength = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
    : 0;
  
  // Calculate scores (simplified - would be more sophisticated in production)
  const grammarAccuracy = Math.max(0, 100 - (totalCorrections * 5));
  const vocabularyDiversity = Math.min(100, averageLength * 2);
  const fluencyScore = (grammarAccuracy + vocabularyDiversity) / 2;
  
  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    averageResponseLength: Math.round(averageLength),
    correctionsCount: totalCorrections,
    vocabularyIntroduced: totalVocabulary,
    fluencyScore: Math.round(fluencyScore),
    grammarAccuracy: Math.round(grammarAccuracy),
    vocabularyDiversity: Math.round(vocabularyDiversity),
  };
}