import type { Game, Team } from '../../types/schedule'
import type { CfpRankingsEnvelope } from '../../types/cfpRankings'
import type { RankingsEnvelope } from '../../types/rankings'
import type { PostseasonGame } from '../../types/postseason'
import type { ConferenceId } from '../tiebreakers/types'
import type { ConferenceDecisions } from '../tiebreakers/invalidation'
import { buildConferenceContexts, resolveTitleGame } from './conferenceResolver'
import type { ConferenceContext, TitleGameResolution } from './conferenceResolver'
import { homeWinProbability, neutralWinProbability, tiebreakProxy } from './winProbability'
import type { WinProbabilityInputs } from './winProbability'
import { GROUP_OF_SIX, POWER_FOUR, playoffFormatFor } from '../playoff/formats'
import type { PlayoffFormat } from '../playoff/formats'
import { anchorScores, committeeRanking } from '../playoff/committee'
import type { CommitteeAnchor, CommitteeGameResult, CommitteeRanking } from '../playoff/committee'
import { selectPlayoffField } from '../playoff/field'
import type { FieldEntry } from '../playoff/field'

/**
 * Everything the odds/playoff engines read, as plain serializable data --
 * the exact payload the Web Worker receives, and what
 * `scripts/compute-odds.ts` assembles from `public/data/{season}/`.
 */
export interface SeasonModelData {
  season: number
  games: readonly Game[]
  teams: readonly Team[]
  pregame: readonly { gameId: number, homeWinProbability: number }[]
  spRatings: readonly { teamId: number, spRating: number | null }[]
  cfpRankings: CfpRankingsEnvelope | null
  apRankings: RankingsEnvelope | null
  postseasonGames: readonly PostseasonGame[]
}

/**
 * Assembles `SeasonModelData` from the committed JSON envelopes -- the one
 * mapping both the app (`useSeasonModelData`) and the nightly baseline
 * script use, so they can never feed the engines different inputs. Every
 * weekly/daily dataset is optional: a missing file degrades the model
 * (no lines -> SP+ only, no committee ranking -> AP anchor), never fails it.
 */
export function seasonModelDataFrom(sources: {
  season: number
  games: readonly Game[]
  teams: readonly Team[]
  winProbabilities?: { probabilities: readonly { gameId: number, homeWinProbability: number }[] } | null
  teamRatings?: { ratings: readonly { teamId: number, spRating: number | null }[] } | null
  cfpRankings?: CfpRankingsEnvelope | null
  rankings?: RankingsEnvelope | null
  postseason?: { games: readonly PostseasonGame[] } | null
}): SeasonModelData {
  return {
    season: sources.season,
    games: sources.games,
    teams: sources.teams,
    pregame: sources.winProbabilities?.probabilities.map(p => ({ gameId: p.gameId, homeWinProbability: p.homeWinProbability })) ?? [],
    spRatings: sources.teamRatings?.ratings.map(r => ({ teamId: r.teamId, spRating: r.spRating })) ?? [],
    cfpRankings: sources.cfpRankings ?? null,
    apRankings: sources.rankings ?? null,
    postseasonGames: sources.postseason?.games ?? []
  }
}

/** One scenario's user input, as stored per scenario. */
export interface ScenarioState {
  /** `{ gameId: winningTeamId }`. Final results always override these. */
  picks: Readonly<Record<number, number>>
  /** `{ conference: winningTeamId }` -- the week-14 championship cards. */
  championshipPicks: Readonly<Record<string, number>>
  manualDecisions: ConferenceDecisions
}

export const EMPTY_SCENARIO: ScenarioState = { picks: {}, championshipPicks: {}, manualDecisions: {} }

export interface SeasonModel {
  data: SeasonModelData
  format: PlayoffFormat
  wp: WinProbabilityInputs
  proxy: (teamId: number) => number
  contexts: readonly ConferenceContext[]
  contextByConference: ReadonlyMap<ConferenceId, ConferenceContext>
  teamById: ReadonlyMap<number, Team>
  teamIds: readonly number[]
  membersByConference: ReadonlyMap<string, readonly number[]>
  /** Real conference title games already on the schedule (CFBD lists them once the matchup is set), keyed by conference. */
  titleGames: ReadonlyMap<string, Game>
  /** Every scheduled game except those title games -- the games standings and tiebreakers read. */
  regularGames: readonly Game[]
  anchor: CommitteeAnchor
  anchorScores: ReadonlyMap<number, number>
  /** Regular games at or after the anchor ranking's week -- the ones the committee model applies. */
  postAnchorGames: readonly Game[]
}

/**
 * A conference title game, as CFBD lists it: championship weekend (week 14
 * or later), both teams from the same conference, and NOT flagged as a
 * conference game (CFBD flags only regular-season conference games).
 */
function findTitleGames(games: readonly Game[], teamById: ReadonlyMap<number, Team>): Map<string, Game> {
  const out = new Map<string, Game>()
  for (const g of games) {
    if (g.week < 14 || g.conferenceGame || g.seasonType !== 'regular') continue
    const home = teamById.get(g.homeId)
    const away = teamById.get(g.awayId)
    if (!home || !away || home.conference !== away.conference) continue
    if (home.conference === 'FBS Independents') continue
    out.set(home.conference, g)
  }
  return out
}

export function createSeasonModel(data: SeasonModelData): SeasonModel {
  const teamById = new Map(data.teams.map(t => [t.id, t]))
  const spRatings = new Map<number, number>()
  for (const r of data.spRatings) if (r.spRating !== null) spRatings.set(r.teamId, r.spRating)
  const wp: WinProbabilityInputs = {
    pregame: new Map(data.pregame.map(p => [p.gameId, p.homeWinProbability])),
    spRatings
  }

  const titleGames = findTitleGames(data.games, teamById)
  const titleGameIds = new Set([...titleGames.values()].map(g => g.id))
  const regularGames = data.games.filter(g => !titleGameIds.has(g.id))
  const contexts = buildConferenceContexts(regularGames, data.teams, titleGameIds)

  const membersByConference = new Map<string, number[]>()
  for (const t of data.teams) {
    const list = membersByConference.get(t.conference) ?? []
    list.push(t.id)
    membersByConference.set(t.conference, list)
  }

  const cfp = data.cfpRankings
  const ap = data.apRankings
  const anchor: CommitteeAnchor = cfp && cfp.week !== null && cfp.rankings.length > 0
    ? { source: 'cfp', week: cfp.week, rankings: cfp.rankings }
    : ap && ap.rankings.length > 0
      ? { source: 'ap', week: ap.week, rankings: ap.rankings }
      : { source: 'none', week: null, rankings: [] }

  const teamIds = data.teams.map(t => t.id)
  return {
    data,
    format: playoffFormatFor(data.season),
    wp,
    proxy: teamId => tiebreakProxy(wp, teamId),
    contexts,
    contextByConference: new Map(contexts.map(c => [c.conference, c])),
    teamById,
    teamIds,
    membersByConference,
    titleGames,
    regularGames,
    anchor,
    anchorScores: anchorScores(anchor, teamIds, spRatings),
    postAnchorGames: regularGames.filter(g => anchor.week === null || g.week >= anchor.week)
  }
}

function finalWinner(g: Game): number | undefined {
  if (!g.completed || g.homePoints == null || g.awayPoints == null || g.homePoints === g.awayPoints) return undefined
  return g.homePoints > g.awayPoints ? g.homeId : g.awayId
}

/**
 * Every game whose winner is already decided for this scenario: final
 * results first (they always override a pick, same rule as
 * `reconcilePicks`), then the user's picks for unplayed games.
 */
export function fixedWinners(model: SeasonModel, scenario: ScenarioState): Map<number, number> {
  const fixed = new Map<number, number>()
  for (const g of model.data.games) {
    const actual = finalWinner(g)
    if (actual !== undefined) {
      fixed.set(g.id, actual)
      continue
    }
    const pick = scenario.picks[g.id]
    if (pick === g.homeId || pick === g.awayId) fixed.set(g.id, pick)
  }
  return fixed
}

/** Picks a winner given the home side's probability. MC draws randomly; a projection takes the favorite. */
export type Chooser = (homeId: number, awayId: number, homeProbability: number) => number

export const favoriteChooser: Chooser = (homeId, awayId, p) => (p >= 0.5 ? homeId : awayId)

export function randomChooser(random: () => number): Chooser {
  return (homeId, awayId, p) => (random() < p ? homeId : awayId)
}

export interface SeasonDraw {
  winners: Map<number, number>
  titleGame: Map<ConferenceId, TitleGameResolution>
  /** Per conference, who counts as its champion (one team, or every member while unknown -- G6 only). */
  championCandidates: Map<string, number[]>
  /** Conference title game winners and losers, P4 and any scheduled G6 games. */
  titleGameResults: CommitteeGameResult[]
  committee: CommitteeRanking
  field: FieldEntry[]
}

/**
 * Plays out one complete season for `scenario`: fills every undecided
 * regular-season game with `choose`, resolves each Power Four standings
 * through the tiebreaker engine, plays the title games, ranks teams with
 * the committee model and seeds the playoff field.
 *
 * @param fixed `fixedWinners(model, scenario)`, passed in so a simulation
 *   computes it once instead of once per simulated season.
 */
export function drawSeason(
  model: SeasonModel,
  scenario: ScenarioState,
  choose: Chooser,
  fixed: ReadonlyMap<number, number>
): SeasonDraw {
  const winners = new Map(fixed)
  for (const g of model.regularGames) {
    if (winners.has(g.id)) continue
    winners.set(g.id, choose(g.homeId, g.awayId, homeWinProbability(model.wp, g)))
  }
  const winnerOf = (id: number) => winners.get(id)

  const titleGame = new Map<ConferenceId, TitleGameResolution>()
  const championCandidates = new Map<string, number[]>()
  const titleGameResults: CommitteeGameResult[] = []

  for (const ctx of model.contexts) {
    const resolution = resolveTitleGame(ctx, winnerOf, model.proxy, scenario.manualDecisions[ctx.conference], true)
    titleGame.set(ctx.conference, resolution)
    if (!resolution.participants) continue
    const [a, b] = resolution.participants
    const real = model.titleGames.get(ctx.conference)
    const realMatches = real && ((real.homeId === a && real.awayId === b) || (real.homeId === b && real.awayId === a))
    const pick = scenario.championshipPicks[ctx.conference]

    let winner: number
    if (real && realMatches) {
      const decided = fixed.get(real.id)
      winner = decided ?? (pick === a || pick === b ? pick : choose(real.homeId, real.awayId, homeWinProbability(model.wp, real)))
    } else {
      winner = pick === a || pick === b ? pick : choose(a, b, neutralWinProbability(model.wp, a, b))
    }
    championCandidates.set(ctx.conference, [winner])
    titleGameResults.push({ winnerId: winner, loserId: winner === a ? b : a, titleGame: true })
  }

  // Group of Six: no standings engine (out of scope), so a conference's
  // champion is its title game winner once CFBD has the game on the
  // schedule, and "every member" before that -- `selectPlayoffField` then
  // takes the highest-ranked one, i.e. "the highest-ranked G6 team".
  for (const conference of GROUP_OF_SIX) {
    const members = model.membersByConference.get(conference) ?? []
    const real = model.titleGames.get(conference)
    if (!real) {
      championCandidates.set(conference, [...members])
      continue
    }
    const winner = fixed.get(real.id) ?? choose(real.homeId, real.awayId, homeWinProbability(model.wp, real))
    championCandidates.set(conference, [winner])
    titleGameResults.push({ winnerId: winner, loserId: winner === real.homeId ? real.awayId : real.homeId, titleGame: true })
  }

  // A ranking published for poll week W reflects games through week W-1
  // (CFBD labels polls by the week they precede), so every result from
  // week W on is news to the committee.
  const results: CommitteeGameResult[] = []
  for (const g of model.postAnchorGames) {
    const w = winners.get(g.id)
    if (w === undefined) continue
    results.push({ winnerId: w, loserId: w === g.homeId ? g.awayId : g.homeId, titleGame: false })
  }
  for (const r of titleGameResults) results.push(r)

  const committee = committeeRanking(model.anchorScores, results, model.wp.spRatings)
  const field = selectPlayoffField(model.format, committee.order, championCandidates)

  return { winners, titleGame, championCandidates, titleGameResults, committee, field }
}

/**
 * The deterministic "most likely" season for a scenario: every undecided
 * game goes to the favorite. Drives the Projected bracket.
 */
export function projectSeason(model: SeasonModel, scenario: ScenarioState): SeasonDraw {
  return drawSeason(model, scenario, favoriteChooser, fixedWinners(model, scenario))
}

export interface CurrentBracketInputs {
  /** Ranking the field is selected from, best first. */
  order: number[]
  championCandidates: Map<string, number[]>
  source: 'cfp' | 'ap' | 'none'
  week: number | null
}

/**
 * "If the season ended today", the way the CFP itself presents it before
 * the title games: the latest committee ranking as-is (AP before the first
 * committee ranking), each Power Four conference's highest-ranked team as
 * its champion -- or its real champion once its title game is final --
 * and the highest-ranked Group of Six team (or real G6 champion). After
 * Selection Day this IS the official bracket: final ranking, real champions.
 */
export function currentBracketInputs(model: SeasonModel): CurrentBracketInputs {
  const ranked = model.anchor.rankings.slice().sort((a, b) => a.rank - b.rank).map(r => r.teamId)
  const rankedSet = new Set(ranked)
  const rest = model.teamIds
    .filter(id => !rankedSet.has(id))
    .sort((a, b) => (model.wp.spRatings.get(b) ?? -100) - (model.wp.spRatings.get(a) ?? -100) || a - b)
  const order = [...ranked, ...rest]
  const position = new Map(order.map((id, i) => [id, i]))

  const championCandidates = new Map<string, number[]>()
  for (const conference of [...POWER_FOUR, ...GROUP_OF_SIX]) {
    const members = model.membersByConference.get(conference) ?? []
    const real = model.titleGames.get(conference)
    const realWinner = real ? finalWinner(real) : undefined
    if (realWinner !== undefined) {
      championCandidates.set(conference, [realWinner])
    } else if ((POWER_FOUR as readonly string[]).includes(conference)) {
      const best = [...members].sort((a, b) => (position.get(a) ?? 1e9) - (position.get(b) ?? 1e9))[0]
      championCandidates.set(conference, best === undefined ? [] : [best])
    } else {
      championCandidates.set(conference, [...members])
    }
  }

  return { order, championCandidates, source: model.anchor.source, week: model.anchor.week }
}

export function currentBracketField(model: SeasonModel): FieldEntry[] {
  const inputs = currentBracketInputs(model)
  return selectPlayoffField(model.format, inputs.order, inputs.championCandidates)
}
