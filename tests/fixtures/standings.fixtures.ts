/**
 * Standings fixtures for Phase 05-01.
 *
 * A deliberately tiny synthetic universe rather than a slice of the real 2026
 * slate: every expected W-L below is hand-countable from the games listed
 * here, which is what makes these tests able to catch a regression in the
 * aggregation itself (threat T-05-01). Real-data assertions would only prove
 * the function agrees with itself.
 *
 * Roster: 5 SEC teams, 2 each in Big Ten / Big 12 / ACC, one G5 team, and one
 * FCS opponent that deliberately has NO entry in `allTeams` (mirroring the
 * 127 real games whose `awayId` is absent from `teams.json`).
 */

import type { Game, Team } from '../../shared/types/schedule'
import type { ConferenceId, ConferenceRanking } from '../../shared/domain/tiebreakers/types'

// ---------------------------------------------------------------------------
// Team ids
// ---------------------------------------------------------------------------

export const ALABAMA = 1
export const FLORIDA = 2
export const GEORGIA = 3
export const LSU = 4
export const OLE_MISS = 5

export const MICHIGAN = 11
export const OHIO_STATE = 12

export const BAYLOR = 21
export const TCU = 22

export const CLEMSON = 31
export const DUKE = 32

/** Mid-American (G5): a legal opponent, but never a standings entry. */
export const AKRON = 41

/** Not present in `allTeams` at all — the FCS case. */
export const FCS_OPPONENT = 99

function team(id: number, school: string, conference: string): Team {
  return {
    id,
    school,
    mascot: null,
    abbreviation: null,
    conference,
    classification: 'fbs',
    color: '#123456',
    alternateColor: '#654321',
    logo: `/logos/${id}.png`
  }
}

export const allTeams: Team[] = [
  team(ALABAMA, 'Alabama', 'SEC'),
  team(FLORIDA, 'Florida', 'SEC'),
  team(GEORGIA, 'Georgia', 'SEC'),
  team(LSU, 'LSU', 'SEC'),
  team(OLE_MISS, 'Ole Miss', 'SEC'),
  team(MICHIGAN, 'Michigan', 'Big Ten'),
  team(OHIO_STATE, 'Ohio State', 'Big Ten'),
  team(BAYLOR, 'Baylor', 'Big 12'),
  team(TCU, 'TCU', 'Big 12'),
  team(CLEMSON, 'Clemson', 'ACC'),
  team(DUKE, 'Duke', 'ACC'),
  team(AKRON, 'Akron', 'Mid-American')
]

const schoolById = new Map(allTeams.map(t => [t.id, t.school]))

export function game(
  id: number,
  homeId: number,
  awayId: number,
  conferenceGame: boolean,
  week = 1
): Game {
  return {
    id,
    week,
    seasonType: 'regular',
    homeId,
    homeTeam: schoolById.get(homeId) ?? `Team ${homeId}`,
    awayId,
    awayTeam: schoolById.get(awayId) ?? `Team ${awayId}`,
    conferenceGame,
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null
  }
}

// ---------------------------------------------------------------------------
// Scenario: SEC round robin producing a 1 / 2-2-2 / 5 rank shape
// ---------------------------------------------------------------------------

/**
 * All 10 SEC round-robin games. Combined with `secRoundRobinPicks`:
 *
 * | team     | conf record | expected rank |
 * |----------|-------------|---------------|
 * | Alabama  | 4-0         | 1             |
 * | Florida  | 2-2         | 2 (tied)      |
 * | Georgia  | 2-2         | 2 (tied)      |
 * | LSU      | 2-2         | 2 (tied)      |
 * | Ole Miss | 0-4         | 5             |
 *
 * Florida/Georgia/LSU form a deliberate head-to-head cycle (Florida beat
 * Georgia, Georgia beat LSU, LSU beat Florida) so the SEC's tiebreaker
 * procedure genuinely cannot separate them — which is precisely the case
 * D-04's shared-rank rule has to survive.
 */
export const secRoundRobinGames: Game[] = [
  game(101, ALABAMA, FLORIDA, true),
  game(102, ALABAMA, GEORGIA, true),
  game(103, ALABAMA, LSU, true),
  game(104, ALABAMA, OLE_MISS, true),
  game(105, FLORIDA, GEORGIA, true),
  game(106, GEORGIA, LSU, true),
  game(107, LSU, FLORIDA, true),
  game(108, FLORIDA, OLE_MISS, true),
  game(109, GEORGIA, OLE_MISS, true),
  game(110, LSU, OLE_MISS, true)
]

export const secRoundRobinPicks: Record<number, number> = {
  101: ALABAMA,
  102: ALABAMA,
  103: ALABAMA,
  104: ALABAMA,
  105: FLORIDA,
  106: GEORGIA,
  107: LSU,
  108: FLORIDA,
  109: GEORGIA,
  110: LSU
}

export const secRoundRobinExpectedRanks: ReadonlyArray<{ school: string, rank: number, conf: string }> = [
  { school: 'Alabama', rank: 1, conf: '4-0' },
  { school: 'Florida', rank: 2, conf: '2-2' },
  { school: 'Georgia', rank: 2, conf: '2-2' },
  { school: 'LSU', rank: 2, conf: '2-2' },
  { school: 'Ole Miss', rank: 5, conf: '0-4' }
]

// ---------------------------------------------------------------------------
// Scenario: conference record and overall record must diverge
// ---------------------------------------------------------------------------

/**
 * Alabama plays 4 SEC games and 2 non-conference games (one G5, one FCS).
 * With `separationPicks` its conference record is 3-1 while its overall
 * record is 5-1 — the two axes have different denominators AND different
 * numerators, so a bug that reuses one for the other cannot pass (STAND-03).
 */
export const separationGames: Game[] = [
  game(201, ALABAMA, FLORIDA, true),
  game(202, ALABAMA, GEORGIA, true),
  game(203, ALABAMA, LSU, true),
  game(204, ALABAMA, OLE_MISS, true),
  game(205, ALABAMA, AKRON, false),
  game(206, ALABAMA, FCS_OPPONENT, false)
]

export const separationPicks: Record<number, number> = {
  201: ALABAMA,
  202: ALABAMA,
  203: LSU, // Alabama's only loss, a conference loss
  204: ALABAMA,
  205: ALABAMA, // non-conference win vs G5
  206: ALABAMA // non-conference win vs FCS
}

// ---------------------------------------------------------------------------
// Scenario: minimal one-game slates
// ---------------------------------------------------------------------------

/** One SEC conference game: Alabama at home vs Florida. */
export const singleConferenceGame: Game[] = [game(301, ALABAMA, FLORIDA, true)]

/** One non-conference game against a G5 opponent that must not appear in standings. */
export const singleNonConferenceGame: Game[] = [game(401, ALABAMA, AKRON, false)]

/** One non-conference game against an opponent absent from `allTeams` entirely. */
export const singleFcsGame: Game[] = [game(501, ALABAMA, FCS_OPPONENT, false)]

/**
 * A same-conference matchup the schedule explicitly marks NON-conference.
 * One such game exists in the committed 2026 slate, so the flag — not team
 * membership — has to be what decides conference-record credit.
 */
export const unflaggedSameConferenceGame: Game[] = [game(601, ALABAMA, FLORIDA, false)]

// ---------------------------------------------------------------------------
// Phase 05-03 (CR-01 / WR-07): fixtures the pre-existing set is blind to
// ---------------------------------------------------------------------------
//
// Everything above this line is asserted verbatim by the 05-01 tests (exact
// per-conference member counts included), so these are strictly APPENDED —
// no existing export is modified or reordered. Game id blocks 101-110,
// 201-206, 301, 401, 501, 601 are taken above and 701-702 are built inline by
// `computeStandings.test.ts`, so the 800 block is free.

// ---------------------------------------------------------------------------
// Fixture A: ACC, mixed conference-schedule lengths
// ---------------------------------------------------------------------------

/**
 * A standalone six-team ACC roster, deliberately kept OUT of `allTeams` and
 * never merged with it: `computeStandings` returns all four P4 keys regardless
 * of roster coverage, so a single-conference roster is legal input, and the
 * nine 05-01 tests that assert `allTeams`' exact conference membership counts
 * must keep passing untouched.
 *
 * Ids 61-66 collide with nothing in `allTeams` (1-5, 11-12, 21-22, 31-32, 41).
 */
export const BOSTON_COLLEGE = 61
export const LOUISVILLE = 62
export const MIAMI = 63
export const VIRGINIA = 64
export const SYRACUSE = 65
export const WAKE_FOREST = 66

export const accMixedScheduleTeams: Team[] = [
  team(BOSTON_COLLEGE, 'Boston College', 'ACC'),
  team(LOUISVILLE, 'Louisville', 'ACC'),
  team(MIAMI, 'Miami', 'ACC'),
  team(VIRGINIA, 'Virginia', 'ACC'),
  team(SYRACUSE, 'Syracuse', 'ACC'),
  team(WAKE_FOREST, 'Wake Forest', 'ACC')
]

const accSchoolById = new Map(accMixedScheduleTeams.map(t => [t.id, t.school]))

function accGame(id: number, homeId: number, awayId: number): Game {
  return {
    id,
    week: 1,
    seasonType: 'regular',
    homeId,
    homeTeam: accSchoolById.get(homeId) ?? `Team ${homeId}`,
    awayId,
    awayTeam: accSchoolById.get(awayId) ?? `Team ${awayId}`,
    conferenceGame: true,
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null
  }
}

/**
 * Ten ACC conference games which, with `accMixedSchedulePicks`, produce
 * deliberately uneven conference-schedule lengths — the precondition for
 * CR-01 that `secRoundRobinGames` structurally cannot express (every SEC team
 * there plays exactly four conference games):
 *
 * | team           | conf record | conf games | win pct |
 * |----------------|-------------|------------|---------|
 * | Miami          | 3-1         | 4          | .750    |
 * | Boston College | 2-1         | 3          | .667    |
 * | Louisville     | 2-2         | 4          | .500    |
 * | Virginia       | 2-2         | 4          | .500    |
 * | Wake Forest    | 1-2         | 3          | .333    |
 * | Syracuse       | 0-2         | 2          | .000    |
 *
 * Engine behaviour this shape is built to trigger (`defineAccTiedTeams`):
 * Miami is the best-win-pct team (step 1a); Boston College played an
 * ALTERNATE number of conference games (3, not 4) and carries the SAME number
 * of conference losses (1), so step 1b pulls it into the tie. Nobody else
 * qualifies — Louisville and Virginia played the anchor's 4 games, Wake Forest
 * and Syracuse match neither the win nor the loss count.
 *
 * Boston College beat Miami head to head (game 801), and head-to-head is the
 * ACC's only executable step, so `seed1` resolves to
 * [Boston College, Miami] — the .667 team AHEAD of the .750 team. Any
 * standings layer that orders on win percentage puts Miami on top and
 * contradicts the engine outright.
 */
export const accMixedScheduleGames: Game[] = [
  accGame(801, BOSTON_COLLEGE, MIAMI),
  accGame(802, BOSTON_COLLEGE, WAKE_FOREST),
  accGame(803, BOSTON_COLLEGE, LOUISVILLE),
  accGame(804, MIAMI, LOUISVILLE),
  accGame(805, MIAMI, VIRGINIA),
  accGame(806, MIAMI, SYRACUSE),
  accGame(807, LOUISVILLE, VIRGINIA),
  accGame(808, LOUISVILLE, WAKE_FOREST),
  accGame(809, VIRGINIA, SYRACUSE),
  accGame(810, VIRGINIA, WAKE_FOREST)
]

export const accMixedSchedulePicks: Record<number, number> = {
  801: BOSTON_COLLEGE,
  802: BOSTON_COLLEGE,
  803: LOUISVILLE,
  804: MIAMI,
  805: MIAMI,
  806: MIAMI,
  807: LOUISVILLE,
  808: WAKE_FOREST,
  809: VIRGINIA,
  810: VIRGINIA
}

// ---------------------------------------------------------------------------
// Fixture B: equal win percentage, unequal conference record
// ---------------------------------------------------------------------------

/**
 * The partial-pick shape that dominates real usage: two undefeated teams on
 * different numbers of conference games. Alabama finishes 2-0 and Georgia 3-0,
 * so both sit at a 1.000 win percentage — the engine's tie definition for the
 * SEC — while their raw W-L differ, which is exactly the pair the old
 * standings sort never let reach the resolved-order comparison.
 *
 * Alabama and Georgia deliberately never play each other here.
 */
export const equalPctUnequalRecordGames: Game[] = [
  game(811, ALABAMA, FLORIDA, true),
  game(812, ALABAMA, OLE_MISS, true),
  game(813, GEORGIA, FLORIDA, true),
  game(814, GEORGIA, LSU, true),
  game(815, GEORGIA, OLE_MISS, true)
]

export const equalPctUnequalRecordPicks: Record<number, number> = {
  811: ALABAMA,
  812: ALABAMA,
  813: GEORGIA,
  814: GEORGIA,
  815: GEORGIA
}

/**
 * Hand-built rather than engine-derived, because the contract under test is
 * what `computeStandings` does with a GIVEN `ConferenceRanking` — which is
 * precisely the argument Phase 6 will supply by hand (D-11/D-14). Alabama
 * and Georgia are placed in one two-team group (in that order), so they
 * share rank 1 with Alabama's row displayed first — the group's own order
 * decides display, not win count.
 */
export const equalPctUnequalRecordResolved: Partial<Record<ConferenceId, ConferenceRanking>> = {
  SEC: {
    conference: 'SEC',
    groups: [
      {
        teams: [ALABAMA, GEORGIA],
        resolvedBy: 'unresolved',
        contestedWith: [ALABAMA, GEORGIA],
        trace: [],
        terminalReason: { code: 'needs-scores', ruleCitation: '', sourceName: '' }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Fixture C: a team dropped by the restart redefinition (the D-04 hazard)
// ---------------------------------------------------------------------------

/**
 * Alabama 3-0, Georgia 2-1, LSU 2-1 — Georgia and LSU hold an IDENTICAL
 * conference record.
 *
 * Paired with `droppedTiedTeamResolved`, whose groups place Georgia and omit
 * LSU from every group entirely. This is `computeStandings`'s **defensive
 * fallback path** (its docblock's case 2): not reachable from the real
 * `resolveConferenceRanking` on the committed 2026 slate today — Plan 06-02's
 * `contestedWith`-as-trace-union repair means the engine's own termination
 * guarantee (`committed.size === teamIds.size`) always covers the whole
 * roster — but a hand-supplied `ConferenceRanking` naming fewer teams than
 * the conference actually has is exactly what Plan 06-05's manual-decision
 * feature (or a malformed fixture) can produce, and silently dropping a real
 * team from standings is the worst failure mode PROJECT.md's core value
 * cares about, so this path is deliberately, not incidentally, covered.
 *
 * **D-01 changes what this fixture proves.** Under Phase 5's D-04 closure,
 * a team the resolved order dropped still shared a rank with its
 * identical-record twin, because rank was partly record-derived. Under D-01,
 * rank comes ONLY from `ranking.groups` — LSU, named in no group here, falls
 * through to `fallbackOrder` and lands on ITS OWN rank, distinct from
 * Georgia's placed rank, even though their conference records match. See
 * `standings-tiebreaker-agreement.test.ts` for the assertion this drives.
 */
export const droppedTiedTeamGames: Game[] = [
  game(821, ALABAMA, FLORIDA, true),
  game(822, ALABAMA, OLE_MISS, true),
  game(823, ALABAMA, GEORGIA, true),
  game(824, GEORGIA, FLORIDA, true),
  game(825, GEORGIA, LSU, true),
  game(826, LSU, FLORIDA, true),
  game(827, LSU, OLE_MISS, true)
]

export const droppedTiedTeamPicks: Record<number, number> = {
  821: ALABAMA,
  822: ALABAMA,
  823: ALABAMA,
  824: GEORGIA,
  825: GEORGIA,
  826: LSU,
  827: LSU
}

export const droppedTiedTeamResolved: Partial<Record<ConferenceId, ConferenceRanking>> = {
  SEC: {
    conference: 'SEC',
    groups: [
      { teams: [ALABAMA], resolvedBy: 'sole-candidate', contestedWith: [ALABAMA], trace: [] },
      { teams: [GEORGIA], resolvedBy: 'tiebreaker', contestedWith: [GEORGIA, LSU], trace: [] }
      // LSU is deliberately named in NO group — the defensive-fallback case
      // this fixture exists to exercise.
    ]
  }
}
