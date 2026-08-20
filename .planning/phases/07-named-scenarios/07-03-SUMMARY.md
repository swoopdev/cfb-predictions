---
phase: 07-named-scenarios
plan: 03
subsystem: scenario-storage
tags: [localstorage, useStorage, composables, scenarios, migration]

requires:
  - phase: 07-named-scenarios (Plan 01)
    provides: shared/types/scenarios.ts (ScenarioMeta), app/utils/scenarioKeys.ts (scenarioKeys factory)
provides:
  - useScenarios(season) composable — scenarios, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario
affects:
  - "Plan 07-04 (ScenarioSwitcher.vue / DeleteScenarioModal.vue — consumes useScenarios' return object)"
  - "Plan 07-05 (week/[week].vue — the only real consumer of activeScenarioId as a switching value)"

tech-stack:
  added: []
  patterns:
    - "useStorage + custom serializer with silent reset on top-level corruption (no _corrupt key), per-entry-drop validation, and dedupe-by-id for the registry (D-17, mirrors useManualTiebreakers.ts, not usePicksStorage.ts)"
    - "hadNoRegistryBefore captured via a raw localStorage.getItem check BEFORE constructing any useStorage() call, to avoid writeDefaults:true masking the fresh-install signal"
    - "duplicateScenario/deleteScenario operate on raw localStorage.getItem/setItem/removeItem keyed through scenarioKeys.ts — never a live usePicksStorage/useAutoFilledGames/useManualTiebreakers instance for a non-active scenario"
    - "Migration and fresh-install default-creation are mutually exclusive via a single unconditional recovery pass sitting after both, keyed on registry.value.length === 0"

key-files:
  created:
    - app/composables/useScenarios.ts
    - tests/composables/useScenarios.test.ts
  modified: []

key-decisions:
  - "The unconditional recovery pass's naming rule lives in exactly one place (createScenario()'s `Scenario ${N}` default) — Task 1's inline literal was replaced by a call to createScenario() once it existed, per the plan's own instruction"
  - "Migration is gated on hadNoRegistryBefore && registry.value.length === 0, which self-limits to exactly one run per browser profile since the registry key exists in localStorage after the first successful write"

patterns-established:
  - "Pattern 2 (RESEARCH.md): scenario-registry mutations targeting an arbitrary (possibly non-mounted) scenario id go through raw localStorage, never a live composable instance"

requirements-completed: [SCEN-01, SCEN-02, SCEN-03, SCEN-04]

coverage:
  - id: D1
    description: "useScenarios(season) always resolves to a non-empty registry and a valid activeScenarioId synchronously, self-healing from empty/corrupted/dangling-pointer states"
    requirement: SCEN-02
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#fresh install (no registry, no legacy data) > resolves to a registry with exactly one scenario and a matching activeScenarioId"
        status: pass
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#corrupted/malformed registry recovery (5 tests: invalid JSON, invalid entry, missing fields, duplicate id, empty array)"
        status: pass
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#dangling active-scenario pointer > corrects activeScenarioId to the registry's first entry when it references a nonexistent id"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pre-existing pre-Phase-7 picks/autofill/manual-tiebreaker data migrates forward exactly once into a first 'My Scenario', legacy keys left intact; fresh installs with no legacy data get a 'Scenario 1' default instead"
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#migration (D-03) (4 tests: full wrap, partial-keys wrap, idempotency across a simulated reload, no-legacy-data default naming)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createScenario() appends a new scenario with a default or custom name and activates it"
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#createScenario (2 tests: default naming, custom name)"
        status: pass
    human_judgment: false
  - id: D4
    description: "renameScenario(id, name) updates only the target entry's name, leaving every other entry, storage key, and activeScenarioId untouched"
    requirement: SCEN-03
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#renameScenario > updates only the target entry's name, leaving everything else untouched"
        status: pass
    human_judgment: false
  - id: D5
    description: "duplicateScenario(id) copies all three per-scenario storage kinds for a non-active source scenario via raw localStorage, skipping absent kinds, without constructing a live per-scenario composable instance"
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#duplicateScenario (2 tests: full copy for a non-active source, partial-kinds copy)"
        status: pass
    human_judgment: false
  - id: D6
    description: "deleteScenario(id) removes the scenario's three per-scenario keys and registry entry, falls back activeScenarioId when deleting the active scenario, and is a no-op at registry length 1"
    requirement: SCEN-03
    verification:
      - kind: unit
        ref: "tests/composables/useScenarios.test.ts#deleteScenario (3 tests: key/entry removal, active-scenario fallback, length-1 no-op)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-19
status: complete
---

# Phase 7 Plan 3: Scenario Registry, Migration & CRUD Summary

Built `useScenarios(season)` — the scenario registry, active-scenario pointer, one-time legacy-picks migration, and the four CRUD actions (create/rename/duplicate/delete), all with corruption/dangling-pointer/empty-registry self-healing resolved synchronously before the composable returns.

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 test file)

## Accomplishments

- `useScenarios(season = 2026)` returns `{ scenarios, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario }`, with every stored key built exclusively through `app/utils/scenarioKeys.ts`
- Registry (`cfb_scenarios_{season}`) self-heals from unparseable JSON, a non-array top-level payload, individually malformed entries, duplicate ids, and a semantically-empty array — always ending in exactly one valid default scenario when nothing survives validation
- Active pointer (`cfb_active_scenario_{season}`) self-corrects to the registry's first entry whenever it references a scenario id no longer present
- Pre-existing pre-Phase-7 `cfb_picks_2026`/`cfb_autofilled_2026`/`cfb_manual_tiebreakers_2026` data is wrapped byte-for-byte into a first scenario named "My Scenario" on first load, exactly once, with legacy keys left untouched forever
- `duplicateScenario`/`deleteScenario` operate entirely through raw `localStorage.getItem`/`setItem`/`removeItem`, proven by tests that never construct a live `usePicksStorage`/`useAutoFilledGames`/`useManualTiebreakers` instance for the scenario being duplicated or deleted

## Task Commits

Both tasks followed the RED → GREEN TDD cycle:

1. **Task 1: Registry and active-pointer storage, validation, self-healing recovery**
   - `9f4cda7` test(07-03): add failing tests for useScenarios registry self-healing (RED)
   - `40fddfc` feat(07-03): registry and active-pointer storage with self-healing recovery (GREEN)
2. **Task 2: Migration and CRUD actions**
   - `d5eadfb` test(07-03): add failing tests for migration and CRUD actions (RED)
   - `22c6aba` feat(07-03): migration and CRUD actions for useScenarios (GREEN)

No REFACTOR commits were needed for either task — each GREEN implementation was already the intended final shape, matching RESEARCH.md's Pattern 1/2 and PATTERNS.md's assigned analogs directly.

## Files Created/Modified

- `app/composables/useScenarios.ts` — new composable: registry/active-pointer storage, `validateRegistry`/`isValidScenarioMeta` shape guards, migration, and the four CRUD functions
- `tests/composables/useScenarios.test.ts` — new test file, 19 tests covering every behavior block item in the plan (self-healing, migration, CRUD)

## Decisions Made

- Followed the plan's explicit instruction: Task 1's inline default-scenario literal in the unconditional recovery pass was replaced in Task 2 by a call to the real `createScenario()`, so the `` `Scenario ${N}` `` naming rule lives in exactly one place
- `duplicateScenario` constructs its `ScenarioMeta` directly (not via `createScenario()`) so the copy's id is guaranteed to match the id already used for the just-copied storage keys — calling `createScenario()` would have generated a second, different id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test needed an `await nextTick()` before simulating a page reload**
- **Found during:** Task 2 (migration idempotency test)
- **Issue:** The "does not re-run migration on a second call" test constructed a second `useScenarios(SEASON)` synchronously right after the first, with no tick in between. VueUse's `useStorage` persistence watch defaults to `flush: 'pre'` (not synchronous with ref assignment) — the registry's actual `localStorage` write from the first call's migration hadn't flushed yet, so the second call's `hadNoRegistryBefore` check read `null` and incorrectly re-ran migration, creating a second scenario with a different id.
- **Fix:** Added `await nextTick()` between the two `useScenarios()` calls in the test, correctly simulating the flush time a real page reload would always have.
- **Files modified:** `tests/composables/useScenarios.test.ts`
- **Verification:** Test passes; the composable implementation itself required no change — this was a test-timing correction, not a production bug (the same `flush: 'pre'` behavior is already relied on correctly by every other write in the file, which only ever asserts in-memory `.value` state or awaits `nextTick()` before checking `localStorage` directly).
- **Committed in:** `22c6aba` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug/test-timing correction)
**Impact on plan:** No scope creep — the fix corrected a test's own timing assumption to match VueUse's documented `useStorage` flush behavior; the implementation matches the plan's `<action>` block exactly.

## Issues Encountered

None beyond the timing correction documented above.

## Verification Results

- `npx vitest run tests/composables/useScenarios.test.ts` — **19 passed, 0 failed**
- `npx vitest run` (full suite) — **550 passed, 0 failed** across 45 files
- `git diff --stat package.json pnpm-lock.yaml` — empty (no packages installed, per the threat model's T-07-SC requirement)
- `pnpm typecheck` — fails with the same 5 pre-existing errors documented in Plan 07-01's SUMMARY (`app/pages/week/[week].vue` argument-count mismatches for `usePicksStorage`/`useAutoFilledGames`/`PickProgress`/`PickProgressWeek`, all out of this plan's scope and owned by Plan 07-05). `useScenarios.ts` and `useScenarios.test.ts` introduce zero new typecheck errors — confirmed identical error set before and after this plan's commits.

## Known Stubs

None. `useScenarios.ts` has no consumer yet (Plans 07-04/07-05 wire it into the UI) — this is expected per the plan's own scope note: "this plan proves the contract those plans wire against," not a stub.

## Threat Flags

None. All three STRIDE threats this plan's threat model assigned a `mitigate` disposition (T-07-01, T-07-02, T-07-03) are covered directly by `validateRegistry`'s per-entry-drop/dedupe-by-id logic and the unconditional recovery pass's dangling-pointer correction — verified by the corresponding tests in the "corrupted/malformed registry recovery" and "dangling active-scenario pointer" describe blocks. T-07-SC (supply chain) is verified by the empty `package.json`/`pnpm-lock.yaml` diff above.

## Next Phase Readiness

- `useScenarios(season)`'s full contract (`scenarios`, `activeScenarioId`, `createScenario`, `renameScenario`, `duplicateScenario`, `deleteScenario`) is ready for Plan 07-04 (`ScenarioSwitcher.vue`, `DeleteScenarioModal.vue`) to consume directly
- Plan 07-05 (`week/[week].vue`) can call `useScenarios(2026)` at the page's unkeyed top level and thread `activeScenarioId` into the `:key`-remounted subtree per RESEARCH.md Pattern 1 — no further composable work is needed from this plan's side
- No blockers

---
*Phase: 07-named-scenarios*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: app/composables/useScenarios.ts
- FOUND: tests/composables/useScenarios.test.ts
- FOUND: .planning/phases/07-named-scenarios/07-03-SUMMARY.md
- FOUND commit: 9f4cda7
- FOUND commit: 40fddfc
- FOUND commit: d5eadfb
- FOUND commit: 22c6aba
- FOUND commit: 8aacacb
