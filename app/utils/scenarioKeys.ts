/**
 * Single source of truth for every scenario-scoped `localStorage` key this
 * app reads or writes (Phase 7, RESEARCH.md Pitfall 3). Mirrors
 * `app/utils/queryKeys.ts`'s factory-object shape. App-layer-only, exactly
 * like `queryKeys.ts` — never consumed by `scripts/`.
 *
 * `usePicksStorage`, `useAutoFilledGames`, and `useManualTiebreakers` build
 * their live storage key exclusively through these functions (never a
 * hand-typed `cfb_<thing>_<season>_<scenarioId>` template literal). Plan
 * 07-03's `useScenarios.ts` imports the same functions for its raw-
 * localStorage migration/duplicate/delete operations, so both sides can
 * never drift out of sync (RESEARCH.md Pitfall 3, D-02).
 *
 * The three `legacy*` builders return the exact pre-Phase-7, unsuffixed key
 * strings those three composables used before this phase — Plan 07-03's
 * migration logic (D-03) reads these to detect and copy forward
 * pre-existing user data. They are deliberately NOT parameterized by
 * scenario id — the legacy keys never had a scenario axis.
 */
export const scenarioKeys = {
  registry: (season: number) => `cfb_scenarios_${season}`,
  active: (season: number) => `cfb_active_scenario_${season}`,
  picks: (season: number, scenarioId: string) => `cfb_picks_${season}_${scenarioId}`,
  autofilled: (season: number, scenarioId: string) => `cfb_autofilled_${season}_${scenarioId}`,
  manualTiebreakers: (season: number, scenarioId: string) => `cfb_manual_tiebreakers_${season}_${scenarioId}`,
  championshipPicks: (season: number, scenarioId: string) => `cfb_championship_picks_${season}_${scenarioId}`,
  legacyPicks: (season: number) => `cfb_picks_${season}`,
  legacyAutofilled: (season: number) => `cfb_autofilled_${season}`,
  legacyManualTiebreakers: (season: number) => `cfb_manual_tiebreakers_${season}`,
  legacyChampionshipPicks: (season: number) => `cfb_championship_picks_${season}`
}
