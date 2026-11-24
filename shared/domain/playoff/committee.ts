/**
 * The committee model: predicts where the CFP selection committee would
 * rank teams after results that happened (or that a scenario picked, or a
 * simulation drew) AFTER its latest published ranking.
 *
 * Shape of the model, per the 2026-11-23 design decision -- a
 * committee-style rating in the spirit of FiveThirtyEight's CFP model
 * (an Elo variant built to mimic how the committee reacts), anchored to the
 * committee's own latest ranking:
 *
 * 1. Anchor: every team starts from a score on a "rank points" scale where
 *    one ranking spot = 2 points. #1 = 100, #25 = 52. Unranked teams start
 *    below #25, spaced by how far their SP+ trails the lowest-ranked team's.
 *    With no committee ranking yet, the AP poll anchors; with neither, SP+.
 * 2. Every result after the anchor moves both teams:
 *    - a loss costs 4 points (2 spots) against a #1-calibre team, rising to
 *      12 (6 spots) against an unranked one -- the committee punishes bad
 *      losses far more than good ones, but a top-5 team losing to an
 *      unranked one typically slides about five spots, not out of the
 *      picture (e.g. 2022 Tennessee, #5 -> #10 after South Carolina);
 *      losing to an FCS team costs 16;
 *    - a win earns 0.5 points against an unranked team, rising to 8 against
 *      a #1-calibre team -- quality wins move teams, cupcakes don't;
 *    - a conference title game loss counts half (the committee has
 *      consistently kept title-game losers in the field), and the winner
 *      gets a 3-point conference-champion bonus on top of the win.
 *    Opponent strength is read from the ANCHOR score, so the result doesn't
 *    depend on the order games are applied in.
 * 3. Ties on score fall back to SP+.
 *
 * Deliberately simple and transparent; the playoff page lets the user drag
 * the projected order wherever they think the committee will actually put
 * teams, and that override always wins over this model.
 */

export const POINTS_PER_SPOT = 2
const TOP_SCORE = 100
const UNRANKED_CEILING = TOP_SCORE - POINTS_PER_SPOT * 25 // 50: one spot below #25
const CHAMPION_BONUS = 3
const MIN_LOSS_PENALTY = 4
const MAX_LOSS_PENALTY = 12
const FCS_LOSS_PENALTY = 16
const TITLE_GAME_LOSS_WEIGHT = 0.5

export interface CommitteeAnchor {
  source: 'cfp' | 'ap' | 'none'
  /** CFBD poll week of the anchor ranking. Results from this week on are applied on top of it. `null` = apply every result. */
  week: number | null
  rankings: readonly { teamId: number, rank: number }[]
}

export interface CommitteeGameResult {
  winnerId: number
  loserId: number
  titleGame: boolean
}

/** Starting score for every team, from the anchor ranking (and SP+ below it). */
export function anchorScores(
  anchor: CommitteeAnchor,
  teamIds: readonly number[],
  spRatings: ReadonlyMap<number, number>
): Map<number, number> {
  const scores = new Map<number, number>()
  const ranked = new Map(anchor.rankings.map(r => [r.teamId, r.rank]))

  const rankedSp = anchor.rankings
    .map(r => spRatings.get(r.teamId))
    .filter((v): v is number => v !== undefined)
  // Without an anchor ranking, SP+ alone places everyone: the best SP+ team
  // gets the top score and the scale runs down from there.
  const spReference = rankedSp.length > 0 ? Math.min(...rankedSp) : Math.max(...teamIds.map(id => spRatings.get(id) ?? -100))
  const unrankedTop = rankedSp.length > 0 ? UNRANKED_CEILING : TOP_SCORE

  for (const teamId of teamIds) {
    const rank = ranked.get(teamId)
    if (rank !== undefined) {
      scores.set(teamId, TOP_SCORE - POINTS_PER_SPOT * (rank - 1))
      continue
    }
    const sp = spRatings.get(teamId) ?? -100
    // Below the ranked teams, one SP+ point behind the reference = one spot.
    scores.set(teamId, Math.min(unrankedTop, unrankedTop - POINTS_PER_SPOT * Math.max(0, spReference - sp)))
  }

  return scores
}

function lossPenalty(winnerAnchor: number): number {
  return Math.min(MAX_LOSS_PENALTY, Math.max(MIN_LOSS_PENALTY, MIN_LOSS_PENALTY + 0.16 * (TOP_SCORE - winnerAnchor)))
}

function winCredit(loserAnchor: number): number {
  return 0.5 + 0.15 * Math.max(0, loserAnchor - UNRANKED_CEILING)
}

export interface CommitteeRanking {
  /** Every team, best first. */
  order: number[]
  scores: Map<number, number>
}

/**
 * Applies post-anchor results to the anchor scores and returns the
 * resulting order. Pure; `anchor` is not mutated.
 */
export function committeeRanking(
  anchor: ReadonlyMap<number, number>,
  results: Iterable<CommitteeGameResult>,
  spRatings: ReadonlyMap<number, number>
): CommitteeRanking {
  const scores = new Map(anchor)
  for (const r of results) {
    const winnerAnchor = anchor.get(r.winnerId)
    const loserAnchor = anchor.get(r.loserId)
    if (winnerAnchor !== undefined && loserAnchor !== undefined) {
      scores.set(r.winnerId, scores.get(r.winnerId)! + winCredit(loserAnchor) + (r.titleGame ? CHAMPION_BONUS : 0))
      const penalty = lossPenalty(winnerAnchor) * (r.titleGame ? TITLE_GAME_LOSS_WEIGHT : 1)
      scores.set(r.loserId, scores.get(r.loserId)! - penalty)
    } else if (loserAnchor !== undefined) {
      // Lost to a team outside the model (FCS): the worst kind of loss.
      scores.set(r.loserId, scores.get(r.loserId)! - FCS_LOSS_PENALTY)
    }
  }

  const order = [...scores.keys()].sort((a, b) =>
    scores.get(b)! - scores.get(a)! || (spRatings.get(b) ?? -100) - (spRatings.get(a) ?? -100) || a - b
  )
  return { order, scores }
}
