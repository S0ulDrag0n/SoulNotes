import { describe, it, expect } from 'vitest';
import { assertModelAvailable, ModelNotFoundError } from '../llm-client';

describe('assertModelAvailable', () => {
  it('passes for an exact match', () => {
    expect(() => assertModelAvailable('deepseek-v4.1-flash:cloud', new Set(['deepseek-v4.1-flash:cloud', 'llava:latest']))).not.toThrow();
  });

  it('passes for an owner-prefixed listing of a bare config pin', () => {
    expect(() => assertModelAvailable('qwen3.8:q4', new Set(['unsloth/qwen3.8:q4']))).not.toThrow();
  });

  it('throws ModelNotFoundError with pull guidance when missing', () => {
    try {
      assertModelAvailable('phi4:latest', new Set(['aya-expanse:latest', 'glm-5.3:cloud']));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ModelNotFoundError);
      const err = e as ModelNotFoundError;
      expect(err.statusCode).toBe(503);
      expect(err.message).toContain('phi4:latest');
      expect(err.message).toContain('ollama pull phi4:latest');
      expect(err.message).toContain('aya-expanse:latest');
    }
  });
});
