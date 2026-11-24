import type { Game, Team } from '../../types/schedule'
import type { ConferenceId, ConferenceRanking, TeamId } from '../tiebreakers/types'
import { resolveConferenceRanking } from '../tiebreakers/engine'
import { applyManualOrdering } from '../tiebreakers/invalidation'
import type { ManualDecisions } from '../tiebreakers/invalidation'
import { P4_CONFERENCES, conferenceGamesFor } from '../standings/computeStandings'

/**
 * Precomputed, per-conference inputs to the ONE tiebreaker engine
 * (`resolveConferenceRanking`), shaped for calling it thousands of times:
 * the simulator and the path enumerator resolve a conference once per
 * simulated season, so the per-call filtering `resolveAllConferences` does
 * (scanning all ~900 games four times) is hoisted out here and done once.
 *
 * This is NOT a second tiebreaker implementation -- it only narrows the
 * inputs. `resolveConferenceRanking` validates every outcome against the
 * conference's game list, so handing it outcomes for only the games it can
 * read keeps that validation from dominating a 5,000-season simulation.
 */
export interface ConferenceContext {
  conference: ConferenceId
  teamIds: ReadonlySet<TeamId>
  conferenceGames: readonly Game[]
  /**
   * Every game whose outcome the engine reads for this conference: its
   * conference games, plus -- for the Big 12 only, whose total-wins step
   * counts overall wins -- every other game a member plays. Conference
   * title games are excluded (they're decided after the standings).
   */
  outcomeGames: readonly Game[]
  knownFbsTeamIds: ReadonlySet<TeamId>
}

export function buildConferenceContexts(
  games: readonly Game[],
  teams: readonly Team[],
  excludedGameIds: ReadonlySet<number> = new Set()
): ConferenceContext[] {
  const knownFbsTeamIds = new Set<TeamId>(teams.map(t => t.id))
  const contexts: ConferenceContext[] = []

  for (const conference of P4_CONFERENCES) {
    const teamIds = new Set<TeamId>(teams.filter(t => t.conference === conference).map(t => t.id))
    if (teamIds.size === 0) continue
    const conferenceGames = conferenceGamesFor(games, teamIds)
    const outcomeGames = conference === 'Big 12'
      ? games.filter(g => !excludedGameIds.has(g.id) && (teamIds.has(g.homeId) || teamIds.has(g.awayId)))
      : conferenceGames
    contexts.push({ conference, teamIds, conferenceGames, outcomeGames, knownFbsTeamIds })
  }

  return contexts
}

export interface TitleGameResolution {
  /** The engine's ranking, with the user's manual tiebreaker decisions applied where they match. */
  ranking: ConferenceRanking
  /** Every member, best to worst. Teams in an unresolved group are ordered by the tie-break proxy. */
  order: TeamId[]
  /** The two championship-game participants, or `null` for a conference with fewer than two teams. */
  participants: [TeamId, TeamId] | null
  /**
   * True when an unresolved group straddles the 2nd/3rd boundary, i.e. who
   * plays in the title game came down to the ranking-based final step the
   * app can't compute and the proxy chose instead.
   */
  proxyDecided: boolean
  /** Teams in that straddling group (empty when `proxyDecided` is false). */
  boundaryGroup: readonly TeamId[]
}

function byProxy(proxy: (teamId: TeamId) => number) {
  return (a: TeamId, b: TeamId) => proxy(b) - proxy(a) || a - b
}

/**
 * Last-resort ordering if the engine throws (it is wrapped in the same
 * try/catch `resolveAllConferences` uses): conference win percentage, then
 * the proxy. Never expected to run on real data.
 */
function fallbackRanking(ctx: ConferenceContext, outcomes: ReadonlyMap<number, TeamId>, proxy: (teamId: TeamId) => number): ConferenceRanking {
  const wins = new Map<TeamId, number>()
  const played = new Map<TeamId, number>()
  for (const g of ctx.conferenceGames) {
    const winner = outcomes.get(g.id)
    if (winner === undefined) continue
    wins.set(winner, (wins.get(winner) ?? 0) + 1)
    played.set(g.homeId, (played.get(g.homeId) ?? 0) + 1)
    played.set(g.awayId, (played.get(g.awayId) ?? 0) + 1)
  }
  const pct = (t: TeamId) => (played.get(t) ? (wins.get(t) ?? 0) / played.get(t)! : 0)
  const ids = [...ctx.teamIds].sort((a, b) => pct(b) - pct(a) || byProxy(proxy)(a, b))
  return {
    conference: ctx.conference,
    groups: ids.map(id => ({ teams: [id], resolvedBy: 'tiebreaker' as const, contestedWith: [id], trace: [] }))
  }
}

export function resolveTitleGame(
  ctx: ConferenceContext,
  winnerOf: (gameId: number) => TeamId | undefined,
  proxy: (teamId: TeamId) => number,
  manual?: ManualDecisions,
  slateComplete = true
): TitleGameResolution {
  const outcomes = new Map<number, TeamId>()
  for (const g of ctx.outcomeGames) {
    const winner = winnerOf(g.id)
    if (winner === g.homeId || winner === g.awayId) outcomes.set(g.id, winner)
  }

  let ranking: ConferenceRanking
  try {
    ranking = resolveConferenceRanking(
      ctx.conference,
      ctx.conferenceGames,
      outcomes,
      ctx.teamIds,
      ctx.conference === 'Big 12' ? ctx.outcomeGames : undefined,
      ctx.knownFbsTeamIds
    )
  } catch {
    ranking = fallbackRanking(ctx, outcomes, proxy)
  }
  if (manual && slateComplete) ranking = applyManualOrdering(ranking, manual, true)

  const order: TeamId[] = []
  let proxyDecided = false
  let boundaryGroup: readonly TeamId[] = []
  for (const group of ranking.groups) {
    const start = order.length
    if (group.teams.length === 1) {
      order.push(group.teams[0]!)
      continue
    }
    if (start < 2 && start + group.teams.length > 2) {
      proxyDecided = true
      boundaryGroup = group.teams
    }
    order.push(...[...group.teams].sort(byProxy(proxy)))
  }

  const participants: [TeamId, TeamId] | null = order.length >= 2 ? [order[0]!, order[1]!] : null
  return { ranking, order, participants, proxyDecided, boundaryGroup }
}
