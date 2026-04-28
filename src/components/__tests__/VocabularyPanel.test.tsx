// Vitest globals are available - no explicit imports needed
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VocabularyPanel } from '../VocabularyPanel';
import type { VocabularyItem } from '@/types/vocabulary';

describe('VocabularyPanel', () => {
  const mockDeck = {
    id: 'deck-1',
    name: 'Japanese Vocabulary',
    language: 'ja',
  };

  const mockItems: VocabularyItem[] = [
    {
      id: 'item-1',
      deckId: 'deck-1',
      word: 'こんにちは',
      language: 'ja',
      translation: 'Hello',
      context: 'A greeting',
      source: 'manual',
      createdAt: new Date(),
      tags: [],
    },
    {
      id: 'item-2',
      deckId: 'deck-1',
      word: 'さようなら',
      language: 'ja',
      translation: 'Goodbye',
      context: '',
      source: 'manual',
      createdAt: new Date(),
      tags: [],
    },
  ];

  const mockOnAddItem = vi.fn();
  const mockOnDeleteItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAddItem.mockResolvedValue({
      id: 'new-item',
      deckId: 'deck-1',
      word: 'new word',
      language: 'ja',
      translation: 'new translation',
      context: '',
      source: 'manual',
      createdAt: new Date(),
      tags: [],
    });
    mockOnDeleteItem.mockResolvedValue(undefined);
  });

  describe('when no deck is selected', () => {
    it('should show "No Deck Selected" message', () => {
      render(
        <VocabularyPanel
          deck={null}
          items={[]}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('No Deck Selected')).toBeDefined();
      expect(screen.getByText(/Create a vocabulary deck/)).toBeDefined();
    });

    it('should show book emoji', () => {
      render(
        <VocabularyPanel
          deck={null}
          items={[]}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('📚')).toBeDefined();
    });
  });

  describe('when deck is selected', () => {
    it('should show deck name', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('Japanese Vocabulary')).toBeDefined();
    });

    it('should show word count and language', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('2 words • ja')).toBeDefined();
    });

    it('should show Add Word button', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('+ Add Word')).toBeDefined();
    });
  });

  describe('word list', () => {
    it('should show all words', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('こんにちは')).toBeDefined();
      expect(screen.getByText('さようなら')).toBeDefined();
    });

    it('should show translations', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('Hello')).toBeDefined();
      expect(screen.getByText('Goodbye')).toBeDefined();
    });

    it('should show context when available', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText('A greeting')).toBeDefined();
    });

    it('should show empty state when no items', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={[]}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      expect(screen.getByText(/No words yet/)).toBeDefined();
    });

    it('should call onDeleteItem when delete button is clicked', async () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      const deleteButtons = screen.getAllByTitle('Delete word');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockOnDeleteItem).toHaveBeenCalledWith('item-1');
      });
    });
  });

  describe('add word form', () => {
    it('should show form when Add Word is clicked', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      fireEvent.click(screen.getByText('+ Add Word'));

      expect(screen.getByText('Add New Word')).toBeDefined();
      expect(screen.getByPlaceholderText('Enter the word')).toBeDefined();
      expect(screen.getByPlaceholderText('Enter the translation')).toBeDefined();
      expect(screen.getByPlaceholderText('Example sentence or context')).toBeDefined();
    });

    it('should hide form when Cancel is clicked', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      fireEvent.click(screen.getByText('+ Add Word'));
      expect(screen.getByText('Add New Word')).toBeDefined();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Add New Word')).toBeNull();
    });

    it('should call onAddItem when form is submitted', async () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      fireEvent.click(screen.getByText('+ Add Word'));

      const wordInput = screen.getByPlaceholderText('Enter the word');
      const translationInput = screen.getByPlaceholderText('Enter the translation');
      const contextInput = screen.getByPlaceholderText('Example sentence or context');

      fireEvent.change(wordInput, { target: { value: 'ありがとう' } });
      fireEvent.change(translationInput, { target: { value: 'Thank you' } });
      fireEvent.change(contextInput, { target: { value: 'Expression of gratitude' } });

      fireEvent.click(screen.getByText('Add Word'));

      await waitFor(() => {
        expect(mockOnAddItem).toHaveBeenCalledWith(
          'ありがとう',
          'Thank you',
          'Expression of gratitude',
          'manual'
        );
      });
    });

    it('should disable Add Word button when inputs are empty', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      fireEvent.click(screen.getByText('+ Add Word'));

      const addButton = screen.getByText('Add Word').closest('button');
      expect(addButton).toBeDisabled();
    });

    it('should enable Add Word button when both word and translation are filled', () => {
      render(
        <VocabularyPanel
          deck={mockDeck}
          items={mockItems}
          onAddItem={mockOnAddItem}
          onDeleteItem={mockOnDeleteItem}
        />
      );

      fireEvent.click(screen.getByText('+ Add Word'));

      const wordInput = screen.getByPlaceholderText('Enter the word');
      const translationInput = screen.getByPlaceholderText('Enter the translation');

      fireEvent.change(wordInput, { target: { value: 'test' } });
      fireEvent.change(translationInput, { target: { value: 'translation' } });

      const addButton = screen.getByText('Add Word').closest('button');
      expect(addButton).not.toBeDisabled();
    });
  });
});