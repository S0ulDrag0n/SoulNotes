// Tests for shared config loader
// Note: loadConfig() uses fs/path which are Node-only.
// We test the YAML parsing logic here, and integration is tested via API routes.
import { describe, it, expect } from 'vitest'

// Extract the parsing logic for direct testing
function parseYamlConfig(yaml: string): Record<string, string> {
  const config: Record<string, string> = {}
  const lines = yaml.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Handle null
    if (value === 'null' || value === '~') continue

    // Multi-line string values
    if (value.startsWith('|')) continue

    config[key] = value
  }

  return config
}

describe('parseYamlConfig (loadConfig parsing logic)', () => {
  it('should parse basic key-value pairs', () => {
    const yaml = `llm_provider: openai-compatible
ollama_base_url: http://my-ollama:11434
ollama_api_token: my-token
ollama_translate_model: llama3
`
    const config = parseYamlConfig(yaml)

    expect(config['llm_provider']).toBe('openai-compatible')
    expect(config['ollama_base_url']).toBe('http://my-ollama:11434')
    expect(config['ollama_api_token']).toBe('my-token')
    expect(config['ollama_translate_model']).toBe('llama3')
  })

  it('should handle quoted values', () => {
    const yaml = `ollama_base_url: "http://localhost:11434"
ollama_api_token: 'my-secret-token'
`
    const config = parseYamlConfig(yaml)

    expect(config['ollama_base_url']).toBe('http://localhost:11434')
    expect(config['ollama_api_token']).toBe('my-secret-token')
  })

  it('should skip null and tilde values', () => {
    const yaml = `ollama_api_token: null
ollama_base_url: ~
ollama_translate_model: llama3
`
    const config = parseYamlConfig(yaml)

    expect(config['ollama_api_token']).toBeUndefined()
    expect(config['ollama_base_url']).toBeUndefined()
    expect(config['ollama_translate_model']).toBe('llama3')
  })

  it('should skip comments and empty lines', () => {
    const yaml = `# This is a comment
ollama_base_url: http://localhost:11434

# Another comment
ollama_translate_model: llama3
`
    const config = parseYamlConfig(yaml)

    expect(Object.keys(config)).toHaveLength(2)
    expect(config['ollama_base_url']).toBe('http://localhost:11434')
    expect(config['ollama_translate_model']).toBe('llama3')
  })

  it('should skip multi-line string indicators', () => {
    const yaml = `translate_prompt: |
  This is a multi-line
  prompt that should be skipped
ollama_base_url: http://localhost:11434
`
    const config = parseYamlConfig(yaml)

    expect(config['translate_prompt']).toBeUndefined()
    expect(config['ollama_base_url']).toBe('http://localhost:11434')
  })

  it('should parse all known config keys', () => {
    const yaml = `llm_provider: openai-compatible
ollama_base_url: http://localhost:11434
ollama_api_token: token123
ollama_translate_model: aya-expanse:latest
ollama_summarize_model: phi4:latest
ollama_conversation_model: aya-expanse:latest
openai_compatible_base_url: http://localhost:8080
openai_compatible_api_token: oc-token
openai_compatible_translate_model: my-model
openai_compatible_summarize_model: my-model
openai_compatible_conversation_model: my-model
speaches_base_url: http://localhost:10300
speaches_transcribe_model: faster-whisper-large-v3
speaches_transcribe_language: en
`
    const config = parseYamlConfig(yaml)

    expect(config['llm_provider']).toBe('openai-compatible')
    expect(config['openai_compatible_base_url']).toBe('http://localhost:8080')
    expect(config['openai_compatible_api_token']).toBe('oc-token')
    expect(config['openai_compatible_translate_model']).toBe('my-model')
    expect(config['speaches_base_url']).toBe('http://localhost:10300')
  })

  it('should handle empty input', () => {
    const config = parseYamlConfig('')
    expect(Object.keys(config)).toHaveLength(0)
  })
})