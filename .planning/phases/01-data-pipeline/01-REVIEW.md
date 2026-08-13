---
phase: 01-data-pipeline
reviewed: 2026-08-13T17:22:55Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - public/data/2026/coverage.json
  - public/data/2026/games.json
  - public/data/2026/teams.json
  - public/logos/placeholder.svg
  - scripts/env.d.ts
  - scripts/fetch-data.ts
  - scripts/lib/coverage.ts
  - scripts/lib/schedule-hash.ts
  - scripts/lib/schemas.ts
  - tests/coverage.test.ts
  - tests/fixtures/cfbd-games-sample.json
  - tests/fixtures/cfbd-teams-sample.json
  - tests/schedule-hash.test.ts
  - tests/schemas.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-13T17:22:55Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the fetch script, its `scripts/lib/*` helpers, their tests, and the committed `public/data/2026/*` output. The unit-level logic (`vendorLogo`, `buildCoverageReport`, `computeScheduleHash`, `transformTeam`/`transformGame`, the schema definitions) is solid: the numeric schedule-hash sort, the `https:`-only vendoring gate, the never-log-the-secret discipline, and the hard-fail-on-required-fields gate all hold up under inspection and are backed by targeted tests. Cross-checking the committed data files against the code confirms internal consistency (scheduleHash recomputes correctly, no duplicate ids, all vendored logo files exist and are real PNGs, `coverage.json` summary counts match the arrays).

The orchestration script (`scripts/fetch-data.ts`), however, never inspects the `error` field the CFBD SDK returns alongside `data`. Traced against the installed `@hey-api/client-fetch@0.6.0` runtime: any non-2xx HTTP response (expired/invalid API key, rate limit, 5xx) resolves rather than throws, with `data: undefined, error: {...}`. The script only reads `data`, defaults it to `[]`, and proceeds — meaning an API failure silently produces an empty (or partial) dataset that gets written over the currently-committed, correct `public/data/2026/*.json`, in direct violation of the documented "hard-fail-before-any-write" invariant. This is the one finding in this review that rises to Critical.

## Critical Issues

### CR-01: CFBD SDK error responses are silently ignored — API failures overwrite committed data with empty/partial output

**File:** `scripts/fetch-data.ts:32-39`
**Issue:**

```ts
const { data: rawTeams } = await getFbsTeams({ query: { year: season } })
const { data: rawGames } = await getGames({ query: { year: season, classification: 'fbs' } })

const failures = reportRequiredFieldFailures(rawTeams ?? [])
if (failures.length > 0) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}
```

`getFbsTeams`/`getGames` are called with the SDK's default `ThrowOnError = false`. Verified against the installed `@hey-api/client-fetch@0.6.0` runtime (`node_modules/.pnpm/@hey-api+client-fetch@0.6.0/.../dist/index.js`): when the HTTP response is not `ok` (401 from an invalid/expired key, 429 rate limit, 5xx, etc.), the client **resolves** — it does not throw — with `{ data: undefined, error: <parsed body> }`. Only a hard network failure (DNS/connection refused) would reject the promise.

Because this code destructures only `data` and immediately falls back to `rawTeams ?? []` / `rawGames ?? []`, any HTTP-level failure is indistinguishable from "the season legitimately has zero teams/games." Tracing through:
- `reportRequiredFieldFailures([])` returns `[]` (nothing to check) → the hard-fail gate passes.
- `teams` ends up `[]`, `games` ends up `[]`.
- `computeScheduleHash([])` succeeds (returns a valid 8-hex-char hash, per `tests/schedule-hash.test.ts`).
- The script proceeds to `mkdir` + write all three files, **overwriting the currently-correct 888-game / 138-team committed dataset with empty arrays**, and exits 0 while printing "Fetched 0 teams, 0 games."

This is exactly the failure mode the phase's threat model calls out (hard-fail-before-any-write) but the gate only covers *required-field* validation failures on data that was actually returned — it does nothing for the more basic case of the request itself failing. A rotated/expired `CFBD_API_KEY`, a temporary CFBD outage, or a rate limit during a re-fetch would silently destroy the committed schedule data unless the developer happens to notice the "0 teams, 0 games" console line before running `git add`.

**Fix:** Check `error` (and treat a missing `data` as fatal) before doing anything else, and fail loudly:

```ts
const { data: rawTeams, error: teamsError } = await getFbsTeams({ query: { year: season } })
if (teamsError || !rawTeams) {
  console.error('Failed to fetch teams from CFBD:', teamsError ?? '(no data returned)')
  process.exit(1)
}

const { data: rawGames, error: gamesError } = await getGames({ query: { year: season, classification: 'fbs' } })
if (gamesError || !rawGames) {
  console.error('Failed to fetch games from CFBD:', gamesError ?? '(no data returned)')
  process.exit(1)
}
```

Consider also guarding against a *successful-but-suspiciously-empty* response (e.g. `rawTeams.length === 0`) with a minimum sanity threshold, since a misconfigured query param could return 200 with an empty array too.

## Warnings

### WR-01: `scripts/fetch-data.ts` orchestration has zero test coverage

**File:** `scripts/fetch-data.ts` (whole file)
**Issue:** `tests/` covers `scripts/lib/coverage.ts`, `scripts/lib/schedule-hash.ts`, and `scripts/lib/schemas.ts` thoroughly, but there is no test for `scripts/fetch-data.ts` itself — the module that wires the SDK calls, the hard-fail gate, and the three file writes together. CR-01 is exactly the class of bug that orchestration-level tests catch and unit tests on the lib functions cannot: each lib function behaves correctly in isolation, but the glue code that's supposed to check the SDK response and enforce "nothing is written on failure" has no coverage at all.
**Fix:** Either extract the fetch+validate+gate sequence into a small, injectable function (mirroring the `opts`-based dependency injection already used in `vendorLogo`) so it can be unit tested with a mocked `getFbsTeams`/`getGames` that returns an `error`, or add a thin integration test that stubs the `cfbd` module and asserts no files are written when `error` is present.

### WR-02: Game schema failures crash with a raw Zod exception instead of the structured report team failures get

**File:** `scripts/fetch-data.ts:63`, `scripts/lib/schemas.ts:120-133`
**Issue:** Team validation failures go through `reportRequiredFieldFailures`, which never throws and produces a clean, structured JSON report (`fetch-data.ts:35-39`) before exiting. Game validation has no equivalent: `games = (rawGames ?? []).map(raw => transformGame(raw))` calls `RawGameSchema.parse(raw)` directly inside `transformGame`, so a single malformed game (e.g. missing `conferenceGame`, confirmed to reject via `tests/schemas.test.ts:60-64`) throws an uncaught `ZodError` mid-map, killing the script with a raw stack trace. Behaviorally this still satisfies the "nothing is written" invariant (the throw happens before any `writeFile` call), but it gives operators a materially worse debugging experience than the team path, and — because it throws mid-`.map()` — doesn't report *all* the failing games in one pass the way `reportRequiredFieldFailures` does for teams.
**Fix:** Add a `reportGameFailures`/`safeParse`-based sibling to `reportRequiredFieldFailures` for games, and gate on it the same way, before mapping with `transformGame`.

## Info

### IN-01: `scripts/env.d.ts` is now dead code with a stale comment

**File:** `scripts/env.d.ts:1-4`
**Issue:** The file exists solely to give `tsc -p tsconfig.scripts.json` an input file "until Plans 02-05 add scripts/fetch-data.ts and scripts/lib/*.ts." Those plans have landed — `scripts/fetch-data.ts` and three files under `scripts/lib/` now exist and are picked up by `tsconfig.scripts.json`'s `"include": ["scripts/**/*.ts", "tests/**/*.ts"]`. The placeholder no longer serves any purpose and its comment is actively misleading to a future reader (references plans that already shipped).
**Fix:** Delete `scripts/env.d.ts`; confirm `pnpm typecheck:scripts` still passes without it (it will, since real `.ts` files already satisfy `include`).

### IN-02: `coverage.json`'s per-team `requiredFields`/`missingFields` can never show `'fail'` in any committed report

**File:** `scripts/fetch-data.ts:54-60`
**Issue:** `coverageEntries.push({ ..., requiredFieldsOk: true, missingFields: [] ... })` is hardcoded, because by the time this loop runs, the hard-fail gate at line 35-39 has already guaranteed every entry in `rawTeams` passed `RequiredTeamFieldsSchema`. That's correct given the current control flow, but it means the `requiredFields`/`missingFields` columns in every committed `coverage.json` are tautological — they will read `'pass'`/`[]` for every team in every successful run, forever, and can never actually surface a soft-warn signal the way the `logo` column does. Confirmed against the committed `public/data/2026/coverage.json`: `requiredFieldFailures: 0` and every team's `requiredFields: 'pass'`.
**Fix:** Either derive `requiredFieldsOk`/`missingFields` per-team from the actual `RequiredTeamFieldsSchema.safeParse` result (so the report stays meaningful if the hard-fail gate is ever relaxed to a soft-warn for some field), or drop the per-team required-fields detail from the report and note in a comment that it's gated upstream.

### IN-03: Logo URL extracted via unchecked cast instead of the schema-validated value

**File:** `scripts/fetch-data.ts:46`
**Issue:** `const rawLogo = (raw as { logos?: string[] | null }).logos?.[0]` re-casts the raw, unvalidated `raw` object rather than reading `logos` off the already-parsed result. It happens to be safe today only because `transformTeam(raw)` on the preceding line already ran `RequiredTeamFieldsSchema.parse(raw)` (which validates `logos: z.array(z.string()).nullable()`) and would have thrown first if the shape were wrong — but that safety is incidental to line ordering, not enforced by the cast itself. If `transformTeam`'s schema is ever narrowed to omit `logos`, or the two lines are ever reordered, this cast would start accepting unvalidated data with no type or runtime check catching it.
**Fix:** Have the parse step return the validated `logos` value directly (e.g. parse against `RawTeamSchema` once and read `.logos` off the result) instead of a second unchecked cast of the original `raw` value.

---

_Reviewed: 2026-08-13T17:22:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
