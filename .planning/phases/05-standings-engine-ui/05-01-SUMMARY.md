---
phase: 05-standings-engine-ui
plan: 01
subsystem: standings
tags: [standings, tiebreakers, domain-logic, vue-ui, testing]
status: complete

requires:
  - shared/domain/tiebreakers (Phase 3) — deriveConferenceRecords, resolveConferenceChampionship, CONFERENCE_RULES
  - usePicksStorage (Phase 4) — reactive picks ref
  - useTeams / useGames (Phase 2) — TanStack Query data sources
  - app/pages/week/[week].vue (Phase 2) — host page for the sidebar
provides:
  - computeStandings() — the single standings implementation for Phases 5 and 6
  - resolveAllConferences() — per-conference tiebreaker orchestration, framework-free
  - toOutcomes() — picks → outcome map with untrusted-input validation
  - StandingsTable.vue — reusable single-conference standings table
  - StandingsResult / StandingsTeam / ConferenceRecord types
affects:
  - Plan 05-02 — wraps StandingsTable in StandingsSidebar for all 4 conferences
  - Phase 6 — consumes computeStandings + resolveAllConferences for manual tie resolution

tech-stack:
  added: []
  patterns:
    - Pure domain logic in shared/domain/, zero Vue imports, consumed by a computed() in the component layer
    - Reuse of the tiebreaker engine's deriveConferenceRecords as the sole win/loss tallier
    - Explicit `import { useId } from 'vue'` in components so they mount in the plain vitest project

key-files:
  created:
    - shared/types/standings.ts
    - shared/domain/standings/computeStandings.ts
    - shared/domain/standings/resolveTiebreakers.ts
    - shared/domain/standings/index.ts
    - app/components/StandingsTable.vue
    - tests/domain/standings/computeStandings.test.ts
    - tests/fixtures/standings.fixtures.ts
    - tests/components/StandingsTable.test.ts
    - .planning/phases/05-standings-engine-ui/deferred-items.md
  modified:
    - app/pages/week/[week].vue
    - vitest.config.ts

decisions:
  - Reused deriveConferenceRecords (Phase 3) instead of writing a second W-L tallier, per its own DRY contract and PROJECT.md
  - Tiebreaker result orders teams WITHIN a shared rank rather than splitting the rank, reconciling D-04 with D-11
  - Added resolveAllConferences() to shared/domain/ so the week page holds no tiebreaker orchestration
  - P4 membership derived from CONFERENCE_RULES rather than re-listed

metrics:
  duration: ~50 min
  completed: 2026-08-14
  tasks: 3
  commits: 3
  tests_added: 41
---

# Phase 5 Plan 01: Standings Engine & SEC Sidebar Summary

A pure `computeStandings()` that tallies conference and overall records separately for all four P4 conferences and ranks teams so identical records share a rank, rendered as an SEC standings table pinned beside the week's game slate and recomputed on every pick with no debounce.

## What Was Built

**`shared/domain/standings/computeStandings.ts`** — the standings engine. Framework-free (verified: no `vue`, `@vue/*`, or `nuxt` string appears anywhere under `shared/domain/standings/`), non-mutating, and deterministic. It:

- validates untrusted picks at the boundary via `toOutcomes()`, dropping picks whose `gameId` isn't on the slate and picks whose winner didn't play in that game;
- tallies **overall** records once across the whole slate for every P4 team, and **conference** records per conference from games that are both flagged `conferenceGame` and played between two members;
- sorts by conference win percentage, then wins, then losses, then the resolved tiebreaker order, then school name, then id;
- assigns standard competition ranks so every team with an identical conference record shares one rank and the next distinct record skips ahead (three teams at 6-2 all show `2`, next team shows `5`).

**`shared/domain/standings/resolveTiebreakers.ts`** — runs Phase 3's `resolveConferenceChampionship` once per P4 conference, assembling the membership set, conference-game filter, validated outcome map, and FBS id set the engine needs. Failures are isolated per conference: a throw omits that one conference and standings fall back to record ordering, rather than blanking the sidebar.

**`app/components/StandingsTable.vue`** — a real `<table>` (D-03) with `Rank | Team | Overall Record | Conf Record` in that order (D-08/D-09), Nuxt UI semantic tokens for colour, no badges or tooltips on ties (D-05/D-06), a `sr-only` caption, and `scope`d headers.

**`app/pages/week/[week].vue`** — restructured into a two-column layout: the existing slate on the left, a standings `<aside>` on the right that is sticky and independently scrollable on desktop and collapses behind a labelled toggle on narrow viewports. Standings come from a plain `computed` over `(games, teams, picks)` — no watcher, no debounce.

## Key Decisions

**Reused `deriveConferenceRecords` rather than writing a second tallier.** The plan's Task 1 spelled out a manual per-game win/loss loop, but Phase 3's `records.ts` already contains that logic and its own docblock names Phase 5's standings engine as the caller that "must import it rather than re-deriving conference win/loss tallying". CLAUDE.md's DRY constraint ("standings computation … has exactly one implementation") makes this the binding reading. It is also generic in `(games, outcomes, teamIds)`, so the same function produces the overall records by being handed the full slate.

**The tiebreaker result orders teams *within* a rank; it does not change the rank.** The plan and the phase context pull in two directions here: D-04 fixes the rank number for tied teams, while D-11/D-12 say Phase 5 consumes a resolved tiebreaker ranking. Promoting a tiebreaker winner to its own rank would break the plan's own stated must-have ("three teams tied at 6-2 all show `2`"). Resolving the conflict by letting the tiebreaker decide *display order inside the tie group* satisfies both, and is what a real standings page does.

**`resolveAllConferences()` lives in `shared/domain/`, not in the page.** The plan's Task 2 note put the per-conference `resolveConferenceChampionship` calls in `week/[week].vue`. That setup — membership set, conference-game filter, validated outcome map, FBS id set for the Big 12's total-wins cap — is exactly what Phase 6 needs too, and duplicating it in a component would violate the "tiebreaker logic has one implementation" constraint.

**P4 membership is derived, not re-listed.** `P4_CONFERENCES = Object.keys(CONFERENCE_RULES)` — one definition of "which conferences are P4" in the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - DRY constraint] Reused the tiebreaker engine's record tallier instead of hand-rolling one**
- **Found during:** Task 1
- **Issue:** The plan's action text described a bespoke per-game win/loss loop. `shared/domain/tiebreakers/records.ts` already implements exactly that and explicitly designates Phase 5 as its consumer. Writing a second one would have produced two implementations of the same math — the precise failure mode CLAUDE.md's DRY constraint forbids, and the highest-severity item in the plan's own threat register (T-05-01, "Tampering / computeStandings logic").
- **Fix:** `computeStandings` calls `deriveConferenceRecords` twice — once with the full slate against all P4 ids for overall records, once per conference with the conference-game subset for conference records.
- **Files modified:** `shared/domain/standings/computeStandings.ts`
- **Commit:** a6870f6

**2. [Rule 2 - Missing critical functionality] `resolveConferenceChampionship` signature does not match the plan's assumption**
- **Found during:** Task 1
- **Issue:** The plan assumed `resolveConferenceChampionship(games, teams, picks)` returning a full conference ordering. The real Phase 3 signature is `(conference, conferenceGames, outcomes, teamIds, allSeasonGames?, knownFbsTeamIds?)` returning a `ChampionshipResult` with only seeds 1 and 2. It also **throws** when the outcome map contains a winner that did not play in the referenced game — reachable directly from hand-edited localStorage.
- **Fix:** Added `shared/domain/standings/resolveTiebreakers.ts` with `resolveAllConferences()`, which builds the correct arguments per conference, feeds it a `toOutcomes()`-validated map, and catches per-conference throws so one bad conference cannot take down the other three. `computeStandings` accepts the result as an optional `ResolvedTiebreakers` map and degrades to record ordering when a conference is absent.
- **Files modified:** `shared/domain/standings/resolveTiebreakers.ts` (new), `shared/domain/standings/computeStandings.ts`, `shared/domain/standings/index.ts`
- **Commit:** a6870f6

**3. [Rule 2 - Missing critical functionality] Added a component render test and a coverage gate**
- **Found during:** Tasks 2 and 3
- **Issue:** Task 2's verify step was `npm run dev -- open http://localhost:3000/week/1`, which is not executable in this environment, leaving "StandingsTable renders correctly with sample standings data" (plan `<verification>`) unverifiable. Separately, `<verification>` requires >85% coverage but `vitest.config.ts` scoped its only coverage threshold to `shared/domain/tiebreakers/**`, so nothing enforced it.
- **Fix:** Added `tests/components/StandingsTable.test.ts` (5 cases: column order, row formatting, tied-rank rendering with an explicit no-badge/no-icon assertion, section labelling, empty state) and made it mountable by importing `useId` explicitly from `vue`. Added an 85% threshold on `shared/domain/standings/**` to `vitest.config.ts`.
- **Files modified:** `tests/components/StandingsTable.test.ts` (new), `app/components/StandingsTable.vue`, `vitest.config.ts`
- **Commits:** 8e698a0, 373ef79

**4. [Rule 4 boundary - resolved without escalation] Rank semantics conflict between D-04 and D-11**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 step 3 said "If Resolved: use the returned order to rank teams", which contradicts its own must-have that three teams tied at 6-2 all show rank `2`.
- **Fix:** The tiebreaker order sorts teams within a shared rank without altering rank numbers. Both stated behaviours hold simultaneously, so no architectural decision was required. Covered by two explicit tests (`uses a resolved tiebreaker to order teams within a tie without changing their rank`, `ignores a needsUserInput tiebreaker result and keeps the deterministic fallback order`).
- **Files modified:** `shared/domain/standings/computeStandings.ts`
- **Commit:** a6870f6

### Scope Notes

- Plan 05-01 renders **SEC only**, per its Task 2 text. `computeStandings` already returns all four conferences; Plan 05-02 adds the `StandingsSidebar` wrapper, the filter-aware rendering (D-02), and the full mobile drawer.
- The mobile collapse here is the plan's "collapsible hint" — a labelled toggle with `aria-expanded`/`aria-controls`. Plan 05-02 owns the polished treatment.

## Deferred Issues

**Pre-existing test suite failures (out of scope, not fixed).** `pnpm test` fails 11 test files / 45 tests that Phase 5 does not touch — broken `~/shared/...` import aliases, a `_currentPicks` rename that left its usages behind, and Nuxt auto-import failures in the PickProgress component tests. Confirmed pre-existing (`git diff --name-only HEAD~2 HEAD` lists none of them). Documented in `.planning/phases/05-standings-engine-ui/deferred-items.md` with a per-file cause table.

## Verification

| Check | Result |
|---|---|
| `computeStandings` unit tests | 36 passed |
| `StandingsTable` render tests | 5 passed |
| Coverage, `shared/domain/standings/**` | 98.9% stmts, 86% branches, 100% funcs, 100% lines — gate passes |
| No Vue/Nuxt imports in `shared/domain/standings/` | Clean (grep) |
| `pnpm run lint` (whole repo) | Passes |
| `pnpm run typecheck` (`nuxt typecheck`) | Passes |
| `pnpm run build` | Succeeds; 15 routes prerendered |
| Real-data smoke run (888 games, 138 teams) | All 4 conferences populated; resolve + compute in ~7 ms, so no debounce is warranted |

**All four P4 conferences in output:** asserted (`Object.keys(result).sort()` equals `['ACC','Big 12','Big Ten','SEC']`), with G5 explicitly excluded.

**Records tracked separately:** asserted on a team that finishes 3-1 in conference and 5-1 overall — different numerator *and* denominator, so a bug reusing one for the other cannot pass.

**Ties share a rank:** asserted on a deliberate head-to-head cycle (Florida beat Georgia, Georgia beat LSU, LSU beat Florida) that the SEC procedure genuinely cannot resolve, producing ranks `[1, 2, 2, 2, 5]`.

## Known Stubs

None. Every rendered value is wired to real computed data.

## Threat Flags

None. No new network endpoint, auth path, file access, or trust boundary was introduced — the plan's registered boundaries (picks → standings, data → computation, tiebreaker → ranking) are all mitigated in `toOutcomes()` and `resolveAllConferences()`'s per-conference catch, each with dedicated tests.

## For the Next Phase

- Import from `#shared/domain/standings`, never from the individual modules — `shared/domain/` is outside Nuxt's auto-import scope, so the import must be explicit.
- `computeStandings` already returns all four conferences; Plan 05-02 only needs to choose which to render.
- Phase 6 should replace the `resolvedTiebreakers` argument with its manually-resolved equivalent. The parameter is optional and the shape is `Partial<Record<ConferenceId, ChampionshipResult>>`, so no signature change is needed.
- The `isTied` flag on each row is populated but currently unused by the UI (matching rank numbers carry the meaning per D-05/D-06). It is there if a later phase wants it.

## Self-Check: PASSED

All 9 claimed files exist on disk; all 3 claimed commits (`a6870f6`, `8e698a0`, `373ef79`) exist in git history.
