import {
  processChatCompletion,
  processMultiTurnToolUse,
  type ChatMessage,
  type ChatCompletionOptions,
} from '../../../src/services/cerebrasService'

// Mock external dependencies
jest.mock('@cerebras/cerebras_cloud_sdk', () => {
  const mockCreate = jest.fn()
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    mockCreate,
  }
})

jest.mock('../../../src/libs/versionedTools', () => ({
  getVersionedSystemMessage: jest.fn((version) => `System message for ${version}`),
  extendedToolResponseTypes: {},
}))

jest.mock('../../../src/services/mockRagService', () => ({
  getFormattedRagData: jest.fn().mockReturnValue('Mock RAG data'),
  loadRestaurantData: jest.fn(),
}))

jest.mock('../../../src/libs/versionedFunctionMap', () => ({
  getVersionedFunctionMap: jest.fn().mockReturnValue(new Map()),
}))

jest.mock('../../../src/libs/tools', () => ({
  functionMap: {},
}))

// Set up test environment
process.env.CEREBRAS_MODEL = 'test-model'
process.env.USE_STREAMING = 'false'

describe('CerebrasService', () => {
  const mockCerebras = require('@cerebras/cerebras_cloud_sdk')
  const mockCreate = mockCerebras.mockCreate

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('processChatCompletion', () => {
    it('should process basic chat completion', async () => {
      mockCreate.mockResolvedValue({
        id: 'test-completion',
        choices: [{ message: { content: 'Test response' } }],
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
      }

      const result = await processChatCompletion(messages, options)

      expect(mockCreate).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should handle different API versions', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
        version: 'v2',
      }

      await processChatCompletion(messages, options)

      expect(mockCreate).toHaveBeenCalled()
    })

    it('should handle streaming mode', async () => {
      // Mock streaming response as async iterable
      const mockStream = (async function* () {
        yield {
          id: 'test-stream-1',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'test-model',
          choices: [{ index: 0, delta: { content: 'Test' }, finish_reason: null }],
        }
        yield {
          id: 'test-stream-2',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'test-model',
          choices: [{ index: 0, delta: { content: ' response' }, finish_reason: 'stop' }],
        }
      })()

      mockCreate.mockResolvedValue(mockStream)

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
        stream: true,
      }

      const result = await processChatCompletion(messages, options)

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(ReadableStream)
    })

    it('should handle errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'))

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
      }

      await expect(processChatCompletion(messages, options)).rejects.toThrow(
        'Failed to process chat completion with Cerebras',
      )
    })

    it('should handle streaming errors gracefully', async () => {
      // Mock streaming response that throws an error
      const mockStream = (async function* () {
        throw new Error('Stream error')
      })()

      mockCreate.mockResolvedValue(mockStream)

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
        stream: true,
      }

      const result = await processChatCompletion(messages, options)

      // The function should return a ReadableStream in error state
      expect(result).toBeInstanceOf(ReadableStream)
      
      // The stream should be in error state
      const reader = (result as ReadableStream).getReader()
      await expect(reader.read()).rejects.toThrow('Stream error')
    })
  })

  describe('processMultiTurnToolUse', () => {
    it('should process multi-turn conversation with qwen model', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Response without tool calls',
              tool_calls: null,
            },
          },
        ],
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
        model: 'qwen-3-32b',
      }

      const result = await processMultiTurnToolUse(messages, options)

      expect(mockCreate).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should reject non-qwen models', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }]
      const options: ChatCompletionOptions = {
        userId: 'user123',
        channel: 'channel456',
        appId: 'app789',
        model: 'wrong-model',
      }

      await expect(processMultiTurnToolUse(messages, options)).rejects.toThrow(
        'Multi-turn tool use is only supported with qwen-3-32b model',
      )
    })
  })
})
