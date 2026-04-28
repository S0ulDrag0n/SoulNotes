// Tests for useTextSelection hook

import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '../useTextSelection';

describe('useTextSelection', () => {
  it('should return null selection initially', () => {
    const { result } = renderHook(() => useTextSelection());
    
    expect(result.current.selection).toBeNull();
    expect(result.current.selectionRef.current).toBeNull();
    expect(typeof result.current.clearSelection).toBe('function');
  });

  it('should clear selection when clearSelection is called', () => {
    const { result } = renderHook(() => useTextSelection());
    
    // Even if we had a selection, clearSelection should reset it
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selection).toBeNull();
  });

  it('should provide a ref for the selection container', () => {
    const { result } = renderHook(() => useTextSelection());
    
    expect(result.current.selectionRef).toBeDefined();
    expect(result.current.selectionRef.current).toBeNull();
  });
});