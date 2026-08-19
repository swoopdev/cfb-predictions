---
phase: 06-tiebreaker-ui-championships
plan: 01
subsystem: tiebreakers
tags: [tiebreakers, acc, engine, testing, property-tests]

requires:
  - phase: 05-standings-engine-ui
    provides: tiebreaker engine (engine.ts, steps.ts), standings agreement test suite
provides:
  - repaired ACC recursion guard (depth cap replaces false size guard)
  - lost-to-all elimination step in evaluateHeadToHead
  - shared generated-season harness at tests/helpers/generated-seasons.ts
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07]

tech-stack:
  added: []
  patterns:
    - "test helpers in tests/helpers/ (non-.test.ts, not collected by vitest)"
    - "new tiebreaker tests in tests/domain/tiebreakers/ (nested convention)"
    - "@vitest-environment node docblock on every test importing generated-seasons.ts"

key-files:
  created:
    - tests/helpers/generated-seasons.ts
    - tests/domain/tiebreakers/acc-guard-and-elimination.test.ts
  modified:
    - shared/domain/tiebreakers/engine.ts
    - shared/domain/tiebreakers/steps.ts
    - tests/domain/standings/standings-tiebreaker-agreement.test.ts
    - tests/tiebreakers-engine.test.ts
    - tests/tiebreakers-steps.test.ts

key-decisions:
  - "Depth cap of 128 chosen as backstop: comfortably exceeds largest P4 conference (18 teams SEC/Big Ten)"
  - "Updated mock in tiebreakers-engine.test.ts to target the retained rest.length guard instead of the deleted defineTiedTeams size guard"
  - "Non-round-robin partition builds up to three ordered buckets ([beat-all], [middle], [lost-to-all]) preserving tiedTeams order within each bucket"

patterns-established:
  - "Test directory convention: new tiebreaker tests go in tests/domain/tiebreakers/"
  - "Single generated-season harness at tests/helpers/generated-seasons.ts (DRY)"
  - "Violation-collector pattern for property assertions over generated seasons"

requirements-completed: [TIE-08]

coverage:
  - id: D1
    description: "Generated-season harness extracted to tests/helpers/generated-seasons.ts with mulberry32, generatePicks, readJson, readSlate exports"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/standings/standings-tiebreaker-agreement.test.ts#holds across 100 fully-picked seasons"
        status: pass
      - kind: unit
        ref: "tests/domain/standings/standings-tiebreaker-agreement.test.ts#holds across 100 partially-picked seasons (weeks 1-7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ACC recursion guard deleted; zero fallbacks across 200 generated seasons (was 7/200 pre-fix, all ACC)"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/acc-guard-and-elimination.test.ts#produces zero fallbacks across 100 fully-picked seasons"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/acc-guard-and-elimination.test.ts#produces zero fallbacks across 100 partial seasons through week 7"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lost-to-all elimination step executes in evaluateHeadToHead; swept team drops to last bucket"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/tiebreakers-steps.test.ts#separates a team that lost to every other tied team"
        status: pass
      - kind: unit
        ref: "tests/tiebreakers-steps.test.ts#separates both beat-all and lost-to-all into a three-bucket partition"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/acc-guard-and-elimination.test.ts#a lost-to-all outcome with no beat-all is always separated"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-18
status: complete
---

# Phase 06 Plan 01: ACC Engine Defect Repairs Summary

**Repaired two ACC engine defects (false recursion guard and dropped lost-to-all elimination) and extracted the shared generated-season harness for Phase 6**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-18T20:04:52Z
- **Completed:** 2026-08-18T20:14:59Z
- **Tasks:** 3 (5 TDD commits: 2 RED + 2 GREEN + 1 refactor)
- **Files modified:** 7

## Accomplishments

- Extracted `mulberry32`, `generatePicks`, `readJson`, `readSlate` to `tests/helpers/generated-seasons.ts` as the single DRY harness for all Phase 6 property tests
- Deleted the false `nextTiedTeams.length >= tiedTeams.length` guard in `resolveTiedGroup` that rejected the ACC's published restart behavior; replaced with a depth cap of 128
- Measured before/after guard-trip counts: **7/200 -> 0/200** (3 fully-picked + 4 partial, all ACC)
- Implemented the ACC's "team that lost to every other Tied Team is eliminated" step in `evaluateHeadToHead` by consuming the previously-silenced `_lostToAllOthersTeam` binding and building a three-bucket partition
- All 390 tests pass, lint clean, typecheck clean, zero package changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract generated-season harness** - `9cfb0b7` (refactor)
2. **Task 2: Delete false recursion guard** - `c795acf` (test/RED), `64d36d5` (feat/GREEN)
3. **Task 3: Execute lost-to-all elimination** - `793fc56` (test/RED), `b37ced7` (feat/GREEN)

## Files Created/Modified

- `tests/helpers/generated-seasons.ts` - Single generated-season harness (mulberry32, generatePicks, readJson, readSlate)
- `tests/domain/tiebreakers/acc-guard-and-elimination.test.ts` - Guard-trip and lost-to-all property assertions over 200 generated seasons
- `shared/domain/tiebreakers/engine.ts` - Deleted false size guard, added depth cap of 128, rewrote termination docblock
- `shared/domain/tiebreakers/steps.ts` - Consumed lostToAllOthersTeam, built three-bucket partition in non-round-robin branch
- `tests/domain/standings/standings-tiebreaker-agreement.test.ts` - Imports from shared harness, removed inline helpers
- `tests/tiebreakers-engine.test.ts` - Updated mock to match new engine (removed defineTiedTeams guard, added depth cap); test targets retained rest.length guard
- `tests/tiebreakers-steps.test.ts` - Added lost-to-all and both-branches fixtures

## Decisions Made

- **Depth cap value: 128.** Comfortably exceeds the largest P4 conference (SEC and Big Ten at 18 teams each) while still failing fast on a genuine runaway. This is a backstop, not the termination argument -- termination rests on `alreadyCommitted` growing monotonically.
- **Updated existing test assertion in tiebreakers-engine.test.ts.** The test "should throw when restart does not strictly shrink the tied group" previously pinned the deleted `defineTiedTeams` size guard. Updated to exercise the retained `rest.length >= tiedTeams.length` partition-remainder guard instead. The mock evaluator now returns a partition with `rest` larger than `tiedTeams` to trigger it.
- **Three-bucket partition preserves tiedTeams order.** Within each bucket (beat-all, middle, lost-to-all), teams appear in the same order they had in the input `tiedTeams` array, so nothing new is introduced that depends on team-id order.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lint errors in standings-tiebreaker-agreement.test.ts**
- **Found during:** Task 3 (lint verification)
- **Issue:** After Task 1's refactor, `Game` and `Team` type imports were unused, and a duplicate `import { mulberry32, generatePicks, readSlate }` existed (one at top, one where the inline functions were deleted)
- **Fix:** Removed unused type imports, deduplicated the helper import, moved it to the import block at top of file
- **Files modified:** tests/domain/standings/standings-tiebreaker-agreement.test.ts
- **Committed in:** b37ced7 (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for lint to pass. No scope change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared generated-season harness (`tests/helpers/generated-seasons.ts`) is ready for Plan 02's `n-seed-ranking.test.ts`, `trace-isolation.test.ts`, and `n-seed-decision-rate.test.ts`
- The engine's `resolveTiedGroup` now accepts `depth` as a final parameter; Plan 02's `resolveConferenceRanking` loop will pass `depth + 1` naturally
- The lost-to-all repair produces multi-team top buckets the ACC never produced before; `resolveTiedGroup` emits these in raw team-id order (the third defect), which Plan 02 fixes
- Known transitional state: between Plans 01 and 02, disputed teams still collapse onto one shared rank in the display, exactly as they do today

## Self-Check: PASSED

- All created files exist on disk (3/3)
- All commit hashes found in git log (5/5)

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-18*
