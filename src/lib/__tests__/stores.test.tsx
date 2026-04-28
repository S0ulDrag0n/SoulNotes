// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock constants module
vi.mock('../../lib/constants', () => ({
  DEFAULT_LANGUAGE_SETTINGS: {
    realtime: 'en',
    chineseVariant: 'simplified',
    target: 'es',
  },
  DEFAULT_REALTIME_CONFIG: {
    baseUrl: 'http://localhost:8000',
    transcribeModel: 'whisper',
    defaultLanguage: 'en',
  },
}));

// Import after mocks are set up
import { useAppStoreInternal } from '../../stores/appStore';

// Get the store's reset function directly (not a hook)
const resetStore = () => {
  useAppStoreInternal.getState().resetToDefaults();
};

// Test component that uses the hook
function TestComponent() {
  const { 
    sourceLanguage, 
    targetLanguage, 
    chineseVariant,
    activePanel,
    realtimeConfig,
    setSourceLanguage, 
    setTargetLanguage, 
    setActivePanel,
    updateRealtimeConfig,
    resetToDefaults 
  } = useAppStoreInternal();
  
  return (
    <div>
      <span data-testid="source-language">{sourceLanguage}</span>
      <span data-testid="target-language">{targetLanguage}</span>
      <span data-testid="chinese-variant">{chineseVariant}</span>
      <span data-testid="active-panel">{activePanel}</span>
      <span data-testid="base-url">{realtimeConfig.baseUrl}</span>
      <button onClick={() => setSourceLanguage('fr')} data-testid="set-french">
        Set French
      </button>
      <button onClick={() => setSourceLanguage('zh', 'traditional')} data-testid="set-chinese">
        Set Chinese
      </button>
      <button onClick={() => setTargetLanguage('de')} data-testid="set-german">
        Set German
      </button>
      <button onClick={() => setActivePanel('summary')} data-testid="set-summary">
        Set Summary
      </button>
      <button onClick={() => updateRealtimeConfig({ baseUrl: 'https://custom.api' })} data-testid="update-config">
        Update Config
      </button>
      <button onClick={resetToDefaults} data-testid="reset">
        Reset
      </button>
    </div>
  );
}

describe('useAppState', () => {
  beforeEach(() => {
    // Reset store state before each test using getState (not a hook)
    resetStore();
  });

  describe('Language Settings', () => {
    it('should start with default language settings', () => {
      render(<TestComponent />);
      
      expect(screen.getByTestId('source-language').textContent).toBe('en');
      expect(screen.getByTestId('target-language').textContent).toBe('es');
    });

    it('should set source language', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-french'));
      
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('fr');
      });
    });

    it('should set source language with Chinese variant', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-chinese'));
      
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('zh');
        expect(screen.getByTestId('chinese-variant').textContent).toBe('traditional');
      });
    });

    it('should set target language', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-german'));
      
      await waitFor(() => {
        expect(screen.getByTestId('target-language').textContent).toBe('de');
      });
    });

    it('should NOT persist language settings across sessions', async () => {
      render(<TestComponent />);
      
      // Change language
      fireEvent.click(screen.getByTestId('set-french'));
      
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('fr');
      });
      
      // Simulate new session (reset)
      fireEvent.click(screen.getByTestId('reset'));
      
      // Should be back to defaults, not persisted
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('en');
      });
    });
  });

  describe('UI State', () => {
    it('should start with translation panel active', () => {
      render(<TestComponent />);
      
      expect(screen.getByTestId('active-panel').textContent).toBe('translation');
    });

    it('should set active panel', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-summary'));
      
      await waitFor(() => {
        expect(screen.getByTestId('active-panel').textContent).toBe('summary');
      });
    });
  });

  describe('Config', () => {
    it('should have default realtime config', () => {
      render(<TestComponent />);
      
      expect(screen.getByTestId('base-url').textContent).toBe('http://localhost:8000');
    });

    it('should update realtime config', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('update-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('base-url').textContent).toBe('https://custom.api');
      });
    });
  });

  describe('Reset', () => {
    it('should reset all state to defaults', async () => {
      render(<TestComponent />);
      
      // Change all values
      fireEvent.click(screen.getByTestId('set-french'));
      fireEvent.click(screen.getByTestId('set-german'));
      fireEvent.click(screen.getByTestId('set-summary'));
      
      // Wait for changes
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('fr');
      });
      
      // Reset
      fireEvent.click(screen.getByTestId('reset'));
      
      await waitFor(() => {
        expect(screen.getByTestId('source-language').textContent).toBe('en');
        expect(screen.getByTestId('target-language').textContent).toBe('es');
        expect(screen.getByTestId('active-panel').textContent).toBe('translation');
      });
    });
  });
});