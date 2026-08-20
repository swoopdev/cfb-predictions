import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { scenarioKeys } from '~/utils/scenarioKeys'

/**
 * Validates an arbitrary parsed JSON value against the picks shape (`{ gameId:
 * winningTeamId }`, both integers). Returns `null` when the top-level shape
 * itself is invalid (not a plain object, e.g. an array or `null`); otherwise
 * returns a filtered record with malformed individual entries dropped one at
 * a time (WR-03) rather than rejecting the whole object on a shape check
 * alone.
 *
 * Exported so every reader of the picks-storage boundary -- this composable's
 * own `useStorage` serializer, and `week/[week].vue`'s `handleShare` (WR-01,
 * a second, non-reactive reader of the same untrusted-storage boundary for a
 * non-active scenario) -- runs byte-for-byte the same validation.
 */
export function validatePicksShape(parsed: unknown): Record<number, number> | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const result: Record<number, number> = {}
  for (const [gameId, teamId] of Object.entries(parsed)) {
    if (Number.isInteger(Number(gameId)) && Number.isInteger(teamId)) {
      result[Number(gameId)] = teamId as number
    }
  }
  return result
}

/**
 * Core pick state composable: manages picks as a flat object `{ gameId: winningTeamId }`
 * persisted to localStorage with season + scenario namespacing and corruption recovery.
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
 * **Scenario scoping (Phase 7, D-02, D-04).** `scenarioId` is required and
 * comes first — a defaulted `season` parameter after a required one would
 * defeat the default's usefulness (RESEARCH.md Pitfall 2). Every call MUST
 * construct a fresh composable instance per scenario id (never pass a
 * reactive/computed key into one long-lived `useStorage()` call for this
 * object-valued state) — RESEARCH.md Pitfall 1 is a verified, reproduced
 * defect where doing so leaks one scenario's picks into another.
 *
 * **Usage:**
 * ```typescript
 * const picks = usePicksStorage('scenario-a', 2026)
 * picks.value[123] = 456  // Add a pick: gameId 123 → teamId 456
 * delete picks.value[123]  // Clear a pick
 * // Changes automatically persist to localStorage['cfb_picks_2026_scenario-a']
 * ```
 *
 * @param scenarioId - Scenario id. Required, non-defaulted — namespaces the storage key.
 * @param season - Season year (default: 2026). Used to namespace the storage key.
 * @returns A reactive Ref<Record<number, number>> representing picks.
 */
export function usePicksStorage(scenarioId: string, season = 2026): Ref<Record<number, number>> {
  const key = scenarioKeys.picks(season, scenarioId)
  const corruptKey = `${key}_corrupt`

  const picks = useStorage<Record<number, number>>(
    key,
    {},
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            const validated = validatePicksShape(parsed)
            if (validated) return validated
            // Invalid shape (e.g., array or null)
            throw new Error('Invalid picks shape: expected plain object')
          } catch {
            // D-07: Preserve corrupted data under _corrupt key.
            // WR-01: check for `null` explicitly -- `getItem` also
            // legitimately returns `""` when the preserved first corruption
            // was itself an empty string, and `!alreadyStored` treated that
            // the same as "not yet stored," letting a later corruption
            // silently overwrite the first preserved backup.
            const alreadyStored = localStorage.getItem(corruptKey)
            if (alreadyStored === null) {
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

  return picks as Ref<Record<number, number>>
}
