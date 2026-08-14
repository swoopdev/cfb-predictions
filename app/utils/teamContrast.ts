/**
 * Team color contrast validation for WCAG AA compliance.
 *
 * Validates team colors from teams.json against card backgrounds (light/dark modes)
 * and applies CSS filters if contrast falls below the 4.5:1 threshold.
 *
 * Per UI-SPEC: Team colors used as accents on picked winners must meet WCAG AA 4.5:1
 * contrast ratio against the card background in both light and dark modes.
 */

/**
 * Convert hex color to RGB components.
 * Handles 3-digit (#RGB) and 6-digit (#RRGGBB) formats, case-insensitive.
 * Normalizes missing # prefix.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Normalize: remove # if present, convert to lowercase
  let normalized = hex.replace(/^#/, '').toLowerCase()

  // Handle 3-digit format: #RGB -> #RRGGBB
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map(c => c + c)
      .join('')
  }

  // Validate 6-digit format
  if (normalized.length !== 6 || !/^[0-9a-f]{6}$/.test(normalized)) {
    return null
  }

  const r = parseInt(normalized.substring(0, 2), 16)
  const g = parseInt(normalized.substring(2, 4), 16)
  const b = parseInt(normalized.substring(4, 6), 16)

  return { r, g, b }
}

/**
 * Compute relative luminance per WCAG definition.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *
 * Formula:
 * - For each R, G, B channel:
 *   - Normalize to 0-1 range
 *   - If <= 0.03928, divide by 12.92
 *   - Otherwise, ((value + 0.055) / 1.055) ^ 2.4
 * - L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const norm = v / 255
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4)
  }) as [number, number, number]

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Compute WCAG contrast ratio between two hex colors.
 * Returns a ratio where 1:1 is no contrast and 21:1 is maximum.
 * A minimum of 4.5:1 is required for WCAG AA compliance.
 */
function getContrast(color1Hex: string, color2Hex: string): number {
  const rgb1 = hexToRgb(color1Hex)
  const rgb2 = hexToRgb(color2Hex)

  if (!rgb1 || !rgb2) {
    // If either color is invalid, return 0 (assume failure)
    return 0
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Apply a brightness filter to a color and compute the resulting contrast.
 * Returns the luminance of the filtered color.
 */
function applyBrightnessFilter(
  hexColor: string,
  brightnessFactor: number
): number {
  const rgb = hexToRgb(hexColor)
  if (!rgb) return 0

  // Apply brightness factor directly to RGB components
  const adjusted = {
    r: Math.min(255, Math.round(rgb.r * brightnessFactor)),
    g: Math.min(255, Math.round(rgb.g * brightnessFactor)),
    b: Math.min(255, Math.round(rgb.b * brightnessFactor))
  }

  return getLuminance(adjusted.r, adjusted.g, adjusted.b)
}

/**
 * Main validation function.
 *
 * Checks if a team color meets WCAG AA 4.5:1 contrast against the card background.
 * If contrast passes, returns { valid: true }.
 * If contrast fails, tries common filters and returns the one that gets closest to 4.5:1.
 */
export function validateTeamContrast(
  teamColor: string,
  mode: 'light' | 'dark'
): { valid: boolean; filter?: string } {
  // Card background colors per UI-SPEC
  const bgColor = mode === 'light' ? '#ffffff' : '#0f172a' // white (light), slate-950 (dark)

  // Check if contrast already passes
  const currentContrast = getContrast(teamColor, bgColor)
  if (currentContrast >= 4.5) {
    return { valid: true }
  }

  // Try common filters and pick the one that gets closest to 4.5:1
  const filters = [
    { name: 'opacity-75', factor: 0.75 }, // reduce to 75% opacity
    { name: 'brightness(0.85)', factor: 0.85 },
    { name: 'brightness(0.75)', factor: 0.75 },
    { name: 'brightness(0.65)', factor: 0.65 }
  ]

  let bestFilterName = filters[0]!.name
  let bestRatio = 0

  for (const { name, factor } of filters) {
    const filteredLum = applyBrightnessFilter(teamColor, factor)
    const bgRgb = hexToRgb(bgColor)
    if (!bgRgb) continue

    const bgLum = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
    const lighter = Math.max(filteredLum, bgLum)
    const darker = Math.min(filteredLum, bgLum)
    const ratio = (lighter + 0.05) / (darker + 0.05)

    // Pick the filter that gets closest to (but >= 4.5) or the one with highest ratio
    if (ratio >= 4.5 && ratio < (bestRatio >= 4.5 ? bestRatio : Infinity)) {
      bestFilterName = name
      bestRatio = ratio
    } else if (bestRatio < 4.5 && ratio > bestRatio) {
      bestFilterName = name
      bestRatio = ratio
    }
  }

  return {
    valid: false,
    filter: bestFilterName
  }
}

/**
 * Helper to apply a validated contrast filter to a team color for use in CSS.
 * Returns an object suitable for `:style` binding that applies the filter if needed.
 */
export function applyContrastFilter(
  result: { valid: boolean; filter?: string }
): Record<string, string> {
  if (result.valid || !result.filter) {
    return {}
  }

  return {
    filter: result.filter
  }
}
