---
phase: 07-named-scenarios
plan: 01
subsystem: scenario-storage
tags: [localstorage, useStorage, composables, scenarios]
dependencies:
  requires: []
  provides:
    - shared/types/scenarios.ts (ScenarioMeta)
    - app/utils/scenarioKeys.ts (scenarioKeys factory)
    - usePicksStorage(scenarioId, season) signature
    - useAutoFilledGames(scenarioId, season) signature
    - useManualTiebreakers(scenarioId, season) signature
  affects:
    - app/composables/usePickProgress.ts (Plan 07-02, internal call site)
    - app/composables/useStandings.ts (Plan 07-02, internal call site)
    - app/components/PickProgress.vue (Plan 07-02, internal call site)
    - app/components/PickProgressWeek.vue (Plan 07-02, internal call site)
    - app/pages/week/[week].vue (Plan 07-05, internal call sites)
    - app/composables/useScenarios.ts (Plan 07-03, imports scenarioKeys for migration/duplicate/delete)
tech-stack:
  added: []
  patterns:
    - "Single scenarioKeys.ts factory object (mirrors queryKeys.ts) as the sole source of every scenario-scoped localStorage key string"
    - "Required-first, defaulted-second parameter order (scenarioId: string, season = 2026) to preserve season's usefulness while making a missing scenarioId a compile error"
key-files:
  created:
    - shared/types/scenarios.ts
    - app/utils/scenarioKeys.ts
  modified:
    - app/composables/usePicksStorage.ts
    - app/composables/useAutoFilledGames.ts
    - app/composables/useManualTiebreakers.ts
    - tests/composables/usePicksStorage.test.ts
    - tests/composables/useAutoFilledGames.test.ts
    - tests/composables/useManualTiebreakers.test.ts
decisions:
  - "scenarioKeys.ts lives in app/utils/ (not shared/utils/), matching queryKeys.ts's precedent exactly — this is app-layer-only, never consumed by scripts/"
  - "Legacy key builders (legacyPicks/legacyAutofilled/legacyManualTiebreakers) added to scenarioKeys.ts now even though Plan 07-03 is their first consumer, so the migration logic never hand-types a pre-Phase-7 key string either"
metrics:
  duration: "35 min"
  completed: 2026-08-20
status: complete
---

# Phase 7 Plan 1: Scenario-Aware Storage Composables Summary

Refactored `usePicksStorage`, `useAutoFilledGames`, and `useManualTiebreakers` to a required `scenarioId` parameter backed by a single new `scenarioKeys.ts` key factory, proving cross-scenario isolation with new regression tests targeting the exact `useStorage` reactive-key leak RESEARCH.md's Pitfall 1 reproduced.

## What Was Built

- **`shared/types/scenarios.ts`** — exports `ScenarioMeta` (`{ id, name, createdAt }`), the registry entry shape Plan 07-03's `useScenarios` will own and Plan 07-04's `ScenarioSwitcher.vue` will render.
- **`app/utils/scenarioKeys.ts`** — the single source of truth for every scenario-scoped `localStorage` key: `registry`, `active`, `picks`, `autofilled`, `manualTiebreakers`, plus three `legacy*` builders returning the exact pre-Phase-7 unsuffixed keys those three composables used before this phase (for Plan 07-03's migration logic).
- **`usePicksStorage(scenarioId, season = 2026)`** — signature swapped, key now `scenarioKeys.picks(season, scenarioId)`. Corruption-recovery serializer, `_corrupt` preservation, and all other logic byte-identical.
- **`useAutoFilledGames(scenarioId, season = 2026)`** — same swap, key now `scenarioKeys.autofilled(season, scenarioId)`. `markAutoFilled`/`isAutoFilled`/`autoFilledSet` and silent-reset corruption disposition unchanged.
- **`useManualTiebreakers(scenarioId, season = 2026)`** — same swap, key now `scenarioKeys.manualTiebreakers(season, scenarioId)`. `validateConferenceDecisions`, `commitOrdering`, `pruneStale`, `decisionsFor` unchanged.
- **Test updates** — all 27 + 32 + 22 = 81 pre-existing call sites across the three test files updated to the new `(SCENARIO_ID, SEASON)` shape (via a `scenarioKeys`-derived `STORAGE_KEY` constant, never a hand-typed key string), plus a new "Scenario Namespacing" describe block per file proving two scenario ids under the same season produce fully independent `localStorage` entries and in-memory state — a direct regression test against RESEARCH.md's verified Pitfall 1 leak.

## Task-by-Task

1. **Key factory, ScenarioMeta type, and usePicksStorage refactor** — `5275141`
2. **useAutoFilledGames refactor** — `84f79d8`
3. **useManualTiebreakers refactor** — `eba4a2c`

## Deviations from Plan

None — plan executed exactly as written. All three composables' signatures, key derivations, and test suites match the plan's `<action>`/`<acceptance_criteria>` blocks precisely.

## Verification Results

- `npx vitest run tests/composables/usePicksStorage.test.ts tests/composables/useAutoFilledGames.test.ts tests/composables/useManualTiebreakers.test.ts` — **78 passed, 0 failed**
- `npx vitest run` (full suite) — **531 passed, 0 failed** across 44 files
- `git diff --stat package.json pnpm-lock.yaml` — empty (no packages installed, as the plan's threat model required)
- `pnpm typecheck` — **fails**, but only in files explicitly out of this plan's scope: `app/composables/usePickProgress.ts`, `app/composables/useStandings.ts`, `app/components/PickProgress.vue`, `app/components/PickProgressWeek.vue`, `app/pages/week/[week].vue`. Each error is `Argument of type 'number' is not assignable to parameter of type 'string'` at the exact internal call sites (`usePicksStorage(season)`, `useAutoFilledGames(season)`, `useManualTiebreakers(season)`) that Plan 07-02 (wave 2, `depends_on: ["07-01"]`) and Plan 07-05 own and will rewire to thread `scenarioId` through. This is the exact, self-catching consequence RESEARCH.md's Pitfall 4 predicted ("the type checker will fail loudly on the... stale call sites... should be planned for rather than discovered mid-execution") and is expected to persist until those downstream plans land — it is not a defect in this plan's own three files or tests, all of which typecheck and test cleanly in isolation. Vitest itself (esbuild-transpiled, no type enforcement) is unaffected — all 531 tests pass at runtime because the JS runtime doesn't care that a `number` was passed where TypeScript now expects a `string`; it's used identically in a template-literal interpolation either way.

## Known Stubs

None.

## Threat Flags

None — this plan re-keys existing storage reads/writes with no new network surface, auth path, or schema change at a trust boundary. `T-07-05` (no new logging) and `T-07-SC` (no new packages) from the plan's threat model are both satisfied, verified by `git diff` showing no new `console.*` call and an empty `package.json`/`pnpm-lock.yaml` diff.

## Self-Check: PASSED

- FOUND: shared/types/scenarios.ts
- FOUND: app/utils/scenarioKeys.ts
- FOUND: app/composables/usePicksStorage.ts (scenario-aware signature)
- FOUND: app/composables/useAutoFilledGames.ts (scenario-aware signature)
- FOUND: app/composables/useManualTiebreakers.ts (scenario-aware signature)
- FOUND commit: 5275141
- FOUND commit: 84f79d8
- FOUND commit: eba4a2c
