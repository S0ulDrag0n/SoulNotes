// src/lib/anki-export.ts

import initSqlJs, { type Database } from 'sql.js';
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

// Model for basic vocabulary cards
const VOCABULARY_MODEL = {
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
  private mediaFiles: Map<string, Blob> = new Map();

  async exportDeck(
    deck: LanguageDeck,
    items: VocabularyItem[],
    flashcards: Flashcard[],
    includeAudio: boolean = true
  ): Promise<Blob> {
    // Dynamically import sql.js
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
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
      CREATE TABLE IF NOT EXISTS media (
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

  private createTables(db: Database): void {
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