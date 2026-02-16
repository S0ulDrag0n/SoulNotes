/**
 * Local Config Repository - Web implementation using localStorage
 * 
 * Provides persistent configuration storage for web builds.
 */
import { ConfigRepository, AppConfig, DEFAULT_CONFIG } from '@/types';

export class LocalConfigRepository implements ConfigRepository {
  private storageKey = 'soulnotes_config';

  async get(): Promise<AppConfig> {
    if (typeof window === 'undefined') {
      return DEFAULT_CONFIG;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return DEFAULT_CONFIG;
      }

      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  async save(config: Partial<AppConfig>): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const current = await this.get();
      const updated = { ...current, ...config };
      localStorage.setItem(this.storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  getDefaults(): AppConfig {
    return DEFAULT_CONFIG;
  }
}