---
phase: 02-foundation-read-only-slate
plan: 01
subsystem: ui
tags: [nuxt, tanstack-query, vue-query, nuxt-ui, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: "Committed public/data/2026/{teams,games}.json envelopes and vendored public/logos/{id}.png + placeholder.svg"
provides:
  - "app/plugins/vue-query.ts — single app-wide QueryClient (staleTime/gcTime Infinity)"
  - "app/utils/queryKeys.ts — queryKeys.teams(season)/queryKeys.games(season) factory"
  - "shared/types/schedule.ts — Team/Game, the single DRY type source for app/"
  - "useTeams()/useGames() composables — sole read path into public/data/{season}/*.json for every future phase"
  - "app/utils/schedule.ts — groupByConference, determineLoadState pure functions"
  - "app/components/GameCard.vue — UCard-based game card with FCS-opponent fallback and badges"
  - "app/pages/week/[week].vue — primary slate route with loading/error/populated states"
  - "app/pages/index.vue — redirect to /week/1"
affects: [02-02-static-build-config, 02-03-filters, 02-04-week-nav]

# Actuals (#2632)
actuals:
  tokens: 5441
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query-key factory + thin useQuery-wrapper composable (queryKeys.ts + useTeams/useGames), staleTime/gcTime: Infinity for immutable static JSON"
    - "Envelope-preserving fetch: fetchTeams unwraps .teams, fetchGamesEnvelope returns the full {season, scheduleHash, games} object unchanged"
    - "Pure-function extraction (groupByConference, determineLoadState) for TDD-covered logic, wired into the page via computed()"

key-files:
  created:
    - app/plugins/vue-query.ts
    - app/utils/queryKeys.ts
    - app/utils/fetchSchedule.ts
    - app/utils/schedule.ts
    - shared/types/schedule.ts
    - app/composables/useTeams.ts
    - app/composables/useGames.ts
    - app/components/GameCard.vue
    - app/pages/week/[week].vue
    - tests/composables/fetch-schedule.test.ts
    - tests/lib/group-games.test.ts
    - tests/lib/load-state.test.ts
  modified:
    - app/pages/index.vue

key-decisions:
  - "Kept RESEARCH.md's literal `import { $fetch } from 'ofetch'` approach — probed that Nuxt's generated tsconfig aliases 'ofetch' for the app build AND vi.mock('ofetch', factory) works in plain vitest without needing the real package resolvable at the project root, so no deviation from the plan's stated approach was needed"
  - "GameCard: same img-then-name row order for both away and home sides (per RESEARCH.md's worked example) rather than mirroring the home side — keeps left-to-right visual scanning consistent"

patterns-established:
  - "Composables are the sole read path into public/data/{season}/*.json — no other file in app/ should call $fetch/fetchTeams/fetchGamesEnvelope directly"
  - "TDD tasks (Task 2, Task 3) follow RED (failing test, `test(...)` commit) -> GREEN (`feat(...)` commit) -> no REFACTOR needed when the first implementation was already the simplest correct shape"

requirements-completed: [FOUND-02, SLATE-04, SLATE-05]

coverage:
  - id: D1
    description: "TanStack Query plugin + query-key factory + Team/Game types + useTeams()/useGames() as the sole typed, cached read path into public/data/2026/{teams,games}.json, correctly unwrapping teams.json's envelope while preserving games.json's full envelope (scheduleHash intact)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "tests/composables/fetch-schedule.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Games within a week group under their home team's conference and sort alphabetically (D-07)"
    verification:
      - kind: unit
        ref: "tests/lib/group-games.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Loading/error precedence logic: error takes priority over pending, pending over ready"
    verification:
      - kind: unit
        ref: "tests/lib/load-state.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "GameCard renders every game inside a UCard with away-left/home-right fixed ordering, FCS-opponent name-only + placeholder-shield fallback (D-06), neutral-site/conference-game badges (D-08), and truncated team names with a title tooltip"
    requirement: "SLATE-04"
    verification:
      - kind: manual_procedural
        ref: "pnpm dev, navigate to /week/1: confirmed 200 response, no console/log errors, /data/2026/{teams,games}.json and /logos/placeholder.svg all reachable (200)"
        status: pass
    human_judgment: true
    rationale: "Visual correctness of card layout, logo rendering, badge placement, and FCS-opponent fallback appearance requires human eyes in the browser — no component-mount test exists yet in this repo (RESEARCH.md Wave 0 gap: @vue/test-utils/happy-dom not installed), so this is verified by dev-server smoke test + source review, not an automated render assertion."
  - id: D5
    description: "week/[week].vue: Number()-coerced week param filters games, shows 6 USkeleton placeholders during initial load, the exact Copywriting Contract error state (no retry button) on query failure, and the grouped grid once ready; index.vue redirects to /week/1 (D-12)"
    requirement: "SLATE-05"
    verification:
      - kind: manual_procedural
        ref: "pnpm dev: curl /week/1 and /week/14 both 200, no dev-server errors; grep-verified no scripts/lib/schemas import in app/, <UCard present in GameCard.vue, no <UButton in the error branch"
        status: pass
    human_judgment: true
    rationale: "Full URL-reflects-state / deep-link / back-forward behavior (SLATE-05's complete scope) isn't fully exercisable until Plan 02-03 adds conf/team query params and Plan 02-02 adds the static-build prerender config; this plan's slice (week path segment + loading/error UI) was smoke-tested via dev server, not a browser-automated test."

duration: 22min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 1: Foundation Data Layer & Read-Only Week Slate Summary

**TanStack Query data layer (`useTeams`/`useGames`) plus a conference-grouped, loading/error-aware `/week/[week]` page rendering real `UCard` game cards with FCS-opponent fallback.**

## Performance

- **Duration:** 22 min
- **Tasks:** 3
- **Files modified:** 13 (12 created, 1 replaced)

## Accomplishments
- Built the sole read path into `public/data/2026/{teams,games}.json` — `app/plugins/vue-query.ts`, `app/utils/queryKeys.ts`, `app/utils/fetchSchedule.ts`, `shared/types/schedule.ts`, `useTeams()`/`useGames()` — with `staleTime`/`gcTime: Infinity` and correct envelope unwrapping (teams) vs. full-envelope passthrough (games, preserving `scheduleHash` for Phase 8)
- `GameCard.vue`: every game renders inside a `UCard`, away-left/home-right fixed ordering, D-06 FCS-opponent name-only + placeholder-shield fallback, D-08 neutral-site/conference-game badges, CSS-truncated team names with `title` tooltips
- `app/pages/week/[week].vue`: `Number()`-coerced week filtering, D-07 conference-grouped alphabetically-sorted layout, 6-`USkeleton` loading state, full-page Copywriting-Contract-exact error state (no retry button) — `determineLoadState` prioritizes error > pending > ready
- `app/pages/index.vue` now redirects to `/week/1` (D-12), replacing the stock Nuxt UI starter page

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "browse a week's games"** — `d021f93` (feat) — tracer slice, verified end-to-end (automated test + typecheck + lint + dev-server smoke test) before expanding
2. **Task 2: Group games by conference (D-07)** — `81e1e43` (test, RED) → `43261e8` (feat, GREEN) — no REFACTOR step needed
3. **Task 3: Loading skeleton and error state** — `6b1dc70` (test, RED) → `63c3024` (feat, GREEN) — no REFACTOR step needed

## Files Created/Modified
- `app/plugins/vue-query.ts` - Registers the app-wide QueryClient (staleTime/gcTime Infinity)
- `app/utils/queryKeys.ts` - `queryKeys.teams(season)`/`queryKeys.games(season)` factory
- `app/utils/fetchSchedule.ts` - `fetchTeams`/`fetchGamesEnvelope`, importing `$fetch` from `ofetch` for plain-vitest testability
- `app/utils/schedule.ts` - `groupByConference`, `determineLoadState` pure functions
- `shared/types/schedule.ts` - `Team`/`Game` interfaces, the single DRY type source for `app/`
- `app/composables/useTeams.ts` / `app/composables/useGames.ts` - thin `useQuery` wrappers
- `app/components/GameCard.vue` - `UCard`-based single-game display
- `app/pages/week/[week].vue` - primary slate route (loading/error/populated states)
- `app/pages/index.vue` - now a redirect to `/week/1` (replaces the stock starter template)
- `tests/composables/fetch-schedule.test.ts`, `tests/lib/group-games.test.ts`, `tests/lib/load-state.test.ts` - pure-logic/fetch tests

## Decisions Made
- Kept the plan's literal `import { $fetch } from 'ofetch'` approach after probing that (a) Nuxt's generated `tsconfig.app.json` path-aliases `ofetch` to the pnpm virtual store for the app build, and (b) `vi.mock('ofetch', factory)` succeeds in plain vitest even though `ofetch` isn't resolvable as a top-level package from the project root — no deviation needed.
- No REFACTOR commits for Task 2/3 — both GREEN implementations were already the simplest correct shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. `groupByConference` falls back to the literal string `'Unknown'` for a game whose home team is absent from `teamsById` — this is a defensive branch, not a stub: the 2026 dataset has 0 games with an unresolvable `homeId` (verified in RESEARCH.md Pitfall 5), so this branch is unreachable against the committed dataset and exists only to keep the function total.

## Next Phase Readiness
- `useTeams`/`useGames`/`queryKeys`/`shared/types/schedule.ts` are ready for every later phase (standings, picks, tiebreakers) to consume without re-fetching.
- `groupByConference` and `determineLoadState` are exported from `app/utils/schedule.ts` for Plan 02-02/02-03/02-04 to extend with `filterGames`, `sanitizeConfParam`, `sanitizeTeamParam`, `buildConfQuery`/`buildTeamQuery`/`buildWeekQuery`, `WEEKS`, `isWeekBoundary`, `determineEmptyStateVariant` per the plan's Artifacts note.
- `nuxt.config.ts` still needs `ssr: false` + `nitro.prerender.routes` + a Cloudflare Pages `_redirects` fallback before a real static deploy — explicitly out of this plan's `files_modified`, deferred to the "static build config" plan in this phase.
- SLATE-05 is only partially exercised here (week path segment only) — `conf`/`team` query-param filters land in a later plan in this phase.

---
*Phase: 02-foundation-read-only-slate*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 13 created/modified files verified present on disk; all 5 task commits (`d021f93`, `81e1e43`, `43261e8`, `6b1dc70`, `63c3024`) verified present in `git log`.
