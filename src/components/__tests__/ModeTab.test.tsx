// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModeTab } from '../ModeTab';

describe('ModeTab', () => {
  it('should render with label and icon', () => {
    render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('🎤')).toBeDefined();
    expect(screen.getByText('Transcribe')).toBeDefined();
  });

  it('should show active state correctly', () => {
    const { container } = render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={true}
        onClick={() => {}}
      />
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-[#1f1c16]');
  });

  it('should show inactive state correctly', () => {
    const { container } = render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={false}
        onClick={() => {}}
      />
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('text-[#5c4d39]');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={false}
        onClick={handleClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should show label as title', () => {
    render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={false}
        onClick={() => {}}
      />
    );

    const button = screen.getByRole('button');
    expect(button?.getAttribute('title')).toBe('Transcribe');
  });

  it('should apply hover styles for inactive tabs', () => {
    const { container } = render(
      <ModeTab
        label="Transcribe"
        icon="🎤"
        isActive={false}
        onClick={() => {}}
      />
    );

    const button = container.querySelector('button');
    expect(button?.className).toContain('hover:bg-[#efe0c3]');
  });
});