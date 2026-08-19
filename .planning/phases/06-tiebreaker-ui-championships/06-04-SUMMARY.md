---
phase: 06-tiebreaker-ui-championships
plan: 04
subsystem: ui
tags: [vue, nuxt, typescript, tiebreakers, standings, vitest]

# Dependency graph
requires:
  - phase: 06-tiebreaker-ui-championships (Plan 03)
    provides: "computeStandings/useStandings/championshipFor -- the ordered N-seed partition and the composable seam this plan reads rankings from"
provides:
  - "ChampionshipCard.vue -- the TIE-07 dedicated championship-matchup element, reading seed1/seed2 only via championshipFor(ranking)"
  - "StandingsTable.vue's ranking prop -- the one new prop threaded from useStandings() through StandingsSidebar, which Plan 07's rank markers will also read"
  - "The schoolById/hasPickedConferenceGames pattern for deriving card inputs from existing standings rows with no new data source"
affects: [06-tiebreaker-ui-championships (Plan 07 reads the ranking prop threaded here for its rank markers and per-group expansion)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ChampionshipCard.vue is dumb/presentational: no store access, no composable calls, no games/picks prop -- schoolById and hasPickedConferenceGames are both computed by the caller (StandingsTable) from rows it already has"
    - "Loading vs. error state distinguished without a dedicated rows prop: schoolById.size === 0 signals 'no rows yet' (loading, renders nothing); ranking === undefined with a non-empty schoolById signals 'resolution omitted' (error, renders the degraded-state copy)"
    - "At most one candidate block is ever active at a time (championshipFor suppresses seed 2 when seed 1 itself is multi-team), so a single local `expanded` ref covers the P-2 overflow disclosure for both possible render sites"

key-files:
  created:
    - app/components/ChampionshipCard.vue
    - tests/components/ChampionshipCard.test.ts
  modified:
    - app/components/StandingsTable.vue
    - app/components/StandingsSidebar.vue
    - app/pages/week/[week].vue
    - tests/components/StandingsTable.test.ts
    - tests/components/StandingsSidebar.test.ts

key-decisions:
  - "D-14 enforced structurally, not by convention: the component never imports TerminalReason at all, so there is no code path that could branch on it -- the TerminalReason-invariance test (three mounts, three reason codes, byte-identical wrapper.text()) is a mechanical guarantee rather than an assertion someone could forget to update"
  - "State precedence is loading > empty > error > matchup. Loading is checked first regardless of hasPickedConferenceGames so a not-yet-loaded conference never flashes the pick-your-games copy before settling"
  - "ChampionshipCard's own defensive loading state is unreachable in the normal app flow: StandingsTable's zero-teams guard (standings.length > 0) already prevents mounting the card at all when there are no rows, so the loading branch exists purely as a defensive contract verified by unit test, matching the codebase's existing pattern of defensive checks with zero measured occurrences (e.g. resolveConferenceRanking's pool.length === 0 guard)"

requirements-completed: [TIE-07]

coverage:
  - id: D1
    description: "ChampionshipCard reads the championship matchup exclusively via championshipFor(ranking) -- never indexes groups by hand, never receives a standings-row array -- and renders exactly one presentation for an unsettled seed regardless of TerminalReason (D-12, D-14)"
    requirement: "TIE-07"
    verification:
      - kind: unit
        ref: "tests/components/ChampionshipCard.test.ts -- both-resolved, seed-2-candidates, seed-1-as-both-spots, TerminalReason invariance cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Candidates are named (never a placeholder), ordered alphabetically regardless of group.teams order, and overflow beyond three discloses in place with a relabeling control (D-13, P-2)"
    requirement: "TIE-07"
    verification:
      - kind: unit
        ref: "tests/components/ChampionshipCard.test.ts -- alphabetical ordering, ten-candidate overflow disclosure/collapse"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty, error, and loading states render their own dedicated copy with no progress-flavoured or storage-lifecycle vocabulary, and no bare Tailwind palette class or hex literal anywhere in the component"
    requirement: "TIE-07"
    verification:
      - kind: unit
        ref: "tests/components/ChampionshipCard.test.ts -- empty/error/loading states, tone-rule vocabulary, semantic-token-only palette assertion"
        status: pass
    human_judgment: false
  - id: D4
    description: "StandingsTable gains exactly one new prop (ranking), mounts ChampionshipCard between the h3 heading and the table inside the same section, and StandingsSidebar/week page thread useStandings()'s rankings down to it with no new filtering or computation"
    requirement: "TIE-07"
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts -- championship card threading (Plan 06-04); tests/components/StandingsSidebar.test.ts -- rankings threading (Plan 06-04)"
        status: pass
      - kind: unit
        ref: "pnpm test (449/449 passing, full suite)"
        status: pass
    human_judgment: false
  - id: D5
    description: "In pnpm dev, with a partly picked season, each of the four conferences shows a championship element above its table; the ACC shows a named candidate set with overflow disclosure; mid-season and end-of-season unsettled seeds look identical; zero picks shows the pick-your-games copy instead of the whole conference"
    verification: []
    human_judgment: true
    rationale: "Requires visual confirmation in pnpm dev per the plan's <human-check> block -- not exercised by this automated session"

# Metrics
duration: ~55min
completed: 2026-08-19
status: complete
---

# Phase 6 Plan 4: Championship matchup card and the ranking prop threading Summary

**Built `ChampionshipCard.vue` (TIE-07) reading the championship matchup exclusively via `championshipFor(ranking)`, and threaded a single new `ranking` prop from `useStandings()` through `StandingsSidebar` into `StandingsTable`, which now mounts the card above every conference's standings table.**

## Performance

- **Duration:** ~55 min across all three tasks, single continuous session
- **Completed:** 2026-08-19
- **Tasks:** 3/3 completed
- **Files modified:** 7 (2 created: `app/components/ChampionshipCard.vue`, `tests/components/ChampionshipCard.test.ts`)

## Accomplishments

- `ChampionshipCard.vue` renders the championship matchup (both resolved, one seed pending, both spots from one unresolved group, empty, error, loading) entirely from `championshipFor(ranking)` -- no standings-row array, no games/picks prop, no `TerminalReason` import at all
- The candidate overflow control (P-2) shows the first three alphabetically, discloses all in place beyond that, and relabels itself; verified at the measured worst case of ten candidates
- `StandingsTable.vue` gains its only new prop, `ranking`, and mounts the card between the `<h3>` heading and the `<table>` inside the existing `<section>` so the `aria-labelledby` grouping stays intact
- `StandingsSidebar.vue` gains a `rankings` prop and passes `rankings?.[conference]` straight through with no filtering or computation of its own
- `app/pages/week/[week].vue` destructures `rankings` from `useStandings()` and wires it into the sidebar
- The pre-existing D-05/D-06 "no badge, no svg, no 'tied'" assertion in `StandingsTable.test.ts` is now scoped to the table body rather than the whole wrapper, since a card renders in the same section; the assertion's full reversal for D-10's markers remains Plan 07's task

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the ChampionshipCard contract** - `b608b9f` (test)
2. **Task 2: Build ChampionshipCard.vue** - `727d0eb` (feat)
3. **Task 3: Thread the ranking through the sidebar and mount the card above each table** - `2b479ab` (feat)

## Files Created/Modified

- `app/components/ChampionshipCard.vue` (new) - the TIE-07 card: `state` computed (`loading | empty | error | matchup`) drives four mutually exclusive render branches; `primary`/`secondary` computeds wrap `championshipFor`'s output into a `{ kind: 'name' | 'candidates' }` union the template renders generically
- `tests/components/ChampionshipCard.test.ts` (new) - 11 cases covering every behavior in the plan's `<behavior>` block, plus the tone-rule and semantic-token-only palette assertions
- `app/components/StandingsTable.vue` - added `ranking` prop; added `schoolById`/`hasPickedConferenceGames` computeds over the existing `standings` prop; mounts `ChampionshipCard` guarded by the same `standings.length > 0` check as the table itself
- `app/components/StandingsSidebar.vue` - added `rankings` prop (`ResolvedTiebreakers | undefined`, defaulting to `undefined`); passes `rankings?.[conference]` into each `StandingsTable`
- `app/pages/week/[week].vue` - destructures `rankings` alongside `standings` from `useStandings(2026)`; passes it to `<StandingsSidebar>`
- `tests/components/StandingsTable.test.ts` - scoped the D-05/D-06 block's `.badge`/`svg`/`'tied'` assertions to `tbody`; added a "championship card threading" describe block (card renders above the table when `ranking` is supplied; table still renders when it is not)
- `tests/components/StandingsSidebar.test.ts` - added a "rankings threading" describe block (matching conference entry renders its card; renders correctly with `rankings` omitted)

## Decisions Made

- **D-14 made structural, not conventional** (Task 2): `ChampionshipCard.vue` never imports `TerminalReason`, so there is no code path capable of branching on the unresolved-seed cause. The TerminalReason-invariance test asserts byte-identical `wrapper.text()` across all three reason codes as the mechanical proof.
- **Loading detected via `schoolById.size === 0`, not a dedicated rows prop** (Task 2/3): the plan's acceptance criteria forbid a standings-row prop on the card beyond the school lookup and the has-picks boolean. Since `StandingsTable` already builds `schoolById` from the same rows it has, an empty map is the one signal available to distinguish "data hasn't loaded" from "resolution omitted but rows exist" (the error state) without widening the card's prop surface.
- **State precedence fixed as loading > empty > error > matchup** (Task 2): loading is checked unconditionally first so a not-yet-loaded conference can never flash the empty-state copy before data resolves, and empty is checked before error so a genuinely zero-picks conference (where `resolveAllConferences` would not throw) never gets read as a resolution failure.
- **Card threading verified as threading-only, not a re-test of ChampionshipCard's own behavior** (Task 3): the new cases in `StandingsTable.test.ts`/`StandingsSidebar.test.ts` assert only that the `ranking`/`rankings` prop reaches the right place and the card mounts in the right position -- the card's own state machine is ChampionshipCard.test.ts's exclusive territory, avoiding duplicate coverage of the same behavior at two layers.

## Deviations from Plan

None - plan executed exactly as written. The one mechanical lint auto-fix (quote-props consistency in a new test file's object literal, applied by `pnpm lint --fix`) is stylistic only and not tracked as a deviation under the shared Rules 1-3 process, since it changed no behavior and no assertion.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `StandingsTable`'s `ranking` prop is now the single seam Plan 07 reads for its D-10 rank markers and per-group reasoning expansion -- no further prop surface needed on that component for Plan 07 to build on
- `ChampionshipCard.vue`'s `state`/`primary`/`secondary` computed pattern (union-typed `SeedDisplay`, single `expanded` ref covering both possible candidate-block render sites) is available as a precedent for `TiebreakerReasoning.vue` (Plan 06)
- The plan's `<verification>` `<human-check>` (visual confirmation of all four conferences' championship elements, the ACC's overflow disclosure, and the zero-picks empty state in `pnpm dev`) was not exercised in this automated session -- flagged as `human_judgment: true` (D5) in the coverage block above for the verifier/UAT pass
- No blockers for Plan 05/06/07

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 7 created/modified source and test files found on disk; all 3 task commit hashes (`b608b9f`, `727d0eb`, `2b479ab`) found in `git log`.
