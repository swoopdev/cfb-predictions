---
phase: 01-data-pipeline
plan: 02
subsystem: infra
tags: [vitest, typescript, node-crypto, sha256, tdd]

# Dependency graph
requires:
  - phase: 01-data-pipeline (Plan 01)
    provides: "vitest.config.ts, tsconfig.scripts.json, tests/fixtures/cfbd-games-sample.json"
provides:
  - "computeScheduleHash(gameIds: number[]): string — pure function, scripts/lib/schedule-hash.ts"
affects: [01-05-fetch-script, phase-8-share-links]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure fingerprint functions live in scripts/lib/*.ts with zero I/O, unit-tested against RESEARCH.md-verified fixture values"

key-files:
  created:
    - scripts/lib/schedule-hash.ts
    - tests/schedule-hash.test.ts
  modified: []

key-decisions:
  - "No REFACTOR step taken — the GREEN implementation (copy, numeric sort, join, hash, slice) was already a single clear expression; extracting a helper per the plan's own REFACTOR guidance ('only if... reads unclearly') was not warranted"

patterns-established:
  - "Numeric sort comparator (a, b) => a - b is mandatory before any game-id join/hash operation — the default lexicographic Array.sort() would silently corrupt this and any future bitpack index (Phase 8) that must use the identical order"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "computeScheduleHash produces the RESEARCH.md-verified 8-hex-char hash 'ffe3f098' for game ids [401628355, 401628301, 401628288] regardless of input array order, is deterministic, always returns /^[0-9a-f]{8}$/, and handles an empty array without throwing"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "tests/schedule-hash.test.ts (5 tests, all pass)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-13
status: complete
---

# Phase 1 Plan 2: computeScheduleHash Summary

**Pure SHA-256-based `computeScheduleHash` fingerprint function, numeric-sorting game ids before hashing (never the default lexicographic sort), verified against the RESEARCH.md-confirmed test vector `[401628355, 401628301, 401628288] -> 'ffe3f098'`.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-13T16:03:33Z
- **Completed:** 2026-08-13T16:04:35Z
- **Tasks:** 1 (RED-GREEN-REFACTOR)
- **Files modified:** 2

## Accomplishments
- `scripts/lib/schedule-hash.ts` exports `computeScheduleHash(gameIds: number[]): string`, a pure function with zero file/network I/O
- Explicit numeric sort comparator `(a, b) => a - b` used before joining/hashing — the exact fix for RESEARCH.md's documented Pitfall 3 (default `.sort()` is lexicographic and would silently produce a different, wrong order)
- All 5 behavior cases pass under Vitest, including the exact verified fixture assertion

## Task Commits

Each task was committed atomically (TDD cycle):

1. **Task 1 RED: add failing test for computeScheduleHash** - `1b4ad50` (test)
2. **Task 1 GREEN: implement computeScheduleHash** - `2116549` (feat)

No REFACTOR commit — implementation was already minimal and clear (see Decisions Made).

**Plan metadata:** committed after this SUMMARY is written

## Files Created/Modified
- `tests/schedule-hash.test.ts` - 5 behavior cases: verified fixture hash, order invariance, hex-format shape, determinism, empty-array handling
- `scripts/lib/schedule-hash.ts` - `computeScheduleHash`, SHA-256 via `node:crypto`, numeric sort, 8-hex-char (u32) truncation

## Decisions Made
- Skipped the REFACTOR step: the plan's own guidance is "only if the sort/hash sequence reads unclearly — extract at most one small named helper." The five-line implementation (spread-copy, numeric sort, join, hash, slice) is already a single clear pipeline; adding a helper would have been ceremony without clarity gain.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `computeScheduleHash` is ready for Plan 05's orchestration script to import and call, writing its output into `games.json`'s top-level `scheduleHash` field
- The numeric sort order established here (`(a, b) => a - b` over raw CFBD game ids) is the exact order Phase 8's share-link bitpack index must replicate — documented in the module's own doc comment as a forward-looking contract
- No blockers for Plans 03/04 (parallel, disjoint files) or Plan 05 (depends on this plan)

---
*Phase: 01-data-pipeline*
*Completed: 2026-08-13*

## Self-Check: PASSED

Created files verified present: `scripts/lib/schedule-hash.ts`, `tests/schedule-hash.test.ts`. Commit hashes verified in git log: `1b4ad50` (test), `2116549` (feat).
