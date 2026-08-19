---
phase: 06-tiebreaker-ui-championships
plan: 07
subsystem: ui
tags: [vue, tiebreakers, standings, coverage, accessibility]

requires:
  - phase: 06-tiebreaker-ui-championships
    provides: "Plan 04's ranking prop and ChampionshipCard; Plan 05's slateCompletionByConference, applyManualOrdering and useManualTiebreakers; Plan 06's TiebreakerReasoning.vue"
provides:
  - "StandingsTable.vue's three-state rank cell (D-10/D-11): plain number, tiebreaker/manual chip (marker a), shared-rank pill plus band and rule (marker b), derived exclusively from RankGroup"
  - "useStandings.ts owning the full D-08/D-09 manual-decision lifecycle: applyManualOrdering wired between resolveAllConferences and computeStandings, slateComplete exposed, commitOrdering delegated, pruneStale on a watchEffect gated on slate completion"
  - "shared/domain/tiebreakers/** and shared/domain/standings/** coverage gates passing for the first time since before Phase 5"
affects: []

tech-stack:
  added: []
  patterns:
    - "Rank-cell marker state is a pure function of RankGroup (markerKindFor), never a comparison between two rows' confRecord — the CR-01 defect class is now structurally excluded from the display layer"
    - "v8 ignore with an inline explanation for branches proven structurally unreachable by a caller's own invariant (e.g. deriveConferenceRecords seeding every id in its own teamIds before any .get()), rather than writing a test that could never execute the branch"
    - "watchEffect (not a computed) is the one permitted side-effecting node in useStandings — used solely for storage pruning, gated per-conference on slateComplete so an incomplete conference's decisions are retained, not deleted"

key-files:
  created:
    - tests/domain/tiebreakers/coverage-gaps.test.ts
  modified:
    - app/components/StandingsTable.vue
    - app/components/StandingsSidebar.vue
    - app/composables/useStandings.ts
    - app/pages/week/[week].vue
    - tests/components/StandingsTable.test.ts
    - tests/components/StandingsSidebar.test.ts
    - tests/composables/useStandings.test.ts
    - shared/domain/standings/computeStandings.ts
    - shared/domain/tiebreakers/records.ts
    - tests/domain/standings/computeStandings.test.ts
    - tests/domain/tiebreakers/invalidation.test.ts
    - tests/tiebreakers-steps.test.ts

key-decisions:
  - "Marker (a) is reused for both tiebreaker-decided and manually-ordered ranks (§6.2, T-06-10 accepted risk) — provenance is carried in the accessible name and the reasoning block's visible statement, not a third visual language"
  - "pruneStale watches the RAW (pre-manual) rankings, not the manually-adjusted ones, and no-ops for an incomplete conference — this is what makes suspension retention rather than deletion, per D-08/D-09"
  - "Several `?? 0` / `?? new Set()` fallbacks in computeStandings.ts and records.ts were found structurally unreachable (not merely untested) given deriveConferenceRecords' own invariants; marked with `v8 ignore` plus an inline explanation instead of a coverage-chasing test with no real assertion"
  - "commit_docs / .planning tracking unaffected: no dependency or coverage-threshold change this plan (git diff on package.json, pnpm-lock.yaml and vitest.config.ts is empty)"

patterns-established:
  - "Any future rank-indicator work must derive state from the engine's RankGroup, never from adjacent-row record comparison — enforced by tests/components/StandingsTable.test.ts's D-10/D-11 block, including a markup-level grep for team-colour bindings, style attributes and bare palette classes"

requirements-completed: [TIE-05, TIE-06, TIE-08]

coverage:
  - id: D1
    description: "Three-state rank cell (plain number / tiebreaker-or-manual chip / shared-rank pill+band+rule) renders driven solely by the ranking prop's RankGroup, with the D-05/D-06 no-badge rationale reversed and its assertions rewritten as D-10/D-11"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#rank markers (D-10/D-11)"
        status: pass
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#D-11: the rank cell markup contains no team-colour binding, no style attribute and no bare palette-scale class"
        status: pass
    human_judgment: false
  - id: D2
    description: "Manual decisions applied end to end through useStandings: committing an ordering produces distinct ranks with no reload; clearing/re-picking silently suspends and restores; a changed group invalidates and is re-offered"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/composables/useStandings.test.ts (§9.3 four-part criterion, §9.4 suspended-vs-continuous equivalence)"
        status: pass
      - kind: unit
        ref: "tests/components/StandingsSidebar.test.ts (slate-complete threading, including the map-absent case)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shared/domain/tiebreakers/** and shared/domain/standings/** clear their coverage thresholds (90% / 85% on all four metrics) for the first time since before Phase 5, with no threshold lowered and no exclusion added"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "pnpm exec vitest run --coverage"
        status: pass
    human_judgment: false
  - id: D4
    description: "Marker contrast (D-11) checked live in both themes with a contrast checker, and the full-flow / mid-season UAT walkthroughs from the plan's <human-check> block"
    verification: []
    human_judgment: true
    rationale: "Contrast cannot be audited statically because Nuxt UI injects its neutral colour ramp at runtime (Phase 5 tried and produced a bogus figure); the full-flow and mid-season walkthroughs need a live browser and human read of the rendered table. None of this was exercised in this executor session — deferred to UAT verbatim per the plan's own <human-check> block."

duration: ~23min (task commits) + continuation session
completed: 2026-08-19
status: complete
---

# Phase 06 Plan 07: Standings-Table Integration and Coverage Gate Summary

**Wired the three-state rank cell and manual-decision lifecycle into StandingsTable/useStandings, then closed the tiebreakers coverage gate that had been failing since before Phase 5**

## Performance

- **Duration:** ~23 min across the three task commits (20:10:22 to 20:33:18 MDT, 2026-08-18); this continuation session added no implementation, only verification and this SUMMARY
- **Started:** 2026-08-18T20:10:22-06:00 (first commit, Task 1)
- **Completed:** 2026-08-18T20:33:18-06:00 (last commit, Task 3)
- **Tasks:** 3
- **Files modified:** 12 (1 new test file; 7 files touched across Tasks 1-2; 5 files touched in Task 3, including 2 shared/domain source files)

## Accomplishments

- **Task 1 — three-state rank cell (D-10/D-11).** `StandingsTable.vue`'s rank `<td>` now derives its state exclusively from the `ranking` prop's `RankGroup` via a pure `markerKindFor` predicate — never from comparing two rows' `confRecord`. Uncontested ranks render a plain number with no button and no ARIA. Contested single-team groups (tiebreaker-decided or manually-ordered) get marker (a), a soft square chip that is also the `TiebreakerReasoning` disclosure trigger. Groups with more than one team get marker (b), a filled round pill repeated on every row of the group alongside a muted band and a two-pixel left rule, so the group reads as one continuous unit and the rank number stays on every row rather than being blanked. Both markers use only the neutral shell's inverted background/foreground token pair — no team colour, no `:style` binding, no bare palette class — enforced by a markup-level grep assertion. The D-05/D-06 no-badge comment block and its test assertions (which declined any tie indicator) were deleted and replaced with a D-10/D-11 block covering all three states, the derivation-not-comparison cases, expand/collapse of the reasoning row, and the degraded (`ranking` undefined) path.
- **Task 2 — manual decisions wired end to end (D-08/D-09).** `useStandings.ts` now exposes `slateComplete` (per-conference `SlateCompletion`) and `commitOrdering`, and applies `applyManualOrdering` for each P4 conference strictly between `resolveAllConferences` and `computeStandings` — the ordering `computeStandings` needs to assign distinct ranks to a manually-split group. Storage pruning runs from a `watchEffect` over the raw (pre-manual) rankings, is a no-op for an incomplete conference, and never lives inside a computed. `week/[week].vue`'s bulk clear handlers are byte-identical to their pre-phase form — no confirmation dialog was added, matching §0.1 consequence 2. `StandingsSidebar.vue` and `StandingsTable.vue` thread `slateComplete`/`commitOrdering` straight through with no component computing completion or touching storage itself.
- **Task 3 — coverage gate closed.** `shared/domain/tiebreakers/**` (was 87.87% branches against a 90% threshold, failing since before Phase 5) and `shared/domain/standings/**` (had regressed to 84.78% against an 85% threshold from the same class of dead branch) both now clear all four metrics. New behavioral tests target the specific uncovered branches: `resolveTiedGroup`'s recursion-depth cap and containment-escape backstop (via direct calls with an injected pathological `defineTiedTeams`, since neither is reachable through the real `CONFERENCE_RULES`), the unknown-conference and unknown-step-id exhaustive-switch throws, `championshipFor` on a zero-group ranking, `defineAccTiedTeams` once every team is already committed, the D-08 duplicate-id guard in `applyManualOrdering`, and `computeStandings`' fallback-order win-count tiebreak. Several `?? 0`/`?? new Set()` fallbacks in `computeStandings.ts` and `records.ts` were found structurally unreachable (not merely untested — `deriveConferenceRecords` seeds every id in its own `teamIds` argument before any `.get()` against that set), so those were marked `v8 ignore` with an inline explanation rather than padded with a test that asserts nothing real.

## Task Commits

Each task was committed atomically:

1. **Task 1: Three-state rank cell, reversing D-05/D-06's no-badge rationale** - `980b385` (feat)
2. **Task 2: Wire manual decisions end to end through useStandings** - `7d0684d` (feat)
3. **Task 3: Close the tiebreaker directory's coverage gate** - `26bcf90` (test)

## Files Created/Modified

- `app/components/StandingsTable.vue` - rewritten rank cell (three states, disclosure trigger, reasoning-row mount); threads `slateComplete`/commit handler in place of Task 1's hardcoded `false`/unconsumed emit
- `tests/components/StandingsTable.test.ts` - D-10/D-11 rank-marker block replacing the deleted D-05/D-06 block; markup-level no-team-colour grep assertion
- `app/composables/useStandings.ts` - `slateComplete`, `commitOrdering`, manual-ordering application between `resolveAllConferences` and `computeStandings`, pruning `watchEffect`
- `app/components/StandingsSidebar.vue` - threads `slateComplete`/`commitOrdering` from the page into each `StandingsTable`
- `app/pages/week/[week].vue` - passes `slateComplete`/`commitOrdering` from `useStandings`; bulk handlers unchanged
- `tests/composables/useStandings.test.ts` - new; full lifecycle against a synthetic SEC fixture, §9.3 four-part criterion, §9.4 suspended-vs-continuous equivalence
- `tests/components/StandingsSidebar.test.ts` - updated for the new props, including the slate-complete-map-absent case
- `tests/domain/tiebreakers/coverage-gaps.test.ts` - new; cross-cutting/defensive branches with no natural home in a topical file (recursion cap, containment-escape backstop, exhaustive-switch throws, zero-group `championshipFor`, ACC all-committed, D-08 duplicate-id guard)
- `shared/domain/standings/computeStandings.ts` - added the fallback-order win-count tiebreak test target plus `v8 ignore` annotations on structurally-unreachable fallbacks
- `shared/domain/tiebreakers/records.ts` - `v8 ignore` annotations on structurally-unreachable fallbacks (same class as above)
- `tests/domain/standings/computeStandings.test.ts` - new case for the fallback-order win-count tiebreak
- `tests/domain/tiebreakers/invalidation.test.ts` - new case for the D-08 duplicate-id guard in `applyManualOrdering`
- `tests/tiebreakers-steps.test.ts` - new cases for `defineAccTiedTeams` once every team is committed, and related step coverage

## Where each coverage gap was closed

| Gap | Home | Nature |
|---|---|---|
| `resolveTiedGroup` recursion-depth cap; containment-escape backstop | `tests/domain/tiebreakers/coverage-gaps.test.ts` | Cross-cutting/defensive, unreachable through the real `CONFERENCE_RULES` — needed a direct call with an injected pathological `defineTiedTeams` |
| Unknown-conference throw; unknown-step-id exhaustive-switch throw | `tests/domain/tiebreakers/coverage-gaps.test.ts` | Cross-cutting defensive branches with no single topical home |
| `championshipFor` on a zero-group ranking | `tests/domain/tiebreakers/coverage-gaps.test.ts` | Cross-cutting, engine-level edge case |
| `defineAccTiedTeams` once every team is already committed | `tests/tiebreakers-steps.test.ts` | Belongs to the existing ACC step-file test suite (topical) |
| D-08 duplicate-id guard in `applyManualOrdering` | `tests/domain/tiebreakers/invalidation.test.ts` | Belongs to the existing invalidation-module test suite (topical) |
| `computeStandings` fallback-order win-count tiebreak (equal pct, different games played) | `tests/domain/standings/computeStandings.test.ts` | Belongs to the existing standings-engine test suite (topical) |
| Structurally-unreachable `?? 0`/`?? new Set()` fallbacks in `computeStandings.ts` and `records.ts` | `v8 ignore` inline in the source files, no test | Proven unreachable by `deriveConferenceRecords`' own invariant (every id in `teamIds` seeded before any `.get()`); a test could never execute them, so a coverage-chasing test would assert nothing real |

## Final coverage figures (this session's re-run, `pnpm exec vitest run --coverage`)

| Directory | Threshold | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| `shared/domain/tiebreakers/**` | 90% all four | 96.59% | **92.03%** | 98.36% | 97.3% |
| `shared/domain/standings/**` | 85% all four | 99% | 92.1% | 100% | 98.75% |

All eight threshold checks clear. `pnpm exec vitest run --coverage` exits 0 with no threshold-failure output. `git diff --stat package.json pnpm-lock.yaml vitest.config.ts` is empty — no dependency added, no threshold changed, no exclusion added.

## Decisions Made

- **Marker (a) reused for both tiebreaker-decided and manually-ordered ranks (§6.2).** A group the user manually ordered arrives as single-team groups with the original contested pool preserved, so it satisfies marker (a)'s predicate with no special case. Provenance is carried through the differing accessible name and the reasoning block's visible statement, not a third visual language — this is T-06-10's accepted risk in the plan's threat register, not a gap.
- **Pruning watches the raw rankings and gates on `slateComplete` per conference.** This is what makes an incomplete conference's manual decision retained (suspended) rather than deleted, satisfying §9.2's independent-gates requirement and §9.3's silent-restoration rule.
- **Structurally-unreachable fallback branches got `v8 ignore` with an explanation, not a padding test.** The plan's Task 3 action explicitly warns against tests that move a coverage number without an assertion that would fail on a behavior change; marking dead code as dead is the honest alternative to gaming the metric.

## Deviations from Plan

None - plan executed exactly as written. This continuation session performed no implementation work; it re-verified the prior session's three task commits (which were already complete and pushed to disk) and produced this SUMMARY, which the prior session was unable to write before an API usage-limit interruption.

## Issues Encountered

None during this session. Full re-verification (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run --coverage`, and a `git diff --stat` on `package.json`/`pnpm-lock.yaml`/`vitest.config.ts`) confirms every acceptance criterion and the plan's top-level `<verification>` block, independently of the numbers the orchestrator had already reported.

## Human-Check: Deferred to UAT

The plan's `<human-check>` block was **not exercised** in either the original execution session or this continuation/summary session. All three items remain open:

1. **Marker contrast (D-11).** Four checks — marker (a)'s square chip against the table surface in light and dark theme, marker (b)'s round pill against the banded row in light and dark theme — each needs a live `pnpm dev` render and a contrast checker at real rendered size, targeting WCAG AA (4.5:1) for the 12-14px marker text. Not run.
2. **Full-flow walkthrough.** Picking a full ACC slate; confirming the pill/band/rule on shared ranks; expanding a group to see the decisive step first with the full procedure (including restart lines) behind the toggle; confirming the ordering control appears only once the ACC slate is complete; keyboard-only ordering with focus never landing on `<body>`; confirming pills become square chips immediately on commit; confirming a cleared-then-re-picked ACC pick silently restores the ordering with no notice. Not run.
3. **Mid-season read.** With a partly-picked season, confirming the ACC's many shared ranks read as intentional (no badge, count, warning colour or alert) and that no copy anywhere describes the state as unfinished. Not run.

These are exactly the items the plan's own `<verification>` block designates as non-automatable, and they should route to the phase's UAT pass rather than be claimed complete here.

## Accessibility trade carried forward (§12.3)

Carried from `06-06-SUMMARY.md` and unchanged by this plan: the unassigned-team buttons inside `TiebreakerReasoning`'s ordering terminus are full-width but only ~26px tall, below the usual 44px touch-target guideline. This is a deliberate trade — a 44px row would break the dense standings table's rhythm — with full-row width as the compensating affordance. This plan mounts `TiebreakerReasoning` inside `StandingsTable`'s reasoning row without altering that component's internals, so the trade stands as originally recorded and should be evaluated during the same UAT pass as the deferred `<human-check>` items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the last plan in Phase 06 (tiebreaker-ui-championships). Everything the phase's ROADMAP goal describes is now wired end to end in code and covered by passing automated tests:

- ROADMAP criterion 6 (a rank gap can never be mistaken for a record gap): satisfied structurally by Task 1's derivation rule and enforced by the D-11 markup grep.
- ROADMAP criterion 2 (step-by-step reasoning reachable from every contested rank): satisfied by Task 1's reasoning-row mount plus Plan 06's `TiebreakerReasoning`.
- ROADMAP criterion 3 (a manual selection stays valid while unchanged, re-asked when not): satisfied by Task 2's two-gate lifecycle.
- ROADMAP criterion 5 (unresolvable teams share a marked rank, prompted only once their conference slate is complete): satisfied by Task 1's marker (b) plus Task 2's `slateComplete` gate on the ordering terminus.
- The tiebreaker and standings coverage gates pass for the first time since before Phase 5, closing the debt `deferred-items.md` had assigned forward.

Remaining before the phase can be called fully signed off: the three `<human-check>` items above, live in a browser with a contrast checker, plus a decision on whether the §12.3 touch-target trade is acceptable as shipped or needs a follow-up plan. Both are UAT-scope, not implementation-scope — no further code changes are indicated by this session's verification.

## Self-Check: PASSED

- All 8 key files found on disk: `app/components/StandingsTable.vue`, `tests/components/StandingsTable.test.ts`, `app/composables/useStandings.ts`, `app/components/StandingsSidebar.vue`, `app/pages/week/[week].vue`, `tests/composables/useStandings.test.ts`, `tests/components/StandingsSidebar.test.ts`, `tests/domain/tiebreakers/coverage-gaps.test.ts`
- All 3 task commit hashes found in git log: `980b385`, `7d0684d`, `26bcf90`
- `pnpm test`: 520/520 passing (44 test files)
- `pnpm lint`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm exec vitest run --coverage`: exit 0; `shared/domain/tiebreakers/**` 96.59%/92.03%/98.36%/97.3% (stmts/branch/funcs/lines) against a 90% threshold on all four; `shared/domain/standings/**` 99%/92.1%/100%/98.75% against an 85% threshold on all four
- `git diff --stat package.json pnpm-lock.yaml vitest.config.ts`: empty

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-19*
