// Hook for detecting text selection within a container and extracting context

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TextSelection {
  selectedText: string;
  context: string;
  position: { x: number; y: number };
}

export interface UseTextSelectionReturn {
  selection: TextSelection | null;
  selectionRef: React.RefObject<HTMLDivElement | null>;
  clearSelection: () => void;
}

const CONTEXT_WORDS_COUNT = 5; // Number of words to extract before and after selection

/**
 * Extracts surrounding context from text based on selection
 */
function extractContext(
  fullText: string,
  selectedText: string,
  selectionStart: number
): string {
  // Find words before the selection
  const beforeText = fullText.slice(0, selectionStart);
  const beforeWords = beforeText.trim().split(/\s+/).filter(Boolean);
  const contextBefore = beforeWords.slice(-CONTEXT_WORDS_COUNT).join(' ');

  // Find words after the selection
  const afterText = fullText.slice(selectionStart + selectedText.length);
  const afterWords = afterText.trim().split(/\s+/).filter(Boolean);
  const contextAfter = afterWords.slice(0, CONTEXT_WORDS_COUNT).join(' ');

  // Build context string
  const parts: string[] = [];
  if (contextBefore) parts.push(contextBefore);
  parts.push(selectedText);
  if (contextAfter) parts.push(contextAfter);

  return parts.join(' ');
}

/**
 * Hook for detecting text selection within a container element
 * Returns the selected text, surrounding context, and position for toolbar placement
 */
export function useTextSelection(): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);

  const clearSelection = useCallback(() => {
    // Clear the browser's text selection as well
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    setSelection(null);
  }, []);

  const handleSelectionChange = useCallback(() => {
    // Only process selection on mouseup (not during typing or other events)
    if (!isMouseDownRef.current) {
      const selectionObj = window.getSelection();
      
      if (!selectionObj || selectionObj.isCollapsed || !selectionRef.current) {
        return;
      }

      const selectedText = selectionObj.toString().trim();
      
      if (!selectedText) {
        return;
      }

      // Check if selection is within our container
      const range = selectionObj.getRangeAt(0);
      const containerElement = selectionRef.current;
      
      if (!containerElement.contains(range.commonAncestorContainer)) {
        return;
      }

      // Get the full text content of the container
      const fullText = containerElement.textContent || '';

      // Find the selection start position in the full text
      // This is approximate - we find where the selected text appears
      let selectionStart = fullText.indexOf(selectedText);
      
      // If the selected text appears multiple times, try to find the exact position
      if (selectionStart === -1) {
        // Fallback: use the range to get position
        const preSelectionRange = document.createRange();
        preSelectionRange.selectNodeContents(containerElement);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        selectionStart = preSelectionRange.toString().length;
      }

      // Extract context
      const context = extractContext(fullText, selectedText, selectionStart);

      // Get position for toolbar
      const rect = range.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top,
      };

      setSelection({
        selectedText,
        context,
        position,
      });
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
    // Clear previous selection when starting a new one
    setSelection(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    // Small delay to ensure selection is complete
    setTimeout(() => {
      handleSelectionChange();
    }, 10);
  }, [handleSelectionChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Clear selection on Escape
    if (e.key === 'Escape') {
      clearSelection();
    }
  }, [clearSelection]);

  useEffect(() => {
    const container = selectionRef.current;
    if (!container) return;

    // Add event listeners
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseDown, handleMouseUp, handleKeyDown]);

  return {
    selection,
    selectionRef,
    clearSelection,
  };
}