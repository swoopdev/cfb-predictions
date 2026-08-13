---
phase: 03-tiebreaker-engine
plan: 01
subsystem: domain
tags: [typescript, vitest, tdd, tiebreaker, standings]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: "Real Team/Game field shapes (public/data/2026/{teams,games}.json) that ground shared/domain/tiebreakers' decoupled Game interface"
provides:
  - "shared/domain/tiebreakers/types.ts -- TeamId, GameId, ConferenceId, Game, BaseOrdering"
  - "shared/domain/tiebreakers/records.ts -- ConferenceRecord, deriveConferenceRecords, deriveOverallWinCount"
  - "shared/domain/tiebreakers/baseOrdering.ts -- computeBaseOrdering"
affects: [03-02-steps-engine, 03-03-conference-orchestration, phase-05-standings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc-comment-cites-decision convention (every export names the RESEARCH.md/PITFALLS.md pitfall or D-number it encodes)"
    - "NaN-safe ratio helper (winPctSafe) -- never bare division, always route through a zero-denominator guard"
    - "Frozen-value-computed-once discipline (BaseOrdering passed as a plain value, never recomputed mid-procedure)"

key-files:
  created:
    - shared/domain/tiebreakers/types.ts
    - shared/domain/tiebreakers/records.ts
    - shared/domain/tiebreakers/baseOrdering.ts
    - tests/tiebreakers-records.test.ts
    - tests/tiebreakers-baseOrdering.test.ts
  modified: []

key-decisions:
  - "shared/domain/ deliberately does not import GameOutput from scripts/lib/schemas.ts -- Game is a structurally-compatible subset so Phase 2/4/5 callers can pass real fetched games with no cast"
  - "deriveOverallWinCount is a Big-12-only helper, explicitly NOT part of the shared ConferenceRecord contract Phase 5 will import for its own win totals"

patterns-established:
  - "Every shared/domain/tiebreakers/*.ts export carries a doc comment citing the specific pitfall/decision it defends against, matching scripts/lib/*.ts house style"

requirements-completed: [TIE-01, TIE-02]

coverage:
  - id: D1
    description: "deriveConferenceRecords aggregates a conference's Game[] + outcome map into per-team wins/losses/gamesPlayed/winPct/beat/lostTo/opponents, with winPct guaranteed non-NaN at zero games played"
    requirement: "TIE-01"
    verification:
      - kind: unit
        ref: "tests/tiebreakers-records.test.ts#deriveConferenceRecords"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeBaseOrdering produces a frozen, best-to-worst, bucketed raw-win-pct ordering with deterministic ascending-id tiebreaking within a bucket"
    requirement: "TIE-01"
    verification:
      - kind: unit
        ref: "tests/tiebreakers-baseOrdering.test.ts#computeBaseOrdering"
        status: pass
    human_judgment: false
  - id: D3
    description: "deriveOverallWinCount caps credited wins against non-FBS opponents at fcsWinCap (default 1), per the Big 12's total-wins step"
    requirement: "TIE-02"
    verification:
      - kind: unit
        ref: "tests/tiebreakers-records.test.ts#deriveOverallWinCount"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-13
status: complete
---

# Phase 3 Plan 1: Tiebreaker Engine Foundations Summary

**Pure conference-record aggregation, frozen bucketed base ordering, and the Big 12's FCS-capped overall win count -- the domain foundation every later tiebreaker step evaluator reads from, greenfield in a new `shared/domain/tiebreakers/` module**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-13T15:28:05-06:00
- **Completed:** 2026-08-13T15:30:03-06:00
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created source, 2 created test)

## Accomplishments
- `deriveConferenceRecords` derives per-team conference wins/losses/gamesPlayed/beat/lostTo/opponents from a conference's games + a complete outcome map, guaranteeing every conference member gets an entry (zero-value if unplayed) and routing every winPct computation through a NaN-safe helper
- `computeBaseOrdering` groups teams into best-to-worst raw-win-pct buckets, computed once and intended to be frozen for the lifetime of a single tiebreaker resolution call -- the direct fix for PITFALLS.md Pitfall 4's circularity trap
- `deriveOverallWinCount` implements the Big 12's FCS win cap (default 1 counted win against non-FBS opponents per team, per season) as an explicitly separate, narrowly-scoped helper -- not folded into the shared `ConferenceRecord` contract

## Task Commits

Each task was committed atomically (TDD RED/GREEN pairs):

1. **Task 1: types.ts foundations + deriveConferenceRecords**
   - `38a4bda` (test) - add failing test for deriveConferenceRecords + types.ts scaffolding
   - `b87c2eb` (feat) - implement deriveConferenceRecords
2. **Task 2: computeBaseOrdering + deriveOverallWinCount (Big 12 FCS win cap)**
   - `86c5966` (test) - add failing tests for computeBaseOrdering and deriveOverallWinCount
   - `eee7a64` (feat) - implement computeBaseOrdering and deriveOverallWinCount

_No REFACTOR commits -- both implementations were single clear pipelines needing no cleanup pass._

## Files Created/Modified
- `shared/domain/tiebreakers/types.ts` - TeamId, GameId, ConferenceId, Game (decoupled from scripts/lib/schemas.ts), BaseOrdering
- `shared/domain/tiebreakers/records.ts` - ConferenceRecord interface, deriveConferenceRecords, deriveOverallWinCount
- `shared/domain/tiebreakers/baseOrdering.ts` - computeBaseOrdering
- `tests/tiebreakers-records.test.ts` - deriveConferenceRecords (round-robin, zero-games NaN-safety, gamesPlayed invariant, order-determinism) + deriveOverallWinCount (FCS cap, mixed FBS/FCS crediting, no-cap-on-FBS, custom cap)
- `tests/tiebreakers-baseOrdering.test.ts` - computeBaseOrdering (2-way tie bucketing, within-bucket ascending-id order, zero-games NaN-safety)

## Decisions Made
- Confirmed `Game` in `shared/domain/tiebreakers/types.ts` is a deliberately minimal, decoupled subset of `scripts/lib/schemas.ts`'s `GameOutput` -- structurally compatible so downstream phases pass real fetched games with no adapter, per the plan's explicit instruction
- Confirmed `deriveOverallWinCount`'s doc comment states its Big-12-only scope explicitly, so Phase 5 does not mistakenly import it for standings win totals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `pnpm lint` and `pnpm typecheck:scripts` both pass clean against the new files, in addition to the plan's specified `pnpm test` verification gate.

## TDD Gate Compliance

RED and GREEN gate commits confirmed present in git log for both tasks:
- Task 1: `38a4bda` (test) -> `b87c2eb` (feat)
- Task 2: `86c5966` (test) -> `eee7a64` (feat)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`ConferenceRecord`, `deriveConferenceRecords`, `BaseOrdering`, `computeBaseOrdering`, and `deriveOverallWinCount` are exported and ready for Plan 03-02 (`steps.ts`) to build the head-to-head, common-opponents, and total-wins step evaluators directly on top of these frozen values. No blockers.

## Self-Check: PASSED

All 6 created files found on disk; all 5 commit hashes found in git log.

---
*Phase: 03-tiebreaker-engine*
*Completed: 2026-08-13*
