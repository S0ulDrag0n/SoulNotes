/**
 * Tauri Config Repository - Desktop implementation using Tauri invoke
 * 
 * Provides persistent configuration storage for desktop builds.
 */
import { invoke } from '@tauri-apps/api/core';
import { ConfigRepository, AppConfig, DEFAULT_CONFIG } from '@/types';

export class TauriConfigRepository implements ConfigRepository {
  async get(): Promise<AppConfig> {
    try {
      const config = await invoke<Partial<AppConfig>>('get_config');
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      console.error('Failed to get config from Tauri:', error);
      return DEFAULT_CONFIG;
    }
  }

  async save(config: Partial<AppConfig>): Promise<void> {
    try {
      await invoke('save_config', { config });
    } catch (error) {
      console.error('Failed to save config via Tauri:', error);
    }
  }

  getDefaults(): AppConfig {
    return DEFAULT_CONFIG;
  }
}