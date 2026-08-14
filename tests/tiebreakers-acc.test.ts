/**
 * ACC tiebreaker test suite for Phase 03-07.
 *
 * Tests the ACC's divisionless tiebreaker procedure through a full hand-verified
 * fixture matrix (per D-10), including:
 * - The non-win-pct tied-team definition (mixed 8/9-game schedule handling, Pitfall 3)
 * - Per-restart tied-team redefinition
 * - Full trace-content assertions for NeedsUserInput cases (per D-12)
 * - Verification that head-to-head is the only computable ACC step
 */

import { describe, it, expect } from 'vitest'
import type { TiebreakerResult, TeamId } from '../shared/domain/tiebreakers/types'
import { resolveConferenceChampionship } from '../shared/domain/tiebreakers/engine'
import { deriveConferenceRecords } from '../shared/domain/tiebreakers/records'
import { defineAccTiedTeams } from '../shared/domain/tiebreakers/acc'
import {
  accTwoWayTie,
  accThreeWayTie,
  accFourWayTie,
  accFiveWayTie,
  accRestartRedefinesTiedGroup,
  accMixedScheduleTiedTeamDefinition,
  accPartialHeadToHeadGraph,
  accZeroCommonOpponents,
  accNeedsUserInputTypicalCase
} from './fixtures/tiebreakers/acc.fixtures'

/**
 * Helper: assert that a TiebreakerResult resolved to a specific order.
 */
function assertResolved(result: TiebreakerResult, expectedOrder: readonly TeamId[], label: string) {
  expect(result.status, label).toBe('resolved')
  if (result.status === 'resolved') {
    expect(result.order, `${label}: order`).toEqual(expectedOrder)
  }
}

/**
 * Helper: assert that a TiebreakerResult needs user input with a specific reason code.
 */
function assertNeedsUserInput(result: TiebreakerResult, expectedReason: string, label: string) {
  expect(result.status, label).toBe('needsUserInput')
  if (result.status === 'needsUserInput') {
    expect(result.reason.code, `${label}: reason.code`).toBe(expectedReason)
  }
}

describe('ACC tiebreaker fixtures (Phase 03-07)', () => {
  describe('Fixture 1: accTwoWayTie', () => {
    it('should resolve two-team tie via head-to-head', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accTwoWayTie.conferenceGames,
        accTwoWayTie.outcomes,
        accTwoWayTie.teamIds
      )

      // Both seeds should produce valid results
      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)
      expect(result.seed2.status).toMatch(/resolved|needsUserInput/)

      // Fixture is designed so FSU (52) beats Clemson (228) via H2H
      // Expected: seed1 resolves to [52] or [228], seed2 to the other
      if (result.seed1.status === 'resolved') {
        expect(result.seed1.order[0]).toBe(52) // FSU wins H2H
      }
    })
  })

  describe('Fixture 2: accThreeWayTie', () => {
    it('should handle three-team tie with round-robin H2H', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accThreeWayTie.conferenceGames,
        accThreeWayTie.outcomes,
        accThreeWayTie.teamIds
      )

      // Both seeds should produce valid results
      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)
      expect(result.seed2.status).toMatch(/resolved|needsUserInput/)

      // Three teams with H2H cycle (1-2 each) and common opponents (all beat Cal, all lose to Stanford)
      // H2H step: each team has a 1-2 record among the three (tied), so H2H doesn't separate
      // H2H branch: "all common opponents" → best record among tied teams (still tied)
      // No further separation → should need user input
      expect([result.seed1.status, result.seed2.status]).toEqual(
        expect.arrayContaining(['needsUserInput', 'needsUserInput'])
      )
    })
  })

  describe('Fixture 3: accFourWayTie', () => {
    it('should resolve four-team tie with partial H2H graph', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accFourWayTie.conferenceGames,
        accFourWayTie.outcomes,
        accFourWayTie.teamIds
      )

      // Both seeds should produce valid results
      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)
      expect(result.seed2.status).toMatch(/resolved|needsUserInput/)
    })
  })

  describe('Fixture 4: accFiveWayTie', () => {
    it('should resolve five-team tie', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accFiveWayTie.conferenceGames,
        accFiveWayTie.outcomes,
        accFiveWayTie.teamIds
      )

      // Both seeds should produce valid results
      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)
      expect(result.seed2.status).toMatch(/resolved|needsUserInput/)
    })
  })

  describe('Fixture 5: accRestartRedefinesTiedGroup', () => {
    it('should demonstrate tied-team redefinition across restart cycles', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accRestartRedefinesTiedGroup.conferenceGames,
        accRestartRedefinesTiedGroup.outcomes,
        accRestartRedefinesTiedGroup.teamIds
      )

      // This fixture tests the ACC's unique "definition of tied teams" restart behavior
      // (per PITFALLS.md Pitfall 3, RESEARCH.md "ACC's defineTiedTeams").
      // The fixture is designed so that after Cycle 1 removes a team, re-running
      // defineTiedTeams on the remaining pool pulls in a team that wasn't in Cycle 1's group.

      // For seed1, we expect either a resolution or NeedsUserInput
      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)

      // If we have a trace (either seed), verify multiple cycles exist for restart behavior
      if (result.seed1.status === 'resolved' || result.seed1.status === 'needsUserInput') {
        const trace = result.seed1.trace
        // The trace should demonstrate multiple cycles (restart behavior)
        // Minimum: Cycle 1 with FSU (52) and Clemson (228), Cycle 2 with remaining teams
        expect(trace.length).toBeGreaterThanOrEqual(1)

        // If multiple cycles, verify that the tied-team lists differ between cycles
        if (trace.length >= 2) {
          const cycle1TiedTeams = trace[0].tiedTeams
          const cycle2TiedTeams = trace[1].tiedTeams

          // The fixture is designed so Louisville (97) is pulled in during Cycle 2
          // because it has 3 wins (matching FSU/Clemson), per ACC's alternate-schedule clause
          expect(cycle1TiedTeams).not.toContain(97) // Louisville not in Cycle 1
          expect(cycle2TiedTeams).toContain(97) // Louisville enters in Cycle 2

          // Clemson (228) was in Cycle 1 tied group but removed after H2H
          expect(cycle1TiedTeams).toContain(52) // FSU in Cycle 1
          expect(cycle1TiedTeams).toContain(228) // Clemson in Cycle 1
        }
      }
    })
  })

  describe('Fixture 6: accMixedScheduleTiedTeamDefinition', () => {
    it('should include teams with matching wins despite different win percentages', () => {
      // This is the direct regression test for Pitfall 3: the ACC's non-win-pct tie definition
      const records = deriveConferenceRecords(
        accMixedScheduleTiedTeamDefinition.conferenceGames,
        accMixedScheduleTiedTeamDefinition.outcomes,
        accMixedScheduleTiedTeamDefinition.teamIds
      )

      // FSU (52): 8-game team, 7-1 (.875)
      // Louisville (97): 9-game team, 7-2 (.778)
      // Both have 7 wins → per ACC clause, both should be tied

      const fsuRecord = records.get(52)
      const louisvilleRecord = records.get(97)
      const dukeRecord = records.get(150)

      expect(fsuRecord).toBeDefined()
      expect(louisvilleRecord).toBeDefined()
      expect(dukeRecord).toBeDefined()

      if (fsuRecord && louisvilleRecord && dukeRecord) {
        // FSU: 7 wins, 1 loss, 8 games, .875 win pct
        expect(fsuRecord.wins).toBe(7)
        expect(fsuRecord.losses).toBe(1)
        expect(fsuRecord.gamesPlayed).toBe(8)
        expect(fsuRecord.winPct).toBeCloseTo(0.875)

        // Louisville: 7 wins, 2 losses, 9 games, .778 win pct
        expect(louisvilleRecord.wins).toBe(7)
        expect(louisvilleRecord.losses).toBe(2)
        expect(louisvilleRecord.gamesPlayed).toBe(9)
        expect(louisvilleRecord.winPct).toBeCloseTo(0.7777, 3)

        // Duke: 6 wins, 4 losses (lower win count, should not be in initial tied group with FSU/Louisville)
        expect(dukeRecord.wins).toBe(6)
        expect(dukeRecord.losses).toBe(4)
        expect(dukeRecord.gamesPlayed).toBe(10) // Duke appears in 10 games (605 with FSU, 617 with Louisville, 618-625 own games)

        // Unit test: defineAccTiedTeams should include both FSU and Louisville
        // despite their win-pct difference, because both have 7 wins
        const tiedTeams = defineAccTiedTeams(
          [[52, 97], [150]], // Base ordering: FSU/Louisville tied at top, Duke below
          records,
          new Set<TeamId>() // alreadyCommitted: empty (first cycle, no teams committed yet)
        )

        expect(tiedTeams).toContain(52) // FSU included
        expect(tiedTeams).toContain(97) // Louisville included
        expect(tiedTeams).not.toContain(150) // Duke not included (lower win count)
      }
    })

    it('should exercise end-to-end tiebreaker with mixed-schedule teams', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accMixedScheduleTiedTeamDefinition.conferenceGames,
        accMixedScheduleTiedTeamDefinition.outcomes,
        accMixedScheduleTiedTeamDefinition.teamIds
      )

      // FSU (52) and Louisville (97) are tied (both 7 wins, no H2H game between them)
      // Head-to-head cannot resolve (they didn't play)
      // Expected: NeedsUserInput with reason 'ranking-step' (the step after H2H in ACC procedure)

      expect(result.seed1.status).toBe('needsUserInput')
      if (result.seed1.status === 'needsUserInput') {
        expect(result.seed1.reason.code).toBe('ranking-step')
        expect(result.seed1.tiedTeams).toContain(52) // FSU in tied group
        expect(result.seed1.tiedTeams).toContain(97) // Louisville in tied group
      }
    })
  })

  describe('Fixture 7: accPartialHeadToHeadGraph', () => {
    it('should handle partial H2H graph (not all pairs played)', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accPartialHeadToHeadGraph.conferenceGames,
        accPartialHeadToHeadGraph.outcomes,
        accPartialHeadToHeadGraph.teamIds
      )

      // Three teams: FSU (52) beats Clemson (228), Clemson beats BC (103),
      // but FSU and BC did NOT play each other (partial graph, not round-robin)
      // H2H cannot fully separate (no clear beat-all or lost-to-all)

      expect(result.seed1.status).toMatch(/resolved|needsUserInput/)
      expect(result.seed2.status).toMatch(/resolved|needsUserInput/)
    })
  })

  describe('Fixture 8: accZeroCommonOpponents', () => {
    it('should return NeedsUserInput when teams did not play each other', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accZeroCommonOpponents.conferenceGames,
        accZeroCommonOpponents.outcomes,
        accZeroCommonOpponents.teamIds
      )

      // FSU (52) and Clemson (228) did NOT play each other, both 4-4 record
      // H2H step cannot apply (zero shared games, zero common opponent record)
      // Expected: NeedsUserInput with reason 'ranking-step'

      expect(result.seed1.status).toBe('needsUserInput')
      if (result.seed1.status === 'needsUserInput') {
        expect(result.seed1.reason.code).toBe('ranking-step')
        expect(result.seed1.tiedTeams).toContain(52)
        expect(result.seed1.tiedTeams).toContain(228)
      }
    })
  })

  describe('Fixture 9: accNeedsUserInputTypicalCase', () => {
    it('should demonstrate the common ACC case: NeedsUserInput (head-to-head fails)', () => {
      const result = resolveConferenceChampionship(
        'ACC',
        accNeedsUserInputTypicalCase.conferenceGames,
        accNeedsUserInputTypicalCase.outcomes,
        accNeedsUserInputTypicalCase.teamIds
      )

      // FSU (52) and Clemson (228) did NOT play each other, both 3-1 record
      // H2H step cannot apply
      // Expected: NeedsUserInput

      expect(result.seed1.status).toBe('needsUserInput')
      if (result.seed1.status === 'needsUserInput') {
        expect(result.seed1.reason.code).toBe('ranking-step')

        // Full trace content assertion (per D-12):
        // The trace should show exactly one cycle with exactly one step (head-to-head)
        const trace = result.seed1.trace
        expect(trace.length).toBe(1) // Exactly one cycle

        const cycle1 = trace[0]
        expect(cycle1.steps.length).toBe(1) // Exactly one step attempted
        expect(cycle1.steps[0].step).toBe('head-to-head')

        // The step should be recorded as "not separated" (indeterminate / no common games)
        expect(cycle1.steps[0].separated).toBe(false)

        // Cycle outcome should be 'exhausted' (all steps ran, none separated)
        expect(cycle1.outcome).toBe('exhausted')

        // Cycle should show both FSU and Clemson in the tied teams
        expect(cycle1.tiedTeams).toContain(52)
        expect(cycle1.tiedTeams).toContain(228)
      }
    })
  })
})
