// src/types/pronunciation.ts

export interface PronunciationSession {
  id: string;
  language: string;
  startedAt: Date;
  endedAt: Date | null;
  words: PronunciationWord[];
  overallScore: number;
}

export interface PronunciationWord {
  word: string;
  language: string;
  ipa: string;              // IPA transcription
  audioUrl: string;          // TTS audio
  userRecording?: string;    // Base64 encoded recording
  attempts: PronunciationAttempt[];
  mastered: boolean;
}

export interface PronunciationAttempt {
  id: string;
  recordedAt: Date;
  audioUrl: string;          // User recording
  score: number;             // 0-100
  feedback: PronunciationFeedback;
}

export interface PronunciationFeedback {
  overallScore: number;
  accuracy: number;          // How accurately pronounced
  fluency: number;           // Smoothness of pronunciation
  completeness: number;      // All sounds present
  issues: PronunciationIssue[];
  suggestions: string[];
}

export interface PronunciationIssue {
  type: 'mispronunciation' | 'missing_sound' | 'extra_sound' | 'stress' | 'intonation';
  position: number;          // Character position in word
  expected: string;          // Expected sound
  actual: string;            // Actual sound
  severity: 'minor' | 'moderate' | 'major';
}

export interface PronunciationSettings {
  speed: 'slow' | 'normal' | 'fast';
  showIpa: boolean;
  showPhonetic: boolean;
  autoPlay: boolean;
  recordDelay: number;       // Milliseconds before recording starts
}