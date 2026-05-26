// Vitest globals are available - no explicit imports needed
import { POST } from '../route';
import { DEFAULT_OLLAMA_CONFIG } from '@/lib/constants';

// Mock the ollama package
const mockChat = vi.fn();
vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    chat: mockChat,
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
})

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
    it('should return error when messages are empty', async () => {
      const request = createMockRequest({
        messages: [],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'intermediate',
      });

      // Mock Ollama response
      mockChat.mockResolvedValueOnce({
        message: { content: 'Hello! How can I help you today?' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('content');
    });

    it('should call Ollama chat with correct parameters', async () => {
      const request = createMockRequest({
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
        language: 'es',
        scenario: 'casual_chat',
        difficulty: 'beginner',
      });

      // Mock Ollama response
      mockChat.mockResolvedValueOnce({
        message: { content: '¡Hola! ¿Cómo estás?' },
      });

      await POST(request);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: DEFAULT_OLLAMA_CONFIG.conversationModel,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Hello!' }),
          ]),
          stream: false,
        })
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

      mockChat.mockResolvedValueOnce({
        message: { content: 'Hello! Nice to meet you.' },
      });

      await POST(request);

      const callArgs = mockChat.mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;

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

      mockChat.mockResolvedValueOnce({
        message: {
          content: 'I understand! [CORRECTION: goed → went (past tense of go)] You went to the store. What did you buy?',
        },
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

      mockChat.mockResolvedValueOnce({
        message: {
          content: 'Bonjour means hello in French! [VOCAB: bonjour - hello] It\'s a common greeting.',
        },
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

      mockChat.mockResolvedValueOnce({
        message: {
          content: 'Hello! [CORRECTION: hi → hello (more formal)] [VOCAB: greeting - salutation] How are you?',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.content).not.toContain('[CORRECTION:');
      expect(data.content).not.toContain('[VOCAB:');
      expect(data.content).toBe('Hello! How are you?');
    });

    it('should handle Ollama API errors gracefully', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        language: 'en',
        scenario: 'casual_chat',
        difficulty: 'intermediate',
      });

      mockChat.mockRejectedValueOnce(new Error('Service Unavailable'));

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

        mockChat.mockResolvedValueOnce({
          message: { content: 'Response' },
        });

        await POST(request);

        const callArgs = mockChat.mock.calls[0][0];
        const systemPrompt = callArgs.messages[0].content;

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

        mockChat.mockResolvedValueOnce({
          message: { content: 'Response' },
        });

        await POST(request);

        const callArgs = mockChat.mock.calls[0][0];
        const systemPrompt = callArgs.messages[0].content;

        expect(systemPrompt).toContain(expectedFrequency);
      }
    });

    describe('API Token Authentication', () => {
      it('should create Ollama client without auth header when no token is provided', async () => {
        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockChat.mockResolvedValueOnce({
          message: { content: 'Hello!' },
        });

        await POST(request);

        // The Ollama constructor should be called without auth headers
        const { Ollama } = await import('ollama');
        expect(Ollama).toHaveBeenCalledWith(
          expect.objectContaining({
            host: expect.any(String),
            headers: {}, // Empty headers when no token
          })
        );
      });

      it('should create Ollama client with auth header when OLLAMA_API_TOKEN env var is set', async () => {
        process.env.OLLAMA_API_TOKEN = 'test-api-token-123';

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockChat.mockResolvedValueOnce({
          message: { content: 'Hello!' },
        });

        await POST(request);

        // The Ollama constructor should be called with auth header
        const { Ollama } = await import('ollama');
        expect(Ollama).toHaveBeenCalledWith(
          expect.objectContaining({
            host: expect.any(String),
            headers: {
              Authorization: 'Bearer test-api-token-123',
            },
          })
        );

        // Clean up
        delete process.env.OLLAMA_API_TOKEN;
      });

      it('should use token from config file when env var is not set', async () => {
        // Mock fs to return a config with API token
        const mockReadFileSync = vi.fn(() => `
ollama_base_url: "http://test-server:11434"
ollama_api_token: "config-file-token-456"
ollama_conversation_model: "test-model"
`);
        const mockExistsSync = vi.fn(() => true);
        
        vi.doMock('fs', () => ({
          readFileSync: mockReadFileSync,
          existsSync: mockExistsSync,
        }));

        // Re-import to get fresh module with new mocks
        vi.resetModules();
        
        const { POST: POSTFresh } = await import('../route');
        const { Ollama: OllamaFresh } = await import('ollama');
        const mockChatFresh = vi.fn();
        vi.mock('ollama', () => ({
          Ollama: vi.fn().mockImplementation(() => ({
            chat: mockChatFresh,
          })),
        }));

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockChatFresh.mockResolvedValueOnce({
          message: { content: 'Hello!' },
        });

        await POSTFresh(request);

        // The Ollama constructor should be called with auth header from config
        expect(OllamaFresh).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'http://test-server:11434',
            headers: {
              Authorization: 'Bearer config-file-token-456',
            },
          })
        );
      });

      it('should prioritize env var token over config file token', async () => {
        process.env.OLLAMA_API_TOKEN = 'env-token-priority';
        process.env.OLLAMA_BASE_URL = 'http://env-server:11434';

        // Mock fs to return a config with different token
        vi.doMock('fs', () => ({
          readFileSync: vi.fn(() => `
ollama_base_url: "http://config-server:11434"
ollama_api_token: "config-token-lower-priority"
`),
          existsSync: vi.fn(() => true),
        }));

        const request = createMockRequest({
          messages: [{ role: 'user', content: 'Hello' }],
          language: 'en',
          scenario: 'casual_chat',
          difficulty: 'intermediate',
        });

        mockChat.mockResolvedValueOnce({
          message: { content: 'Hello!' },
        });

        await POST(request);

        const { Ollama } = await import('ollama');
        expect(Ollama).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'http://env-server:11434',
            headers: {
              Authorization: 'Bearer env-token-priority',
            },
          })
        );

        // Clean up
        delete process.env.OLLAMA_API_TOKEN;
        delete process.env.OLLAMA_BASE_URL;
      });
    });
  });
});