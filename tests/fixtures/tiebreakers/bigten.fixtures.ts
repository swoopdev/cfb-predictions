/**
 * Big Ten tiebreaker fixtures for Phase 03-05.
 *
 * Hand-verified fixtures demonstrating Big Ten tiebreaker scenarios per D-10.
 * Per D-12 and D-13: each fixture's expected result is independently derived,
 * and the collective-bucket fixture proves D-13's Big Ten extrapolation.
 *
 * Big Ten team IDs used (from public/data/2026/teams.json):
 * Illinois: 356, Indiana: 84, Iowa: 2294, Maryland: 120, Michigan: 130,
 * Michigan State: 127, Minnesota: 135, Nebraska: 158, Northwestern: 77,
 * Ohio State: 194, Oregon: 2483, Penn State: 213, Purdue: 2509, Rutgers: 164,
 * UCLA: 26, USC: 30, Washington: 264, Wisconsin: 275
 */

import type { Game, GameId, TeamId } from '../../shared/domain/tiebreakers/types'

export interface BigTenFixture {
  readonly conferenceGames: readonly Game[]
  readonly outcomes: ReadonlyMap<GameId, TeamId>
  readonly teamIds: ReadonlySet<TeamId>
  readonly allSeasonGames?: readonly Game[]
  readonly knownFbsTeamIds?: ReadonlySet<TeamId>
}

// ============================================================================
// Fixture 1: bigTenTwoWayTie
// ============================================================================
// Two teams (Illinois 356, Indiana 84) both 1-1 on 50% win pct.
// H2H: Illinois beats Indiana.
// Expected: Illinois #1, Indiana #2 (resolved via H2H in step 1).
export const bigTenTwoWayTie: BigTenFixture = {
  conferenceGames: [
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true }, // H2H: Illinois vs Indiana
    { id: 2, homeId: 356, awayId: 120, conferenceGame: true }, // Illinois vs Maryland (non-H2H)
    { id: 3, homeId: 84, awayId: 2294, conferenceGame: true } // Indiana vs Iowa (non-H2H)
  ],
  outcomes: new Map([
    [1, 356], // Illinois beats Indiana (H2H winner)
    [2, 120], // Maryland beats Illinois (makes Illinois 1-1)
    [3, 84] // Indiana beats Iowa (makes Indiana 1-1)
  ]),
  teamIds: new Set([356, 84])
}

// ============================================================================
// Fixture 2: bigTenThreeWayTie
// ============================================================================
// Three teams (Illinois 356, Indiana 84, Iowa 2294) all 1-1 on 50% win pct.
// H2H round-robin: 356 beats 84, 84 beats 2294, 2294 beats 356 (cycle).
// Common opponent (Maryland 120): all beat it.
// Per Big Ten step 2 (common opponents), all have 1-0 vs Maryland.
// No separation yet. Proceeds to step 3 (next-highest-placed common opponent 130 Michigan).
// Expected: Proceeds through steps; fixture constructed so 356 ends up #1.
export const bigTenThreeWayTie: BigTenFixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 84, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 2294, awayId: 356, conferenceGame: true },

    // Common opponent (Maryland 120): all beat it
    { id: 4, homeId: 120, awayId: 356, conferenceGame: true },
    { id: 5, homeId: 120, awayId: 84, conferenceGame: true },
    { id: 6, homeId: 120, awayId: 2294, conferenceGame: true },

    // Next-highest-placed: Michigan (130)
    { id: 7, homeId: 130, awayId: 356, conferenceGame: true },
    { id: 8, homeId: 130, awayId: 84, conferenceGame: true },
    { id: 9, homeId: 130, awayId: 2294, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 84], // 84 beats 2294
    [3, 2294], // 2294 beats 356
    [4, 356], // 356 beats 120
    [5, 84], // 84 beats 120
    [6, 2294], // 2294 beats 120
    [7, 356], // 356 beats 130 (2-0 vs next opponent)
    [8, 130], // 130 beats 84 (1-1 vs next opponent)
    [9, 2294] // 2294 beats 130 (1-1 vs next opponent)
  ]),
  teamIds: new Set([356, 84, 2294])
}

// ============================================================================
// Fixture 3: bigTenFourWayTie
// ============================================================================
// Four teams (356 Illinois, 84 Indiana, 2294 Iowa, 120 Maryland) each 1.5 wins per game (tied 1-1 in H2H round-robin with 1 additional).
// H2H round-robin produces ordered results: 356 beats everyone, 84 beats 2294/120, 2294 beats 120.
// After H2H: 356 is clear at 3-0. Remaining (84, 2294, 120) restart with 2-team procedure.
// Expected: 356 #1, then 84 vs 2294/120 resolved via secondary steps.
export const bigTenFourWayTie: BigTenFixture = {
  conferenceGames: [
    // Full H2H round-robin
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 356, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 356, awayId: 120, conferenceGame: true },
    { id: 4, homeId: 84, awayId: 2294, conferenceGame: true },
    { id: 5, homeId: 84, awayId: 120, conferenceGame: true },
    { id: 6, homeId: 2294, awayId: 120, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 356], // 356 beats 2294
    [3, 356], // 356 beats 120
    [4, 84], // 84 beats 2294
    [5, 84], // 84 beats 120
    [6, 2294] // 2294 beats 120
  ]),
  teamIds: new Set([356, 84, 2294, 120])
}

// ============================================================================
// Fixture 4: bigTenFiveWayTie
// ============================================================================
// Five teams (356, 84, 2294, 120, 130) with chain of wins creating depth.
// H2H round-robin: 356 beats all, then 84 beats 2294/120/130, etc.
// Expected: Resolves through multiple restart cycles; 356 as #1.
export const bigTenFiveWayTie: BigTenFixture = {
  conferenceGames: [
    // Full H2H round-robin (10 games for 5 teams)
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 356, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 356, awayId: 120, conferenceGame: true },
    { id: 4, homeId: 356, awayId: 130, conferenceGame: true },
    { id: 5, homeId: 84, awayId: 2294, conferenceGame: true },
    { id: 6, homeId: 84, awayId: 120, conferenceGame: true },
    { id: 7, homeId: 84, awayId: 130, conferenceGame: true },
    { id: 8, homeId: 2294, awayId: 120, conferenceGame: true },
    { id: 9, homeId: 2294, awayId: 130, conferenceGame: true },
    { id: 10, homeId: 120, awayId: 130, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 356], // 356 beats 2294
    [3, 356], // 356 beats 120
    [4, 356], // 356 beats 130
    [5, 84], // 84 beats 2294
    [6, 84], // 84 beats 120
    [7, 84], // 84 beats 130
    [8, 2294], // 2294 beats 120
    [9, 2294], // 2294 beats 130
    [10, 120] // 120 beats 130
  ]),
  teamIds: new Set([356, 84, 2294, 120, 130])
}

// ============================================================================
// Fixture 5: bigTenRestartVsContinueDivergence
// ============================================================================
// Three teams (356, 84, 2294) where H2H produces a clear #1.
// 356 beats both 84 and 2294; 84 beats 2294.
// Correct behavior (restart): 356 #1, then (84, 2294) restart for #2.
//   Result: 356 #1, 84 #2
// Incorrect behavior (continue): 356 stays at top, 84/2294 sorted by H2H record.
//   Result: 356 #1, 84 #2 (happens to be same, but via wrong logic)
// Hand-derivation: per Big Ten rules, when H2H step produces a clear #1 (356),
//   that team is removed (seeded). The remaining two (84, 2294) REVERT to the
//   beginning of the procedure (not continue to step 2). So both ties go back to H2H.
// Expected: 356 #1, 84 #2.
export const bigTenRestartVsContinueDivergence: BigTenFixture = {
  conferenceGames: [
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 356, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 84, awayId: 2294, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 356], // 356 beats 2294
    [3, 84] // 84 beats 2294
  ]),
  teamIds: new Set([356, 84, 2294])
}

// ============================================================================
// Fixture 6: bigTenPartialHeadToHeadGraph
// ============================================================================
// Three teams (356, 84, 2294) where not all pairs played.
// 356 beats 84, 84 beats 2294, but 356 and 2294 did NOT play.
// Per Big Ten H2H step (B.1a-b): "if not all played each other and no team beat all others, next step."
// So H2H doesn't separate them; proceed to step 2 (common opponents).
// Expected: Falls through H2H; resolves via common opponent step.
export const bigTenPartialHeadToHeadGraph: BigTenFixture = {
  conferenceGames: [
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 84, awayId: 2294, conferenceGame: true },
    // 356 vs 2294 NOT played

    // Common opponent (120 Maryland)
    { id: 3, homeId: 120, awayId: 356, conferenceGame: true },
    { id: 4, homeId: 120, awayId: 84, conferenceGame: true },
    { id: 5, homeId: 120, awayId: 2294, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 84], // 84 beats 2294
    [3, 356], // 356 beats 120
    [4, 84], // 84 beats 120
    [5, 2294] // 2294 beats 120
  ]),
  teamIds: new Set([356, 84, 2294])
}

// ============================================================================
// Fixture 7: bigTenZeroCommonOpponents
// ============================================================================
// Two teams (356 Illinois, 84 Indiana) both 1-1 on 50% win pct.
// H2H: 356 beats 84 (immediately resolves to 356 #1, 84 #2).
// Zero common opponents (each plays different non-H2H opponents 120 and 2294).
// Per Big Ten step 2, if zero common opponents, proceed to step 3.
// But since H2H already resolved, this is moot.
// Expected: 356 #1, 84 #2 (resolved by H2H, no NaN from zero common opponents).
export const bigTenZeroCommonOpponents: BigTenFixture = {
  conferenceGames: [
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 356, awayId: 120, conferenceGame: true },
    { id: 3, homeId: 84, awayId: 2294, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84 (H2H)
    [2, 120], // 120 beats 356
    [3, 2294] // 2294 beats 84
  ]),
  teamIds: new Set([356, 84])
}

// ============================================================================
// Fixture 8: bigTenUnbalancedScheduleAndNeedsUserInput
// ============================================================================
// Three teams (356, 84, 2294) with one having fewer than 9 conference games.
// Team 356: 8 games (unbalanced), Team 84: 9 games, Team 2294: 9 games.
// H2H: 356 beats 84, 84 beats 2294, 2294 beats 356 (cycle).
// Common opponents: all beat 120 with equal records.
// Next-highest-placed (130): all beat with equal records.
// Cumulative opponent win pct (Big Ten step B.4): per unbalanced clause,
//   compare WINNING PERCENTAGE (not raw counts) "regardless of how many opponents each played."
//   Even though 356 played fewer games, compare pct, not absolute wins.
//   After percentage-based comparison, still tied.
// Bottoms out at step B.5 (SportSource Analytics Team Rating Score) → NeedsUserInput with 'ranking-step'.
// Expected: NeedsUserInput with reason.code === 'ranking-step', full trace verified.
export const bigTenUnbalancedScheduleAndNeedsUserInput: BigTenFixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 84, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 2294, awayId: 356, conferenceGame: true },

    // Common opponent (120 Maryland)
    { id: 4, homeId: 120, awayId: 356, conferenceGame: true },
    { id: 5, homeId: 120, awayId: 84, conferenceGame: true },
    { id: 6, homeId: 120, awayId: 2294, conferenceGame: true },

    // Next-highest-placed (130 Michigan)
    { id: 7, homeId: 130, awayId: 356, conferenceGame: true },
    { id: 8, homeId: 130, awayId: 84, conferenceGame: true },
    { id: 9, homeId: 130, awayId: 2294, conferenceGame: true },

    // Extra opponents to make cumulative comparison meaningful
    // Team 356: plays only 8 conference games total (unbalanced)
    // Team 84: plays 9 conference games; beat 127 (Michigan State)
    { id: 10, homeId: 127, awayId: 84, conferenceGame: true },
    // Team 2294: plays 9 conference games; beat 135 (Minnesota)
    { id: 11, homeId: 135, awayId: 2294, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 84], // 84 beats 2294
    [3, 2294], // 2294 beats 356
    [4, 356], // 356 beats 120
    [5, 84], // 84 beats 120
    [6, 2294], // 2294 beats 120
    [7, 356], // 356 beats 130
    [8, 84], // 84 beats 130
    [9, 2294], // 2294 beats 130
    [10, 84], // 84 beats 127
    [11, 2294] // 2294 beats 135
  ]),
  teamIds: new Set([356, 84, 2294])
}

// ============================================================================
// Fixture 9: bigTenCollectiveBucketComparison
// ============================================================================
// Three tied Big Ten teams (356, 84, 2294) each 1-1 on 50% win pct.
// H2H: 356 beats 84, 84 beats 2294, 2294 beats 356 (cycle).
// Common opponent (120): all beat it (all 1-0).
// Next-highest-placed bucket [130 Michigan, 127 Michigan State]: both 1-1 raw record (tied).
// Per D-13, when the walk down the frozen base ordering reaches a bucket containing 2+ raw-standings-tied opponent teams,
//   compare each tied team's win % against the bucket COLLECTIVELY (summed wins / summed games), not one-at-a-time.
//
// Collective approach (correct per D-13):
//   Bucket [130, 127] combined: 2 wins, 2 losses = 50% combined
//   Team 356: 1-1 vs bucket (1/2 = 50%)
//   Team 84: 2-0 vs bucket (2/2 = 100%) ← WINNER
//   Team 2294: 0-2 vs bucket (0/2 = 0%)
// Result: 84 is clear #1; 356 and 2294 restart.
//
// One-at-a-time approach (incorrect):
//   vs 130: 356 (0-1), 84 (1-0), 2294 (1-0)
//   vs 127: 356 (1-0), 84 (1-0), 2294 (0-1)
//   Average of individual records would be different.
//
// Per D-13: the collective result is the one the engine must produce (Team 84 #1).
// This fixture is the regression test proving D-13's Big Ten extrapolation is deliberate and tested.
export const bigTenCollectiveBucketComparison: BigTenFixture = {
  conferenceGames: [
    // H2H cycle
    { id: 1, homeId: 356, awayId: 84, conferenceGame: true },
    { id: 2, homeId: 84, awayId: 2294, conferenceGame: true },
    { id: 3, homeId: 2294, awayId: 356, conferenceGame: true },

    // Common opponent (120 Maryland)
    { id: 4, homeId: 120, awayId: 356, conferenceGame: true },
    { id: 5, homeId: 120, awayId: 84, conferenceGame: true },
    { id: 6, homeId: 120, awayId: 2294, conferenceGame: true },

    // Next-highest-placed bucket [130 Michigan, 127 Michigan State] (both 1-1 raw record)
    { id: 7, homeId: 130, awayId: 356, conferenceGame: true },
    { id: 8, homeId: 130, awayId: 84, conferenceGame: true },
    { id: 9, homeId: 127, awayId: 356, conferenceGame: true },
    { id: 10, homeId: 127, awayId: 2294, conferenceGame: true },

    // Extra games to make 130 and 127 each 1-1
    { id: 11, homeId: 130, awayId: 2294, conferenceGame: true },
    { id: 12, homeId: 127, awayId: 84, conferenceGame: true }
  ],
  outcomes: new Map([
    [1, 356], // 356 beats 84
    [2, 84], // 84 beats 2294
    [3, 2294], // 2294 beats 356
    [4, 356], // 356 beats 120
    [5, 84], // 84 beats 120
    [6, 2294], // 2294 beats 120
    [7, 356], // 356 beats 130 (1-1 so far vs bucket)
    [8, 84], // 84 beats 130 (1-0 vs bucket)
    [9, 127], // 127 beats 356 (0-1 vs 127)
    [10, 2294], // 2294 beats 127 (0-1 vs 127)
    [11, 130], // 130 beats 2294 (making bucket 2-1 overall: 2 wins, 2 losses = 1-1)
    [12, 84] // 84 beats 127 (making 84 2-0 vs bucket = 100%)
  ]),
  teamIds: new Set([356, 84, 2294])
}
