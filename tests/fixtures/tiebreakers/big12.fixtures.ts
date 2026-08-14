/**
 * Big 12 tiebreaker fixtures for Phase 03-06.
 *
 * Hand-verified fixtures demonstrating Big 12 tiebreaker scenarios.
 * Per D-10, D-12, and D-05/D-06: each fixture's expected result is independently
 * derived, and the collective-bucket fixture proves D-05's decision.
 *
 * Big 12 roster (2026):
 * 9=Arizona State, 12=Arizona, 38=Colorado, 66=Iowa State, 197=Oklahoma State,
 * 239=Baylor, 248=Houston, 252=BYU, 254=Utah, 277=West Virginia,
 * 2116=UCF, 2132=Cincinnati, 2305=Kansas, 2306=Kansas State, 2628=TCU, 2641=Texas Tech
 */

import type { Game, GameId, TeamId } from '../../shared/domain/tiebreakers/types'

export interface Big12Fixture {
  readonly conferenceGames: readonly Game[]
  readonly outcomes: ReadonlyMap<GameId, TeamId>
  readonly teamIds: ReadonlySet<TeamId>
  readonly allSeasonGames?: readonly Game[]
  readonly knownFbsTeamIds?: ReadonlySet<TeamId>
}

// ============================================================================
// Fixture 1: big12TwoWayTie
// ============================================================================
// Two teams (12=Arizona, 9=Arizona State) both 1-1, tied on win percentage (50%).
// H2H: Team 12 beat Team 9 → Team 12 #1, Team 9 #2
export const big12TwoWayTie: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true }, // H2H: 12 vs 9
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true }, // 12 vs 38
    { id: 3, homeId: 9, awayId: 66, conferenceGame: true } // 9 vs 66
  ],
  outcomes: new Map([
    [1, 12], // 12 beats 9 (H2H winner)
    [2, 38], // 38 beats 12 (makes 12 go 1-1)
    [3, 9] // 9 beats 66 (makes 9 go 1-1)
  ]),
  teamIds: new Set([12, 9]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 9, awayId: 66, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66])
}

// ============================================================================
// Fixture 2: big12ThreeWayTie
// ============================================================================
// Three teams (12, 9, 38) all 1-1.
// H2H: 12 beats 9, 9 beats 38, 38 beats 12 (cycle).
// Common opponent 66: all beat it equally (1-0 each).
// Expected: All tied through common-opponents, must proceed/restart.
export const big12ThreeWayTie: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12], // 12 beats 9
    [2, 9], // 9 beats 38
    [3, 38], // 38 beats 12
    [4, 12], // 12 beats 66
    [5, 9], // 9 beats 66
    [6, 38] // 38 beats 66
  ]),
  teamIds: new Set([12, 9, 38]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66])
}

// ============================================================================
// Fixture 3: big12FourWayTie
// ============================================================================
// Four teams with restart: 12 beats all others, 9 beats 38 and 66, 38 beats 66
// After H2H removal of 12, remaining three restart: 9 is 2-0, 38 is 1-1, 66 is 0-2
export const big12FourWayTie: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 12, awayId: 66, conferenceGame: true },
    { id: 4, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 5, homeId: 9, awayId: 66, conferenceGame: true },
    { id: 6, homeId: 38, awayId: 66, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12], // 12 beats 9
    [2, 12], // 12 beats 38
    [3, 12], // 12 beats 66
    [4, 9], // 9 beats 38
    [5, 9], // 9 beats 66
    [6, 38] // 38 beats 66
  ]),
  teamIds: new Set([12, 9, 38, 66]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 12, awayId: 66, conferenceGame: true },
    { id: 4, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 5, homeId: 9, awayId: 66, conferenceGame: true },
    { id: 6, homeId: 38, awayId: 66, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66])
}

// ============================================================================
// Fixture 4: big12FiveWayTie
// ============================================================================
// Five teams with chain: 12 beats all, 9 beats 38/66/197, 38 beats 66/197, 66 beats 197
export const big12FiveWayTie: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 12, awayId: 66, conferenceGame: true },
    { id: 4, homeId: 12, awayId: 197, conferenceGame: true },
    { id: 5, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 6, homeId: 9, awayId: 66, conferenceGame: true },
    { id: 7, homeId: 9, awayId: 197, conferenceGame: true },
    { id: 8, homeId: 38, awayId: 66, conferenceGame: true },
    { id: 9, homeId: 38, awayId: 197, conferenceGame: true },
    { id: 10, homeId: 66, awayId: 197, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12], [2, 12], [3, 12], [4, 12],
    [5, 9], [6, 9], [7, 9],
    [8, 38], [9, 38],
    [10, 66]
  ]),
  teamIds: new Set([12, 9, 38, 66, 197]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 12, awayId: 66, conferenceGame: true },
    { id: 4, homeId: 12, awayId: 197, conferenceGame: true },
    { id: 5, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 6, homeId: 9, awayId: 66, conferenceGame: true },
    { id: 7, homeId: 9, awayId: 197, conferenceGame: true },
    { id: 8, homeId: 38, awayId: 66, conferenceGame: true },
    { id: 9, homeId: 38, awayId: 197, conferenceGame: true },
    { id: 10, homeId: 66, awayId: 197, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66, 197])
}

// ============================================================================
// Fixture 5: big12RestartVsContinueDivergence
// ============================================================================
// Three teams: 12 beats both 9 and 38, 9 beats 38.
// Correct (restart): 12 #1, then 9 vs 38 → 9 #2
// Wrong (continue): might produce different result
export const big12RestartVsContinueDivergence: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 9, awayId: 38, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12],
    [2, 12],
    [3, 9]
  ]),
  teamIds: new Set([12, 9, 38]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 9, awayId: 38, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38])
}

// ============================================================================
// Fixture 6: big12PartialHeadToHeadGraph
// ============================================================================
// Three teams: 12 beat 9, 9 beat 38, but 12 and 38 didn't play.
// H2H partial, so move to common opponents (66).
export const big12PartialHeadToHeadGraph: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 38, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12],
    [2, 9],
    [3, 12],
    [4, 9],
    [5, 38]
  ]),
  teamIds: new Set([12, 9, 38]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 38, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66])
}

// ============================================================================
// Fixture 7: big12ZeroCommonOpponents
// ============================================================================
// Two teams: 12 beat 9 in H2H (resolved immediately).
// They have zero common opponents beyond H2H.
export const big12ZeroCommonOpponents: Big12Fixture = {
  conferenceGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 9, awayId: 66, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12],
    [2, 38],
    [3, 9]
  ]),
  teamIds: new Set([12, 9]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 12, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 9, awayId: 66, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66])
}

// ============================================================================
// Fixture 8: big12CollectiveBucketComparison (D-05 regression key)
// ============================================================================
// Three teams (12, 9, 38) each 1-1 (H2H cycle).
// Common opponent 66: all beat it.
// Next-highest placed: bucket [197, 248] both 1-1 raw record.
// 12 beats both → 2-0 (100%)
// 9 beats 197, loses to 248 → 1-1 (50%)
// 38 loses to 197, beats 248 → 1-1 (50%)
// Collective: bucket is 1-5 overall. Team 12 at 100%, others at 50%.
export const big12CollectiveBucketComparison: Big12Fixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },

    // Common opponent 66
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true },

    // Next-highest bucket [197, 248]
    { id: 7, homeId: 197, awayId: 12, conferenceGame: true },
    { id: 8, homeId: 197, awayId: 9, conferenceGame: true },
    { id: 9, homeId: 248, awayId: 12, conferenceGame: true },
    { id: 10, homeId: 248, awayId: 38, conferenceGame: true },
    { id: 11, homeId: 197, awayId: 66, conferenceGame: true },
    { id: 12, homeId: 248, awayId: 9, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 12], [2, 9], [3, 38],
    [4, 12], [5, 9], [6, 38],
    [7, 12], [8, 9], [9, 12], [10, 38],
    [11, 197], [12, 248]
  ]),
  teamIds: new Set([12, 9, 38]),
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true },
    { id: 7, homeId: 197, awayId: 12, conferenceGame: true },
    { id: 8, homeId: 197, awayId: 9, conferenceGame: true },
    { id: 9, homeId: 248, awayId: 12, conferenceGame: true },
    { id: 10, homeId: 248, awayId: 38, conferenceGame: true },
    { id: 11, homeId: 197, awayId: 66, conferenceGame: true },
    { id: 12, homeId: 248, awayId: 9, conferenceGame: true }
  ],
  knownFbsTeamIds: new Set([12, 9, 38, 66, 197, 248])
}

// ============================================================================
// Fixture 9: big12NeedsUserInputViaTotalWins
// ============================================================================
// Three teams (12, 9, 38) all tied through SoS, reaching total-wins.
// Each has same H2H (cycle), same common opponents (all beat 66 equally),
// same SoS. At total-wins: all have same capped count (can't separate).
// Result: NeedsUserInput with reason 'ranking-step'.
export const big12NeedsUserInputViaTotalWins: Big12Fixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },

    // Common opponent
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true },

    // Next-highest placed
    { id: 7, homeId: 197, awayId: 12, conferenceGame: true },
    { id: 8, homeId: 197, awayId: 9, conferenceGame: true },
    { id: 9, homeId: 197, awayId: 38, conferenceGame: true },

    // SoS makers
    { id: 10, homeId: 248, awayId: 12, conferenceGame: true },
    { id: 11, homeId: 252, awayId: 9, conferenceGame: true },
    { id: 12, homeId: 254, awayId: 38, conferenceGame: true }
  ],

  // Non-FBS games for total-wins step
  allSeasonGames: [
    { id: 1, homeId: 12, awayId: 9, conferenceGame: true },
    { id: 2, homeId: 9, awayId: 38, conferenceGame: true },
    { id: 3, homeId: 38, awayId: 12, conferenceGame: true },
    { id: 4, homeId: 66, awayId: 12, conferenceGame: true },
    { id: 5, homeId: 66, awayId: 9, conferenceGame: true },
    { id: 6, homeId: 66, awayId: 38, conferenceGame: true },
    { id: 7, homeId: 197, awayId: 12, conferenceGame: true },
    { id: 8, homeId: 197, awayId: 9, conferenceGame: true },
    { id: 9, homeId: 197, awayId: 38, conferenceGame: true },
    { id: 10, homeId: 248, awayId: 12, conferenceGame: true },
    { id: 11, homeId: 252, awayId: 9, conferenceGame: true },
    { id: 12, homeId: 254, awayId: 38, conferenceGame: true },

    // Non-FBS wins (one per team, capped at 1 per FCS rule)
    { id: 100, homeId: 12, awayId: 5000, conferenceGame: false },
    { id: 101, homeId: 9, awayId: 5001, conferenceGame: false },
    { id: 102, homeId: 38, awayId: 5002, conferenceGame: false }
  ],

  outcomes: new Map([
    [1, 12], [2, 9], [3, 38],
    [4, 12], [5, 9], [6, 38],
    [7, 12], [8, 9], [9, 38],
    [10, 12], [11, 9], [12, 38],

    [100, 12], [101, 9], [102, 38]
  ]),

  teamIds: new Set([12, 9, 38]),
  knownFbsTeamIds: new Set([12, 9, 38, 66, 197, 248, 252, 254])
}
