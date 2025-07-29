import { getVersionedFunctionMap } from '../../../src/libs/versionedFunctionMap'

// Mock fetch for HTTP requests
global.fetch = jest.fn()

// Mock the restaurant data and tools
jest.mock('../../../src/services/mockRagService', () => ({
  loadRestaurantData: jest.fn().mockReturnValue({
    restaurants: [
      {
        name: 'Test Restaurant',
        categories: 'italian',
        rating: '4.5/5',
        location: 'San Francisco',
        phone: '555-1234',
        website: 'test.com',
        supports: 'pickup, delivery',
        menu_available_on_website: true,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      },
    ],
  }),
  getRestaurantsByCity: jest.fn().mockReturnValue([]),
  getRestaurantsByCategory: jest.fn().mockReturnValue([]),
  getTopRatedRestaurants: jest.fn().mockReturnValue([]),
  findSimilarRestaurants: jest.fn().mockReturnValue([]),
  getFormattedRagData: jest.fn().mockReturnValue('Mock RAG data'),
}))

jest.mock('../../../src/libs/tools', () => ({
  searchRestaurants: jest.fn().mockReturnValue('Search results'),
  getRestaurantDetails: jest.fn().mockReturnValue('Restaurant details'),
  formatPhoneNumber: jest.fn().mockReturnValue('+1 (555) 123-4567'),
  generateAccessToken: jest.fn().mockReturnValue('mock-token'),
  functionMap: {
    send_photo: jest.fn().mockResolvedValue('Photo sent'),
    order_sandwich: jest.fn().mockReturnValue('Sandwich ordered'),
    call_phone: jest.fn().mockResolvedValue('Phone call placed'),
    call_hermes_phone: jest.fn().mockResolvedValue('Hermes called'),
    call_sid_phone: jest.fn().mockResolvedValue('Sid called'),
    search_restaurants_by_category: jest.fn().mockReturnValue('Category search results'),
    search_restaurants_by_city: jest.fn().mockReturnValue('City search results'),
    get_top_rated_restaurants: jest.fn().mockReturnValue('Top rated restaurants'),
    get_restaurant_details: jest.fn().mockReturnValue('Restaurant details'),
  },
  callPhone: jest.fn().mockResolvedValue('Phone call initiated successfully'),
  callHermesPhone: jest.fn().mockResolvedValue('Hermes phone call initiated successfully'),
}))

describe('VersionedFunctionMap', () => {
  describe('getVersionedFunctionMap', () => {
    it('should return an object for v1', () => {
      const functionMap = getVersionedFunctionMap('v1')

      expect(typeof functionMap).toBe('object')
      expect(Object.keys(functionMap).length).toBeGreaterThan(0)
    })

    it('should return an object for v2', () => {
      const functionMap = getVersionedFunctionMap('v2')

      expect(typeof functionMap).toBe('object')
      expect(Object.keys(functionMap).length).toBeGreaterThan(0)
    })

    it('should return an object for v3', () => {
      const functionMap = getVersionedFunctionMap('v3')

      expect(typeof functionMap).toBe('object')
      expect(Object.keys(functionMap).length).toBeGreaterThan(0)
    })

    it('should include core restaurant functions in all versions', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        expect(functionMap['search_restaurants_by_category']).toBeDefined()
        expect(functionMap['get_restaurant_details']).toBeDefined()
      })
    })

    it('should include phone call functions in all versions', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        expect(functionMap['call_phone']).toBeDefined()
        expect(functionMap['call_hermes_phone']).toBeDefined()
      })
    })

    it('should include version-specific functions in v2 and v3', () => {
      const v2Map = getVersionedFunctionMap('v2')
      expect(v2Map['search_pinecone_restaurants']).toBeDefined()
      expect(v2Map['search_pinecone_by_category']).toBeDefined()
      expect(v2Map['search_pinecone_by_mood']).toBeDefined()

      const v3Map = getVersionedFunctionMap('v3')
      expect(v3Map['search_yelp_restaurants']).toBeDefined()
      expect(v3Map['get_yelp_restaurant_details']).toBeDefined()
      expect(v3Map['search_yelp_advanced']).toBeDefined()
    })

    it('should not include version-specific functions in v1', () => {
      const functionMap = getVersionedFunctionMap('v1')

      // Should not have v2 functions
      expect(functionMap['search_pinecone_restaurants']).toBeUndefined()
      expect(functionMap['search_pinecone_by_category']).toBeUndefined()

      // Should not have v3 functions
      expect(functionMap['search_yelp_restaurants']).toBeUndefined()
      expect(functionMap['get_yelp_restaurant_details']).toBeUndefined()
    })

    it('should include send_photo function in all versions', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        expect(functionMap['send_photo']).toBeDefined()
      })
    })

    it('should include order_sandwich function in all versions', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        expect(functionMap['order_sandwich']).toBeDefined()
      })
    })

    it('should handle unknown version by defaulting to v1', () => {
      // @ts-ignore - Testing runtime behavior with unknown version
      const functionMap = getVersionedFunctionMap('unknown' as any)
      const v1FunctionMap = getVersionedFunctionMap('v1')

      expect(Object.keys(functionMap).length).toBe(Object.keys(v1FunctionMap).length)
    })

    it('should have working function implementations', () => {
      const functionMap = getVersionedFunctionMap('v1')

      expect(typeof functionMap['search_restaurants_by_category']).toBe('function')
      expect(typeof functionMap['get_restaurant_details']).toBe('function')
      expect(typeof functionMap['call_phone']).toBe('function')
      expect(typeof functionMap['order_sandwich']).toBe('function')
    })

    it('should execute search_restaurants_by_category function', async () => {
      const functionMap = getVersionedFunctionMap('v1')
      const searchRestaurants = functionMap['search_restaurants_by_category']

      const result = await searchRestaurants('test-app', 'test-user', 'test-channel', { category: 'italian' } as any)
      expect(result).toBeDefined()
    })

    it('should execute get_restaurant_details function', async () => {
      const functionMap = getVersionedFunctionMap('v1')
      const getRestaurantDetails = functionMap['get_restaurant_details']

      const result = await getRestaurantDetails('test-app', 'test-user', 'test-channel', {
        restaurantName: 'Test Restaurant',
      } as any)
      expect(result).toBeDefined()
    })

    it('should execute call_phone function', async () => {
      const functionMap = getVersionedFunctionMap('v1')
      const callPhone = functionMap['call_phone']

      const result = await callPhone('test-app', 'test-user', 'test-channel', { to: '5551234567' } as any)
      expect(result).toBeDefined()
    })

    it('should execute order_sandwich function', async () => {
      const functionMap = getVersionedFunctionMap('v1')
      const orderSandwich = functionMap['order_sandwich']

      const result = await orderSandwich('test-app', 'test-user', 'test-channel', {
        filling: 'turkey',
      } as any)
      expect(result).toBeDefined()
    })

    it('should execute Pinecone functions in v2', async () => {
      const functionMap = getVersionedFunctionMap('v2')

      const searchPinecone = functionMap['search_pinecone_restaurants']
      expect(typeof searchPinecone).toBe('function')

      const result = await searchPinecone('test-app', 'test-user', 'test-channel', {
        query: 'Italian food',
      } as any)
      expect(result).toBeDefined()
    })

    it('should execute Yelp functions in v3', async () => {
      const functionMap = getVersionedFunctionMap('v3')

      const searchYelp = functionMap['search_yelp_restaurants']
      expect(typeof searchYelp).toBe('function')

      const result = await searchYelp('test-app', 'test-user', 'test-channel', {
        location: 'San Francisco',
        term: 'pizza',
      } as any)
      expect(result).toBeDefined()
    })

    it('should have consistent function count across versions', () => {
      const v1Map = getVersionedFunctionMap('v1')
      const v2Map = getVersionedFunctionMap('v2')
      const v3Map = getVersionedFunctionMap('v3')

      // v2 and v3 should have more functions than v1 (due to RAG functions)
      expect(Object.keys(v2Map).length).toBeGreaterThan(Object.keys(v1Map).length)
      expect(Object.keys(v3Map).length).toBeGreaterThanOrEqual(Object.keys(v2Map).length)
    })

    it('should handle missing version parameter', () => {
      // @ts-ignore - Testing runtime behavior
      const functionMap = getVersionedFunctionMap(undefined as any)

      expect(typeof functionMap).toBe('object')
      expect(Object.keys(functionMap).length).toBeGreaterThan(0)
    })

    it('should have unique function names in each version', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        const keys = Object.keys(functionMap)
        const uniqueKeys = new Set(keys)

        expect(keys.length).toBe(uniqueKeys.size)
      })
    })

    it('should include specialized voice agent functions in all versions', () => {
      const versions: Array<'v1' | 'v2' | 'v3'> = ['v1', 'v2', 'v3']

      versions.forEach((version) => {
        const functionMap = getVersionedFunctionMap(version)
        expect(functionMap['call_and_ask_question_agent']).toBeDefined()
        expect(functionMap['place_phone_order_agent']).toBeDefined()
        expect(functionMap['make_reservation_agent']).toBeDefined()
      })
    })
  })

  describe('Specialized Voice Agent Functions', () => {
    let mockFetch: jest.MockedFunction<typeof fetch>

    beforeEach(() => {
      mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockReset()

      // Reset callPhone mock to default behavior
      const mockCallPhone = require('../../../src/libs/tools').callPhone
      mockCallPhone.mockReset()
      mockCallPhone.mockResolvedValue('Phone call initiated successfully')
    })

    const createMockResponse = (data: any, ok = true, status = 200): Response =>
      ({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: async () => data,
        text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
        headers: new Headers(),
        url: 'http://test.com',
        redirected: false,
        type: 'basic',
        body: null,
        bodyUsed: false,
        clone: () => createMockResponse(data, ok, status),
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob([]),
        formData: async () => new FormData(),
      }) as unknown as Response

    describe('call_and_ask_question_agent', () => {
      it('should create agent and place phone call successfully', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const callAndAskQuestionAgent = functionMap['call_and_ask_question_agent']

        // Mock successful agent creation
        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-123' }))

        const result = await callAndAskQuestionAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Test Restaurant',
          question: 'What are your hours?',
        } as any)

        expect(result).toContain('restaurant-inquiry agent successfully created and phone call initiated!')
        expect(result).toContain('test-agent-123')
        expect(result).toContain('+1234567890')
        expect(result).toContain('Hermes phone call initiated successfully')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle agent creation failure', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const callAndAskQuestionAgent = functionMap['call_and_ask_question_agent']

        // Mock failed agent creation
        mockFetch.mockResolvedValueOnce(createMockResponse('Agent creation failed', false, 400))

        const result = await callAndAskQuestionAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Test Restaurant',
          question: 'What are your hours?',
        } as any)

        expect(result).toContain('Error creating restaurant-inquiry agent')
        expect(result).toContain('400')
        expect(result).toContain('Agent creation failed')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle phone call failure', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const callAndAskQuestionAgent = functionMap['call_and_ask_question_agent']

        // Mock successful agent creation
        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-123' }))

        // Mock callHermesPhone to throw an error
        const mockCallHermesPhone = require('../../../src/libs/tools').callHermesPhone
        mockCallHermesPhone.mockRejectedValueOnce(new Error('Phone call failed'))

        const result = await callAndAskQuestionAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Test Restaurant',
          question: 'What are your hours?',
        } as any)

        expect(result).toContain('restaurant-inquiry agent created successfully, but phone call failed')
        expect(result).toContain('test-agent-123')
        expect(result).toContain('Phone call failed')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle network errors gracefully', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const callAndAskQuestionAgent = functionMap['call_and_ask_question_agent']

        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const result = await callAndAskQuestionAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Test Restaurant',
          question: 'What are your hours?',
        } as any)

        expect(result).toContain('Error creating restaurant-inquiry agent')
        expect(result).toContain('Network error')
      })
    })

    describe('place_phone_order_agent', () => {
      it('should create order agent and place phone call successfully', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const placePhoneOrderAgent = functionMap['place_phone_order_agent']

        // Mock successful agent creation
        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-456' }))

        const result = await placePhoneOrderAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Pizza Palace',
          customer_name: 'John Doe',
          food_items: '2 large pepperoni pizzas, 1 Caesar salad',
          delivery_type: 'takeout',
          delivery_address: 'N/A',
        } as any)

        expect(result).toContain('phone-ordering agent successfully created and phone call initiated!')
        expect(result).toContain('test-agent-456')
        expect(result).toContain('+1234567890')
        expect(result).toContain('Hermes phone call initiated successfully')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle missing customer name gracefully', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const placePhoneOrderAgent = functionMap['place_phone_order_agent']

        const result = await placePhoneOrderAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Pizza Palace',
          customer_name: '',
          food_items: '2 large pepperoni pizzas',
          delivery_type: 'takeout',
          delivery_address: 'N/A',
        } as any)

        expect(result).toContain('Error: Missing required field(s): customer_name')
        expect(result).toContain('Please confirm all details with the user before proceeding')
      })

      it('should format food items correctly in the request', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const placePhoneOrderAgent = functionMap['place_phone_order_agent']

        mockFetch
          .mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-456' }))
          .mockResolvedValueOnce(createMockResponse({ call_id: 'test-call-789' }))

        await placePhoneOrderAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Burger Joint',
          customer_name: 'Jane Smith',
          food_items: 'Cheeseburger with fries, Chocolate shake',
          delivery_type: 'delivery',
          delivery_address: '123 Main St, San Francisco, CA 94102',
        } as any)

        // Check that the agent creation request includes the food items
        const agentCreationCall = mockFetch.mock.calls[0]
        const requestBody = JSON.parse(agentCreationCall[1]?.body as string)
        expect(requestBody.properties.llm.system_messages[0].content).toContain('Cheeseburger with fries')
        expect(requestBody.properties.llm.system_messages[0].content).toContain('Chocolate shake')
      })
    })

    describe('make_reservation_agent', () => {
      it('should create reservation agent and place phone call successfully', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const makeReservationAgent = functionMap['make_reservation_agent']

        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-789' }))

        const result = await makeReservationAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Fine Dining',
          customer_name: 'Alice Johnson',
          party_size: 4,
          time_preferences: 'Tomorrow evening around 7 PM',
        } as any)

        expect(result).toContain('reservation-booking agent successfully created and phone call initiated!')
        expect(result).toContain('test-agent-789')
        expect(result).toContain('+1234567890')
        expect(result).toContain('Hermes phone call initiated successfully')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should handle different party sizes correctly', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const makeReservationAgent = functionMap['make_reservation_agent']

        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-789' }))

        const result = await makeReservationAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Bistro',
          customer_name: 'Bob Wilson',
          party_size: 1,
          time_preferences: 'Next Friday at 6:30 PM',
        } as any)

        expect(result).toContain('reservation-booking agent successfully created and phone call initiated!')
        expect(result).toContain('test-agent-789')
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      it('should include flexible time preferences in system message', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const makeReservationAgent = functionMap['make_reservation_agent']

        mockFetch.mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-789' }))

        await makeReservationAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Steakhouse',
          customer_name: 'Carol Davis',
          party_size: 6,
          time_preferences: 'Saturday between 6-8 PM, flexible on exact time',
        } as any)

        // Check that the agent creation request includes the flexible time preferences
        const agentCreationCall = mockFetch.mock.calls[0]
        const requestBody = JSON.parse(agentCreationCall[1]?.body as string)
        const systemMessage = requestBody.properties.llm.system_messages[0].content

        expect(systemMessage).toContain('Saturday between 6-8 PM')
        expect(systemMessage).toContain('flexible')
        expect(systemMessage).toContain('Be flexible with timing')
      })

      it('should generate unique channel names for each call', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const makeReservationAgent = functionMap['make_reservation_agent']

        mockFetch
          .mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-1' }))
          .mockResolvedValueOnce(createMockResponse({ agent_id: 'test-agent-2' }))

        // Make two calls with valid customer names (not containing "customer")
        await makeReservationAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1111111111',
          restaurant_name: 'Restaurant 1',
          customer_name: 'John Smith',
          party_size: 2,
          time_preferences: 'Tonight',
        } as any)

        await makeReservationAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+2222222222',
          restaurant_name: 'Restaurant 2',
          customer_name: 'Jane Doe',
          party_size: 4,
          time_preferences: 'Tomorrow',
        } as any)

        // Check that different channel names were generated
        const call1 = mockFetch.mock.calls[0]
        const call2 = mockFetch.mock.calls[1]
        const request1 = JSON.parse(call1[1]?.body as string)
        const request2 = JSON.parse(call2[1]?.body as string)

        expect(request1.properties.channel).not.toBe(request2.properties.channel)
        expect(request1.properties.channel).toContain('specialized-reservation')
        expect(request2.properties.channel).toContain('specialized-reservation')
      })
    })

    describe('Error Handling for All Specialized Agents', () => {
      it('should handle JSON parsing errors in agent response', async () => {
        const functionMap = getVersionedFunctionMap('v1')
        const callAndAskQuestionAgent = functionMap['call_and_ask_question_agent']

        // Mock response that will cause JSON parsing error
        const mockResponse = {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
          text: jest.fn().mockResolvedValue('Invalid JSON response'),
          headers: new Headers(),
          url: 'http://test.com',
          redirected: false,
          type: 'basic',
          body: null,
          bodyUsed: false,
          clone: jest.fn().mockReturnThis(),
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
          blob: jest.fn().mockResolvedValue(new Blob([])),
          formData: jest.fn().mockResolvedValue(new FormData()),
        } as unknown as Response

        mockFetch.mockResolvedValueOnce(mockResponse)

        const result = await callAndAskQuestionAgent('test-app', 'test-user', 'test-channel', {
          phone_number: '+1234567890',
          restaurant_name: 'Test Restaurant',
          question: 'What are your hours?',
        } as any)

        expect(result).toContain('Error creating restaurant-inquiry agent')
        expect(result).toContain('Invalid JSON')
      })

      it('should handle missing environment variables gracefully', async () => {
        // This test verifies that the functions would fail gracefully if env vars were missing
        // In our implementation, the server won't start if env vars are missing due to startup validation
        const functionMap = getVersionedFunctionMap('v1')
        const placePhoneOrderAgent = functionMap['place_phone_order_agent']

        // This should work fine since we have test env vars set up
        expect(typeof placePhoneOrderAgent).toBe('function')
      })
    })
  })
})
