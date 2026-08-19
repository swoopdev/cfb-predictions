import type { BaseOrdering, TeamId } from './types'
import type { ConferenceRecord } from './records'

/**
 * Groups a conference's teams into best-to-worst buckets by raw win
 * percentage; teams with exactly equal `winPct` land in the same bucket,
 * and teamIds within a bucket are sorted ascending by id for determinism.
 *
 * Must be computed exactly once per `resolveConferenceRanking` call
 * and passed as a plain, frozen value into every step evaluator --
 * PITFALLS.md Pitfall 4's circularity trap ("resolving a tie for 1st
 * requires resolving the tie for 4th") is caused directly by recomputing
 * standings order mid-procedure. This function's output must never be
 * recomputed mid-procedure; callers hold onto the single value returned
 * here for the lifetime of one resolution call.
 */
export function computeBaseOrdering(records: ReadonlyMap<TeamId, ConferenceRecord>): BaseOrdering {
  const byWinPct = new Map<number, TeamId[]>()

  for (const record of records.values()) {
    const bucket = byWinPct.get(record.winPct)
    if (bucket) {
      bucket.push(record.teamId)
    } else {
      byWinPct.set(record.winPct, [record.teamId])
    }
  }

  return [...byWinPct.entries()]
    .sort(([winPctA], [winPctB]) => winPctB - winPctA)
    .map(([, teamIds]) => [...teamIds].sort((a, b) => a - b))
}
