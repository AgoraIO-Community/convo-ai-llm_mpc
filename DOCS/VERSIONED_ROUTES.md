# Versioned Chat Completion Routes

This document explains the three versions of the chat completion API and their differences.

## Overview

The API now supports three versioned endpoints:

- **v1**: `/v1/chat/completions` - Original local RAG implementation
- **v2**: `/v2/chat/completions` - Enhanced with Pinecone vector search
- **v3**: `/v3/chat/completions` - Real-time YELP API integration

The legacy `/chat/completions` endpoint defaults to v1 behavior.

## Route Endpoints

### v1 Route: Local RAG (Original)

**Endpoint**: `POST /v1/chat/completions`

Uses the original local restaurant database with basic search functionality.

**Features**:

- Static restaurant database (loaded from JSON)
- Basic category and location search
- Cached restaurant data
- All original phone call and photo tools

**Tools Available**:

- `search_restaurants_by_category`
- `search_restaurants_by_city`
- `get_top_rated_restaurants`
- `get_restaurant_details`
- `send_photo`
- `call_phone`
- `call_hermes_phone`
- `call_sid_phone`
- `order_sandwich`

### v2 Route: Pinecone Vector Search

**Endpoint**: `POST /v2/chat/completions`

Enhanced semantic search using Pinecone vector database for more intelligent restaurant recommendations.

**Features**:

- Semantic similarity search
- Context-aware recommendations
- Better understanding of user intent
- Same tools as v1 but with enhanced backend

**Environment Variables Required**:

```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX=restaurants
```

**Note**: Currently uses placeholder implementation. To fully implement:

1. Set up Pinecone index with restaurant embeddings
2. Implement embedding generation for queries
3. Replace placeholder with actual Pinecone SDK calls

### v3 Route: Live YELP API

**Endpoint**: `POST /v3/chat/completions`

Real-time restaurant data from YELP API with live information.

**Features**:

- Live restaurant search across any location
- Real-time business hours and availability
- Current ratings and recent reviews
- Up-to-date contact information
- All v1 tools plus new YELP-specific tools

**Additional Tools**:

- `search_yelp_restaurants` - Search YELP by location and cuisine
- `get_yelp_restaurant_details` - Get detailed business information

**Environment Variables Required**:

```bash
YELP_API_KEY=your-yelp-api-key
```

## Usage Examples

### Basic Request (All Versions)

```bash
curl -X POST "http://localhost:3000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find me good pizza places in San Francisco"
      }
    ],
    "stream": false
  }'
```

### v3 YELP-Specific Search

```bash
curl -X POST "http://localhost:3000/v3/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find me highly rated sushi restaurants currently open in Oakland"
      }
    ],
    "stream": false
  }'
```

## Function Calling Examples

### v1/v2 Local Search

The assistant can call:

```json
{
  "name": "search_restaurants_by_category",
  "arguments": {
    "category": "Italian"
  }
}
```

### v3 YELP Search

The assistant can call:

```json
{
  "name": "search_yelp_restaurants",
  "arguments": {
    "location": "San Francisco, CA",
    "term": "pizza",
    "limit": 10
  }
}
```

## Migration Guide

### From v1 to v2

1. Add Pinecone environment variables
2. Update endpoint URL to `/v2/chat/completions`
3. No other changes required - same tools and interface

### From v1 to v3

1. Add YELP API key
2. Update endpoint URL to `/v3/chat/completions`
3. Take advantage of new real-time data and YELP-specific tools

## Implementation Details

### Route Handler

All versions use the same route handler with different configurations:

- Version-specific system messages
- Version-specific tool sets
- Version-specific function implementations

### Tool Resolution

- v1: Uses original local functions
- v2: Uses original functions (with potential Pinecone backend)
- v3: Uses original functions + YELP API functions

### Error Handling

Each version gracefully handles missing API keys:

- v2: Falls back to local data if Pinecone not configured
- v3: Returns error message if YELP API key missing

## Configuration

Add these environment variables to enable enhanced features:

```bash
# For v2 Pinecone integration
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX=restaurants

# For v3 YELP integration
YELP_API_KEY=your-yelp-api-key
```

## Benefits by Version

| Feature         | v1  | v2  | v3  |
| --------------- | --- | --- | --- |
| Local data      | ✅  | ✅  | ✅  |
| Semantic search | ❌  | ✅  | ❌  |
| Real-time data  | ❌  | ❌  | ✅  |
| Business hours  | ❌  | ❌  | ✅  |
| Live reviews    | ❌  | ❌  | ✅  |
| Any location    | ❌  | ❌  | ✅  |
| Fast response   | ✅  | ⚡  | ⚡  |

Choose the version that best fits your use case!
