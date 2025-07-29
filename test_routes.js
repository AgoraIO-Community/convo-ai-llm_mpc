// Quick test script to verify versioned routes
const axios = require('axios')

const baseURL = 'http://localhost:3000'
const authToken = 'your-auth-token' // Replace with actual token

async function testRoute(version, endpoint) {
  console.log(`\n🧪 Testing ${version} route: ${endpoint}`)

  try {
    const response = await axios.post(
      `${baseURL}${endpoint}`,
      {
        messages: [
          {
            role: 'user',
            content: 'Hello, can you help me find restaurants?',
          },
        ],
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    )

    console.log(`✅ ${version} route working!`)
    console.log(`Status: ${response.status}`)
    console.log(`Response type: ${typeof response.data}`)
  } catch (error) {
    console.log(`❌ ${version} route error:`)
    if (error.response) {
      console.log(`Status: ${error.response.status}`)
      console.log(`Error: ${error.response.data?.error || 'Unknown error'}`)
    } else {
      console.log(`Network error: ${error.message}`)
    }
  }
}

async function runTests() {
  console.log('🚀 Testing versioned chat completion routes...\n')

  const routes = [
    { version: 'v1', endpoint: '/v1/chat/completions' },
    { version: 'v2', endpoint: '/v2/chat/completions' },
    { version: 'v3', endpoint: '/v3/chat/completions' },
    { version: 'legacy', endpoint: '/chat/completions' },
  ]

  for (const route of routes) {
    await testRoute(route.version, route.endpoint)
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second between tests
  }

  console.log('\n✨ Tests completed!')
  console.log('\n📝 Next steps:')
  console.log('1. Set YELP_API_KEY environment variable for v3 functionality')
  console.log('2. Set PINECONE_API_KEY for v2 enhanced features')
  console.log('3. Replace auth token in this script with your actual token')
}

runTests().catch(console.error)
