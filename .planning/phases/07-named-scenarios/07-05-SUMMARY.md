---
phase: 07-named-scenarios
plan: 05
subsystem: scenario-ui-wiring
tags: [vue, nuxt, key-remount, useStorage, scenarios]

requires:
  - phase: 07-named-scenarios (Plan 01)
    provides: usePicksStorage(scenarioId, season), useAutoFilledGames(scenarioId, season) signatures
  - phase: 07-named-scenarios (Plan 02)
    provides: useStandings(scenarioId, season) signature, scenarioId prop on PickProgress.vue/PickProgressWeek.vue
  - phase: 07-named-scenarios (Plan 03)
    provides: useScenarios(season) composable (scenarios, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario)
  - phase: 07-named-scenarios (Plan 04)
    provides: ScenarioSwitcher.vue, DeleteScenarioModal.vue
provides:
  - app/components/PicksWorkspace.vue — the sole caller of usePicksStorage/useAutoFilledGames/useStandings in the running app
  - week/[week].vue wired end-to-end: useScenarios() at the unkeyed top level, PicksWorkspace mounted with :key="activeScenarioId"
affects: []

tech-stack:
  added: []
  patterns:
    - "Vue :key remount as the sole mechanism for swapping which useStorage() instance backs scenario-scoped state — no reactive key ever passed into a persisting useStorage() call (RESEARCH.md Pitfall 1)"
    - "Delete-confirmation state (deleteTarget ref) bridges a component's id-only delete emit onto a boolean-open confirmation modal via a computed get/set pair"

key-files:
  created:
    - app/components/PicksWorkspace.vue
  modified:
    - app/pages/week/[week].vue
    - tests/lib/empty-state.test.ts
    - app/composables/useScenarios.ts

key-decisions:
  - "ScenarioSwitcher/DeleteScenarioModal stay in week/[week].vue's own unkeyed template scope, NOT inside PicksWorkspace — even though Task 1 initially co-located the switcher with the Fill/Clear Season buttons in the same div, Task 2's extraction relocates only the picks-dependent content (including those buttons) into PicksWorkspace, leaving the switcher/modal at the page's persisting top level so they survive a scenario switch"
  - "Fixed a pre-existing operator-linebreak lint error in useScenarios.ts (from Plan 07-03, unrelated to this plan's own edits) via eslint --fix, since Task 2's own acceptance criteria require a clean full-repo `pnpm lint` run and the fix is a zero-behavior-change stylistic change"
  - "tests/lib/empty-state.test.ts's source-grounding check (asserting the empty-state copy strings appear in a specific file) was updated to read app/components/PicksWorkspace.vue instead of app/pages/week/[week].vue, following the copy to its new home after the Task 2 relocation"

requirements-completed: [SCEN-01, SCEN-02, SCEN-03, SCEN-04, SCEN-05]

coverage:
  - id: D1
    description: "useScenarios(2026) is called exactly once, at week/[week].vue's own top level, outside any :key-bound subtree"
    requirement: SCEN-02
    verification:
      - kind: other
        ref: "grep -c 'useScenarios(' app/pages/week/[week].vue -> 1, located outside the PicksWorkspace mount"
        status: pass
    human_judgment: false
  - id: D2
    description: "PicksWorkspace.vue is the sole caller of usePicksStorage/useAutoFilledGames/useStandings; mounted with :key=\"activeScenarioId\" so a scenario switch fully unmounts/remounts it, closing RESEARCH.md's verified Pitfall 1 leak"
    requirement: SCEN-02
    verification:
      - kind: other
        ref: "grep -rn 'usePicksStorage\\|useAutoFilledGames\\|useStandings(' app/ -> only app/components/PicksWorkspace.vue among app/pages and app/components callers; grep ':key=\"activeScenarioId\"' app/pages/week/[week].vue -> present on the PicksWorkspace mount"
        status: pass
    human_judgment: false
  - id: D3
    description: "Switching scenarios is an in-place reactive assignment (activeScenarioId = id), never router.push or a query mutation"
    requirement: SCEN-02
    verification:
      - kind: other
        ref: "grep -n 'route.query.scenario\\|router.push.*scenario' app/pages/week/[week].vue -> no matches"
        status: pass
    human_judgment: false
  - id: D4
    description: "Create/switch/rename/duplicate/delete are all wired end-to-end through real useScenarios() state and the real ScenarioSwitcher/DeleteScenarioModal components"
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "tests/components/ScenarioSwitcher.test.ts, tests/components/DeleteScenarioModal.test.ts, tests/composables/useScenarios.test.ts (component/composable contracts proven in isolation; full-flow browser walkthrough is manual UAT, see Known Gaps below)"
        status: pass
    human_judgment: true
    rationale: "Component-level and composable-level contracts are unit-tested and pass, but the plan's own <human-check> block requires an actual browser walkthrough (pnpm dev) of the 12-step SCEN-01..05 flow, which this executor cannot perform without a live browser tool — not run this session"
  - id: D5
    description: "No account, login, or network request is introduced anywhere in this wiring"
    requirement: SCEN-05
    verification:
      - kind: other
        ref: "git diff --stat package.json pnpm-lock.yaml -> empty; grep -n 'fetch(\\|\\$fetch(' app/components/PicksWorkspace.vue app/pages/week/[week].vue -> no matches outside pre-existing useGames/useTeams calls"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-19
status: complete
---

# Phase 7 Plan 5: Wire useScenarios/ScenarioSwitcher/DeleteScenarioModal and Extract PicksWorkspace.vue Summary

**Extracted `app/components/PicksWorkspace.vue` as the sole owner of `usePicksStorage`/`useAutoFilledGames`/`useStandings`, mounted with `:key="activeScenarioId"` in `week/[week].vue` so every scenario switch fully unmounts and remounts it — closing RESEARCH.md's verified `useStorage` cross-scenario leak (Pitfall 1) and completing SCEN-01 through SCEN-05 end-to-end.**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `useScenarios(2026)` is now called exactly once, at `week/[week].vue`'s own unkeyed top level — the switcher and delete-confirmation flow survive a scenario switch because they never sit inside the `:key`-bound subtree.
- `ScenarioSwitcher`/`DeleteScenarioModal` are wired to real `useScenarios()` state: selecting a row assigns `activeScenarioId` directly (no `router.push`, no query mutation, per D-06/D-09); the switcher's per-row `delete` emit opens the modal with that row's exact name via a `deleteTarget` bridge ref, and `deleteScenario` is only ever called from the modal's `confirm` emit.
- `app/components/PicksWorkspace.vue` is a new component that owns every scenario-scoped composable call (`usePicksStorage`, `useAutoFilledGames`, `useStandings`) plus the entire picks-dependent half of the former page template — Global Progress badge, Fill/Clear Season and Fill/Clear Week controls, the conference-grouped game grid, and the standings sidebar.
- `week/[week].vue` mounts `<PicksWorkspace :key="activeScenarioId" .../>` — when `activeScenarioId` changes, Vue fully tears down and reconstructs the component, giving every scenario-scoped composable a fresh, unshared `useStorage()` instance. This is the exact, previously-reproduced defect (RESEARCH.md Pitfall 1: a reactive key passed into one long-lived `useStorage()` call leaks the prior scenario's object/array state into the new one) closed by construction rather than by a workaround.
- `pnpm typecheck` now exits 0 — this plan closes the 5 pre-existing scenario-scoped call-site errors (`usePicksStorage`/`useAutoFilledGames`/`useStandings`/`PickProgress`/`PickProgressWeek`) that Plans 07-01 through 07-04 left for this plan to resolve, per their own SUMMARY.md notes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire useScenarios(), ScenarioSwitcher, and DeleteScenarioModal at the page's unkeyed top level** — `c117b9f` (feat)
2. **Task 2: Extract PicksWorkspace.vue and mount it keyed on activeScenarioId** — `d84f9b0` (feat)

## Files Created/Modified

- `app/components/PicksWorkspace.vue` — new component; owns `usePicksStorage`/`useAutoFilledGames`/`useStandings`, the bulk-operation handlers (identical bodies, now reading `props.games`/`props.week`), and the picks-dependent template (progress badge, season/week controls, filters, game grid, standings sidebar)
- `app/pages/week/[week].vue` — `useScenarios(2026)` call and delete-confirmation state added at the top level (Task 1); `usePicksStorage`/`useAutoFilledGames`/`useStandings` and the entire two-column template removed, replaced by a single `<PicksWorkspace :key="activeScenarioId" .../>` mount (Task 2); every filter/routing computed (`week`, `teamsById`, `filteredGames`, `conferenceGroups`, `emptyVariant`, `filterLabel`, `loadState`, `conf`, `teamId`, `setConf`, `setTeam`, `goToWeek`) is untouched
- `tests/lib/empty-state.test.ts` — its source-grounding check now reads `app/components/PicksWorkspace.vue` instead of `app/pages/week/[week].vue`, following the empty-state copy to its new location after the Task 2 relocation
- `app/composables/useScenarios.ts` — pre-existing (Plan 07-03) `@stylistic/operator-linebreak` lint error fixed (zero behavior change) so this plan's own required full-repo `pnpm lint` gate passes

## Decisions Made

- `ScenarioSwitcher`/`DeleteScenarioModal` stay in `week/[week].vue`'s own unkeyed template scope, not inside `PicksWorkspace` — Task 1's action text places the switcher inside the same "Season Controls" div as the Fill/Clear Season buttons, but Task 2's action text is explicit that only "the Season Controls Fill/Clear Season buttons" (not the whole row's contents) relocate into `PicksWorkspace`. Task 2 therefore splits that div: the switcher moved to its own small unkeyed div directly under the page's outer wrapper, ahead of the `PicksWorkspace` mount; the Fill/Clear Season buttons moved into `PicksWorkspace`'s own recreated Season Controls div. This is what satisfies the plan's own must-have truth that "the switcher itself must survive a scenario switch to let the user switch again."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing lint error in useScenarios.ts blocked the plan's own full-repo `pnpm lint` gate**
- **Found during:** Task 2 verification (`pnpm lint`)
- **Issue:** `app/composables/useScenarios.ts` (created in Plan 07-03, untouched by this plan's own edits) had two `@stylistic/operator-linebreak` violations (`&&` at end of line instead of start), causing `pnpm lint` to fail across the whole repo. Confirmed pre-existing via `git stash`/re-lint against the commit immediately preceding this plan's Task 2 changes.
- **Fix:** `npx eslint --fix app/composables/useScenarios.ts` — purely stylistic (operator placement), zero behavior change, verified by re-running the full test suite afterward (still 567/567 passing).
- **Files modified:** `app/composables/useScenarios.ts`
- **Verification:** `pnpm lint` exits 0; `pnpm test` unaffected (567/567)
- **Committed in:** `d84f9b0` (Task 2 commit)

**2. [Rule 1 - Bug] tests/lib/empty-state.test.ts's source-grounding check broke after the Task 2 relocation**
- **Found during:** Task 2 verification (`pnpm test`)
- **Issue:** `tests/lib/empty-state.test.ts` reads `app/pages/week/[week].vue`'s raw source and asserts it contains the "No games match this filter" copy string. Task 2's mandated relocation of the empty-state branches into `PicksWorkspace.vue` (an explicit, required action of this plan) made that assertion fail — the copy moved, the test's file target did not.
- **Fix:** Updated the test to read `app/components/PicksWorkspace.vue` instead, following the copy to its new home. No change to the assertions themselves.
- **Files modified:** `tests/lib/empty-state.test.ts`
- **Verification:** `pnpm test` exits 0 (567/567 passing, including both empty-state copy assertions)
- **Committed in:** `d84f9b0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — a pre-existing unrelated lint error and a test whose source-grounding target moved as a direct, foreseeable consequence of this plan's own mandated file extraction)
**Impact on plan:** No scope creep. Both fixes were necessary to satisfy this plan's own stated verification gates (`pnpm lint`, `pnpm test`) and neither touches picks/scenario logic.

## Issues Encountered

None beyond the two auto-fixed items above.

## Verification Results

- `pnpm test` — **567 passed, 0 failed** across 47 files
- `pnpm typecheck` — **0 errors** (closes the 5 pre-existing errors documented in Plans 07-01 through 07-04's SUMMARYs)
- `pnpm lint` — **0 errors**
- `git diff --stat package.json pnpm-lock.yaml` — empty (no packages installed, per the plan's threat model `T-07-SC`)
- `grep -rn 'usePicksStorage\|useAutoFilledGames\|useStandings(' app/` confirms `app/components/PicksWorkspace.vue` is the only caller among page/component files
- `grep -n 'route.query.scenario\|router.push.*scenario'` on `app/pages/week/[week].vue` — no matches (D-06 prohibition holds: `activeScenarioId` is never written to or read from the URL)

## Known Gaps

- **Browser walkthrough not performed.** The plan's `<human-check>` block specifies a 12-step manual walkthrough of the full SCEN-01 through SCEN-05 flow against a running `pnpm dev` instance (creating scenarios, switching, verifying no cross-contamination, rename/duplicate/delete, network-tab check, URL-never-changes check). This executor has no browser/screenshot tool available and did not start a dev server this session. Component-level (`ScenarioSwitcher.test.ts`, `DeleteScenarioModal.test.ts`) and composable-level (`useScenarios.test.ts`) contracts are unit-tested and passing, and the structural wiring (single `useScenarios()` call site, single scenario-scoped composable caller, `:key` binding present, no route.query usage) is grep-verified above — but the live-browser walkthrough itself, including the Pitfall 5 "zero flicker on load" check and the Network-tab zero-requests check, remains open. Consistent with STATE.md's existing Blockers/Concerns note that Phases 4/4.1/5/6 were also marked complete without walking their own UAT files.

## Next Phase Readiness

- Phase 7's entire scope (SCEN-01 through SCEN-05) is now wired end-to-end and passes `pnpm test`/`pnpm typecheck`/`pnpm lint`.
- The manual browser walkthrough above is the one remaining open item before this phase can be considered fully verified — recommend running it (or `/gsd-verify-work`) before starting Phase 8, since Phase 8's share-link work builds directly on the scenario registry this phase introduced.
- No blockers to starting Phase 8.

---
*Phase: 07-named-scenarios*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: app/pages/week/[week].vue
- FOUND: app/components/PicksWorkspace.vue
- FOUND commit: c117b9f
- FOUND commit: d84f9b0
