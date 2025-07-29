import { Pinecone } from '@pinecone-database/pinecone'

// Configuration from environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'restaurants'
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'pinecone'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Provider-specific settings
const EMBEDDING_CONFIG = {
  openai: { model: 'text-embedding-3-small', dimension: 1536 },
  pinecone: { model: 'multilingual-e5-large', dimension: 1024 },
}

const EMBEDDING_MODEL = EMBEDDING_CONFIG[EMBEDDING_PROVIDER as keyof typeof EMBEDDING_CONFIG]?.model

interface QueryResult {
  id: string
  name: string
  categories: string
  rating: string
  location: string
  price_range: string
  phone: string
  website: string
  supports: string
  score: number
}

class PineconeRagService {
  private pinecone: Pinecone | null = null
  private indexName: string
  private embeddingProvider: 'openai' | 'pinecone'
  private openaiApiKey?: string

  constructor() {
    // Initialize properties first
    this.indexName = PINECONE_INDEX_NAME
    this.embeddingProvider = EMBEDDING_PROVIDER as 'openai' | 'pinecone'
    this.openaiApiKey = OPENAI_API_KEY

    if (!PINECONE_API_KEY) {
      console.warn('PINECONE_API_KEY not configured. Pinecone service will be disabled.')
      return
    }

    if (this.embeddingProvider === 'openai' && !this.openaiApiKey) {
      console.warn('OpenAI API key required when using OpenAI embeddings')
      return
    }

    this.pinecone = new Pinecone({
      apiKey: PINECONE_API_KEY,
    })
  }

  /**
   * Generate embeddings using the configured provider
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (this.embeddingProvider === 'openai') {
      return await this.generateOpenAIEmbedding(text)
    } else {
      return await this.generatePineconeEmbedding(text)
    }
  }

  /**
   * Generate embeddings using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  /**
   * Generate embeddings using Pinecone's Inference API
   */
  private async generatePineconeEmbedding(text: string): Promise<number[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone client not initialized')
    }

    const inference = this.pinecone.inference
    const response = await inference.embed(EMBEDDING_MODEL!, [text], { inputType: 'passage', truncate: 'END' })

    const embedding = response.data[0]
    if ('values' in embedding) {
      return embedding.values
    } else {
      throw new Error('Received sparse embedding, expected dense embedding')
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return this.pinecone !== null
  }

  /**
   * Search for restaurants using semantic similarity
   */
  async searchRestaurants(
    query: string,
    options: {
      topK?: number
      filters?: Record<string, unknown>
    } = {},
  ): Promise<QueryResult[]> {
    if (!this.pinecone) {
      throw new Error('Pinecone service not configured')
    }

    const { topK = 5, filters } = options
    const index = this.pinecone.index(this.indexName)

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query)

    // Search Pinecone
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: filters,
    })

    // Format results
    return (
      queryResponse.matches?.map((match) => ({
        id: match.id || '',
        name: (match.metadata?.name as string) || '',
        categories: (match.metadata?.categories as string) || '',
        rating: (match.metadata?.rating as string) || '',
        location: (match.metadata?.location as string) || '',
        price_range: (match.metadata?.price_range as string) || '',
        phone: (match.metadata?.phone as string) || '',
        website: (match.metadata?.website as string) || '',
        supports: (match.metadata?.supports as string) || '',
        score: match.score || 0,
      })) || []
    )
  }

  /**
   * Search restaurants by category with semantic understanding
   */
  async searchByCategory(category: string, topK: number = 10): Promise<QueryResult[]> {
    const query = `${category} restaurants food cuisine`
    return this.searchRestaurants(query, { topK })
  }

  /**
   * Search restaurants by location with semantic understanding
   */
  async searchByLocation(location: string, topK: number = 10): Promise<QueryResult[]> {
    const query = `restaurants in ${location} dining food`
    return this.searchRestaurants(query, { topK })
  }

  /**
   * Search for restaurants with specific features/mood
   */
  async searchByMood(mood: string, topK: number = 10): Promise<QueryResult[]> {
    const query = `restaurants for ${mood} dining experience mood atmosphere`
    return this.searchRestaurants(query, { topK })
  }

  /**
   * Test connection to Pinecone index
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pinecone) {
        return false
      }
      const index = this.pinecone.index(this.indexName)
      await index.describeIndexStats()
      return true
    } catch (error) {
      console.error('Pinecone connection test failed:', error)
      return false
    }
  }
}

// Singleton instance
let pineconeRagServiceInstance: PineconeRagService | null = null

/**
 * Get or create singleton instance
 */
export function getPineconeRagService(): PineconeRagService {
  if (!pineconeRagServiceInstance) {
    pineconeRagServiceInstance = new PineconeRagService()
  }
  return pineconeRagServiceInstance
}

/**
 * Convenience function for searching restaurants (returns formatted string for LLM)
 */
export async function searchPineconeRestaurants(query: string, topK: number = 5): Promise<string> {
  try {
    const service = getPineconeRagService()

    if (!service.isConfigured()) {
      return 'Pinecone integration not configured. Please set PINECONE_API_KEY and other required environment variables.'
    }

    const results = await service.searchRestaurants(query, { topK })

    if (results.length === 0) {
      return `No restaurants found for query: "${query}". The database may be empty or the query might be too specific.`
    }

    const formattedResults = results
      .map((restaurant, index) => {
        return `${index + 1}. **${restaurant.name}** (${restaurant.categories})
   📍 ${restaurant.location}
   ⭐ ${restaurant.rating} | 💰 ${restaurant.price_range}
   📞 ${restaurant.phone}
   🌐 ${restaurant.website}
   🚚 ${restaurant.supports}
   🔗 Match: ${(restaurant.score * 100).toFixed(1)}%`
      })
      .join('\n\n')

    return `Found ${results.length} restaurants for "${query}":\n\n${formattedResults}`
  } catch (error) {
    console.error('Pinecone search error:', error)
    return `Error searching restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export { PineconeRagService, type QueryResult }
