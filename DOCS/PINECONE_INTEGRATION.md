# Pinecone RAG Integration Guide

This guide explains how to set up and use the Pinecone-powered semantic search for restaurant recommendations (API version v2).

## Overview

The v2 API endpoint (`/v2/chat/completions`) uses Pinecone vector database to provide intelligent, semantic restaurant search capabilities. Instead of keyword matching, it understands context and provides more nuanced recommendations.

## Features

- **Semantic Search**: Find restaurants based on natural language queries like "romantic dinner spot" or "late night food"
- **Category Matching**: Search by cuisine with intelligent understanding (e.g., "asian" matches Thai, Chinese, Japanese, etc.)
- **Mood-Based Search**: Find restaurants that match specific moods or occasions
- **Similarity Scoring**: Results include relevance scores showing how well they match your query

## Setup

### 1. Environment Configuration

Add these variables to your `.env` file:

```bash
# Pinecone Configuration (for v2 route - semantic search)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=restaurants
EMBEDDING_PROVIDER=pinecone  # 'pinecone' or 'openai'

# OpenAI (only required if EMBEDDING_PROVIDER=openai)
OPENAI_API_KEY=your-openai-api-key
```

### 2. Pinecone Index Setup

**Option A: Use the provided restaurant data**

If you want to use the curated SF restaurant dataset:

```bash
cd ../pinecone-rag-builder
cp env.example .env
# Edit .env with your Pinecone credentials
pnpm install
pnpm run setup
```

**Option B: Use your own data**

1. Replace the data in `pinecone-rag-builder/data/sf_restaurants_for_llm.json`
2. Run the setup script

### 3. Test the Integration

```bash
npm run test:pinecone
```

This will verify:

- Environment variables are set
- Pinecone service connects successfully
- Functions are available
- Search functionality works

## Available Tools (v2)

### `search_pinecone_restaurants`

General semantic search for restaurants.

**Parameters:**

- `query` (required): Natural language search query
- `limit` (optional): Number of results (default 5, max 20)

**Example queries:**

- "best pizza in the city"
- "romantic dinner spot"
- "late night food"
- "healthy options"

### `search_pinecone_by_category`

Search by cuisine category with semantic understanding.

**Parameters:**

- `category` (required): Cuisine or category type
- `limit` (optional): Number of results (default 10, max 20)

**Example categories:**

- "italian", "asian", "mexican"
- "seafood", "vegetarian", "vegan"
- "fast food", "fine dining"

### `search_pinecone_by_mood`

Find restaurants matching specific moods or occasions.

**Parameters:**

- `mood` (required): Mood, occasion, or dining experience
- `limit` (optional): Number of results (default 10, max 20)

**Example moods:**

- "romantic", "casual", "celebration"
- "business lunch", "date night"
- "family friendly", "quiet"

## API Usage

### Chat Completion Request

```bash
curl -X POST http://localhost:3000/v2/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer your-auth-token" \
-d '{
  "messages": [
    {
      "role": "user",
      "content": "I want a romantic restaurant for a date night"
    }
  ],
  "stream": false
}'
```

### Function Call Examples

The AI will automatically use the appropriate Pinecone functions based on the user's request:

- **"Find me Italian restaurants"** → `search_pinecone_by_category`
- **"I want somewhere romantic"** → `search_pinecone_by_mood`
- **"Best pizza place"** → `search_pinecone_restaurants`

## Configuration Options

### Embedding Providers

**Pinecone Embeddings (Recommended)**

- Model: `multilingual-e5-large`
- Dimension: 1024
- Faster and included with Pinecone

**OpenAI Embeddings**

- Model: `text-embedding-3-small`
- Dimension: 1536
- Requires separate OpenAI API key

Set `EMBEDDING_PROVIDER=openai` and provide `OPENAI_API_KEY` to use OpenAI embeddings.

## Troubleshooting

### Common Issues

1. **"Pinecone integration not configured"**

   - Check `PINECONE_API_KEY` is set
   - Verify index name matches `PINECONE_INDEX_NAME`

2. **"No restaurants found"**

   - Index may be empty - run the data upload process
   - Try broader search terms

3. **"Connection failed"**
   - Verify Pinecone API key is valid
   - Check index exists and is active

### Debug Steps

1. Run the test script: `npm run test:pinecone`
2. Check server logs for detailed error messages
3. Verify your Pinecone index has data:
   ```bash
   cd ../pinecone-rag-builder
   pnpm run stats
   ```

## Performance Notes

- **Search Speed**: ~200-500ms per query (depends on embedding provider)
- **Batch Limits**: Max 20 results per search to maintain response speed
- **Rate Limits**: Respects Pinecone API rate limits automatically

## Migration from v1

If you're currently using v1 (static data), migrating to v2 provides:

- Better semantic understanding
- More relevant results
- Contextual recommendations
- Similarity scoring

Simply change your endpoint from `/v1/chat/completions` to `/v2/chat/completions`.

## Data Format

Your restaurant data should follow this structure:

```json
{
  "restaurants": [
    {
      "name": "Restaurant Name",
      "categories": "Italian, Pizza",
      "rating": "4.5",
      "location": "123 Main St, City, State",
      "price_range": "$$",
      "phone": "+1-555-123-4567",
      "website": "https://example.com",
      "supports": "Delivery, Takeout",
      "menu_available_on_website": true,
      "coordinates": {
        "latitude": 37.7749,
        "longitude": -122.4194
      }
    }
  ]
}
```

## Next Steps

1. Set up your environment variables
2. Upload your restaurant data to Pinecone
3. Test the integration
4. Start using `/v2/chat/completions` endpoint
5. Monitor performance and adjust parameters as needed
