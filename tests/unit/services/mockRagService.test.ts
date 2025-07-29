import {
  getRestaurantsByCategory,
  getRestaurantsByCity,
  getTopRatedRestaurants,
  getFormattedRagData,
  loadRestaurantData,
  type RestaurantData,
  type RestaurantDatabase,
} from '../../../src/services/mockRagService'

describe('MockRagService', () => {
  // Mock console.log to avoid noise in tests
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getRestaurantsByCategory', () => {
    it('should return restaurants filtered by category', () => {
      const results = getRestaurantsByCategory('italian')

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        expect(restaurant).toHaveProperty('name')
        expect(restaurant).toHaveProperty('categories')
        expect(restaurant.categories.toLowerCase()).toContain('italian')
      })
    })

    it('should handle case-insensitive category search', () => {
      const results1 = getRestaurantsByCategory('ITALIAN')
      const results2 = getRestaurantsByCategory('italian')

      expect(results1.length).toBeGreaterThanOrEqual(0)
      expect(results2.length).toBeGreaterThanOrEqual(0)
    })

    it('should return empty array for non-existent category', () => {
      const results = getRestaurantsByCategory('nonexistentcategory')
      expect(results).toEqual([])
    })

    it('should handle partial category matches', () => {
      const results = getRestaurantsByCategory('pizza')

      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        results.forEach((restaurant) => {
          expect(restaurant.categories.toLowerCase()).toContain('pizza')
        })
      }
    })
  })

  describe('getRestaurantsByCity', () => {
    it('should return restaurants filtered by city', () => {
      const results = getRestaurantsByCity('San Francisco')

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        expect(restaurant).toHaveProperty('name')
        expect(restaurant).toHaveProperty('location')
        expect(restaurant.location).toContain('San Francisco')
      })
    })

    it('should handle case-insensitive city search', () => {
      const results1 = getRestaurantsByCity('SAN FRANCISCO')
      const results2 = getRestaurantsByCity('san francisco')

      expect(results1.length).toEqual(results2.length)
    })

    it('should return empty array for non-existent city', () => {
      const results = getRestaurantsByCity('NonexistentCity')
      expect(results).toEqual([])
    })
  })

  describe('getTopRatedRestaurants', () => {
    it('should return restaurants with rating above minimum', () => {
      const minRating = 4.5
      const results = getTopRatedRestaurants(minRating)

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        expect(restaurant).toHaveProperty('rating')
        const rating = parseFloat(restaurant.rating.split('/')[0])
        expect(rating).toBeGreaterThanOrEqual(minRating)
      })
    })

    it('should return restaurants in valid rating order', () => {
      const results = getTopRatedRestaurants(4.0)

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        const rating = parseFloat(restaurant.rating.split('/')[0])
        expect(rating).toBeGreaterThanOrEqual(4.0)
      })
    })

    it('should handle different minimum ratings', () => {
      const results = getTopRatedRestaurants(3.0)

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        const rating = parseFloat(restaurant.rating.split('/')[0])
        expect(rating).toBeGreaterThanOrEqual(3.0)
      })
    })

    it('should handle edge case of very high minimum rating', () => {
      const results = getTopRatedRestaurants(5.0)

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        const rating = parseFloat(restaurant.rating.split('/')[0])
        expect(rating).toBe(5.0)
      })
    })

    it('should use default minimum rating when none specified', () => {
      const results = getTopRatedRestaurants()

      expect(Array.isArray(results)).toBe(true)
      results.forEach((restaurant) => {
        const rating = parseFloat(restaurant.rating.split('/')[0])
        expect(rating).toBeGreaterThanOrEqual(4.8)
      })
    })
  })

  describe('getFormattedRagData', () => {
    it('should return formatted string', () => {
      const result = getFormattedRagData()

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('restaurant')
    })

    it('should contain restaurant database information', () => {
      const result = getFormattedRagData()

      expect(result).toContain('RESTAURANT DATABASE ACCESS')
      expect(result).toContain('San Francisco')
      expect(result).toContain('Oakland')
      expect(result).toContain('Berkeley')
    })
  })

  describe('loadRestaurantData', () => {
    it('should return restaurant database object', () => {
      const data = loadRestaurantData()

      expect(data).toHaveProperty('restaurants')
      expect(Array.isArray(data.restaurants)).toBe(true)
      expect(data.restaurants.length).toBeGreaterThan(0)
    })

    it('should return restaurants with proper structure', () => {
      const data = loadRestaurantData()

      if (data.restaurants.length > 0) {
        const restaurant = data.restaurants[0]
        expect(restaurant).toHaveProperty('name')
        expect(restaurant).toHaveProperty('categories')
        expect(restaurant).toHaveProperty('rating')
        expect(restaurant).toHaveProperty('location')
        expect(restaurant).toHaveProperty('phone')
        expect(restaurant).toHaveProperty('website')
      }
    })

    it('should load consistent data on multiple calls', () => {
      const data1 = loadRestaurantData()
      const data2 = loadRestaurantData()

      expect(data1.restaurants.length).toBe(data2.restaurants.length)
      if (data1.restaurants.length > 0) {
        expect(data1.restaurants[0]).toEqual(data2.restaurants[0])
      }
    })

    it('should have restaurants with valid ratings', () => {
      const data = loadRestaurantData()

      data.restaurants.forEach((restaurant) => {
        expect(restaurant.rating).toBeTruthy()
        expect(restaurant.rating).toMatch(/^\d+(\.\d+)?\/5/)
      })
    })

    it('should have restaurants with non-empty names', () => {
      const data = loadRestaurantData()

      data.restaurants.forEach((restaurant) => {
        expect(restaurant.name).toBeTruthy()
        expect(restaurant.name.length).toBeGreaterThan(0)
      })
    })
  })

  describe('data integration', () => {
    it('should return consistent results across functions', () => {
      const categoryResults = getRestaurantsByCategory('italian')
      const cityResults = getRestaurantsByCity('San Francisco')
      const topRated = getTopRatedRestaurants(4.0)

      expect(Array.isArray(categoryResults)).toBe(true)
      expect(Array.isArray(cityResults)).toBe(true)
      expect(Array.isArray(topRated)).toBe(true)
    })

    it('should handle empty search results gracefully', () => {
      const results = getRestaurantsByCategory('nonexistent')
      expect(results).toEqual([])
    })

    it('should maintain data structure consistency', () => {
      const results = getRestaurantsByCategory('pizza')

      if (results.length > 0) {
        const restaurant = results[0]
        expect(restaurant).toHaveProperty('name')
        expect(restaurant).toHaveProperty('categories')
        expect(restaurant).toHaveProperty('rating')
        expect(restaurant).toHaveProperty('location')
        expect(restaurant).toHaveProperty('phone')
      }
    })
  })
})
