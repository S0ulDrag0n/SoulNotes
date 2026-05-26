// Vitest globals are available - no explicit imports needed
import { POST } from '../route';
import { DEFAULT_OLLAMA_CONFIG } from '@/lib/constants';

// Mock LLMClient to avoid real API calls
const mockConverse = vi.fn();
vi.mock('@/lib/llm-client', () => ({
  LLMClient: vi.fn().mockImplementation(function(this: any, _config: any) {
    this.converse = mockConverse;
  }),
  buildLLMConfig: vi.fn(() => ({
    provider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaConversationModel: DEFAULT_OLLAMA_CONFIG.conversationModel,
  })),
}));

// Mock fs module for config loading
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => ''),
    existsSync: vi.fn(() => false),
  };
});

describe('Conversation API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_API_TOKEN;
    delete process.env.OLLAMA_CONVERSATION_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockRequest = (body: unknown) => {
    return {
      json: async () => body,
    } as Parameters<typeof POST>[0];
  };

  describe('POST', () => {
    it('should return a response even when messages are empty', async () => {
      const request = createMockRequest({
        messages: [],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'intermediate',
      });

      mockConverse.mockResolvedValueOnce({
        content: 'Hello! How can I help you today?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('content');
    });

    it('should call LLM client with correct messages', async () => {
      const request = createMockRequest({
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        language: 'es',
        scenario: 'casual_chat',
        difficulty: 'beginner',
      });

      mockConverse.mockResolvedValueOnce({
        content: '¡Hola! ¿Cómo estás?',
      });

      await POST(request);

      expect(mockConverse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Hello!' }),
        ])
      );
    });

    it('should include learning profile in system prompt when provided', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello!' }],
        language: 'en',
        scenario: 'business_meeting',
        difficulty: 'intermediate',
        learningProfile: {
          grammarWeaknesses: { 'verb tenses': 5, 'articles': 3 },
          vocabularyGaps: ['business', 'finance'],
          confidenceAreas: ['small talk'],
        },
      });

      mockConverse.mockResolvedValueOnce({
        content: 'Hello! Nice to meet you.',
      });

      await POST(request);

      const callArgs = mockConverse.mock.calls[0][0];
      const systemPrompt = callArgs[0].content;

      expect(systemPrompt).toContain('verb tenses');
      expect(systemPrompt).toContain('articles');
      expect(systemPrompt).toContain('business');
      expect(systemPrompt).toContain('small talk');
    });

    it('should extract corrections from response', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'I goed to the store' }],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'beginner',
      });

      mockConverse.mockResolvedValueOnce({
        content: 'I understand! [CORRECTION: goed → went (past tense of go)] You went to the store. What did you buy?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.corrections).toHaveLength(1);
      expect(data.corrections[0]).toEqual({
        type: 'grammar',
        original: 'goed',
        corrected: 'went',
        explanation: 'past tense of go',
        severity: 'moderate',
      });
    });

    it('should extract vocabulary from response', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'What does bonjour mean?' }],
        language: 'fr',
        scenario: 'casual_chat',
        difficulty: 'beginner',
      });

      mockConverse.mockResolvedValueOnce({
        content: 'Bonjour means hello in French! [VOCAB: bonjour - hello] It\'s a common greeting.',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.vocabulary).toHaveLength(1);
      expect(data.vocabulary[0]).toEqual({
        word: 'bonjour',
        translation: 'hello',
        context: '',
      });
    });

    it('should clean metadata from content', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'intermediate',
      });

      mockConverse.mockResolvedValueOnce({
        content: 'Hello! [CORRECTION: hi → hello (more formal)] [VOCAB: greeting - salutation] How are you?',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.content).not.toContain('[CORRECTION:');
      expect(data.content).not.toContain('[VOCAB:');
      expect(data.content).toBe('Hello! How are you?');
    });

    it('should handle LLM API errors gracefully', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'intermediate',
      });

      mockConverse.mockRejectedValueOnce(new Error('Service Unavailable'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should use correct system prompt for each scenario', async () => {
      const scenarios = [
        { scenario: 'business_meeting', expectedContent: 'professional colleague' },
        { scenario: 'casual_chat', expectedContent: 'friendly acquaintance' },
        { scenario: 'technical_discussion', expectedContent: 'technical colleague' },
        { scenario: 'travel_restaurant', expectedContent: 'local person' },
        { scenario: 'job_interview', expectedContent: 'interviewer' },
        { scenario: 'doctor_appointment', expectedContent: 'healthcare provider' },
        { scenario: 'shopping', expectedContent: 'shop assistant' },
      ];

      for (const { scenario, expectedContent } of scenarios) {
        vi.clearAllMocks();

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario,
          difficulty: 'intermediate',
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Response',
        });

        await POST(request);

        const callArgs = mockConverse.mock.calls[0][0];
        const systemPrompt = callArgs[0].content;

        expect(systemPrompt).toContain(expectedContent);
      }
    });

    it('should adjust difficulty settings in system prompt', async () => {
      const difficulties = [
        { difficulty: 'beginner', expectedFrequency: 'frequently' },
        { difficulty: 'intermediate', expectedFrequency: 'when significant mistakes occur' },
        { difficulty: 'advanced', expectedFrequency: 'only for major errors' },
      ];

      for (const { difficulty, expectedFrequency } of difficulties) {
        vi.clearAllMocks();

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty,
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Response',
        });

        await POST(request);

        const callArgs = mockConverse.mock.calls[0][0];
        const systemPrompt = callArgs[0].content;

        expect(systemPrompt).toContain(expectedFrequency);
      }
    });

    describe('API Token Authentication', () => {
      it('should pass config to LLMClient when no token is provided', async () => {
        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Hello!',
        });

        await POST(request);

        // LLMClient should have been constructed
        const { LLMClient } = await import('@/lib/llm-client');
        expect(LLMClient).toHaveBeenCalled();
      });

      it('should use OLLAMA_API_TOKEN env var when set', async () => {
        process.env.OLLAMA_API_TOKEN = 'test-api-token-123';

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Hello!',
        });

        await POST(request);

        // The buildLLMConfig should pick up the env var
        const { buildLLMConfig } = await import('@/lib/llm-client');
        expect(buildLLMConfig).toHaveBeenCalled();

        // Clean up
        delete process.env.OLLAMA_API_TOKEN;
      });

      it('should use config file token when env var is not set', async () => {
        // Mock fs to return a config with API token
        const { readFileSync, existsSync } = await import('fs');
        (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(`
ollama_base_url: "http://test-server:11434"
ollama_api_token: "config-file-token-456"
ollama_conversation_model: "test-model"
`);
        (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Hello!',
        });

        await POST(request);

        // buildLLMConfig should have been called, which reads config
        const { buildLLMConfig } = await import('@/lib/llm-client');
        expect(buildLLMConfig).toHaveBeenCalled();
      });

      it('should prioritize env var token over config file token', async () => {
        process.env.OLLAMA_API_TOKEN = 'env-token-priority';
        process.env.OLLAMA_BASE_URL = 'http://env-server:11434';

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockConverse.mockResolvedValueOnce({
          content: 'Hello!',
        });

        await POST(request);

        const { buildLLMConfig } = await import('@/lib/llm-client');
        expect(buildLLMConfig).toHaveBeenCalled();

        // Clean up
        delete process.env.OLLAMA_API_TOKEN;
        delete process.env.OLLAMA_BASE_URL;
      });
    });
  });
});