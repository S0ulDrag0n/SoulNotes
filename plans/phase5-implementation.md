# Phase 5 Implementation Specifications: Export & Advanced Features

## Overview

Phase 5 implements the final features:
- Anki export (.apkg format)
- Pronunciation practice with AI feedback
- Data backup and restore
- Settings and preferences

---

## 1. Anki Export

### 1.1 Anki Package Format

```typescript
// src/lib/anki-export.ts

import type { VocabularyItem, Flashcard, LanguageDeck } from '@/types/vocabulary';

/**
 * Anki .apkg file format is a SQLite database inside a ZIP file.
 * This implementation creates the necessary tables and data.
 */

interface AnkiNote {
  id: number;
  guid: string;
  mid: number;      // model ID
  mod: number;      // modification time
  usn: number;      // update sequence number
  tags: string;
  flds: string;     // fields (separated by \x1f)
  sfld: string;     // sort field
  csum: number;     // checksum
  flags: number;
  data: string;
}

interface AnkiCard {
  id: number;
  nid: number;      // note ID
  did: number;      // deck ID
  ord: number;      // ordinal
  mod: number;
  usn: number;
  type: number;     // 0=new, 1=learning, 2=review
  queue: number;    // -3=user buried, -2=sched buried, -1=suspended, 0=new, 1=learning, 2=review, 3=in learning
  due: number;
  ivl: number;      // interval
  factor: number;   // ease factor (2500 = 250%)
  reps: number;     // number of reviews
  lapses: number;   // number of lapses
  left: number;
  odue: number;
  odid: number;
  flags: number;
  data: string;
}

interface AnkiDeck {
  id: number;
  mod: number;
  name: string;
  usn: number;
  common: string;   // JSON config
}

interface AnkiModel {
  id: number;
  name: string;
  type: number;     // 0 = standard, 1 = cloze
  mod: number;
  usn: number;
  sortf: number;    // sort field
  did: number;      // deck ID
  tmpls: AnkiTemplate[];
  flds: AnkiField[];
  css: string;
  latexPre: string;
  latexPost: string;
  latexsvg: number;
  req: any[];
}

interface AnkiTemplate {
  name: string;
  ord: number;
  qfmt: string;     // question format
  afmt: string;     // answer format
  bqfmt: string;    // browser question format
  bafmt: string;    // browser answer format
  did: number;
  bfont: string;
  bsize: number;
}

interface AnkiField {
  name: string;
  ord: number;
  sticky: boolean;
  rtl: boolean;
  font: string;
  size: number;
  media: any[];
}

// Model for basic vocabulary cards
const VOCABULARY_MODEL: Omit<AnkiModel, 'id' | 'mod' | 'usn'> = {
  name: 'SoulNotes Vocabulary',
  type: 0,
  sortf: 0,
  did: 1,
  css: `
.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
.front { font-size: 24px; font-weight: bold; }
.back { font-size: 20px; color: #333; }
.context { font-size: 14px; color: #666; font-style: italic; margin-top: 10px; }
.audio { margin-top: 10px; }
  `.trim(),
  latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  latexsvg: 0,
  flds: [
    { name: 'Word', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
    { name: 'Translation', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
    { name: 'Context', ord: 2, sticky: false, rtl: false, font: 'Arial', size: 14, media: [] },
    { name: 'Audio', ord: 3, sticky: false, rtl: false, font: 'Arial', size: 14, media: [] },
    { name: 'Definition', ord: 4, sticky: false, rtl: false, font: 'Arial', size: 16, media: [] },
  ],
  tmpls: [
    {
      name: 'Word → Translation',
      ord: 0,
      qfmt: '<div class="front">{{Word}}</div>',
      afmt: '<div class="front">{{Word}}</div><hr><div class="back">{{Translation}}</div>{{#Context}}<div class="context">{{Context}}</div>{{/Context}}{{Audio}}',
      bqfmt: '',
      bafmt: '',
      did: 0,
      bfont: '',
      bsize: 0,
    },
    {
      name: 'Translation → Word',
      ord: 1,
      qfmt: '<div class="front">{{Translation}}</div>',
      afmt: '<div class="front">{{Translation}}</div><hr><div class="back">{{Word}}</div>{{#Context}}<div class="context">{{Context}}</div>{{/Context}}{{Audio}}',
      bqfmt: '',
      bafmt: '',
      did: 0,
      bfont: '',
      bsize: 0,
    },
    {
      name: 'Audio → Word',
      ord: 2,
      qfmt: '<div class="front">Listen and write the word</div>{{Audio}}',
      afmt: '<div class="front">Listen and write the word</div>{{Audio}}<hr><div class="back">{{Word}}</div><div class="context">{{Translation}}</div>',
      bqfmt: '',
      bafmt: '',
      did: 0,
      bfont: '',
      bsize: 0,
    },
  ],
  req: [[0, 'any', [0]], [1, 'any', [1]], [2, 'any', [3]]],
};

export class AnkiExporter {
  private db: IDBDatabase | null = null;
  private mediaFiles: Map<string, Blob> = new Map();

  async exportDeck(
    deck: LanguageDeck,
    items: VocabularyItem[],
    flashcards: Flashcard[],
    includeAudio: boolean = true
  ): Promise<Blob> {
    // Create SQLite database in memory
    // Note: In browser, we use sql.js for SQLite
    const SQL = await import('sql.js');
    const sqlDb = new SQL.Database();

    // Create tables
    this.createTables(sqlDb);

    // Generate IDs
    const deckId = Date.now();
    const modelId = deckId + 1;
    const now = Math.floor(Date.now() / 1000);

    // Insert deck
    const deckConfig = JSON.stringify({
      collapsed: false,
      conf: 1,
      desc: `Exported from SoulNotes - ${deck.name}`,
      dyn: 0,
      extendNew: 10,
      extendRev: 50,
      mod: now,
      name: `SoulNotes::${deck.name}`,
      usn: -1,
    });

    sqlDb.run(`
      INSERT INTO decks (id, mod, name, usn, common)
      VALUES (?, ?, ?, ?, ?)
    `, [deckId, now, `SoulNotes::${deck.name}`, -1, deckConfig]);

    // Insert model
    const modelJson = JSON.stringify({
      ...VOCABULARY_MODEL,
      id: modelId,
      mod: now,
      usn: -1,
    });

    sqlDb.run(`
      INSERT INTO models (id, name, type, mod, usn, sortf, did, tmpls, flds, css, latexPre, latexPost, latexsvg, req)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      modelId,
      VOCABULARY_MODEL.name,
      VOCABULARY_MODEL.type,
      now,
      -1,
      VOCABULARY_MODEL.sortf,
      deckId,
      JSON.stringify(VOCABULARY_MODEL.tmpls),
      JSON.stringify(VOCABULARY_MODEL.flds),
      VOCABULARY_MODEL.css,
      VOCABULARY_MODEL.latexPre,
      VOCABULARY_MODEL.latexPost,
      VOCABULARY_MODEL.latexsvg,
      JSON.stringify(VOCABULARY_MODEL.req),
    ]);

    // Insert notes and cards
    for (const item of items) {
      const itemCards = flashcards.filter(c => c.vocabularyId === item.id);
      if (itemCards.length === 0) continue;

      const noteId = Date.now() + Math.floor(Math.random() * 10000);
      const audioField = item.audioUrl && includeAudio 
        ? `[sound:${item.audioUrl.split('/').pop()}]` 
        : '';

      // Fields separated by \x1f
      const fields = [
        item.word,
        item.translation,
        item.context || '',
        audioField,
        item.definition || '',
      ].join('\x1f');

      // Calculate checksum (simple hash)
      const csum = this.checksum(item.word);

      // Insert note
      sqlDb.run(`
        INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        noteId,
        this.generateGuid(),
        modelId,
        now,
        -1,
        item.tags.join(' '),
        fields,
        item.word,  // sort field
        csum,
        0,
        '',
      ]);

      // Insert cards for each flashcard type
      for (let i = 0; i < itemCards.length; i++) {
        const card = itemCards[i];
        const cardId = noteId + i + 1;

        // Convert SRS data to Anki format
        const type = card.reviewCount === 0 ? 0 : 2; // 0=new, 2=review
        const queue = type;
        const due = type === 0 ? 0 : Math.floor(new Date(card.dueDate).getTime() / 86400000);
        const ivl = card.interval;
        const factor = Math.round(card.ease * 1000);

        sqlDb.run(`
          INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cardId,
          noteId,
          deckId,
          i,  // ordinal (template index)
          now,
          -1,
          type,
          queue,
          due,
          ivl,
          factor,
          card.reviewCount,
          card.lapseCount,
          0,
          0,
          0,
          0,
          '',
        ]);
      }

      // Add audio to media
      if (item.audioUrl && includeAudio) {
        try {
          const audioBlob = await this.fetchAudio(item.audioUrl);
          const filename = item.audioUrl.split('/').pop()!;
          this.mediaFiles.set(filename, audioBlob);
        } catch {
          console.warn(`Failed to fetch audio: ${item.audioUrl}`);
        }
      }
    }

    // Create media table
    sqlDb.run(`
      CREATE TABLE media (
        filename TEXT PRIMARY KEY,
        data BLOB
      )
    `);

    for (const [filename, blob] of this.mediaFiles) {
      const arrayBuffer = await blob.arrayBuffer();
      sqlDb.run(`INSERT INTO media (filename, data) VALUES (?, ?)`, [
        filename,
        new Uint8Array(arrayBuffer),
      ]);
    }

    // Export to .apkg (ZIP file)
    const dbData = sqlDb.export();
    const zip = await this.createZip(dbData);
    
    return zip;
  }

  private createTables(db: any): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS col (
        id INTEGER PRIMARY KEY,
        crt INTEGER,
        mod INTEGER,
        scm INTEGER,
        ver INTEGER,
        dty INTEGER,
        usn INTEGER,
        ls INTEGER,
        conf TEXT,
        models TEXT,
        decks TEXT,
        dconf TEXT,
        tags TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        guid TEXT,
        mid INTEGER,
        mod INTEGER,
        usn INTEGER,
        tags TEXT,
        flds TEXT,
        sfld TEXT,
        csum INTEGER,
        flags INTEGER,
        data TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY,
        nid INTEGER,
        did INTEGER,
        ord INTEGER,
        mod INTEGER,
        usn INTEGER,
        type INTEGER,
        queue INTEGER,
        due INTEGER,
        ivl INTEGER,
        factor INTEGER,
        reps INTEGER,
        lapses INTEGER,
        left INTEGER,
        odue INTEGER,
        odid INTEGER,
        flags INTEGER,
        data TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS decks (
        id INTEGER PRIMARY KEY,
        mod INTEGER,
        name TEXT,
        usn INTEGER,
        common TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY,
        name TEXT,
        type INTEGER,
        mod INTEGER,
        usn INTEGER,
        sortf INTEGER,
        did INTEGER,
        tmpls TEXT,
        flds TEXT,
        css TEXT,
        latexPre TEXT,
        latexPost TEXT,
        latexsvg INTEGER,
        req TEXT
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_notes_mid ON notes (mid)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_cards_nid ON cards (nid)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_cards_did ON cards (did)`);
  }

  private generateGuid(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let guid = '';
    for (let i = 0; i < 10; i++) {
      guid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return guid;
  }

  private checksum(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 4294967296;
  }

  private async fetchAudio(url: string): Promise<Blob> {
    const response = await fetch(url);
    return response.blob();
  }

  private async createZip(dbData: Uint8Array): Promise<Blob> {
    // Use JSZip for creating the .apkg file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Add collection.anki2 (the SQLite database)
    zip.file('collection.anki2', dbData);

    // Add media files
    const media: Record<number, string> = {};
    let mediaIndex = 0;
    for (const [filename, blob] of this.mediaFiles) {
      zip.file(mediaIndex.toString(), blob);
      media[mediaIndex] = filename;
      mediaIndex++;
    }

    // Add media mapping
    zip.file('media', JSON.stringify(media));

    return zip.generateAsync({ type: 'blob' });
  }
}

// Singleton instance
let exporterInstance: AnkiExporter | null = null;

export async function getAnkiExporter(): Promise<AnkiExporter> {
  if (!exporterInstance) {
    exporterInstance = new AnkiExporter();
  }
  return exporterInstance;
}
```

### 1.2 Export Hook

```typescript
// src/hooks/useAnkiExport.ts

import { useState, useCallback } from 'react';
import { getAnkiExporter } from '@/lib/anki-export';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

interface UseAnkiExportReturn {
  isExporting: boolean;
  progress: number;
  error: string | null;
  exportDeck: (deck: LanguageDeck, includeAudio: boolean) => Promise<void>;
}

export function useAnkiExport(): UseAnkiExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportDeck = useCallback(async (deck: LanguageDeck, includeAudio: boolean = true) => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      const db = await getVocabularyDB();
      const items = await db.getItems(deck.id);
      setProgress(20);

      // Get all flashcards for items
      const allCards: Flashcard[] = [];
      for (const item of items) {
        const cards = await db.getFlashcards(item.id);
        allCards.push(...cards);
      }
      setProgress(40);

      // Export to Anki
      const exporter = await getAnkiExporter();
      const blob = await exporter.exportDeck(deck, items, allCards, includeAudio);
      setProgress(80);

      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.apkg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setProgress(100);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, progress, error, exportDeck };
}
```

---

## 2. Pronunciation Practice

### 2.1 Pronunciation Types

```typescript
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
  audioUrl: string;         // TTS audio
  userRecording?: string;   // Base64 encoded recording
  attempts: PronunciationAttempt[];
  mastered: boolean;
}

export interface PronunciationAttempt {
  id: string;
  recordedAt: Date;
  audioUrl: string;         // User recording
  score: number;            // 0-100
  feedback: PronunciationFeedback;
}

export interface PronunciationFeedback {
  overallScore: number;
  accuracy: number;         // How accurately pronounced
  fluency: number;          // Smoothness of pronunciation
  completeness: number;     // All sounds present
  issues: PronunciationIssue[];
  suggestions: string[];
}

export interface PronunciationIssue {
  type: 'mispronunciation' | 'missing_sound' | 'extra_sound' | 'stress' | 'intonation';
  position: number;         // Character position in word
  expected: string;         // Expected sound
  actual: string;           // Actual sound
  severity: 'minor' | 'moderate' | 'major';
}

export interface PronunciationSettings {
  speed: 'slow' | 'normal' | 'fast';
  showIpa: boolean;
  showPhonetic: boolean;
  autoPlay: boolean;
  recordDelay: number;      // Milliseconds before recording starts
}
```

### 2.2 Pronunciation Practice Hook

```typescript
// src/hooks/usePronunciationPractice.ts

import { useState, useCallback, useRef } from 'react';
import { useTTS } from './useTTS';
import { getLearningProfileService } from '@/lib/learning-profile-service';
import type { 
  PronunciationSession, 
  PronunciationWord, 
  PronunciationAttempt,
  PronunciationFeedback 
} from '@/types/pronunciation';

interface UsePronunciationPracticeReturn {
  isRecording: boolean;
  isPlaying: boolean;
  isAnalyzing: boolean;
  currentWord: PronunciationWord | null;
  session: PronunciationSession | null;
  error: string | null;
  
  startSession: (language: string, words: string[]) => Promise<void>;
  endSession: () => PronunciationSession;
  playWord: () => Promise<void>;
  playWordSlow: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<PronunciationAttempt>;
  nextWord: () => void;
  previousWord: () => void;
}

export function usePronunciationPractice(): UsePronunciationPracticeReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentWord, setCurrentWord] = useState<PronunciationWord | null>(null);
  const [session, setSession] = useState<PronunciationSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { generateAudio, playAudio } = useTTS();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wordIndexRef = useRef(0);

  const startSession = useCallback(async (language: string, words: string[]) => {
    const pronunciationWords: PronunciationWord[] = await Promise.all(
      words.map(async (word) => {
        // Generate TTS audio for word
        const audio = await generateAudio(word, language);
        return {
          word,
          language,
          ipa: '', // Would be generated by backend
          audioUrl: audio ? `data:audio/mp3;base64,${audio}` : '',
          attempts: [],
          mastered: false,
        };
      })
    );

    const newSession: PronunciationSession = {
      id: crypto.randomUUID(),
      language,
      startedAt: new Date(),
      endedAt: null,
      words: pronunciationWords,
      overallScore: 0,
    };

    setSession(newSession);
    setCurrentWord(pronunciationWords[0]);
    wordIndexRef.current = 0;
    setError(null);
  }, [generateAudio]);

  const endSession = useCallback((): PronunciationSession => {
    if (!session) {
      throw new Error('No active session');
    }

    // Calculate overall score
    const allAttempts = session.words.flatMap(w => w.attempts);
    const avgScore = allAttempts.length > 0
      ? allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length
      : 0;

    const endedSession: PronunciationSession = {
      ...session,
      endedAt: new Date(),
      overallScore: Math.round(avgScore),
    };

    // Update learning profile
    const service = getLearningProfileService();
    session.words.forEach(word => {
      const issues = word.attempts.flatMap(a => a.feedback.issues);
      issues.forEach(issue => {
        // Would record pronunciation issues
      });
    });

    setSession(null);
    setCurrentWord(null);
    return endedSession;
  }, [session]);

  const playWord = useCallback(async () => {
    if (!currentWord?.audioUrl) return;
    
    setIsPlaying(true);
    try {
      playAudio(currentWord.audioUrl.replace('data:audio/mp3;base64,', ''));
    } finally {
      setIsPlaying(false);
    }
  }, [currentWord, playAudio]);

  const playWordSlow = useCallback(async () => {
    if (!currentWord) return;
    
    setIsPlaying(true);
    try {
      // Generate slow version
      const audio = await generateAudio(currentWord.word, currentWord.language, undefined, 0.7);
      if (audio) {
        playAudio(audio);
      }
    } finally {
      setIsPlaying(false);
    }
  }, [currentWord, generateAudio, playAudio]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<PronunciationAttempt> => {
    if (!mediaRecorderRef.current || !currentWord) {
      throw new Error('Not recording');
    }

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setIsRecording(false);
        setIsAnalyzing(true);

        try {
          // Analyze pronunciation
          const feedback = await analyzePronunciation(
            currentWord.word,
            currentWord.language,
            audioBlob
          );

          const attempt: PronunciationAttempt = {
            id: crypto.randomUUID(),
            recordedAt: new Date(),
            audioUrl,
            score: feedback.overallScore,
            feedback,
          };

          // Update current word
          const updatedWord: PronunciationWord = {
            ...currentWord,
            attempts: [...currentWord.attempts, attempt],
            mastered: feedback.overallScore >= 80,
          };

          setCurrentWord(updatedWord);

          // Update session
          if (session) {
            const updatedWords = [...session.words];
            updatedWords[wordIndexRef.current] = updatedWord;
            setSession({ ...session, words: updatedWords });
          }

          resolve(attempt);
        } finally {
          setIsAnalyzing(false);
        }
      };

      mediaRecorderRef.current!.stop();
      mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop());
    });
  }, [currentWord, session]);

  const nextWord = useCallback(() => {
    if (!session) return;
    
    const nextIndex = wordIndexRef.current + 1;
    if (nextIndex < session.words.length) {
      wordIndexRef.current = nextIndex;
      setCurrentWord(session.words[nextIndex]);
    }
  }, [session]);

  const previousWord = useCallback(() => {
    if (!session) return;
    
    const prevIndex = wordIndexRef.current - 1;
    if (prevIndex >= 0) {
      wordIndexRef.current = prevIndex;
      setCurrentWord(session.words[prevIndex]);
    }
  }, [session]);

  return {
    isRecording,
    isPlaying,
    isAnalyzing,
    currentWord,
    session,
    error,
    startSession,
    endSession,
    playWord,
    playWordSlow,
    startRecording,
    stopRecording,
    nextWord,
    previousWord,
  };
}

// Pronunciation analysis (would call backend API)
async function analyzePronunciation(
  word: string,
  language: string,
  audioBlob: Blob
): Promise<PronunciationFeedback> {
  // In production, this would call a speech recognition API
  // For now, return mock feedback
  
  const score = 70 + Math.floor(Math.random() * 30);
  
  return {
    overallScore: score,
    accuracy: score - Math.floor(Math.random() * 10),
    fluency: score + Math.floor(Math.random() * 10),
    completeness: score,
    issues: score < 80 ? [
      {
        type: 'mispronunciation',
        position: Math.floor(word.length / 2),
        expected: 'expected sound',
        actual: 'actual sound',
        severity: 'minor',
      }
    ] : [],
    suggestions: score < 80 
      ? ['Try speaking more slowly', 'Focus on the middle syllable']
      : ['Great pronunciation!'],
  };
}
```

### 2.3 Pronunciation Practice Page

```typescript
// src/app/pronunciation/page.tsx

'use client';

import { useState } from 'react';
import { PremiumGate } from '@/components/PremiumGate';
import { AppHeader } from '@/components/AppHeader';
import { usePronunciationPractice } from '@/hooks/usePronunciationPractice';
import { useVocabulary } from '@/hooks/useVocabulary';

export default function PronunciationPage() {
  const { items, currentDeck } = useVocabulary();
  const {
    isRecording,
    isPlaying,
    isAnalyzing,
    currentWord,
    session,
    startSession,
    endSession,
    playWord,
    playWordSlow,
    startRecording,
    stopRecording,
    nextWord,
    previousWord,
  } = usePronunciationPractice();
  
  const [showSummary, setShowSummary] = useState(false);

  const handleStartSession = async () => {
    if (!currentDeck || items.length === 0) return;
    const words = items.slice(0, 10).map(item => item.word);
    await startSession(currentDeck.language, words);
  };

  const handleEndSession = () => {
    const result = endSession();
    setShowSummary(true);
  };

  return (
    <PremiumGate>
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
        <AppHeader />
        
        <main className="mx-auto max-w-2xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
              Pronunciation Practice
            </h1>
            <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
              Practice pronunciation with AI feedback
            </p>
          </div>

          {!session ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
              <p className="mb-4 text-[#5c4d39] dark:text-[#c8b7a0]">
                Practice pronunciation of words from your vocabulary deck.
                Listen to the correct pronunciation, then record yourself.
              </p>
              
              <button
                onClick={handleStartSession}
                disabled={!currentDeck || items.length === 0}
                className="w-full rounded-xl bg-[#1f1c16] px-6 py-3 text-lg font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
              >
                Start Practice Session
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                  Word {session.words.indexOf(currentWord!) + 1} of {session.words.length}
                </p>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${((session.words.indexOf(currentWord!) + 1) / session.words.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Word Card */}
              {currentWord && (
                <div className="rounded-2xl border border-black/10 bg-white/80 p-8 text-center dark:border-white/10 dark:bg-[#15120d]/85">
                  <p className="text-4xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
                    {currentWord.word}
                  </p>
                  {currentWord.ipa && (
                    <p className="mt-2 text-lg text-[#8b7a5a] dark:text-[#6b5a3f]">
                      /{currentWord.ipa}/
                    </p>
                  )}
                  
                  {/* Play buttons */}
                  <div className="mt-6 flex justify-center gap-4">
                    <button
                      onClick={playWord}
                      disabled={isPlaying}
                      className="flex items-center gap-2 rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
                    >
                      🔊 Listen
                    </button>
                    <button
                      onClick={playWordSlow}
                      disabled={isPlaying}
                      className="flex items-center gap-2 rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] disabled:opacity-50 dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
                    >
                      🐢 Slow
                    </button>
                  </div>

                  {/* Record button */}
                  <div className="mt-8">
                    {isRecording ? (
                      <button
                        onClick={stopRecording}
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
                      >
                        ⏹️
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        disabled={isAnalyzing}
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1f1c16] text-[#f6e9cc] transition hover:bg-[#342d22] disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
                      >
                        🎤
                      </button>
                    )}
                    <p className="mt-2 text-sm text-[#8b7a5a] dark:text-[#6b5a3f]">
                      {isRecording ? 'Recording... Click to stop' : 'Click to record'}
                    </p>
                  </div>

                  {/* Last attempt feedback */}
                  {currentWord.attempts.length > 0 && (
                    <div className="mt-6 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Last attempt: {currentWord.attempts[currentWord.attempts.length - 1].score}%
                      </p>
                      {currentWord.attempts[currentWord.attempts.length - 1].feedback.suggestions.map((s, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                          • {s}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  onClick={previousWord}
                  disabled={session.words.indexOf(currentWord!) === 0}
                  className="rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleEndSession}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  End Session
                </button>
                <button
                  onClick={nextWord}
                  disabled={session.words.indexOf(currentWord!) === session.words.length - 1}
                  className="rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </PremiumGate>
  );
}
```

---

## 3. Data Backup & Restore

### 3.1 Backup Service

```typescript
// src/lib/backup-service.ts

import { getVocabularyDB } from './vocabulary-db';
import { getGamificationDB } from './gamification-db';
import { getLearningProfileService } from './learning-profile-service';

interface BackupData {
  version: string;
  timestamp: string;
  vocabulary: {
    decks: any[];
    items: any[];
    flashcards: any[];
  };
  gamification: {
    userProgress: any;
    languageProgress: any[];
    achievements: any[];
    sessions: any[];
  };
  learningProfiles: any[];
  settings: Record<string, any>;
}

export class BackupService {
  async createBackup(): Promise<Blob> {
    const vocabularyDb = await getVocabularyDB();
    const gamificationDb = await getGamificationDB();
    const learningProfileService = await getLearningProfileService();

    // Gather all data
    const data: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      vocabulary: {
        decks: await vocabularyDb.getDecks(),
        items: await this.getAllItems(vocabularyDb),
        flashcards: await this.getAllFlashcards(vocabularyDb),
      },
      gamification: {
        userProgress: await gamificationDb.getUserProgress(),
        languageProgress: await gamificationDb.getAllLanguageProgress(),
        achievements: await gamificationDb.getAchievements(),
        sessions: await gamificationDb.getRecentSessions(1000),
      },
      learningProfiles: await this.getAllProfiles(learningProfileService),
      settings: this.getSettings(),
    };

    // Create JSON blob
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  async restoreBackup(file: File): Promise<void> {
    const text = await file.text();
    const data: BackupData = JSON.parse(text);

    // Validate version
    if (!data.version) {
      throw new Error('Invalid backup file: missing version');
    }

    // Restore vocabulary
    const vocabularyDb = await getVocabularyDB();
    await this.restoreVocabulary(vocabularyDb, data.vocabulary);

    // Restore gamification
    const gamificationDb = await getGamificationDB();
    await this.restoreGamification(gamificationDb, data.gamification);

    // Restore learning profiles
    const learningProfileService = await getLearningProfileService();
    await this.restoreLearningProfiles(learningProfileService, data.learningProfiles);

    // Restore settings
    this.restoreSettings(data.settings);
  }

  private async getAllItems(db: any): Promise<any[]> {
    // Implementation to get all items from all decks
    const decks = await db.getDecks();
    const allItems: any[] = [];
    for (const deck of decks) {
      const items = await db.getItems(deck.id);
      allItems.push(...items);
    }
    return allItems;
  }

  private async getAllFlashcards(db: any): Promise<any[]> {
    // Implementation to get all flashcards
    // This would need to be added to the vocabulary DB
    return [];
  }

  private async getAllProfiles(service: any): Promise<any[]> {
    // Implementation to get all learning profiles
    return [];
  }

  private getSettings(): Record<string, any> {
    const settings: Record<string, any> = {};
    // Get settings from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('soulnotes-')) {
        try {
          settings[key] = JSON.parse(localStorage.getItem(key)!);
        } catch {
          settings[key] = localStorage.getItem(key);
        }
      }
    }
    return settings;
  }

  private async restoreVocabulary(db: any, data: any): Promise<void> {
    // Clear existing data and restore from backup
    // Implementation would clear and re-populate tables
  }

  private async restoreGamification(db: any, data: any): Promise<void> {
    // Clear and restore gamification data
  }

  private async restoreLearningProfiles(service: any, profiles: any[]): Promise<void> {
    // Clear and restore learning profiles
  }

  private restoreSettings(settings: Record<string, any>): void {
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  }
}

export const backupService = new BackupService();
```

### 3.2 Settings Page

```typescript
// src/app/settings/page.tsx

'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { useLicense } from '@/hooks/useLicense';
import { backupService } from '@/lib/backup-service';
import { useAnkiExport } from '@/hooks/useAnkiExport';

export default function SettingsPage() {
  const { isPremium, license, deactivate } = useLicense();
  const { isExporting, progress, exportDeck } = useAnkiExport();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const blob = await backupService.createBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulnotes-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      await backupService.restoreBackup(file);
      alert('Backup restored successfully! Please refresh the page.');
    } catch (err) {
      console.error('Restore failed:', err);
      alert('Failed to restore backup. Please check the file format.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <AppHeader />
      
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
          Settings
        </h1>

        {/* License Section */}
        <section className="mb-6 rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
          <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
            License
          </h2>
          
          {isPremium ? (
            <div className="space-y-2">
              <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                ✅ Premium Active
              </p>
              {license && (
                <p className="text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                  Key ID: {license.keyId}
                </p>
              )}
              <button
                onClick={deactivate}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Deactivate License
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
              Free tier active. Upgrade to Premium for unlimited vocabulary and AI features.
            </p>
          )}
        </section>

        {/* Backup Section */}
        <section className="mb-6 rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
          <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
            Backup & Restore
          </h2>
          
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                Export all your data (vocabulary, progress, settings) to a JSON file.
              </p>
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
              >
                {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
              </button>
            </div>
            
            <div>
              <p className="mb-2 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                Restore from a previous backup file.
              </p>
              <label className="inline-block cursor-pointer rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]">
                {isRestoring ? 'Restoring...' : 'Restore Backup'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  disabled={isRestoring}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Anki Export Section */}
        {isPremium && (
          <section className="mb-6 rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-[#15120d]/85">
            <h2 className="mb-4 text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
              Anki Export
            </h2>
            
            <p className="mb-4 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
              Export your vocabulary decks to Anki .apkg format for use with Anki.
            </p>
            
            {isExporting && (
              <div className="mb-4">
                <div className="h-2 overflow-hidden rounded-full bg-[#efe0c3] dark:bg-[#2a2218]">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
                  Exporting... {progress}%
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
```

---

## 4. Implementation Checklist

### Phase 5A: Anki Export (Week 1)
- [ ] Install sql.js and jszip dependencies
- [ ] Create AnkiExporter class
- [ ] Implement SQLite database creation
- [ ] Implement note and card generation
- [ ] Implement ZIP file creation
- [ ] Create useAnkiExport hook
- [ ] Add export UI to settings

### Phase 5B: Pronunciation Practice (Week 1-2)
- [ ] Create pronunciation types
- [ ] Create usePronunciationPractice hook
- [ ] Implement audio recording
- [ ] Implement TTS playback at different speeds
- [ ] Create pronunciation analysis API (or mock)
- [ ] Create pronunciation practice page
- [ ] Integrate with learning profile

### Phase 5C: Data Backup (Week 2)
- [ ] Create BackupService
- [ ] Implement data export
- [ ] Implement data import
- [ ] Add backup/restore UI
- [ ] Test backup/restore flow

### Phase 5D: Settings & Polish (Week 2)
- [ ] Create settings page
- [ ] Add license management UI
- [ ] Add TTS voice selection
- [ ] Add theme settings
- [ ] Add language preferences
- [ ] Final testing and bug fixes

---

## 5. Dependencies to Add

```json
{
  "dependencies": {
    "sql.js": "^1.8.0",
    "jszip": "^3.10.1"
  }
}
```

---

## 6. File Structure Summary

```
src/
├── app/
│   ├── pronunciation/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── lib/
│   ├── anki-export.ts
│   └── backup-service.ts
├── hooks/
│   ├── useAnkiExport.ts
│   └── usePronunciationPractice.ts
└── types/
    └── pronunciation.ts