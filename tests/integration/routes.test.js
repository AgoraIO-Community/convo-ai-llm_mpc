const request = require('supertest')

// Mock the services before importing the app
jest.mock('../../src/services/cerebrasService')
jest.mock('../../src/services/openaiCompletionsService')
jest.mock('../../src/services/openaiResponsesService')
jest.mock('../../src/libs/versionedTools')
jest.mock('../../src/libs/utils')

// Mock environment variables - use CEREBRAS as default provider
process.env.CEREBRAS_API_KEY = 'test-cerebras-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.USE_STREAMING = 'false'
process.env.LLM_PROVIDER = 'CEREBRAS'

const app = require('../../src/server').default

const mockCerebrasService = require('../../src/services/cerebrasService')
const mockOpenaiCompletionsService = require('../../src/services/openaiCompletionsService')
const mockOpenaiResponsesService = require('../../src/services/openaiResponsesService')
const mockUtils = require('../../src/libs/utils')

// Setup mocks
mockCerebrasService.processChatCompletion = jest.fn()
mockOpenaiCompletionsService.processChatCompletion = jest.fn()
mockOpenaiResponsesService.processResponses = jest.fn()

// Mock config - default to CEREBRAS provider
mockUtils.config = {
  llm: {
    provider: 'CEREBRAS',
    cerebrasApiKey: 'test-cerebras-key',
    openaiApiKey: 'test-openai-key',
    cerebrasModel: 'test-model',
    model: 'gpt-3.5-turbo',
    useStreaming: false,
    useResponsesApi: false,
  },
}

// Mock versioned tools
jest.mock('../../src/libs/versionedTools', () => ({
  getToolsForVersion: jest.fn().mockReturnValue([]),
}))

// Headers for CEREBRAS provider (default)
const validHeaders = {
  Authorization: 'Bearer test-cerebras-key', // Use CEREBRAS API key
  'Content-Type': 'application/json',
}

// Headers for OPENAI provider
const openaiHeaders = {
  Authorization: 'Bearer test-openai-key', // Use OPENAI API key
  'Content-Type': 'application/json',
}

const validRequestBody = {
  messages: [{ role: 'user', content: 'Hello' }],
  userId: 'test-user',
  channel: 'test-channel',
  appId: 'test-app',
}

describe('Chat Completion Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset to default CEREBRAS provider
    mockUtils.config.llm.provider = 'CEREBRAS'
    mockUtils.config.llm.useResponsesApi = false
  })

  describe('POST /v1/chat/completion', () => {
    it('should process chat completion with CEREBRAS provider', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    })

    it('should process chat completion with OPENAI provider', async () => {
      // Switch to OPENAI provider
      mockUtils.config.llm.provider = 'OPENAI'

      mockOpenaiCompletionsService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app)
        .post('/v1/chat/completion')
        .set(openaiHeaders) // Use OPENAI headers
        .send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockOpenaiCompletionsService.processChatCompletion).toHaveBeenCalled()
    })

    it('should handle missing authorization', async () => {
      const response = await request(app)
        .post('/v1/chat/completion')
        .set({ 'Content-Type': 'application/json' })
        .send(validRequestBody)

      expect(response.status).toBe(403)
    })

    it('should handle missing messages', async () => {
      const response = await request(app)
        .post('/v1/chat/completion')
        .set(validHeaders)
        .send({ userId: 'test', channel: 'test', appId: 'test' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Missing "messages" in request body')
    })

    it('should handle invalid messages format', async () => {
      const response = await request(app)
        .post('/v1/chat/completion')
        .set(validHeaders)
        .send({ ...validRequestBody, messages: 'invalid' })

      expect(response.status).toBe(400)
    })

    it('should handle service errors', async () => {
      mockCerebrasService.processChatCompletion.mockRejectedValue(new Error('Service error'))

      const response = await request(app).post('/v1/chat/completion').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(500)
    })
  })

  describe('POST /v2/chat/completion', () => {
    it('should process v2 chat completion', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v2/chat/completion').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ version: 'v2' }),
      )
    })

    it('should handle OPENAI Responses API', async () => {
      // Switch to OPENAI with Responses API
      mockUtils.config.llm.provider = 'OPENAI'
      mockUtils.config.llm.useResponsesApi = true

      mockOpenaiResponsesService.processResponses.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app)
        .post('/v2/chat/completion')
        .set(openaiHeaders) // Use OPENAI headers
        .send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockOpenaiResponsesService.processResponses).toHaveBeenCalled()
    })
  })

  describe('POST /v3/chat/completion', () => {
    it('should process v3 chat completion', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v3/chat/completion').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ version: 'v3' }),
      )
    })

    it('should handle streaming requests', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app)
        .post('/v3/chat/completion')
        .set(validHeaders)
        .send({ ...validRequestBody, stream: true })

      expect(response.status).toBe(200)
    })
  })

  describe('Legacy routes', () => {
    it('should handle legacy /completions route', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completions').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ version: 'v1' }),
      )
    })
  })

  describe('GET /ping', () => {
    it('should return health check', async () => {
      const response = await request(app).get('/ping')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('pong')
    })
  })

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).post('/unknown').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(404)
    })

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/v1/chat/completion')
        .set({ ...validHeaders, 'Content-Type': 'application/json' })
        .send('{"invalid": json}')

      expect(response.status).toBe(400)
    })
  })

  describe('Provider-specific functionality', () => {
    it('should handle different response formats', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Test response' },
            finish_reason: 'stop',
          },
        ],
      })

      const response = await request(app).post('/v1/chat/completion').set(validHeaders).send(validRequestBody)

      expect(response.status).toBe(200)
      expect(response.body.choices).toBeDefined()
      expect(response.body.choices[0].message.content).toBe('Test response')
    })

    it('should pass through custom parameters', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const customRequest = {
        ...validRequestBody,
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
      }

      const response = await request(app).post('/v1/chat/completion').set(validHeaders).send(customRequest)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 100,
          top_p: 0.9,
        }),
      )
    })
  })
})
