import type { Game, Team } from '#shared/types/schedule'

export interface ConferenceGroup {
  conference: string
  games: Game[]
}

/**
 * Groups `games` under their HOME team's conference (D-07) — never the away
 * team's, since 127 of 888 games have an unresolvable FCS away opponent
 * while `homeId` always resolves (RESEARCH.md Pitfall 5). Returned groups
 * are sorted alphabetically by conference name.
 */
export function groupByConference(games: Game[], teamsById: Map<number, Team>): ConferenceGroup[] {
  const byConference = new Map<string, Game[]>()

  for (const game of games) {
    const conference = teamsById.get(game.homeId)?.conference ?? 'Unknown'
    const existing = byConference.get(conference)
    if (existing) {
      existing.push(game)
    } else {
      byConference.set(conference, [game])
    }
  }

  return [...byConference.entries()]
    .map(([conference, groupGames]) => ({ conference, games: groupGames }))
    .sort((a, b) => a.conference.localeCompare(b.conference))
}

/**
 * Narrows `games` by conference or team (D-03). When `filter.team` is set,
 * that branch wins even if `filter.conf` is also set — a defensive
 * fallback, since D-03's URL logic (`buildConfQuery`/`buildTeamQuery`)
 * should never produce both being set simultaneously. Matches either side
 * of the game (home OR away) for both `team` and `conf`, since a team's
 * games — and a conference's games via cross-conference/G5 opponents —
 * aren't confined to one side.
 */
export function filterGames(
  games: Game[],
  filter: { conf?: string, team?: number },
  teamsById: Map<number, Team>
): Game[] {
  if (filter.team !== undefined) {
    return games.filter(g => g.homeId === filter.team || g.awayId === filter.team)
  }
  if (filter.conf !== undefined) {
    return games.filter(g =>
      teamsById.get(g.homeId)?.conference === filter.conf
      || teamsById.get(g.awayId)?.conference === filter.conf
    )
  }
  return games
}

/**
 * Security Domain V5 mitigation (T-02-06): the `?conf=` URL query param is
 * fully user/attacker-controllable. Returns `raw` only if it's an exact
 * member of `knownConferences`, else `undefined` — an invalid value falls
 * back to unfiltered ("All") instead of crashing or rendering a broken
 * partial state.
 */
export function sanitizeConfParam(raw: string | undefined, knownConferences: string[]): string | undefined {
  if (raw === undefined) return undefined
  return knownConferences.includes(raw) ? raw : undefined
}

/**
 * Security Domain V5 mitigation (T-02-06/T-02-07): the `?team=` URL query
 * param is fully user/attacker-controllable. `Number.isSafeInteger` guards
 * against non-numeric/absurdly large strings before any `teamsById.has()`
 * lookup, so a malformed value never reaches an unguarded numeric
 * comparison. Returns `undefined` unless `raw` parses to a safe integer
 * that is also a known team id.
 */
export function sanitizeTeamParam(raw: string | undefined, teamsById: Map<number, Team>): number | undefined {
  if (!raw) return undefined
  const id = Number(raw)
  if (!Number.isSafeInteger(id)) return undefined
  return teamsById.has(id) ? id : undefined
}

/**
 * D-03 mutual exclusivity + Pitfall 6 (Vue Router's `router.push({ query })`
 * replaces rather than merges the query object). Returns the next full
 * query object: `conf` set, `team` always nulled out, every other current
 * key re-spread so it survives the replace.
 */
export function buildConfQuery(currentQuery: Record<string, unknown>, conf: string | undefined): Record<string, unknown> {
  return { ...currentQuery, conf, team: undefined }
}

/**
 * D-03 mutual exclusivity + Pitfall 6. Returns the next full query object:
 * `team` set, `conf` always nulled out, every other current key re-spread
 * so it survives Vue Router's query-replace behavior.
 */
export function buildTeamQuery(currentQuery: Record<string, unknown>, team: number | undefined): Record<string, unknown> {
  return { ...currentQuery, team, conf: undefined }
}

export interface LoadStateInput {
  isPending: boolean
  isError: boolean
}

/**
 * Derives the page's loading/error/ready state from one or more
 * `useQuery` results. `error` takes precedence over `pending` — an errored
 * query outranks a still-resolving one, since a broken deploy is worse than
 * a slow one and must not be masked by a permanent-looking skeleton.
 */
export function determineLoadState(states: LoadStateInput[]): 'loading' | 'error' | 'ready' {
  if (states.some(s => s.isError)) return 'error'
  if (states.some(s => s.isPending)) return 'loading'
  return 'ready'
}
