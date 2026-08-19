import { computed } from 'vue'
import type { StandingsResult } from '#shared/types/standings'
import { computeStandings, resolveAllConferences } from '#shared/domain/standings'
import type { ResolvedTiebreakers } from '#shared/domain/standings'
import { usePicksStorage } from './usePicksStorage'
import { useGames } from './useGames'
import { useTeams } from './useTeams'

/**
 * The single seam standings/tiebreakers pass through on their way to the UI
 * (IN-02, deferred from Phase 5). Collapses what used to be two divergent
 * computeds in `app/pages/week/[week].vue` — each re-checking
 * `games.value?.games`/`teams.value` and disagreeing on the not-ready
 * sentinel (`undefined` for one, `{}` for the other) — into one `ready`
 * guard and one sentinel (`undefined`), which is what makes WR-06's
 * tightened `StandingsResult` (`Readonly<Record<ConferenceId, readonly
 * StandingsTeam[]>>`, no index signature) legal at every call site.
 *
 * Follows `usePickProgress.ts`'s shape: explicit `computed` import, a
 * `season = 2026` default, and consumption of `useGames`/`useTeams` rather
 * than `$fetch` directly (PROJECT.md's "sole read path" constraint on those
 * two composables).
 *
 * **D-13/STAND-02: plain `computed`, no watcher, no debounce.** Vue
 * invalidates `standings` the instant `picks` mutates, so a pick and its
 * standings consequence land in the same render. Phase 5 measured the full
 * recompute at ~7ms for the 888-game slate (well under a frame); Phase 6's
 * N-seed resolution adds a further 0.45ms median — still nowhere near a
 * frame budget that would justify a debounce.
 *
 * **IN-02's "toOutcomes derived twice" note.** `resolveAllConferences` and
 * `computeStandings` each call `toOutcomes` internally today. This
 * composable deliberately does NOT add a third call site, and does NOT
 * thread outcomes through as a new parameter to either function: doing so
 * would widen the domain API's signature for every existing and future
 * caller to save a duplicate pass that costs nothing measurable (both calls
 * together are still inside the ~7ms/0.45ms figures above). The duplication
 * stays exactly where Phase 5 left it.
 *
 * @param season Season year (default: 2026)
 * @returns Object with:
 *   - picks: the `Ref<Record<gameId, teamId>>` from `usePicksStorage`
 *   - rankings: `Computed<ResolvedTiebreakers | undefined>`
 *   - standings: `Computed<StandingsResult | undefined>`
 */
export function useStandings(season = 2026) {
  const picks = usePicksStorage(season)
  const { data: games } = useGames(season)
  const { data: teams } = useTeams(season)

  const ready = computed(() => Boolean(games.value?.games && teams.value))

  const rankings = computed<ResolvedTiebreakers | undefined>(() => {
    if (!ready.value) return undefined
    return resolveAllConferences(games.value!.games, teams.value!, picks.value)
  })

  const standings = computed<StandingsResult | undefined>(() => {
    if (!ready.value) return undefined
    return computeStandings(games.value!.games, teams.value!, picks.value, rankings.value)
  })

  return { picks, rankings, standings }
}
