import type { PlayoffFormat } from './formats'

export interface FieldEntry {
  teamId: number
  seed: number
  /** 1-based position in the ranking the field was selected from. */
  rank: number
  /** Why the team got an automatic bid, or `null` for an at-large team. */
  autoBid: string | null
}

/**
 * Selects and seeds a playoff field from a ranking, per `format`.
 *
 * @param rankedOrder every candidate team, best first -- the committee's
 *   (or the model's, or the user's) full order. Teams absent from it rank
 *   below every team in it.
 * @param championCandidates per conference, the team(s) that count as its
 *   champion. Usually exactly one; a conference whose champion isn't known
 *   yet may list several, and the highest-ranked of them is used (this is
 *   how "the highest-ranked Group of Six team" is expressed before the G6
 *   title games are played).
 */
export function selectPlayoffField(
  format: PlayoffFormat,
  rankedOrder: readonly number[],
  championCandidates: ReadonlyMap<string, readonly number[]>
): FieldEntry[] {
  const rankOf = new Map<number, number>()
  rankedOrder.forEach((teamId, i) => {
    if (!rankOf.has(teamId)) rankOf.set(teamId, i + 1)
  })
  const rank = (teamId: number) => rankOf.get(teamId) ?? Number.POSITIVE_INFINITY
  const best = (ids: readonly number[]) => [...ids].sort((a, b) => rank(a) - rank(b) || a - b)[0]

  const auto = new Map<number, string>()
  for (const rule of format.autoBids) {
    if (rule.kind === 'conference-champions') {
      for (const conference of rule.conferences) {
        const champion = best(championCandidates.get(conference) ?? [])
        if (champion !== undefined && !auto.has(champion)) auto.set(champion, `${conference} champion`)
      }
    } else if (rule.kind === 'best-champions') {
      const pool = rule.conferences
        .map(conference => ({ conference, champion: best(championCandidates.get(conference) ?? []) }))
        .filter((c): c is { conference: string, champion: number } => c.champion !== undefined && !auto.has(c.champion))
        .sort((a, b) => rank(a.champion) - rank(b.champion) || a.champion - b.champion)
      for (const { conference, champion } of pool.slice(0, rule.count)) {
        auto.set(champion, `${rule.label} (${conference})`)
      }
    } else if (rank(rule.teamId) <= rule.maxRank && !auto.has(rule.teamId)) {
      auto.set(rule.teamId, rule.label)
    }
  }

  const field = [...auto.keys()].slice(0, format.fieldSize)
  for (const teamId of rankedOrder) {
    if (field.length >= format.fieldSize) break
    if (!field.includes(teamId)) field.push(teamId)
  }

  return field
    .sort((a, b) => rank(a) - rank(b) || a - b)
    .map((teamId, i) => ({ teamId, seed: i + 1, rank: rank(teamId), autoBid: auto.get(teamId) ?? null }))
}
