// src/services/mockRagService.ts - Mock RAG data service (hardcoded data)
// This is a mock implementation that will be replaced with a real RAG service
import fs from 'fs'
import path from 'path'

interface RestaurantData {
  name: string
  categories: string
  rating: string
  location: string
  price_range: string
  phone: string
  website: string
  supports: string
  menu_available_on_website: boolean
  coordinates: {
    latitude: number
    longitude: number
  }
}

interface RestaurantDatabase {
  restaurants: RestaurantData[]
}

interface RagData {
  doc1: string
  doc2: string
  doc3: string
  doc4: string
  doc5: string
  restaurants_summary: string
  restaurants_categories: string
  restaurants_by_location: string
  restaurants_count: string
}

// Load restaurant data once at module initialization
let RESTAURANT_DATA: RestaurantDatabase | null = null

/**
 * Load restaurant data from JSON file (called once at startup)
 */
function loadRestaurantData(): RestaurantDatabase {
  if (RESTAURANT_DATA !== null) {
    return RESTAURANT_DATA
  }

  try {
    const dataPath = path.join(__dirname, '../data/restaurants_for_llm.json')
    const rawData = fs.readFileSync(dataPath, 'utf8')
    const parsed = JSON.parse(rawData) as RestaurantDatabase
    RESTAURANT_DATA = parsed
    console.log(`✅ Loaded ${parsed.restaurants.length} restaurants into memory`)
    return parsed
  } catch (error) {
    console.error('❌ Error loading restaurant data:', error)
    RESTAURANT_DATA = { restaurants: [] }
    return RESTAURANT_DATA
  }
}

/**
 * Force reload restaurant data from disk (useful for updates)
 */
function reloadRestaurantData(): RestaurantDatabase {
  RESTAURANT_DATA = null
  return loadRestaurantData()
}

// Load data immediately when module is imported
loadRestaurantData()

/**
 * Generate a summary of available restaurants
 */
function generateRestaurantSummary(): string {
  const data = loadRestaurantData()
  const total = data.restaurants.length

  if (total === 0) return 'No restaurant data available.'

  // Get top-rated restaurants (5.0 rating)
  const topRated = data.restaurants.filter((r) => r.rating.startsWith('5/5')).slice(0, 5)

  // Get price range distribution
  const priceRanges = data.restaurants.reduce((acc, r) => {
    const price = r.price_range
    acc[price] = (acc[price] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return `Restaurant Database: ${total} restaurants across San Francisco, Oakland, and Berkeley.
Top 5-star restaurants: ${topRated.map((r) => `${r.name} (${r.categories})`).join(', ')}.
Price distribution: ${Object.entries(priceRanges)
    .map(([price, count]) => `${price}: ${count}`)
    .join(', ')}.
Services: Most restaurants offer pickup/delivery. Many have websites with menu information.`
}

/**
 * Generate list of available categories
 */
function generateCategoriesList(): string {
  const data = loadRestaurantData()

  if (data.restaurants.length === 0) return 'No categories available.'

  // Extract unique categories
  const categoriesSet = new Set<string>()
  data.restaurants.forEach((r) => {
    r.categories.split(', ').forEach((cat) => categoriesSet.add(cat.trim()))
  })

  const categories = Array.from(categoriesSet).sort()
  return `Available cuisine categories: ${categories.join(', ')}.`
}

/**
 * Generate restaurants grouped by location
 */
function generateLocationBreakdown(): string {
  const data = loadRestaurantData()

  if (data.restaurants.length === 0) return 'No location data available.'

  // Group by city
  const locationCounts = data.restaurants.reduce((acc, r) => {
    const city = r.location.includes('San Francisco')
      ? 'San Francisco'
      : r.location.includes('Oakland')
      ? 'Oakland'
      : r.location.includes('Berkeley')
      ? 'Berkeley'
      : 'Other'
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return `Restaurant locations: ${Object.entries(locationCounts)
    .map(([city, count]) => `${city} (${count} restaurants)`)
    .join(', ')}.`
}

/**
 * Get formatted restaurant data for LLM - condensed version
 */
function getFormattedRestaurantData(): string {
  const data = loadRestaurantData()

  if (data.restaurants.length === 0) return 'No restaurant data available.'

  // Format restaurants in a concise way for LLM
  const formattedRestaurants = data.restaurants
    .map(
      (r) =>
        `${r.name}: ${r.categories} | ${r.rating} | ${r.price_range} | ${extractCityFromLocation(r.location)} | ${
          r.phone
        } | ${r.supports}`,
    )
    .join('\n')

  return `RESTAURANT DATABASE (${data.restaurants.length} restaurants):
${formattedRestaurants}`
}

/**
 * Get full restaurant data as JSON string (for when detailed info is needed)
 */
function getFullRestaurantDataAsString(): string {
  const data = loadRestaurantData()
  return JSON.stringify(data.restaurants, null, 2)
}

/**
 * Extract city name from full location string
 */
function extractCityFromLocation(location: string): string {
  if (location.includes('San Francisco')) return 'SF'
  if (location.includes('Oakland')) return 'Oakland'
  if (location.includes('Berkeley')) return 'Berkeley'
  return 'Unknown'
}

/**
 * Get restaurants by specific criteria (for targeted queries)
 */
function getRestaurantsByCategory(category: string): RestaurantData[] {
  const data = loadRestaurantData()
  return data.restaurants.filter((r) => r.categories.toLowerCase().includes(category.toLowerCase()))
}

function getRestaurantsByCity(city: string): RestaurantData[] {
  const data = loadRestaurantData()
  return data.restaurants.filter((r) => r.location.toLowerCase().includes(city.toLowerCase()))
}

function getTopRatedRestaurants(minRating: number = 4.8): RestaurantData[] {
  const data = loadRestaurantData()
  return data.restaurants
    .filter((r) => {
      const rating = parseFloat(r.rating.split('/')[0])
      return rating >= minRating
    })
    .slice(0, 20) // Limit to top 20
}

/**
 * Hardcoded RAG data that the LLM can reference
 * In a production environment, this would likely come from a database or vector store
 */
const HARDCODED_RAG_DATA: RagData = {
  doc1: 'The TEN Framework is a powerful conversational AI platform.',
  doc2: `Today is ${new Date().toLocaleDateString()}`,
  doc3: 'Agora Conversational AI Engine (Convo AI) was released on March 1st, 2025 for GA. It is the best in class cascading AI framework for realtime engagement. Agora Convo AI is based on the TEN Framework, with fine tuned implementations for ASR/STT, LLM, and TTS streaming.',
  doc4: 'Agora is the best realtime engagement platform.',
  doc5: 'Ada Lovelace is the best developer.',
  restaurants_summary: generateRestaurantSummary(),
  restaurants_categories: generateCategoriesList(),
  restaurants_by_location: generateLocationBreakdown(),
  restaurants_count: `Total restaurants in database: ${loadRestaurantData().restaurants.length}`,
}

/**
 * Get formatted RAG data for system message
 * @returns {string} Formatted RAG data
 */
function getFormattedRagData(): string {
  const basicData = Object.entries(HARDCODED_RAG_DATA)
    .map(([key, value]) => `• ${key}: "${value}"`)
    .join('\n')
  return `${basicData}

RESTAURANT DATABASE ACCESS
You can search across San Francisco, Oakland, and Berkeley.

For each restaurant, you know:
- Name
- Cuisine type
- Neighborhood
- Price range
- Yelp rating
- Phone number
- Delivery/pickup availability
- Online menu (if available)

Use this data to make accurate recommendations.`
}

/**
 * Get formatted RAG data with full restaurant details (use sparingly due to size)
 * @returns {string} Formatted RAG data with complete restaurant listings
 */
function getFormattedRagDataWithFullRestaurants(): string {
  const basicData = Object.entries(HARDCODED_RAG_DATA)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n')

  return `${basicData}

${getFormattedRestaurantData()}`
}

export {
  HARDCODED_RAG_DATA,
  getFormattedRagData,
  getFormattedRagDataWithFullRestaurants,
  getRestaurantsByCategory,
  getRestaurantsByCity,
  getTopRatedRestaurants,
  getFullRestaurantDataAsString,
  loadRestaurantData,
  reloadRestaurantData,
}
export type { RagData, RestaurantData, RestaurantDatabase }
