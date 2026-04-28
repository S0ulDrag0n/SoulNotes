// src/lib/learning-profile-service.ts

import type { 
  LearningProfile, 
  GrammarWeakness, 
  VocabularyGap, 
  PronunciationIssue,
  PracticeResult,
  WeeklyProgress,
  PracticeSession,
  GrammarCategory,
} from '@/types/learning-profile';

const DB_NAME = 'soulnotes-learning-profiles';
const DB_VERSION = 1;

class LearningProfileService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', { keyPath: 'id' });
          profileStore.createIndex('language', 'language', { unique: false });
        }

        if (!db.objectStoreNames.contains('practiceSessions')) {
          const sessionStore = db.createObjectStore('practiceSessions', { keyPath: 'id' });
          sessionStore.createIndex('profileId', 'profileId', { unique: false });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('weeklyProgress')) {
          const progressStore = db.createObjectStore('weeklyProgress', { keyPath: 'id' });
          progressStore.createIndex('profileId', 'profileId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // ---------------------------------------------------------------------
  // Profile CRUD
  // ---------------------------------------------------------------------
  
  async getProfile(language: string): Promise<LearningProfile | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readonly');
      const store = transaction.objectStore('profiles');
      const index = store.index('language');
      const request = index.get(language);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getProfileById(id: string): Promise<LearningProfile | null> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readonly');
      const store = transaction.objectStore('profiles');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProfiles(): Promise<LearningProfile[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readonly');
      const store = transaction.objectStore('profiles');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async createProfile(language: string): Promise<LearningProfile> {
    const db = this.ensureDb();
    const profile: LearningProfile = {
      id: crypto.randomUUID(),
      language,
      grammarWeaknesses: [],
      vocabularyGaps: [],
      pronunciationIssues: [],
      confidenceAreas: [],
      overallScore: 100,
      grammarScore: 100,
      vocabularyScore: 100,
      pronunciationScore: 100,
      fluencyScore: 100,
      sessionsCompleted: 0,
      totalPracticeMinutes: 0,
      wordsLearned: 0,
      wordsMastered: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastPracticeAt: null,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.add(profile);

      request.onsuccess = () => resolve(profile);
      request.onerror = () => reject(request.error);
    });
  }

  async updateProfile(profile: LearningProfile): Promise<void> {
    const db = this.ensureDb();
    profile.updatedAt = new Date();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.put(profile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProfile(id: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ---------------------------------------------------------------------
  // Grammar weakness tracking
  // ---------------------------------------------------------------------

  async recordGrammarError(
    language: string,
    pattern: string,
    category: GrammarCategory,
    example: string
  ): Promise<void> {
    const profile = await this.getProfile(language) ?? await this.createProfile(language);

    const existingIndex = profile.grammarWeaknesses.findIndex(
      w => w.pattern.toLowerCase() === pattern.toLowerCase()
    );

    if (existingIndex >= 0) {
      const weakness = profile.grammarWeaknesses[existingIndex];
      weakness.errorCount += 1;
      weakness.lastOccurred = new Date();
      if (!weakness.examples.includes(example)) {
        weakness.examples.push(example);
        if (weakness.examples.length > 5) weakness.examples.shift();
      }
      // Calculate improvement (negative = getting worse)
      const total = weakness.errorCount + weakness.correctCount;
      const recentErrorRate = weakness.errorCount / total;
      weakness.improvement = -Math.round(recentErrorRate * 100);
    } else {
      profile.grammarWeaknesses.push({
        pattern,
        category,
        errorCount: 1,
        correctCount: 0,
        lastOccurred: new Date(),
        examples: [example],
        improvement: -100,
      });
    }

    // Update grammar score
    profile.grammarScore = this.calculateGrammarScore(profile.grammarWeaknesses);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  async recordGrammarCorrect(
    language: string,
    pattern: string
  ): Promise<void> {
    const profile = await this.getProfile(language);
    if (!profile) return;

    const existingIndex = profile.grammarWeaknesses.findIndex(
      w => w.pattern.toLowerCase() === pattern.toLowerCase()
    );

    if (existingIndex >= 0) {
      const weakness = profile.grammarWeaknesses[existingIndex];
      weakness.correctCount += 1;
      
      // Calculate improvement
      const total = weakness.errorCount + weakness.correctCount;
      const recentCorrectRate = weakness.correctCount / total;
      weakness.improvement = Math.round(recentCorrectRate * 100) - 50;

      // Remove if fully mastered (10+ correct, < 20% error rate)
      if (weakness.correctCount >= 10 && weakness.errorCount / total < 0.2) {
        profile.grammarWeaknesses.splice(existingIndex, 1);
      }
    }

    profile.grammarScore = this.calculateGrammarScore(profile.grammarWeaknesses);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // ---------------------------------------------------------------------
  // Vocabulary gap tracking
  // ---------------------------------------------------------------------

  async recordVocabularyGap(
    language: string,
    word: string,
    translation: string,
    context: string
  ): Promise<void> {
    const profile = await this.getProfile(language) ?? await this.createProfile(language);

    const existingIndex = profile.vocabularyGaps.findIndex(
      g => g.word.toLowerCase() === word.toLowerCase()
    );

    if (existingIndex >= 0) {
      const gap = profile.vocabularyGaps[existingIndex];
      gap.encounterCount += 1;
      gap.lastEncountered = new Date();
      gap.priority = this.calculateVocabularyPriority(gap);
    } else {
      profile.vocabularyGaps.push({
        word,
        translation,
        context,
        encounterCount: 1,
        lastEncountered: new Date(),
        priority: 'medium',
        relatedWords: [],
      });
    }

    profile.vocabularyScore = this.calculateVocabularyScore(profile.vocabularyGaps);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  async markVocabularyLearned(language: string, word: string): Promise<void> {
    const profile = await this.getProfile(language);
    if (!profile) return;

    const index = profile.vocabularyGaps.findIndex(
      g => g.word.toLowerCase() === word.toLowerCase()
    );

    if (index >= 0) {
      profile.vocabularyGaps.splice(index, 1);
      profile.wordsLearned += 1;
    }

    profile.vocabularyScore = this.calculateVocabularyScore(profile.vocabularyGaps);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  async markVocabularyMastered(language: string, word: string): Promise<void> {
    const profile = await this.getProfile(language);
    if (!profile) return;

    const index = profile.vocabularyGaps.findIndex(
      g => g.word.toLowerCase() === word.toLowerCase()
    );

    if (index >= 0) {
      profile.vocabularyGaps.splice(index, 1);
      profile.wordsMastered += 1;
    }

    profile.vocabularyScore = this.calculateVocabularyScore(profile.vocabularyGaps);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // ---------------------------------------------------------------------
  // Pronunciation tracking
  // ---------------------------------------------------------------------

  async recordPronunciationIssue(
    language: string,
    sound: string,
    word: string
  ): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    const existingIndex = profile.pronunciationIssues.findIndex(
      p => p.sound === sound
    );

    if (existingIndex >= 0) {
      const issue = profile.pronunciationIssues[existingIndex];
      issue.issueCount += 1;
      issue.lastOccurred = new Date();
      if (!issue.wordExamples.includes(word)) {
        issue.wordExamples.push(word);
        if (issue.wordExamples.length > 10) issue.wordExamples.shift();
      }
    } else {
      profile.pronunciationIssues.push({
        sound,
        wordExamples: [word],
        issueCount: 1,
        lastOccurred: new Date(),
        improvement: -100,
      });
    }

    profile.pronunciationScore = this.calculatePronunciationScore(profile.pronunciationIssues);
    profile.overallScore = this.calculateOverallScore(profile);

    await this.updateProfile(profile);
  }

  // ---------------------------------------------------------------------
  // Practice recommendations
  // ---------------------------------------------------------------------

  async getPracticeRecommendations(language: string): Promise<{
    grammar: GrammarWeakness[];
    vocabulary: VocabularyGap[];
    pronunciation: PronunciationIssue[];
  }> {
    const profile = await this.getProfile(language);
    if (!profile) {
      return { grammar: [], vocabulary: [], pronunciation: [] };
    }

    // Sort by priority (most problematic first)
    const grammar = profile.grammarWeaknesses
      .slice()
      .sort((a, b) => a.improvement - b.improvement)
      .slice(0, 5);

    const vocabulary = profile.vocabularyGaps
      .slice()
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10);

    const pronunciation = profile.pronunciationIssues
      .slice()
      .sort((a, b) => a.improvement - b.improvement)
      .slice(0, 5);

    return { grammar, vocabulary, pronunciation };
  }

  // ---------------------------------------------------------------------
  // Practice sessions
  // ---------------------------------------------------------------------

  async createPracticeSession(
    language: string,
    type: PracticeSession['type'],
    focusAreas: string[] = []
  ): Promise<PracticeSession> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    const session: PracticeSession = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      type,
      startedAt: new Date(),
      endedAt: null,
      focusAreas,
      results: [],
      overallScore: 0,
    };

    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practiceSessions', 'readwrite');
      const store = transaction.objectStore('practiceSessions');
      const request = store.add(session);

      request.onsuccess = () => resolve(session);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePracticeSession(session: PracticeSession): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practiceSessions', 'readwrite');
      const store = transaction.objectStore('practiceSessions');
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async endPracticeSession(
    sessionId: string,
    results: PracticeResult[]
  ): Promise<PracticeSession> {
    const db = this.ensureDb();
    
    // Get the session
    const session = await new Promise<PracticeSession | null>((resolve, reject) => {
      const transaction = db.transaction('practiceSessions', 'readonly');
      const store = transaction.objectStore('practiceSessions');
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const endedAt = new Date();
    const minutes = Math.round(
      (endedAt.getTime() - new Date(session.startedAt).getTime()) / 60000
    );

    const correctCount = results.filter(r => r.correct).length;
    const overallScore = results.length > 0 
      ? Math.round((correctCount / results.length) * 100) 
      : 0;

    const updatedSession: PracticeSession = {
      ...session,
      endedAt,
      results,
      overallScore,
    };

    // Update session in DB
    await this.updatePracticeSession(updatedSession);

    // Update profile
    const profile = await this.getProfileById(session.profileId);
    if (profile) {
      profile.sessionsCompleted += 1;
      profile.totalPracticeMinutes += minutes;
      profile.lastPracticeAt = endedAt;

      // Process results
      for (const result of results) {
        if (result.type === 'grammar') {
          if (result.correct) {
            await this.recordGrammarCorrect(profile.language, result.item);
          }
        }
      }

      await this.updateProfile(profile);
      await this.updateWeeklyProgress(profile.id, minutes, results, overallScore);
    }

    return updatedSession;
  }

  async getPracticeSessions(profileId: string, limit: number = 10): Promise<PracticeSession[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('practiceSessions', 'readonly');
      const store = transaction.objectStore('practiceSessions');
      const index = store.index('profileId');
      const request = index.getAll(profileId);

      request.onsuccess = () => {
        const sessions = request.result || [];
        sessions.sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        resolve(sessions.slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ---------------------------------------------------------------------
  // Weekly progress
  // ---------------------------------------------------------------------

  private async updateWeeklyProgress(
    profileId: string,
    minutes: number,
    results: PracticeResult[],
    score: number
  ): Promise<void> {
    const db = this.ensureDb();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekId = `${profileId}-${weekStart.toISOString().split('T')[0]}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('weeklyProgress', 'readwrite');
      const store = transaction.objectStore('weeklyProgress');
      const getRequest = store.get(weekId);

      getRequest.onsuccess = () => {
        let progress = getRequest.result as (WeeklyProgress & { id: string; profileId: string }) | undefined;

        if (!progress) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);

          progress = {
            id: weekId,
            profileId,
            weekStart,
            weekEnd,
            totalMinutes: 0,
            sessionsCompleted: 0,
            wordsLearned: 0,
            wordsReviewed: 0,
            averageScore: 0,
            streakDays: 0,
            improvement: { grammar: 0, vocabulary: 0, pronunciation: 0, fluency: 0 },
          };
        }

        progress.totalMinutes += minutes;
        progress.sessionsCompleted += 1;
        
        // Update average score
        const totalSessions = progress.sessionsCompleted;
        progress.averageScore = Math.round(
          ((progress.averageScore * (totalSessions - 1)) + score) / totalSessions
        );

        // Count words reviewed
        const vocabResults = results.filter(r => r.type === 'vocabulary');
        progress.wordsReviewed += vocabResults.length;

        store.put(progress);
        resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getWeeklyProgress(language: string, weeks: number = 4): Promise<WeeklyProgress[]> {
    const db = this.ensureDb();
    const profile = await this.getProfile(language);
    if (!profile) return [];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('weeklyProgress', 'readonly');
      const store = transaction.objectStore('weeklyProgress');
      const request = store.getAll();

      request.onsuccess = () => {
        const allProgress = request.result as WeeklyProgress[];
        const filtered = allProgress
          .filter(p => p.profileId === profile.id)
          .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
          .slice(0, weeks);
        resolve(filtered);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ---------------------------------------------------------------------
  // Score calculations
  // ---------------------------------------------------------------------

  private calculateGrammarScore(weaknesses: GrammarWeakness[]): number {
    if (weaknesses.length === 0) return 100;
    const avgImprovement = weaknesses.reduce((sum, w) => sum + w.improvement, 0) / weaknesses.length;
    return Math.max(0, Math.min(100, 100 + avgImprovement));
  }

  private calculateVocabularyScore(gaps: VocabularyGap[]): number {
    if (gaps.length === 0) return 100;
    // More gaps = lower score
    const highPriority = gaps.filter(g => g.priority === 'high').length;
    const mediumPriority = gaps.filter(g => g.priority === 'medium').length;
    const penalty = (highPriority * 5) + (mediumPriority * 2);
    return Math.max(0, 100 - penalty);
  }

  private calculatePronunciationScore(issues: PronunciationIssue[]): number {
    if (issues.length === 0) return 100;
    const avgImprovement = issues.reduce((sum, i) => sum + i.improvement, 0) / issues.length;
    return Math.max(0, Math.min(100, 100 + avgImprovement));
  }

  private calculateOverallScore(profile: LearningProfile): number {
    return Math.round(
      (profile.grammarScore + profile.vocabularyScore + profile.pronunciationScore + profile.fluencyScore) / 4
    );
  }

  private calculateVocabularyPriority(gap: VocabularyGap): 'high' | 'medium' | 'low' {
    if (gap.encounterCount >= 3) return 'high';
    if (gap.encounterCount >= 2) return 'medium';
    return 'low';
  }

  // ---------------------------------------------------------------------
  // Confidence areas
  // ---------------------------------------------------------------------

  async addConfidenceArea(language: string, area: string): Promise<void> {
    let profile = await this.getProfile(language);
    if (!profile) profile = await this.createProfile(language);

    if (!profile.confidenceAreas.includes(area)) {
      profile.confidenceAreas.push(area);
      await this.updateProfile(profile);
    }
  }

  async removeConfidenceArea(language: string, area: string): Promise<void> {
    const profile = await this.getProfile(language);
    if (!profile) return;

    const index = profile.confidenceAreas.indexOf(area);
    if (index >= 0) {
      profile.confidenceAreas.splice(index, 1);
      await this.updateProfile(profile);
    }
  }
}

// Singleton instance and initialization promise
let serviceInstance: LearningProfileService | null = null;
let initPromise: Promise<void> | null = null;

export async function getLearningProfileService(): Promise<LearningProfileService> {
  // If already initialized, return immediately
  if (serviceInstance) {
    return serviceInstance;
  }
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    if (serviceInstance) {
      return serviceInstance;
    }
  }
  
  // Start initialization
  serviceInstance = new LearningProfileService();
  initPromise = serviceInstance.init();
  
  try {
    await initPromise;
    return serviceInstance;
  } catch (error) {
    // Reset on failure so next call can retry
    serviceInstance = null;
    initPromise = null;
    throw error;
  }
}

// Export class for testing
export { LearningProfileService };