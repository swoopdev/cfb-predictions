---
phase: 01-data-pipeline
fixed_at: 2026-08-13T17:33:43Z
review_path: .planning/phases/01-data-pipeline/01-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-08-13T17:33:43Z
**Source review:** .planning/phases/01-data-pipeline/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01 Critical, WR-01 and WR-02 Warning; IN-01/IN-02/IN-03 Info findings intentionally left out of scope for this pass)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: CFBD SDK error responses are silently ignored — API failures overwrite committed data with empty/partial output

**Files modified:** `scripts/fetch-data.ts`
**Commit:** `9b4414a`
**Applied fix:** Replaced the `data`-only destructure/`?? []` fallback for both `getFbsTeams` and `getGames` with explicit checks of the SDK's `error` field and a missing-`data` guard, each `process.exit(1)`-ing with a descriptive message before any further work happens. Also added a "successful-but-empty" sanity check (`rawTeams.length === 0` / `rawGames.length === 0`) per the review's "Consider also guarding against..." note, since a misconfigured query param could return 200 with an empty array and cause the same silent-overwrite failure mode. Downstream `rawTeams ?? []` / `rawGames ?? []` usages were simplified to `rawTeams` / `rawGames` since both are now guaranteed non-null by the guards. Verified with `tsc --noEmit -p tsconfig.scripts.json` (clean) and `vitest run` (all pre-existing tests green) — did not re-run `pnpm fetch-data 2026` against the live API, and the committed `public/data/2026/*.json` files were not touched (confirmed via `git diff --stat` against the pre-fix commit).

### WR-01: `scripts/fetch-data.ts` orchestration has zero test coverage

**Files modified:** `scripts/fetch-data.ts`, `scripts/lib/fetch-source.ts` (new), `tests/fetch-source.test.ts` (new)
**Commit:** `c2be878`
**Applied fix:** Extracted the fetch+validate+gate sequence (SDK calls, CR-01's error/empty-response checks, and the team required-field gate) into a new, side-effect-free `fetchSourceData(season, deps)` function in `scripts/lib/fetch-source.ts`, mirroring the existing `opts`-based dependency-injection pattern already used by `vendorLogo`. `deps.fetchTeams`/`deps.fetchGames` are zero-arg closures so the exact `getFbsTeams`/`getGames` SDK call shapes never leak into the injectable interface, keeping it trivially mockable. `scripts/fetch-data.ts` now calls `fetchSourceData` and only handles the `process.exit`/console-output side effects on failure. Added 8 new unit tests in `tests/fetch-source.test.ts` covering: the happy path, teams-request error (without calling `fetchGames`), missing-data-no-error, empty-teams-response, games-request error, empty-games-response, structured team-failure reporting, and reservation regarding rejected promises. All tests use `vi.fn().mockResolvedValue(...)` — no real network calls. Verified with `tsc --noEmit` (clean) and `vitest run` (33/33 passing, up from 25).

### WR-02: Game schema failures crash with a raw Zod exception instead of the structured report team failures get

**Files modified:** `scripts/lib/fetch-source.ts`, `scripts/lib/schemas.ts`, `tests/fetch-source.test.ts`, `tests/schemas.test.ts`
**Commit:** `9125ae4`
**Applied fix:** Added `reportGameFailures(rawGames)` to `scripts/lib/schemas.ts` as the game-validation sibling of `reportRequiredFieldFailures` — maps every raw game through `RawGameSchema.safeParse` and returns only the failures, never throwing, reporting every failing game in one pass. Wired it into `fetchSourceData` (added by the WR-01 fix) as a gate run before the function returns `{ ok: true, ... }`, positioned after the team-failure gate so `transformGame` in `fetch-data.ts`'s `.map()` is only ever called on already-validated games. Added tests: `reportGameFailures` unit tests in `tests/schemas.test.ts` (flags the one malformed game with a `conferenceGame` error, returns `[]` when all games are valid) and an integration-level test in `tests/fetch-source.test.ts` confirming `fetchSourceData` reports the structured game failure (with `gameId` and `errors`) instead of throwing. Verified with `tsc --noEmit` (clean) and `vitest run` (36/36 passing, up from 33).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-08-13T17:33:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
