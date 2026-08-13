---
phase: 01-data-pipeline
plan: 05
subsystem: infra
tags: [cfbd, zod, tsx, node-fs, cli-script, static-data]

# Dependency graph
requires:
  - phase: 01-data-pipeline (Plans 01-04)
    provides: cfbd/zod/tsx/vitest tooling, computeScheduleHash, schemas (transformTeam/transformGame/reportRequiredFieldFailures), vendorLogo/buildCoverageReport
provides:
  - "scripts/fetch-data.ts — CLI orchestration entrypoint (pnpm fetch-data <season>) wiring fetch -> validate -> vendor -> hash -> write"
  - "Committed public/data/2026/teams.json (138 FBS teams), games.json (888 games, scheduleHash 19c9e609), coverage.json (0 required-field failures, 0 logos missing)"
  - "Vendored public/logos/*.png (138 team logos) + placeholder.svg"
  - "Empirical resolution of RESEARCH.md Open Questions #1 (championship seasonType) and #2 (FCS opponent ids)"
affects: [foundation-read-only-slate, standings-engine-ui, tiebreaker-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI script order: hard-fail validation gate (process.exit(1)) always precedes any writeFile call, so a bad fetch never partially commits data"
    - "Soft-warn vendoring (logo failures recorded in coverage.json, never block the write)"

key-files:
  created:
    - scripts/fetch-data.ts
    - public/data/2026/teams.json
    - public/data/2026/games.json
    - public/data/2026/coverage.json
    - public/logos/*.png (138 files)
  modified: []

key-decisions:
  - "Open Question #1 resolved empirically: all 888 fetched games are seasonType: 'regular' — zero 'postseason' games exist this far ahead of the season. Conference championship games are not yet scheduled by CFBD for 2026; Phase 5's standings/tiebreaker engine must construct championship matchups from computed standings rather than reading a pre-existing 'postseason' game record."
  - "Open Question #2 resolved empirically: 127 of 888 games have an awayId not present in teams.json — CFBD's classification: 'fbs' filter on /games admits FBS-vs-FCS games (FCS opponent appears only as an id, not in the FBS teams list). Per DATA-06/DATA-07's raw-passthrough requirement, fetch-data.ts does not filter these out; documented for Phase 2/5 planners to handle (e.g. resolving unknown team ids to a synthetic 'non-FBS opponent' display)."

patterns-established:
  - "Fetch script never logs the raw CFBD_API_KEY value in any branch (grep-enforced in Task 1's acceptance criteria)"
  - "Coverage report is the single source of truth for logo/required-field completeness — no silent blanks"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07]

coverage:
  - id: D1
    description: "scripts/fetch-data.ts CLI orchestration script (fetch -> validate -> vendor -> hash -> write pipeline)"
    requirement: "DATA-01"
    verification:
      - kind: other
        ref: "pnpm run typecheck:scripts (tsc --noEmit -p tsconfig.scripts.json)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed 2026 teams.json (138 FBS teams) and games.json (888 games, scheduleHash 19c9e609) from a live CFBD fetch"
    requirement: "DATA-01"
    verification:
      - kind: other
        ref: "node -e file-existence/parseability check (public/data/2026/{teams,games}.json) — see Plan Verification"
        status: pass
    human_judgment: false
  - id: D3
    description: "coverage.json reports 0 required-field failures and 0 missing logos across all 138 teams; logos vendored into public/logos/*.png"
    requirement: "DATA-04"
    verification:
      - kind: other
        ref: "public/data/2026/coverage.json summary: {totalTeams:138, requiredFieldFailures:0, logosVendored:138, logosMissing:0}"
        status: pass
    human_judgment: false
  - id: D4
    description: "conferenceGame and seasonType in committed games.json are raw, unmodified CFBD values (no re-derivation), enabling Phase 5 to exclude non-regular-season games from standings"
    requirement: "DATA-06"
    verification:
      - kind: other
        ref: "scripts/lib/schemas.ts transformGame passthrough (Plan 03, unit-tested); empirically confirmed all 888 fetched games are seasonType: 'regular'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Human sanity spot-check of the final committed dataset (team counts, spot-checked programs, logo plausibility, .env not staged)"
    verification: []
    human_judgment: true
    rationale: "Task 3 was a checkpoint:human-verify gate requiring visual/data plausibility judgment no automated check substitutes for; human responded 'Approved' after reviewing team counts, 4 spot-checked programs (Ohio State/Alabama/Texas/Michigan), and confirming .env never appears in git status."

# Metrics
duration: 25min
completed: 2026-08-13
status: complete
---

# Phase 01 Plan 05: Fetch-Data Orchestration & Live 2026 Dataset Summary

**CLI script (`pnpm fetch-data <season>`) wired to the live CFBD API, producing a committed, human-approved 2026 dataset: 138 FBS teams, 888 games, scheduleHash `19c9e609`, 0 required-field failures, 0 missing logos.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (2 auto, 1 checkpoint:human-verify)
- **Files modified:** scripts/fetch-data.ts + 3 JSON files + 138 logo PNGs

## Accomplishments

- Wrote `scripts/fetch-data.ts`, the CLI orchestration entrypoint that wires together Plans 02-04's pure library functions (`computeScheduleHash`, `transformTeam`/`transformGame`/`reportRequiredFieldFailures`, `vendorLogo`/`buildCoverageReport`) with the live `cfbd` SDK, following the fetch -> validate (hard-fail) -> vendor (soft-warn) -> hash -> write pipeline exactly as specified.
- Ran `pnpm fetch-data 2026` against the real CFBD API and committed the resulting dataset: `public/data/2026/teams.json` (138 teams), `games.json` (888 games, `scheduleHash: 19c9e609`), `coverage.json` (0 required-field failures, 138 logos vendored, 0 missing), and `public/logos/*.png` (138 files) plus `placeholder.svg`.
- Empirically resolved both of RESEARCH.md's Open Questions against real data instead of leaving them as assumptions (see Decisions Made below).
- Obtained human sign-off (Task 3 checkpoint) on the final dataset before treating it as this phase's deliverable.

## Task Commits

1. **Task 1: Write the fetch-data.ts orchestration script** - `d9cd4d2` (feat)
2. **Task 2: Run the live fetch and verify Open Questions #1/#2 against real data** - `9c4c953` (feat)
3. **Task 3: Human spot-check of the committed dataset** - checkpoint only, no code change; human approval obtained by the orchestrator (no additional commit — dataset was already committed in Task 2)

**Plan metadata:** (this commit) `docs(01-05): complete fetch-data.ts orchestration plan`

## Files Created/Modified

- `scripts/fetch-data.ts` - CLI entrypoint (`pnpm fetch-data <season>`); reads `CFBD_API_KEY` from `.env`, fetches FBS teams/games, hard-fails on any required-field validation failure before writing anything, vendors logos with soft-warn fallback to placeholder, computes `scheduleHash`, writes the three JSON files
- `public/data/2026/teams.json` - 138 FBS teams with `id`, `school`, `mascot`, `abbreviation`, `conference`, `classification`, `color`, `alternateColor`, `logo`
- `public/data/2026/games.json` - 888 games with `id`, `week`, `seasonType`, `homeId`, `homeTeam`, `awayId`, `awayTeam`, `conferenceGame`, `neutralSite`, plus top-level `scheduleHash: 19c9e609`
- `public/data/2026/coverage.json` - per-team required-field/logo pass-fail entries and summary `{totalTeams:138, requiredFieldFailures:0, logosVendored:138, logosMissing:0}`
- `public/logos/*.png` - 138 vendored team logo images (plus pre-existing `placeholder.svg` from Plan 04)

## Decisions Made

- **Open Question #1 (conference-championship `seasonType`) — resolved empirically:** All 888 fetched games carry `seasonType: 'regular'`. Zero `'postseason'` games exist in this fetch. This far ahead of the 2026 season, CFBD has not yet scheduled conference championship games. **Consequence for later phases:** Phase 5 (Standings Engine) cannot rely on filtering an existing `seasonType: 'postseason'` game to find the championship matchup — it must construct the championship matchup from computed regular-season standings instead. Documented here rather than assumed, per the plan's explicit instruction not to silently assume the `'postseason'` value would appear.
- **Open Question #2 (FBS/FCS classification-filter behavior) — resolved empirically:** 127 of 888 games have an `awayId` that does not appear in `teams.json`'s FBS team list. CFBD's `/games?classification=fbs` filter includes any game where the *home* team is FBS, even when the away opponent is FCS — the FCS opponent's id is present in the raw game data but absent from the FBS teams dataset. Per DATA-06/DATA-07's raw-passthrough requirement, `fetch-data.ts` does **not** filter these games out or synthesize a placeholder team record for the FCS side. This is documented for Phase 2 (slate display, which will need a fallback for unresolvable team ids) and Phase 5 (standings, which must ensure these non-conference FBS-vs-FCS games are still counted toward overall record but never toward conference record).
- No architectural deviations from the plan. `scripts/fetch-data.ts` implements the pipeline exactly as specified in Task 1's action block.

## Deviations from Plan

None - plan executed exactly as written. Both auto tasks (1 and 2) completed without needing any Rule 1-4 auto-fixes; the live fetch succeeded on the first run with a valid `CFBD_API_KEY` already present in `.env` (no auth-gate checkpoint was needed), and `logosMissing` came back at 0, well under the plan's "stop if >15-20 missing" threshold.

## Issues Encountered

None.

## User Setup Required

None for this plan — `CFBD_API_KEY` was already configured in `.env` from Plan 01's `user_setup`, and the live fetch used it successfully without requiring a new auth-gate checkpoint.

## Plan-Level Verification (re-run at close-out)

All items from `01-05-PLAN.md`'s `<verification>` block were re-run and confirmed still green:

- `pnpm run typecheck:scripts` — exits 0, zero type errors (`tsc --noEmit -p tsconfig.scripts.json`).
- File-existence/parseability check — re-ran the plan's exact `node -e` snippet:
  ```
  node -e "const g=JSON.parse(require('fs').readFileSync('public/data/2026/games.json','utf8')); const t=JSON.parse(require('fs').readFileSync('public/data/2026/teams.json','utf8')); if (!g.scheduleHash || !Array.isArray(g.games) || g.games.length===0 || !Array.isArray(t.teams) || t.teams.length===0) process.exit(1); console.log(t.teams.length, g.games.length, g.scheduleHash)"
  ```
  Output: `138 888 19c9e609` — exits 0.
- `pnpm vitest run` — full suite from Plans 01-04 remains green: 3 test files, 25 tests, all passed.
- Human typed "approved" for Task 3 (obtained by the orchestrator prior to this close-out run; documented in `<already_completed>` handoff context).
- `git status --short` confirmed clean working tree; `.env` does not appear as staged/untracked.

## Next Phase Readiness

- Phase 1's real deliverable — a trustworthy, committed 2026 dataset (`public/data/2026/teams.json`, `games.json`, `coverage.json`, `public/logos/*.png`) — is complete and human-approved.
- All 7 DATA requirements (DATA-01 through DATA-07) are now fully satisfied by final artifacts, not just intermediate pieces.
- Phase 2 (Foundation & Read-Only Slate) can build `useTeams`/`useGames` composables directly against these committed JSON files via `$fetch`.
- Phase 5 (Standings Engine) and Phase 3 (Tiebreaker Engine) planners should account for the two empirical findings above: no pre-scheduled `'postseason'` championship game record exists yet, and 127 games reference an FCS `awayId` not present in `teams.json`.
- This was the last plan in Phase 1 (Wave 3, plan 5 of 5) — all 5 plans in the phase are now complete at the plan-tracking level.

---
*Phase: 01-data-pipeline*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: scripts/fetch-data.ts
- FOUND: public/data/2026/teams.json
- FOUND: public/data/2026/games.json
- FOUND: public/data/2026/coverage.json
- FOUND: public/logos/ (138 PNG files + placeholder.svg)
- FOUND commit: d9cd4d2 (Task 1)
- FOUND commit: 9c4c953 (Task 2)
- Re-run verification: typecheck:scripts exits 0, file-existence check prints `138 888 19c9e609`, pnpm vitest run — 3 files / 25 tests passed
- git status clean, .env not tracked
