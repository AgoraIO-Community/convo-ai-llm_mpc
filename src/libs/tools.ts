import axios from 'axios'
import { config } from './utils'
import {
  getRestaurantsByCategory,
  getRestaurantsByCity,
  getTopRatedRestaurants,
  loadRestaurantData,
  type RestaurantData,
} from '../services/mockRagService'

interface PeerMessageResponse {
  data: unknown
}

interface FunctionArgs {
  filling?: string
  to?: string
  category?: string
  city?: string
  minRating?: number
  limit?: number
  restaurantName?: string
  // Specialized agent parameters
  phone_number?: string
  restaurant_name?: string
  question?: string
  customer_name?: string
  food_items?: string
  party_size?: number
  time_preferences?: string
}

type FunctionHandler = (appId: string, userId: string, channel: string, args: FunctionArgs) => Promise<string> | string

/**
 * Send a peer message using Agora RTM REST API
 * @param {string} appId - Agora app ID
 * @param {string} fromUser - Sender user ID
 * @param {string} toUser - Recipient user ID
 * @returns {Promise<PeerMessageResponse>}
 */
async function sendPeerMessage(
  appId: string,
  fromUser: string,
  toUser: string,
  payload: string,
): Promise<PeerMessageResponse> {
  const url = `https://api.agora.io/dev/v2/project/${appId}/rtm/users/${fromUser}/peer_messages`

  const data = {
    destination: String(toUser),
    enable_offline_messaging: true,
    enable_historical_messaging: true,
    payload: payload,
  }

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: 'Basic ' + config.agora.authToken,
        'Content-Type': 'application/json',
      },
    })
    console.log('Message sent successfully:', response.data)
    return response
  } catch (error) {
    console.error('Error sending peer message:', error)
    throw error
  }
}

/**
 * Order sandwich implementation
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @param {string} filling - Sandwich filling
 * @returns {string} Confirmation message
 */
function orderSandwich(userId: string, channel: string, filling: string): string {
  console.log('Placing sandwich order for', userId, 'in', channel, 'with filling:', filling)
  return `Sandwich ordered with ${filling}. Enjoy!`
}

/**
 * Send photo implementation
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @returns {Promise<string>} Confirmation message
 */
async function sendPhoto(appId: string, userId: string, channel: string): Promise<string> {
  console.log('Sending photo to', userId, 'in', channel)

  const baseUrl = 'https://wam60lctyb.ufs.sh/f'
  const imageKeys = [
    'NW1E5hslypbTyr3pXL2RclXn8RktVdJgBrHwvPuqTQ07IaZK',
    'NW1E5hslypbTlfnx4uPvcHInBDXiCVuoxFkOeQ03bZs9g1J8',
    'NW1E5hslypbTYkNkclv7HblznpM10R5eNi7FIgK2UaEJXGsj',
    'NW1E5hslypbTps6TRQEUadZybDFIrAJWx9PVvq7Lik5s42CK',
    'NW1E5hslypbTKd7LgxLTJx0POtVY7r296oCajvpNeAkIHURE',
    'NW1E5hslypbToxjaZGD8nBTOwu9Qlxtg41JZcaSHmKRWhE6A',
    'NW1E5hslypbTfeQfhcgJX7CO6qwlaH1DP4hBcAfeT3VMoEIY',
    'NW1E5hslypbTAZfQ8kwVHtYufr7OCc1noEmRSIh5N3vLMkFK',
    'NW1E5hslypbTH3POzGldgaX05KqRFuM6Pz7QT8oBUCvm9NL1',
    'NW1E5hslypbTKsGWSQTJx0POtVY7r296oCajvpNeAkIHUREM',
    'NW1E5hslypbTcitWcAXjYIF82XSuziPgKHp3yrVwRJqvGcdD',
    'NW1E5hslypbTlsz4IxPvcHInBDXiCVuoxFkOeQ03bZs9g1J8',
    'NW1E5hslypbTcPtpRnXjYIF82XSuziPgKHp3yrVwRJqvGcdD',
    'NW1E5hslypbTdHrCp1xzBxhIYkECvTtU8Xb43SLM5f7dZacD',
    'NW1E5hslypbT1pC2GukLT4onszpWEaxCrMIVdPRmq5lf9bA3',
    'NW1E5hslypbTnetEdFd3AxIsubmQEtypwFHrVd1BGDShYUc0',
  ]
  const randomImageKey = imageKeys[Math.floor(Math.random() * imageKeys.length)]

  const payload = `{"img":"${baseUrl}/${randomImageKey}"}`

  // Call Agora's REST API to send the peer message
  await sendPeerMessage(appId, config.agentId, userId, payload)

  return `Photo sent successfully to user ${userId}.`
}

/**
 * Generate Agora RTC token for PSTN calls
 * @param {string} appId - Agora app ID
 * @param {string} channel - Channel name
 * @param {string} userId - User ID
 * @returns {string} Generated token or empty string
 */
async function generateTokenForPSTN(appId: string, channel: string, userId: string): Promise<string> {
  try {
    console.log('Generating PSTN Token:')
    console.log('  AppId:', appId)
    console.log('  Channel:', channel)
    console.log('  UserId:', userId)
    console.log('  UserId (parsed):', parseInt(userId))
    console.log('  App Certificate:', config.agora.appCertificate ? '[PROVIDED]' : '[MISSING]')

    // Import at the top of the file once agora-token is installed
    const { RtcTokenBuilder, RtcRole } = await import('agora-token')
    const expirationTime = Math.floor(Date.now() / 1000) + 3600

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      config.agora.appCertificate,
      channel,
      parseInt(userId),
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime,
    )

    console.log('Token generated successfully:', token.substring(0, 20) + '...')
    return token
  } catch (error) {
    console.error('Error generating token:', error)
    // Return empty string if token generation fails (tokens are optional for PSTN calls)
    return ''
  }
}

/**
 * Format phone number to international format
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters and + prefix if present
  const digitsOnly = phone.replace(/\D/g, '')

  // If it doesn't start with country code, add US code (1)
  const withCountryCode = digitsOnly.startsWith('1') ? digitsOnly : `1${digitsOnly}`

  // Add + prefix
  return `+${withCountryCode}`
}

/**
 * Make a phone call via Agora PSTN service
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID (for the call)
 * @param {string} channel - Channel name
 * @param {string} to - Destination phone number
 * @returns {Promise<string>} Call result message
 */
async function callPhone(appId: string, userId: string, channel: string, to: string): Promise<string> {
  const url = config.agora.pstnApiUrl

  if (!url || url.trim() === '') {
    throw new Error('PSTN API URL not configured')
  }

  if (!config.agora.pstnAuthHeader || config.agora.pstnAuthHeader.trim() === '') {
    throw new Error('PSTN authorization header not configured')
  }

  if (!config.agora.pstnFromNumber || config.agora.pstnFromNumber.trim() === '') {
    throw new Error('PSTN from number not configured')
  }

  // Check if we have required Agora context
  if (!appId || !channel) {
    throw new Error(
      'Cannot make phone call: Missing required Agora context (appId or channel). This feature requires an active Agora session.',
    )
  }

  const formattedToPhone = formatPhoneNumber(to)
  const formattedFromPhone = formatPhoneNumber(config.agora.pstnFromNumber)

  // Use PSTN UID from environment, fallback to userId if available, or use 'pstn-caller' as default
  const pstnUid = config.agora.pstnUid || userId || 'pstn-caller'

  // Generate token for the call
  const token = await generateTokenForPSTN(appId, channel, pstnUid)

  const data = {
    action: 'outbound',
    appid: appId,
    token: token, // Agora RTC token
    uid: pstnUid, // Use PSTN UID from environment
    channel: channel, // API expects "channelId" based on error message
    to: formattedToPhone,
    from: formattedFromPhone,
    region: config.agora.pstnRegion || 'AREA_CODE_NA',
    prompt: 'false', // Play a prompt and wait for user interaction
    timeout: '3600', // 1 hour default timeout
    sip: config.agora.sipGateway, // SIP gateway for custom routing
  }

  try {
    // Parse the PSTN auth header - it should be in format: "authorization_<app-id>=Basic <token>"

    console.log('PSTN Request Details:')
    console.log('URL:', url)
    console.log('Request Body:', JSON.stringify(data, null, 2))

    const response = await axios.post(url, data, {
      headers: {
        Authorization: 'Basic ' + config.agora.pstnAuthHeader,
        'Content-Type': 'application/json',
      },
    })

    console.log('PSTN Response Details:')
    console.log('Status:', response.status)
    console.log('Response Body:', JSON.stringify(response.data, null, 2))
    console.log('Response Headers:', JSON.stringify(response.headers, null, 2))

    if (response.data.success) {
      return `Phone call initiated successfully to ${formattedToPhone} from ${formattedFromPhone}. Call ID: ${response.data.callid}`
    } else {
      return `Failed to initiate phone call to ${formattedToPhone}. Reason: ${response.data.reason || 'Unknown error'}`
    }
  } catch (error) {
    console.error('PSTN Request Failed:')
    console.error('Error making PSTN call:', error)

    if (axios.isAxiosError(error) && error.response) {
      console.error('Error Status:', error.response.status)
      console.error('Error Response Body:', JSON.stringify(error.response.data, null, 2))
      console.error('Error Response Headers:', JSON.stringify(error.response.headers, null, 2))
      throw new Error(`PSTN API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}

/**
 * Call Hermes phone implementation (hardcoded number)
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @returns {Promise<string>} Confirmation message
 */
async function callHermesPhone(appId: string, userId: string, channel: string): Promise<string> {
  // Get Hermes phone number from environment variable
  const hermesPhoneNumber = process.env.HERMES_PHONE_NUMBER || ''

  if (!hermesPhoneNumber) {
    throw new Error('Hermes phone number not configured in environment variables')
  }

  // Check if we have required Agora context
  if (!appId || !channel) {
    throw new Error(
      'Cannot make phone call: Missing required Agora context (appId, userId, or channel). This feature requires an active Agora session.',
    )
  }

  console.log('Calling Hermes phone number:', hermesPhoneNumber, 'for user', userId, 'in channel', channel)

  // Use the existing callPhone function with configured number
  return await callPhone(appId, userId, channel, hermesPhoneNumber)
}

/**
 * Call Hermes phone implementation (hardcoded number)
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @returns {Promise<string>} Confirmation message
 */
async function callSidPhone(appId: string, userId: string, channel: string): Promise<string> {
  // Get Hermes phone number from environment variable
  const sidPhoneNumber = process.env.SID_PHONE_NUMBER || ''

  if (!sidPhoneNumber) {
    throw new Error('Sid phone number not configured in environment variables')
  }

  // Check if we have required Agora context
  if (!appId || !channel) {
    throw new Error(
      'Cannot make phone call: Missing required Agora context (appId, userId, or channel). This feature requires an active Agora session.',
    )
  }

  console.log('Calling Sid phone number:', sidPhoneNumber, 'for user', userId, 'in channel', channel)

  // Use the existing callPhone function with configured number
  return await callPhone(appId, userId, channel, sidPhoneNumber)
}

/**
 * Search restaurants by category/cuisine type
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @param {string} category - Cuisine category to search for
 * @returns {string} Formatted list of matching restaurants
 */
function searchRestaurantsByCategory(appId: string, userId: string, channel: string, category: string): string {
  console.log(`Searching restaurants by category: ${category} for user ${userId}`)

  const restaurants = getRestaurantsByCategory(category)

  if (restaurants.length === 0) {
    return `No restaurants found for category "${category}". Available categories include: Japanese, Chinese, Italian, Mexican, Thai, Indian, Pizza, Sushi, Burgers, Coffee, etc.`
  }

  const formattedResults = restaurants
    .slice(0, 10)
    .map((r: RestaurantData) => `${r.name} - ${r.rating}/5 (${r.categories})`)
    .join('\n')

  return `Found ${restaurants.length} restaurants for "${category}" (showing top 10):\n\n${formattedResults}`
}

/**
 * Search restaurants by city/location
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @param {string} city - City to search in
 * @returns {string} Formatted list of matching restaurants
 */
function searchRestaurantsByCity(appId: string, userId: string, channel: string, city: string): string {
  console.log(`Searching restaurants by city: ${city} for user ${userId}`)

  const restaurants = getRestaurantsByCity(city)

  if (restaurants.length === 0) {
    return `No restaurants found in "${city}". Available cities: San Francisco, Oakland, Berkeley.`
  }

  const formattedResults = restaurants
    .slice(0, 15)
    .map((r: RestaurantData) => `${r.name} - ${r.rating}/5 (${r.categories})`)
    .join('\n')

  return `Found ${restaurants.length} restaurants in "${city}" (showing top 15):\n\n${formattedResults}`
}

/**
 * Get top-rated restaurants
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @param {number} minRating - Minimum rating (default 4.8)
 * @returns {string} Formatted list of top-rated restaurants
 */
function getTopRatedRestaurantsList(appId: string, userId: string, channel: string, minRating: number = 4.8): string {
  console.log(`Getting top-rated restaurants (min rating: ${minRating}) for user ${userId}`)

  const restaurants = getTopRatedRestaurants(minRating)

  if (restaurants.length === 0) {
    return `No restaurants found with rating ${minRating} or higher. Try a lower rating like 4.5.`
  }

  const formattedResults = restaurants
    .map((r: RestaurantData) => `${r.name} - ${r.rating}/5 (${r.categories})`)
    .join('\n')

  return `Found ${restaurants.length} highly-rated restaurants (${minRating}+ stars):\n\n${formattedResults}`
}

/**
 * Get detailed info about a specific restaurant by name
 * @param {string} appId - Agora app ID
 * @param {string} userId - User ID
 * @param {string} channel - Channel
 * @param {string} restaurantName - Name of restaurant to get details for
 * @returns {string} Detailed restaurant information
 */
function getRestaurantDetails(appId: string, userId: string, channel: string, restaurantName: string): string {
  console.log(`Getting restaurant details for: ${restaurantName} for user ${userId}`)

  const data = loadRestaurantData()
  const restaurant = data.restaurants.find((r: RestaurantData) =>
    r.name.toLowerCase().includes(restaurantName.toLowerCase()),
  )

  if (!restaurant) {
    return `I couldn't find "${restaurantName}" in our database. Please pick another restaurant or ask me to search for restaurants by category like "Pizza" or "Italian".`
  }

  return `${restaurant.name}
Categories: ${restaurant.categories}
Rating: ${restaurant.rating}
Price Range: ${restaurant.price_range}
Location: ${restaurant.location}
Phone: ${restaurant.phone}
Services: ${restaurant.supports}
Website: ${restaurant.website}
Menu Available Online: ${restaurant.menu_available_on_website ? 'Yes' : 'No'}
Coordinates: ${restaurant.coordinates.latitude}, ${restaurant.coordinates.longitude}`
}

/**
 * Function map to execute functions by name
 */
const functionMap: Record<string, FunctionHandler> = {
  send_photo: (appId, userId, channel) => sendPhoto(appId, userId, channel),
  order_sandwich: (appId, userId, channel, args) => orderSandwich(userId, channel, args.filling as string),
  call_phone: (appId, userId, channel, args) => callPhone(appId, userId, channel, args.to as string),
  call_hermes_phone: (appId, userId, channel) => callHermesPhone(appId, userId, channel),
  call_sid_phone: (appId, userId, channel) => callSidPhone(appId, userId, channel),
  search_restaurants_by_category: (appId, userId, channel, args) =>
    searchRestaurantsByCategory(appId, userId, channel, args.category as string),
  search_restaurants_by_city: (appId, userId, channel, args) =>
    searchRestaurantsByCity(appId, userId, channel, args.city as string),
  get_top_rated_restaurants: (appId, userId, channel, args) =>
    getTopRatedRestaurantsList(appId, userId, channel, args.minRating),
  get_restaurant_details: (appId, userId, channel, args) =>
    getRestaurantDetails(appId, userId, channel, args.restaurantName as string),
}

export {
  sendPeerMessage,
  orderSandwich,
  sendPhoto,
  callPhone,
  callHermesPhone,
  callSidPhone,
  searchRestaurantsByCategory,
  searchRestaurantsByCity,
  getTopRatedRestaurantsList,
  getRestaurantDetails,
  formatPhoneNumber,
  generateTokenForPSTN,
  functionMap,
}
export type { PeerMessageResponse, FunctionArgs, FunctionHandler }
