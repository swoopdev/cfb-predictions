import { describe, it, expect } from 'vitest'
import {
  emptyScenarioExtras,
  hasScenarioExtras,
  scenarioExtrasWire,
  validateBracketPicks,
  validateChampionshipPicks,
  validateRankingOverride,
  validateScenarioExtras
} from '../../shared/domain/playoff/scenarioExtras'

describe('scenario extras validation', () => {
  it('keeps well-formed bracket picks and drops malformed entries one at a time', () => {
    expect(validateBracketPicks({
      current: { 'r1-5-12': 1, 'BAD SLOT': 2, 'final': 1.5 },
      projected: { 'qf-1': 7 },
      bogus: { 'sf-1': 3 }
    })).toEqual({ current: { 'r1-5-12': 1 }, projected: { 'qf-1': 7 } })
    expect(validateBracketPicks([1, 2])).toEqual({ current: {}, projected: {} })
    expect(validateBracketPicks(null)).toEqual({ current: {}, projected: {} })
  })

  it('dedupes and caps the ranking override', () => {
    expect(validateRankingOverride([3, 1, 3, 'x', 2.5, 2])).toEqual([3, 1, 2])
    expect(validateRankingOverride(Array.from({ length: 100 }, (_, i) => i + 1))).toHaveLength(40)
    expect(validateRankingOverride({ 0: 1 })).toEqual([])
  })

  it('accepts short conference names with integer winners', () => {
    expect(validateChampionshipPicks({ 'SEC': 61, 'Big Ten': '26', '': 5, [`${'x'.repeat(41)}`]: 3 })).toEqual({ SEC: 61 })
  })

  it('reads the compact share-link wire form and omits empty parts when writing it', () => {
    const extras = { championshipPicks: { ACC: 2390 }, bracketPicks: { current: {}, projected: { final: 61 } }, rankingOverride: [] }
    const wire = scenarioExtrasWire(extras)
    expect(wire).toEqual({ c: { ACC: 2390 }, b: { current: {}, projected: { final: 61 } } })
    expect(validateScenarioExtras(JSON.parse(JSON.stringify(wire)))).toEqual(extras)
    expect(validateScenarioExtras('nope')).toEqual(emptyScenarioExtras())
  })

  it('knows when there is nothing to carry', () => {
    expect(hasScenarioExtras(emptyScenarioExtras())).toBe(false)
    expect(hasScenarioExtras({ ...emptyScenarioExtras(), rankingOverride: [1] })).toBe(true)
  })
})
