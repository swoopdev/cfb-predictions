import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'

/**
 * Conference championship pick state: `{ conferenceName: winningTeamId }`,
 * persisted to localStorage with season namespacing (this task).
 *
 * Deliberately its own storage key, not folded into `usePicksStorage`'s
 * `{ gameId: winningTeamId }` map: a conference championship has no real
 * CFBD game id (it's a matchup the app itself derives from `championshipFor`
 * once a conference's regular-season slate is fully picked), so it is keyed
 * by conference name instead of a game id. Mirrors `usePicksStorage`'s own
 * shape and corruption-recovery convention (D-07/D-08) for consistency, not
 * because this composable is imported anywhere near that one.
 *
 * @param season - Season year (default: 2026). Used to namespace the storage key.
 * @returns A reactive `Ref<Record<string, number>>` — conference name to winning team id.
 */
export function useChampionshipPicksStorage(season = 2026): Ref<Record<string, number>> {
  const key = `cfb_championship_picks_${season}`
  const corruptKey = `${key}_corrupt`

  const picks = useStorage<Record<string, number>>(
    key,
    {},
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed as Record<string, number>
            }
            throw new Error('Invalid championship picks shape: expected plain object')
          } catch {
            const alreadyStored = localStorage.getItem(corruptKey)
            if (!alreadyStored) {
              localStorage.setItem(corruptKey, v)
            }
            console.debug(
              `Championship picks data corrupted and recovered. Original preserved at '${corruptKey}'.`
            )
            return {}
          }
        },
        write(v: Record<string, number>) {
          return JSON.stringify(v)
        }
      }
    }
  )

  return picks as Ref<Record<string, number>>
}
