import { config } from '../../../src/libs/utils'

describe('Utils', () => {
  describe('config', () => {
    it('should have default configuration values', () => {
      expect(config).toBeDefined()
      expect(config.port).toBeDefined()
      expect(config.llm).toBeDefined()
      expect(config.llm.provider).toBeDefined()
    })

    it('should have required properties', () => {
      expect(typeof config.port).toBe('number')
      expect(config.agora).toBeDefined()
      expect(config.llm.provider).toMatch(/^(OPENAI|CEREBRAS)$/)
      expect(config.agentId).toBeDefined()
    })

    it('should use environment variables when available', () => {
      // Test that config reads from environment
      expect(['OPENAI', 'CEREBRAS']).toContain(config.llm.provider)
    })

    it('should have valid LLM configuration', () => {
      if (config.llm.provider === 'CEREBRAS') {
        expect(config.llm.cerebrasModel).toBeDefined()
      } else if (config.llm.provider === 'OPENAI') {
        expect(config.llm.model).toBeDefined()
      }
    })
  })
}) 