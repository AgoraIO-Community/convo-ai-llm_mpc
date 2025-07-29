import { config } from 'dotenv'
// Set test environment variables before any imports
process.env.NODE_ENV = 'test'
process.env.PORT = '3001'

// Required Agora environment variables
process.env.AGORA_APP_ID = process.env.AGORA_APP_ID || 'test-agora-app-id'
process.env.AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || 'test-agora-cert'
process.env.AGORA_CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID || 'test-customer-id'
process.env.AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET || 'test-customer-secret'
process.env.AGENT_ID = process.env.AGENT_ID || 'test-agent-id'

// Required environment variables for specialized voice agents
process.env.AGORA_CONVO_AI_BASE_URL = process.env.AGORA_CONVO_AI_BASE_URL || 'https://test-agora-convo-ai.com/api'
process.env.LLM_URL = process.env.LLM_URL || 'https://test-llm-api.com/v1/chat/completions'
process.env.LLM_API_KEY = process.env.LLM_API_KEY || 'test-llm-api-key'
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-elevenlabs-key'
process.env.ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1'
process.env.ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'test-voice-id'

// Required LLM environment variables
process.env.LLM = process.env.LLM || 'CEREBRAS'
process.env.CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || 'test-cerebras-key'
process.env.CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key'
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Optional environment variables for testing
process.env.PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'test-pinecone-key'
process.env.YELP_API_KEY = process.env.YELP_API_KEY || 'test-yelp-key'
process.env.AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-auth-token-12345'

// Global test timeout
declare const jest: any
if (typeof jest !== 'undefined') {
  jest.setTimeout(10000)
}
