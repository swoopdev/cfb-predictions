---
phase: 01-data-pipeline
plan: 03
subsystem: infra
tags: [zod, validation, schema, tdd, wave-1]

# Dependency graph
requires: ["01-01"]
provides:
  - "scripts/lib/schemas.ts exporting RawTeamSchema, RequiredTeamFieldsSchema, transformTeam, reportRequiredFieldFailures, RawGameSchema, transformGame, TeamOutput, GameOutput"
affects: [01-05-fetch-script]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required-vs-nullable Zod schema split (RawTeamSchema -> RequiredTeamFieldsSchema.extend()) drives D-09's hard-fail gate without duplicating field literals"
    - "Verbatim passthrough transform (transformGame) — parse then re-emit named fields with zero derivation logic, enforced by a negative grep gate on homeConference/awayConference"

key-files:
  created:
    - scripts/lib/schemas.ts
    - tests/schemas.test.ts
  modified: []

key-decisions: []

requirements-completed: [DATA-01, DATA-02, DATA-05, DATA-06, DATA-07]

coverage:
  - id: D1
    description: "transformTeam returns exactly the 8 TeamOutput fields (no logo/logos) matching the well-formed fixture verbatim"
    requirement: "DATA-01"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/schemas.test.ts -t \"team transform\""
        status: pass
    human_judgment: false
  - id: D2
    description: "transformGame returns exactly the 9 GameOutput fields matching each of the 3 fixture games verbatim"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/schemas.test.ts -t \"game transform\""
        status: pass
    human_judgment: false
  - id: D3
    description: "reportRequiredFieldFailures flags exactly the team missing conference and returns empty array when all required fields are present; never throws"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/schemas.test.ts -t \"required field failures\""
        status: pass
    human_judgment: false
  - id: D4
    description: "conferenceGame is passed through verbatim, never re-derived from team conferences (negative gate: zero homeConference/awayConference references in schemas.ts)"
    requirement: "DATA-06"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/schemas.test.ts -t \"conferenceGame passthrough\""
        status: pass
      - kind: other
        ref: "grep -c \"homeConference\\|awayConference\" scripts/lib/schemas.ts -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "seasonType is passed through verbatim for both regular and postseason fixture cases"
    requirement: "DATA-07"
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/schemas.test.ts -t \"seasonType passthrough\""
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-13
status: complete
---

# Phase 1 Plan 3: Team/Game Validation and Transform Summary

**Zod v4 required-vs-nullable schema split for CFBD's raw Team/Game shapes, with verbatim (never re-derived) passthrough of `conferenceGame`/`seasonType` — the single validation boundary Plan 05's fetch script will hard-fail against.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-13T10:07:xx-06:00
- **Completed:** 2026-08-13T10:08:58-06:00
- **Tasks:** 1 (TDD: RED, GREEN, no REFACTOR needed)
- **Files modified:** 2

## Accomplishments
- `RawTeamSchema`/`RequiredTeamFieldsSchema` (via clean `.extend()`, no duplicate field literals) implements D-09's hard-fail split: `conference`/`color`/`alternateColor` required non-null, everything else nullable per RESEARCH.md Pitfall 4
- `transformTeam` returns exactly the 8-field `TeamOutput` shape (no `logo`/`logos` — added later by Plan 05 after `vendorLogo`)
- `reportRequiredFieldFailures` never throws — maps every raw team through `safeParse`, filters to failures, reports `{ teamId, errors }` via `z.flattenError().fieldErrors`
- `transformGame` copies `conferenceGame`/`seasonType`/all 9 `GameOutput` fields straight from the `RawGameSchema` parse result with zero derivation logic — verified both by test assertions (DATA-06/DATA-07 passthrough behavior) and a negative grep gate confirming `schemas.ts` never references `homeConference`/`awayConference`
- All 5 of 01-VALIDATION.md's requirement-mapped `-t` filters (`"team transform"`, `"game transform"`, `"required field failures"`, `"conferenceGame passthrough"`, `"seasonType passthrough"`) independently resolve to at least one passing test
- `pnpm run typecheck:scripts` and `pnpm exec eslint scripts/lib/schemas.ts tests/schemas.test.ts` both exit clean; full `pnpm vitest run` (including Plan 02's `schedule-hash.test.ts`) passes 15/15

## Task Commits

Each task was committed atomically (TDD RED/GREEN):

1. **Task 1 RED:** `a25a176` — `test(01-03): add failing test for team/game validation and transform` — confirmed failure via unresolved module import, not assertion failures
2. **Task 1 GREEN:** `1282fe0` — `feat(01-03): implement team/game validation and transform` — all 10 tests pass (8 plan-specified behavior cases + 2 direct `RequiredTeamFieldsSchema` checks)
3. **REFACTOR:** skipped — `.extend()` already avoided duplicate schema-shape literals between `RawTeamSchema` and `RequiredTeamFieldsSchema`; nothing to clean up (same precedent as Plan 02)

**Plan metadata:** committed after this SUMMARY is written

## Files Created/Modified
- `scripts/lib/schemas.ts` (new) — `RawTeamSchema`, `RequiredTeamFieldsSchema`, `transformTeam`, `TeamOutput`, `reportRequiredFieldFailures`, `RequiredFieldFailure`, `RawGameSchema`, `transformGame`, `GameOutput`
- `tests/schemas.test.ts` (new) — 10 tests across 6 `describe` blocks (`team transform`, `game transform`, `required field failures`, `conferenceGame passthrough`, `seasonType passthrough`, plus a `RequiredTeamFieldsSchema` direct-check block), reading both committed fixture files from `tests/fixtures/`

## Decisions Made
None beyond the plan's explicit instructions — implementation matched the plan's Code Examples (RESEARCH.md Pattern 1 / Zod schema example) almost verbatim.

## Deviations from Plan

None — plan executed exactly as written. Two extra `it` blocks were added under a `RequiredTeamFieldsSchema` describe (direct `safeParse` accept/reject checks) beyond the 8 plan-specified behavior cases — additive test coverage, not a deviation from any plan constraint.

## TDD Gate Compliance

RED gate commit (`a25a176`, `test(01-03): ...`) precedes GREEN gate commit (`1282fe0`, `feat(01-03): ...`) in git log. RED phase confirmed as a genuine failure (module resolution error, not a false-positive passing test) before any implementation code was written. No REFACTOR commit — none needed.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- `transformTeam`/`transformGame`/`reportRequiredFieldFailures` are ready for Plan 05's `fetch-data.ts` orchestration to import directly and wire into the hard-fail gate (D-09) and final `teams.json`/`games.json` write step.
- No blockers for Plan 04 (coverage.ts) or Plan 05 (fetch-data.ts orchestration).

---
*Phase: 01-data-pipeline*
*Completed: 2026-08-13*

## Self-Check: PASSED

All created files (scripts/lib/schemas.ts, tests/schemas.test.ts) and commit hashes (a25a176, 1282fe0) verified present on disk / in git log.
