---
phase: 6
slug: tiebreaker-ui-championships
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
task_map_filled: 2026-08-17
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `06-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map
> is filled in by the planner once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 + @vue/test-utils 2.4.11 |
| **Config file** | `vitest.config.ts` (single project, `happy-dom` global, no Nuxt plugin) |
| **Quick run command** | `pnpm exec vitest run tests/domain/` |
| **Full suite command** | `pnpm test` (= `vitest run`) |
| **Estimated runtime** | sub-second for `tests/domain/`; full suite seconds |

**Coverage gates:** `shared/domain/tiebreakers/**` 90% all metrics; `shared/domain/standings/**` 85%.

**Pre-existing gate debt (close in this phase):** `shared/domain/tiebreakers/**` currently sits at
**87.87% branches against a 90% threshold** and has been failing since before Phase 5. It is not in
any gate the project actually runs (`pnpm test` has no `--coverage`). This phase touches that exact
directory heavily, and `deferred-items.md` explicitly assigns the debt to "whoever next works in
`shared/domain/tiebreakers/`."

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run tests/domain/` — pure logic, sub-second
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** `pnpm test` green **and** `pnpm exec vitest run --coverage` meeting
  both directory thresholds (including the 87.87% → 90% branch gap) **and** `pnpm lint` **and** `pnpm typecheck`
- **Max feedback latency:** < 5 seconds for the per-task quick run

---

## Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | Exists? |
|---|---|---|---|---|
| TIE-08 | N-seed loop assigns every team a rank; no team unplaced, no duplicate ranks | unit | `vitest run tests/domain/tiebreakers/n-seed-ranking.test.ts` | ❌ Wave 0 |
| TIE-08 | Loop never trips a recursion guard over 100 generated seasons (Pitfall 2) | property | `vitest run tests/domain/tiebreakers/n-seed-decision-rate.test.ts` | ❌ Wave 0 |
| TIE-08 | No rank decided by team id — every `resolvedBy:'tiebreaker'` group's `contestedWith` was separated by a real step (Pitfall 1) | property | same file | ❌ Wave 0 |
| TIE-08 | Unresolvable groups share a rank; `isTied` true exactly when `teams.length > 1` | unit | `vitest run tests/domain/standings/computeStandings.test.ts` | ⚠️ exists, must be rewritten for D-01 |
| TIE-08 | D-07 predicate: true iff every conference game picked; unaffected by non-conference picks | unit | `vitest run tests/domain/standings/slateCompletion.test.ts` | ❌ Wave 0 |
| TIE-05 | Each group's trace contains only its own teams (Pitfall 5) | unit | `vitest run tests/domain/tiebreakers/trace-isolation.test.ts` | ❌ Wave 0 |
| TIE-05 | Decisive step = last separating StepOutcome; full trace reachable | unit | same file | ❌ Wave 0 |
| TIE-05 | Expanded group renders tied group, step, per-team values, restart events | component | `vitest run tests/components/TiebreakerReasoning.test.ts` | ❌ Wave 0 |
| TIE-06 | Hash changes when membership / terminal step / any value changes; stable otherwise | unit | `vitest run tests/domain/tiebreakers/invalidation.test.ts` | ❌ Wave 0 |
| TIE-06 | Stored decision whose id set differs from live group is dropped, not applied (Pitfall 8) | unit | `vitest run tests/composables/useManualTiebreakers.test.ts` | ❌ Wave 0 |
| TIE-06 | D-09: decisions discarded when the slate stops being complete | unit | same file | ❌ Wave 0 |
| TIE-07 | Card reads `groups[0]`/`groups[1]`, never row order (D-12) | component | `vitest run tests/components/ChampionshipCard.test.ts` | ❌ Wave 0 |
| TIE-07 | Resolved seed named even when the other is pending (D-13) | component | same file | ❌ Wave 0 |
| TIE-07 | One pending presentation regardless of `TerminalReason` (D-14) | component | same file | ❌ Wave 0 |
| D-10 | Marker (a) on tiebreaker-decided ranks; marker (b) on shared ranks; both distinguishable | component | `vitest run tests/components/StandingsTable.test.ts` | ⚠️ exists, extend |
| D-11 | Zero team-color classes in either marker | unit (assertion) | same file | ❌ Wave 0 |

---

## Per-Task Verification Map

> Filled in by the planner 2026-08-17 against the seven plans in this directory.
> "File Exists ❌ W0" means the test file is created by the task itself (Wave 0 gap closed in-task, test-first).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | TIE-08 | T-06-SC | No second PRNG; harness installs nothing | unit | `pnpm exec vitest run tests/domain/standings/standings-tiebreaker-agreement.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | TIE-08 | T-06-04 | Termination via monotonic committed set + depth cap; per-conference throw isolation retained | property | `pnpm exec vitest run tests/domain/tiebreakers/acc-guard-and-elimination.test.ts tests/tiebreakers-engine.test.ts tests/tiebreakers-acc.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | TIE-08 | T-06-04 | Elimination branch bounded by group size; no new recursion path | unit + property | `pnpm test` | ⚠️ extend | ⬜ pending |
| 6-02-01 | 02 | 2 | TIE-08, TIE-05 | — | N/A (RED contract only) | property | `pnpm exec vitest run tests/domain/tiebreakers/n-seed-ranking.test.ts tests/domain/tiebreakers/trace-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 2 | TIE-08 | T-06-05, T-06-04 | No rank presented as procedure-derived when decided by database id; iteration + depth caps | property | `pnpm test` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 2 | TIE-08 | T-06-05 | Zero unseparated-top-bucket emissions pinned across 400 conference-seasons | property | `pnpm exec vitest run tests/domain/tiebreakers/` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 3 | TIE-08 | T-06-04 | Per-conference try/catch preserved; degraded path still yields a complete rank sequence | unit | `pnpm exec vitest run tests/domain/ && pnpm typecheck` | ⚠️ exists | ⬜ pending |
| 6-03-02 | 03 | 3 | TIE-08 | — | N/A | unit | `pnpm exec vitest run tests/domain/standings/` | ⚠️ rewrite | ⬜ pending |
| 6-03-03 | 03 | 3 | TIE-08 | T-06-07, T-06-03 | `?conf=` narrowed against `P4_CONFERENCES`; logging stays conference-name-only | unit | `pnpm test && pnpm lint && pnpm typecheck` | ⚠️ extend | ⬜ pending |
| 6-04-01 | 04 | 4 | TIE-07 | — | N/A (RED contract only) | component | `pnpm exec vitest run tests/components/ChampionshipCard.test.ts` | ❌ W0 | ⬜ pending |
| 6-04-02 | 04 | 4 | TIE-07 | T-06-06, T-06-08 | Text interpolation only, no `v-html`; never renders the caught exception | component | `pnpm exec vitest run tests/components/ChampionshipCard.test.ts` | ❌ W0 | ⬜ pending |
| 6-04-03 | 04 | 4 | TIE-07 | T-06-05 | Matchup read only via `championshipFor`; no row-order fallback path exists | component | `pnpm test && pnpm lint && pnpm typecheck` | ⚠️ extend | ⬜ pending |
| 6-05-01 | 05 | 4 | TIE-06 | — | Completion counts membership only; validity stays `toOutcomes`' sole responsibility | unit | `pnpm exec vitest run tests/domain/standings/` | ❌ W0 | ⬜ pending |
| 6-05-02 | 05 | 4 | TIE-06 | T-06-01, T-06-05, T-06-09 | Set-equality before application; synchronous FNV-1a key; versioned canonical string | unit | `pnpm exec vitest run tests/domain/tiebreakers/` | ❌ W0 | ⬜ pending |
| 6-05-03 | 05 | 4 | TIE-06 | T-06-01, T-06-02, T-06-03 | Untrusted storage validated on read; entry and group-size caps; silent drop; no logging | unit (composable) | `pnpm test` | ❌ W0 | ⬜ pending |
| 6-06-01 | 06 | 3 | TIE-05 | — | N/A (RED contract only) | component | `pnpm exec vitest run tests/components/TiebreakerReasoning.test.ts` | ❌ W0 | ⬜ pending |
| 6-06-02 | 06 | 3 | TIE-05, TIE-06 | T-06-06, T-06-01, T-06-10 | Escaped interpolation; ordering built only from the group's own ids; manual provenance stated | component | `pnpm exec vitest run tests/components/` | ❌ W0 | ⬜ pending |
| 6-07-01 | 07 | 5 | TIE-08, TIE-05 | T-06-06, T-06-04, T-06-10 | Markers derived from engine output only; degraded path renders no marker; distinct accessible names | component | `pnpm exec vitest run tests/components/` | ⚠️ rewrite | ⬜ pending |
| 6-07-02 | 07 | 5 | TIE-06 | T-06-01, T-06-05, T-06-03 | Two independent gates preserved end to end; stale key is a lookup miss; silent restoration | unit (composable) | `pnpm test && pnpm lint && pnpm typecheck` | ❌ W0 | ⬜ pending |
| 6-07-03 | 07 | 5 | TIE-05, TIE-06, TIE-08 | T-06-04, T-06-02 | Defensive branches (pool break, iteration cap, depth cap, malformed payloads) reached by real inputs | coverage | `pnpm exec vitest run --coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Sampling continuity check

No three consecutive tasks lack an automated verify — every one of the 20 tasks carries an `<automated>` command. No watch-mode flags are used. The per-task quick command (`pnpm exec vitest run tests/domain/`) is sub-second, well inside the 5-second latency budget; the four tasks that run the full `pnpm test` are wave-boundary tasks where the slower gate is the correct one.

### Wave-0 gap closure model

This phase closes every Wave-0 gap **inside the task that needs it**, test-first, rather than in a separate scaffolding plan. Tasks 6-02-01, 6-04-01 and 6-06-01 exist purely to create failing contracts before their implementation tasks; that is the RED half of the cycle, and each is required to record its failure reason in its commit message so the RED state is auditable after the fact.

---

## Wave 0 Requirements

- [ ] `tests/helpers/generated-seasons.ts` — extract `mulberry32` / `generatePicks` / `readSlate` from the Phase 5 test (DRY; do **not** write a second PRNG)
- [ ] `tests/domain/tiebreakers/n-seed-decision-rate.test.ts` — the committed measurement (TIE-08, Pitfalls 1 & 2)
- [ ] `tests/domain/tiebreakers/n-seed-ranking.test.ts` — loop correctness (TIE-08)
- [ ] `tests/domain/tiebreakers/trace-isolation.test.ts` — TIE-05, Pitfall 5
- [ ] `tests/domain/tiebreakers/invalidation.test.ts` — TIE-06, D-08
- [ ] `tests/domain/standings/slateCompletion.test.ts` — D-07
- [ ] `tests/composables/useManualTiebreakers.test.ts` — TIE-06, D-09, Pitfall 8
- [ ] `tests/components/ChampionshipCard.test.ts` — TIE-07
- [ ] `tests/components/TiebreakerReasoning.test.ts` — TIE-05, D-15/D-16/D-17
- [ ] Rewrite the D-04 assertions in `tests/domain/standings/computeStandings.test.ts` and
      `standings-tiebreaker-agreement.test.ts` — **they currently assert the behavior this phase
      reverses.** Clause (iii) of `violationsFor` asserts *"two rows with identical conference W-L
      must carry the same rank"*, which D-01 makes false by design. This is a required, deliberate
      task — not a test that fixes itself.
- [ ] Framework install: **none required**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Marker contrast in both themes, WCAG AA | D-10 / D-11 | Visual contrast against team-color accents cannot be asserted in happy-dom | `checkpoint:human-verify` — inspect standings table in light and dark, confirm both markers legible at small sizes |
| Pick → recompute → DOM chain | TIE-08 | Deliberately uncovered — no Nuxt-environment vitest project (see research Open Question 1) | Follow `.planning/phases/04-picks-persistence/04-UAT.md` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 20 tasks carry an `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — each gap is closed test-first inside the task that needs it (see the gap-closure model above)
- [x] No watch-mode flags
- [x] Feedback latency < 5s for the per-task quick command
- [x] Pre-existing `shared/domain/tiebreakers/**` branch-coverage gap assigned — task **6-07-03** owns closing 87.87% → 90%, with thresholds explicitly forbidden from being lowered
- [x] `nyquist_compliant: true` set in frontmatter

**Manual-only items carried to phase-end verification** (`workflow.human_verify_mode` is `end-of-phase`, so these are `<verify><human-check>` blocks in the plans rather than blocking checkpoint tasks):

| Behavior | Requirement | Owning plan |
|---|---|---|
| Marker contrast, both markers × both themes, WCAG AA at rendered size | D-10 / D-11 | 07 |
| Full-flow walkthrough: expand, read reasoning, order by keyboard, commit, clear, restore | TIE-05 / TIE-06 | 07 |
| Mid-season shared ranks read as intentional, not as an unfinished state | TIE-08 | 07 |
| Championship card at a 10-team candidate set in a 320px sidebar | TIE-07 | 04 |
| Touch-target size trade on the ordering buttons (26px, accepted) | TIE-06 | 06 |
| Pick → recompute → DOM chain | TIE-08 | deliberately uncovered — `.planning/phases/04-picks-persistence/04-UAT.md` |

**Approval:** ready for execution (planner, 2026-08-17)
