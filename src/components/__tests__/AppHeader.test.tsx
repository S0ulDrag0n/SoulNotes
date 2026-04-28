// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppHeader } from '../AppHeader';

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/');
  });

  it('should render the logo', () => {
    render(<AppHeader />);
    expect(screen.getByText('SoulNotes')).toBeDefined();
  });

  it('should render all mode tabs', () => {
    render(<AppHeader />);
    
    expect(screen.getByText('🎤')).toBeDefined();
    expect(screen.getByText('💬')).toBeDefined();
    expect(screen.getByText('📚')).toBeDefined();
    expect(screen.getByText('📊')).toBeDefined();
  });

  it('should show Transcribe tab as active on home page', () => {
    mockPathname.mockReturnValue('/');
    render(<AppHeader />);
    
    const transcribeTab = screen.getByText('Transcribe').closest('button');
    expect(transcribeTab?.className).toContain('bg-[#1f1c16]');
  });

  it('should show Flashcards tab as active on flashcards page', () => {
    mockPathname.mockReturnValue('/flashcards');
    render(<AppHeader />);
    
    const flashcardsTab = screen.getByText('Flashcards').closest('button');
    expect(flashcardsTab?.className).toContain('bg-[#1f1c16]');
  });

  it('should navigate to conversation page when clicking Conversation tab', () => {
    render(<AppHeader />);
    
    fireEvent.click(screen.getByText('Conversation'));
    
    expect(mockPush).toHaveBeenCalledWith('/conversation');
  });

  it('should navigate to flashcards page when clicking Flashcards tab', () => {
    render(<AppHeader />);
    
    fireEvent.click(screen.getByText('Flashcards'));
    
    expect(mockPush).toHaveBeenCalledWith('/flashcards');
  });

  it('should navigate to dashboard page when clicking Dashboard tab', () => {
    render(<AppHeader />);
    
    fireEvent.click(screen.getByText('Dashboard'));
    
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('should navigate to home page when clicking Transcribe tab', () => {
    render(<AppHeader />);
    
    fireEvent.click(screen.getByText('Transcribe'));
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});