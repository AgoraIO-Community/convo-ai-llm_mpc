import { Request, Response, NextFunction } from 'express'
import { validateRequest } from '../../../src/middleware/auth'

// Mock the config
jest.mock('../../../src/libs/utils', () => ({
  config: {
    llm: {
      provider: 'CEREBRAS',
      cerebrasApiKey: 'test-cerebras-key',
      openaiApiKey: 'test-openai-key',
    },
  },
}))

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockRequest = {
      headers: {},
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()
  })

  describe('validateRequest', () => {
    it('should call next() when valid token is provided', () => {
      mockRequest.headers = {
        authorization: 'Bearer test-cerebras-key',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockResponse.status).not.toHaveBeenCalled()
    })

    it('should return 403 when no authorization header is provided', () => {
      mockRequest.headers = {}

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or missing token',
        provider: 'CEREBRAS',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should return 403 when invalid token is provided', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or missing token',
        provider: 'CEREBRAS',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle authorization header without Bearer prefix', () => {
      mockRequest.headers = {
        authorization: 'test-cerebras-key',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should validate tokens correctly', () => {
      // Test with the current CEREBRAS provider setup
      mockRequest.headers = {
        authorization: 'Bearer test-cerebras-key',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle empty authorization header', () => {
      mockRequest.headers = {
        authorization: '',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      expect(mockResponse.status).toHaveBeenCalledWith(403)
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle Bearer token with extra spaces', () => {
      mockRequest.headers = {
        authorization: 'Bearer  test-cerebras-key  ',
      }

      validateRequest(mockRequest as Request, mockResponse as Response, mockNext)

      // This will fail since the middleware doesn't trim - which exposes a potential bug
      expect(mockResponse.status).toHaveBeenCalledWith(403)
    })
  })
})
