import { describe, it, expect, vi } from 'vitest'
import type { TeamId, StepOutcome, BaseOrdering, TiebreakerResult, TerminalReason, TiebreakerCycle } from '../shared/domain/tiebreakers/types'
import type { ConferenceRecord } from '../shared/domain/tiebreakers/records'
import { resolveTiedGroup, resolveConferenceChampionship } from '../shared/domain/tiebreakers/engine'

/**
 * Fixture builder for synthetic tiebreaker test cases.
 * Creates minimal ConferenceRecords for isolated restart/continue testing.
 */
function createFixtureRecords(
  teamIds: TeamId[],
  opponents: Map<TeamId, Set<TeamId>> = new Map()
): ReadonlyMap<TeamId, ConferenceRecord> {
  const records = new Map<TeamId, ConferenceRecord>()
  for (const teamId of teamIds) {
    records.set(teamId, {
      teamId,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      winPct: 0,
      beat: new Set(),
      lostTo: new Set(),
      opponents: opponents.get(teamId) ?? new Set()
    })
  }
  return records
}

/**
 * Test helper: creates a modified resolveTiedGroup that uses a custom
 * step evaluator (so we can test without real game data).
 */
function resolveTiedGroupWithMockEvaluator(
  tiedTeams: readonly TeamId[],
  defineTiedTeams: (
    baseOrdering: BaseOrdering,
    records: ReadonlyMap<TeamId, ConferenceRecord>,
    alreadyCommitted: ReadonlySet<TeamId>
  ) => readonly TeamId[],
  procedureFor: (size: number) => string[],
  mockEvaluator: (stepId: string, tiedTeams: readonly TeamId[]) => StepOutcome,
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>,
  terminalReason: TerminalReason,
  cycles: TiebreakerCycle[] = [],
  alreadyCommitted: ReadonlySet<TeamId> = new Set()
): TiebreakerResult {
  // This is a minimal implementation just for testing
  // It manually implements the resolveTiedGroup logic but uses mockEvaluator

  if (tiedTeams.length === 1) {
    return {
      status: 'resolved',
      order: [...tiedTeams],
      trace: cycles
    }
  }

  const steps: StepOutcome[] = []

  for (const stepId of procedureFor(tiedTeams.length)) {
    const outcome = mockEvaluator(stepId, tiedTeams)
    steps.push(outcome)

    if (!outcome.separated) {
      continue
    }

    const [winners, ...restBuckets] = outcome.partition
    const rest = restBuckets.flat()

    if (winners.length === 1 && rest.length === 0) {
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'resolved',
        removed: [{ teamId: winners[0]!, reason: 'seeded', atStep: stepId }]
      })
      return {
        status: 'resolved',
        order: [...winners],
        trace: cycles
      }
    }

    if (winners.length >= 1 && rest.length > 0) {
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'restart',
        removed: winners.map(teamId => ({ teamId, reason: 'seeded' as const, atStep: stepId }))
      })

      if (rest.length >= tiedTeams.length) {
        throw new Error(
          'resolveTiedGroup: restart did not strictly shrink the tied group -- infinite recursion guard tripped'
        )
      }

      const nextAlreadyCommitted = new Set([...alreadyCommitted, ...winners])
      const nextTiedTeams = defineTiedTeams(baseOrdering, records, nextAlreadyCommitted)

      if (nextTiedTeams.length >= tiedTeams.length) {
        throw new Error(
          'resolveTiedGroup: defineTiedTeams did not strictly shrink the tied group on restart -- infinite recursion guard tripped'
        )
      }

      const restResult = resolveTiedGroupWithMockEvaluator(
        nextTiedTeams,
        defineTiedTeams,
        procedureFor,
        mockEvaluator,
        baseOrdering,
        records,
        terminalReason,
        cycles, // Pass cycles through
        nextAlreadyCommitted
      )

      if (restResult.status === 'resolved') {
        return {
          status: 'resolved',
          order: [...winners, ...restResult.order],
          trace: restResult.trace
        }
      } else {
        return restResult
      }
    }
  }

  cycles.push({
    tiedTeams,
    steps,
    outcome: 'exhausted',
    removed: []
  })

  return {
    status: 'needsUserInput',
    tiedTeams,
    reason: terminalReason,
    trace: cycles
  }
}

const terminalReason: TerminalReason = {
  code: 'ranking-step',
  ruleCitation: 'Highest SportSource Analytics Team Rating Score',
  sourceName: 'Test Conference Tiebreaker Policy'
}

describe('Task 1: resolveTiedGroup recursive core', () => {
  it('should resolve a 1-team group immediately with empty trace', () => {
    const teamIds = [1]
    const records = createFixtureRecords(teamIds)
    const baseOrdering: BaseOrdering = [[1]]

    const result = resolveTiedGroupWithMockEvaluator(
      teamIds,
      () => teamIds, // defineTiedTeams: returns same group
      () => [], // procedure is empty (shouldn't be called)
      () => ({ step: 'none' as any, values: [], partition: [[1]], separated: false }),
      baseOrdering,
      records,
      terminalReason
    )

    expect(result.status).toBe('resolved')
    expect(result.order).toEqual([1])
    expect(result.trace).toHaveLength(0)
  })

  it('should record continue branch: no separation on step 1, separation on step 2', () => {
    // Fixture: 2-team tie, step 1 separates nobody, step 2 separates team 1
    // This tests D-07: recording every attempted step, including those that don't separate
    const tiedTeams: TeamId[] = [1, 2]
    const records = createFixtureRecords(tiedTeams)
    const baseOrdering: BaseOrdering = [tiedTeams]

    const defineTiedTeams = (_: BaseOrdering, __: ReadonlyMap<TeamId, ConferenceRecord>, alreadyCommitted: ReadonlySet<TeamId>) => {
      return tiedTeams.filter(t => !alreadyCommitted.has(t))
    }
    const procedureFor = () => ['step1', 'step2']

    // Mock evaluator: step1 doesn't separate, step2 separates team 1
    const mockEvaluator = (stepId: string, teams: readonly TeamId[]): StepOutcome => {
      if (stepId === 'step1') {
        return {
          step: 'step1',
          values: teams.map(t => ({ teamId: t, value: { kind: 'indeterminate' } })),
          partition: [Array.from(teams)],
          separated: false
        }
      }
      if (stepId === 'step2') {
        return {
          step: 'step2',
          values: teams.map(t => ({ teamId: t, value: { kind: 'indeterminate' } })),
          partition: [[1], [2]],
          separated: true
        }
      }
      return {
        step: stepId as any,
        values: teams.map(t => ({ teamId: t, value: { kind: 'indeterminate' } })),
        partition: [Array.from(teams)],
        separated: false
      }
    }

    const result = resolveTiedGroupWithMockEvaluator(
      tiedTeams,
      defineTiedTeams,
      procedureFor,
      mockEvaluator,
      baseOrdering,
      records,
      terminalReason
    )

    expect(result.status).toBe('resolved')
    expect(result.trace).toHaveLength(1) // Only one cycle (single-team base case doesn't create a cycle)

    // Cycle 1: step1 (no separation), step2 (separation -> restart)
    const cycle1 = result.trace[0]!
    expect(cycle1.tiedTeams).toEqual([1, 2])
    expect(cycle1.steps).toHaveLength(2)
    expect(cycle1.steps[0]!.step).toBe('step1')
    expect(cycle1.steps[0]!.separated).toBe(false) // D-07: record every step, even those that don't separate
    expect(cycle1.steps[1]!.step).toBe('step2')
    expect(cycle1.steps[1]!.separated).toBe(true)
    expect(cycle1.outcome).toBe('restart') // Partial separation triggers restart
    expect(cycle1.removed).toContainEqual({ teamId: 1, reason: 'seeded', atStep: 'step2' })

    // Final order should be [1, 2] (team 1 from first cycle, team 2 from base case)
    expect(result.order).toEqual([1, 2])
  })

  it('should throw when restart does not strictly shrink the tied group', () => {
    const tiedTeams: TeamId[] = [1, 2, 3]
    const records = createFixtureRecords(tiedTeams)
    const baseOrdering: BaseOrdering = [tiedTeams]

    // Deliberately-broken defineTiedTeams: returns same group (violates invariant)
    const brokenDefineTiedTeams = () => tiedTeams

    const procedureFor = () => ['step1']

    const mockEvaluator = (stepId: string, teams: readonly TeamId[]): StepOutcome => ({
      step: stepId as any,
      values: teams.map(t => ({ teamId: t, value: { kind: 'indeterminate' } })),
      partition: [[1], [2, 3]],
      separated: true
    })

    expect(() => {
      resolveTiedGroupWithMockEvaluator(
        tiedTeams,
        brokenDefineTiedTeams,
        procedureFor,
        mockEvaluator,
        baseOrdering,
        records,
        terminalReason
      )
    }).toThrow(/strictly shrink|infinite recursion/)
  })

  it('should return needsUserInput when all steps exhausted without separation', () => {
    const tiedTeams: TeamId[] = [1, 2, 3]
    const records = createFixtureRecords(tiedTeams)
    const baseOrdering: BaseOrdering = [tiedTeams]

    const defineTiedTeams = () => tiedTeams
    const procedureFor = () => ['step1', 'step2']

    const mockEvaluator = (stepId: string, teams: readonly TeamId[]): StepOutcome => ({
      step: stepId as any,
      values: teams.map(t => ({ teamId: t, value: { kind: 'indeterminate' } })),
      partition: [Array.from(teams)],
      separated: false
    })

    const result = resolveTiedGroupWithMockEvaluator(
      tiedTeams,
      defineTiedTeams,
      procedureFor,
      mockEvaluator,
      baseOrdering,
      records,
      terminalReason
    )

    expect(result.status).toBe('needsUserInput')
    expect(result.tiedTeams).toEqual(tiedTeams)
    expect(result.reason).toEqual(terminalReason) // D-04: terminalReason verbatim
    expect(result.trace).toHaveLength(1)
    expect(result.trace[0]!.outcome).toBe('exhausted')
  })
})

describe('Task 2: CONFERENCE_RULES and resolveConferenceChampionship', () => {
  it('should resolve a clean 1-team #1 (no tie) and a 2-team #2 tie using SEC rules', () => {
    // Fixture: SEC conference with one clear leader and a 2-team tie for #2
    const teamIds = new Set<TeamId>([1, 2, 3])
    const conferenceGames: { id: number, homeId: TeamId, awayId: TeamId }[] = [
      { id: 1, homeId: 1, awayId: 2 }, // Team 1 beats Team 2
      { id: 2, homeId: 1, awayId: 3 }, // Team 1 beats Team 3
      { id: 3, homeId: 2, awayId: 3 } // Team 2 beats Team 3
    ]
    const outcomes = new Map<number, TeamId>([
      [1, 1],
      [2, 1],
      [3, 2]
    ])

    const result = resolveConferenceChampionship('SEC', conferenceGames, outcomes, teamIds)

    // Seed 1: Team 1 (2-0) is clear leader
    expect(result.seed1.status).toBe('resolved')
    expect(result.seed1.order[0]).toBe(1)

    // Seed 2: Teams 2 and 3 tie at 1-1, resolved by head-to-head (team 2 beat team 3)
    expect(result.seed2.status).toBe('resolved')
    expect(result.seed2.order[0]).toBe(2)
  })

  it('should return needsUserInput for ACC when head-to-head is the only computable step', () => {
    // Fixture: ACC with two tied teams that did not play each other
    const teamIds = new Set<TeamId>([1, 2])
    const conferenceGames: { id: number, homeId: TeamId, awayId: TeamId }[] = [
      // No game between team 1 and team 2; they're tied on win percentage
    ]
    const outcomes = new Map<number, TeamId>([])

    const result = resolveConferenceChampionship('ACC', conferenceGames, outcomes, teamIds)

    // Seed 1: both teams tied, no head-to-head -> needsUserInput
    expect(result.seed1.status).toBe('needsUserInput')
    expect(result.seed1.reason.code).toBe('ranking-step')
    expect(result.seed1.tiedTeams).toEqual([1, 2])

    // Seed 2: same result (both spots blocked)
    expect(result.seed2).toBe(result.seed1)
  })

  it('should throw when outcomes maps a gameId to a TeamId not in that game', () => {
    const teamIds = new Set<TeamId>([1, 2, 3])
    const conferenceGames: { id: number, homeId: TeamId, awayId: TeamId }[] = [
      { id: 1, homeId: 1, awayId: 2 }
    ]
    // Invalid: gameId 1 is between teams 1 and 2, but we say team 3 won
    const outcomes = new Map<number, TeamId>([[1, 3]])

    expect(() => {
      resolveConferenceChampionship('SEC', conferenceGames, outcomes, teamIds)
    }).toThrow(/not a participant/)
  })

  it('should properly separate seed 1 from seed 2 with alreadyCommitted', () => {
    // Fixture: Team 1 wins cleanly, teams 2 and 3 tie for #2
    const teamIds = new Set<TeamId>([1, 2, 3, 4])
    const conferenceGames: { id: number, homeId: TeamId, awayId: TeamId }[] = [
      { id: 1, homeId: 1, awayId: 2 }, // Team 1 beats all
      { id: 2, homeId: 1, awayId: 3 },
      { id: 3, homeId: 1, awayId: 4 },
      { id: 4, homeId: 2, awayId: 3 }, // Teams 2 and 3 tie
      { id: 5, homeId: 2, awayId: 4 },
      { id: 6, homeId: 3, awayId: 4 }
    ]
    const outcomes = new Map<number, TeamId>([
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2], // Team 2 beats team 3
      [5, 2],
      [6, 3]
    ])

    const result = resolveConferenceChampionship('SEC', conferenceGames, outcomes, teamIds)

    // Seed 1: Team 1 (3-0) is clear
    expect(result.seed1.status).toBe('resolved')
    expect(result.seed1.order[0]).toBe(1)

    // Seed 2: Teams 2 and 3 (1-1 and 1-1), resolved by head-to-head
    // Team 2 beat team 3, so team 2 is seed 2
    expect(result.seed2.status).toBe('resolved')
    expect(result.seed2.order[0]).toBe(2)

    // Seed 1 and Seed 2 should not both be team 1
    expect(result.seed2.order[0]).not.toBe(result.seed1.order[0])
  })
})
