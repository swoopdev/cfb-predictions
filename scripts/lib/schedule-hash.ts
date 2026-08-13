import { createHash } from 'node:crypto'

/**
 * Fingerprints a season's game-id list for share-link/bitpack drift detection (D-11/D-12).
 *
 * Sorts the ids numerically (never the default lexicographic sort — see
 * RESEARCH.md Pitfall 3), joins them with a comma, and returns the first 8
 * hex characters (u32) of the SHA-256 digest of that string.
 *
 * This numeric sort order is also the exact ordering Phase 8's share-link
 * bitpack index relies on — do not change it without updating both.
 */
export function computeScheduleHash(gameIds: number[]): string {
  const sorted = [...gameIds].sort((a, b) => a - b)
  const input = sorted.join(',')
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}
