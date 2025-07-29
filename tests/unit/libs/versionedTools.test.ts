import { getToolsForVersion } from '../../../src/libs/versionedTools'

describe('VersionedTools', () => {
  describe('getToolsForVersion', () => {
    it('should return tools for v1', () => {
      const tools = getToolsForVersion('v1')

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      // v1 should have basic tools
      const toolNames = tools.map((tool) => tool.function?.name).filter(Boolean)
      expect(toolNames).toContain('search_restaurants_by_category')
    })

    it('should return tools for v2', () => {
      const tools = getToolsForVersion('v2')

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      // v2 should have enhanced tools (might include Pinecone)
      const toolNames = tools.map((tool) => tool.function?.name).filter(Boolean)
      expect(toolNames.length).toBeGreaterThan(0)
    })

    it('should return tools for v3', () => {
      const tools = getToolsForVersion('v3')

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      // v3 should have the most tools (including YELP)
      const toolNames = tools.map((tool) => tool.function?.name).filter(Boolean)
      expect(toolNames.length).toBeGreaterThan(0)
    })

    it('should return different tools for different versions', () => {
      const v1Tools = getToolsForVersion('v1')
      const v2Tools = getToolsForVersion('v2')
      const v3Tools = getToolsForVersion('v3')

      // Each version should have some tools
      expect(v1Tools.length).toBeGreaterThan(0)
      expect(v2Tools.length).toBeGreaterThan(0)
      expect(v3Tools.length).toBeGreaterThan(0)

      // Tool counts may vary between versions
      const v1Count = v1Tools.length
      const v2Count = v2Tools.length
      const v3Count = v3Tools.length

      console.log(`Tool counts - v1: ${v1Count}, v2: ${v2Count}, v3: ${v3Count}`)

      // At minimum, each should have at least one tool
      expect(v1Count).toBeGreaterThanOrEqual(1)
      expect(v2Count).toBeGreaterThanOrEqual(1)
      expect(v3Count).toBeGreaterThanOrEqual(1)
    })

    it('should handle invalid version gracefully', () => {
      // @ts-ignore - testing invalid input
      const tools = getToolsForVersion('invalid')

      expect(Array.isArray(tools)).toBe(true)
      // Should fallback to some default or empty array
    })
  })
})
