const fetch = require('node-fetch')

// Test configuration
const BASE_URL = 'http://localhost:3001' // Adjust if your server runs on a different port
const TEST_MESSAGE = {
  model: 'ep-20250112091547-ddq88',
  messages: [{ role: 'user', content: 'Tell me about good restaurants for pizza' }],
  max_tokens: 100,
  temperature: 0.7,
}

// Function to test a specific route
async function testRoute(version) {
  const url = `${BASE_URL}/${version}/chat/completions`

  console.log(`\n🔍 Testing ${version} route: ${url}`)
  console.log('=' * 50)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer your-test-key-here', // Replace with actual key if needed
      },
      body: JSON.stringify(TEST_MESSAGE),
    })

    console.log(`Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Success!')

      if (data.choices && data.choices[0] && data.choices[0].message) {
        console.log('Response content:', data.choices[0].message.content.substring(0, 200) + '...')
      }

      // Check for tools in response (indicates version-specific functionality)
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls) {
        console.log('🔧 Tool calls detected:', data.choices[0].message.tool_calls.length)
      }
    } else {
      console.log('❌ Failed')
      const errorText = await response.text()
      console.log('Error:', errorText.substring(0, 300))
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message)
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Testing versioned chat completion routes...')
  console.log('Time:', new Date().toISOString())

  // Test all versions
  const versions = ['v1', 'v2', 'v3']

  for (const version of versions) {
    await testRoute(version)
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second between tests
  }

  console.log('\n✨ All tests completed!')
  console.log('\nNext steps:')
  console.log('1. Check that each version responds appropriately')
  console.log('2. Verify v1 uses local RAG data')
  console.log('3. Verify v2 mentions enhanced semantic search')
  console.log('4. Verify v3 mentions YELP integration')
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { testRoute, runTests }
