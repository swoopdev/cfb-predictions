---
phase: 07
slug: named-scenarios
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-19
task_map_filled: 2026-08-19
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.10` [VERIFIED: package.json], `happy-dom` `20.11.2` environment |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/composables/usePicksStorage.test.ts tests/composables/useAutoFilledGames.test.ts tests/composables/useManualTiebreakers.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

> Filled in by the planner 2026-08-19 against the five plans in this directory. Threat Ref IDs below
> are the planner's actual STRIDE register (T-07-01 through T-07-07, T-07-SC), which supersedes the
> placeholder T-07-01/02/03 guesses this table originally shipped with — RESEARCH.md's Known Threat
> Patterns table carried no ID column, so those were provisional pending the real plan set.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SCEN-01 | T-07-05, T-07-SC | `usePicksStorage` scoped by `(scenarioId, season)`; two scenario ids under the same season proven independent | unit | `npx vitest run tests/composables/usePicksStorage.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-01-02 | 01 | 1 | SCEN-01 | T-07-05, T-07-SC | `useAutoFilledGames` scoped by `(scenarioId, season)`; independence proven | unit | `npx vitest run tests/composables/useAutoFilledGames.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-01-03 | 01 | 1 | SCEN-01 | T-07-05, T-07-SC | `useManualTiebreakers` scoped by `(scenarioId, season)`; independence proven | unit | `npx vitest run tests/composables/useManualTiebreakers.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-02-01 | 02 | 2 | SCEN-01 | T-07-05, T-07-SC | `usePickProgress` threads `scenarioId` into `usePicksStorage` only, never into `useGames` | unit | `npx vitest run tests/composables/usePickProgress.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-02-02 | 02 | 2 | SCEN-01, SCEN-02 | T-07-05, T-07-SC | `useStandings` threads `scenarioId` into both `usePicksStorage` AND `useManualTiebreakers` | unit | `npx vitest run tests/composables/useStandings.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-02-03 | 02 | 2 | SCEN-01, SCEN-02 | T-07-05, T-07-SC | `PickProgress`/`PickProgressWeek` require a `scenarioId` prop, threaded through unchanged | component | `npx vitest run tests/components/PickProgress.test.ts tests/components/PickProgressWeek.test.ts` | ✅ exists, extended | ⬜ pending |
| 07-03-01 | 03 | 2 | SCEN-01 | T-07-01, T-07-02, T-07-03, T-07-SC | Registry/active-pointer self-heal from corruption, a dangling pointer, and an empty array before `useScenarios` ever returns | unit | `npx vitest run tests/composables/useScenarios.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | SCEN-01, SCEN-02, SCEN-03, SCEN-04 | T-07-SC | D-03 migration runs exactly once, legacy keys untouched; create/rename/duplicate/delete correct, including the non-active-source duplicate (Pattern 2) and the D-14/D-16 delete guard/fallback | unit | `npx vitest run tests/composables/useScenarios.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | SCEN-02, SCEN-03, SCEN-04 | T-07-06, T-07-07, T-07-SC | `ScenarioSwitcher`'s switch/rename/duplicate/delete/create emits are correct and mutually independent (the `@click.stop` regression case) | component | `npx vitest run tests/components/ScenarioSwitcher.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-02 | 04 | 2 | SCEN-03 | T-07-06, T-07-07, T-07-SC | `DeleteScenarioModal` never emits `confirm` without an explicit click; title/body copy match 07-UI-SPEC.md verbatim | component | `npx vitest run tests/components/DeleteScenarioModal.test.ts` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 3 | SCEN-01, SCEN-02, SCEN-03, SCEN-04, SCEN-05 | T-07-07, T-07-SC | `useScenarios()` mounted unkeyed; a delete request only opens the confirmation modal, `deleteScenario` fires solely from its `confirm` emit | integration (typecheck) | `pnpm typecheck` | N/A — wiring task, no dedicated test file | ⬜ pending |
| 07-05-02 | 05 | 3 | SCEN-01, SCEN-02, SCEN-05 | T-07-04, T-07-SC | `PicksWorkspace` extraction + `:key="activeScenarioId"` remount boundary closes RESEARCH.md's verified Pitfall 1 leak in the running app | integration | `pnpm test && pnpm typecheck && pnpm lint` | ⚠️ page-level wiring stays deliberately uncovered by a dedicated automated test (see Manual-Only Verifications — same precedent as Phase 5/6's page-level gap) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Sampling continuity check

No three consecutive tasks lack an automated verify — all 12 tasks carry an `<automated>` command (`07-05-01`'s is `pnpm typecheck`, since no dedicated test file exists for pure prop/handler wiring with no new logic). The composable-level quick command (`npx vitest run tests/composables/`) stays sub-15-second per the Sampling Rate above.

### Wave-0 gap closure model

This phase closes its Wave-0 gaps inside the plan that creates the file, test-first where the file is new: `useScenarios.test.ts` is authored across 07-03-01/02 alongside the composable itself; `ScenarioSwitcher.test.ts`/`DeleteScenarioModal.test.ts` are authored across 07-04-01/02 the same way. No separate scaffolding-only plan exists — this phase is small enough (5 plans) that a dedicated Wave 0 plan would be pure overhead.

---

## Wave 0 Requirements

- [x] `tests/composables/useScenarios.test.ts` — owned by Plan 03 (Tasks 07-03-01/02). Covers SCEN-01 through SCEN-04, migration (D-03), corruption recovery (D-17), dangling-pointer fallback (D-05), delete guard (D-14), delete fallback (D-16), and the non-active-source duplicate case (Pattern 2). The composable-level Pitfall 1 regression (two scenario ids under the same season stay independent) is covered per-composable in Plan 01's three test files rather than in this file, since `useScenarios.ts` itself never mounts a live storage composable (Pattern 2 — raw localStorage only).
- [x] `tests/components/ScenarioSwitcher.test.ts` — owned by Plan 04 (Task 07-04-01). Covers the `USelectMenu` wrapper's row-action event wiring and the `@click.stop` non-interference assertion.
- [x] `tests/components/DeleteScenarioModal.test.ts` — owned by Plan 04 (Task 07-04-02). Covers the `UModal` wrapper's confirm/cancel behavior.
- [x] Existing 7 test files (`usePicksStorage.test.ts`, `useAutoFilledGames.test.ts`, `useManualTiebreakers.test.ts`, `usePickProgress.test.ts`, `useStandings.test.ts`, `PickProgress.test.ts`, `PickProgressWeek.test.ts`) — owned by Plans 01/02 (Tasks 07-01-01..03, 07-02-01..03). Every call site updated for the new `(scenarioId, season)` signature.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero network/auth calls anywhere in the scenario create/switch/rename/delete/duplicate flow | SCEN-05 | Negative assertion generalizing FOUND-03's existing "zero network fetches" manual check; no new automated harness exists for network-call assertion in this codebase | Open devtools Network tab, exercise all five scenario actions, confirm no requests fire |
| Full page-level flow: create → pick → switch → confirm no leakage → switch back → rename → duplicate → delete (active and non-active) → last-scenario delete guard | SCEN-01 through SCEN-04 | Page-level integration (`week/[week].vue` + `PicksWorkspace.vue`) is deliberately uncovered by a dedicated automated test, same precedent as Phase 5/6's `tests/pages/week.test.ts` gap (STATE.md) — no Nuxt-environment vitest project exists in this codebase | See Plan 07-05's `<verification>` `<human-check>` block — the 12-step walkthrough is the canonical script for this item |
| `:key="activeScenarioId"` remount boundary actually prevents cross-scenario leakage in the real DOM (not just at the composable level) | SCEN-02, T-07-04 | The composable-level independence proof (Plan 01) does not exercise Vue's component lifecycle; only a live browser confirms the remount itself behaves as designed | Plan 07-05's `<human-check>` steps 2-5 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 12 of 12 tasks carry an `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — `useScenarios.test.ts`, `ScenarioSwitcher.test.ts`, `DeleteScenarioModal.test.ts` are each authored inside the plan that creates their subject file
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution (planner, 2026-08-19)
