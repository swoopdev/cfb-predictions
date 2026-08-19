import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Game, Team } from '#shared/types/schedule'
import type { GamesEnvelope } from '~/utils/fetchSchedule'
import { useStandings } from '~/composables/useStandings'
import { useManualTiebreakers } from '~/composables/useManualTiebreakers'
import { useGames } from '~/composables/useGames'
import { useTeams } from '~/composables/useTeams'

// Mock the query composables BEFORE importing useStandings (usePickProgress.test.ts's
// convention) -- this is a wiring test, not a measurement, so it supplies a small,
// hand-countable fixture rather than loading the committed 888-game slate.
vi.mock('~/composables/useGames', () => ({ useGames: vi.fn() }))
vi.mock('~/composables/useTeams', () => ({ useTeams: vi.fn() }))

/**
 * A deliberately tiny synthetic SEC (all six other real conference slots are
 * empty in this fixture) built to produce ONE genuine, deterministic,
 * irreducible tied group -- not a slice of the real 2026 slate, so every
 * expected outcome below is hand-derivable from the games listed here.
 *
 * A(501)/B(502)/E(505) each beat a distinct, otherwise-untouched opponent
 * (C/D/F respectively) and never play each other or share an opponent, so
 * every SEC step (head-to-head, common-opponents, next-highest-placed-
 * common-opponent, cumulative-opponent-win-pct) stays indeterminate or tied
 * at 0.0 for all three -- the group is unresolved (`needs-scores`) by
 * construction, not by engine happenstance. The A-vs-C game additionally
 * doubles as the D-07 "gate" game for the §9.1/§9.4 lifecycle tests: it can
 * be cleared and re-picked without disturbing B or E's own opponents.
 */
const A = 501
const B = 502
const C = 503
const D = 504
const E = 505
const F = 506

function team(id: number, school: string): Team {
  return {
    id,
    school,
    mascot: null,
    abbreviation: null,
    conference: 'SEC',
    classification: 'fbs',
    color: '#000000',
    alternateColor: '#ffffff',
    logo: `/logos/${id}.png`
  }
}

const teams: Team[] = [
  team(A, 'Team A'),
  team(B, 'Team B'),
  team(C, 'Team C'),
  team(D, 'Team D'),
  team(E, 'Team E'),
  team(F, 'Team F')
]

const GAME_AC = 9001
const GAME_BD = 9002
const GAME_EF = 9003

function game(id: number, homeId: number, homeTeam: string, awayId: number, awayTeam: string): Game {
  return { id, week: 1, seasonType: 'regular', homeId, homeTeam, awayId, awayTeam, conferenceGame: true, neutralSite: false }
}

const games: Game[] = [
  game(GAME_AC, A, 'Team A', C, 'Team C'),
  game(GAME_BD, B, 'Team B', D, 'Team D'),
  game(GAME_EF, E, 'Team E', F, 'Team F')
]

/** A wins, B wins, E wins -- SEC's slate is fully picked. */
const FULL_PICKS = { [GAME_AC]: A, [GAME_BD]: B, [GAME_EF]: E }

const FORBIDDEN_WORDS = ['suspended', 'restored', 'paused', 'recovered']

function assertNoSuspensionVocabulary(...values: unknown[]) {
  const serialized = JSON.stringify(values).toLowerCase()
  for (const word of FORBIDDEN_WORDS) {
    expect(serialized).not.toContain(word)
  }
}

describe('useStandings (Plan 06-07, Task 2)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    ;(useGames as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: ref<GamesEnvelope>({ season: 2026, scheduleHash: 'test', games })
    })
    ;(useTeams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: ref<Team[]>(teams) })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('exposes a per-conference slate-completion map alongside standings and rankings', () => {
    const std = useStandings(2026)
    std.picks.value = { [GAME_AC]: A, [GAME_BD]: B } // GAME_EF deliberately unpicked

    // Big Ten/Big 12/ACC have zero rostered teams in this fixture, so their
    // slates are vacuously complete (slateCompletionByConference's own
    // documented behaviour) -- only SEC can be incomplete here.
    expect(std.slateComplete.value).toEqual({
      'SEC': false,
      'Big Ten': true,
      'Big 12': true,
      'ACC': true
    })
  })

  it('committing an ordering produces distinct ranks in standings on the very next evaluation, with no reload', async () => {
    const std = useStandings(2026)
    std.picks.value = FULL_PICKS
    await nextTick()

    expect(std.slateComplete.value!.SEC).toBe(true)

    const group = std.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    expect(new Set(group.teams)).toEqual(new Set([A, B, E]))

    std.commitOrdering('SEC', group, [B, E, A])
    await nextTick()

    const rowsById = new Map(std.standings.value!.SEC.map(t => [t.id, t]))
    expect(rowsById.get(B)!.rank).toBe(1)
    expect(rowsById.get(E)!.rank).toBe(2)
    expect(rowsById.get(A)!.rank).toBe(3)
    expect(rowsById.get(B)!.isTied).toBe(false)
    expect(rowsById.get(E)!.isTied).toBe(false)
    expect(rowsById.get(A)!.isTied).toBe(false)

    const manualGroups = std.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual')
    expect(manualGroups).toHaveLength(3)
    expect(manualGroups.map(g => g.teams[0])).toEqual([B, E, A])
  })

  it('clearing a conference pick suspends the ordering: the group reverts to a shared rank, while the storage entry survives', async () => {
    const std = useStandings(2026)
    std.picks.value = FULL_PICKS
    await nextTick()

    const group = std.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    std.commitOrdering('SEC', group, [B, E, A])
    await nextTick()
    expect(std.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual')).toHaveLength(3)

    // Clear the EF pick -- the realistic way a user clears one conference
    // pick (mirrors Clear Week/Clear Season's whole-object reassignment
    // convention in bulkPickOperations.ts).
    const { [GAME_EF]: _dropped, ...withoutEF } = std.picks.value
    std.picks.value = withoutEF
    await nextTick()

    expect(std.slateComplete.value!.SEC).toBe(false)
    // Suspended, not deleted: no group anywhere in SEC is 'manual' while
    // incomplete (gate 1 alone decides -- applyManualOrdering's single early
    // return), and the surviving StandingsTeam rows carry no isTied===false
    // trio at ranks 1-3 the way the committed order would produce.
    expect(std.rankings.value!.SEC!.groups.some(g => g.resolvedBy === 'manual')).toBe(false)

    // The storage entry itself is RETAINED, not discarded (06-UI-SPEC.md
    // §0.1's supersession of D-09) -- inspected via a second, independent
    // useManualTiebreakers instance pointed at the same season key.
    const { decisionsFor } = useManualTiebreakers(2026)
    expect(Object.keys(decisionsFor('SEC').value)).toHaveLength(1)
  })

  it('§9.3: re-picking the same winner restores the ordering silently -- identical ranks, no announcement anywhere in the lifecycle', async () => {
    const std = useStandings(2026)
    std.picks.value = FULL_PICKS
    await nextTick()

    const group = std.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    std.commitOrdering('SEC', group, [B, E, A])
    await nextTick()

    const ranksBefore = std.standings.value!.SEC.map(t => ({ id: t.id, rank: t.rank, isTied: t.isTied }))
    const manualBefore = std.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual')
    expect(manualBefore).toHaveLength(3)

    const { [GAME_EF]: _dropped, ...withoutEF } = std.picks.value
    std.picks.value = withoutEF
    await nextTick()
    assertNoSuspensionVocabulary(std.rankings.value, std.standings.value)

    // Re-pick the SAME winner -- flipping nothing, just re-completing.
    std.picks.value = { ...std.picks.value, [GAME_EF]: E }
    await nextTick()

    expect(std.slateComplete.value!.SEC).toBe(true)

    const ranksAfter = std.standings.value!.SEC.map(t => ({ id: t.id, rank: t.rank, isTied: t.isTied }))
    const manualAfter = std.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual')

    // (b) ranks rendered after are identical to the ranks rendered before
    expect(ranksAfter).toEqual(ranksBefore)
    // (c) the group's expansion states the decided-by-you provenance both
    // before and after -- at this layer, `resolvedBy === 'manual'` for the
    // same three teams in the same committed order.
    expect(manualAfter.map(g => g.teams[0])).toEqual(manualBefore.map(g => g.teams[0]))
    expect(manualAfter).toHaveLength(3)

    // No intervening write: still exactly one stored entry for SEC.
    const { decisionsFor } = useManualTiebreakers(2026)
    expect(Object.keys(decisionsFor('SEC').value)).toHaveLength(1)

    // (a)/(d): no suspension/restoration vocabulary anywhere across the
    // whole sequence -- there is no dialog/toast/banner/live-region layer at
    // the composable level to assert the absence of, so the checkable proxy
    // here is that no returned value ever mentions the storage lifecycle.
    assertNoSuspensionVocabulary(std.rankings.value, std.standings.value)
  })

  it('changing the tied group while incomplete invalidates the decision on return: never applied, deleted from storage, and the group is offered for ordering again', async () => {
    const std = useStandings(2026)
    std.picks.value = FULL_PICKS
    await nextTick()

    const group = std.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    std.commitOrdering('SEC', group, [B, E, A])
    await nextTick()

    const { [GAME_EF]: _dropped, ...withoutEF } = std.picks.value
    std.picks.value = withoutEF // suspend
    await nextTick()
    expect(std.slateComplete.value!.SEC).toBe(false)

    // Change the tied group's inputs while suspended: flip the AC winner.
    // The stored decision's hash was computed against {A, B, E}; whatever
    // pool exists after this flip is a DIFFERENT membership.
    std.picks.value = { ...std.picks.value, [GAME_AC]: C }
    await nextTick()

    // Re-complete with the SAME EF winner as originally committed.
    std.picks.value = { ...std.picks.value, [GAME_EF]: E }
    await nextTick()
    expect(std.slateComplete.value!.SEC).toBe(true)

    // Never applied: no manual group anywhere in SEC.
    expect(std.rankings.value!.SEC!.groups.some(g => g.resolvedBy === 'manual')).toBe(false)
    // The group is visibly unresolved again -- offered for ordering afresh.
    expect(std.rankings.value!.SEC!.groups.some(g => g.resolvedBy === 'unresolved')).toBe(true)

    // Deleted from storage on read (the watchEffect's pruneStale wiring),
    // not merely ignored -- the whole point of D-08's delete-on-read.
    const { decisionsFor } = useManualTiebreakers(2026)
    expect(decisionsFor('SEC').value).toEqual({})
  })

  it('§9.4: a decision suspended then mismatched is indistinguishable from one continuously active then mismatched', async () => {
    // Path A: continuously active throughout, then the underlying tied
    // group changes (flipping AC's winner never touches slate completeness
    // -- 06-UI-SPEC.md §9.1 -- so SEC's slate stays complete the whole time).
    const pathA = useStandings(2026)
    pathA.picks.value = FULL_PICKS
    await nextTick()
    const groupA = pathA.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    pathA.commitOrdering('SEC', groupA, [B, E, A])
    await nextTick()

    pathA.picks.value = { ...pathA.picks.value, [GAME_AC]: C }
    await nextTick()

    const resultA = {
      manualGroups: pathA.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual'),
      ranks: pathA.standings.value!.SEC.map(t => ({ id: t.id, rank: t.rank, isTied: t.isTied }))
    }

    localStorage.clear()

    // Path B: suspended (slate goes incomplete) before the group changes,
    // then re-completes with the SAME winners as path A's final state.
    const pathB = useStandings(2026)
    pathB.picks.value = FULL_PICKS
    await nextTick()
    const groupB = pathB.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    pathB.commitOrdering('SEC', groupB, [B, E, A])
    await nextTick()

    const { [GAME_EF]: _dropped, ...withoutEF } = pathB.picks.value
    pathB.picks.value = withoutEF // suspend
    await nextTick()
    expect(pathB.slateComplete.value!.SEC).toBe(false)

    pathB.picks.value = { ...pathB.picks.value, [GAME_AC]: C } // group changes while suspended
    await nextTick()

    pathB.picks.value = { ...pathB.picks.value, [GAME_EF]: E } // resume, same final winners as path A
    await nextTick()
    expect(pathB.slateComplete.value!.SEC).toBe(true)

    const resultB = {
      manualGroups: pathB.rankings.value!.SEC!.groups.filter(g => g.resolvedBy === 'manual'),
      ranks: pathB.standings.value!.SEC.map(t => ({ id: t.id, rank: t.rank, isTied: t.isTied }))
    }

    expect(resultA.manualGroups).toEqual([])
    expect(resultB.manualGroups).toEqual([])
    expect(resultA).toEqual(resultB)
  })

  it('pruning never runs for an incomplete conference -- the decision entry is retained, not deleted, while suspended', async () => {
    const std = useStandings(2026)
    std.picks.value = FULL_PICKS
    await nextTick()

    const group = std.rankings.value!.SEC!.groups.find(g => g.resolvedBy === 'unresolved')!
    std.commitOrdering('SEC', group, [B, E, A])
    await nextTick()

    const { [GAME_EF]: _dropped, ...withoutEF } = std.picks.value
    std.picks.value = withoutEF
    await nextTick()

    // The entry must survive purely because gate 1 (slate completeness)
    // decided it should -- pruneStale's own early return, driven by this
    // composable's watchEffect passing `slateComplete[conference] === false`
    // straight through, never even reaches the gate 2 comparison.
    const { decisionsFor } = useManualTiebreakers(2026)
    expect(decisionsFor('SEC').value).not.toEqual({})
  })
})
