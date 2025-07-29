// src/libs/versionedFunctionMap.ts - Version-specific function mappings
import { functionMap as originalFunctionMap, FunctionHandler } from './tools'

// Import yelp-fusion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yelpFusion = require('yelp-fusion') as any // (no official types available from Yelp)

// Import required types and utilities for agent creation
import { RtcTokenBuilder, RtcRole } from 'agora-token'

// Import the callPhone function directly instead of dynamic import
import { callPhone, callHermesPhone, callSidPhone } from './tools'

// Import centralized config
import { config } from './utils'

// Simple in-memory store for agent IDs per channel
const agentStore = new Map<string, { 
  agentId: string, 
  type: string, 
  channel: string, 
  timestamp: number 
}>()

// Store accumulated YELP search results for phone number extraction (indexed by user)
const restaurantIndex = new Map<string, Map<string, {
  name: string,
  phone: string,
  id: string,
  lastSeen: number
}>>()

// Store call action preference per channel
const callActionStore = new Map<string, {
  callAction: string,
  timestamp: number
}>()

// Track active specialized agent calls per channel to prevent duplicate calls
const activeSpecializedAgents = new Map<string, boolean>()

// Store for active polling sessions
const activePollingSessions = new Map<string, {
  agentId: string,
  userId: string,
  channel: string,
  type: string,
  pollCount: number,
  lastStatus: string,
  consecutiveUnchangedCount: number,
  intervalId?: NodeJS.Timeout
}>()

// Store for active polling sessions (using channel as key)
const pollingCallbacks = new Map<string, {
  appId: string,
  userId: string,
  channel: string,
  agentId: string,
  type: string
}>()

// Store conversation context updates that should be available to the LLM
const conversationContext = new Map<string, {
  agentId: string,
  type: string,
  latestStatus: string,
  updates: Array<{
    timestamp: number,
    status: string,
    type: 'UPDATE' | 'COMPLETED' | 'FAILED'
  }>
}>()

// Function to actively update the user with agent progress
async function activelyUpdateUser(
  appId: string,
  userId: string,
  channel: string,
  agentId: string,
  type: string,
  status: string
): Promise<void> {
  try {
    console.log(`🔔 Actively updating user about agent ${agentId} progress`)
    
    // Import the cerebras service here to avoid circular dependencies
    const { processChatCompletion } = await import('../services/cerebrasService')
    const { getToolsForVersion } = await import('./versionedTools')
    
    // Create a system message that instructs the LLM to update the user
    const systemMessage = {
      role: 'system' as const,
      content: `📞 **AUTOMATIC AGENT UPDATE**

Your ${type} agent (${agentId}) has new progress to report:

${status}

**TASK:** Provide a brief, natural update to the user about the agent's progress. Be conversational and helpful. Do NOT mention the agent ID or technical details.

**EXAMPLES:**
- "Your agent just connected to the restaurant and is placing your order now."
- "Great news! Your order is confirmed for $15.50 and will be ready in 20 minutes."
- "The agent is still working on your reservation - I'll keep you posted."

Keep it brief and natural - this is an automatic progress update.`
    }

    // Create a minimal conversation to trigger LLM response
    const messages = [systemMessage]
    
    // Get tools for version v3 (most comprehensive)
    const tools = getToolsForVersion('v3')
    
    // Call the LLM to generate an update for the user
    const response = await processChatCompletion(messages, {
      model: process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
      stream: false,
      channel,
      userId,
      appId,
      tools,
      version: 'v3',
      temperature: 0.3, // Some creativity for natural responses
      max_tokens: 150, // Brief update
    })
    
    console.log(`✅ User actively updated about agent ${agentId} progress`)
    
  } catch (error) {
    console.error('Error actively updating user:', error)
  }
}

// Function to inject agent status updates into conversation context
async function injectStatusIntoConversation(
  appId: string,
  userId: string,
  channel: string,
  agentId: string,
  type: string,
  status: string,
  updateType: 'UPDATE' | 'COMPLETED' | 'FAILED'
): Promise<void> {
  try {
    console.log(`💬 Injecting ${updateType} into conversation context for agent ${agentId}`)
    
    // Store in conversation context for retrieval
    const contextKey = channel
    const existing = conversationContext.get(contextKey)
    
    const update = {
      timestamp: Date.now(),
      status,
      type: updateType
    }
    
    if (existing) {
      existing.latestStatus = status
      existing.updates.push(update)
      // Keep only last 5 updates to avoid memory bloat
      if (existing.updates.length > 5) {
        existing.updates = existing.updates.slice(-5)
      }
    } else {
      conversationContext.set(contextKey, {
        agentId,
        type,
        latestStatus: status,
        updates: [update]
      })
    }
    
    console.log(`✅ Context updated for channel ${channel}: ${updateType}`)
    
  } catch (error) {
    console.error('Error injecting status into conversation:', error)
  }
}

// Function to get conversation context updates for a channel
function getConversationContext(channel: string): string | null {
  const context = conversationContext.get(channel)
  if (!context) return null
  
  const latestUpdate = context.updates[context.updates.length - 1]
  if (!latestUpdate) return null
  
  // Format the context for the LLM
  if (latestUpdate.type === 'COMPLETED') {
    return `🎯 **AGENT TASK COMPLETED**\n\nYour ${context.type} agent (${context.agentId}) successfully completed the task.\n\nFinal Status:\n${context.latestStatus}\n\n✅ Monitoring has been automatically stopped.\n\n**IMPORTANT:** Only provide price and time information that is explicitly confirmed in the conversation above. Do NOT guess or estimate prices.`
  } else if (latestUpdate.type === 'FAILED') {
    return `❌ **AGENT TASK FAILED**\n\nYour ${context.type} agent (${context.agentId}) encountered an issue and could not complete the task.\n\nStatus:\n${context.latestStatus}\n\n🛑 Monitoring has been automatically stopped.\n\n**SUGGESTION:** You may want to try calling the restaurant directly.`
  } else {
    return `📱 **AGENT UPDATE**\n\nYour ${context.type} agent (${context.agentId}) is in progress.\n\nLatest Status:\n${context.latestStatus}\n\n**IMPORTANT:** Only report confirmed details. Do NOT make up or estimate prices or times.`
  }
}

// Function to re-prompt the LLM with agent updates so it can decide when to stop
async function repromptLLMWithUpdate(
  appId: string,
  userId: string,
  channel: string,
  agentId: string,
  type: string,
  status: string
): Promise<void> {
  try {
    console.log(`Re-prompting LLM for agent ${agentId} with new status update`)
    
    // Import the cerebras service here to avoid circular dependencies
    const { processChatCompletion } = await import('../services/cerebrasService')
    const { getToolsForVersion } = await import('./versionedTools')
    
    // Create a system message with the agent update and clear instructions
    const systemMessage = {
      role: 'system' as const,
      content: `🤖 BACKGROUND AGENT STATUS UPDATE - ${type.toUpperCase()}:

Agent ${agentId} conversation progress:
${status}

**CRITICAL INSTRUCTIONS:** 
1. Review this agent conversation carefully
2. If the task appears COMPLETE (order confirmed with total and time, reservation confirmed, question fully answered, polite goodbye exchanged), immediately call stop_agent_polling
3. If you call stop_agent_polling, DO NOT mention stopping, monitoring, or polling to the user - this must be invisible
4. If the task is NOT complete, you may briefly acknowledge the progress to the user

**COMPLETION INDICATORS:**
- Order: Price given + pickup/delivery time confirmed + polite goodbye
- Reservation: Table confirmed + date/time confirmed + polite goodbye  
- Inquiry: Question fully answered + polite goodbye

**IMPORTANT:** This is an automated background check, Do NOT mention stopping or monitoring to the user. Respond naturally as if continuing the conversation.`
    }

    // Create a minimal conversation to trigger LLM decision-making
    const messages = [systemMessage]
    
    // Get tools for version v3 (most comprehensive)
    const tools = getToolsForVersion('v3')
    
    // Call the LLM in background with the update
    await processChatCompletion(messages, {
      model: process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
      stream: false,
      channel,
      userId,
      appId,
      tools,
      version: 'v3',
      temperature: 0.1, // Low temperature for consistent decision-making
      max_tokens: 200, // Short response
    })
    
    console.log(`Successfully re-prompted LLM for agent ${agentId}`)
    
  } catch (error) {
    console.error('Error re-prompting LLM with update:', error)
  }
}

// Function to determine if a status update is significant enough to re-prompt
function isSignificantUpdate(newStatus: string, oldStatus: string): boolean {
  if (oldStatus === 'STARTING') return true
  
  const newLower = newStatus.toLowerCase()
  const oldLower = oldStatus.toLowerCase()
  
  // Enhanced completion detection phrases
  const significantPhrases = [
    'restaurant:',
    'agent:',
    'order confirmed',
    'reservation confirmed',
    'total is',
    '$', // Price mentions
    'pickup time',
    'delivery time',
    'ready in',
    'minutes',
    'hours',
    'closed',
    'unavailable',
    'error',
    'problem',
    'thank you',
    'thanks',
    'goodbye',
    'good bye',
    'have a great day',
    'have a wonderful day',
    'appreciate it',
    'perfect',
    'sounds good',
    'all set'
  ]
  
  // Check for completion indicators specifically
  const completionPhrases = [
    'thank you',
    'thanks', 
    'appreciate it',
    'perfect',
    'all set',
    'goodbye',
    'good bye',
    'have a great',
    'sounds good'
  ]
  
  const hasCompletion = completionPhrases.some(phrase => newLower.includes(phrase))
  const hasPricing = newLower.includes('$') || newLower.includes('total')
  const hasTime = newLower.includes('ready in') || newLower.includes('minutes') || newLower.includes('hours')
  
  // If new status contains phrases that old status didn't, it's significant
  const isSignificant = significantPhrases.some(phrase => 
    newLower.includes(phrase) && !oldLower.includes(phrase)
  ) || Math.abs(newStatus.length - oldStatus.length) > 100 // Significant length change
  
  // Log completion indicators for debugging
  if (hasCompletion || (hasPricing && hasTime)) {
    console.log(`🎯 COMPLETION INDICATORS DETECTED: hasCompletion=${hasCompletion}, hasPricing=${hasPricing}, hasTime=${hasTime}`)
  }
  
  return isSignificant
}

// Function to manually stop polling for a specific agent
async function stopAgentPolling(
  appId: string,
  userId: string,
  channel: string,
  args: { agent_id?: string, reason?: string }
): Promise<string> {
  // If no agent_id provided, find the latest active session for this channel
  let agentId = args.agent_id
  let sessionKey = ''
  
  if (!agentId) {
    // Find active session by channel
    for (const [key, session] of activePollingSessions.entries()) {
      if (session.channel === channel) {
        sessionKey = key
        agentId = session.agentId
        break
      }
    }
    if (!agentId) {
      return 'No active agent found to stop.'
    }
  } else {
    sessionKey = `${channel}-${agentId}`
  }

  const session = activePollingSessions.get(sessionKey)
  
  if (!session) {
    return `No active polling session found for agent ${agentId}.`
  }

  // Stop the polling
  if (session.intervalId) {
    clearInterval(session.intervalId)
  }
  
  activePollingSessions.delete(sessionKey)
  
  const reason = args.reason || 'manually stopped'
  console.log(`Stopped polling for agent ${agentId}. Reason: ${reason}`)
  
  // Clean up polling callback
  pollingCallbacks.delete(channel)
  
  // Clear the active specialized agent flag to allow new calls
  activeSpecializedAgents.delete(channel)
  
  return `✅ Stopped monitoring agent ${agentId}. Reason: ${reason}`
}

// Function to start automatic polling for agent status
async function startAgentPolling(
  appId: string,
  userId: string,
  channel: string,
  agentId: string,
  type: string
): Promise<void> {
  const sessionKey = `${channel}-${agentId}`
  
  // Clear any existing polling for this session
  const existing = activePollingSessions.get(sessionKey)
  if (existing?.intervalId) {
    clearInterval(existing.intervalId)
  }

  // Initialize polling session
  activePollingSessions.set(sessionKey, {
    agentId,
    userId,
    channel,
    type,
    pollCount: 0,
    lastStatus: 'STARTING',
    consecutiveUnchangedCount: 0
  })

  console.log(`✅ Agent ${agentId} (${type}) created in channel ${channel}`)
  console.log(`🔧 Auto-polling DISABLED - Use get_latest_agent_status to check progress manually`)

  // Store agent info for manual status checks only
  pollingCallbacks.set(channel, {
    appId,
    userId,
    channel,
    agentId,
    type
  })
}

// Clean polling architecture - no more update wrapping needed

// Function to store agent information
function storeAgentInfo(userId: string, agentId: string, type: string, channel: string) {
  agentStore.set(userId, {
    agentId,
    type,
    channel,
    timestamp: Date.now()
  })
  console.log(`Stored agent info for user ${userId}:`, { agentId, type, channel })
}

// Function to get the latest agent for a user
function getLatestAgent(userId: string) {
  return agentStore.get(userId)
}

// Function to store YELP search results (accumulates instead of overwrites)
function storeYelpResults(userId: string, results: Array<{ name: string, phone: string, id: string }>) {
  if (!restaurantIndex.has(userId)) {
    restaurantIndex.set(userId, new Map())
  }
  
  const userIndex = restaurantIndex.get(userId)!
  let newCount = 0
  
  results.forEach(result => {
    // Use restaurant ID as key to avoid duplicates
    if (result.phone && !userIndex.has(result.id)) {
      userIndex.set(result.id, {
        name: result.name,
        phone: result.phone,
        id: result.id,
        lastSeen: Date.now()
      })
      newCount++
    } else if (result.phone && userIndex.has(result.id)) {
      // Update lastSeen timestamp for existing entries
      const existing = userIndex.get(result.id)!
      existing.lastSeen = Date.now()
    }
  })
  
  console.log(`Added ${newCount} new restaurants to index for user ${userId}. Total indexed: ${userIndex.size}`)
}

// Function to find phone number for a restaurant name
function findPhoneNumber(userId: string, restaurantName: string): string | null {
  const userIndex = restaurantIndex.get(userId)
  if (!userIndex || userIndex.size === 0) {
    console.log(`No restaurant index found for user ${userId}`)
    return null
  }
  
  const normalizedSearchName = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Search through all indexed restaurants
  for (const restaurant of userIndex.values()) {
    const normalizedResultName = restaurant.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalizedResultName.includes(normalizedSearchName) || normalizedSearchName.includes(normalizedResultName)) {
      console.log(`Found phone number for "${restaurantName}": ${restaurant.phone} (from index of ${userIndex.size} restaurants)`)
      return restaurant.phone
    }
  }
  
  console.log(`No phone number found for "${restaurantName}" in index of ${userIndex.size} restaurants`)
  return null
}

// Function to store call action preference using channel as key
function storeCallAction(channel: string, callAction: string) {
  if (!channel) {
    console.log('Cannot store call action: no channel provided')
    return
  }
  callActionStore.set(channel, {
    callAction,
    timestamp: Date.now()
  })
  console.log(`Stored call action for channel ${channel}: ${callAction}`)
}

// Function to get call action preference (with fallback) using channel as key
function getCallAction(channel: string): string {
  if (!channel) {
    console.log('Cannot get call action: no channel provided, using default')
    return 'call_hermes' // Default fallback
  }
  
  const stored = callActionStore.get(channel)
  if (stored) {
    // Clean up old entries (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    if (stored.timestamp < oneHourAgo) {
      callActionStore.delete(channel)
      console.log(`Call action expired for ${channel}, using default`)
      return 'call_hermes' // Default fallback
    }
    console.log(`Retrieved call action for ${channel}: ${stored.callAction}`)
    return stored.callAction
  }
  console.log(`No call action found for ${channel}, using default`)
  return 'call_hermes' // Default fallback
}

// Function to retrieve specialized agent conversation history
async function getSpecializedAgentStatus(
  appId: string,
  userId: string,
  channel: string,
  args: { agent_id?: string },
): Promise<string> {
  // If no agent_id provided, get the latest agent for this user
  let agentId = args.agent_id
  
  if (!agentId) {
    const latestAgent = getLatestAgent(userId)
    if (latestAgent) {
      agentId = latestAgent.agentId
      console.log(`Using stored agent ID for user ${userId}: ${agentId}`)
    } else {
      return 'No active agent found. Please create a specialized agent first (order, reservation, or inquiry).'
    }
  }

  console.log(`Retrieving conversation history for agent: ${agentId}`)

  const agoraConfig = getAgoraConfig()
  
  if (!agoraConfig.baseUrl) {
    return 'Error: Agora Conversational AI service not configured. Please set AGORA_CONVO_AI_BASE_URL environment variable.'
  }

  try {
    // Construct history API URL - ensure we don't duplicate the path
    let historyBaseUrl = agoraConfig.baseUrl
    if (!historyBaseUrl.includes('/api/conversational-ai-agent/')) {
      historyBaseUrl = historyBaseUrl.replace('/v2/projects', '/api/conversational-ai-agent/v2/projects')
    }
    const historyUrl = `${historyBaseUrl}/${agoraConfig.appId}/agents/${agentId}/history`
    
    console.log(`Fetching agent history from: ${historyUrl}`)
    
    const response = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${agoraConfig.customerId}:${agoraConfig.customerSecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      if (response.status === 404) {
        return `Agent ${agentId} not found. The agent may have completed its task or the ID might be incorrect.`
      }
      const errorText = await response.text()
      console.error('Agent history API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      return `Error retrieving agent status: ${response.status} ${response.statusText}`
    }

    const historyData = await response.json() as {
      agent_id?: string
      start_ts?: number
      status?: string
      contents?: Array<{ role: string; content: string }>
    }
    console.log(`Agent history retrieved:`, historyData)

    // Format the conversation history for the LLM
    if (!historyData.contents || historyData.contents.length === 0) {
      return `Agent ${agentId} status: ${historyData.status || 'UNKNOWN'}

No conversation history available yet. The agent may still be connecting to the call or waiting for someone to answer.`
    }

    // Extract meaningful conversation updates
    const conversation = historyData.contents
      .map((message) => {
        const role = message.role === 'assistant' ? 'Agent' : 'Restaurant'
        return `${role}: ${message.content}`
      })
      .join('\n')

    const summary = historyData.contents.length > 0 ? 
      `The conversation is ${historyData.status === 'RUNNING' ? 'active' : 'completed'} with ${historyData.contents.length} messages exchanged.` :
      'The call is starting.'

    return `Agent ${agentId} Status Update:

${summary}

Recent Conversation:
${conversation}

Status: ${historyData.status || 'RUNNING'}
Started: ${historyData.start_ts ? new Date(historyData.start_ts * 1000).toLocaleTimeString() : 'Unknown'}`

  } catch (error) {
    console.error('Error retrieving agent history:', error)
    
    if (error instanceof Error && error.name === 'AbortError') {
      return `Error: Request timed out while checking agent ${agentId} status. Please try again.`
    }
    
    return `Error checking agent ${agentId} status: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Helper function to extract city name from location string
function extractCityName(location: string): string {
  // Extract city name (everything before the first comma or state abbreviation)
  const cityMatch = location.match(/^([^,]+)/)
  return cityMatch ? cityMatch[1].trim().toLowerCase() : location.toLowerCase()
}

// Helper function to extract city area from display_address for suggestions (no street address)
function getCityAreaForSuggestions(business: any): string {
  const displayAddress = business.location?.display_address || []
  if (displayAddress.length === 0) return 'Location not available'
  
  // For suggestions, show city and state only (last item is usually "City, State ZIP")
  const lastItem = displayAddress[displayAddress.length - 1]
  if (lastItem && lastItem.includes(',')) {
    // Extract just "City, State" without ZIP
    const cityStateMatch = lastItem.match(/^([^,]+,\s*[A-Z]{2})/)
    return cityStateMatch ? cityStateMatch[1] : lastItem
  }
  
  // Fallback: show the last item or city
  return lastItem || business.location?.city || 'Location not available'
}

// Helper function to check if business is in the requested city
function isInRequestedCity(business: any, requestedLocation: string): boolean {
  const requestedCity = extractCityName(requestedLocation)
  const businessCity = business.location?.city?.toLowerCase() || ''

  // Also check display_address for city match
  const displayAddress = business.location?.display_address?.join(', ').toLowerCase() || ''

  return businessCity.includes(requestedCity) || displayAddress.includes(requestedCity)
}

// YELP API integration functions for v3 (matching your scraper approach)
async function searchYelpRestaurants(
  appId: string,
  userId: string,
  channel: string,
  args: { location: string; term?: string; limit?: number },
): Promise<string> {
  console.log(`Searching YELP for restaurants in ${args.location} with term: ${args.term || 'restaurants'}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)

    // Use your filtering criteria
    const minRating = 3.5
    const minReviewCount = 20
    const searchLimit = args.limit || 10

    // Map common search terms to your category aliases
    const categoryMap: Record<string, string> = {
      pizza: 'pizza',
      sushi: 'sushi',
      chinese: 'chinese',
      italian: 'italian',
      mexican: 'mexican',
      thai: 'thai',
      indian: 'indian',
      coffee: 'coffee',
      burgers: 'burgers',
      asian: 'asianfusion',
      brunch: 'brunch',
      sandwiches: 'sandwiches',
      bars: 'bars',
      vegan: 'vegan',
      mediterranean: 'mediterranean',
    }

    const searchCategory = categoryMap[args.term?.toLowerCase() || 'restaurants'] || args.term || 'restaurants'

    const searchParams: any = {
      location: args.location,
      categories: searchCategory,
      sort_by: 'rating',
      limit: Math.min(searchLimit * 3, 50), // Get more to filter by location
    }

    const response = await yelp.search(searchParams)
    const businesses = response.jsonBody.businesses || []

    // Apply quality filters first
    const qualityFiltered = businesses.filter(
      (business: any) => business.rating >= minRating && business.review_count >= minReviewCount,
    )

    // Prioritize businesses in the exact city
    const inCity = qualityFiltered.filter((business: any) => isInRequestedCity(business, args.location))
    const nearbyCity = qualityFiltered.filter((business: any) => !isInRequestedCity(business, args.location))

    // Combine with city businesses first, then nearby if needed
    const prioritizedBusinesses = [...inCity, ...nearbyCity].slice(0, searchLimit)

    if (prioritizedBusinesses.length === 0) {
      return `No restaurants found in ${args.location} matching "${
        args.term || 'your search'
      }" with our quality filters (${minRating}+ stars, ${minReviewCount}+ reviews). Try a broader search term or different location.`
    }

    // Format results for suggestions (no street addresses, just city/area)
    const results = prioritizedBusinesses
      .map((business: any) => {
        const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Restaurant'
        const cityArea = getCityAreaForSuggestions(business)
        const price = business.price || '$'
        const phone = business.phone || business.display_phone || 'Phone not listed'
        const status = business.is_closed ? 'Currently closed' : 'Open'

        return `${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}
Area: ${cityArea}
Phone: ${phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${status}`
      })
      .join('\n\n')

    const cityCount = inCity.length
    const locationNote =
      cityCount > 0 && cityCount < prioritizedBusinesses.length
        ? `\n\n📍 Showing ${cityCount} in ${extractCityName(args.location)} and ${prioritizedBusinesses.length - cityCount} nearby.`
        : ''

    // Store results for phone number lookup
    const yelpResults = prioritizedBusinesses.map((business: any) => ({
      name: business.name,
      phone: business.phone || business.display_phone || '',
      id: business.id
    }))
    storeYelpResults(userId, yelpResults)

    const result = `Found ${prioritizedBusinesses.length} quality restaurants:\n\n${results}${locationNote}\n\n💡 Use get_yelp_restaurant_details with an ID for more info.`
    return result
  } catch (error) {
    console.error('YELP API search error:', error)
    const errorResult = `Error searching restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
    return errorResult
  }
}

async function getYelpRestaurantDetails(
  appId: string,
  userId: string,
  channel: string,
  args: { business_id: string },
): Promise<string> {
  console.log(`Getting YELP details for business ID: ${args.business_id}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)
    const response = await yelp.business(args.business_id)
    const business = response.jsonBody

    // Format detailed business information more concisely
    const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Restaurant'
    const address = business.location?.display_address?.join(', ') || 'Address not available'
    const price = business.price || 'Price not listed'
    const phone = business.phone || business.display_phone || 'Phone not listed'

    // Format hours if available
    let hoursInfo = 'Hours not available'
    if (business.hours && business.hours[0]?.open) {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const hours = business.hours[0].open
        .map((h: any) => {
          const start = `${h.start.slice(0, 2)}:${h.start.slice(2)}`
          const end = `${h.end.slice(0, 2)}:${h.end.slice(2)}`
          return `${dayNames[h.day]}: ${start}-${end}`
        })
        .join('\n')
      hoursInfo = hours
    }

    const isOpen = business.is_closed === false ? 'Currently Open' : 'Currently Closed'
    const website = business.url ? `🔗 ${business.url}` : ''

    const result = `**${business.name}**
${business.rating}⭐ (${business.review_count} reviews) • ${price}
${categories}

${isOpen}
📞 ${phone}
${website}

Location: ${address}
${business.location?.cross_streets ? `Near: ${business.location.cross_streets}` : ''}

⏰ **Hours:**
${hoursInfo}`
    return result
  } catch (error) {
    console.error('YELP API details error:', error)
    const errorResult = `Error getting restaurant details: ${error instanceof Error ? error.message : 'Unknown error'}`
    return errorResult
  }
}

// Get user reviews and comments for a restaurant
async function getYelpRestaurantReviews(
  appId: string,
  userId: string,
  channel: string,
  args: { business_id: string },
): Promise<string> {
  console.log(`Getting YELP reviews for business ID: ${args.business_id}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  // Validate business_id format
  if (!args.business_id || args.business_id.trim() === '') {
    return 'Error: No business ID provided. Please use a business ID from a search result.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)
    console.log(`Making YELP reviews API call for: ${args.business_id}`)
    const response = await yelp.reviews(args.business_id)
    console.log(`YELP reviews API response status: ${response.statusCode}`)
    const reviewsData = response.jsonBody

    if (!reviewsData.reviews || reviewsData.reviews.length === 0) {
      return `No reviews available for this restaurant.`
    }

    const reviews = reviewsData.reviews
      .map((review: any, index: number) => {
        const rating = '⭐'.repeat(review.rating)
        const userName = review.user?.name || 'Anonymous'
        const userImage = review.user?.image_url ? '👤' : ''

        return `**Review ${index + 1}** (${rating} ${review.rating}/5)
${userImage} By: ${userName}
"${review.text}"
${review.url ? `🔗 Read full review: ${review.url}` : ''}`
      })
      .join('\n\n')

    return `**Customer Reviews:**

${reviews}

💡 These are recent user reviews from YELP. Total reviews for this business: ${reviewsData.total || 'N/A'}`
  } catch (error) {
    console.error('YELP API reviews error for business_id:', args.business_id)
    console.error('Full error details:', error)

    // Check if it's a client error response
    if (error && typeof error === 'object' && 'statusCode' in error) {
              console.error('API Status Code:', (error as { statusCode?: number }).statusCode)
        console.error('API Response:', (error as { response?: { body?: unknown } }).response?.body)
    }

    // Handle specific error cases
    if (error instanceof Error && error.message.includes('404')) {
      return `Sorry, I couldn't retrieve reviews for this restaurant. The business may not have reviews available through the API, or the business ID "${args.business_id}" might be incorrect.`
    }

    return `I apologize, but I'm unable to access reviews for this restaurant at the moment. Error details: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later or use get_yelp_restaurant_details for other information about the business.`
  }
}

// Improved phone search function
async function searchYelpByPhone(
  appId: string,
  userId: string,
  channel: string,
  args: { phone: string },
): Promise<string> {
  console.log(`Searching YELP by phone: ${args.phone}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)
    const response = await yelp.phoneSearch({ phone: args.phone })
    const businesses = response.jsonBody.businesses || []

    if (businesses.length === 0) {
      return `No businesses found with phone number ${args.phone}.`
    }

    const results = businesses
      .map((business: any) => {
        const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Business'
        const cityArea = getCityAreaForSuggestions(business)
        const price = business.price || 'Price not listed'
        const status = business.is_closed ? 'Currently closed' : 'Open'

        return `${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}
Area: ${cityArea}
Phone: ${business.display_phone || business.phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${status}`
      })
      .join('\n\n')

    return `Found ${businesses.length} business(es):\n\n${results}\n\n💡 Use get_yelp_restaurant_details with an ID for more info.`
  } catch (error) {
    console.error('YELP phone search error:', error)
    return `Error searching by phone: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Improved business match function with fuzzy search fallback
async function matchYelpBusiness(
  appId: string,
  userId: string,
  channel: string,
  args: { name: string; address1: string; city: string; state: string; country: string },
): Promise<string> {
  console.log(`Matching YELP business: ${args.name} at ${args.address1}, ${args.city}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)

    // Try exact business match first
    try {
      const response = await yelp.businessMatch({
        name: args.name,
        address1: args.address1,
        city: args.city,
        state: args.state,
        country: args.country,
      })
      const businesses = response.jsonBody.businesses || []

      if (businesses.length > 0) {
        const business = businesses[0]
        const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Business'
        const address = business.location?.display_address?.join(', ') || 'Address not available'
        const price = business.price || 'Price not listed'
        const phone = business.phone || business.display_phone || 'Phone not listed'

        return `✅ **Exact Match Found:**

${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}
Location: ${address}
Phone: ${phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${business.is_closed ? 'Currently closed' : 'Open'}

💡 Use get_yelp_restaurant_details with ID "${business.id}" for full details.`
      }
    } catch (matchError) {
      console.log('Exact match failed, trying search fallback')
    }

    // Fallback to general search if exact match fails
    const searchResponse = await yelp.search({
      term: args.name,
      location: `${args.city}, ${args.state}`,
      limit: 5,
    })

    const searchBusinesses = searchResponse.jsonBody.businesses || []
    const nameMatches = searchBusinesses.filter(
      (business: any) =>
        business.name.toLowerCase().includes(args.name.toLowerCase()) ||
        args.name.toLowerCase().includes(business.name.toLowerCase()),
    )

    if (nameMatches.length > 0) {
      const results = nameMatches
        .slice(0, 3)
        .map((business: any) => {
          const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Business'
          const address = business.location?.display_address?.join(', ') || 'Address not available'
          const price = business.price || 'Price not listed'
          const phone = business.phone || business.display_phone || 'Phone not listed'
          const status = business.is_closed ? 'Currently closed' : 'Open'

          return `${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}
Location: ${address}
Phone: ${phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${status}`
        })
        .join('\n\n')

      return `Found ${nameMatches.length} similar businesses:\n\n${results}\n\n💡 Use get_yelp_restaurant_details with an ID for more info.`
    }

    return `No exact match found for "${args.name}" in ${args.city}, ${args.state}. Try a general search instead.`
  } catch (error) {
    console.error('YELP business match error:', error)
    return `Error matching business: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Pinecone integration functions for v2
import {
  searchPineconeRestaurants as searchPineconeRestaurantsService,
  getPineconeRagService,
} from '../services/pineconeRagService'

async function searchPineconeRestaurants(
  appId: string,
  userId: string,
  channel: string,
  args: { query: string; limit?: number },
): Promise<string> {
  console.log(`Searching Pinecone for restaurants with query: ${args.query}`)

  try {
    const topK = Math.min(args.limit || 5, 20) // Limit to reasonable number
    return await searchPineconeRestaurantsService(args.query, topK)
  } catch (error) {
    console.error('Pinecone search error:', error)
    return `Error searching restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

async function searchPineconeByCategory(
  appId: string,
  userId: string,
  channel: string,
  args: { category: string; limit?: number },
): Promise<string> {
  console.log(`Searching Pinecone for ${args.category} restaurants`)

  try {
    const service = getPineconeRagService()
    if (!service.isConfigured()) {
      return 'Pinecone integration not configured. Please set PINECONE_API_KEY and other required environment variables.'
    }

    const topK = Math.min(args.limit || 10, 20)
    const results = await service.searchByCategory(args.category, topK)

    if (results.length === 0) {
      return `No ${args.category} restaurants found in the database.`
    }

    const formattedResults = results
      .map((restaurant, index) => {
        return `${index + 1}. **${restaurant.name}** (${restaurant.categories})
   📍 ${restaurant.location}
   ⭐ ${restaurant.rating} | 💰 ${restaurant.price_range}
   📞 ${restaurant.phone}
   🔗 Match: ${(restaurant.score * 100).toFixed(1)}%`
      })
      .join('\n\n')

    return `Found ${results.length} ${args.category} restaurants:\n\n${formattedResults}`
  } catch (error) {
    console.error('Pinecone category search error:', error)
    return `Error searching ${args.category} restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

async function searchPineconeByMood(
  appId: string,
  userId: string,
  channel: string,
  args: { mood: string; limit?: number },
): Promise<string> {
  console.log(`Searching Pinecone for restaurants matching mood: ${args.mood}`)

  try {
    const service = getPineconeRagService()
    if (!service.isConfigured()) {
      return 'Pinecone integration not configured. Please set PINECONE_API_KEY and other required environment variables.'
    }

    const topK = Math.min(args.limit || 10, 20)
    const results = await service.searchByMood(args.mood, topK)

    if (results.length === 0) {
      return `No restaurants found matching the mood "${args.mood}".`
    }

    const formattedResults = results
      .map((restaurant, index) => {
        return `${index + 1}. **${restaurant.name}** (${restaurant.categories})
   📍 ${restaurant.location}
   ⭐ ${restaurant.rating} | 💰 ${restaurant.price_range}
   📞 ${restaurant.phone}
   🔗 Match: ${(restaurant.score * 100).toFixed(1)}%`
      })
      .join('\n\n')

    return `Found ${results.length} restaurants for "${args.mood}":\n\n${formattedResults}`
  } catch (error) {
    console.error('Pinecone mood search error:', error)
    return `Error searching restaurants for mood "${args.mood}": ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
  }
}

// Direct business name search function
async function searchYelpByName(
  appId: string,
  userId: string,
  channel: string,
  args: { name: string; location: string; limit?: number },
): Promise<string> {
  console.log(`Searching for business name: "${args.name}" in ${args.location}`)

  // First check if restaurant already exists in our index
  const existingPhone = findPhoneNumber(userId, args.name)
  if (existingPhone) {
    const userIndex = restaurantIndex.get(userId)!
    
    // Find the full restaurant data from index
    const normalizedSearchName = args.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const restaurant of userIndex.values()) {
      const normalizedResultName = restaurant.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (normalizedResultName.includes(normalizedSearchName) || normalizedSearchName.includes(normalizedResultName)) {
        console.log(`Found "${args.name}" in existing index - skipping YELP API call`)
        
        const categories = 'Restaurant' // We don't store categories in index, but that's ok
        const price = '$$' // Default price range
        const status = 'Open' // Assume open
        
        return `Found 1 businesses matching "${args.name}" (from cache):

${restaurant.name} (ID: ${restaurant.id})
Rating: N/A⭐ (cached result)
Categories: ${categories}
Price Range: ${price}
Area: ${args.location}
Phone: ${restaurant.phone}
Services: pickup, delivery
Status: ${status}

💡 Use get_yelp_restaurant_details with an ID for more info.`
      }
    }
  }

  console.log(`"${args.name}" not found in index - calling YELP API`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)

    const response = await yelp.search({
      term: args.name,
      location: args.location,
      sort_by: 'best_match',
      limit: Math.min(args.limit || 10, 20),
    })

    const businesses = response.jsonBody.businesses || []

    // Filter for name matches (fuzzy matching)
    const nameMatches = businesses.filter((business: any) => {
      const businessName = business.name.toLowerCase()
      const searchName = args.name.toLowerCase()

      // Check for partial matches in both directions
      return (
        businessName.includes(searchName) ||
        searchName.includes(businessName) ||
        businessName.replace(/[^a-z0-9]/g, '').includes(searchName.replace(/[^a-z0-9]/g, ''))
      )
    })

    // Prioritize businesses in the exact city
    const inCity = nameMatches.filter((business: any) => isInRequestedCity(business, args.location))
    const nearbyCity = nameMatches.filter((business: any) => !isInRequestedCity(business, args.location))

    const prioritizedBusinesses = [...inCity, ...nearbyCity].slice(0, args.limit || 10)

    if (prioritizedBusinesses.length === 0) {
      return `No businesses found with name similar to "${args.name}" in ${args.location}. Try a broader search term.`
    }

    const results = prioritizedBusinesses
      .map((business: any) => {
        const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Business'
        const cityArea = getCityAreaForSuggestions(business)
        const price = business.price || 'Price not listed'
        const phone = business.phone || business.display_phone || 'Phone not listed'
        const status = business.is_closed ? 'Currently closed' : 'Open'

        return `${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}
Area: ${cityArea}
Phone: ${phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${status}`
      })
      .join('\n\n')

    const cityCount = inCity.length
    const locationNote =
      cityCount > 0 && cityCount < prioritizedBusinesses.length
        ? `\n\n📍 Showing ${cityCount} in ${extractCityName(args.location)} and ${prioritizedBusinesses.length - cityCount} nearby.`
        : ''

    // Store results for phone number lookup
    const yelpResults = prioritizedBusinesses.map((business: any) => ({
      name: business.name,
      phone: business.phone || business.display_phone || '',
      id: business.id
    }))
    storeYelpResults(userId, yelpResults)

    return `Found ${prioritizedBusinesses.length} businesses matching "${args.name}":\n\n${results}${locationNote}\n\n💡 Use get_yelp_restaurant_details with an ID for more info.`
  } catch (error) {
    console.error('YELP name search error:', error)
    return `Error searching for "${args.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Advanced search function for flexible queries
async function searchYelpAdvanced(
  appId: string,
  userId: string,
  channel: string,
  args: { query: string; location?: string; limit?: number },
): Promise<string> {
  console.log(`Advanced YELP search for: "${args.query}" in ${args.location || 'user location'}`)

  const yelpApiKey = process.env.YELP_API_KEY
  if (!yelpApiKey) {
    return 'YELP API integration not configured. Please set YELP_API_KEY environment variable.'
  }

  try {
    const yelp = yelpFusion.client(yelpApiKey)
    const searchLocation = args.location || 'San Francisco, CA'

    const response = await yelp.search({
      term: args.query,
      location: searchLocation,
      sort_by: 'rating',
      limit: Math.min(args.limit || 10, 25),
    })

    const businesses = response.jsonBody.businesses || []

    // Apply quality filters
    const qualityBusinesses = businesses.filter(
      (business: any) => business.rating >= 3.5 && business.review_count >= 20,
    )

    if (qualityBusinesses.length === 0) {
      return `No restaurants found matching "${args.query}" in ${searchLocation} with our quality standards. Try a different search term.`
    }

    const results = qualityBusinesses
      .map((business: any) => {
        const categories = business.categories?.map((cat: any) => cat.title).join(', ') || 'Restaurant'
        const price = business.price || '$'
        const distance = business.distance ? `${(business.distance / 1609.34).toFixed(1)} mi` : ''
        const cityArea = getCityAreaForSuggestions(business)
        const phone = business.phone || business.display_phone || 'Phone not listed'
        const status = business.is_closed ? 'Currently closed' : 'Open'

        return `${business.name} (ID: ${business.id})
Rating: ${business.rating}⭐ (${business.review_count} reviews)
Categories: ${categories}
Price Range: ${price}${distance ? ` • Distance: ${distance}` : ''}
Area: ${cityArea}
Phone: ${phone}
Services: ${business.transactions?.join(', ') || 'None specified'}
Status: ${status}`
      })
      .join('\n\n')

    return `Found ${qualityBusinesses.length} matches for "${args.query}":\n\n${results}\n\n💡 Use get_yelp_restaurant_details with an ID for more info.`
  } catch (error) {
    console.error('YELP advanced search error:', error)
    return `Sorry, I couldn't search for "${args.query}" right now. Please try again.`
  }
}

// Helper function to get Agora configuration
function getAgoraConfig() {
  return {
    baseUrl: config.agora.convoAiBaseUrl,
    appId: config.agora.appId,
    appCertificate: config.agora.appCertificate,
    customerId: config.agora.customerId,
    customerSecret: config.agora.customerSecret,
    taskAgentUid: config.agora.taskAgentUid,
    pstnUid: config.agora.pstnUid,
  }
}

// Function to get the latest agent status (simpler version without requiring agent_id)
async function getLatestAgentStatus(
  appId: string,
  userId: string,
  channel: string,
): Promise<string> {
  // First check if we have conversation context (from polling updates)
  const contextInfo = getConversationContext(channel)
  if (contextInfo) {
    console.log(`📱 Returning stored conversation context for channel ${channel}`)
    return contextInfo
  }
  
  // Fall back to direct API call if no context available
  console.log(`🔍 No stored context, fetching live status for channel ${channel}`)
  const result = await getSpecializedAgentStatus(appId, userId, channel, {})
  return result
}

// Function to get latest automatic updates from active specialized agents
async function getLatestAgentUpdates(
  appId: string,
  userId: string,
  channel: string,
): Promise<string> {
  // Check if there are active sessions for this channel
  const activeSessions = Array.from(activePollingSessions.entries())
    .filter(([key, session]) => session.channel === channel)
  
  if (activeSessions.length === 0) {
    return 'No active agent monitoring sessions found.'
  }
  
  return `🔄 Monitoring ${activeSessions.length} active agent(s). Updates are automatically processed in the background.`
}

// Function to get polling status (for debugging)
async function getPollingStatus(
  appId: string,
  userId: string,
  channel: string,
): Promise<string> {
  const sessions = Array.from(activePollingSessions.entries())
    .map(([key, session]) => ({
      key,
      agentId: session.agentId,
      type: session.type,
      pollCount: session.pollCount,
      lastStatus: session.lastStatus,
      channel: session.channel
    }))
  
  // Get conversation context for this channel
  const context = conversationContext.get(channel)
  
  let result = `🔍 **POLLING DEBUG INFO**\n\n`
  
  if (sessions.length === 0) {
    result += '❌ No active polling sessions.\n'
  } else {
    result += `✅ Active polling sessions: ${sessions.length}\n\n`
    const sessionInfo = sessions.map(s => 
      `Agent ${s.agentId} (${s.type}):\n  • Key: ${s.key}\n  • Polls: ${s.pollCount}\n  • Channel: ${s.channel}\n  • Status: ${s.lastStatus.substring(0, 150)}...`
    ).join('\n\n')
    result += sessionInfo + '\n\n'
  }
  
  if (context) {
    result += `💬 **CONVERSATION CONTEXT** (${channel}):\n`
    result += `  • Agent: ${context.agentId} (${context.type})\n`
    result += `  • Updates: ${context.updates.length}\n`
    result += `  • Latest: ${context.latestStatus.substring(0, 200)}...\n`
    const lastUpdate = context.updates[context.updates.length - 1]
    if (lastUpdate) {
      result += `  • Last update type: ${lastUpdate.type}\n`
    }
  } else {
    result += `❌ No conversation context for channel ${channel}\n`
  }
  
  return result
}

// Function to show indexed restaurants for debugging
async function getIndexedRestaurants(
  userId: string,
): Promise<string> {
  const userIndex = restaurantIndex.get(userId)
  if (!userIndex || userIndex.size === 0) {
    return 'No restaurants currently indexed. Perform a search to build the restaurant index.'
  }

  const restaurants = Array.from(userIndex.values())
    .sort((a, b) => b.lastSeen - a.lastSeen) // Sort by most recently seen
    .slice(0, 20) // Limit to 20 most recent
    .map(restaurant => `• ${restaurant.name} (ID: ${restaurant.id}) - Phone: ${restaurant.phone}`)
    .join('\n')

  return `Currently indexed restaurants (${userIndex.size} total, showing 20 most recent):\n\n${restaurants}\n\n💡 These restaurants can be used for orders without additional searches.`
}

// Helper function to get LLM configuration
function getLLMConfig() {
  return {
    url: config.llm.specializedAgentUrl,
    api_key: config.llm.specializedAgentApiKey,
    model: config.llm.specializedAgentModel,
  }
}

// Helper function to get TTS configuration
function getTTSConfig() {
  const vendor = config.tts.vendor

  if (vendor === 'elevenlabs') {
    return {
      vendor: 'elevenlabs',
      params: {
        key: config.tts.elevenlabs.apiKey,
        model_id: config.tts.elevenlabs.modelId,
        voice_id: config.tts.elevenlabs.voiceId,
      },
    }
  } else if (vendor === 'microsoft') {
    return {
      vendor: 'microsoft',
      params: {
        key: config.tts.microsoft.key,
        region: config.tts.microsoft.region,
        voice_name: config.tts.microsoft.voiceName,
        rate: config.tts.microsoft.rate,
        volume: config.tts.microsoft.volume,
      },
    }
  }

  throw new Error(`Unsupported TTS vendor: ${vendor}. Supported vendors: elevenlabs, microsoft`)
}

/**
 * Core function to create specialized voice agents with automatic phone call integration
 * 
 * This function:
 * 1. Creates a specialized voice agent with a unique channel
 * 2. Automatically initiates a phone call to connect the specified phone number to the agent's channel
 * 3. Returns comprehensive status including agent details and call results
 * 
 * @param appId - Agora app ID
 * @param userId - User ID for the session
 * @param channel - Original channel (for context, agent gets its own channel)
 * @param specialization - Type of agent being created (e.g., 'restaurant-inquiry')
 * @param systemMessage - Custom system prompt for the specialized agent
 * @param phoneNumber - Phone number to call and connect to the agent
 * @param greetingMessage - First message the agent will say when connected
 * @returns Promise<string> - Status message with agent details and call results
 */
async function createSpecializedVoiceAgent(
  appId: string,
  userId: string,
  channel: string,
  specialization: string,
  systemMessage: string,
  phoneNumber: string,
  greetingMessage: string,
): Promise<string> {
  try {
    // Validate required configuration for specialized agents
    const missingConfig = []
    
    if (!config.agora.convoAiBaseUrl) {
      missingConfig.push('AGORA_CONVO_AI_BASE_URL')
    }
    if (!config.llm.specializedAgentUrl) {
      missingConfig.push('LLM_URL')
    }
    if (!config.llm.specializedAgentApiKey) {
      missingConfig.push('LLM_API_KEY')
    }
    if (config.tts.vendor === 'elevenlabs') {
      if (!config.tts.elevenlabs.apiKey) missingConfig.push('ELEVENLABS_API_KEY')
      if (!config.tts.elevenlabs.modelId) missingConfig.push('ELEVENLABS_MODEL_ID')
      if (!config.tts.elevenlabs.voiceId) missingConfig.push('ELEVENLABS_VOICE_ID')
    } else if (config.tts.vendor === 'microsoft') {
      if (!config.tts.microsoft.key) missingConfig.push('MICROSOFT_TTS_KEY')
      if (!config.tts.microsoft.region) missingConfig.push('MICROSOFT_TTS_REGION')
      if (!config.tts.microsoft.voiceName) missingConfig.push('MICROSOFT_TTS_VOICE_NAME')
    }
    
    if (missingConfig.length > 0) {
      return `Error: Specialized voice agents require additional configuration. Missing environment variables: ${missingConfig.join(', ')}. Please set these variables and restart the server.`
    }

    const agoraConfig = getAgoraConfig()
    const llmConfig = getLLMConfig()
    const ttsConfig = getTTSConfig()

    // Generate unique channel name for the specialized agent
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const specializedChannelName = `specialized-${specialization}-${timestamp}-${random}`
    const agentUid = agoraConfig.taskAgentUid || '392781' // Use configured task agent UID
    const pstnUid = agoraConfig.pstnUid || '33399' // Use configured PSTN UID

    // Generate token for the new channel
    const expirationTime = Math.floor(timestamp / 1000) + 3600
    const token = RtcTokenBuilder.buildTokenWithUid(
      agoraConfig.appId,
      agoraConfig.appCertificate,
      specializedChannelName,
      agentUid,
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime,
    )

    // Prepare agent creation request
    const agentRequest = {
      name: `specialized-agent-${timestamp}`,
      properties: {
        channel: specializedChannelName,
        token: token,
        agent_rtc_uid: agentUid,
        remote_rtc_uids: [pstnUid],
        enable_string_uid: false, // Using string UID
        idle_timeout: 300, // 5 minutes for specialized tasks
        asr: {
          language: 'en-US',
          task: 'conversation',
        },
        llm: {
          url: llmConfig.url,
          api_key: llmConfig.api_key,
          system_messages: [
            {
              role: 'system',
              content: systemMessage,
            },
          ],
          greeting_message: greetingMessage,
          failure_message: "I apologize, but I'm having trouble understanding you. If you can hear me, please hang up and I'll call back?",
          max_history: 30,
          params: {
            model: llmConfig.model || 'gpt-4o-mini',
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
          input_modalities: ['text'],
          // output_modalities: ['text', 'audio'], // Doesnt work when included
        },
        vad: {
          silence_duration_ms: 480,
          speech_duration_ms: 15000,
          threshold: 0.5,
          interrupt_duration_ms: 160,
          prefix_padding_ms: 300,
        },
        tts: ttsConfig,
        advanced_features: {
          enable_aivad: false,
          enable_bhvs: false,
        },
      },
    }

    // Create the specialized agent
    console.log(`Creating ${specialization} agent in channel: ${specializedChannelName}`)
    console.log(`Request URL: ${agoraConfig.baseUrl}/${agoraConfig.appId}/join`)
    console.log(`Agent request body:`, JSON.stringify(agentRequest, null, 2))
    
    const agentResponse = await fetch(`${agoraConfig.baseUrl}/${agoraConfig.appId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${agoraConfig.customerId}:${agoraConfig.customerSecret}`).toString('base64')}`,
      },
      body: JSON.stringify(agentRequest),
      // Add timeout configuration
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      console.error('Agent creation failed:', {
        status: agentResponse.status,
        statusText: agentResponse.statusText,
        body: errorText,
        url: `${agoraConfig.baseUrl}/${agoraConfig.appId}/join`
      })
      return `Error creating ${specialization} agent: ${agentResponse.status} ${agentResponse.statusText} - ${errorText}`
    }

    const agentData = (await agentResponse.json()) as { agent_id?: string; [key: string]: any }
    console.log(`${specialization} agent created successfully: ${agentData.agent_id || 'Unknown ID'}`)

    // Store the agent information for later retrieval
    if (agentData.agent_id) {
      storeAgentInfo(userId, agentData.agent_id, specialization, specializedChannelName)
    }

    // Now initiate the phone call to connect the phone number to this specialized agent's channel
    console.log(
      `Initiating phone call to ${phoneNumber} for ${specialization} agent in channel ${specializedChannelName}`,
    )

    try {
      // Make the phone call to connect to the specialized agent's channel
      console.log(`Making call with parameters:`, {
        appId: agoraConfig.appId,
        userId: userId,
        channel: specializedChannelName,
        phoneNumber: phoneNumber
      })
      
      // Use switch statement to determine call type based on user preference
      const callAction = getCallAction(channel)
      let callResult: string
      
      console.log(`Determining call action for channel "${channel}"`)
      
      switch (callAction) {
        case 'call_sid':
          console.log(`Using call_sid mode for channel ${channel}`)
          callResult = await callSidPhone(agoraConfig.appId, userId, specializedChannelName)
          break
        case 'live':
          console.log(`Using live mode for channel ${channel} - calling actual number: ${phoneNumber}`)
          callResult = await callPhone(agoraConfig.appId, userId, specializedChannelName, phoneNumber)
          break
        case 'call_hermes':
        default:
          console.log(`Using call_hermes mode (default) for channel ${channel}`)
          callResult = await callHermesPhone(agoraConfig.appId, userId, specializedChannelName)
          break
      }

      console.log(`Phone call result: ${callResult}`)

      // Check if call was successful
      if (callResult.includes('Failed') || callResult.includes('Error') || callResult.includes('Invalid')) {
        const errorResponse = `${specialization} agent created successfully, but phone call failed.

Agent Details:
- Type: ${specialization}
- Channel: ${specializedChannelName}
- Agent ID: ${agentData.agent_id || 'Unknown ID'}
- Phone Number: ${phoneNumber}

Phone Call Error: ${callResult}

The agent is ready but the phone call couldn't connect. This might be due to:
- Invalid phone number format
- Network/PSTN configuration issues
- Restaurant phone line unavailable

You can try calling ${phoneNumber} manually to place your order.`
        
        return errorResponse
      } else {
        // Start automatic polling
        if (agentData.agent_id) {
          console.log(`Starting automatic polling for agent ${agentData.agent_id}`)
          
          // Start polling in the background
          startAgentPolling(
            appId,
            userId, 
            channel,
            agentData.agent_id,
            specialization
          ).catch(error => {
            console.error('Failed to start polling:', error)
          })
        }
        
        const successResponse = `✅ ${specialization} agent created and calling ${phoneNumber}!

🔄 **Automatic monitoring started** - I'll provide real-time updates as your ${specialization} progresses.

Initial status will be available shortly...`
        
        return successResponse
      }
    } catch (phoneError) {
      console.error('Phone call failed after agent creation:', phoneError)
      
      // Provide more detailed error information
      const errorMessage = phoneError instanceof Error ? phoneError.message : 'Unknown phone error'
      console.error(`Detailed error: ${errorMessage}`)
      
      const phoneErrorResponse = `${specialization} agent created successfully, but phone call failed.

Agent Details:
- Type: ${specialization}
- Channel: ${specializedChannelName}
- Agent ID: ${agentData.agent_id || 'Unknown ID'}
- Phone Number: ${phoneNumber}

Phone Call Error: ${errorMessage}

The agent is ready but you'll need to manually connect the phone call. You can try calling ${phoneNumber} manually to connect to the agent.`
      
      return phoneErrorResponse
    }
  } catch (error) {
    console.error(`Error creating ${specialization} agent:`, error)
    
    // Handle specific error types
    if (error instanceof Error && error.name === 'AbortError') {
      return `Error creating ${specialization} agent: Request timed out after 30 seconds. Please check your network connection and try again.`
    }
    
    if (error instanceof Error && error.message.includes('fetch failed')) {
      return `Error creating ${specialization} agent: Network connection failed. Please check if the Agora Conversational AI service is accessible and try again.`
    }
    
    return `Error creating ${specialization} agent: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Wrapper function: Call and Ask Question Agent
async function callAndAskQuestionAgent(
  appId: string,
  userId: string,
  channel: string,
  args: { phone_number: string; restaurant_name: string; question: string },
): Promise<string> {
  // Argument validation
  if (!args.phone_number || !args.restaurant_name || !args.question) {
    const missing = []
    if (!args.phone_number) missing.push('phone_number')
    if (!args.restaurant_name) missing.push('restaurant_name')
    if (!args.question) missing.push('question')
    return `Error: Missing required field(s): ${missing.join(', ')}. Please confirm all details with the user before proceeding.`
  }

  // Check if there's already an active specialized agent call for this channel
  if (activeSpecializedAgents.get(channel)) {
    return `Error: A specialized agent is already active for this conversation. Please wait for the current call to complete before starting a new one.`
  }

  const systemMessage = `You are a professional restaurant inquiry assistant calling a busy restaurant for a customer.\nBe brief, polite, and get straight to the point.\n1. Greet and say you have a quick question.\n2. Ask: "${args.question}"\n3. Listen to the answer.\n4. Thank them and end the call.\nOnly confirm the answer if you are unsure or if they ask.\nDo not repeat yourself. Keep the call as short as possible.`

  const greetingMessage = `Hi, I have a quick question for you.`

  // Set the active specialized agent flag before creating the agent
  activeSpecializedAgents.set(channel, true)

  // Start agent creation in background and return immediately
  createSpecializedVoiceAgent(
    appId,
    userId,
    channel,
    'restaurant-inquiry',
    systemMessage,
    args.phone_number,
    greetingMessage,
  ).catch(error => {
    console.error(`Failed to create inquiry agent for channel ${channel}:`, error)
    // Clear the flag if agent creation failed
    activeSpecializedAgents.delete(channel)
  })

  // Return immediately with dispatch confirmation
  return `✅ inquiry agent dispatched and calling ${args.restaurant_name} (${args.phone_number})!

The agent is now contacting the restaurant to ask: "${args.question}". Use get_latest_agent_status to check progress.`
}

// Wrapper function: Place Phone Order Agent
async function placePhoneOrderAgent(
  appId: string,
  userId: string,
  channel: string,
  args: { phone_number: string; restaurant_name: string; customer_name: string; food_items: string; delivery_type: string; delivery_address: string },
): Promise<string> {
  // Argument validation
  if (!args.phone_number || !args.restaurant_name || !args.customer_name || !args.food_items || !args.delivery_type || !args.delivery_address) {
    const missing = []
    if (!args.phone_number) missing.push('phone_number')
    if (!args.restaurant_name) missing.push('restaurant_name')
    if (!args.customer_name) missing.push('customer_name')
    if (!args.food_items) missing.push('food_items')
    if (!args.delivery_type) missing.push('delivery_type')
    if (!args.delivery_address) missing.push('delivery_address')
    return `Error: Missing required field(s): ${missing.join(', ')}. Please confirm all details with the user before proceeding.`
  }

  // Critical data integrity checks
  if (args.customer_name.toLowerCase().includes('customer') || 
      args.customer_name.toLowerCase().includes('user') ||
      args.customer_name.length < 2) {
    return `Error: Invalid customer name "${args.customer_name}". Please ask the user for their real full name before proceeding. Names like "Customer", "User", "Indian Scissor" are not acceptable.`
  }

  // Phone number handling - auto-find if "auto" or invalid format
  let phoneNumber = args.phone_number
  if (phoneNumber === 'auto' || !phoneNumber.match(/^\+?1?[0-9]{10,11}$/)) {
    console.log(`Auto-finding phone number for "${args.restaurant_name}"`)
    const foundPhone = findPhoneNumber(userId, args.restaurant_name)
    if (foundPhone) {
      phoneNumber = foundPhone
      console.log(`Using found phone number: ${phoneNumber}`)
    } else {
      return `Error: Could not find phone number for "${args.restaurant_name}" in recent searches. Please search for the restaurant first to get the correct phone number.`
    }
  }

  // Check if there's already an active specialized agent call for this channel
  if (activeSpecializedAgents.get(channel)) {
    return `Error: A specialized agent is already active for this conversation. Please wait for the current call to complete before starting a new one.`
  }

  const isDelivery = args.delivery_type.toLowerCase() === 'delivery'
  const orderType = isDelivery ? 'delivery' : 'takeout'
  
  const systemMessage = `You are a professional phone ordering assistant calling a busy restaurant to place a ${orderType} order for a customer.\nBe brief, clear, and polite.\n1. Greet and say you want to place a ${orderType} order.\n2. Give the customer name: "${args.customer_name}"\n3. State the order: "${args.food_items}"\n${isDelivery ? `4. Give the delivery address: "${args.delivery_address}"` : '4. Confirm pickup details.'}\n5. Ask for total price and estimated ${isDelivery ? 'delivery' : 'pickup'} time if not provided.\n6. Thank them and end the call.\n\nIMPORTANT - If any item is out of stock or unavailable:\n- If there are multiple items and some are unavailable: Say "OK, let's skip that for now and I'll call back to update the order. I need to double check what ${args.customer_name} wants to order." Then proceed with remaining available items.\n- If it's the only item or all items are unavailable: Say "OK, I'll call back to confirm what ${args.customer_name} would like to order instead. Thank you!" Then politely end the call.\n\nOnly confirm details if you are unsure or if they ask.\nDo not repeat yourself. Keep the call as short as possible.`

  const greetingMessage = `Hi, I'd like to place a ${orderType} order.`

  // Set the active specialized agent flag before creating the agent
  activeSpecializedAgents.set(channel, true)

  // Start agent creation in background and return immediately
  createSpecializedVoiceAgent(
    appId,
    userId,
    channel,
    'phone-ordering',
    systemMessage,
    phoneNumber,
    greetingMessage,
  ).catch(error => {
    console.error(`Failed to create phone-ordering agent for channel ${channel}:`, error)
    // Clear the flag if agent creation failed
    activeSpecializedAgents.delete(channel)
  })

  // Return immediately with dispatch confirmation
  return `✅ phone-ordering agent dispatched and calling ${args.restaurant_name} (${phoneNumber})!

The agent is now contacting the restaurant to place your ${orderType} order. Use get_latest_agent_status to check progress.`
}

// Wrapper function: Make Reservation Agent
async function makeReservationAgent(
  appId: string,
  userId: string,
  channel: string,
  args: {
    phone_number: string
    restaurant_name: string
    customer_name: string
    party_size: number
    time_preferences: string
  },
): Promise<string> {
  // Argument validation
  if (!args.phone_number || !args.restaurant_name || !args.customer_name || !args.party_size || !args.time_preferences) {
    const missing = []
    if (!args.phone_number) missing.push('phone_number')
    if (!args.restaurant_name) missing.push('restaurant_name')
    if (!args.customer_name) missing.push('customer_name')
    if (!args.party_size) missing.push('party_size')
    if (!args.time_preferences) missing.push('time_preferences')
    return `Error: Missing required field(s): ${missing.join(', ')}. Please confirm all details with the user before proceeding.`
  }

  // Critical data integrity checks
  if (args.customer_name.toLowerCase().includes('customer') ||
      args.customer_name.toLowerCase().includes('user') ||
      args.customer_name.length < 2) {
    return `Error: Invalid customer name "${args.customer_name}". Please ask the user for their real full name before proceeding. Names like "Customer", "User", "Indian Scissor" are not acceptable.`
  }

  // Phone number format validation (basic check)
  if (!args.phone_number.match(/^\+?1?[0-9]{10,11}$/)) {
    return `Error: Invalid phone number format "${args.phone_number}". Please use the exact phone number from YELP search results. Never make up phone numbers.`
  }

  // Check if there's already an active specialized agent call for this channel
  if (activeSpecializedAgents.get(channel)) {
    return `Error: A specialized agent is already active for this conversation. Please wait for the current call to complete before starting a new one.`
  }

  const systemMessage = `You are a professional reservation assistant calling a busy restaurant to make a reservation for a customer.\nBe brief, clear, and polite.\n1. Greet and say you want to make a reservation.\n2. Give the customer name: "${args.customer_name}"\n3. State party size: "${args.party_size}"\n4. Request timing: "${args.time_preferences}"\n5. Be flexible with timing if they cannot accommodate the exact requested time.\n6. Confirm final details only if you are unsure or if they ask.\n7. Thank them and end the call.\nDo not repeat yourself. Keep the call as short as possible.`

  const greetingMessage = `Hi, I'd like to make a reservation for ${args.party_size} people.`

  // Set the active specialized agent flag before creating the agent
  activeSpecializedAgents.set(channel, true)

  // Start agent creation in background and return immediately
  createSpecializedVoiceAgent(
    appId,
    userId,
    channel,
    'reservation-booking',
    systemMessage,
    args.phone_number,
    greetingMessage,
  ).catch(error => {
    console.error(`Failed to create reservation agent for channel ${channel}:`, error)
    // Clear the flag if agent creation failed
    activeSpecializedAgents.delete(channel)
  })

  // Return immediately with dispatch confirmation
  return `✅ reservation agent dispatched and calling ${args.restaurant_name} (${args.phone_number})!

The agent is now contacting the restaurant to make your reservation for ${args.party_size} people. Use get_latest_agent_status to check progress.`
}

// Version-specific function maps
export function getVersionedFunctionMap(version: 'v1' | 'v2' | 'v3' | 'v4'): Record<string, FunctionHandler> {
  const baseFunctionMap = {
    ...originalFunctionMap,
    // Add the specialized agent wrapper functions to all versions
    call_and_ask_question_agent: callAndAskQuestionAgent as FunctionHandler,
    place_phone_order_agent: placePhoneOrderAgent as FunctionHandler,
    make_reservation_agent: makeReservationAgent as FunctionHandler,
    // Add the status checking functions to all versions
    get_specialized_agent_status: getSpecializedAgentStatus as FunctionHandler,
    get_latest_agent_status: getLatestAgentStatus as FunctionHandler,
    get_latest_agent_updates: getLatestAgentUpdates as FunctionHandler,
    get_polling_status: getPollingStatus as FunctionHandler,
    stop_agent_polling: stopAgentPolling as FunctionHandler,
    // Add restaurant index debugging function
    get_indexed_restaurants: getIndexedRestaurants as FunctionHandler,
  }

  // Add version-specific functions
  if (version === 'v3' || version === 'v4') {
    // Both v3 and v4 use YELP tools for food recommendations
    return {
      ...baseFunctionMap,
      search_yelp_restaurants: searchYelpRestaurants as FunctionHandler,
      get_yelp_restaurant_details: getYelpRestaurantDetails as FunctionHandler,
      get_yelp_restaurant_reviews: getYelpRestaurantReviews as FunctionHandler,
      search_yelp_advanced: searchYelpAdvanced as FunctionHandler,
      search_yelp_by_phone: searchYelpByPhone as FunctionHandler,
      search_yelp_by_name: searchYelpByName as FunctionHandler,
      match_yelp_business: matchYelpBusiness as FunctionHandler,
    }
  }

  if (version === 'v2') {
    // v2 uses Pinecone-powered semantic search functions
    return {
      ...baseFunctionMap,
      search_pinecone_restaurants: searchPineconeRestaurants as FunctionHandler,
      search_pinecone_by_category: searchPineconeByCategory as FunctionHandler,
      search_pinecone_by_mood: searchPineconeByMood as FunctionHandler,
    }
  }

  // v1 uses original function map with specialized agent capability
  return baseFunctionMap
}

// Export the store function for use in other modules
export { storeCallAction }
