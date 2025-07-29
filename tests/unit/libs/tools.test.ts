import {
  orderSandwich,
  formatPhoneNumber,
  searchRestaurantsByCategory,
  searchRestaurantsByCity,
  getTopRatedRestaurantsList,
  getRestaurantDetails,
  generateTokenForPSTN,
} from '../../../src/libs/tools'

// Mock the config and services before importing
jest.mock('../../../src/libs/utils', () => ({
  config: {
    agora: {
      appCertificate: 'test-certificate',
      authToken: 'test-auth-token',
    },
    agentId: 'test-agent-id',
  },
}))

jest.mock('../../../src/services/mockRagService', () => ({
  getRestaurantsByCategory: jest.fn().mockReturnValue([
    { name: 'Test Pizza Place', categories: 'pizza', rating: '4.5/5' },
    { name: 'Another Pizza Spot', categories: 'pizza', rating: '4.2/5' },
  ]),
  getRestaurantsByCity: jest.fn().mockReturnValue([
    { name: 'SF Restaurant', location: 'San Francisco', rating: '4.8/5' },
    { name: 'SF Cafe', location: 'San Francisco', rating: '4.3/5' },
  ]),
  getTopRatedRestaurants: jest.fn().mockReturnValue([
    { name: 'Top Restaurant', rating: '4.9/5' },
    { name: 'Great Restaurant', rating: '4.8/5' },
  ]),
  loadRestaurantData: jest.fn().mockReturnValue({
    restaurants: [
      {
        name: 'Specific Restaurant',
        categories: 'italian',
        rating: '4.7/5',
        location: 'San Francisco',
        phone: '555-1234',
        website: 'test.com',
        supports: 'pickup, delivery',
        menu_available_on_website: true,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      },
    ],
  }),
}))

describe('Tools Functions', () => {
  describe('orderSandwich', () => {
    it('should return confirmation message for sandwich order', () => {
      const result = orderSandwich('user123', 'channel456', 'turkey')
      expect(result).toBe('Sandwich ordered with turkey. Enjoy!')
    })

    it('should handle different fillings', () => {
      const result = orderSandwich('user123', 'channel456', 'ham and cheese')
      expect(result).toBe('Sandwich ordered with ham and cheese. Enjoy!')
    })
  })

  describe('formatPhoneNumber', () => {
    it('should format US phone number without country code', () => {
      const result = formatPhoneNumber('5551234567')
      expect(result).toBe('+15551234567')
    })

    it('should format phone number with country code', () => {
      const result = formatPhoneNumber('15551234567')
      expect(result).toBe('+15551234567')
    })

    it('should handle phone number with formatting characters', () => {
      const result = formatPhoneNumber('(555) 123-4567')
      expect(result).toBe('+15551234567')
    })

    it('should handle phone number with spaces and dashes', () => {
      const result = formatPhoneNumber('555-123-4567')
      expect(result).toBe('+15551234567')
    })

    it('should handle international number with + prefix', () => {
      const result = formatPhoneNumber('+15551234567')
      expect(result).toBe('+15551234567')
    })
  })

  describe('searchRestaurantsByCategory', () => {
    it('should return formatted restaurant search results by category', () => {
      const result = searchRestaurantsByCategory('app123', 'user456', 'channel789', 'pizza')

      expect(result).toContain('Found 2 restaurants for')
      expect(result).toContain('pizza')
      expect(result).toContain('Test Pizza Place')
      expect(result).toContain('Another Pizza Spot')
    })

    it('should handle empty category gracefully', () => {
      const result = searchRestaurantsByCategory('app123', 'user456', 'channel789', '')
      expect(typeof result).toBe('string')
    })
  })

  describe('searchRestaurantsByCity', () => {
    it('should return formatted restaurant search results by city', () => {
      const result = searchRestaurantsByCity('app123', 'user456', 'channel789', 'San Francisco')

      expect(result).toContain('Found 2 restaurants in')
      expect(result).toContain('San Francisco')
      expect(result).toContain('SF Restaurant')
      expect(result).toContain('SF Cafe')
    })

    it('should handle different cities', () => {
      const result = searchRestaurantsByCity('app123', 'user456', 'channel789', 'New York')
      expect(typeof result).toBe('string')
      expect(result).toContain('New York')
    })
  })

  describe('getTopRatedRestaurantsList', () => {
    it('should return top rated restaurants with default rating', () => {
      const result = getTopRatedRestaurantsList('app123', 'user456', 'channel789')

      expect(result).toContain('Found 2 highly-rated restaurants')
      expect(result).toContain('Top Restaurant')
      expect(result).toContain('Great Restaurant')
    })

    it('should handle custom minimum rating', () => {
      const result = getTopRatedRestaurantsList('app123', 'user456', 'channel789', 4.5)

      expect(result).toContain('4.5')
      expect(typeof result).toBe('string')
    })
  })

  describe('getRestaurantDetails', () => {
    it('should return restaurant details for existing restaurant', () => {
      const result = getRestaurantDetails('app123', 'user456', 'channel789', 'Specific Restaurant')

      expect(result).toContain('Specific Restaurant')
      expect(result).toContain('Categories: italian')
    })

    it('should handle non-existent restaurant', () => {
      const result = getRestaurantDetails('app123', 'user456', 'channel789', 'Non-existent Restaurant')
      expect(typeof result).toBe('string')
    })
  })

  describe('generateTokenForPSTN', () => {
    it('should generate token successfully', async () => {
      // Mock the agora-token module
      jest.doMock('agora-token', () => ({
        RtcTokenBuilder: {
          buildTokenWithUid: jest.fn().mockReturnValue('mock-token-12345'),
        },
        RtcRole: {
          PUBLISHER: 1,
        },
      }))

      const result = await generateTokenForPSTN('app123', 'channel456', '789')
      expect(typeof result).toBe('string')
    })

    it('should handle successful token generation', async () => {
      const result = await generateTokenForPSTN('app123', 'channel456', '789')
      expect(typeof result).toBe('string')
    })
  })
})
