/**
 * Registry entry shape for a named prediction scenario (Phase 7).
 *
 * `id` is the durable identity (D-01) — decoupled from the renamable `name`
 * so a scenario can be renamed without losing its identity or its
 * scenario-scoped storage keys (`app/utils/scenarioKeys.ts` builds every
 * per-scenario key from `id`, never `name`).
 *
 * Consumed by `useScenarios` (Plan 07-03), which owns the registry
 * (`cfb_scenarios_{season}`) this type describes an entry of, and by
 * `ScenarioSwitcher.vue` (Plan 07-04), which renders the registry as a list.
 *
 * Mirrors `shared/types/schedule.ts`'s convention: a plain interface,
 * consumed via Nuxt 4's `shared/` auto-import scope (`#shared/types/scenarios`).
 */
export interface ScenarioMeta {
  id: string
  name: string
  /** ISO 8601 string, matching `new Date().toISOString()`. */
  createdAt: string
}
