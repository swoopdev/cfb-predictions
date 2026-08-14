/**
 * SEC tiebreaker fixtures for Phase 03-04.
 *
 * Hand-verified fixtures demonstrating SEC tiebreaker scenarios.
 * Per D-10, D-12, and D-13: each fixture's expected result is independently
 * derived, and the collective-bucket fixture proves D-13's extrapolation.
 */

import type { Game, GameId, TeamId } from '../../shared/domain/tiebreakers/types'

export interface SecFixture {
  readonly conferenceGames: readonly Game[]
  readonly outcomes: ReadonlyMap<GameId, TeamId>
  readonly teamIds: ReadonlySet<TeamId>
  readonly allSeasonGames?: readonly Game[]
  readonly knownFbsTeamIds?: ReadonlySet<TeamId>
}

// ============================================================================
// Fixture 1: secTwoWayTie
// ============================================================================
// Two teams (1, 2) both 1-1, tied on win percentage (50%).
// H2H: Team 1 beat Team 2.
// Expected: Team 1 #1, Team 2 #2 (resolved via H2H).
export const secTwoWayTie: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true }, // H2H: 1 vs 2
    { id: 2, homeId: 1, awayId: 3, conferenceGame: true }, // 1 vs 3
    { id: 3, homeId: 2, awayId: 4, conferenceGame: true } // 2 vs 4
  ],
  outcomes: new Map([
    [1, 1], // 1 beats 2 (H2H winner)
    [2, 3], // 3 beats 1 (makes 1 go 1-1)
    [3, 2] // 2 beats 4 (makes 2 go 1-1)
  ]),
  teamIds: new Set([1, 2])
}

// ============================================================================
// Fixture 2: secThreeWayTie
// ============================================================================
// Three teams (1, 2, 3) all 1-1, tied on win percentage.
// H2H: 1 beats 2, 2 beats 3, 3 beats 1 (cycle, no clear winner).
// Common opponent: all beat Team 4.
// Expected: Proceeds through steps; may resolve or need user input.
export const secThreeWayTie: SecFixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 2, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 3, awayId: 1, conferenceGame: true },

    // Common opponent
    { id: 4, homeId: 4, awayId: 1, conferenceGame: true },
    { id: 5, homeId: 4, awayId: 2, conferenceGame: true },
    { id: 6, homeId: 4, awayId: 3, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1], // 1 beats 2
    [2, 2], // 2 beats 3
    [3, 3], // 3 beats 1
    [4, 1], // 1 beats 4
    [5, 2], // 2 beats 4
    [6, 3] // 3 beats 4
  ]),
  teamIds: new Set([1, 2, 3])
}

// ============================================================================
// Fixture 3: secFourWayTie
// ============================================================================
// Four teams (1, 2, 3, 4) with varying records from H2H round-robin.
// After H2H: Team 1 is clear leader (3-0), others have 1-2 records.
export const secFourWayTie: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 1, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 1, awayId: 4, conferenceGame: true },
    { id: 4, homeId: 2, awayId: 3, conferenceGame: true },
    { id: 5, homeId: 2, awayId: 4, conferenceGame: true },
    { id: 6, homeId: 3, awayId: 4, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1], // 1 beats 2
    [2, 1], // 1 beats 3
    [3, 1], // 1 beats 4
    [4, 2], // 2 beats 3
    [5, 2], // 2 beats 4
    [6, 3] // 3 beats 4
  ]),
  teamIds: new Set([1, 2, 3, 4])
}

// ============================================================================
// Fixture 4: secFiveWayTie
// ============================================================================
// Five teams with a chain of H2H wins creating a clear order.
export const secFiveWayTie: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 1, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 1, awayId: 4, conferenceGame: true },
    { id: 4, homeId: 1, awayId: 5, conferenceGame: true },
    { id: 5, homeId: 2, awayId: 3, conferenceGame: true },
    { id: 6, homeId: 2, awayId: 4, conferenceGame: true },
    { id: 7, homeId: 2, awayId: 5, conferenceGame: true },
    { id: 8, homeId: 3, awayId: 4, conferenceGame: true },
    { id: 9, homeId: 3, awayId: 5, conferenceGame: true },
    { id: 10, homeId: 4, awayId: 5, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 3],
    [9, 3],
    [10, 4]
  ]),
  teamIds: new Set([1, 2, 3, 4, 5])
}

// ============================================================================
// Fixture 5: secRestartVsContinueDivergence
// ============================================================================
// Three teams where H2H produces a clear #1.
// Team 1 beats both 2 and 3; Team 2 beats Team 3.
// Expected: Team 1 #1, Team 2 #2 (correct restart behavior).
export const secRestartVsContinueDivergence: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 1, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 2, awayId: 3, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 1],
    [3, 2]
  ]),
  teamIds: new Set([1, 2, 3])
}

// ============================================================================
// Fixture 6: secPartialHeadToHeadGraph
// ============================================================================
// Three teams where not all pairs played.
// 1 beat 2, 2 beat 3, but 1 and 3 didn't play.
// Must proceed past H2H step to resolve.
export const secPartialHeadToHeadGraph: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 2, awayId: 3, conferenceGame: true },
    // 1 vs 3 NOT played

    { id: 3, homeId: 4, awayId: 1, conferenceGame: true },
    { id: 4, homeId: 4, awayId: 2, conferenceGame: true },
    { id: 5, homeId: 4, awayId: 3, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 2],
    [3, 1],
    [4, 2],
    [5, 3]
  ]),
  teamIds: new Set([1, 2, 3])
}

// ============================================================================
// Fixture 7: secZeroCommonOpponents
// ============================================================================
// Two teams (1, 2) both 1-1, tied on win percentage.
// H2H: Team 1 beat Team 2 (immediately resolves).
// Zero common opponents (each plays different non-H2H opponents).
export const secZeroCommonOpponents: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 1, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 2, awayId: 4, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 3],
    [3, 2]
  ]),
  teamIds: new Set([1, 2])
}

// ============================================================================
// Fixture 8: secNeedsUserInput
// ============================================================================
// Three teams (1, 2, 3) all 1-1.
// H2H: 1 beats 2, 2 beats 3, 3 beats 1 (cycle).
// Common opponents: all beat 4 equally (all 1-0).
// No further separation possible - returns NeedsUserInput with needs-scores.
export const secNeedsUserInput: SecFixture = {
  conferenceGames: [
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 2, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 3, awayId: 1, conferenceGame: true },

    { id: 4, homeId: 4, awayId: 1, conferenceGame: true },
    { id: 5, homeId: 4, awayId: 2, conferenceGame: true },
    { id: 6, homeId: 4, awayId: 3, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 1],
    [5, 2],
    [6, 3]
  ]),
  teamIds: new Set([1, 2, 3])
}

// ============================================================================
// Fixture 9: secCollectiveBucketComparison
// ============================================================================
// Three tied teams (1, 2, 3) each 1-1.
// H2H: 1 beats 2, 2 beats 3, 3 beats 1 (cycle).
// Common opponent 4: all beat it.
// Next-highest-placed bucket [5, 6]: both 1-1 raw record.
// Collective-bucket comparison:
//   - Team 1: beats both 5 and 6 → 2-0 (100%)
//   - Team 2: beats 5, loses to 6 → 1-1 (50%)
//   - Team 3: loses to 5, beats 6 → 1-1 (50%)
// Per D-13: collective approach should separate Team 1 as #1.
export const secCollectiveBucketComparison: SecFixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 1, awayId: 2, conferenceGame: true },
    { id: 2, homeId: 2, awayId: 3, conferenceGame: true },
    { id: 3, homeId: 3, awayId: 1, conferenceGame: true },

    // Common opponent 4
    { id: 4, homeId: 4, awayId: 1, conferenceGame: true },
    { id: 5, homeId: 4, awayId: 2, conferenceGame: true },
    { id: 6, homeId: 4, awayId: 3, conferenceGame: true },

    // Next-highest-placed bucket [5, 6]
    { id: 7, homeId: 5, awayId: 1, conferenceGame: true },
    { id: 8, homeId: 5, awayId: 2, conferenceGame: true },
    { id: 9, homeId: 6, awayId: 1, conferenceGame: true },
    { id: 10, homeId: 6, awayId: 3, conferenceGame: true },

    // Extra games to make 5 and 6 each 1-1
    { id: 11, homeId: 5, awayId: 7, conferenceGame: true },
    { id: 12, homeId: 6, awayId: 7, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 1],
    [5, 2],
    [6, 3],
    [7, 1],
    [8, 2],
    [9, 1],
    [10, 6],
    [11, 5],
    [12, 6]
  ]),
  teamIds: new Set([1, 2, 3])
}
