import type { Game } from '../../types/schedule'

/**
 * Reconciles stored picks against final results: for every completed game
 * with a determinable winner, the stored pick is overwritten to match the
 * actual winner. This is the single point where "the user's pick" and "what
 * actually happened" are merged back into one value -- `toOutcomes` (and
 * therefore standings/tiebreakers) reads `picks` unchanged and needs no
 * awareness of `game.completed` at all.
 *
 * A tie (`homePoints === awayPoints`) has no winner to reconcile toward, so
 * the existing pick (right or wrong) is left as-is rather than guessed.
 * `homePoints`/`awayPoints` both `null` means CFBD hasn't published a score
 * yet even though `completed` is true (transient upstream state) -- also
 * left as-is.
 *
 * Returns the original `picks` object by reference when nothing changed, so
 * callers can cheaply skip a write (`result === picks`).
 */
export function reconcilePicks(
  games: readonly Game[],
  picks: Readonly<Record<number, number>>
): Record<number, number> {
  let next: Record<number, number> | undefined

  for (const game of games) {
    if (!game.completed) continue
    if (game.homePoints == null || game.awayPoints == null) continue
    if (game.homePoints === game.awayPoints) continue

    const winnerId = game.homePoints > game.awayPoints ? game.homeId : game.awayId
    if (picks[game.id] === winnerId) continue

    if (!next) next = { ...picks }
    next[game.id] = winnerId
  }

  return next ?? (picks as Record<number, number>)
}
