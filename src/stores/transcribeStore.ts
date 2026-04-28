/**
 * Transcribe Store
 * 
 * State for the Transcription page. This is separate from the Conversation
 * page because they are independent modes with different state needs.
 * 
 * Wrapper Pattern: This file exports useTranscribeState() hook.
 * If we migrate to Redux, only this file changes - components stay the same.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { CaptureMode, TranscriptMessage } from './types';

interface TranscribeState {
  // Recording state - local to transcription page
  isRecording: boolean;
  isProcessing: boolean;
  
  // Audio devices (desktop only)
  captureMode: CaptureMode;
  selectedMicDevice: string | null;
  selectedSystemDevice: string | null;
  
  // Transcription results
  transcript: string;
  transcriptMessages: TranscriptMessage[];
  
  // Actions
  setRecording: (recording: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setMicDevice: (id: string | null) => void;
  setSystemDevice: (id: string | null) => void;
  setTranscript: (text: string) => void;
  addTranscriptMessage: (message: TranscriptMessage) => void;
  clearTranscript: () => void;
  reset: () => void;
}

const initialState = {
  isRecording: false,
  isProcessing: false,
  captureMode: 'dual' as CaptureMode,
  selectedMicDevice: null,
  selectedSystemDevice: null,
  transcript: '',
  transcriptMessages: [] as TranscriptMessage[],
};

// Internal Zustand store - not exported
const useTranscribeStoreInternal = create<TranscribeState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setRecording: (recording) => set(
        { isRecording: recording },
        false,
        'setRecording'
      ),
      
      setProcessing: (processing) => set(
        { isProcessing: processing },
        false,
        'setProcessing'
      ),
      
      setCaptureMode: (mode) => set(
        { captureMode: mode },
        false,
        'setCaptureMode'
      ),
      
      setMicDevice: (id) => set(
        { selectedMicDevice: id },
        false,
        'setMicDevice'
      ),
      
      setSystemDevice: (id) => set(
        { selectedSystemDevice: id },
        false,
        'setSystemDevice'
      ),
      
      setTranscript: (text) => set(
        { transcript: text },
        false,
        'setTranscript'
      ),
      
      addTranscriptMessage: (message) => set(
        (state) => ({
          transcriptMessages: [...state.transcriptMessages, message],
          transcript: state.transcript ? `${state.transcript} ${message.text}` : message.text,
        }),
        false,
        'addTranscriptMessage'
      ),
      
      clearTranscript: () => set(
        { transcript: '', transcriptMessages: [] },
        false,
        'clearTranscript'
      ),
      
      reset: () => set(
        initialState,
        false,
        'reset'
      ),
    }),
    { name: 'SoulNotes-Transcribe' }
  )
);

// ============================================
// PUBLIC API - Wrapper Hook for Future-Proofing
// ============================================

export function useTranscribeState() {
  const store = useTranscribeStoreInternal();
  
  return {
    // State
    isRecording: store.isRecording,
    isProcessing: store.isProcessing,
    captureMode: store.captureMode,
    selectedMicDevice: store.selectedMicDevice,
    selectedSystemDevice: store.selectedSystemDevice,
    transcript: store.transcript,
    transcriptMessages: store.transcriptMessages,
    
    // Actions
    setRecording: store.setRecording,
    setProcessing: store.setProcessing,
    setCaptureMode: store.setCaptureMode,
    setMicDevice: store.setMicDevice,
    setSystemDevice: store.setSystemDevice,
    setTranscript: store.setTranscript,
    addTranscriptMessage: store.addTranscriptMessage,
    clearTranscript: store.clearTranscript,
    reset: store.reset,
  };
}

// Selector hooks for performance optimization
export const useIsRecording = () => useTranscribeStoreInternal((s) => s.isRecording);
export const useTranscript = () => useTranscribeStoreInternal((s) => s.transcript);