// src/lib/backup-service.ts

import JSZip from 'jszip';
import { getLearningProfileService } from './learning-profile-service';
import { getGamificationDB } from './gamification-db';
import { getVocabularyDB } from './vocabulary-db';
import type { LearningProfile } from '@/types/learning-profile';
import type { VocabularyItem, LanguageDeck, Flashcard } from '@/types/vocabulary';
import type { UserProgress, Achievement } from '@/types/gamification';

export interface BackupData {
  version: string;
  timestamp: string;
  profiles: LearningProfile[];
  decks: LanguageDeck[];
  items: VocabularyItem[];
  flashcards: Flashcard[];
  userProgress: UserProgress | null;
  achievements: Achievement[];
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  preferredVoice: string | null;
  autoSaveTranscripts: boolean;
  notificationEnabled: boolean;
}

const BACKUP_VERSION = '1.0.0';

class BackupService {
  private readonly SETTINGS_KEY = 'soulnotes_settings';

  async createBackup(): Promise<Blob> {
    const zip = new JSZip();
    
    // Gather all data
    const backupData: BackupData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      profiles: await this.getProfiles(),
      decks: await this.getDecks(),
      items: await this.getItems(),
      flashcards: await this.getFlashcards(),
      userProgress: await this.getUserProgress(),
      achievements: await this.getAchievements(),
      settings: this.getSettings(),
    };

    // Add metadata
    zip.file('metadata.json', JSON.stringify({
      version: BACKUP_VERSION,
      timestamp: backupData.timestamp,
      appVersion: process.env.npm_package_version || 'unknown',
    }));

    // Add data files
    zip.file('profiles.json', JSON.stringify(backupData.profiles));
    zip.file('decks.json', JSON.stringify(backupData.decks));
    zip.file('items.json', JSON.stringify(backupData.items));
    zip.file('flashcards.json', JSON.stringify(backupData.flashcards));
    zip.file('userProgress.json', JSON.stringify(backupData.userProgress));
    zip.file('achievements.json', JSON.stringify(backupData.achievements));
    zip.file('settings.json', JSON.stringify(backupData.settings));

    // Create the zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    return blob;
  }

  async restoreBackup(file: File): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      profilesRestored: 0,
      decksRestored: 0,
      itemsRestored: 0,
      flashcardsRestored: 0,
      userProgressRestored: false,
      achievementsRestored: 0,
      settingsRestored: false,
      errors: [],
    };

    try {
      const zip = await JSZip.loadAsync(file);
      
      // Validate version
      const metadataFile = zip.file('metadata.json');
      if (!metadataFile) {
        result.errors.push('Invalid backup file: missing metadata');
        return result;
      }

      const metadataStr = await metadataFile.async('string');
      const metadata = JSON.parse(metadataStr) as { version: string; timestamp: string };
      
      // Check version compatibility
      if (!this.isVersionCompatible(metadata.version)) {
        result.errors.push(`Incompatible backup version: ${metadata.version}`);
        return result;
      }

      // Restore profiles
      const profilesFile = zip.file('profiles.json');
      if (profilesFile) {
        try {
          const profilesStr = await profilesFile.async('string');
          const profiles = JSON.parse(profilesStr) as LearningProfile[];
          result.profilesRestored = await this.restoreProfiles(profiles);
        } catch (err) {
          result.errors.push(`Failed to restore profiles: ${err}`);
        }
      }

      // Restore decks
      const decksFile = zip.file('decks.json');
      if (decksFile) {
        try {
          const decksStr = await decksFile.async('string');
          const decks = JSON.parse(decksStr) as LanguageDeck[];
          result.decksRestored = await this.restoreDecks(decks);
        } catch (err) {
          result.errors.push(`Failed to restore decks: ${err}`);
        }
      }

      // Restore items
      const itemsFile = zip.file('items.json');
      if (itemsFile) {
        try {
          const itemsStr = await itemsFile.async('string');
          const items = JSON.parse(itemsStr) as VocabularyItem[];
          result.itemsRestored = await this.restoreItems(items);
        } catch (err) {
          result.errors.push(`Failed to restore items: ${err}`);
        }
      }

      // Restore flashcards
      const flashcardsFile = zip.file('flashcards.json');
      if (flashcardsFile) {
        try {
          const flashcardsStr = await flashcardsFile.async('string');
          const flashcards = JSON.parse(flashcardsStr) as Flashcard[];
          result.flashcardsRestored = await this.restoreFlashcards(flashcards);
        } catch (err) {
          result.errors.push(`Failed to restore flashcards: ${err}`);
        }
      }

      // Restore user progress
      const userProgressFile = zip.file('userProgress.json');
      if (userProgressFile) {
        try {
          const userProgressStr = await userProgressFile.async('string');
          const userProgress = JSON.parse(userProgressStr) as UserProgress | null;
          if (userProgress) {
            result.userProgressRestored = await this.restoreUserProgress(userProgress);
          }
        } catch (err) {
          result.errors.push(`Failed to restore user progress: ${err}`);
        }
      }

      // Restore achievements
      const achievementsFile = zip.file('achievements.json');
      if (achievementsFile) {
        try {
          const achievementsStr = await achievementsFile.async('string');
          const achievements = JSON.parse(achievementsStr) as Achievement[];
          result.achievementsRestored = await this.restoreAchievements(achievements);
        } catch (err) {
          result.errors.push(`Failed to restore achievements: ${err}`);
        }
      }

      // Restore settings
      const settingsFile = zip.file('settings.json');
      if (settingsFile) {
        try {
          const settingsStr = await settingsFile.async('string');
          const settings = JSON.parse(settingsStr) as UserSettings;
          this.restoreSettings(settings);
          result.settingsRestored = true;
        } catch (err) {
          result.errors.push(`Failed to restore settings: ${err}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (err) {
      result.errors.push(`Failed to read backup file: ${err}`);
    }

    return result;
  }

  async exportVocabularyCSV(language?: string): Promise<string> {
    const items = await this.getItems();
    const filtered = language 
      ? items.filter((v: VocabularyItem) => v.language === language)
      : items;

    if (filtered.length === 0) {
      return '';
    }

    // CSV headers
    const headers = ['word', 'translation', 'language', 'context', 'created_at'];
    const rows = [headers.join(',')];

    // Add data rows
    for (const item of filtered) {
      const row = [
        this.escapeCSV(item.word),
        this.escapeCSV(item.translation),
        this.escapeCSV(item.language),
        this.escapeCSV(item.context || ''),
        typeof item.createdAt === 'string' ? item.createdAt : (item.createdAt as Date).toISOString(),
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  async importVocabularyCSV(csvData: string, deckId: string, language: string): Promise<number> {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return 0;
    }

    // Skip header row
    const dataLines = lines.slice(1);
    let imported = 0;

    const vocabDb = await getVocabularyDB();

    for (const line of dataLines) {
      try {
        const fields = this.parseCSVLine(line);
        if (fields.length >= 2) {
          const item: VocabularyItem = {
            id: crypto.randomUUID(),
            deckId,
            word: fields[0],
            translation: fields[1],
            language: fields[2] || language,
            context: fields[3] || '',
            source: 'manual',
            createdAt: new Date(),
            tags: [],
          };
          await vocabDb.addItem(item);
          imported++;
        }
      } catch (err) {
        console.error('Failed to import vocabulary item:', err);
      }
    }

    return imported;
  }

  private async getProfiles(): Promise<LearningProfile[]> {
    try {
      const service = await getLearningProfileService();
      return await service.getAllProfiles();
    } catch (err) {
      console.error('Failed to get profiles for backup:', err);
      return [];
    }
  }

  private async getDecks(): Promise<LanguageDeck[]> {
    try {
      const vocabDb = await getVocabularyDB();
      return await vocabDb.getDecks();
    } catch (err) {
      console.error('Failed to get decks for backup:', err);
      return [];
    }
  }

  private async getItems(): Promise<VocabularyItem[]> {
    try {
      const vocabDb = await getVocabularyDB();
      const decks = await vocabDb.getDecks();
      const allItems: VocabularyItem[] = [];
      
      for (const deck of decks) {
        const items = await vocabDb.getItems(deck.id);
        allItems.push(...items);
      }
      
      return allItems;
    } catch (err) {
      console.error('Failed to get vocabulary items for backup:', err);
      return [];
    }
  }

  private async getFlashcards(): Promise<Flashcard[]> {
    try {
      const vocabDb = await getVocabularyDB();
      return await vocabDb.getAllFlashcards();
    } catch (err) {
      console.error('Failed to get flashcards for backup:', err);
      return [];
    }
  }

  private async getUserProgress(): Promise<UserProgress | null> {
    try {
      const gamificationDb = await getGamificationDB();
      return await gamificationDb.getUserProgress();
    } catch (err) {
      console.error('Failed to get user progress for backup:', err);
      return null;
    }
  }

  private async getAchievements(): Promise<Achievement[]> {
    try {
      const gamificationDb = await getGamificationDB();
      return await gamificationDb.getAchievements();
    } catch (err) {
      console.error('Failed to get achievements for backup:', err);
      return [];
    }
  }

  private getSettings(): UserSettings {
    if (typeof window === 'undefined') {
      return this.getDefaultSettings();
    }

    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        return { ...this.getDefaultSettings(), ...JSON.parse(stored) };
      }
    } catch (err) {
      console.error('Failed to get settings for backup:', err);
    }

    return this.getDefaultSettings();
  }

  private getDefaultSettings(): UserSettings {
    return {
      theme: 'system',
      language: 'en',
      preferredVoice: null,
      autoSaveTranscripts: true,
      notificationEnabled: true,
    };
  }

  private async restoreProfiles(profiles: LearningProfile[]): Promise<number> {
    try {
      const service = await getLearningProfileService();
      let restored = 0;
      
      for (const profile of profiles) {
        try {
          await service.updateProfile(profile);
          restored++;
        } catch (err) {
          console.error('Failed to restore profile:', err);
        }
      }
      
      return restored;
    } catch (err) {
      console.error('Failed to restore profiles:', err);
      return 0;
    }
  }

  private async restoreDecks(decks: LanguageDeck[]): Promise<number> {
    try {
      const vocabDb = await getVocabularyDB();
      let restored = 0;
      
      for (const deck of decks) {
        try {
          await vocabDb.createDeck(deck);
          restored++;
        } catch (err) {
          console.error('Failed to restore deck:', err);
        }
      }
      
      return restored;
    } catch (err) {
      console.error('Failed to restore decks:', err);
      return 0;
    }
  }

  private async restoreItems(items: VocabularyItem[]): Promise<number> {
    try {
      const vocabDb = await getVocabularyDB();
      let restored = 0;
      
      for (const item of items) {
        try {
          await vocabDb.addItem(item);
          restored++;
        } catch (err) {
          console.error('Failed to restore vocabulary item:', err);
        }
      }
      
      return restored;
    } catch (err) {
      console.error('Failed to restore vocabulary items:', err);
      return 0;
    }
  }

  private async restoreFlashcards(flashcards: Flashcard[]): Promise<number> {
    try {
      const vocabDb = await getVocabularyDB();
      let restored = 0;
      
      for (const card of flashcards) {
        try {
          await vocabDb.addFlashcard(card);
          restored++;
        } catch (err) {
          console.error('Failed to restore flashcard:', err);
        }
      }
      
      return restored;
    } catch (err) {
      console.error('Failed to restore flashcards:', err);
      return 0;
    }
  }

  private async restoreUserProgress(progress: UserProgress): Promise<boolean> {
    try {
      const gamificationDb = await getGamificationDB();
      await gamificationDb.saveUserProgress(progress);
      return true;
    } catch (err) {
      console.error('Failed to restore user progress:', err);
      return false;
    }
  }

  private async restoreAchievements(achievements: Achievement[]): Promise<number> {
    try {
      const gamificationDb = await getGamificationDB();
      await gamificationDb.saveAchievements(achievements);
      return achievements.length;
    } catch (err) {
      console.error('Failed to restore achievements:', err);
      return 0;
    }
  }

  private restoreSettings(settings: UserSettings): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to restore settings:', err);
    }
  }

  private isVersionCompatible(version: string): boolean {
    const [major] = version.split('.');
    const [currentMajor] = BACKUP_VERSION.split('.');
    return major === currentMajor;
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
}

export interface RestoreResult {
  success: boolean;
  profilesRestored: number;
  decksRestored: number;
  itemsRestored: number;
  flashcardsRestored: number;
  userProgressRestored: boolean;
  achievementsRestored: number;
  settingsRestored: boolean;
  errors: string[];
}

let backupServiceInstance: BackupService | null = null;

export async function getBackupService(): Promise<BackupService> {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}