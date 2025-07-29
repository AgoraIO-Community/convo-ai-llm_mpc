import { Router, Request, Response, RequestHandler } from 'express'
import { processChatCompletion } from '../services/openaiCompletionsService'
import { processResponses } from '../services/openaiResponsesService'
import { processChatCompletion as processCerebrasCompletion } from '../services/cerebrasService'
import { validateRequest } from '../middleware/auth'
import { config } from '../libs/utils'
// import { cerebrasTools } from '../libs/toolDefinitions'
import { getToolsForVersion } from '../libs/versionedTools'
import { storeCallAction } from '../libs/versionedFunctionMap'

const router = Router()

const debug = false //process.env.NODE_ENV === 'development'

// Middleware to validate API token
router.use(validateRequest as RequestHandler)

// Generic handler for all versions
const handleChatCompletion = (version: 'v1' | 'v2' | 'v3' | 'v4') => {
  return (async (req: Request, res: Response) => {
    try {
      const {
        messages,
        model, // Will use provider-specific default if not provided
        stream, // Will use provider-specific default if not provided
        channel, // Dynamic channel from Agora
        userId, // Dynamic user ID from Agora
        appId, // Dynamic app ID from Agora
        // RTM parameters (for tools that might need them)
        enable_rtm = false,
        agent_rtm_uid = '',
        agent_rtm_token = '',
        agent_rtm_channel = '',
        // Standard LLM parameters that should be passed through
        temperature,
        max_tokens,
        top_p,
        // Call action parameter from frontend
        call_action,
      } = req.body

      // Store call action preference if provided and channel is available
      if (call_action && channel) {
        storeCallAction(channel, call_action)
        console.log(`Stored call action "${call_action}" for channel "${channel}"`)
      } else if (call_action) {
        console.log('Call action provided but no channel available to store it')
      }

      if (!messages) {
        return res.status(400).json({ error: 'Missing "messages" in request body' })
      }

      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages must be an array' })
      }

      if (debug) {
        console.log(`Processing ${version} request with Agora context:`, {
          channel,
          userId,
          appId,
          enable_rtm,
          agent_rtm_uid,
          agent_rtm_token: agent_rtm_token ? '[PROVIDED]' : '[MISSING]',
          agent_rtm_channel,
        })
      }

      let result: ReadableStream | object
      let finalModel: string
      let finalStream: boolean

      // Select processing handler based on version and LLM provider
      if (version === 'v4') {
        // v4 always uses OpenAI Responses API with MCP servers
        console.log(`Using OpenAI Responses API for ${version} request (MCP integration)`)

        // Use OpenAI-specific defaults
        finalModel = model || config.llm.model
        finalStream = stream !== undefined ? stream : false

        result = await processResponses(messages, {
          model: finalModel,
          stream: finalStream,
          channel, // May be undefined
          userId, // May be undefined
          appId, // May be undefined
          version, // Pass version to service
          // Pass through standard LLM parameters
          temperature,
          max_tokens,
          top_p,
        })
      } else if (config.llm.provider === 'CEREBRAS') {
        console.log(`Using Cerebras for ${version} request`)

        // Use Cerebras-specific defaults
        finalModel = model || config.llm.cerebrasModel
        finalStream = stream !== undefined ? stream : config.llm.useStreaming

        // Get version-specific tools
        const versionedTools = getToolsForVersion(version)

        result = await processCerebrasCompletion(messages, {
          model: finalModel,
          stream: finalStream,
          channel, // May be undefined - tools will handle gracefully
          userId, // May be undefined - tools will handle gracefully
          appId, // May be undefined - tools will handle gracefully
          tools: versionedTools, // Version-specific tools
          version, // Pass version to service
          // Pass through standard LLM parameters
          temperature,
          max_tokens,
          top_p,
        })
      } else {
        // OpenAI provider (default) - for now all versions use same logic
        const useResponsesApi = config.llm.useResponsesApi
        console.log(
          `Using ${
            useResponsesApi ? 'OpenAI Responses API' : 'OpenAI Chat Completions API'
          } for ${version} request`,
        )

        // Use OpenAI-specific defaults
        finalModel = model || config.llm.model
        finalStream = stream !== undefined ? stream : false

        // Use either processChatCompletion or processResponses based on config
        const processHandler = useResponsesApi ? processResponses : processChatCompletion

        result = await processHandler(messages, {
          model: finalModel,
          stream: finalStream,
          channel, // May be undefined
          userId, // May be undefined
          appId, // May be undefined
          version, // Pass version to service
          // Pass through standard LLM parameters
          temperature,
          max_tokens,
          top_p,
        })
      }

      if (finalStream) {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        if (result instanceof ReadableStream) {
          // Handle Web ReadableStream
          const reader = result.getReader()

          // Process stream chunks
          let done = false
          while (!done) {
            const readResult = await reader.read()
            done = readResult.done
            if (!done) {
              // Write chunks to response
              res.write(readResult.value)
            }
          }

          // End the response
          res.end()
        } else {
          // Fallback for non-streaming response
          res.json(result)
        }
      } else {
        console.log(`Sending non-streaming ${version} response:`, JSON.stringify(result, null, 2))
        res.json(result)
      }
    } catch (err: unknown) {
      console.error(`Chat Completions Error (${version}):`, err)
      res.status(500).json({ 
        error: err instanceof Error ? err.message : 'Unknown error' 
      })
    }
  }) as RequestHandler
}

// Main completion route - version determined by parent router path
router.post('/completion', ((req: Request, res: Response, next) => {
  // Extract version from the URL path
  const fullPath = req.originalUrl
  let version: 'v1' | 'v2' | 'v3' | 'v4' = 'v4' // default

  if (fullPath.includes('/v4/')) {
    version = 'v4'
  } else if (fullPath.includes('/v3/')) {
    version = 'v3'
  } else if (fullPath.includes('/v2/')) {
    version = 'v2'
  } else if (fullPath.includes('/v1/')) {
    version = 'v1'
  }

  // Call the appropriate handler
  const handler = handleChatCompletion(version)
  return handler(req, res, next)
}) as RequestHandler)

// Legacy route (defaults to v1) - for backward compatibility
router.post('/completions', handleChatCompletion('v1'))

export const chatCompletionRouter = router
