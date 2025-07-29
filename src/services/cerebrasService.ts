import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { ChatCompletionCreateParams, ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions'
import { cerebrasTools, toolResponseTypes } from '../libs/toolDefinitions'
import { functionMap } from '../libs/tools'
import { getVersionedFunctionMap } from '../libs/versionedFunctionMap'
import { getVersionedSystemMessage, extendedToolResponseTypes } from '../libs/versionedTools'

// Use Cerebras message types
type SystemMessage = ChatCompletionCreateParams.SystemMessageRequest
type UserMessage = ChatCompletionCreateParams.UserMessageRequest
type AssistantMessage = ChatCompletionCreateParams.AssistantMessageRequest
type ToolMessage = ChatCompletionCreateParams.ToolMessageRequest

type ChatMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage

interface ChatCompletionOptions {
  model?: string
  stream?: boolean
  userId: string
  channel: string
  appId: string
  tools?: ChatCompletionCreateParams.Tool[]
  version?: 'v1' | 'v2' | 'v3'
  // Standard LLM parameters
  temperature?: number
  max_tokens?: number
  top_p?: number
}

interface RequestContext {
  userId: string
  channel: string
  appId: string
}

const debug = process.env.NODE_ENV === 'development'

// Initialize Cerebras client only when needed
let cerebras: Cerebras | null = null

function getCerebrasClient(): Cerebras {
  if (!cerebras) {
    cerebras = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY || '',
    })
  }
  return cerebras
}

/**
 * Creates a system message with version-specific RAG data
 * @param {string} version - API version (v1, v2, v3)
 * @returns {SystemMessage} System message with RAG data
 */
function createSystemMessage(version: 'v1' | 'v2' | 'v3' = 'v1'): SystemMessage {
  return {
    role: 'system',
    content: getVersionedSystemMessage(version),
  }
}

/**
 * Convert a non-streaming response to streaming format for client compatibility
 * @param {ChatCompletion} response - Non-streaming response
 * @returns {ReadableStream} Streaming response
 */
function convertToStream(response: ChatCompletion): ReadableStream {
  const encoder = new TextEncoder()
  const responseChoices = Array.isArray(response.choices) ? response.choices : []
  const content = responseChoices[0]?.message?.content || ''

  return new ReadableStream({
    start(controller) {
      // Send the content as a single chunk
      const chunk = {
        id: response.id,
        object: 'chat.completion.chunk',
        created: response.created,
        model: response.model,
        choices: [
          {
            index: 0,
            delta: {
              content: content,
            },
            finish_reason: null,
          },
        ],
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))

      // Send completion chunk
      const finalChunk = {
        id: response.id,
        object: 'chat.completion.chunk',
        created: response.created,
        model: response.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`))
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
      controller.close()
    },
  })
}

/**
 * Process a chat completion request with Cerebras
 * @param {ChatMessage[]} messages - Chat messages
 * @param {ChatCompletionOptions} options - Additional options
 * @returns {Promise<ChatCompletion>} Cerebras response
 */
async function processChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): Promise<ChatCompletion | ReadableStream> {
  // Use model from environment variable or fallback
  const {
    model = process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
    stream = process.env.USE_STREAMING === 'true',
    userId,
    channel,
    appId,
    tools,
    version = 'v1',
    temperature = 0.2,
    max_tokens,
    top_p = 1,
  } = options

  // Add system message with version-specific RAG data
  const systemMessage = createSystemMessage(version)
  const fullMessages: ChatMessage[] = [systemMessage, ...messages]

  // Build request options
  const requestOptions: Omit<ChatCompletionCreateParams, 'stream'> = {
    model,
    messages: fullMessages,
    max_completion_tokens: max_tokens || 2048,
    temperature,
    top_p,
  }

  // Add tools if provided and model supports them
  if (tools && tools.length > 0) {
    requestOptions.tools = tools
    // Set parallel_tool_calls=false for llama-4-scout-17b-16e-instruct as per guide
    if (model === 'llama-4-scout-17b-16e-instruct') {
      requestOptions.parallel_tool_calls = false
    }
  }

  // Force non-streaming mode when tools are present since streaming + tools is complex
  const useStreaming = stream && (!tools || tools.length === 0)

  console.log(`Cerebras: stream=${stream}, tools=${tools?.length || 0}, useStreaming=${useStreaming}`)

  if (!useStreaming) {
    // Non-streaming mode (includes when tools are present)
    const result = await processNonStreamingRequest(
      requestOptions,
      fullMessages,
      {
        userId,
        channel,
        appId,
      },
      version,
    )

    // If the client originally requested streaming but we used non-streaming due to tools,
    // convert the response to streaming format for client compatibility
    if (stream && result && typeof result === 'object' && 'choices' in result) {
      console.log('Converting to streaming format for client compatibility')
      return convertToStream(result as ChatCompletion)
    }

    return result
  } else {
    // Streaming mode (only when no tools)
    return processStreamingRequest(requestOptions)
  }
}

/**
 * Process a non-streaming request with tool calling support
 * @param {Omit<ChatCompletionCreateParams, 'stream'>} requestOptions - Cerebras request options
 * @param {ChatMessage[]} fullMessages - Complete message history
 * @param {RequestContext} context - Request context (userId, channel, appId)
 * @returns {Promise<ChatCompletion>} Final response
 */
async function processNonStreamingRequest(
  requestOptions: Omit<ChatCompletionCreateParams, 'stream'>,
  fullMessages: ChatMessage[],
  context: RequestContext,
  version: 'v1' | 'v2' | 'v3' = 'v1',
): Promise<ChatCompletion> {
  const { userId, channel, appId } = context

  try {
      // Make request to Cerebras
  const response = await getCerebrasClient().chat.completions.create({
      ...requestOptions,
      stream: false,
    })

    // Type guard for choices array
    const choices = Array.isArray(response.choices) ? response.choices : []
    const choice = choices[0]?.message

    // Handle tool calls if present
    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      // Add the assistant's response with tool calls to messages
      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: choice.content,
        tool_calls: choice.tool_calls,
      }
      fullMessages.push(assistantMessage)

      // Track if we have tools to process (both data and affirmation tools re-prompt)
      let hasDataTools = false

      // Track executed functions to prevent duplicates
      const executedFunctions = new Set<string>()

      // Get version-specific function map once
      const versionedFunctions = getVersionedFunctionMap(version)

      // Process each tool call
      for (const toolCall of choice.tool_calls) {
        const functionCall = toolCall.function

        if (debug) {
          console.log(`Debug: Function name from call: '${functionCall.name}'`)
          console.log(`Debug: Available functions:`, Object.keys(versionedFunctions))
          console.log(`Debug: Function exists in map:`, functionCall.name in versionedFunctions)
        }

        // Skip if this function has already been executed in this request
        if (executedFunctions.has(functionCall.name)) {
          console.log(`Skipping duplicate function call: ${functionCall.name}`)
          continue
        }

        if (functionCall.name in versionedFunctions) {
          console.log(`Model executing function '${functionCall.name}' with arguments ${functionCall.arguments}`)

          // For phone call functions, check if a call was already made recently or if someone has joined
          if (
            functionCall.name === 'call_hermes_phone' ||
            functionCall.name === 'call_phone' ||
            functionCall.name === 'call_sid_phone'
          ) {
            const recentMessages = fullMessages.slice(-15) // Check last 15 messages for better coverage

            // Check for various indicators that a call was already made or is active
            const hasRecentCall = recentMessages.some((msg) => {
              if (msg.role === 'assistant' && msg.content) {
                return (
                  msg.content.includes('Phone call initiated') ||
                  msg.content.includes('call initiated') ||
                  msg.content.includes('Calling') ||
                  msg.content.includes("I'll call") ||
                  msg.content.includes('Making a call')
                )
              }
              // Also check if there was a recent tool call for phone functions
              if (msg.role === 'tool' && msg.content) {
                return (
                  msg.content.includes('Phone call initiated successfully') ||
                  msg.content.includes('call initiated') ||
                  msg.content.includes('Call ID:')
                )
              }
              return false
            })

            // Check if someone has joined the conversation (indicating call connected)
            const someoneJoined = recentMessages.some((msg) => {
              if (msg.role === 'user' && msg.content && typeof msg.content === 'string') {
                const content = (msg.content as string).toLowerCase()
                return (
                  content.includes('hello') ||
                  content.includes('hi ') ||
                  content.includes('hey') ||
                  content.includes('good morning') ||
                  content.includes('good afternoon') ||
                  content.includes('good evening') ||
                  content.includes('who is this') ||
                  content.includes("who's calling")
                )
              }
              return false
            })

            if (hasRecentCall || someoneJoined) {
              console.log(`Skipping ${functionCall.name} - call already active or someone joined conversation`)
              const toolMessage: ToolMessage = {
                role: 'tool',
                content: someoneJoined
                  ? 'A call is already active and someone has joined the conversation. Continue talking with them instead of making another call.'
                  : 'A call was already initiated recently. The call should be connecting or active.',
                tool_call_id: toolCall.id,
              }
              fullMessages.push(toolMessage)
              hasDataTools = true // Force re-prompting
              continue
            }
          }

          // Mark function as executed
          executedFunctions.add(functionCall.name)

          // Parse arguments and execute function
          const functionArgs = JSON.parse(functionCall.arguments)
          const result = await versionedFunctions[functionCall.name](appId, userId, channel, functionArgs)

          console.log(`Function result: ${result}`)

          // Use extended tool response types that include v3 YELP tools
          const responseType = extendedToolResponseTypes[functionCall.name] || toolResponseTypes[functionCall.name]

          if (responseType === 'affirmation') {
            // For affirmation tools, add as tool result to maintain context and re-prompt model
            const toolMessage: ToolMessage = {
              role: 'tool',
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCall.id,
            }
            fullMessages.push(toolMessage)
            hasDataTools = true // Force re-prompting to maintain conversation context
          } else if (responseType === 'data') {
            // For data tools, add to context for model to process
            hasDataTools = true
            const toolMessage: ToolMessage = {
              role: 'tool',
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCall.id,
            }
            fullMessages.push(toolMessage)
          }
        } else {
          console.error(`Function '${functionCall.name}' not found in versioned functionMap for ${version}`)
        }
      }

      // Note: Always re-prompt for both affirmation and data tools to maintain context
      // This ensures the model understands the function was executed and can continue conversation naturally

      // Only proceed with re-prompting if we actually have tools to process
      if (hasDataTools) {
        // For models other than qwen-3-32b, clean up messages for final request
        if (requestOptions.model !== 'qwen-3-32b') {
          // Keep only: system message, user messages, and tool messages
          // Remove ALL assistant messages to avoid confusion
          fullMessages = fullMessages.filter((msg) => {
            return msg.role === 'system' || msg.role === 'user' || msg.role === 'tool'
          })
        }

        // Get final response from model with tool results
        console.log('Making final request with tool results...')
        console.log('Last 3 messages:', JSON.stringify(fullMessages.slice(-3), null, 2))

        const finalResponse = await getCerebrasClient().chat.completions.create({
          model: requestOptions.model,
          messages: fullMessages,
          max_completion_tokens: requestOptions.max_completion_tokens,
          temperature: requestOptions.temperature,
          top_p: requestOptions.top_p,
          // Don't include tools in the final request to avoid confusion
        })

        const finalChoices = Array.isArray(finalResponse.choices) ? finalResponse.choices : []
        console.log('Final response after tool execution:', finalChoices[0]?.message?.content)

        return finalResponse
      } else {
        console.log('No tool results to process, returning original response')
        return response
      }
    }

    return response
  } catch (error) {
    console.error('Cerebras API error:', error)
    throw new Error('Failed to process chat completion with Cerebras')
  }
}

/**
 * Generate a streaming response using stream chunks
 * @param {Omit<ChatCompletionCreateParams, 'stream'>} requestOptions - Cerebras request options
 * @param {ChatMessage[]} fullMessages - Complete message history
 * @param {RequestContext} context - Request context (userId, channel, appId)
 * @returns {Promise<ReadableStream>} Stream of events
 */
async function processStreamingRequest(
  requestOptions: Omit<ChatCompletionCreateParams, 'stream'>,
): Promise<ReadableStream> {
 
  try {
    // Make streaming request to Cerebras
    const stream = await getCerebrasClient().chat.completions.create({
      ...requestOptions,
      stream: true,
    })

    // Create encoder for SSE format
    const encoder = new TextEncoder()

    // Create readable stream
    return new ReadableStream({
      async start(controller) {
        try {
          // Iterate through stream chunks
          for await (const chunk of stream) {
            // Send chunk downstream as SSE in format compatible with OpenAI
            const chunkChoices = Array.isArray(chunk.choices) ? chunk.choices : []
            const formattedChunk = {
              id: chunk.id,
              object: chunk.object,
              created: chunk.created,
              model: chunk.model,
              choices: chunkChoices.map((choice) => ({
                index: choice.index,
                delta: choice.delta,
                finish_reason: choice.finish_reason,
              })),
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(formattedChunk)}\n\n`))

            // Check if stream is finished - handle potential undefined choices array
            const firstChoice = chunkChoices[0]
            if (firstChoice?.finish_reason) {
              // End SSE stream
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              controller.close()
              return
            }
          }

          // Ensure we close the stream if we didn't encounter a finish_reason
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (error) {
          console.error('Cerebras streaming error:', error)
          controller.error(error)
        }
      },
    })
  } catch (error) {
    console.error('Cerebras streaming setup error:', error)
    throw new Error('Failed to setup streaming with Cerebras')
  }
}

/**
 * Process multi-turn tool use conversation
 * NOTE: Multi-turn tool use is only supported with qwen-3-32b model as per Cerebras documentation
 * @param {ChatMessage[]} messages - Chat messages
 * @param {ChatCompletionOptions} options - Additional options
 * @returns {Promise<ChatCompletion>} Final response after all tool calls
 */
async function processMultiTurnToolUse(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
): Promise<ChatCompletion> {
  const { model = process.env.CEREBRAS_MODEL || 'qwen-3-32b', userId, channel, appId, tools } = options

  // Validate model supports multi-turn tool use
  if (model !== 'qwen-3-32b') {
    throw new Error('Multi-turn tool use is only supported with qwen-3-32b model')
  }

  // Add system message with RAG data
  const systemMessage = createSystemMessage()
  const fullMessages: ChatMessage[] = [systemMessage, ...messages]

  // Available functions for tool execution
  const availableFunctions = functionMap

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await getCerebrasClient().chat.completions.create({
      model,
      messages: fullMessages,
      tools: tools || cerebrasTools,
      max_completion_tokens: 2048,
      temperature: 0.2,
      top_p: 1,
    })

    // Type guard for choices array
    const responseChoices = Array.isArray(response.choices) ? response.choices : []
    const msg = responseChoices[0]?.message

    // If the assistant didn't ask for a tool, we're done
    if (!msg?.tool_calls || msg.tool_calls.length === 0) {
      return response
    }

    // Save the assistant turn exactly as returned
    const assistantMessage: AssistantMessage = {
      role: 'assistant',
      content: msg.content,
      tool_calls: msg.tool_calls,
    }
    fullMessages.push(assistantMessage)

    // Run the requested tool
    const call = msg.tool_calls[0]
    const fname = call.function.name

    if (fname in availableFunctions) {
      const functionArgs = JSON.parse(call.function.arguments)
      const output = await availableFunctions[fname](appId, userId, channel, functionArgs)

      // Feed the tool result back
      const toolMessage: ToolMessage = {
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      }
      fullMessages.push(toolMessage)
    } else {
      throw new Error(`Unknown tool requested: ${fname}`)
    }
  }
}

export { processChatCompletion, processMultiTurnToolUse }
export type { ChatMessage, ChatCompletionOptions, RequestContext }
