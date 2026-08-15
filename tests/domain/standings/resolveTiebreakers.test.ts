import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveAllConferences } from '../../../shared/domain/standings'
import {
  allTeams,
  secRoundRobinGames,
  secRoundRobinPicks
} from '../../fixtures/standings.fixtures'

/**
 * WR-03: `resolveAllConferences` now logs the engine invariant violations it
 * catches instead of discarding them, because those throws signal an engine
 * bug and silently degrading to alphabetical-within-tie ordering is the worst
 * failure mode this project has.
 *
 * The other half of that change is asserted here: the happy path must stay
 * SILENT. A `console.warn` firing on valid input would be its own regression —
 * it would train the one diagnostic this module has to be ignored.
 */
describe('resolveAllConferences diagnostics (WR-03)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits no diagnostic on a valid, fully-picked slate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const resolved = resolveAllConferences(secRoundRobinGames, allTeams, secRoundRobinPicks)

    expect(Object.keys(resolved).sort()).toEqual(['ACC', 'Big 12', 'Big Ten', 'SEC'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('emits no diagnostic on an entirely unpicked slate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    resolveAllConferences(secRoundRobinGames, allTeams, {})

    expect(warn).not.toHaveBeenCalled()
  })

  it('emits no diagnostic for picks the untrusted-input boundary drops', () => {
    // `toOutcomes` filters these out before the engine sees them, so they are
    // not an engine failure and must not be reported as one.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    resolveAllConferences(secRoundRobinGames, allTeams, { 101: 41, 424242: 1 })

    expect(warn).not.toHaveBeenCalled()
  })
})
