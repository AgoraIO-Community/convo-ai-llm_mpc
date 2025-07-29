import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

interface AgoraConfig {
  appId: string
  appCertificate: string
  customerId: string
  customerSecret: string
  authToken: string
  pstnAuthHeader: string
  pstnFromNumber: string
  pstnRegion: string
  pstnApiUrl: string
  pstnUid: string
  sipGateway: string
  convoAiBaseUrl: string
  taskAgentUid: string
}

interface LLMConfig {
  provider: 'OPENAI' | 'CEREBRAS'
  openaiApiKey: string
  model: string
  useResponsesApi: boolean
  cerebrasApiKey: string
  cerebrasModel: string
  useStreaming: boolean
  specializedAgentUrl: string
  specializedAgentApiKey: string
  specializedAgentModel: string
}

interface TTSConfig {
  vendor: string
  elevenlabs: {
    apiKey: string
    modelId: string
    voiceId: string
  }
  microsoft: {
    key: string
    region: string
    voiceName: string
    rate: number
    volume: number
  }
}

interface Config {
  port: number
  agora: AgoraConfig
  llm: LLMConfig
  tts: TTSConfig
  agentId: string
}

function validateEnv(): Config {
  const llmProvider = (process.env.LLM || 'CEREBRAS').toUpperCase() as 'OPENAI' | 'CEREBRAS'

  const baseRequiredEnvVars = [
    'AGORA_APP_ID',
    'AGORA_APP_CERTIFICATE',
    'AGORA_CUSTOMER_ID',
    'AGORA_CUSTOMER_SECRET',
    'AGENT_ID',
  ]

  // Add provider-specific required variables
  const requiredEnvVars = [...baseRequiredEnvVars]

  if (llmProvider === 'OPENAI') {
    requiredEnvVars.push('LLM_API_KEY', 'LLM_MODEL')
  } else if (llmProvider === 'CEREBRAS') {
    requiredEnvVars.push('CEREBRAS_API_KEY', 'CEREBRAS_MODEL')
    // For v4 route, we also need LLM credentials for MCP integration (when using OpenAI Responses API)
    // These are optional warnings, not hard requirements
    if (!process.env.LLM_API_KEY) {
      console.warn('⚠️  LLM_API_KEY not set - v4 route with MCP servers will not work')
    }
    if (!process.env.LLM_MODEL) {
      console.warn('⚠️  LLM_MODEL not set - v4 route will use default model')
    }
  }

  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
  }

  const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    agora: {
      appId: process.env.AGORA_APP_ID!,
      appCertificate: process.env.AGORA_APP_CERTIFICATE!,
      customerId: process.env.AGORA_CUSTOMER_ID!,
      customerSecret: process.env.AGORA_CUSTOMER_SECRET!,
      authToken: `Basic ${Buffer.from(
        `${process.env.AGORA_CUSTOMER_ID!}:${process.env.AGORA_CUSTOMER_SECRET!}`,
      ).toString('base64')}`,
      pstnAuthHeader: process.env.AGORA_PSTN_AUTH_HEADER || '',
      pstnFromNumber: process.env.AGORA_PSTN_FROM_NUMBER || '',
      pstnRegion: process.env.AGORA_PSTN_REGION || '',
      pstnApiUrl: process.env.AGORA_PSTN_API_URL || '',
      pstnUid: process.env.PSTN_UID || '',
      sipGateway: process.env.CUSTOM_SIP_GATEWAY || '',
      // Specialized agent configuration
      convoAiBaseUrl: process.env.AGORA_CONVO_AI_BASE_URL || '',
      taskAgentUid: process.env.TASK_AGENT_UID || '',
    },
    llm: {
      provider: llmProvider,
      openaiApiKey: process.env.LLM_API_KEY || '', // Use generic LLM_API_KEY for any provider
      model: process.env.LLM_MODEL || 'gpt-4o-mini', // Use generic LLM_MODEL for any provider
      useResponsesApi: process.env.USE_RESPONSES_API === 'true',
      cerebrasApiKey: process.env.CEREBRAS_API_KEY || '',
      cerebrasModel: process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
      useStreaming: process.env.USE_STREAMING === 'true',
      // Specialized agent LLM configuration
      specializedAgentUrl: process.env.LLM_URL || '',
      specializedAgentApiKey: process.env.LLM_API_KEY || '',
      specializedAgentModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    },
    // TTS configuration for specialized agents
    tts: {
      vendor: process.env.TTS_VENDOR || 'elevenlabs',
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY || '',
        modelId: process.env.ELEVENLABS_MODEL_ID || '',
        voiceId: process.env.ELEVENLABS_VOICE_ID || '',
      },
      microsoft: {
        key: process.env.MICROSOFT_TTS_KEY || '',
        region: process.env.MICROSOFT_TTS_REGION || '',
        voiceName: process.env.MICROSOFT_TTS_VOICE_NAME || '',
        rate: parseFloat(process.env.MICROSOFT_TTS_RATE || '1.0'),
        volume: parseFloat(process.env.MICROSOFT_TTS_VOLUME || '1.0'),
      },
    },
    agentId: process.env.AGENT_ID!,
  }

  return config
}

export const config = validateEnv()
