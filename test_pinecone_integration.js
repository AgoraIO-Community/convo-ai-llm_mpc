const { config } = require('dotenv')
config()

// Import the functions we want to test
const { getVersionedFunctionMap } = require('./dist/libs/versionedFunctionMap')
const { getPineconeRagService } = require('./dist/services/pineconeRagService')

async function testPineconeIntegration() {
  console.log('🔍 Testing Pinecone Integration...\n')

  // Test 1: Check environment variables
  console.log('1. Environment Configuration:')
  console.log(`   PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Not set'}`)
  console.log(`   PINECONE_INDEX_NAME: ${process.env.PINECONE_INDEX_NAME || 'restaurants (default)'}`)
  console.log(`   EMBEDDING_PROVIDER: ${process.env.EMBEDDING_PROVIDER || 'pinecone (default)'}`)

  if (process.env.EMBEDDING_PROVIDER === 'openai') {
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`)
  }
  console.log()

  // Test 2: Service initialization
  console.log('2. Service Initialization:')
  try {
    const service = getPineconeRagService()
    const isConfigured = service.isConfigured()
    console.log(`   Pinecone Service: ${isConfigured ? '✅ Configured' : '❌ Not configured'}`)

    if (isConfigured) {
      const connectionTest = await service.testConnection()
      console.log(`   Pinecone Connection: ${connectionTest ? '✅ Connected' : '❌ Connection failed'}`)
    }
  } catch (error) {
    console.log(`   ❌ Service initialization error: ${error.message}`)
  }
  console.log()

  // Test 3: Function map
  console.log('3. Function Map (v2):')
  try {
    const functionMap = getVersionedFunctionMap('v2')
    const pineconeFunction = functionMap.search_pinecone_restaurants
    console.log(`   search_pinecone_restaurants: ${pineconeFunction ? '✅ Available' : '❌ Missing'}`)
    console.log(
      `   search_pinecone_by_category: ${functionMap.search_pinecone_by_category ? '✅ Available' : '❌ Missing'}`,
    )
    console.log(`   search_pinecone_by_mood: ${functionMap.search_pinecone_by_mood ? '✅ Available' : '❌ Missing'}`)
  } catch (error) {
    console.log(`   ❌ Function map error: ${error.message}`)
  }
  console.log()

  // Test 4: Actual search (if configured)
  if (process.env.PINECONE_API_KEY) {
    console.log('4. Search Test:')
    try {
      const functionMap = getVersionedFunctionMap('v2')
      const searchFunction = functionMap.search_pinecone_restaurants

      if (searchFunction) {
        console.log('   Testing search with query "pizza restaurants"...')
        const result = await searchFunction('test-app', 'test-user', 'test-channel', {
          query: 'pizza restaurants',
          limit: 3,
        })

        if (result.includes('Error') || result.includes('not configured')) {
          console.log(`   ❌ Search failed: ${result.substring(0, 100)}...`)
        } else {
          console.log('   ✅ Search successful!')
          console.log(`   Sample result: ${result.substring(0, 200)}...`)
        }
      } else {
        console.log('   ❌ Search function not available')
      }
    } catch (error) {
      console.log(`   ❌ Search test error: ${error.message}`)
    }
  } else {
    console.log('4. Search Test: ⏭️  Skipped (PINECONE_API_KEY not set)')
  }
  console.log()

  console.log('🎯 Integration Test Complete!')
  console.log('\n📋 Next Steps:')
  console.log('   1. Set your environment variables in .env file')
  console.log('   2. Make sure your Pinecone index has data (run pinecone-rag-builder setup)')
  console.log('   3. Test the API endpoints with version v2')
  console.log('   4. Use /v2/chat/completion with restaurant search queries')
}

// Run the test
if (require.main === module) {
  testPineconeIntegration().catch(console.error)
}

module.exports = { testPineconeIntegration }
