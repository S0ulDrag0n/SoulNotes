// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock the platform module at the top level
const mockGetInitialDarkMode = vi.fn(() => false);
vi.mock('@/utils/platform', () => ({
  getInitialDarkMode: () => mockGetInitialDarkMode(),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  THEME: { DARK: 'dark', LIGHT: 'light' },
  COOKIE_SETTINGS: { path: '/', maxAge: 31536000 },
}));

// Import after mocks are set up
import { useTheme, ThemeProvider } from '../useTheme';

// Test component that uses the hook
function TestComponent() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  return (
    <div>
      <span data-testid="theme-status">{isDarkMode ? 'dark' : 'light'}</span>
      <button onClick={toggleDarkMode} data-testid="toggle-button">
        Toggle Theme
      </button>
    </div>
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    // Reset document state
    document.documentElement.classList.remove('dark');
    
    // Clear cookies
    document.cookie = 'theme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // Reset mock to return false (light mode) by default
    mockGetInitialDarkMode.mockReturnValue(false);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  describe('ThemeProvider', () => {
    it('should provide default light theme', () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-status').textContent).toBe('light');
    });

    it('should toggle theme when toggleDarkMode is called', async () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-status').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Toggle to dark
      fireEvent.click(screen.getByTestId('toggle-button'));

      await waitFor(() => {
        expect(screen.getByTestId('theme-status').textContent).toBe('dark');
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Toggle back to light
      fireEvent.click(screen.getByTestId('toggle-button'));

      await waitFor(() => {
        expect(screen.getByTestId('theme-status').textContent).toBe('light');
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should apply dark class to document element when dark mode is enabled', async () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('toggle-button'));

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should remove dark class from document element when dark mode is disabled', async () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Enable dark mode
      fireEvent.click(screen.getByTestId('toggle-button'));
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Disable dark mode
      fireEvent.click(screen.getByTestId('toggle-button'));
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function TestWithoutProvider() {
        useTheme();
        return null;
      }

      expect(() => {
        render(<TestWithoutProvider />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });

    it('should return isDarkMode and toggleDarkMode', () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-status')).toBeDefined();
      expect(screen.getByTestId('toggle-button')).toBeDefined();
    });
  });

  describe('Initial theme detection', () => {
    it('should use light theme when getInitialDarkMode returns false', () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-status').textContent).toBe('light');
    });

    it('should use dark theme when getInitialDarkMode returns true', async () => {
      mockGetInitialDarkMode.mockReturnValue(true);
      
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-status').textContent).toBe('dark');
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });
  });

  describe('Multiple components using the same theme', () => {
    it('should share theme state across components', async () => {
      mockGetInitialDarkMode.mockReturnValue(false);
      
      function DualComponent() {
        return (
          <div>
            <TestComponent />
            <TestComponent />
          </div>
        );
      }

      render(
        <ThemeProvider>
          <DualComponent />
        </ThemeProvider>
      );

      const statusElements = screen.getAllByTestId('theme-status');
      const toggleButtons = screen.getAllByTestId('toggle-button');

      // Both should show light initially
      expect(statusElements[0].textContent).toBe('light');
      expect(statusElements[1].textContent).toBe('light');

      // Click first toggle
      fireEvent.click(toggleButtons[0]);

      // Both should now show dark
      await waitFor(() => {
        expect(statusElements[0].textContent).toBe('dark');
      });
      await waitFor(() => {
        expect(statusElements[1].textContent).toBe('dark');
      });
    });
  });
});