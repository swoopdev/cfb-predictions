import { useStorage } from '@vueuse/core'
import type { ScenarioMeta } from '#shared/types/scenarios'
import { scenarioKeys } from '~/utils/scenarioKeys'

/**
 * WR-01: ceiling on a scenario name's length, mirroring
 * `useManualTiebreakers.ts`'s `MAX_ENTRIES_PER_CONFERENCE`/`MAX_IDS_PER_ENTRY`
 * pattern -- a defense against a hand-edited or pasted-in registry entry
 * whose `name` would otherwise overflow the switcher's row layout. No
 * legitimate name (typed through `commitRename`'s own cap, see
 * `ScenarioSwitcher.vue`) can ever hit this.
 */
const MAX_SCENARIO_NAME_LENGTH = 60

/**
 * Registry entry shape guard: `id`/`createdAt` must be non-empty strings,
 * and `name` must be a non-empty, non-whitespace-only string no longer than
 * `MAX_SCENARIO_NAME_LENGTH` (D-01, WR-01, RESEARCH.md Security Domain V5).
 * Mirrors `useManualTiebreakers.ts`'s `isValidOrderedIds` type-guard shape.
 */
function isValidScenarioMeta(value: unknown): value is ScenarioMeta {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' && candidate.id.length > 0
    && typeof candidate.name === 'string' && candidate.name.trim().length > 0
    && candidate.name.length <= MAX_SCENARIO_NAME_LENGTH
    && typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0
  )
}

/**
 * Validates an untrusted parsed JSON payload for `cfb_scenarios_{season}`
 * (D-17, RESEARCH.md Security Domain V5, PATTERNS.md Analog B).
 *
 * Top-level shape failure (not an array at all) resets to an empty array --
 * the caller (the unconditional recovery pass) then creates a fresh default
 * scenario, mirroring `useManualTiebreakers.ts`'s `validateConferenceDecisions`
 * per-entry-drop discipline. A single malformed entry (wrong types, missing
 * fields) is dropped alone; its structurally-valid siblings survive. Entries
 * sharing an `id` are de-duplicated, keeping only the first occurrence --
 * defense-in-depth against a hand-edited registry with a repeated id
 * (RESEARCH.md Known Threat Patterns, T-07-03).
 */
function validateRegistry(parsed: unknown): ScenarioMeta[] {
  if (!Array.isArray(parsed)) return []

  const seenIds = new Set<string>()
  const result: ScenarioMeta[] = []

  for (const entry of parsed) {
    if (!isValidScenarioMeta(entry)) continue
    if (seenIds.has(entry.id)) continue
    seenIds.add(entry.id)
    result.push(entry)
  }

  return result
}

/**
 * Scenario registry, active-scenario pointer, one-time legacy-data
 * migration, and CRUD actions (Phase 7). The single piece of new state this
 * phase introduces -- every decision in 07-CONTEXT.md's "Scenario Data
 * Model & Storage Architecture," "Scenario Management Actions," and "Edge
 * Cases & Limits" sections (D-01 through D-17) lands here.
 *
 * **Storage shape.** `cfb_scenarios_{season}` holds a JSON array of
 * `ScenarioMeta` (`{ id, name, createdAt }`, D-01). `cfb_active_scenario_
 * {season}` holds the currently-selected scenario's `id` as a plain JSON
 * string -- VueUse's default serializer is sufficient here (RESEARCH.md's
 * Anti-Patterns note: a fresh string primitive is created on every read
 * regardless of default reuse, so Pitfall 1's shared-object-reference risk
 * does not apply to primitive storage).
 *
 * **Corruption disposition (D-17).** Unlike `usePicksStorage`'s `_corrupt`-
 * preserving disposition, the registry resets SILENTLY on unrecoverable
 * top-level corruption -- scenario metadata is reconstructible, unlike
 * picks. No secondary corruption key is ever written, and no
 * `console.warn`/`console.error` is ever called (mirrors
 * `useManualTiebreakers.ts`'s disposition, not `usePicksStorage.ts`'s).
 *
 * **Synchronous self-healing (RESEARCH.md Pitfall 5).** Before this
 * function returns, an unconditional recovery pass guarantees the registry
 * is non-empty and `activeScenarioId` points at a real entry. This is
 * deliberately NOT a `watch`/`onMounted` deferred effect -- VueUse's
 * `useStorage` already runs its own `read()` synchronously at call time (no
 * `initOnMounted` guard needed, `ssr: false`), so the migration/recovery
 * layer sitting above it must match that synchronicity or risk a one-frame
 * flash of an empty/wrong-pointer state.
 *
 * **`hadNoRegistryBefore` must be read BEFORE constructing any
 * `useStorage()` call.** VueUse's `useStorage` defaults to
 * `writeDefaults: true`, meaning the very first `useStorage()` call
 * synchronously persists its default value to localStorage -- checking for
 * a null registry key AFTER construction would always read false
 * (RESEARCH.md Pitfall 5's writeDefaults corollary).
 *
 * @param season Season year (default: 2026). Namespaces every storage key
 *   this composable touches, via `scenarioKeys` (RESEARCH.md Pitfall 3 --
 *   never a hand-typed key literal).
 */
export function useScenarios(season = 2026) {
  const hadNoRegistryBefore = localStorage.getItem(scenarioKeys.registry(season)) === null

  const registry = useStorage<ScenarioMeta[]>(
    scenarioKeys.registry(season),
    [],
    localStorage,
    {
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            return validateRegistry(parsed)
          } catch {
            return []
          }
        },
        write(v: ScenarioMeta[]) {
          return JSON.stringify(v)
        }
      }
    }
  )

  const activeScenarioId = useStorage<string>(scenarioKeys.active(season), '', localStorage)

  /**
   * WR-01 (round 3): derives the default "Scenario N" name from the highest
   * N already used by an entry matching that exact pattern, not from
   * `registry.value.length + 1`. Length-derived numbering collides after a
   * delete-then-create cycle: deleting shrinks the registry, so a later
   * `createScenario()` can reuse a number a surviving entry already has --
   * e.g. delete "Scenario 1" leaving only "Scenario 2", then create ->
   * length is 1 again -> "Scenario 2" collides with the survivor. Scanning
   * existing names for the highest used N and incrementing past it is
   * immune to delete history; the registry's UUID `id` (never `name`)
   * remains the only identity used for storage keys and routing, so this is
   * purely a display-label fix.
   */
  function nextDefaultScenarioName(): string {
    let highest = 0
    for (const s of registry.value) {
      const match = /^Scenario (\d+)$/.exec(s.name)
      if (match) {
        const n = Number(match[1])
        if (n > highest) highest = n
      }
    }
    return `Scenario ${highest + 1}`
  }

  /**
   * createScenario (D-11). Appends `{ id, name, createdAt }` to the
   * registry via a new array reference (`useStorage`'s reactivity requires
   * this -- never `.push`) and activates it immediately, so the user lands
   * directly in the scenario they just created (Claude's Discretion --
   * 07-UI-SPEC.md's "immediately editable inline" language for the new row
   * implies the user is now working within it).
   */
  function createScenario(name?: string): ScenarioMeta {
    // WR-01: an explicitly-passed empty/whitespace-only string falls back to
    // the default name exactly like an omitted `name` does, so this
    // composable's own contract can't produce a blank registry entry even if
    // a future caller passes one through.
    const trimmedName = name?.trim()
    const meta: ScenarioMeta = {
      id: crypto.randomUUID(),
      name: trimmedName && trimmedName.length > 0
        ? trimmedName.slice(0, MAX_SCENARIO_NAME_LENGTH)
        : nextDefaultScenarioName(),
      createdAt: new Date().toISOString()
    }
    registry.value = [...registry.value, meta]
    activeScenarioId.value = meta.id
    return meta
  }

  /**
   * renameScenario. Updates only the target entry's `name`; every other
   * field, entry, and `activeScenarioId` is untouched.
   *
   * WR-01: trims and caps defensively -- `ScenarioSwitcher.vue`'s
   * `commitRename` already rejects an empty/whitespace-only name before
   * emitting, but this composable is the untrusted-input boundary (its
   * contract is public, not limited to that one caller), so a blank or
   * overlong name is silently ignored (no-op, matching `duplicateScenario`'s
   * and `deleteScenario`'s guard-and-return-early style) rather than
   * persisted.
   */
  function renameScenario(id: string, name: string): void {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    const capped = trimmed.slice(0, MAX_SCENARIO_NAME_LENGTH)
    registry.value = registry.value.map(s => (s.id === id ? { ...s, name: capped } : s))
  }

  /**
   * duplicateScenario/deleteScenario (RESEARCH.md Pattern 2, PATTERNS.md
   * Analog). Both act on a scenario that may not be the one currently
   * mounted under the app's `:key="activeScenarioId"` remount boundary --
   * there is no live `useStorage()` ref for it to mutate through. Both
   * operate on raw `localStorage` reads/writes keyed exclusively through
   * `scenarioKeys` (RESEARCH.md Pitfall 3) -- never a hand-inlined
   * `` `cfb_${kind}_${season}_${id}` `` template literal, and never by
   * constructing a live `usePicksStorage`/`useAutoFilledGames`/
   * `useManualTiebreakers` instance for the source or target id.
   *
   * WR-03: returns `undefined` and no-ops entirely (no registry entry, no
   * key copies, no `activeScenarioId` change) when `id` doesn't match any
   * registry entry, rather than silently fabricating an empty
   * `"Scenario (copy)"`. Matches this file's own `deleteScenario` guard
   * style. Not reachable through the current UI (the switcher only ever
   * emits `duplicate` with a real row's id) -- this closes the public
   * composable contract gap for any future/indirect caller.
   */
  function duplicateScenario(id: string): ScenarioMeta | undefined {
    const source = registry.value.find(s => s.id === id)
    if (!source) return undefined
    const sourceName = source.name
    const newId = crypto.randomUUID()

    const keyPairs: Array<[string, string]> = [
      [scenarioKeys.picks(season, id), scenarioKeys.picks(season, newId)],
      [scenarioKeys.autofilled(season, id), scenarioKeys.autofilled(season, newId)],
      [scenarioKeys.manualTiebreakers(season, id), scenarioKeys.manualTiebreakers(season, newId)],
      [scenarioKeys.championshipPicks(season, id), scenarioKeys.championshipPicks(season, newId)]
    ]
    for (const [sourceKey, targetKey] of keyPairs) {
      const raw = localStorage.getItem(sourceKey)
      if (raw !== null) localStorage.setItem(targetKey, raw)
      // raw === null: source has no data for this kind yet -- nothing to
      // copy, no phantom key written for the target.
    }

    // Constructed directly (not via createScenario()) so the copy's id is
    // guaranteed to be the SAME id used for the just-copied storage keys
    // above -- calling createScenario() would generate a second, different id.
    const meta: ScenarioMeta = {
      id: newId,
      // CR-01: `sourceName` can legitimately be up to MAX_SCENARIO_NAME_LENGTH
      // (via renameScenario), so the unbounded `(copy)` suffix could produce a
      // name past isValidScenarioMeta's own cap -- causing this entry to be
      // silently dropped by validateRegistry on the very next load. Cap it the
      // same way renameScenario/createScenario already do.
      name: `${sourceName} (copy)`.slice(0, MAX_SCENARIO_NAME_LENGTH),
      createdAt: new Date().toISOString()
    }
    registry.value = [...registry.value, meta]
    activeScenarioId.value = meta.id
    return meta
  }

  /** deleteScenario (D-14, D-16). No-op at registry length 1; otherwise removes the three per-scenario keys and the registry entry, falling back activeScenarioId with no additional prompt when the deleted id was active. */
  function deleteScenario(id: string): void {
    if (registry.value.length <= 1) return

    localStorage.removeItem(scenarioKeys.picks(season, id))
    localStorage.removeItem(scenarioKeys.autofilled(season, id))
    localStorage.removeItem(scenarioKeys.manualTiebreakers(season, id))
    localStorage.removeItem(scenarioKeys.championshipPicks(season, id))

    registry.value = registry.value.filter(s => s.id !== id)

    if (activeScenarioId.value === id) {
      activeScenarioId.value = registry.value[0]!.id
    }
  }

  /**
   * Migration (D-03). Gated on `hadNoRegistryBefore && registry.value.length
   * === 0` -- runs at most once per browser profile, since after the first
   * run the registry key exists in localStorage (`hadNoRegistryBefore`
   * would read false on any later call). Must run BEFORE the unconditional
   * recovery pass below, so migration and fresh-install default creation
   * stay mutually exclusive: if no legacy picks exist, this step does
   * nothing and falls through to the recovery pass, which creates the
   * "Scenario 1" default via `createScenario()` instead.
   *
   * Legacy values are copied byte-for-byte via raw `localStorage.getItem`/
   * `setItem` -- never `JSON.parse`/`JSON.stringify` in transit, so the
   * corruption-recovery serializers in `usePicksStorage`/
   * `useAutoFilledGames`/`useManualTiebreakers` see identical input to what
   * they saw before this phase shipped. Legacy keys are never removed.
   */
  if (hadNoRegistryBefore && registry.value.length === 0) {
    const legacyPicksRaw = localStorage.getItem(scenarioKeys.legacyPicks(season))
    if (legacyPicksRaw !== null) {
      const meta: ScenarioMeta = {
        id: crypto.randomUUID(),
        name: 'My Scenario',
        createdAt: new Date().toISOString()
      }
      registry.value = [meta]
      activeScenarioId.value = meta.id

      const legacyPairs: Array<[string, string]> = [
        [scenarioKeys.legacyPicks(season), scenarioKeys.picks(season, meta.id)],
        [scenarioKeys.legacyAutofilled(season), scenarioKeys.autofilled(season, meta.id)],
        [scenarioKeys.legacyManualTiebreakers(season), scenarioKeys.manualTiebreakers(season, meta.id)],
        [scenarioKeys.legacyChampionshipPicks(season), scenarioKeys.championshipPicks(season, meta.id)]
      ]
      for (const [legacyKey, newKey] of legacyPairs) {
        const raw = localStorage.getItem(legacyKey)
        if (raw !== null) localStorage.setItem(newKey, raw)
      }
    }
  }

  // Unconditional recovery pass (D-05, D-14, D-17) -- runs on EVERY call,
  // handling both "totally fresh browser, nothing to migrate" and
  // "corruption reset the registry to `[]` on a later load" identically,
  // since both need the exact same outcome: a non-empty registry and a
  // valid active pointer. The naming rule (`Scenario ${N}`) lives in
  // exactly one place: createScenario().
  if (registry.value.length === 0) {
    createScenario()
  }
  if (!registry.value.some(s => s.id === activeScenarioId.value)) {
    activeScenarioId.value = registry.value[0]!.id
  }

  return { scenarios: registry, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario }
}
