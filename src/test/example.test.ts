// Using vitest globals (configured in vitest.config.ts with globals: true)
// No need to import test, expect, describe, etc.

describe('Example Test Suite', () => {
  test('basic math works', () => {
    expect(1 + 1).toBe(2)
  })

  test('string concatenation', () => {
    expect('hello' + ' ' + 'world').toBe('hello world')
  })
})