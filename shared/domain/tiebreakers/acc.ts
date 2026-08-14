import type { BaseOrdering, TeamId } from './types'
import type { ConferenceRecord } from './records'

/**
 * ACC-specific tied-team definition per Pitfall 3.
 *
 * The ACC's July 2026 tiebreaker policy defines the "Top Two Teams" as:
 *
 * > "the two teams with the highest percentage of conference wins, and/or
 * > team(s) which played an alternate number of conference games and have
 * > either the same number of conference wins or the same number of conference
 * > losses as those teams. Defining Tied Teams: (a) Identify the team(s) with
 * > the best conference win percentage; plus (b) Any team(s) which played an
 * > alternate number of conference games and have either the same number of
 * > conference wins or the same number of conference losses as the team(s)
 * > in (a). (c) No other teams may be defined as Tied Teams."
 *
 * This is fundamentally different from the other three conferences' win-pct-only
 * tie definition. A team at 7-1 (.875, 8 games) and a team at 7-2 (.778, 9
 * games) are **tied** because they have the same number of wins (7), even though
 * their win percentages differ.
 *
 * This matters concretely in 2026: Boston College, Clemson, Florida State,
 * Georgia Tech, and North Carolina play 8 conference games; the other 12 ACC
 * teams play 9. Mixed 8/9 schedules are guaranteed this season.
 *
 * **Implementation note:** This function must scan **all** ACC records, not just
 * the base-ordering neighborhood of a target position. A lower-placed team with
 * a matching win/loss count on a different schedule length can be pulled into
 * the tie from well below the raw win-pct cutoff. This is exactly what makes
 * the PITFALLS.md example work: "a 7-1 team and a 7-2 team are tied."
 *
 * **Restart re-invocation:** This function is re-invoked (not reused) at every
 * restart with a growing `alreadyCommitted` set. The ACC's own language—
 * "the tiebreaker will restart, including the definition of tied teams"—is
 * enforced structurally by the recursive engine's call to defineTiedTeams on
 * every restart. This is what makes the unified recursive core work correctly
 * for all four conferences.
 */
export function defineAccTiedTeams(
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>,
  alreadyCommitted: ReadonlySet<TeamId>
): readonly TeamId[] {
  // Step 1(a): Find the team(s) with the best conference win percentage,
  // filtered to exclude teams already committed in earlier cycles.
  let bestWinPct = -1
  const bestPctGroup: ConferenceRecord[] = []

  for (const record of records.values()) {
    if (alreadyCommitted.has(record.teamId)) continue // Skip already-committed teams

    if (record.winPct > bestWinPct) {
      // New best found; reset the group
      bestWinPct = record.winPct
      bestPctGroup.length = 0
      bestPctGroup.push(record)
    } else if (record.winPct === bestWinPct) {
      // Tie for best; add to the group
      bestPctGroup.push(record)
    }
  }

  if (bestPctGroup.length === 0) {
    // No eligible teams remain
    return []
  }

  // Collect wins and losses from the best-pct group
  const bestWins = new Set<number>()
  const bestLosses = new Set<number>()
  for (const record of bestPctGroup) {
    bestWins.add(record.wins)
    bestLosses.add(record.losses)
  }

  // Step 1(b): Pull in any other team (not in bestPctGroup) that:
  // - played an alternate number of conference games (gamesPlayed differs), AND
  // - has either the same number of wins OR the same number of losses as any
  //   member of the best-pct group
  const extra: ConferenceRecord[] = []
  const bestGamesPlayed = bestPctGroup[0]!.gamesPlayed

  for (const record of records.values()) {
    if (alreadyCommitted.has(record.teamId)) continue // Skip already-committed
    if (bestPctGroup.some(r => r.teamId === record.teamId)) continue // Skip bestPctGroup members

    // Must have played a different number of conference games
    if (record.gamesPlayed === bestGamesPlayed) continue

    // Must have wins OR losses matching the best group
    if (bestWins.has(record.wins) || bestLosses.has(record.losses)) {
      extra.push(record)
    }
  }

  // Return the combined group: best-pct teams + extra teams matching the criteria
  // Both are already TeamIds, so extract and return
  const result = [...bestPctGroup.map(r => r.teamId), ...extra.map(r => r.teamId)]
  return result
}
