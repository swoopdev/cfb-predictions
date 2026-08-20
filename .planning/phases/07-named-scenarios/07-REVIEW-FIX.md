---
phase: 07-named-scenarios
fixed_at: 2026-08-19T23:31:00Z
review_path: .planning/phases/07-named-scenarios/07-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-08-19T23:31:00Z
**Source review:** .planning/phases/07-named-scenarios/07-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 1 (fix_scope: critical_warning — WR-01; IN-01 through IN-04 excluded, no Critical findings this round)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: `createScenario`'s default name can collide with an existing scenario's name after a delete-then-create cycle

**Files modified:** `app/composables/useScenarios.ts`
**Commit:** `b394e7e`
**Applied fix:** Added a `nextDefaultScenarioName()` helper that derives the next default name by scanning the registry for the highest `N` already used by any entry matching `/^Scenario (\d+)$/`, and returning `Scenario ${highest + 1}`. `createScenario`'s default-name branch now calls this helper instead of computing `` `Scenario ${registry.value.length + 1}` `` from the registry's current length. Since the registry's length shrinks on delete but the highest-used `N` scanned from existing names never decreases, a delete-then-create cycle can no longer reuse a number already held by a surviving scenario. Verified by tracing the review's reproduction case against the new logic: `["Scenario 1"]` → create → `"Scenario 2"` (highest 1 → 2); delete `"Scenario 1"` → registry `["Scenario 2"]`; create → highest scanned is 2 → `"Scenario 3"` (no collision, versus the old code's `"Scenario 2"` collision). The registry's UUID `id` (never `name`) remains the sole identity used for storage keys and routing, so this is purely a display-label fix with no data-model impact. `npx tsc --noEmit` reports no errors in the modified file (pre-existing project errors elsewhere, if any, are unrelated and unaffected).

## Skipped Issues

None — the single in-scope finding (WR-01) was fixed. IN-01 through IN-04 were out of scope for this run (`fix_scope: critical_warning`); see `07-REVIEW.md` for details on those Info-level items if a future run with `fix_scope: all` is requested.

---

_Fixed: 2026-08-19T23:31:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
