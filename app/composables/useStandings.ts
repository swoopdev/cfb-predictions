import { computed, watch } from 'vue'
import type { StandingsResult } from '#shared/types/standings'
import {
  computeStandings,
  resolveAllConferences,
  slateCompletionByConference,
  P4_CONFERENCES
} from '#shared/domain/standings'
import type { ResolvedTiebreakers, SlateCompletion } from '#shared/domain/standings'
import { applyManualOrdering } from '#shared/domain/tiebreakers/invalidation'
import { usePicksStorage } from './usePicksStorage'
import { useManualTiebreakers } from './useManualTiebreakers'
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
 * **D-13/STAND-02: plain `computed`, no watcher, no debounce** for every
 * DERIVED value. Vue invalidates `standings` the instant `picks` mutates, so
 * a pick and its standings consequence land in the same render. Phase 5
 * measured the full recompute at ~7ms for the 888-game slate (well under a
 * frame); Phase 6's N-seed resolution adds a further 0.45ms median — still
 * nowhere near a frame budget that would justify a debounce. The ONE
 * `watch` in this file (below) is not a derivation — it is `pruneStale`'s
 * storage write, a genuine side effect, and side effects do not belong
 * inside a `computed`.
 *
 * **WR-03: explicit-source `watch`, not `watchEffect`.** `pruneStale`
 * reads `decisions.value[conference]` and, on an actual prune, writes
 * `decisions.value = {...}` (`useManualTiebreakers.ts`). A bare
 * `watchEffect` tracks every `.value` read that happens DURING its own
 * synchronous run, lexical scope or not -- so `pruneStale`'s read of
 * `decisions` would register as a dependency of this very effect, and its
 * own write would then trigger a redundant second run of the whole thing
 * (re-deriving `raw`/`complete` and re-pruning all four conferences, which
 * happens to converge harmlessly, but is an easy-to-miss self-triggering
 * dependency). `watch([rawRankings, slateComplete], ...)` only tracks its
 * explicit source list -- reads inside the callback body (including
 * whatever `pruneStale` touches) establish no dependency at all, so the
 * effect runs exactly once per `rawRankings`/`slateComplete` change,
 * regardless of what it writes.
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
 * **Plan 06-07: the manual-decision lifecycle now lives here.**
 * `rankings` is `rawRankings` (the engine's direct output) with
 * `applyManualOrdering` applied per conference — the ONLY place in the app
 * that combines the two. Order is load-bearing (06-UI-SPEC.md §9.2): manual
 * application sits AFTER `resolveAllConferences` and BEFORE
 * `computeStandings`, because `computeStandings` assigns ranks by walking
 * groups, and the split manual groups have to exist by the time it runs.
 *
 * The two gates stay independent, exactly as §9.2 requires and never
 * collapsed into one check: gate 1 (`slateComplete[conference]`) is checked
 * once here, in `rankings`; gate 2 (the D-08 hash match plus set-equality)
 * lives entirely inside `applyManualOrdering`, which this composable never
 * duplicates.
 *
 * `pruneStale` (06-UI-SPEC.md §9.4's delete-on-read) runs from a
 * `watch` over `rawRankings` — NEVER the manually-adjusted
 * `rankings` — because a matched group is rewritten to `resolvedBy:
 * 'manual'` by `applyManualOrdering`, and `pruneStale`'s own comparison only
 * considers `resolvedBy === 'unresolved'` groups. Reading the adjusted
 * rankings back into it would find nothing left to compare against and
 * silently stop invalidating stale entries. Pruning for an incomplete
 * conference is a no-op — that early return (inside `pruneStale` itself)
 * is what makes suspension retention rather than deletion (06-UI-SPEC.md
 * §0.1/§9.1).
 *
 * @param season Season year (default: 2026)
 * @returns Object with:
 *   - picks: the `Ref<Record<gameId, teamId>>` from `usePicksStorage`
 *   - rankings: `Computed<ResolvedTiebreakers | undefined>`, manual
 *     decisions already applied
 *   - standings: `Computed<StandingsResult | undefined>`
 *   - slateComplete: `Computed<SlateCompletion | undefined>`, the D-07
 *     per-conference completion map
 *   - commitOrdering: `useManualTiebreakers`'s own `commitOrdering`,
 *     re-exported unchanged so components have one call and hold no
 *     storage knowledge of their own
 */
export function useStandings(season = 2026) {
  const picks = usePicksStorage(season)
  const { data: games } = useGames(season)
  const { data: teams } = useTeams(season)
  const { decisionsFor, commitOrdering, pruneStale } = useManualTiebreakers(season)

  const ready = computed(() => Boolean(games.value?.games && teams.value))

  const rawRankings = computed<ResolvedTiebreakers | undefined>(() => {
    if (!ready.value) return undefined
    return resolveAllConferences(games.value!.games, teams.value!, picks.value)
  })

  const slateComplete = computed<SlateCompletion | undefined>(() => {
    if (!ready.value) return undefined
    return slateCompletionByConference(games.value!.games, teams.value!, picks.value)
  })

  const rankings = computed<ResolvedTiebreakers | undefined>(() => {
    const raw = rawRankings.value
    if (!raw) return undefined

    const applied: ResolvedTiebreakers = {}
    for (const conference of P4_CONFERENCES) {
      const conferenceRaw = raw[conference]
      if (!conferenceRaw) continue
      const complete = slateComplete.value?.[conference] ?? false
      applied[conference] = applyManualOrdering(conferenceRaw, decisionsFor(conference).value, complete)
    }
    return applied
  })

  const standings = computed<StandingsResult | undefined>(() => {
    if (!ready.value) return undefined
    return computeStandings(games.value!.games, teams.value!, picks.value, rankings.value)
  })

  // The one side effect in this file — see the docblock above (WR-03) for
  // why this is an explicit-source `watch`, not a `watchEffect`, and why it
  // reads `rawRankings`, never `rankings`. Explicit sources are what keep
  // `pruneStale`'s own `decisions.value` read/write (inside the callback
  // body) from registering as a dependency of this same effect.
  watch(
    [rawRankings, slateComplete],
    ([raw, complete]) => {
      if (!raw || !complete) return

      for (const conference of P4_CONFERENCES) {
        const conferenceRaw = raw[conference]
        if (!conferenceRaw) continue
        pruneStale(conference, conferenceRaw, complete[conference] ?? false)
      }
    },
    { immediate: true }
  )

  return { picks, rankings, standings, slateComplete, commitOrdering }
}
