import request from 'supertest'
import express from 'express'

// Mock all services BEFORE importing anything else
jest.mock('../../../src/services/cerebrasService')
jest.mock('../../../src/services/openaiCompletionsService')
jest.mock('../../../src/services/openaiResponsesService')
jest.mock('../../../src/middleware/auth')
jest.mock('../../../src/libs/versionedTools')
jest.mock('../../../src/libs/utils')

const mockCerebrasService = require('../../../src/services/cerebrasService')
const mockOpenaiCompletionsService = require('../../../src/services/openaiCompletionsService')
const mockOpenaiResponsesService = require('../../../src/services/openaiResponsesService')
const mockAuth = require('../../../src/middleware/auth')
const mockUtils = require('../../../src/libs/utils')

// Setup service mocks
mockCerebrasService.processChatCompletion = jest.fn()
mockOpenaiCompletionsService.processChatCompletion = jest.fn()
mockOpenaiResponsesService.processResponses = jest.fn()

// Mock auth middleware to always pass
mockAuth.validateRequest = jest.fn((req: any, res: any, next: any) => {
  next()
})

// Mock config with default CEREBRAS provider
mockUtils.config = {
  llm: {
    provider: 'CEREBRAS',
    cerebrasModel: 'test-model',
    model: 'gpt-3.5-turbo',
    useStreaming: false,
    useResponsesApi: false,
  },
}

// Mock versioned tools function
const mockGetToolsForVersion = jest.fn().mockReturnValue([])
jest.doMock('../../../src/libs/versionedTools', () => ({
  getToolsForVersion: mockGetToolsForVersion,
}))

// Now import the router after mocking
const { chatCompletionRouter } = require('../../../src/routes/chatCompletion')

// Create test app
const app = express()
app.use(express.json())
app.use('/v1/chat', chatCompletionRouter)
app.use('/v2/chat', chatCompletionRouter)
app.use('/v3/chat', chatCompletionRouter)

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
    it('should process basic chat completion with CEREBRAS', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000) // Add timeout

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000) // Increase test timeout

    it('should process chat completion with OPENAI provider', async () => {
      mockUtils.config.llm.provider = 'OPENAI'
      mockOpenaiCompletionsService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockOpenaiCompletionsService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should process chat completion with OPENAI Responses API', async () => {
      mockUtils.config.llm.provider = 'OPENAI'
      mockUtils.config.llm.useResponsesApi = true
      mockOpenaiResponsesService.processResponses.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockOpenaiResponsesService.processResponses).toHaveBeenCalled()
    }, 15000)

    it('should handle missing messages', async () => {
      const response = await request(app)
        .post('/v1/chat/completion')
        .send({ userId: 'test', channel: 'test', appId: 'test' })
        .timeout(5000)

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Missing "messages" in request body')
    }, 15000)

    it('should handle service errors', async () => {
      mockCerebrasService.processChatCompletion.mockRejectedValue(new Error('Service error'))

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Service error')
    }, 15000)
  })

  describe('POST /v2/chat/completion', () => {
    it('should process v2 chat completion', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v2/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should handle custom model parameter', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const customRequest = {
        ...validRequestBody,
        model: 'custom-model',
      }

      const response = await request(app).post('/v2/chat/completion').send(customRequest).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)
  })

  describe('POST /v3/chat/completion', () => {
    it('should process v3 chat completion', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v3/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should handle streaming requests', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const streamingRequest = {
        ...validRequestBody,
        stream: true,
      }

      const response = await request(app).post('/v3/chat/completion').send(streamingRequest).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should pass RTM parameters', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const rtmRequest = {
        ...validRequestBody,
        enable_rtm: true,
        agent_rtm_uid: 'rtm-uid',
        agent_rtm_token: 'rtm-token',
        agent_rtm_channel: 'rtm-channel',
      }

      const response = await request(app).post('/v3/chat/completion').send(rtmRequest).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)
  })

  describe('Legacy route POST /v1/chat/completions', () => {
    it('should process legacy completions route', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completions').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)
  })

  describe('Provider switching', () => {
    it('should use CEREBRAS by default', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should use OpenAI when configured', async () => {
      mockUtils.config.llm.provider = 'OPENAI'
      mockOpenaiCompletionsService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockOpenaiCompletionsService.processChatCompletion).toHaveBeenCalled()
    }, 15000)
  })

  describe('Version detection', () => {
    it('should detect v1 from URL path', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v1/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should detect v2 from URL path', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v2/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)

    it('should detect v3 from URL path', async () => {
      mockCerebrasService.processChatCompletion.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const response = await request(app).post('/v3/chat/completion').send(validRequestBody).timeout(5000)

      expect(response.status).toBe(200)
      expect(mockCerebrasService.processChatCompletion).toHaveBeenCalled()
    }, 15000)
  })

  describe('Error handling', () => {
    it('should handle missing request body', async () => {
      const response = await request(app).post('/v1/chat/completion').send({}).timeout(5000)

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Missing "messages" in request body')
    }, 15000)
  })
})
