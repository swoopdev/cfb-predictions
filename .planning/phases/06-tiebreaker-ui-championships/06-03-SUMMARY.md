---
phase: 06-tiebreaker-ui-championships
plan: 03
subsystem: standings-ui
tags: [vue, nuxt, typescript, tanstack-query, composables, standings, tiebreakers]

# Dependency graph
requires:
  - phase: 06-tiebreaker-ui-championships (Plan 02)
    provides: "resolveConferenceRanking / championshipFor / ConferenceRanking / RankGroup — the engine's ordered N-seed partition"
provides:
  - "computeStandings ranks strictly from the engine's ordered partition (D-01); the union-find over seed-group/W-L equivalence is deleted"
  - "StandingsResult tightened to Readonly<Record<ConferenceId, readonly StandingsTeam[]>> (WR-06) — the not-ready state is undefined, never {}"
  - "app/composables/useStandings.ts — the single seam for picks/rankings/standings (IN-02), replacing two divergent computeds in the week page"
  - "One championship shape (ConferenceRanking via championshipFor); resolveConferenceChampionship and ChampionshipResult are gone"
affects: [06-tiebreaker-ui-championships (Plans 04-06 build ChampionshipCard, TiebreakerReasoning, and useManualTiebreakers on top of useStandings/ConferenceRanking)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standings/tiebreaker orchestration lives behind one composable (useStandings), following usePickProgress.ts's shape: explicit `computed` import, `season = 2026` default, consumption of useGames/useTeams rather than $fetch"
    - "Constructive rank assembly (walk ordered groups, concatenate) instead of a comparator or an equivalence-closure union-find — preserves non-transitivity safety"
    - "Type predicate (`value is ConferenceId`) is the sanctioned way to narrow untrusted string input against a readonly literal-union array, in place of a blanket `as readonly string[]` cast"

key-files:
  created:
    - app/composables/useStandings.ts
  modified:
    - shared/types/standings.ts
    - shared/domain/standings/computeStandings.ts
    - shared/domain/standings/resolveTiebreakers.ts
    - shared/domain/standings/index.ts
    - shared/domain/tiebreakers/engine.ts
    - shared/domain/tiebreakers/types.ts
    - tests/domain/standings/computeStandings.test.ts
    - tests/domain/standings/standings-tiebreaker-agreement.test.ts
    - tests/domain/standings/standings.fixtures.ts (via tests/fixtures/standings.fixtures.ts)
    - app/pages/week/[week].vue
    - app/components/StandingsSidebar.vue
    - app/components/StandingsTable.vue
    - tests/components/StandingsSidebar.test.ts

key-decisions:
  - "D-01 supersedes Phase 5's D-04: rank groups are exactly the engine's RankGroup partition, never a display-layer closure over 'same seed group' union 'identical conference W-L' — the latter is what let an ACC table render 1 Boston College 6-2 above 1 Duke 7-2"
  - "IN-02's 'toOutcomes derived twice' note: left as-is. resolveAllConferences and computeStandings each call toOutcomes internally; useStandings deliberately adds no third call site and does not thread outcomes through as a new domain-API parameter, because the measured cost (Phase 5's ~7ms full recompute, Phase 6's +0.45ms N-seed resolution) is far below any threshold that would justify widening the public signature"
  - "T-06-07: activeConference (arbitrary ?conf= query input) is narrowed to ConferenceId via a type-predicate function backed by P4_CONFERENCES.includes, not a blanket cast — this is what lets the tightened StandingsResult be indexed without reintroducing `as readonly string[]`"

requirements-completed: [TIE-08]

coverage:
  - id: D1
    description: "Distinct ranks 1..N wherever the tiebreaker procedure determined an order; teams with identical records land on different ranks when separated, and share a rank only when the engine's own RankGroup could not separate them"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/standings/computeStandings.test.ts#ranking (STAND-04, D-01)"
        status: pass
      - kind: unit
        ref: "tests/domain/standings/standings-tiebreaker-agreement.test.ts#violationsFor rank/group-membership agreement"
        status: pass
    human_judgment: false
  - id: D2
    description: "One composable (useStandings) owns the standings/tiebreaker seam with one readiness guard; the week page holds no inline computeStandings/resolveAllConferences calls and no empty-object sentinel"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "pnpm typecheck (StandingsResult | undefined threaded end to end)"
        status: pass
      - kind: unit
        ref: "pnpm test (402 -> 404 passing, full suite)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SEC, Big Ten, Big 12, ACC standings render correctly in the browser with distinct ranks and grouped ties, no console warning, on a substantially-picked season"
    verification: []
    human_judgment: true
    rationale: "Requires visual confirmation in pnpm dev per the plan's <human-check> block — not exercised by this automated session"

# Metrics
duration: ~35min (across Tasks 1-3, this session resumed at Task 3)
completed: 2026-08-18
status: complete
---

# Phase 6 Plan 3: Rank from the engine's partition, tighten StandingsResult, extract useStandings Summary

**Deleted the standings layer's own union-find rank closure in favor of the engine's ordered partition (D-01), tightened `StandingsResult` to always carry all four P4 conferences (WR-06), and collapsed the week page's two divergent standings computeds into one `useStandings` composable (IN-02).**

## Performance

- **Duration:** ~35 min across all three tasks (18:55–19:14 local time, single continuous session split across a context reset before Task 3)
- **Completed:** 2026-08-18
- **Tasks:** 3/3 completed
- **Files modified:** 13 (1 created: `app/composables/useStandings.ts`)

## Accomplishments

- `computeStandings` now assembles rows by walking `ConferenceRanking.groups` directly and concatenating — no `recordKey`, `rankComponents`, `seedPlacements`, `resolvedSeedGroups`, `compareWithinComponent`, or `orderedComponents` remain anywhere in the standings layer
- `StandingsResult` is `Readonly<Record<ConferenceId, readonly StandingsTeam[]>>`; the not-ready state is `undefined`, never an empty object
- `resolveConferenceChampionship` and `ChampionshipResult` are deleted; `championshipFor(ranking)` is the one way to read a conference's championship spots
- `app/composables/useStandings.ts` is the single seam standings/tiebreakers pass through: one `ready` guard, `picks`/`rankings`/`standings` computeds, no watcher/debounce
- `app/pages/week/[week].vue` no longer imports or calls `computeStandings`/`resolveAllConferences`; it calls `useStandings()` and passes `standings` straight to `StandingsSidebar`
- `StandingsSidebar.vue`'s `activeConference` narrowing uses a `value is ConferenceId` type predicate instead of casting `P4_CONFERENCES` to `readonly string[]`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rank from the engine's partition and delete the union-find** - `0b78525` (feat)
2. **Task 2: Rewrite the three assertions this phase reverses** - `79fe71d` (test)
3. **Task 3: Extract useStandings and collapse the week page's orchestration** - `6df3df7` (feat)

_This SUMMARY covers all three tasks; Tasks 1 and 2 were completed and committed in a prior session, verified present in `git log` before Task 3 began._

## Files Created/Modified

**Task 1** (`shared/types/standings.ts`, `shared/domain/standings/{computeStandings,resolveTiebreakers,index}.ts`, `shared/domain/tiebreakers/{engine,types}.ts`) — tightened `StandingsResult`, deleted the union-find ranking block, deleted the transitional `resolveConferenceChampionship`/`ChampionshipResult` shim, retargeted a Phase 3 engine test.

**Task 2** (`tests/domain/standings/computeStandings.test.ts`, `tests/domain/standings/standings-tiebreaker-agreement.test.ts`, `tests/fixtures/standings.fixtures.ts`) — rewrote the D-04 rank-sharing describe block to D-01 distinct-rank assertions, replaced `violationsFor` clause (iii) with a rank/group-membership agreement check, added hand-built `ConferenceRanking`/`RankGroup` fixtures.

**Task 3** (this session):
- `app/composables/useStandings.ts` (new) — `useStandings(season = 2026)` returning `{ picks, rankings, standings }`, `rankings`/`standings` typed `... | undefined`
- `app/pages/week/[week].vue` — deleted the `resolvedTiebreakers`/`standings` computeds and their `computeStandings`/`resolveAllConferences` imports; calls `useStandings(2026)` and destructures `standings`
- `app/components/StandingsSidebar.vue` — `standings` prop is `StandingsResult | undefined`; added `isP4Conference(value): value is ConferenceId` type predicate; `selectedConference`/`visibleConferences` now typed `ConferenceId`/`ConferenceId[]`; template indexes with `standings?.[conference] ?? []`
- `app/components/StandingsTable.vue` — `standings` prop widened to `readonly StandingsTeam[]` (see Deviations)
- `shared/domain/tiebreakers/engine.ts` — trailing blank line removed (see Deviations)
- `tests/components/StandingsSidebar.test.ts` — added an `undefined`-standings render case and an explicit unrecognised-conference fallback case

## Decisions Made

- **D-01 supersedes D-04** (Task 1/2): rank groups come only from the engine's `RankGroup` partition; no display-layer equivalence closure over conference record exists anymore. This was the flagship user-visible reversal the phase exists to make.
- **IN-02's duplicated `toOutcomes` call is left alone** (Task 3): threading outcomes through as a new parameter to `resolveAllConferences`/`computeStandings` would widen the domain API for a cost too small to matter (combined well under a frame). Recorded explicitly per the plan's `<output>` requirement.
- **`activeConference` narrowing via type predicate, not a cast at the call site** (Task 3): `isP4Conference(value): value is ConferenceId` keeps the single membership check (`P4_ORDER.includes`) as the one place P4 membership is verified, and lets `selectedConference`/`visibleConferences` come out properly typed so the tightened `StandingsResult` can be indexed without a second `as readonly string[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `StandingsTable.vue`'s `standings` prop widened to `readonly StandingsTeam[]`**
- **Found during:** Task 3, `pnpm typecheck`
- **Issue:** `StandingsSidebar.vue` indexes the tightened (Task 1) `StandingsResult` — `readonly Record<ConferenceId, readonly StandingsTeam[]>` — and passes the result straight to `<StandingsTable :standings="...">`, whose prop was still typed as mutable `StandingsTeam[]`. TS4104: a readonly array cannot be assigned to a mutable array type, blocking `pnpm typecheck`.
- **Fix:** Changed `StandingsTable`'s `standings` prop to `readonly StandingsTeam[]`. The component only reads (`v-for`, template interpolation) and never mutates the array, so this is a pure type tightening with no behavior change — consistent with `StandingsResult` already being readonly end to end.
- **Files modified:** `app/components/StandingsTable.vue`
- **Verification:** `pnpm typecheck` exits 0
- **Committed in:** `6df3df7` (Task 3 commit)

**2. [Rule 1 - Bug] Trailing blank line removed from `shared/domain/tiebreakers/engine.ts`**
- **Found during:** Task 3, `pnpm lint`
- **Issue:** Task 1's deletion of the transitional `resolveConferenceChampionship` shim left one trailing blank line past the file's last statement, tripping `@stylistic/no-multiple-empty-lines` (max 0 at end of file).
- **Fix:** Ran `pnpm lint --fix`; the tool removed the single trailing blank line. No code change.
- **Files modified:** `shared/domain/tiebreakers/engine.ts`
- **Verification:** `pnpm lint` exits 0
- **Committed in:** `6df3df7` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking/lint — both mechanical, zero behavior change)
**Impact on plan:** Both fixes were required for the plan's own acceptance criteria (`pnpm typecheck exits 0`, `pnpm lint exits 0`) to pass; neither changes runtime behavior or scope.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useStandings()` is now the composable Plan 05 extends with `useManualTiebreakers`/`decisions` and Plan 04/06 read `ConferenceRanking`/`RankGroup` from to build `ChampionshipCard` and `TiebreakerReasoning`
- `ConferenceRanking`/`RankGroup`/`championshipFor` are the one championship shape going forward; no future plan should need to reintroduce `ChampionshipResult`
- The plan's `<verification>` `<human-check>` (visual confirmation of distinct ranks and grouped ties in `pnpm dev`) was not exercised in this automated session — flagged as `human_judgment: true` (D3) in the coverage block above for the verifier/UAT pass
- No blockers for Plan 04

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-18*
