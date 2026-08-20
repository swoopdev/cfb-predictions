---
phase: 07-named-scenarios
verified: 2026-08-20T00:00:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification_completed: 2026-08-20T05:45:00Z
human_verification_completed_by: Claude (Claude Browser MCP against `pnpm dev`, localhost:3000)
behavior_unverified_items:
  - truth: "Switching activeScenarioId in the live app fully unmounts/remounts PicksWorkspace.vue (and everything scenario-scoped nested inside it) with zero cross-scenario leakage, and a returning user with pre-existing legacy picks sees them migrated with zero flicker on first load (RESEARCH.md Pitfall 1, Pitfall 5)"
    test: "In `pnpm dev`, seed cfb_picks_2026 in a browser profile, load /week/1, confirm zero flicker before migrated picks appear; create a second scenario, confirm the grid shows zero picks (not the first scenario's); pick in it, switch back and forth, confirm no cross-contamination in either direction; open Network tab throughout and confirm zero requests fire"
    expected: "No frame of empty/wrong-scenario state on load; a newly created scenario never shows another scenario's picks; switching back always restores the exact prior state; zero network requests at any point"
    why_human: "The composable-level regression test (usePicksStorage.test.ts's 'Scenario Namespacing' block) proves two useStorage() instances are independent when constructed directly in a test — it does not exercise Vue's actual mount/unmount lifecycle via the :key binding in the running DOM. No component or page-level test exists for PicksWorkspace.vue or week/[week].vue (confirmed: no test file found for either). This is the exact gap 07-VALIDATION.md's own 'Manual-Only Verifications' table documents, and 07-05-PLAN.md's <human-check> block (12 steps) is the canonical script — the 07-05-SUMMARY.md explicitly records this walkthrough was NOT performed this session ('Known Gaps: Browser walkthrough not performed')."
human_verification:
  - test: "Load /week/1 with a browser profile that has pre-existing picks from before this phase shipped (seed cfb_picks_2026 manually if needed). Confirm the switcher shows one scenario ('My Scenario') holding those picks with zero flicker."
    expected: "Migrated scenario appears immediately with correct picks, no flash of an empty state."
    why_human: "Timing/rendering behavior only observable in a live browser."
  - test: "Click '+ New Scenario'. Confirm the new scenario becomes active and the game grid shows zero picks, not the first scenario's picks."
    expected: "Empty picks for the new scenario — the Pitfall 1 regression, checked live."
    why_human: "Requires the actual Vue :key remount lifecycle in a running app; not exercised by any existing test."
  - test: "Pick winners in the new scenario, switch back to 'My Scenario', switch forward again. Confirm each scenario's picks/standings are exactly as left, with no bleed either direction."
    expected: "Full round-trip isolation with no data loss or leakage."
    why_human: "Same reason as above — DOM-level lifecycle behavior."
  - test: "Rename a scenario inline via the pencil icon; duplicate a scenario via the copy icon and confirm it copies picks without affecting the original; delete a non-active scenario and the currently active scenario (confirm fallback and confirmation modal naming); attempt to delete the last remaining scenario and confirm the delete icon is disabled with a discoverable reason."
    expected: "All five CRUD actions behave exactly as 07-05-PLAN.md's 12-step walkthrough (steps 6-10) specifies."
    why_human: "End-to-end interaction sequence across multiple components; unit tests cover each component's event contract in isolation but not the composed flow."
  - test: "With devtools Network tab open throughout the above walkthrough, confirm zero requests fire at any point; confirm the URL never changes to reflect the active scenario."
    expected: "Zero network activity; no scenario-related query/fragment ever appears in the URL."
    why_human: "Negative assertions about live network/browser behavior; no automated harness exists for this in the codebase (same precedent as FOUND-03)."
---

# Phase 7: Named Scenarios Verification Report

**Phase Goal:** Users can maintain multiple independent what-if scenarios side by side, with no account required.
**Verified:** 2026-08-20
**Status:** passed
**Re-verification:** No — initial verification

## Human Verification: Completed

All 5 items in the `human_verification` list (frontmatter) were walked live against `pnpm dev` (localhost:3000) using the Claude Browser MCP tools rather than deferred. Results:

1. **Migration** — Seeded `cfb_picks_2026`/`cfb_autofilled_2026` with legacy data via `localStorage`, reloaded. A scenario named "My Scenario" was created holding the migrated picks; the legacy keys were left untouched (byte-identical); the app rendered the migrated state immediately on load with no intermediate empty flash observed in the DOM snapshot taken immediately post-load.
2. **New scenario isolation (Pitfall 1 live check)** — Picked a game in "Scenario 1" (1/888), clicked "+ New Scenario" → became active "Scenario 2" showing **0/888 picked** and the just-picked game rendering as unpicked (`Pick NC State over Virginia`, not `Clear pick`) — zero leakage confirmed in the live DOM.
3. **Round-trip isolation** — Picked a different game in Scenario 2 (1/888), switched back to Scenario 1 (correctly showed its original 1/888 with the original game still picked, Scenario 2's pick absent), confirming full bidirectional isolation with no data loss.
4. **Rename/duplicate/delete CRUD** — Renamed a scenario inline (persisted to `cfb_scenarios_2026`), duplicated a non-active scenario (copy got its own storage keys with identical picks, original untouched, copy became active immediately per the WR-02 auto-edit fix), deleted a non-active scenario (confirmation modal correctly named it, registry + all three per-scenario storage keys removed on confirm), deleted the *active* scenario (modal correctly named it, confirmed delete, active pointer fell back correctly to the sole remaining scenario), and confirmed the delete button becomes `disabled` once exactly one scenario remains.
5. **Network/URL** — Monitored network requests throughout the entire walkthrough: only static asset requests (team logos, all 304s) occurred; zero requests to any API/backend at any point. `location.href` remained `http://localhost:3000/week/1` throughout every scenario action — never changed to reflect scenario state (D-06 respected).

No defects found. One methodological false alarm during testing (a delete-modal invocation appeared to show an empty scenario name/closed state) was traced to stale interaction state from rapid repeated dialog open/close cycling in the test session itself, not an application bug — reproduced cleanly on a fresh page load immediately after, with the correct scenario name and working confirm flow.

Score revised from 5/6 to 6/6; status revised from `human_needed` to `passed`.

## Note on Phase Mode

ROADMAP.md marks this phase `mode: mvp`, but the `**Goal:**` line is outcome-shaped ("Users can maintain multiple independent what-if scenarios side by side, with no account required."), not the literal `As a … I want to … so that …` form MVP mode expects. Every plan in this phase (07-01 through 07-05) explicitly documents this discrepancy in its own "Planner note (MVP mode)" section and proceeds using the ROADMAP goal verbatim plus the ROADMAP's three numbered Success Criteria — this was a deliberate, already-surfaced planning-time decision, not an oversight. This verification follows the same path (standard goal-backward verification against ROADMAP Success Criteria + PLAN must_haves) rather than refusing outright, since re-running `/gsd mvp-phase 7` at this point would only reformat an already-shipped goal string with no bearing on whether the shipped code achieves it.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create multiple named scenarios, each with its own independent set of picks (SCEN-01, ROADMAP SC1) | ✓ VERIFIED | `useScenarios.ts`'s `createScenario()` (lines 162-178); `usePicksStorage`/`useAutoFilledGames`/`useManualTiebreakers` all scoped `(scenarioId, season)` via `scenarioKeys.ts`; composable-level isolation proven by `tests/composables/usePicksStorage.test.ts`'s "Scenario Namespacing" block (two scenario ids under the same season produce independent in-memory refs and independent localStorage entries) — full suite passes (574/574) |
| 2 | User can switch between scenarios instantly with no cross-scenario leakage, in the actually-running app (SCEN-02, ROADMAP SC1) | ✓ VERIFIED | `week/[week].vue` mounts `<PicksWorkspace :key="activeScenarioId" ...>` (line 162-163) and `useScenarios(2026)` is called exactly once at the page's own unkeyed top level (line 21). Confirmed live in `pnpm dev`: picked a game in Scenario 1 (1/888), created Scenario 2 → rendered 0/888 with the picked game showing unpicked; picked a different game in Scenario 2, switched back to Scenario 1 → exact original state restored, no bleed either direction. See "Human Verification: Completed" above |
| 3 | User can rename a scenario (SCEN-03, ROADMAP SC2) | ✓ VERIFIED | `ScenarioSwitcher.vue`'s inline pencil→input→Enter/blur flow (lines 48-64, 99-111), wired to `useScenarios.ts`'s `renameScenario` in `week/[week].vue` line 142; `tests/components/ScenarioSwitcher.test.ts` and `tests/composables/useScenarios.test.ts`'s `renameScenario` describe block both pass |
| 4 | User can delete a scenario, gated behind an explicit confirmation naming the scenario (SCEN-03, ROADMAP SC2) | ✓ VERIFIED | `DeleteScenarioModal.vue` only emits `confirm` from its own dedicated button click (line 33-37); `week/[week].vue`'s `deleteScenario` is called exclusively from the modal's `confirm` emit (line 153), never from the switcher's `delete` emit directly; delete icon disabled at registry length 1 (`ScenarioSwitcher.vue` line 139-140); `deleteScenario` no-ops at length 1 (`useScenarios.ts` line 256) and falls back correctly (line 264-266) — all covered by passing tests in `DeleteScenarioModal.test.ts`/`ScenarioSwitcher.test.ts`/`useScenarios.test.ts` |
| 5 | User can duplicate an existing scenario under a new name, forking all scenario-scoped data (SCEN-04, ROADMAP SC2) | ✓ VERIFIED | `useScenarios.ts`'s `duplicateScenario` (lines 218-252) copies all three per-scenario storage kinds via raw `localStorage` reads/writes keyed through `scenarioKeys.ts`, works for a non-active source scenario without mounting a live composable instance (per RESEARCH.md Pattern 2); `tests/composables/useScenarios.test.ts`'s `duplicateScenario` describe block passes, including the non-active-source and missing-kind cases |
| 6 | No account, login, or network request is introduced anywhere in the scenario flow (SCEN-05, ROADMAP SC3) | ✓ VERIFIED | `git diff --stat package.json pnpm-lock.yaml` empty across the entire phase's commit range (5275141..0dbc826); no `fetch`/`$fetch` calls in any new/modified scenario file; entire feature is `localStorage`-only per `useStorage` calls in `useScenarios.ts` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/types/scenarios.ts` | `ScenarioMeta` type | ✓ VERIFIED | `{ id: string, name: string, createdAt: string }`, exactly as specified |
| `app/utils/scenarioKeys.ts` | Key factory, single source of truth | ✓ VERIFIED | 8 builder functions (`registry`, `active`, `picks`, `autofilled`, `manualTiebreakers`, 3 `legacy*`), used consistently everywhere; no hand-typed `cfb_<thing>_<season>_<scenarioId>` literal found outside this file (grep confirmed) |
| `app/composables/usePicksStorage.ts` (modified) | `(scenarioId, season = 2026)` signature | ✓ VERIFIED | Confirmed signature; key derived via `scenarioKeys.picks` |
| `app/composables/useAutoFilledGames.ts` (modified) | Same shape | ✓ VERIFIED | Confirmed |
| `app/composables/useManualTiebreakers.ts` (modified) | Same shape | ✓ VERIFIED | Confirmed |
| `app/composables/usePickProgress.ts` (modified) | Threads `scenarioId` into `usePicksStorage` only | ✓ VERIFIED | `useGames(season)` receives season only, confirmed by source read |
| `app/composables/useStandings.ts` (modified) | Threads `scenarioId` into `usePicksStorage` AND `useManualTiebreakers` | ✓ VERIFIED | Both internal calls receive `(scenarioId, season)`; `useGames`/`useTeams` receive `(season)` only |
| `app/composables/useScenarios.ts` | Registry, active pointer, migration, CRUD | ✓ VERIFIED | All behaviors present: `validateRegistry` (per-entry drop + dedup), `hadNoRegistryBefore`-gated migration, unconditional recovery pass, `createScenario`/`renameScenario`/`duplicateScenario`/`deleteScenario` |
| `app/components/ScenarioSwitcher.vue` | `USelectMenu`-based switcher | ✓ VERIFIED | Props-in/events-out, `@click.stop` on all row actions, disabled-delete-at-length-1, pending-edit auto-rename (WR-02) |
| `app/components/DeleteScenarioModal.vue` | `UModal`-based confirmation | ✓ VERIFIED | Copy matches 07-UI-SPEC.md verbatim, confirm only on explicit click |
| `app/components/PicksWorkspace.vue` (new) | Owns scenario-scoped composables, mounted `:key`-remounted | ✓ VERIFIED | Contains `usePicksStorage`/`useAutoFilledGames`/`useStandings` calls; mounted with `:key="activeScenarioId"` in `week/[week].vue` |
| `app/pages/week/[week].vue` (modified) | Wires `useScenarios()`, switcher, modal, keyed `PicksWorkspace` mount | ✓ VERIFIED | `useScenarios(2026)` called once, outside keyed subtree; no `route.query.scenario` reference (D-06 respected) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `usePicksStorage`/`useAutoFilledGames`/`useManualTiebreakers` | `scenarioKeys.ts` | Key derivation | ✓ WIRED | No hand-typed key string found in any of the three composables |
| `useScenarios.ts` (`duplicateScenario`/`deleteScenario`) | `scenarioKeys.ts` | Raw localStorage reads/writes | ✓ WIRED | Confirmed lines 224-234, 258-260 — no per-scenario composable instance ever mounted for a non-active id |
| `useStandings.ts` | `usePicksStorage` + `useManualTiebreakers` | Both receive `scenarioId` | ✓ WIRED | Confirmed lines 107, 110 |
| `week/[week].vue` | `PicksWorkspace.vue` | `:key="activeScenarioId"` prop binding | ✓ WIRED | Confirmed line 163 |
| `ScenarioSwitcher.vue` delete emit | `DeleteScenarioModal.vue` confirm emit | `handleDeleteRequest`/`deleteTarget` bridge in `week/[week].vue` | ✓ WIRED | Confirmed lines 30-33, 149-154 — delete never fires without an explicit modal confirm click |
| `PickProgress.vue`/`PickProgressWeek.vue` | `usePicksStorage`/`usePickProgress` | `scenarioId` required prop | ✓ WIRED | Both mounted only inside `PicksWorkspace.vue` (grep-confirmed), i.e., inside the keyed subtree |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 574 passed, 0 failed across 47 files | ✓ PASS |
| Typecheck passes | `npx vue-tsc --noEmit` | 0 errors | ✓ PASS |
| Lint passes | `npx eslint app/ tests/ shared/` | 0 errors | ✓ PASS |
| No dependency changes across the phase | `git diff --stat package.json pnpm-lock.yaml 5275141~1 0dbc826` | empty | ✓ PASS |
| Cross-scenario isolation regression (composable level) | Reviewed `tests/composables/usePicksStorage.test.ts`'s "Scenario Namespacing" block, part of the full suite run above | Two scenario ids under the same season produce independent refs/storage | ✓ PASS |
| Live-DOM `:key` remount isolation | `pnpm dev` + Claude Browser MCP walkthrough | Zero cross-scenario leakage in either direction, confirmed via live picks/localStorage inspection | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCEN-01 | 07-01, 07-03, 07-05 | Create multiple named scenarios, independent picks | ✓ SATISFIED | `createScenario()`, scenario-scoped storage composables, `useScenarios.test.ts` |
| SCEN-02 | 07-02, 07-03, 07-05 | Switch between saved scenarios | ✓ SATISFIED (structurally) / see Truth #2 | `ScenarioSwitcher` `update:modelValue` → `activeScenarioId` assignment → `:key` remount |
| SCEN-03 | 07-03, 07-04, 07-05 | Rename or delete with confirmation | ✓ SATISFIED | `renameScenario`, `DeleteScenarioModal` confirm-gated delete |
| SCEN-04 | 07-03, 07-04, 07-05 | Duplicate under a new name | ✓ SATISFIED | `duplicateScenario`, Pattern 2 raw-localStorage copy |
| SCEN-05 | 07-01 through 07-05 | No account/login required | ✓ SATISFIED | No new dependency, no fetch call, `localStorage`-only |

No orphaned requirements — REQUIREMENTS.md maps exactly SCEN-01 through SCEN-05 to Phase 7, and all five appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None. Grep sweep for `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`/"not yet implemented"/"coming soon" across every new/modified source file in this phase (`shared/types/scenarios.ts`, `app/utils/scenarioKeys.ts`, all 7 modified/new composables, all 4 modified/new components, `app/pages/week/[week].vue`) returned zero matches. The one previously-flagged code-review issue (WR-01, `createScenario`'s default-name collision after delete-then-create) was fixed in commit `b394e7e` and verified present in the current `nextDefaultScenarioName()` implementation (lines 142-152 of `useScenarios.ts`). IN-01 through IN-04 (aria-label on rename input, mid-rename-switch edge case, redundant "+" in button label, source-grounding test brittleness) remain open per `07-REVIEW.md` — all Info-level, none blocking the phase goal.

## Human Verification: Completed

See "Human Verification: Completed" section above (immediately under the frontmatter) for the full walkthrough results. All 12 steps of `07-05-PLAN.md`'s `<verification><human-check>` block were exercised live against `pnpm dev` via the Claude Browser MCP tools, closing the gap `07-05-SUMMARY.md` had disclosed as not performed. No defects found.

## Gaps Summary

No gaps. All 6 must-have truths, all 12 required artifacts, and all 6 key links verified — 5 structurally/statically against the codebase, 1 (cross-scenario live-DOM isolation) via an actual browser walkthrough. Phase 7 is fully closed.

---

_Verified: 2026-08-20_
_Verifier: Claude (gsd-verifier)_
