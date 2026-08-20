import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { decodeShareLink } from '#shared/domain/shareLink'
import type { ConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import type { GamesEnvelope } from '~/utils/fetchSchedule'

/**
 * Decodes a share-link URL fragment into a temporary, non-persisted preview
 * (SHARE-02/03/04, D-05/D-07/D-08/D-11). Consumes `games`/`hash` purely as
 * passed-in `Ref` parameters -- no `useRoute`/`useRouter`, no `useStorage`,
 * so this composable is directly testable under plain vitest and structurally
 * incapable of a `localStorage` write (T-08-08).
 *
 * **Gated on both the share code AND the resolved schedule (Pitfall 4).**
 * `hash` is available synchronously from the first render, but `games` (fed
 * by `useGames()`'s TanStack Query) resolves asynchronously even with
 * `staleTime: Infinity`. An explicit-source `watch([shareCode, games], ...,
 * { immediate: true })` -- never `watchEffect` -- re-runs whenever either
 * input changes, so a cold hard-refresh (schedule not yet cached) still shows
 * the banner once `games` resolves, matching `useStandings.ts`'s own
 * documented reasoning for why explicit sources matter here: this effect's
 * own read/write of `consumed.value` inside the callback body must never
 * register as a dependency of this same effect.
 *
 * **Decodes at most once per link.** `consumed` is set the instant a decode
 * runs (success or malformed) and again by `dismiss()`, so a later `games`
 * reassignment (a query refetch) never re-triggers a decode -- once a link
 * has been shown or dismissed, it stays that way for the rest of the page's
 * lifetime.
 */
export type SharedPreviewVariant = 'none' | 'default' | 'mismatch' | 'malformed'

export interface SharedPreviewState {
  picks: Record<number, number>
  manualDecisions: ConferenceDecisions
}

export function useSharedPreview(games: Ref<GamesEnvelope | undefined>, hash: Ref<string>) {
  const preview = ref<SharedPreviewState | null>(null)
  const bannerVariant = ref<SharedPreviewVariant>('none')
  const counts = ref<{ applied: number, total: number } | null>(null)
  const consumed = ref(false)

  const shareCode = computed(() => {
    const h = hash.value
    return h.startsWith('#s=') ? h.slice(3) : null
  })

  watch(
    [shareCode, games],
    ([code, gamesValue]) => {
      if (consumed.value) return
      if (!code || !gamesValue) return

      const result = decodeShareLink(code, gamesValue.games, gamesValue.scheduleHash)
      consumed.value = true

      if (result.status === 'malformed') {
        bannerVariant.value = 'malformed'
        preview.value = null
        counts.value = null
        return
      }

      preview.value = { picks: result.picks, manualDecisions: result.manualDecisions }
      counts.value = { applied: result.appliedCount, total: result.totalCount }
      bannerVariant.value = result.hashMatched ? 'default' : 'mismatch'
    },
    { immediate: true }
  )

  function dismiss() {
    bannerVariant.value = 'none'
    preview.value = null
    counts.value = null
    consumed.value = true
  }

  return { preview, bannerVariant, counts, dismiss }
}
