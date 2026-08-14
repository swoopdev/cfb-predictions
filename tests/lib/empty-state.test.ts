/**
 * @vitest-environment node
 */
// Reads source files off disk via Node URL APIs (fileURLToPath + import.meta.url),
// which the project's global happy-dom default breaks by shadowing the file:-schemed URL.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { determineEmptyStateVariant } from '../../app/utils/schedule'
import type { Game } from '../../shared/types/schedule'

function makeGame(id: number): Game {
  return {
    id,
    week: 1,
    seasonType: 'regular',
    homeId: 1,
    homeTeam: 'Home',
    awayId: 2,
    awayTeam: 'Away',
    conferenceGame: false,
    neutralSite: false
  }
}

describe('determineEmptyStateVariant', () => {
  it('returns week-empty when the raw week has zero games (e.g. week 14)', () => {
    expect(determineEmptyStateVariant([], [])).toBe('week-empty')
  })

  it('returns filter-empty when a non-empty week narrows to zero via a filter', () => {
    expect(determineEmptyStateVariant([makeGame(1)], [])).toBe('filter-empty')
  })

  it('returns populated when the filtered result is non-empty', () => {
    const game = makeGame(1)
    expect(determineEmptyStateVariant([game], [game])).toBe('populated')
  })
})

describe('week/[week].vue empty-state copy', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../app/pages/week/[week].vue', import.meta.url)),
    'utf-8'
  )

  it('contains the distinct week-empty copy', () => {
    expect(source).toContain('No games this week')
  })

  it('contains the distinct filter-empty copy', () => {
    expect(source).toContain('No games match this filter')
  })
})
