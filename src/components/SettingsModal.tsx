// Settings modal for desktop mode configuration

'use client';

import { useState, useEffect } from 'react';
import { isDesktopMode } from '@/utils/platform';
import {
  DEFAULT_OLLAMA_CONFIG,
  DEFAULT_OPENAI_COMPATIBLE_CONFIG,
  DEFAULT_REALTIME_CONFIG,
  LLM_PROVIDERS,
} from '@/lib/constants';
import type { LLMProviderKey } from '@/lib/constants';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

interface Settings {
  llm_provider: LLMProviderKey;
  ollama_base_url: string;
  ollama_api_token: string;
  ollama_conversation_model: string;
  ollama_translate_model: string;
  ollama_summarize_model: string;
  openai_compatible_base_url: string;
  openai_compatible_api_token: string;
  openai_compatible_conversation_model: string;
  openai_compatible_translate_model: string;
  openai_compatible_summarize_model: string;
  speaches_base_url: string;
  speaches_transcribe_model: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  llm_provider: 'ollama',
  ollama_base_url: DEFAULT_OLLAMA_CONFIG.baseUrl,
  ollama_api_token: '',
  ollama_conversation_model: DEFAULT_OLLAMA_CONFIG.conversationModel,
  ollama_translate_model: DEFAULT_OLLAMA_CONFIG.translateModel,
  ollama_summarize_model: DEFAULT_OLLAMA_CONFIG.summarizeModel,
  openai_compatible_base_url: DEFAULT_OPENAI_COMPATIBLE_CONFIG.baseUrl,
  openai_compatible_api_token: '',
  openai_compatible_conversation_model: '',
  openai_compatible_translate_model: '',
  openai_compatible_summarize_model: '',
  speaches_base_url: DEFAULT_REALTIME_CONFIG.baseUrl,
  speaches_transcribe_model: DEFAULT_REALTIME_CONFIG.transcribeModel,
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showOllamaToken, setShowOllamaToken] = useState(false);
  const [showOpenAIToken, setShowOpenAIToken] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<ModelInfo[]>([]);
  const [openaiModels, setOpenaiModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (isOpen && isDesktopMode()) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const config = await invoke<{
        llm_provider?: LLMProviderKey;
        ollama_base_url?: string;
        ollama_api_token?: string;
        ollama_conversation_model?: string;
        ollama_translate_model?: string;
        ollama_summarize_model?: string;
        openai_compatible_base_url?: string;
        openai_compatible_api_token?: string;
        openai_compatible_conversation_model?: string;
        openai_compatible_translate_model?: string;
        openai_compatible_summarize_model?: string;
        speaches_base_url?: string;
        speaches_transcribe_model?: string;
      }>('get_config');
      setSettings({
        llm_provider: config.llm_provider || DEFAULT_SETTINGS.llm_provider,
        ollama_base_url: config.ollama_base_url || DEFAULT_SETTINGS.ollama_base_url,
        ollama_api_token: config.ollama_api_token || '',
        ollama_conversation_model: config.ollama_conversation_model || DEFAULT_SETTINGS.ollama_conversation_model,
        ollama_translate_model: config.ollama_translate_model || DEFAULT_SETTINGS.ollama_translate_model,
        ollama_summarize_model: config.ollama_summarize_model || DEFAULT_SETTINGS.ollama_summarize_model,
        openai_compatible_base_url: config.openai_compatible_base_url || DEFAULT_SETTINGS.openai_compatible_base_url,
        openai_compatible_api_token: config.openai_compatible_api_token || '',
        openai_compatible_conversation_model: config.openai_compatible_conversation_model || '',
        openai_compatible_translate_model: config.openai_compatible_translate_model || '',
        openai_compatible_summarize_model: config.openai_compatible_summarize_model || '',
        speaches_base_url: config.speaches_base_url || DEFAULT_SETTINGS.speaches_base_url,
        speaches_transcribe_model: config.speaches_transcribe_model || DEFAULT_SETTINGS.speaches_transcribe_model,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    if (!isDesktopMode()) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_config', { config: settings });
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleFetchOllamaModels = async () => {
    if (!isDesktopMode()) return;
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const models = await invoke<ModelInfo[]>('fetch_ollama_models', {
        baseUrl: settings.ollama_base_url,
        apiToken: settings.ollama_api_token || null,
      });
      setOllamaModels(models);
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : 'Failed to fetch Ollama models');
      setOllamaModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleFetchOpenAIModels = async () => {
    if (!isDesktopMode()) return;
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const models = await invoke<ModelInfo[]>('fetch_openai_compatible_models', {
        baseUrl: settings.openai_compatible_base_url,
        apiToken: settings.openai_compatible_api_token || null,
      });
      setOpenaiModels(models);
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : 'Failed to fetch OpenAI-compatible models');
      setOpenaiModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  if (!isOpen) return null;

  const activeProvider = settings.llm_provider;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 
            id="settings-modal-title"
            className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]"
          >
            Desktop Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b5a3f] hover:bg-[#f0e6d6] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* LLM Provider Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              LLM Provider
            </h3>
            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Active Provider</span>
              <select
                value={settings.llm_provider}
                onChange={(e) => handleChange('llm_provider', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
              >
                {Object.entries(LLM_PROVIDERS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Ollama Settings */}
          <div className={`space-y-3 ${activeProvider !== 'ollama' ? 'opacity-50' : ''}`}>
            <h3 className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              Ollama Settings {activeProvider !== 'ollama' && <span className="text-xs text-[#9c8a6f]">(inactive)</span>}
            </h3>
            
            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Base URL</span>
              <input
                type="text"
                value={settings.ollama_base_url}
                onChange={(e) => handleChange('ollama_base_url', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                placeholder="http://localhost:11434"
                disabled={activeProvider !== 'ollama'}
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">
                API Token
                <span className="ml-1 text-[#9c8a6f]">(optional)</span>
              </span>
              <div className="relative mt-1">
                <input
                  type={showOllamaToken ? 'text' : 'password'}
                  value={settings.ollama_api_token}
                  onChange={(e) => handleChange('ollama_api_token', e.target.value)}
                  className="w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 pr-10 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="Leave empty for unauthenticated access"
                  disabled={activeProvider !== 'ollama'}
                />
                <button
                  type="button"
                  onClick={() => setShowOllamaToken(!showOllamaToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6b5a3f] hover:text-[#5c4d39] dark:text-[#c8b7a0]"
                  aria-label={showOllamaToken ? 'Hide token' : 'Show token'}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {showOllamaToken ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </label>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleFetchOllamaModels}
                disabled={activeProvider !== 'ollama' || isLoadingModels}
                className="rounded-lg bg-[#f3b34b] px-3 py-1.5 text-xs font-medium text-[#2a241b] hover:bg-[#e5a43c] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#f3b34b] dark:hover:bg-[#e5a43c]"
              >
                {isLoadingModels && ollamaModels.length === 0 ? 'Loading...' : 'Fetch Models'}
              </button>
              {modelsError && activeProvider === 'ollama' && (
                <span className="text-xs text-red-500">{modelsError}</span>
              )}
              {ollamaModels.length > 0 && activeProvider === 'ollama' && (
                <span className="text-xs text-[#6b5a3f]">{ollamaModels.length} models found</span>
              )}
            </div>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Conversation Model</span>
              {ollamaModels.length > 0 ? (
                <select
                  value={settings.ollama_conversation_model}
                  onChange={(e) => handleChange('ollama_conversation_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'ollama'}
                >
                  <option value="">-- Select model --</option>
                  {ollamaModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ollama_conversation_model}
                  onChange={(e) => handleChange('ollama_conversation_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="aya-expanse:latest"
                  disabled={activeProvider !== 'ollama'}
                />
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Translation Model</span>
              {ollamaModels.length > 0 ? (
                <select
                  value={settings.ollama_translate_model}
                  onChange={(e) => handleChange('ollama_translate_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'ollama'}
                >
                  <option value="">-- Select model --</option>
                  {ollamaModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ollama_translate_model}
                  onChange={(e) => handleChange('ollama_translate_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="aya-expanse:latest"
                  disabled={activeProvider !== 'ollama'}
                />
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Summarization Model</span>
              {ollamaModels.length > 0 ? (
                <select
                  value={settings.ollama_summarize_model}
                  onChange={(e) => handleChange('ollama_summarize_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'ollama'}
                >
                  <option value="">-- Select model --</option>
                  {ollamaModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ollama_summarize_model}
                  onChange={(e) => handleChange('ollama_summarize_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="phi4:latest"
                  disabled={activeProvider !== 'ollama'}
                />
              )}
            </label>
          </div>

          {/* OpenAI-Compatible Settings */}
          <div className={`space-y-3 ${activeProvider !== 'openai-compatible' ? 'opacity-50' : ''}`}>
            <h3 className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              OpenAI Compatible Settings {activeProvider !== 'openai-compatible' && <span className="text-xs text-[#9c8a6f]">(inactive)</span>}
            </h3>
            <p className="text-xs text-[#9c8a6f]">
              Compatible with llama.cpp, LM Studio, vLLM, text-generation-webui, and any server implementing the OpenAI chat completions API.
            </p>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Base URL</span>
              <input
                type="text"
                value={settings.openai_compatible_base_url}
                onChange={(e) => handleChange('openai_compatible_base_url', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                placeholder="http://localhost:8080"
                disabled={activeProvider !== 'openai-compatible'}
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">
                API Token
                <span className="ml-1 text-[#9c8a6f]">(optional)</span>
              </span>
              <div className="relative mt-1">
                <input
                  type={showOpenAIToken ? 'text' : 'password'}
                  value={settings.openai_compatible_api_token}
                  onChange={(e) => handleChange('openai_compatible_api_token', e.target.value)}
                  className="w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 pr-10 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="Leave empty for unauthenticated access"
                  disabled={activeProvider !== 'openai-compatible'}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIToken(!showOpenAIToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6b5a3f] hover:text-[#5c4d39] dark:text-[#c8b7a0]"
                  aria-label={showOpenAIToken ? 'Hide token' : 'Show token'}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {showOpenAIToken ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </label>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleFetchOpenAIModels}
                disabled={activeProvider !== 'openai-compatible' || isLoadingModels}
                className="rounded-lg bg-[#f3b34b] px-3 py-1.5 text-xs font-medium text-[#2a241b] hover:bg-[#e5a43c] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#f3b34b] dark:hover:bg-[#e5a43c]"
              >
                {isLoadingModels && openaiModels.length === 0 ? 'Loading...' : 'Fetch Models'}
              </button>
              {modelsError && activeProvider === 'openai-compatible' && (
                <span className="text-xs text-red-500">{modelsError}</span>
              )}
              {openaiModels.length > 0 && activeProvider === 'openai-compatible' && (
                <span className="text-xs text-[#6b5a3f]">{openaiModels.length} models found</span>
              )}
            </div>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Conversation Model</span>
              {openaiModels.length > 0 ? (
                <select
                  value={settings.openai_compatible_conversation_model}
                  onChange={(e) => handleChange('openai_compatible_conversation_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'openai-compatible'}
                >
                  <option value="">-- Select model --</option>
                  {openaiModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.openai_compatible_conversation_model}
                  onChange={(e) => handleChange('openai_compatible_conversation_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="model-name"
                  disabled={activeProvider !== 'openai-compatible'}
                />
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Translation Model</span>
              {openaiModels.length > 0 ? (
                <select
                  value={settings.openai_compatible_translate_model}
                  onChange={(e) => handleChange('openai_compatible_translate_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'openai-compatible'}
                >
                  <option value="">-- Select model --</option>
                  {openaiModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.openai_compatible_translate_model}
                  onChange={(e) => handleChange('openai_compatible_translate_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="model-name"
                  disabled={activeProvider !== 'openai-compatible'}
                />
              )}
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Summarization Model</span>
              {openaiModels.length > 0 ? (
                <select
                  value={settings.openai_compatible_summarize_model}
                  onChange={(e) => handleChange('openai_compatible_summarize_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  disabled={activeProvider !== 'openai-compatible'}
                >
                  <option value="">-- Select model --</option>
                  {openaiModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.openai_compatible_summarize_model}
                  onChange={(e) => handleChange('openai_compatible_summarize_model', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                  placeholder="model-name"
                  disabled={activeProvider !== 'openai-compatible'}
                />
              )}
            </label>
          </div>

          {/* Speaches Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              Speaches (Transcription) Settings
            </h3>
            
            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Base URL</span>
              <input
                type="text"
                value={settings.speaches_base_url}
                onChange={(e) => handleChange('speaches_base_url', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                placeholder="http://localhost:10300"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#6b5a3f] dark:text-[#c8b7a0]">Transcribe Model</span>
              <input
                type="text"
                value={settings.speaches_transcribe_model}
                onChange={(e) => handleChange('speaches_transcribe_model', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
                placeholder="Systran/faster-whisper-large-v3"
              />
            </label>
          </div>
        </div>

        {/* Save message */}
        {saveMessage && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            saveMessage.type === 'success' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#6b5a3f] hover:bg-[#f0e6d6] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}