---
phase: 03
slug: tiebreaker-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-13
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10, `environment: 'node'` |
| **Config file** | `vitest.config.ts` (exists from Phase 1; needs a `coverage` block added per D-11 — see RESEARCH.md Code Examples) |
| **Quick run command** | `pnpm test -- tests/tiebreakers-<conf>.test.ts` |
| **Full suite command** | `pnpm test` (runs `vitest run`) |
| **Estimated runtime** | ~2–5 seconds (pure `node` environment, no Nuxt boot) |

---

## Sampling Rate

- **After every task commit:** Run the specific conference's fixture file, e.g. `pnpm test -- tests/tiebreakers-sec.test.ts`
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, AND `@vitest/coverage-v8`'s per-file threshold on `shared/domain/tiebreakers/**` (D-11) must pass
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-0X-0X | 0X | 0/1 | TIE-01 | — | `resolveConferenceChampionship` returns the correct two CCG participants for a complete, unambiguous pick set, for each of SEC/Big Ten/Big 12/ACC | unit | `pnpm test -- tests/tiebreakers-sec.test.ts` (+ `-bigten`/`-big12`/`-acc`) | ❌ W0 | ⬜ pending |
| 03-0X-0X | 0X | 0/1 | TIE-02 | — | Per-conference rules match each published procedure verbatim, including the ACC's non-win-pct tied-team definition and mixed 8/9-game schedule handling, and the Big 12's collective-bucket comparison (D-05, revised) | unit | `pnpm test -- tests/tiebreakers-acc.test.ts`, `tests/tiebreakers-big12.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | 0X | 0/1 | TIE-03 | T-03-01 (malformed/incomplete `outcomes` map causing infinite recursion) | `resolveTiedGroup` restarts on partial separation and continues on no separation; a fixture where restart-vs-continue diverges is pinned; both recursion invariants (strictly-smaller group, no re-admitted teams) hold | unit | `pnpm test -- tests/tiebreakers-engine.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | 0X | 0/1 | TIE-04 | T-03-02 (`GameId`/`TeamId` not validated at the function boundary) | Uncomputable steps return `NeedsUserInput` with `rules.terminalReason` (D-04) — never guesses, never throws on a complete input | unit | `pnpm test -- tests/tiebreakers-engine.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `shared/domain/tiebreakers/{types,records,baseOrdering,steps,engine,rules,acc}.ts` — no tiebreaker module exists yet; this is a greenfield phase
- [ ] `tests/fixtures/tiebreakers/{sec,bigten,big12,acc}.fixtures.ts` — hand-verified fixture data per D-10 (2/3/4/5-way ties, restart-vs-continue divergence, partial head-to-head graph, zero-common-opponents NaN safety — per conference), none exist yet
- [ ] `tests/tiebreakers-{sec,bigten,big12,acc,engine}.test.ts` — none exist yet
- [ ] `vitest.config.ts` — add the `coverage` block (D-11): `provider: 'v8'`, per-directory threshold on `shared/domain/tiebreakers/**`, exact percentage left to planning
- [ ] `@vitest/coverage-v8` — already an installed devDependency, version-matched to `vitest`; no install needed, config only

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* Every tiebreaker step is deterministic and pure; the only manual effort is authoring the D-10 fixture matrix's *expected values* by hand from the primary-source PDFs (an authoring-time task, not a runtime check), including the Big 12 collective-bucket fixture, which must now encode the corrected D-05 reading (see 03-CONTEXT.md).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
