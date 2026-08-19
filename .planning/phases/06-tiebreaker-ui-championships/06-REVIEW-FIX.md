---
phase: 06-tiebreaker-ui-championships
fixed_at: 2026-08-19T19:14:55Z
review_path: .planning/phases/06-tiebreaker-ui-championships/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-08-19T19:14:55Z
**Source review:** .planning/phases/06-tiebreaker-ui-championships/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: A resolved rank slot's reasoning trace can belong to a different team entirely

**Files modified:** `shared/domain/tiebreakers/engine.ts`, `tests/domain/tiebreakers/n-seed-ranking.test.ts`
**Commit:** 956178d
**Status:** fixed: requires human verification

**Applied fix:** `resolveTiedGroup` no longer threads a single mutable `cycles` accumulator's positional length as the trace boundary (the review's own minimal-diff sketch, verified during this fix, is itself insufficient once a winners bucket needs more than one internal restart — see below). Instead, every `'resolved'` return path now composes its own `trace` LOCALLY and by construction:
- The single-team base case returns `trace: []` (a lone remaining team was never itself separated by a step).
- A step that fully separates one winner from the rest returns `trace: [thisCycle]` (exactly the one decisive cycle, captured before pushing to the shared accumulator).
- A partial separation returns `trace: [thisCycle, ...ownWinnerTrace]`, where `ownWinnerTrace` is `[]` when `winners.length === 1`, or — when `winners.length > 1` and a nested bucket recursion is needed — the bucket recursion's OWN `trace` (which, by induction, already correctly explains only `bucketResult.order[0]`, since the same fix applies at every recursion depth). The "rest" recursion's own trace is never read for this purpose; it explains a *different* team (`restResult.order[0]`), never `orderedWinners[0]`.

**Verification performed (beyond the standard 3-tier check):**
1. Added the review's exact suggested regression assertion to `tests/domain/tiebreakers/n-seed-ranking.test.ts`'s existing 200-generated-season property suite: for every `'tiebreaker'` group, the decisive step's (`trace.at(-1)`'s last separating step) `values` must reference the group's own `teams[0]`.
2. Confirmed the new assertion FAILS against the pre-fix `engine.ts` (via `git stash` isolation) — 300+ violations across both the fully-picked and partial-slate suites, e.g. `"SEC group 9: decisive step 'common-opponents' values [Auburn, Missouri] do not reference this group's own team Kentucky"`.
3. My first fix attempt (a straight `cycles.length` snapshot/slice, matching the review's literal minimal-diff sketch) reduced but did NOT eliminate the violations — it breaks specifically when a multi-team winners bucket itself needs more than one restart to fully order its own members (confirmed via a hand-built debug script against the real generated slate: Baylor's Big 12 group was picking up two unrelated cycles that actually explained Arizona State/Cincinnati's mutual order, not Baylor's). Redesigned to the local-composition approach described above, which is correct by construction at every recursion depth (not just one level).
4. Re-ran the property suite: 0 violations across all 200 generated seasons.
5. Ran the full suite (`pnpm test` / `vitest run`): 521 tests passed (later 525 after subsequent fixes' own new tests).
6. Ran `pnpm typecheck` (`nuxt typecheck`) and `pnpm lint` (`eslint .`): both clean.

Flagged for human verification per this fixer's own policy: CR-01 is a logic-correctness fix to the core tiebreaker engine (PROJECT.md's stated highest-risk area). Despite the property-based verification above, a human should confirm the composed-trace semantics against a real rendered "Decided at" panel for at least one genuinely multi-restart Big 12/SEC/Big Ten scenario before this phase is considered fully verified.

### CR-02: D-17 manual-ordering local state is never reset when the tied group's composition changes

**Files modified:** `app/components/TiebreakerReasoning.vue`, `tests/components/TiebreakerReasoning.test.ts`
**Commit:** 0aa4c56
**Status:** fixed: requires human verification

**Applied fix:** Added a `watch(() => props.group.teams, ...)` that resets `assignedIds.value = []` whenever the group's membership actually changes (different length, or any differing id at the same position) — the exact watcher the review suggested. Left `StandingsTable.vue`'s `:key` binding untouched, since the review notes the watcher alone is sufficient (the `:key`-based alternative would additionally fix WR-02's disclosure-state issue, which was fixed separately and more directly below).

**Verification performed:** Added two new tests under a `CR-02` describe block reproducing the exact scenario (same component instance across a `setProps` that changes `group.teams` while the instance persists, mirroring `StandingsTable.vue`'s unkeyed-by-membership `v-for`). Confirmed the first test FAILS against the pre-fix component (stale "Duke" assignment survives a switch to an entirely different tied group) and PASSES post-fix; confirmed the second test (equal-membership prop replacement must NOT discard in-progress assignment) passes both before and after. Full component test file: 33/33 passing.

### WR-01: The Big 12's `total-wins` step renders a fabricated "0 losses" and a nonsensical win-percentage in the reasoning panel

**Files modified:** `app/components/TiebreakerReasoning.vue`, `tests/components/TiebreakerReasoning.test.ts`
**Commit:** db8afb0
**Status:** fixed

**Applied fix:** `stepValueText` now takes the step id as a second parameter and special-cases `'total-wins'` records as `` `${wins} total win(s)` `` instead of routing them through the generic `wins-losses (winPct)` formatter. Both template call sites (the full-procedure loop and the "Decided at" panel) now pass their step id through.

**Verification performed:** Added a test asserting a `total-wins` decisive step renders `"9 total wins"` and never `"9-0"` or `"9.000"`. Confirmed it fails pre-fix (`"9-0 (9.000)"`) and passes post-fix.

### WR-02: `expandedGroups` disclosure state is keyed by array position, not by group identity

**Files modified:** `app/components/StandingsTable.vue`, `tests/components/StandingsTable.test.ts`
**Commit:** 7d75906
**Status:** fixed: requires human verification

**Applied fix:** Added `groupKeyFor(group)` (sorted team ids joined by `-`) as a stable identity for a `RankGroup`. `RowMeta` now carries a `groupKey`, and `expandedGroups`/`isExpanded`/`toggleGroup`/`reasoningPanelId` all key off that string instead of the raw `ranking.groups` array index.

**Verification performed:** Added a test that expands a group, then reorders `ranking.groups` via `setProps` (swapping which array index each group occupies, standings row order unchanged) and confirms the ORIGINAL group (now at a different index) stays expanded while the group that moved INTO the old index stays collapsed. Confirmed it fails pre-fix (disclosure state stuck to the array index, showing the wrong group's reasoning panel) and passes post-fix. Full component test file: 17/17 passing.

### WR-03: `useStandings`'s prune `watchEffect` implicitly depends on the storage ref it writes, causing a redundant extra run

**Files modified:** `app/composables/useStandings.ts`
**Commit:** 45ceb33
**Status:** fixed

**Applied fix:** Replaced the bare `watchEffect(() => {...})` with an explicit-source `watch([rawRankings, slateComplete], ([raw, complete]) => {...}, { immediate: true })`. An explicit-source `watch` only tracks its source getters as dependencies; reads/writes that happen inside the callback body (including `pruneStale`'s own `decisions.value` read-then-write) no longer register as a dependency of this same effect, eliminating the self-triggering redundant second run the review described.

**Verification performed:** Did not add a dedicated call-count regression test — `pruneStale`'s reference is internal to `useManualTiebreakers()`'s closure and not interceptable from the existing test surface without either a broad module mock (which would have masked real prune/write behavior in the same test file) or a source change purely for testability. Instead relied on: (1) this is a well-established, provably-correct Vue reactivity pattern (explicit `watch` sources vs. implicit `watchEffect` tracking), (2) the full `tests/composables/useStandings.test.ts` suite (7 tests, including the exact suspend/resume/prune lifecycle scenarios this effect drives) passes unchanged, and (3) the full project suite (525 tests), `nuxt typecheck`, and `eslint .` all pass clean.

## Skipped Issues

None — all 5 in-scope findings (CR-01, CR-02, WR-01, WR-02, WR-03) were fixed.

---

_Fixed: 2026-08-19T19:14:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
