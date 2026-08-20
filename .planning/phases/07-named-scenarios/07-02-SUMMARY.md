---
phase: 07-named-scenarios
plan: 02
subsystem: scenario-storage
tags: [composables, vue, scenarios, standings, pick-progress]

requires:
  - phase: 07-named-scenarios (Plan 01)
    provides: usePicksStorage(scenarioId, season), useManualTiebreakers(scenarioId, season), useAutoFilledGames(scenarioId, season) signatures and app/utils/scenarioKeys.ts
provides:
  - usePickProgress(scenarioId, season) signature
  - useStandings(scenarioId, season) signature
  - scenarioId required prop on PickProgress.vue
  - scenarioId required prop on PickProgressWeek.vue
affects: [07-05 (app/pages/week/[week].vue is the sole remaining call site needing to pass scenarioId through)]

tech-stack:
  added: []
  patterns:
    - "Signature/call-site-only propagation: derived composables and display components thread scenarioId through unchanged, with zero change to derivation logic, matching Plan 07-01's discipline"
    - "useGames/useTeams remain season-only (never scenario-scoped) at every call site that touches them"

key-files:
  created: []
  modified:
    - app/composables/usePickProgress.ts
    - app/composables/useStandings.ts
    - app/components/PickProgress.vue
    - app/components/PickProgressWeek.vue
    - tests/composables/usePickProgress.test.ts
    - tests/composables/useStandings.test.ts
    - tests/components/PickProgress.test.ts
    - tests/components/PickProgressWeek.test.ts

key-decisions:
  - "useStandings threads scenarioId into BOTH usePicksStorage and useManualTiebreakers, never into useGames/useTeams — same required-first/defaulted-second signature order Plan 07-01 established"
  - "PickProgress.vue/PickProgressWeek.vue's scenarioId prop has no default, mirroring the composable signature's required-first pattern, so no progress badge can mount without knowing its scenario"

patterns-established:
  - "Test fixture convention: SCENARIO_ID (and SEASON where a named season constant already existed) alongside existing season literals, per Plan 07-01's precedent"

requirements-completed: [SCEN-01, SCEN-02]

coverage:
  - id: D1
    description: "usePickProgress requires a scenario id and threads it only into usePicksStorage, never into useGames"
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "tests/composables/usePickProgress.test.ts (20 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useStandings requires a scenario id and threads it into both usePicksStorage and useManualTiebreakers, never into useGames/useTeams"
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "tests/composables/useStandings.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PickProgress.vue and PickProgressWeek.vue require a scenarioId prop (no default) and thread it into their internal composable calls"
    requirement: SCEN-02
    verification:
      - kind: unit
        ref: "tests/components/PickProgress.test.ts (10 tests), tests/components/PickProgressWeek.test.ts (11 tests)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-20
status: complete
---

# Phase 7 Plan 2: Derived Composables and Progress Components Scenario Threading Summary

**Threaded `scenarioId` through `usePickProgress`, `useStandings`, `PickProgress.vue`, and `PickProgressWeek.vue` — a signature/call-site-only swap that closes the exact typecheck gap Plan 07-01 left open, with zero change to any derivation logic.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-08-20
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `usePickProgress(scenarioId, season = 2026)` now requires a scenario id, passed only into its internal `usePicksStorage` call — `useGames` stays season-only, per the plan's explicit anti-regression requirement.
- `useStandings(scenarioId, season = 2026)` now requires a scenario id, passed into BOTH its internal `usePicksStorage` and `useManualTiebreakers` calls — `useGames`/`useTeams` stay season-only. The D-13/WR-03 explicit-source `watch` and pruneStale side effect are byte-identical apart from the new parameter.
- `PickProgress.vue` and `PickProgressWeek.vue` each gained a required `scenarioId: string` prop (no default), threaded straight into their `usePicksStorage`/`usePickProgress` calls — no component can mount without knowing which scenario it displays.
- All 52 test call sites RESEARCH.md's Pitfall 4 flagged across these four files (20 + 12 + 10 + 11, adjusted to the actual counts found: 20 usePickProgress calls, 12 useStandings/useManualTiebreakers calls, and mount-prop updates across both component test files) compile and pass again.

## Task Commits

Each task was committed atomically:

1. **Task 1: usePickProgress refactor** - `f06669b` (feat)
2. **Task 2: useStandings refactor** - `6bb8898` (feat)
3. **Task 3: PickProgress.vue and PickProgressWeek.vue scenarioId prop** - `115460d` (feat)

**Plan metadata:** (pending — final docs commit follows this summary)

_Note: this plan's tasks were mechanical signature/call-site propagation (test + implementation updated together per Plan 07-01's own precedent), not new behavior — no separate RED/GREEN commit split was applicable or used, matching Plan 07-01's committed convention for the same class of work._

## Files Created/Modified
- `app/composables/usePickProgress.ts` - signature now `(scenarioId, season = 2026)`; internal `usePicksStorage` call receives both args, `useGames` unchanged
- `app/composables/useStandings.ts` - signature now `(scenarioId, season = 2026)`; internal `usePicksStorage`/`useManualTiebreakers` calls receive both args, `useGames`/`useTeams` unchanged; docblock gained one sentence on the new parameter
- `app/components/PickProgress.vue` - added required `scenarioId: string` prop, threaded into `usePicksStorage`/`usePickProgress`
- `app/components/PickProgressWeek.vue` - added required `scenarioId: string` prop, threaded into `usePicksStorage`/`usePickProgress`
- `tests/composables/usePickProgress.test.ts` - added `SCENARIO_ID` constant, updated 20 call sites and the `usePicksStorageSpy` assertion block (the sibling `useGamesSpy` assertion deliberately left single-argument)
- `tests/composables/useStandings.test.ts` - added `SCENARIO_ID`/`SEASON` constants, updated 8 `useStandings(...)` and 4 `useManualTiebreakers(...)` call sites
- `tests/components/PickProgress.test.ts` - every `mount(PickProgress, ...)` call now supplies `scenarioId`; `toHaveBeenCalledWith` assertions updated
- `tests/components/PickProgressWeek.test.ts` - every `mount(PickProgressWeek, ...)` call now supplies `scenarioId`; `toHaveBeenCalledWith` assertions updated

## Decisions Made
None beyond what Plan 07-01 already established — this plan is a mechanical continuation of those conventions (required-first/defaulted-second parameter order, `SCENARIO_ID` test fixture constant).

## Deviations from Plan

None - plan executed exactly as written. All four files' signature changes, call-site updates, and test updates match the plan's `<action>`/`<acceptance_criteria>` blocks precisely.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`app/pages/week/[week].vue` (Plan 07-05) is now confirmed as the sole remaining unmigrated call site for `usePicksStorage`/`useAutoFilledGames`/`useStandings` and for `PickProgress`/`PickProgressWeek` — `pnpm typecheck` shows every remaining error localized to that one file (5 errors: two `usePicksStorage`/`useAutoFilledGames`-shaped argument-type errors, one `useStandings`-shaped argument-type error, and two missing-`scenarioId`-prop errors on the `PickProgress`/`PickProgressWeek` mount call sites), exactly the contract Plan 07-05 needs to close. `git diff --stat package.json pnpm-lock.yaml` is empty; full suite is 531/531 passing across 44 files.

---
*Phase: 07-named-scenarios*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: app/composables/usePickProgress.ts
- FOUND: app/composables/useStandings.ts
- FOUND: app/components/PickProgress.vue
- FOUND: app/components/PickProgressWeek.vue
- FOUND: tests/composables/usePickProgress.test.ts
- FOUND: tests/composables/useStandings.test.ts
- FOUND: tests/components/PickProgress.test.ts
- FOUND: tests/components/PickProgressWeek.test.ts
- FOUND commit: f06669b
- FOUND commit: 6bb8898
- FOUND commit: 115460d
- FOUND commit: 3093bbf
