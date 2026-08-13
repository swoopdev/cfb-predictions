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
