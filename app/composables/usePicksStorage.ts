import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'

/**
 * Core pick state composable: manages picks as a flat object `{ gameId: winningTeamId }`
 * persisted to localStorage with season namespacing and corruption recovery.
 *
 * **Persistence:** Picks are automatically synced to localStorage and persist across
 * browser sessions and tab reloads. Cross-tab changes are detected via VueUse's built-in
 * `listenToStorageChanges` (enabled by default).
 *
 * **Corruption Recovery (D-07, D-08):** If stored JSON is invalid or the shape is not a
 * plain object, the composable silently:
 * 1. Preserves the corrupted data under a `_corrupt` suffix key for manual recovery
 * 2. Resets picks to an empty object `{}`
 * 3. Continues without error banners or warnings (per D-08)
 *
 * **Usage:**
 * ```typescript
 * const picks = usePicksStorage(2026)
 * picks.value[123] = 456  // Add a pick: gameId 123 → teamId 456
 * delete picks.value[123]  // Clear a pick
 * // Changes automatically persist to localStorage['cfb_picks_2026']
 * ```
 *
 * @param season - Season year (default: 2026). Used to namespace the storage key.
 * @returns A reactive Ref<Record<number, number>> representing picks.
 */
export function usePicksStorage(season = 2026): Ref<Record<number, number>> {
  const key = `cfb_picks_${season}`
  const corruptKey = `${key}_corrupt`

  return useStorage<Record<number, number>>(
    key,
    {},
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            // Validate shape: must be a plain object, not array, not null
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed as Record<number, number>
            }
            // Invalid shape (e.g., array or null)
            throw new Error('Invalid picks shape: expected plain object')
          } catch (err) {
            // D-07: Preserve corrupted data under _corrupt key
            const alreadyStored = localStorage.getItem(corruptKey)
            if (!alreadyStored) {
              localStorage.setItem(corruptKey, v)
            }
            // D-08: Log to console for debugging, but no user-facing banner
            console.debug(
              `Picks data corrupted and recovered. Original preserved at '${corruptKey}'.`
            )
            // Return empty object; app continues gracefully
            return {}
          }
        },
        write(v: Record<number, number>) {
          return JSON.stringify(v)
        }
      }
    }
  )
}
