import { Request, Response, NextFunction } from 'express'
import { config } from '../libs/utils'

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  // Get the expected API key based on the configured LLM provider
  const expectedApiKey = config.llm.provider === 'CEREBRAS' ? config.llm.cerebrasApiKey : config.llm.openaiApiKey

  if (process.env.NODE_ENV === 'development') {
    console.log('LLM Provider:', config.llm.provider)
    console.log('Received auth header:', authHeader)
    console.log('Received token:', token)
    console.log('Expected token:', expectedApiKey)
    console.log('Token comparison:', token === expectedApiKey)
  }

  if (!token || token !== expectedApiKey) {
    return res.status(403).json({
      error: 'Invalid or missing token',
      provider: config.llm.provider,
    })
  }

  next()
}
