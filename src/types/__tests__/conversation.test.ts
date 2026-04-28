// Vitest globals are available - no explicit imports needed
import {
  SCENARIO_CONFIGS,
  DIFFICULTY_CONFIGS,
  type ConversationScenario,
  type DifficultyLevel,
} from '../conversation';

describe('Conversation Types', () => {
  describe('SCENARIO_CONFIGS', () => {
    it('should have all required scenarios', () => {
      const expectedScenarios: ConversationScenario[] = [
        'business_meeting',
        'casual_chat',
        'technical_discussion',
        'travel_restaurant',
        'job_interview',
        'doctor_appointment',
        'shopping',
        'custom',
      ];

      expectedScenarios.forEach((scenario) => {
        expect(SCENARIO_CONFIGS[scenario]).toBeDefined();
      });
    });

    it('should have required properties for each scenario', () => {
      Object.values(SCENARIO_CONFIGS).forEach((config) => {
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('icon');
        expect(config).toHaveProperty('systemPrompt');
        expect(config).toHaveProperty('suggestedTopics');
        expect(config).toHaveProperty('vocabularyFocus');
      });
    });

    it('should have matching id and config key', () => {
      Object.entries(SCENARIO_CONFIGS).forEach(([key, config]) => {
        expect(config.id).toBe(key);
      });
    });

    it('should have non-empty names', () => {
      Object.values(SCENARIO_CONFIGS).forEach((config) => {
        expect(config.name.length).toBeGreaterThan(0);
      });
    });

    it('should have {language} placeholder in system prompts', () => {
      Object.values(SCENARIO_CONFIGS).forEach((config) => {
        expect(config.systemPrompt).toContain('{language}');
      });
    });
  });

  describe('DIFFICULTY_CONFIGS', () => {
    it('should have all required difficulty levels', () => {
      const expectedLevels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

      expectedLevels.forEach((level) => {
        expect(DIFFICULTY_CONFIGS[level]).toBeDefined();
      });
    });

    it('should have required properties for each difficulty', () => {
      Object.values(DIFFICULTY_CONFIGS).forEach((config) => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('correctionFrequency');
        expect(config).toHaveProperty('vocabularyLevel');
        expect(config).toHaveProperty('speechPace');
      });
    });

    it('should have valid correction frequency values', () => {
      const validFrequencies = ['high', 'moderate', 'low'];

      Object.values(DIFFICULTY_CONFIGS).forEach((config) => {
        expect(validFrequencies).toContain(config.correctionFrequency);
      });
    });

    it('should have valid vocabulary level values', () => {
      const validLevels = ['basic', 'intermediate', 'advanced'];

      Object.values(DIFFICULTY_CONFIGS).forEach((config) => {
        expect(validLevels).toContain(config.vocabularyLevel);
      });
    });

    it('should have valid speech pace values', () => {
      const validPaces = ['slow', 'normal', 'natural'];

      Object.values(DIFFICULTY_CONFIGS).forEach((config) => {
        expect(validPaces).toContain(config.speechPace);
      });
    });

    it('beginner should have high correction frequency and basic vocabulary', () => {
      expect(DIFFICULTY_CONFIGS.beginner.correctionFrequency).toBe('high');
      expect(DIFFICULTY_CONFIGS.beginner.vocabularyLevel).toBe('basic');
      expect(DIFFICULTY_CONFIGS.beginner.speechPace).toBe('slow');
    });

    it('advanced should have low correction frequency and advanced vocabulary', () => {
      expect(DIFFICULTY_CONFIGS.advanced.correctionFrequency).toBe('low');
      expect(DIFFICULTY_CONFIGS.advanced.vocabularyLevel).toBe('advanced');
      expect(DIFFICULTY_CONFIGS.advanced.speechPace).toBe('natural');
    });
  });
});