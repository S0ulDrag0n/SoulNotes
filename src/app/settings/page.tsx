'use client';

import { useState, useCallback, useEffect } from 'react';
import { getBackupService, type RestoreResult } from '@/lib/backup-service';
import { useTheme } from '@/hooks/useTheme';

interface Settings {
  language: string;
  preferredVoice: string | null;
  autoSaveTranscripts: boolean;
  notificationEnabled: boolean;
}

export default function SettingsPage() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [settings, setSettings] = useState<Settings>({
    language: 'en',
    preferredVoice: null,
    autoSaveTranscripts: true,
    notificationEnabled: true,
  });
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('soulnotes_settings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSettings(prev => ({ ...prev, ...parsed }));
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const handleSettingChange = useCallback(<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('soulnotes_settings');
      const current = stored ? JSON.parse(stored) : {};
      localStorage.setItem('soulnotes_settings', JSON.stringify({
        ...current,
        [key]: value,
      }));
    }
  }, []);

  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    setError(null);
    
    try {
      const backupService = await getBackupService();
      const blob = await backupService.createBackup();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulnotes-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  const handleRestore = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsRestoring(true);
    setError(null);
    setRestoreResult(null);
    
    try {
      const backupService = await getBackupService();
      const result = await backupService.restoreBackup(file);
      setRestoreResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
      // Reset file input
      event.target.value = '';
    }
  }, []);

  const handleExportVocabulary = useCallback(async () => {
    setIsBackingUp(true);
    setError(null);
    
    try {
      const backupService = await getBackupService();
      const csv = await backupService.exportVocabularyCSV();
      
      if (!csv) {
        setError('No vocabulary to export');
        return;
      }
      
      // Create download link
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soulnotes-vocabulary-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export vocabulary');
    } finally {
      setIsBackingUp(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        
        {restoreResult && (
          <div className={`mb-4 p-4 rounded-lg border ${
            restoreResult.success 
              ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
              : 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
          }`}>
            <h3 className="font-semibold mb-2">
              {restoreResult.success ? 'Restore Completed' : 'Restore Completed with Issues'}
            </h3>
            <ul className="text-sm space-y-1">
              <li>Profiles restored: {restoreResult.profilesRestored}</li>
              <li>Decks restored: {restoreResult.decksRestored}</li>
              <li>Vocabulary items restored: {restoreResult.itemsRestored}</li>
              <li>Flashcards restored: {restoreResult.flashcardsRestored}</li>
              <li>User progress restored: {restoreResult.userProgressRestored ? 'Yes' : 'No'}</li>
              <li>Achievements restored: {restoreResult.achievementsRestored}</li>
              <li>Settings restored: {restoreResult.settingsRestored ? 'Yes' : 'No'}</li>
            </ul>
            {restoreResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Errors:</p>
                <ul className="text-sm list-disc list-inside">
                  {restoreResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Appearance Settings */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Appearance</h2>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Dark Mode</label>
                <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">
                  Toggle between light and dark theme
                </p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDarkMode ? 'bg-[#f59e0b]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Language Settings */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Language</h2>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Interface Language</label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-[#e7d8a6] dark:border-[#3d3d3d] bg-white dark:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select>
            </div>
          </div>
        </section>

        {/* Data Settings */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Data Management</h2>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-6">
            {/* Backup */}
            <div>
              <h3 className="font-medium mb-2">Backup</h3>
              <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0] mb-3">
                Download a complete backup of your data including profiles, vocabulary, flashcards, and progress.
              </p>
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="px-4 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBackingUp ? 'Creating Backup...' : 'Download Backup'}
              </button>
            </div>

            {/* Restore */}
            <div>
              <h3 className="font-medium mb-2">Restore</h3>
              <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0] mb-3">
                Restore your data from a previous backup. This will merge with existing data.
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleRestore}
                  disabled={isRestoring}
                  className="hidden"
                />
                <span className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-medium transition-colors cursor-pointer inline-block disabled:opacity-50 disabled:cursor-not-allowed">
                  {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                </span>
              </label>
            </div>

            {/* Export Vocabulary */}
            <div>
              <h3 className="font-medium mb-2">Export Vocabulary</h3>
              <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0] mb-3">
                Export your vocabulary as a CSV file for use in other applications.
              </p>
              <button
                onClick={handleExportVocabulary}
                disabled={isBackingUp}
                className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export to CSV
              </button>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Preferences</h2>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Auto-save Transcripts</label>
                <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">
                  Automatically save conversation transcripts
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('autoSaveTranscripts', !settings.autoSaveTranscripts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoSaveTranscripts ? 'bg-[#f59e0b]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoSaveTranscripts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Notifications</label>
                <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">
                  Enable desktop notifications for reminders
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('notificationEnabled', !settings.notificationEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notificationEnabled ? 'bg-[#f59e0b]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xl font-semibold mb-4">About</h2>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6">
            <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0]">
              SoulNotes v{process.env.npm_package_version || '1.0.0'}
            </p>
            <p className="text-sm text-[#8b7355] dark:text-[#a0a0a0] mt-2">
              A language learning companion for conversations and vocabulary practice.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}