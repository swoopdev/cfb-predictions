/**
 * Plan 06-07 Task 3: closes the pre-existing `shared/domain/tiebreakers/**`
 * 90%-branch coverage gate, failing since before Phase 5
 * (`.planning/phases/05-standings-engine-ui/deferred-items.md`).
 *
 * Every case here targets a genuinely CROSS-CUTTING or defensive branch with
 * no natural topical home -- gaps that belong to an existing file's own
 * subject (the D-08 duplicate-id guard, the evaluateStep dispatcher's
 * exhaustive-switch default) were added to `invalidation.test.ts` and
 * `tiebreakers-steps.test.ts` instead, per the plan's own instruction.
 *
 * Every test below asserts real behaviour that would fail if the guarded
 * invariant changed -- none of them exist purely to move a coverage number.
 */
import { describe, it, expect } from 'vitest'
import { resolveTiedGroup, resolveConferenceRanking, championshipFor } from '../../../shared/domain/tiebreakers/engine'
import { defineAccTiedTeams } from '../../../shared/domain/tiebreakers/acc'
import type { ConferenceRecord } from '../../../shared/domain/tiebreakers/records'
import type { BaseOrdering, ConferenceId, TeamId, TerminalReason, TiebreakerStepId } from '../../../shared/domain/tiebreakers/types'

const REASON: TerminalReason = {
  code: 'ranking-step',
  ruleCitation: 'The tie shall be broken by a random draw.',
  sourceName: 'Test Conference Bylaws'
}

describe('resolveTiedGroup: the recursion depth cap is a real backstop, independent of the shrink-invariant guard', () => {
  it('throws once recursion exceeds 128 levels, even when every restart legally shrinks the group by exactly one team', () => {
    // A 200-team pool with DISTINCT total-wins values: the `total-wins` step
    // fully separates exactly one winner per cycle (no tie, so the shrink
    // guard at engine.ts:142 never trips), forcing >128 sequential restarts
    // long before the group could resolve via the length-1 base case.
    const teamCount = 200
    const teamIds: TeamId[] = Array.from({ length: teamCount }, (_, i) => i + 1)
    const overallWinCounts = new Map<TeamId, number>(
      teamIds.map((id, index) => [id, teamCount - index])
    )
    const emptyRecords = new Map<TeamId, ConferenceRecord>()
    const defineTiedTeams = (
      _baseOrdering: BaseOrdering,
      _records: ReadonlyMap<TeamId, ConferenceRecord>,
      committed: ReadonlySet<TeamId>
    ): readonly TeamId[] => teamIds.filter(id => !committed.has(id))
    const procedureFor = (): readonly TiebreakerStepId[] => ['total-wins']

    expect(() =>
      resolveTiedGroup(
        teamIds,
        defineTiedTeams,
        procedureFor,
        [],
        emptyRecords,
        overallWinCounts,
        new Set(),
        REASON
      )
    ).toThrow('resolveTiedGroup: recursion depth cap exceeded')
  })
})

describe('resolveTiedGroup: the containment-escape backstop', () => {
  it('treats the removed bucket as irreducible when defineTiedTeams returns nothing for the reduced group after a restart', () => {
    // Two teams with distinct total-wins fully separate on the first cycle
    // (team 1 seeds, team 2 remains). The injected defineTiedTeams then
    // simulates a restart-redefinition that re-anchors entirely outside the
    // bucket it was invoked against and finds nothing -- exactly the
    // scenario engine.ts's containment-escape comment describes for the
    // ACC's per-restart redefinition, without needing the full ACC apparatus.
    const teamIds: TeamId[] = [1, 2]
    const overallWinCounts = new Map<TeamId, number>([[1, 5], [2, 3]])
    const emptyRecords = new Map<TeamId, ConferenceRecord>()
    const defineTiedTeams = (): readonly TeamId[] => []
    const procedureFor = (): readonly TiebreakerStepId[] => ['total-wins']

    const result = resolveTiedGroup(
      teamIds,
      defineTiedTeams,
      procedureFor,
      [],
      emptyRecords,
      overallWinCounts,
      new Set(),
      REASON
    )

    expect(result.status).toBe('needsUserInput')
    if (result.status === 'needsUserInput') {
      expect(result.tiedTeams).toEqual([2])
      expect(result.reason).toBe(REASON)
    }
  })
})

describe('resolveConferenceRanking: the unknown-conference guard', () => {
  it('throws rather than silently resolving an empty ranking for a conference outside CONFERENCE_RULES', () => {
    expect(() =>
      resolveConferenceRanking('XYZ' as unknown as ConferenceId, [], new Map(), new Set())
    ).toThrow('Unknown conference: XYZ')
  })
})

describe('championshipFor: a conference with zero rank groups', () => {
  it('returns {} rather than throwing when groups is empty (e.g. a conference with zero rostered teams)', () => {
    const result = championshipFor({ conference: 'SEC', groups: [] })
    expect(result).toEqual({})
  })
})

describe('defineAccTiedTeams: every eligible team already committed', () => {
  it('returns an empty pool, rather than looping, once every ACC team has already been committed', () => {
    const records = new Map<TeamId, ConferenceRecord>([
      [1, { teamId: 1, wins: 5, losses: 2, gamesPlayed: 7, winPct: 5 / 7, beat: new Set(), lostTo: new Set(), opponents: new Set() }],
      [2, { teamId: 2, wins: 4, losses: 3, gamesPlayed: 7, winPct: 4 / 7, beat: new Set(), lostTo: new Set(), opponents: new Set() }]
    ])

    const result = defineAccTiedTeams([], records, new Set([1, 2]))

    expect(result).toEqual([])
  })
})
