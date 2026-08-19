import { describe, it, expect } from 'vitest'
import { decisionHash, applyManualOrdering } from '../../../shared/domain/tiebreakers/invalidation'
import type { ConferenceRanking, RankGroup, StepValue, TerminalReason } from '../../../shared/domain/tiebreakers/types'

const REASON: TerminalReason = {
  code: 'ranking-step',
  ruleCitation: 'The tie shall be broken by a random draw.',
  sourceName: 'Test Conference Bylaws'
}

/** Builds an unresolved RankGroup whose trace has one cycle and one terminal step. */
function buildGroup(
  teams: readonly number[],
  values: ReadonlyMap<number, StepValue>,
  step: 'head-to-head' | 'common-opponents' = 'head-to-head'
): RankGroup {
  return {
    teams,
    resolvedBy: 'unresolved',
    contestedWith: teams,
    trace: [
      {
        tiedTeams: teams,
        steps: [
          {
            step,
            values: teams.map(teamId => ({ teamId, value: values.get(teamId)! })),
            partition: [teams],
            separated: false
          }
        ],
        outcome: 'exhausted',
        removed: []
      }
    ],
    terminalReason: REASON
  }
}

const record = (wins: number, losses: number, winPct: number): StepValue => ({ kind: 'record', wins, losses, winPct })
const h2h = (result: 'beat-all' | 'lost-to-all' | 'mixed' | 'no-common-games'): StepValue => ({ kind: 'headToHead', result })
const indeterminate: StepValue = { kind: 'indeterminate' }

describe('decisionHash (D-08)', () => {
  it('is stable across repeated calls on an unchanged group', () => {
    const group = buildGroup([1, 2], new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)]]))
    expect(decisionHash(group)).toBe(decisionHash(group))
  })

  it('changes when the group membership changes', () => {
    const values = new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)], [3, record(2, 2, 0.5)]])
    const a = buildGroup([1, 2], values)
    const b = buildGroup([1, 3], values)
    expect(decisionHash(a)).not.toBe(decisionHash(b))
  })

  it('changes when which step is terminal changes', () => {
    const values = new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)]])
    const a = buildGroup([1, 2], values, 'head-to-head')
    const b = buildGroup([1, 2], values, 'common-opponents')
    expect(decisionHash(a)).not.toBe(decisionHash(b))
  })

  it('changes when any one team\'s value at the terminal step changes', () => {
    const a = buildGroup([1, 2], new Map([[1, record(3, 1, 0.75)], [2, record(2, 2, 0.5)]]))
    const b = buildGroup([1, 2], new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)]]))
    expect(decisionHash(a)).not.toBe(decisionHash(b))
  })

  it('changes on a StepValue variant-kind change even where a naive numeric encoding would coincide (discriminant collision)', () => {
    // Team 1 "won everything" is expressible two ways depending on which step
    // produced it: a perfect record (winPct 1.0) or a headToHead sweep
    // ('beat-all'). A naive encoding that dropped `kind` and only emitted a
    // representative number could conflate these two semantically-similar-
    // but-structurally-different values. The discriminant must be in the
    // serialization so they never hash equal.
    const a = buildGroup([1, 2], new Map([[1, record(4, 0, 1)], [2, record(0, 4, 0)]]))
    const b = buildGroup([1, 2], new Map([[1, h2h('beat-all')], [2, h2h('lost-to-all')]]))
    expect(decisionHash(a)).not.toBe(decisionHash(b))
  })

  it('does not change when the ids inside group.teams are reordered -- membership is a set', () => {
    const values = new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)]])
    const a = buildGroup([1, 2], values)
    const b = buildGroup([2, 1], values)
    expect(decisionHash(a)).toBe(decisionHash(b))
  })

  it('produces a key rather than throwing for a group with an empty trace', () => {
    const group: RankGroup = {
      teams: [1, 2],
      resolvedBy: 'unresolved',
      contestedWith: [1, 2],
      trace: [],
      terminalReason: REASON
    }
    expect(() => decisionHash(group)).not.toThrow()
    expect(typeof decisionHash(group)).toBe('string')
  })

  it('handles an indeterminate value distinctly from a record or headToHead value', () => {
    const a = buildGroup([1, 2], new Map([[1, indeterminate], [2, record(2, 2, 0.5)]]))
    const b = buildGroup([1, 2], new Map([[1, record(0, 0, 0)], [2, record(2, 2, 0.5)]]))
    expect(decisionHash(a)).not.toBe(decisionHash(b))
  })

  it('returns a plain string synchronously -- safe to call from a computed with no async dependency change', () => {
    const group = buildGroup([1, 2], new Map([[1, record(2, 2, 0.5)], [2, record(2, 2, 0.5)]]))
    const first = decisionHash(group)
    expect(first).not.toBeInstanceOf(Promise)
    expect(typeof first).toBe('string')
    // Re-evaluating (as a computed would on every recompute) yields the
    // identical value with nothing async in the call chain.
    expect(decisionHash(group)).toBe(first)
  })
})

describe('applyManualOrdering (D-08/D-17)', () => {
  const group = buildGroup([1, 2, 3], new Map([
    [1, record(2, 1, 2 / 3)],
    [2, record(2, 1, 2 / 3)],
    [3, record(2, 1, 2 / 3)]
  ]))
  const hash = decisionHash(group)

  const resolvedGroup: RankGroup = {
    teams: [99],
    resolvedBy: 'sole-candidate',
    contestedWith: [99],
    trace: []
  }

  const ranking: ConferenceRanking = {
    conference: 'SEC',
    groups: [resolvedGroup, group]
  }

  it('returns the ranking unchanged when the slate is incomplete, whatever is stored', () => {
    const decisions = { [hash]: [3, 1, 2] }
    const result = applyManualOrdering(ranking, decisions, false)
    expect(result).toEqual(ranking)
    expect(result).toBe(ranking)
  })

  it('applies a stored ordering with a matching key and an equal id set, splitting into k single-team manual groups', () => {
    const decisions = { [hash]: [3, 1, 2] }
    const result = applyManualOrdering(ranking, decisions, true)

    expect(result.groups).toHaveLength(4) // resolvedGroup + 3 split groups
    expect(result.groups[0]).toBe(resolvedGroup)

    const [g1, g2, g3] = result.groups.slice(1)
    expect(g1).toMatchObject({ teams: [3], resolvedBy: 'manual', manualOrdering: [3, 1, 2] })
    expect(g2).toMatchObject({ teams: [1], resolvedBy: 'manual', manualOrdering: [3, 1, 2] })
    expect(g3).toMatchObject({ teams: [2], resolvedBy: 'manual', manualOrdering: [3, 1, 2] })

    // contestedWith, trace and terminalReason are preserved from the ORIGINAL group.
    for (const split of [g1, g2, g3]) {
      expect(split!.contestedWith).toBe(group.contestedWith)
      expect(split!.trace).toBe(group.trace)
      expect(split!.terminalReason).toBe(group.terminalReason)
    }
  })

  it('leaves the group unresolved when the stored id set is a superset of the live group\'s', () => {
    const decisions = { [hash]: [1, 2, 3, 4] }
    const result = applyManualOrdering(ranking, decisions, true)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[1]).toBe(group)
  })

  it('leaves the group unresolved when the stored id set is a subset of the live group\'s', () => {
    const decisions = { [hash]: [1, 2] }
    const result = applyManualOrdering(ranking, decisions, true)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[1]).toBe(group)
  })

  it('leaves the group unresolved when the stored id set substitutes one member for an equal-length outsider', () => {
    const decisions = { [hash]: [1, 2, 4] }
    const result = applyManualOrdering(ranking, decisions, true)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[1]).toBe(group)
  })

  it('leaves the group unresolved when no stored entry matches the hash at all', () => {
    const result = applyManualOrdering(ranking, {}, true)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[1]).toBe(group)
  })

  it('never mutates its input ranking or any group in it', () => {
    const decisions = { [hash]: [3, 1, 2] }
    const before = JSON.parse(JSON.stringify(ranking))
    applyManualOrdering(ranking, decisions, true)
    expect(JSON.parse(JSON.stringify(ranking))).toEqual(before)
  })

  it('leaves an already-resolved group (sole-candidate/tiebreaker/manual) untouched even if its hash happens to have a stored entry', () => {
    const soleHash = decisionHash({ ...resolvedGroup, resolvedBy: 'unresolved' })
    const decisions = { [soleHash]: [99] }
    const result = applyManualOrdering(ranking, decisions, true)
    expect(result.groups[0]).toBe(resolvedGroup)
  })
})
