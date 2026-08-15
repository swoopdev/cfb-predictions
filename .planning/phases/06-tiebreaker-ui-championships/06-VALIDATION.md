---
phase: 6
slug: tiebreaker-ui-championships
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
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

> **Planner fills this in.** One row per task, mapped to the requirement and command above.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | TIE-08 | — | N/A | unit | `pnpm exec vitest run tests/domain/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Pre-existing `shared/domain/tiebreakers/**` branch-coverage gap closed (87.87% → 90%)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
