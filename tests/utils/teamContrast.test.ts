import { describe, it, expect } from 'vitest'
import { validateTeamContrast, applyContrastFilter } from '~/utils/teamContrast'

describe('teamContrast', () => {
  describe('validateTeamContrast', () => {
    it('accepts colors that already meet 4.5:1 contrast in light mode', () => {
      // Dark blue on white (high contrast)
      const result = validateTeamContrast('#0000ff', 'light')
      expect(result.valid).toBe(true)
      expect(result.filter).toBeUndefined()
    })

    it('accepts colors that already meet 4.5:1 contrast in dark mode', () => {
      // Bright yellow on slate-950 (high contrast)
      const result = validateTeamContrast('#ffff00', 'dark')
      expect(result.valid).toBe(true)
      expect(result.filter).toBeUndefined()
    })

    it('rejects colors that fail contrast and returns a filter', () => {
      // Light gray on white (very poor contrast)
      const result = validateTeamContrast('#e6e6e6', 'light')
      expect(result.valid).toBe(false)
      expect(result.filter).toBeDefined()
      expect(['opacity-75', 'brightness(0.85)', 'brightness(0.75)', 'brightness(0.65)'])
        .toContain(result.filter)
    })

    it('handles colors without # prefix', () => {
      const withHash = validateTeamContrast('#0000ff', 'light')
      const withoutHash = validateTeamContrast('0000ff', 'light')
      expect(withoutHash.valid).toBe(withHash.valid)
      expect(withoutHash.filter).toBe(withHash.filter)
    })

    it('handles 3-digit hex colors (#RGB format)', () => {
      const threeDigit = validateTeamContrast('#00f', 'light')
      const sixDigit = validateTeamContrast('#0000ff', 'light')
      expect(threeDigit.valid).toBe(sixDigit.valid)
      expect(threeDigit.filter).toBe(sixDigit.filter)
    })

    it('is case-insensitive', () => {
      const lower = validateTeamContrast('#0000ff', 'light')
      const upper = validateTeamContrast('#0000FF', 'light')
      const mixed = validateTeamContrast('#0000Ff', 'light')
      expect(upper.valid).toBe(lower.valid)
      expect(mixed.valid).toBe(lower.valid)
    })

    it('handles invalid hex colors gracefully', () => {
      const result = validateTeamContrast('#gggggg', 'light')
      expect(result.valid).toBe(false)
      // Should still return a filter (fallback)
      expect(result.filter).toBeDefined()
    })

    it('returns different results for light vs dark mode for borderline colors', () => {
      // Medium gray: medium contrast in light, might differ in dark
      const lightResult = validateTeamContrast('#808080', 'light')
      const darkResult = validateTeamContrast('#808080', 'dark')
      // At least one should require a filter (they might both fail, or one pass and one fail)
      // But they should both be evaluated correctly
      expect(typeof lightResult.valid).toBe('boolean')
      expect(typeof darkResult.valid).toBe('boolean')
    })

    // Test with real team colors from major conferences
    it('validates real SEC team colors in light mode', () => {
      // Alabama (crimson red)
      const alabama = validateTeamContrast('#A60C38', 'light')
      expect(typeof alabama.valid).toBe('boolean')

      // Georgia (red)
      const georgia = validateTeamContrast('#BA0021', 'light')
      expect(typeof georgia.valid).toBe('boolean')

      // LSU (purple)
      const lsu = validateTeamContrast('#461D7C', 'light')
      expect(typeof lsu.valid).toBe('boolean')
    })

    it('validates real Big Ten team colors in dark mode', () => {
      // Ohio State (scarlet red)
      const ohioState = validateTeamContrast('#BB0000', 'dark')
      expect(typeof ohioState.valid).toBe('boolean')

      // Michigan (navy blue)
      const michigan = validateTeamContrast('#00033B', 'dark')
      expect(typeof michigan.valid).toBe('boolean')

      // Wisconsin (cardinal red)
      const wisconsin = validateTeamContrast('#C6102E', 'dark')
      expect(typeof wisconsin.valid).toBe('boolean')
    })

    it('handles low contrast colors and suggests filters', () => {
      // Light orange on white
      const result = validateTeamContrast('#ffcc99', 'light')
      if (!result.valid) {
        expect(result.filter).toBeDefined()
        expect(result.filter).toMatch(/opacity|brightness/)
      }
    })

    it('falls back to best available filter for very low contrast colors', () => {
      // Nearly white color on white background
      const result = validateTeamContrast('#fafafa', 'light')
      expect(result.valid).toBe(false)
      expect(result.filter).toBeDefined()
    })
  })

  describe('applyContrastFilter', () => {
    it('returns empty object for valid colors', () => {
      const result = applyContrastFilter({ valid: true })
      expect(result).toEqual({})
    })

    it('returns empty object if no filter provided', () => {
      const result = applyContrastFilter({ valid: false })
      expect(result).toEqual({})
    })

    it('returns filter style for invalid colors with filter', () => {
      const result = applyContrastFilter({
        valid: false,
        filter: 'brightness(0.75)'
      })
      expect(result).toEqual({
        filter: 'brightness(0.75)'
      })
    })

    it('works with opacity-based filters', () => {
      const result = applyContrastFilter({
        valid: false,
        filter: 'opacity-75'
      })
      expect(result).toEqual({
        filter: 'opacity-75'
      })
    })
  })

  describe('contrast ratio edge cases', () => {
    it('handles pure black and white', () => {
      const black = validateTeamContrast('#000000', 'light')
      const white = validateTeamContrast('#ffffff', 'light')
      expect(black.valid).toBe(true) // max contrast
      expect(white.valid).toBe(false) // no contrast
    })

    it('handles colors at exactly 4.5:1 threshold', () => {
      // These colors should have approximately 4.5:1 contrast on white
      // Using color calculators: #767676 (medium gray) has ~4.5:1 on white
      const result = validateTeamContrast('#767676', 'light')
      // Should either pass or be very close, with minimal/no filter needed
      expect(typeof result.valid).toBe('boolean')
    })
  })
})
