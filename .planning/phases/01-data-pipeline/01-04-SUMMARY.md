---
phase: 01-data-pipeline
plan: 04
subsystem: infra
tags: [zod-free, node-fs, node-fetch, ssrf-defense, coverage-report, svg]

# Dependency graph
requires:
  - phase: 01-data-pipeline (Plan 01)
    provides: "vitest.config.ts, tsconfig.scripts.json, tests/fixtures/cfbd-teams-sample.json"
provides:
  - "vendorLogo(teamId, logoUrl, opts) — async logo download with actual-success verification, https-only gate, skip-if-exists (force-bypassable), never throws"
  - "buildCoverageReport(season, entries) — D-08 JSON coverage report shape with pass/fail per-team mapping and summary counts, no env access"
  - "public/logos/placeholder.svg — team-agnostic shield-outline fallback icon (currentColor stroke, zero hardcoded hex)"
affects: ["01-05-fetch-script"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vendorLogo's injectable fetchImpl/writeFileImpl/existsImpl trio for pure unit-testability of an I/O-heavy function, defaulting to global fetch / node:fs/promises writeFile / node:fs existsSync"
    - "SSRF-adjacent URL-scheme gate (startsWith('https:')) applied before any outbound fetch on API-sourced URLs"

key-files:
  created:
    - scripts/lib/coverage.ts
    - tests/coverage.test.ts
    - public/logos/placeholder.svg
  modified: []

key-decisions:
  - "vendorLogo's exists-check runs before the https-scheme validation (matches plan's specified GREEN order) — an already-vendored file short-circuits to 'ok' without ever touching the URL, including non-https URLs, unless force:true is passed"
  - "buildCoverageReport's doc comment avoids the literal string 'process.env' so the plan's own grep -c \"process.env\" scripts/lib/coverage.ts gate (expects 0) isn't tripped by a code comment referencing the concept"
  - "placeholder.svg uses a closed shield outline (M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z) rather than a helmet — simpler single closed path, still reads as a generic sports-badge icon, no hardcoded hex per D-06"

patterns-established:
  - "Pattern: I/O-performing functions in scripts/lib/ take an opts object of injectable implementations (fetchImpl/writeFileImpl/existsImpl) defaulting to real Node/global APIs — keeps unit tests free of real network/filesystem access"

requirements-completed: [DATA-04, DATA-05]

coverage:
  - id: D1
    description: "vendorLogo classifies empty/missing, non-https, download-failure, network-error, skip-if-exists, and force-bypass outcomes without ever throwing"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "tests/coverage.test.ts#vendorLogo (8 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildCoverageReport produces accurate per-team pass/fail mapping and summary counts, and never leaks CFBD_API_KEY into the serialized report"
    requirement: "DATA-05"
    verification:
      - kind: unit
        ref: "tests/coverage.test.ts#buildCoverageReport (2 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "public/logos/placeholder.svg exists as a genuinely team-color-agnostic fallback icon (zero hardcoded hex, currentColor stroke)"
    requirement: "DATA-04"
    verification:
      - kind: other
        ref: "test -f public/logos/placeholder.svg && grep -Ec '#[0-9A-Fa-f]{6}' public/logos/placeholder.svg -> 0"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-13
status: complete
---

# Phase 1 Plan 4: Logo Vendoring and Coverage Report Summary

**RED-GREEN vendorLogo (https-only, actual-download-verified, skip-if-exists/force logo vendoring) and buildCoverageReport (D-08 JSON pass/fail report), plus a hand-authored team-agnostic shield SVG placeholder**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-13T10:11:55-06:00
- **Completed:** 2026-08-13T10:13:53-06:00
- **Tasks:** 1 (TDD: RED, GREEN, plus one static-asset sub-step)
- **Files modified:** 3

## Accomplishments
- `vendorLogo` implemented with an SSRF-adjacent `https:`-only scheme gate enforced before any network attempt, skip-if-exists optimization (bypassable via `force: true`), and actual-download-success verification per D-05 (empty/absent URL → `missing`; non-ok response, thrown error, or non-https URL → `download-failed`; never throws)
- `buildCoverageReport` implemented per the Shared Output Contract — maps each team entry to `pass`/`fail` for both required fields and logo status, computes accurate summary counts via a single `reduce`, and never reads environment variables (secret hygiene verified by a dedicated test asserting `CFBD_API_KEY` never appears in the serialized output even when set)
- `public/logos/placeholder.svg` hand-authored as a closed shield-outline path using `stroke="currentColor"` and zero hardcoded hex values, satisfying D-06's "genuinely team-agnostic" requirement
- All 10 behavior cases in `tests/coverage.test.ts` pass; full repo test suite (25 tests across 3 files) remains green; `pnpm lint` and `pnpm run typecheck:scripts` both exit clean

## Task Commits

Each task was committed atomically (TDD RED → GREEN, plus a separate static-asset commit):

1. **Task 1 RED: add failing test for vendorLogo and buildCoverageReport** - `50586c8` (test)
2. **Task 1 GREEN: implement vendorLogo and buildCoverageReport** - `5b7fc57` (feat)
3. **Static asset: add team-agnostic placeholder logo SVG** - `d08aea3` (feat)

**Plan metadata:** committed after this SUMMARY is written

_No REFACTOR commit — implementation was already a single clean pipeline with no dead branches, per the plan's own "REFACTOR: none required" instruction._

## Files Created/Modified
- `tests/coverage.test.ts` - 10 tests covering vendorLogo's 8 behavior cases (missing/empty URL, success, download-failed via non-ok response, download-failed via thrown/rejected fetch, non-https rejection without a fetch attempt, skip-if-exists, force-bypass) and buildCoverageReport's 2 cases (pass/fail mapping + summary counts, secret-hygiene)
- `scripts/lib/coverage.ts` - `vendorLogo(teamId, logoUrl, opts?)` and `buildCoverageReport(season, entries)`, exported per the plan's documented signatures
- `public/logos/placeholder.svg` - closed shield-outline icon, `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.5"`, no hardcoded color values

## Decisions Made
- Kept the plan's specified check order in `vendorLogo`: not-found short-circuit → skip-if-exists (before URL-scheme validation) → https gate → try/catch fetch+write. This means an already-vendored file skips even a malformed/non-https URL unless `force: true`, matching the plan's Task 1 GREEN instructions verbatim.
- Rewrote the JSDoc comment above `buildCoverageReport` to say "environment variables" instead of the literal string "process.env", since the plan's acceptance criterion (`grep -c "process.env" scripts/lib/coverage.ts` reports 0) would otherwise be tripped by the comment itself, not just code.
- Chose a shield outline over a helmet outline for the placeholder icon (both were pre-approved options per CONTEXT.md's "Claude's Discretion") — a single closed path is simpler to hand-author correctly and still reads as a generic sports-badge icon with no team-specific silhouette.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint `@stylistic/operator-linebreak` violation on the `VendorLogoResult` union type**
- **Found during:** Task 1 GREEN verification (`pnpm lint`)
- **Issue:** The multi-line union type's leading `|` on each variant line violated the repo's stylistic ESLint config's operator-linebreak expectation for the `=` sign placement.
- **Fix:** Ran `pnpm eslint . --fix`, which moved the `=` to the start of the continuation line (`export type VendorLogoResult\n  = | { ... }\n    | { ... }`).
- **Files modified:** `scripts/lib/coverage.ts`
- **Verification:** `pnpm lint` exits 0 with zero errors.
- **Committed in:** `5b7fc57` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] JSDoc comment tripped the plan's own `process.env` grep acceptance gate**
- **Found during:** Task 1 GREEN verification (running the plan's stated acceptance-criteria greps)
- **Issue:** A doc comment above `buildCoverageReport` said `` Never reads `process.env` `` — this literal string match caused `grep -c "process.env" scripts/lib/coverage.ts` to report 1 instead of the required 0, even though the function contains no actual `process.env` access.
- **Fix:** Reworded the comment to "Never reads environment variables" — same meaning, no longer matches the literal grep pattern.
- **Files modified:** `scripts/lib/coverage.ts`
- **Verification:** `grep -c "process.env" scripts/lib/coverage.ts` now reports 0.
- **Committed in:** `5b7fc57` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs blocking the plan's own stated acceptance criteria)
**Impact on plan:** Both fixes are minimal and cosmetic (lint formatting, comment wording) — no behavior change, no scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None required to complete this plan. Plan 05's live orchestration run (which will call `vendorLogo` against the real CFBD API and write `coverage.json`) still needs the `CFBD_API_KEY` obtained during Plan 01 — not a new requirement introduced here.

## Next Phase Readiness
- `scripts/lib/coverage.ts` exports `vendorLogo` and `buildCoverageReport`, ready for Plan 05's orchestration script to import and call against real CFBD team data.
- `public/logos/placeholder.svg` exists at the path Plan 05's `TeamOutput.logo` fallback (`/logos/placeholder.svg`) will reference for `missing`/`download-failed` teams.
- This was the last plan in Wave 2 (parallel to 01-02 and 01-03, which completed earlier on this same branch). Plan 01-05 (Wave 3) depends on all three (02, 03, 04) and can now proceed — all three plans' exports (`computeScheduleHash`, `transformTeam`/`transformGame`/`reportRequiredFieldFailures`, `vendorLogo`/`buildCoverageReport`) are committed and the full test suite (25 tests) is green.
- No blockers identified.

---
*Phase: 01-data-pipeline*
*Completed: 2026-08-13*
