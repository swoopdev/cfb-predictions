import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useManualTiebreakers } from '~/composables/useManualTiebreakers'
import { scenarioKeys } from '~/utils/scenarioKeys'
import { decisionHash, MAX_ENTRIES_PER_CONFERENCE } from '../../shared/domain/tiebreakers/invalidation'
import type { ConferenceRanking, RankGroup, StepValue, TerminalReason } from '../../shared/domain/tiebreakers/types'

const SEASON = 2026
const SCENARIO_ID = 'scenario-1'
const STORAGE_KEY = scenarioKeys.manualTiebreakers(SEASON, SCENARIO_ID)

const REASON: TerminalReason = {
  code: 'ranking-step',
  ruleCitation: 'The tie shall be broken by a random draw.',
  sourceName: 'Test Conference Bylaws'
}

const record = (wins: number, losses: number, winPct: number): StepValue => ({ kind: 'record', wins, losses, winPct })

/** Builds an unresolved RankGroup whose trace has one cycle and one terminal step. */
function buildGroup(teams: readonly number[], values: ReadonlyMap<number, StepValue>): RankGroup {
  return {
    teams,
    resolvedBy: 'unresolved',
    contestedWith: teams,
    trace: [
      {
        tiedTeams: teams,
        steps: [
          {
            step: 'head-to-head',
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

function rankingOf(...groups: RankGroup[]): ConferenceRanking {
  return { conference: 'SEC', groups }
}

const groupG = buildGroup([1, 2, 3], new Map([
  [1, record(2, 1, 2 / 3)],
  [2, record(2, 1, 2 / 3)],
  [3, record(2, 1, 2 / 3)]
]))
const hashG = decisionHash(groupG)

// A structurally different group (different membership) -- a different hash.
const groupG2 = buildGroup([1, 2, 4], new Map([
  [1, record(2, 1, 2 / 3)],
  [2, record(2, 1, 2 / 3)],
  [4, record(2, 1, 2 / 3)]
]))
describe('useManualTiebreakers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('commitOrdering', () => {
    it('writes one entry under the conference key, hashed, with the ordered ids -- nothing else in storage changes', async () => {
      const { decisions, commitOrdering } = useManualTiebreakers(SCENARIO_ID, SEASON)

      commitOrdering('SEC', groupG, [3, 1, 2])
      await nextTick()

      expect(decisions.value).toEqual({ SEC: { [hashG]: [3, 1, 2] } })
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored).toEqual({ SEC: { [hashG]: [3, 1, 2] } })
    })

    it('no-ops when the supplied ids are not a set-equal match for the group\'s teams', async () => {
      const { decisions, commitOrdering } = useManualTiebreakers(SCENARIO_ID, SEASON)

      commitOrdering('SEC', groupG, [1, 2, 4]) // 4 is not in groupG.teams
      await nextTick()

      expect(decisions.value).toEqual({})
      // useStorage eagerly writes its default value for a fresh key, so the
      // key itself exists -- the guard is proven by its VALUE staying empty.
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({})
    })

    // 08-REVIEW WR-02 (iteration 2): commitOrdering now mirrors the read-side
    // MAX_ENTRIES_PER_CONFERENCE cap at write time, evicting the oldest entry
    // rather than letting the conference silently drift past what
    // validateConferenceDecisions accepts on the next read.
    it('evicts the oldest entry at write time when adding a brand-new hash would exceed the cap', async () => {
      const preExisting: Record<string, number[]> = {}
      for (let i = 0; i < MAX_ENTRIES_PER_CONFERENCE; i++) {
        preExisting[`hash${i}`] = [i]
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ SEC: preExisting }))

      const { decisions, commitOrdering } = useManualTiebreakers(SCENARIO_ID, SEASON)
      expect(Object.keys(decisions.value.SEC ?? {})).toHaveLength(MAX_ENTRIES_PER_CONFERENCE)

      commitOrdering('SEC', groupG, [3, 1, 2]) // a brand-new hash -- would be the 33rd
      await nextTick()

      const stored = decisions.value.SEC ?? {}
      expect(Object.keys(stored)).toHaveLength(MAX_ENTRIES_PER_CONFERENCE) // never exceeds the cap
      expect(stored.hash0).toBeUndefined() // oldest (first-inserted) entry evicted
      expect(stored[hashG]).toEqual([3, 1, 2]) // new entry present
      expect(stored[`hash${MAX_ENTRIES_PER_CONFERENCE - 1}`]).toEqual([MAX_ENTRIES_PER_CONFERENCE - 1]) // newest survivor intact
    })

    it('overwriting an already-stored hash never evicts anything, even sitting exactly at the cap', async () => {
      const preExisting: Record<string, number[]> = {}
      for (let i = 0; i < MAX_ENTRIES_PER_CONFERENCE - 1; i++) {
        preExisting[`hash${i}`] = [i]
      }
      preExisting[hashG] = [1, 2, 3]
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ SEC: preExisting }))

      const { decisions, commitOrdering } = useManualTiebreakers(SCENARIO_ID, SEASON)
      expect(Object.keys(decisions.value.SEC ?? {})).toHaveLength(MAX_ENTRIES_PER_CONFERENCE)

      commitOrdering('SEC', groupG, [3, 1, 2]) // overwrites the existing hashG entry, not a new key
      await nextTick()

      const stored = decisions.value.SEC ?? {}
      expect(Object.keys(stored)).toHaveLength(MAX_ENTRIES_PER_CONFERENCE) // count unchanged
      expect(stored.hash0).toEqual([0]) // nothing evicted
      expect(stored[hashG]).toEqual([3, 1, 2]) // overwritten value applied
    })
  })

  describe('decisionsFor', () => {
    it('returns an empty object for a conference with nothing stored', () => {
      const { decisionsFor } = useManualTiebreakers(SCENARIO_ID, SEASON)
      expect(decisionsFor('SEC').value).toEqual({})
    })

    it('reflects a committed ordering', () => {
      const { decisionsFor, commitOrdering } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [1, 2, 3])
      expect(decisionsFor('SEC').value).toEqual({ [hashG]: [1, 2, 3] })
    })
  })

  describe('pruneStale (D-08/D-09, 06-UI-SPEC.md §9)', () => {
    it('reading with a complete slate and a matching live group returns that ordering (not deleted)', () => {
      const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [3, 1, 2])

      pruneStale('SEC', rankingOf(groupG), true)

      expect(decisionsFor('SEC').value).toEqual({ [hashG]: [3, 1, 2] })
    })

    it('reading with an incomplete slate is suspension: no deletion, entry survives untouched', async () => {
      const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [3, 1, 2])
      await nextTick() // flush the write to localStorage before reading it raw below
      const before = JSON.parse(JSON.stringify(decisionsFor('SEC').value))

      // Slate incomplete, and even a ranking with NO matching group must not
      // delete anything -- gate 1 alone decides.
      pruneStale('SEC', rankingOf(groupG2), false)

      expect(decisionsFor('SEC').value).toEqual(before)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ SEC: { [hashG]: [3, 1, 2] } })
    })

    it('re-completing the slate with the group unchanged returns the ordering again, with no intervening write', () => {
      const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [3, 1, 2])

      const beforeIncomplete = localStorage.getItem(STORAGE_KEY)
      pruneStale('SEC', rankingOf(groupG), false) // incomplete: no-op
      expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeIncomplete) // literally untouched

      pruneStale('SEC', rankingOf(groupG), true) // complete again, group unchanged
      expect(decisionsFor('SEC').value).toEqual({ [hashG]: [3, 1, 2] })
    })

    it('reading with a complete slate and no live group matching a stored key deletes that entry', () => {
      const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [3, 1, 2])

      pruneStale('SEC', rankingOf(groupG2), true) // only groupG2's hash is live now

      expect(decisionsFor('SEC').value).toEqual({})
    })

    it('reading with an incomplete slate deletes nothing, even when no live group matches', () => {
      const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)
      commitOrdering('SEC', groupG, [3, 1, 2])

      pruneStale('SEC', rankingOf(groupG2), false)

      expect(decisionsFor('SEC').value).toEqual({ [hashG]: [3, 1, 2] })
    })

    it('a stored entry whose ids are not a set-equal match for the live group is not returned and is deleted once complete', () => {
      const { decisionsFor, pruneStale } = useManualTiebreakers(SCENARIO_ID, SEASON)

      // Simulate a hand-edited entry: the hash key matches groupG (same
      // membership/terminal-step/values), but the stored ordering itself
      // has been tampered with to include a phantom id.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ SEC: { [hashG]: [1, 2, 99] } }))

      pruneStale('SEC', rankingOf(groupG), true)

      expect(decisionsFor('SEC').value).toEqual({})
    })

    it('the suspended-versus-continuous equivalence: a hash-mismatched decision behaves identically whether suspended or continuously active', () => {
      // Path A: continuously active, then the group changes underneath it.
      const a = useManualTiebreakers(SCENARIO_ID, SEASON)
      a.commitOrdering('SEC', groupG, [3, 1, 2])
      a.pruneStale('SEC', rankingOf(groupG2), true) // slate complete throughout; group is now G2
      const resultA = a.decisionsFor('SEC').value

      localStorage.clear()

      // Path B: suspended (slate goes incomplete) before the group changes,
      // then re-completes with the SAME new group G2.
      const b = useManualTiebreakers(SCENARIO_ID, SEASON)
      b.commitOrdering('SEC', groupG, [3, 1, 2])
      b.pruneStale('SEC', rankingOf(groupG), false) // suspend: no-op, retained
      b.pruneStale('SEC', rankingOf(groupG2), true) // resume with a changed group
      const resultB = b.decisionsFor('SEC').value

      expect(resultA).toEqual({})
      expect(resultB).toEqual({})
      expect(resultA).toEqual(resultB)
    })
  })

  describe('malformed storage payloads', () => {
    it('resets to empty silently on invalid JSON, without throwing and without writing a secondary key', () => {
      localStorage.setItem(STORAGE_KEY, 'not json')

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value).toEqual({})
      expect(localStorage.length).toBe(1) // only STORAGE_KEY itself -- no `_corrupt` sibling
    })

    it('resets to empty silently when the payload is an array, not an object', () => {
      localStorage.setItem(STORAGE_KEY, '[1,2,3]')

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value).toEqual({})
    })

    it('resets to empty silently when the payload is null', () => {
      localStorage.setItem(STORAGE_KEY, 'null')

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value).toEqual({})
    })

    it('drops a conference holding more entries than the cap, in full', () => {
      const oversized: Record<string, number[]> = {}
      for (let i = 0; i < 33; i++) {
        oversized[`hash${i}`] = [i]
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'SEC': oversized, 'Big Ten': { abc: [1, 2] } }))

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value.SEC).toBeUndefined()
      expect(decisions.value['Big Ten']).toEqual({ abc: [1, 2] })
    })

    it('drops an entry whose id array exceeds the cap, keeping the rest of the conference', () => {
      const tooLong = Array.from({ length: 21 }, (_, i) => i)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        'Big 12': { toolong: tooLong, ok: [1, 2, 3] }
      }))

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value['Big 12']).toEqual({ ok: [1, 2, 3] })
    })

    it('drops an entry containing a duplicate id, keeping the rest of the conference', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ACC: { dup: [1, 2, 2], ok: [3, 4] }
      }))

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value.ACC).toEqual({ ok: [3, 4] })
    })

    it('drops an entry containing a non-integer, keeping the rest of the conference', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ACC: { bad: [1, 2.5, 3], ok: [3, 4] }
      }))

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value.ACC).toEqual({ ok: [3, 4] })
    })

    it('drops an unrecognized conference key entirely', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        'Sun Belt': { hash1: [1, 2] },
        'SEC': { hash2: [3, 4] }
      }))

      const { decisions } = useManualTiebreakers(SCENARIO_ID, SEASON)

      expect(decisions.value).toEqual({ SEC: { hash2: [3, 4] } })
    })
  })

  describe('Season Namespacing', () => {
    it('a decision committed for one season is invisible to another season\'s composable instance', () => {
      const season2026 = useManualTiebreakers(SCENARIO_ID, 2026)
      season2026.commitOrdering('SEC', groupG, [1, 2, 3])

      const season2027 = useManualTiebreakers(SCENARIO_ID, 2027)

      expect(season2027.decisionsFor('SEC').value).toEqual({})
      // A distinct storage key exists (useStorage eagerly writes its
      // default), but its VALUE is empty -- the 2026 entry never reached it.
      expect(JSON.parse(localStorage.getItem(scenarioKeys.manualTiebreakers(2027, SCENARIO_ID))!)).toEqual({})
    })
  })

  describe('Scenario Namespacing', () => {
    it('a decision committed for one scenario is invisible to another scenario\'s composable instance under the same season', () => {
      const scenarioA = useManualTiebreakers('scenario-a', SEASON)
      scenarioA.commitOrdering('SEC', groupG, [1, 2, 3])

      const scenarioB = useManualTiebreakers('scenario-b', SEASON)

      expect(scenarioB.decisionsFor('SEC').value).toEqual({})
      expect(JSON.parse(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, 'scenario-b'))!)).toEqual({})
    })

    it('two scenario ids under the same season are independent in both memory and localStorage', async () => {
      const scenarioA = useManualTiebreakers('scenario-a', SEASON)
      const scenarioB = useManualTiebreakers('scenario-b', SEASON)

      scenarioA.commitOrdering('SEC', groupG, [3, 1, 2])
      scenarioB.commitOrdering('SEC', groupG2, [1, 2, 4])
      await nextTick()

      expect(scenarioA.decisionsFor('SEC').value).toEqual({ [hashG]: [3, 1, 2] })
      const hashG2 = decisionHash(groupG2)
      expect(scenarioB.decisionsFor('SEC').value).toEqual({ [hashG2]: [1, 2, 4] })

      expect(JSON.parse(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, 'scenario-a'))!))
        .toEqual({ SEC: { [hashG]: [3, 1, 2] } })
      expect(JSON.parse(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, 'scenario-b'))!))
        .toEqual({ SEC: { [hashG2]: [1, 2, 4] } })
    })
  })
})
