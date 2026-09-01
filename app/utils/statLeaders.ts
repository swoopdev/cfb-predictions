import type { PlayerStatEntry } from '#shared/types/playerStats'

export interface StatLeader {
  playerId: string
  player: string
  jersey: number | null
  position: string
  value: number
}

export interface TeamStatLeaders {
  passing: StatLeader[]
  rushing: StatLeader[]
  receiving: StatLeader[]
}

/**
 * `stat` is `string | number` on the wire (CFBD does not guarantee numeric
 * typing) -- coerced for sorting, with an unparseable value ranked last
 * rather than thrown away, so a single odd row can't hide the rest of a
 * team's leaders.
 */
function toNumber(stat: number | string): number {
  return typeof stat === 'number' ? stat : (Number(stat) || 0)
}

/**
 * Which category/statType combinations count as a team's "leaders" is a
 * display decision, deliberately made HERE rather than in the fetch script
 * (`scripts/lib/schemas.ts`'s `transformPlayerStats` is a verbatim
 * passthrough) -- this list can grow without touching committed JSON or
 * re-running a fetch.
 */
export function computeTeamStatLeaders(
  playerStats: readonly PlayerStatEntry[],
  teamId: number,
  topN = 3
): TeamStatLeaders {
  function leadersFor(category: string, statType: string): StatLeader[] {
    return playerStats
      .filter(p => p.teamId === teamId && p.category === category && p.statType === statType)
      .map(p => ({ playerId: p.playerId, player: p.player, jersey: p.jersey, position: p.position, value: toNumber(p.stat) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topN)
  }

  return {
    passing: leadersFor('passing', 'YDS'),
    rushing: leadersFor('rushing', 'YDS'),
    receiving: leadersFor('receiving', 'YDS')
  }
}
