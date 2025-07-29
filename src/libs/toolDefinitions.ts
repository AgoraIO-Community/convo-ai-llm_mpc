// src/libs/toolDefinitions.ts - Function definitions for OpenAI and Cerebras

// Import the official Cerebras Tool type for type safety
import { ChatCompletionCreateParams } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions'

interface FunctionParameter {
  type: string
  properties: Record<
    string,
    {
      type: string
      description: string
    }
  >
  required: string[]
}

interface FunctionDefinition {
  name: string
  description: string
  parameters: FunctionParameter
  responseType: 'affirmation' | 'data' // New field to distinguish tool types
}

/**
 * Function definitions for LLM function calling (OpenAI Compatible)
 */
const functions: FunctionDefinition[] = [
  {
    name: 'order_sandwich',
    description: 'Place a sandwich order with a given filling. Logs the order to console.',
    parameters: {
      type: 'object',
      properties: {
        filling: {
          type: 'string',
          description: "Type of filling (e.g. 'Turkey', 'Ham', 'Veggie')",
        },
      },
      required: ['filling'],
    },
    responseType: 'affirmation',
  },
  {
    name: 'send_photo',
    description: 'Request a photo to be sent. This allows you to send a photo to the user (No arguments needed.)',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    responseType: 'affirmation',
  },
  {
    name: 'call_phone',
    description:
      'Make an outbound phone call to a phone number. The user will receive a phone call that connects them to the current conversation.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Phone number to call in international format (e.g. +1234567890)',
        },
      },
      required: ['to'],
    },
    responseType: 'affirmation',
  },
  {
    name: 'call_hermes_phone',
    description:
      'Call the Hermes support line. This will initiate a phone call to the Hermes support team using a predefined number.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    responseType: 'affirmation',
  },
  {
    name: 'call_sid_phone',
    description:
      'Call Sid Sharma from Agora on his personal cell phone. This will initiate a phone call to Sid Sharma using a predefined number.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    responseType: 'affirmation',
  },
  {
    name: 'search_restaurants_by_category',
    description:
      'Search for restaurants by cuisine type or food category. Returns a concise list with names, ratings, and cuisine types. For detailed info (address, phone, etc.), use get_restaurant_details.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Cuisine category or food type to search for (e.g., "Italian", "Chinese", "Pizza", "Sushi")',
        },
      },
      required: ['category'],
    },
    responseType: 'data',
  },
  {
    name: 'search_restaurants_by_city',
    description:
      'Search for restaurants in a specific city. Returns a concise list with names, ratings, and cuisine types. For detailed info (address, phone, etc.), use get_restaurant_details.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name to search in (e.g., "San Francisco", "Oakland", "Berkeley")',
        },
      },
      required: ['city'],
    },
    responseType: 'data',
  },
  {
    name: 'get_top_rated_restaurants',
    description:
      'Get a concise list of top-rated restaurants with names, ratings, and cuisine types. For detailed info (address, phone, etc.), use get_restaurant_details.',
    parameters: {
      type: 'object',
      properties: {
        minRating: {
          type: 'number',
          description: 'Minimum rating threshold (default 4.8, can be adjusted down to 4.0)',
        },
      },
      required: [],
    },
    responseType: 'data',
  },
  {
    name: 'get_restaurant_details',
    description:
      'Get detailed information about a specific restaurant including address, phone, website, and services. IMPORTANT: Use the COMPLETE restaurant name as mentioned by the user.',
    parameters: {
      type: 'object',
      properties: {
        restaurantName: {
          type: 'string',
          description: 'Complete name of the restaurant to get details for (e.g., "Tony\'s Pizza" not just "Tony")',
        },
      },
      required: ['restaurantName'],
    },
    responseType: 'data',
  },
]

/**
 * Cerebras-compatible tool definitions wraps the functions array
 */
const cerebrasTools: ChatCompletionCreateParams.Tool[] = functions.map((func) => ({
  type: 'function',
  function: {
    name: func.name,
    description: func.description,
    parameters: func.parameters,
    strict: true, // Required by Cerebras
  },
}))

/**
 * Tool response type lookup for determining how to handle tool results
 */
const toolResponseTypes: Record<string, 'affirmation' | 'data'> = functions.reduce((acc, func) => {
  acc[func.name] = func.responseType
  return acc
}, {} as Record<string, 'affirmation' | 'data'>)

export { functions, cerebrasTools, toolResponseTypes }
export type { FunctionDefinition, FunctionParameter }
