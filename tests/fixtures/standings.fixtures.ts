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
    neutralSite: false
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
