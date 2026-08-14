import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * Provenance tracking composable: maintains which game picks were auto-filled vs. user-made.
 * Picks store IDs in a separate array (not in the picks object itself) to keep the picks
 * object flat and compact for Phase 8's share-link encoding.
 *
 * **Storage:** Auto-filled game IDs are stored as an array under `cfb_autofilled_${season}`.
 * JSON serialization/deserialization is handled by the custom serializer.
 *
 * **API:**
 * - `autoFilled: Ref<number[]>` — The underlying array of auto-filled game IDs
 * - `autoFilledSet: Computed<Set<number>>` — Efficient Set view for O(1) lookups
 * - `markAutoFilled(gameIds: number[])` — Add game IDs to the auto-filled set (idempotent)
 * - `isAutoFilled(gameId: number): boolean` — Check if a game was auto-filled
 *
 * **Usage:**
 * ```typescript
 * const { autoFilled, autoFilledSet, markAutoFilled, isAutoFilled } = useAutoFilledGames()
 * markAutoFilled([123, 456])  // Mark games 123, 456 as auto-filled
 * isAutoFilled(123)           // true
 * isAutoFilled(789)           // false
 * ```
 *
 * **Why separate storage?**
 * Picks object is flat `{ gameId: teamId }` for compactness (Phase 8 share links).
 * Provenance tracking would widen picks to `{ gameId: { winner: teamId, autoFilled: bool } }`,
 * increasing JSON size. A separate key keeps both concerns decoupled and the picks object
 * minimal, supporting future scenarios (Phase 7) where multiple pick sets may coexist.
 *
 * @param season - Season year (default: 2026). Used to namespace the storage key.
 * @returns Object with { autoFilled, autoFilledSet, markAutoFilled, isAutoFilled }
 */
export function useAutoFilledGames(season = 2026) {
  const key = `cfb_autofilled_${season}`

  const autoFilled = useStorage<number[]>(
    key,
    [],
    localStorage,
    {
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            // Validate shape: must be an array
            if (Array.isArray(parsed)) {
              return parsed as number[]
            }
            // Invalid shape (e.g., object or string)
            throw new Error('Invalid autoFilled shape: expected array')
          } catch (_err) {
            // Corruption is less critical for provenance (just bookkeeping).
            // Silently reset to empty array and continue.
            return []
          }
        },
        write(v: number[]) {
          return JSON.stringify(v)
        }
      }
    }
  )

  /**
   * Computed Set view of autoFilled array for efficient O(1) lookups.
   * Converts the underlying array to a Set on every computed evaluation.
   * Trade-off: minimal perf cost (array is <1000 elements) vs. clean API.
   */
  const autoFilledSet = computed(() => new Set(autoFilled.value))

  /**
   * Mark game IDs as auto-filled. Idempotent: calling with duplicate IDs is safe.
   * @param gameIds - Array of game IDs to mark as auto-filled
   */
  function markAutoFilled(gameIds: number[]) {
    const current = new Set(autoFilled.value)
    gameIds.forEach((id) => current.add(id))
    autoFilled.value = Array.from(current)
  }

  /**
   * Check if a game ID was auto-filled.
   * @param gameId - Game ID to check
   * @returns true if this game was auto-filled, false otherwise
   */
  function isAutoFilled(gameId: number): boolean {
    return autoFilledSet.value.has(gameId)
  }

  return { autoFilled, autoFilledSet, markAutoFilled, isAutoFilled }
}
