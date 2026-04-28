/**
 * Tests for conversationStore
 * 
 * Tests the state management for conversation mode including:
 * - Recording state management
 * - Microphone device selection
 * - Session configuration
 */

// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useConversationStoreInternal } from '../conversationStore';

// Get the store's reset function directly (not a hook)
const resetStore = () => {
  useConversationStoreInternal.getState().reset();
};

// Test component that uses the hook
function TestComponent() {
  const { 
    isRecording,
    isProcessing,
    isSpeaking,
    language,
    scenario,
    difficulty,
    selectedMicDevice,
    setRecording,
    setProcessing,
    setSpeaking,
    setLanguage,
    setScenario,
    setDifficulty,
    setMicDevice,
    reset,
  } = useConversationStoreInternal();
  
  return (
    <div>
      <span data-testid="is-recording">{isRecording.toString()}</span>
      <span data-testid="is-processing">{isProcessing.toString()}</span>
      <span data-testid="is-speaking">{isSpeaking.toString()}</span>
      <span data-testid="language">{language}</span>
      <span data-testid="scenario">{scenario}</span>
      <span data-testid="difficulty">{difficulty}</span>
      <span data-testid="selected-mic-device">{selectedMicDevice ?? 'null'}</span>
      <button onClick={() => setRecording(true)} data-testid="set-recording-true">
        Set Recording True
      </button>
      <button onClick={() => setProcessing(true)} data-testid="set-processing-true">
        Set Processing True
      </button>
      <button onClick={() => setSpeaking(true)} data-testid="set-speaking-true">
        Set Speaking True
      </button>
      <button onClick={() => setLanguage('es')} data-testid="set-language-es">
        Set Spanish
      </button>
      <button onClick={() => setScenario('job_interview')} data-testid="set-scenario">
        Set Scenario
      </button>
      <button onClick={() => setDifficulty('advanced')} data-testid="set-difficulty">
        Set Difficulty
      </button>
      <button onClick={() => setMicDevice('device-123')} data-testid="set-mic-device">
        Set Mic Device
      </button>
      <button onClick={reset} data-testid="reset">
        Reset
      </button>
    </div>
  );
}

describe('conversationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    resetStore();
  });

  describe('initial state', () => {
    it('should start with default values', () => {
      render(<TestComponent />);
      
      expect(screen.getByTestId('is-recording').textContent).toBe('false');
      expect(screen.getByTestId('is-processing').textContent).toBe('false');
      expect(screen.getByTestId('is-speaking').textContent).toBe('false');
      expect(screen.getByTestId('language').textContent).toBe('en');
      expect(screen.getByTestId('scenario').textContent).toBe('casual_chat');
      expect(screen.getByTestId('difficulty').textContent).toBe('intermediate');
      expect(screen.getByTestId('selected-mic-device').textContent).toBe('null');
    });
  });

  describe('setRecording', () => {
    it('should update isRecording state', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-recording-true'));
      
      await waitFor(() => {
        expect(screen.getByTestId('is-recording').textContent).toBe('true');
      });
    });
  });

  describe('setMicDevice', () => {
    it('should update selectedMicDevice', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-mic-device'));
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-mic-device').textContent).toBe('device-123');
      });
    });
  });

  describe('setLanguage', () => {
    it('should update language', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-language-es'));
      
      await waitFor(() => {
        expect(screen.getByTestId('language').textContent).toBe('es');
      });
    });
  });

  describe('setScenario', () => {
    it('should update scenario', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-scenario'));
      
      await waitFor(() => {
        expect(screen.getByTestId('scenario').textContent).toBe('job_interview');
      });
    });
  });

  describe('setDifficulty', () => {
    it('should update difficulty', async () => {
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('set-difficulty'));
      
      await waitFor(() => {
        expect(screen.getByTestId('difficulty').textContent).toBe('advanced');
      });
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      render(<TestComponent />);
      
      // Set various states
      fireEvent.click(screen.getByTestId('set-recording-true'));
      fireEvent.click(screen.getByTestId('set-processing-true'));
      fireEvent.click(screen.getByTestId('set-speaking-true'));
      fireEvent.click(screen.getByTestId('set-language-es'));
      fireEvent.click(screen.getByTestId('set-scenario'));
      fireEvent.click(screen.getByTestId('set-difficulty'));
      fireEvent.click(screen.getByTestId('set-mic-device'));
      
      // Wait for changes
      await waitFor(() => {
        expect(screen.getByTestId('is-recording').textContent).toBe('true');
        expect(screen.getByTestId('is-processing').textContent).toBe('true');
        expect(screen.getByTestId('is-speaking').textContent).toBe('true');
        expect(screen.getByTestId('language').textContent).toBe('es');
        expect(screen.getByTestId('scenario').textContent).toBe('job_interview');
        expect(screen.getByTestId('difficulty').textContent).toBe('advanced');
        expect(screen.getByTestId('selected-mic-device').textContent).toBe('device-123');
      });
      
      // Reset
      fireEvent.click(screen.getByTestId('reset'));
      
      // Verify all states are reset
      await waitFor(() => {
        expect(screen.getByTestId('is-recording').textContent).toBe('false');
        expect(screen.getByTestId('is-processing').textContent).toBe('false');
        expect(screen.getByTestId('is-speaking').textContent).toBe('false');
        expect(screen.getByTestId('language').textContent).toBe('en');
        expect(screen.getByTestId('scenario').textContent).toBe('casual_chat');
        expect(screen.getByTestId('difficulty').textContent).toBe('intermediate');
        expect(screen.getByTestId('selected-mic-device').textContent).toBe('null');
      });
    });
  });
});