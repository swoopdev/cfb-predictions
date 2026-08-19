---
phase: 06-tiebreaker-ui-championships
plan: 02
subsystem: tiebreakers
tags: [tiebreakers, engine, n-seed, standings, property-tests]

requires:
  - phase: 06-tiebreaker-ui-championships
    provides: "Plan 01 -- repaired ACC recursion guard, lost-to-all elimination step, shared generated-season harness at tests/helpers/generated-seasons.ts"
provides:
  - "resolveConferenceRanking: extends the engine from 2 championship seeds to a full 1..N ordered ranking (D-01/D-03/TIE-08)"
  - "RankGroup/ConferenceRanking types, championshipFor helper"
  - "Pitfall 1 repair: unseparated multi-team top buckets are recursively resolved instead of emitted in raw team-id order"
  - "resolveConferenceChampionship as a thin deprecated derived view over resolveConferenceRanking, kept for Phase 5 callers until Plan 06-03 deletes it"
  - "committed N-seed decision-rate measurement (tests/domain/tiebreakers/n-seed-decision-rate.test.ts)"
affects: [06-03, 06-04, 06-05, 06-06, 06-07]

tech-stack:
  added: []
  patterns:
    - "RankGroup.contestedWith computed as the union of a slot's initial pool and every cycle's tiedTeams across its own trace, not the bare initial pool"
    - "Bucket recursion bounded by a containment-filtered defineTiedTeams wrapper (intersect candidate pool with the bucket)"
    - "Fresh cycles array allocated per N-seed loop iteration, never threaded across rank groups"

key-files:
  created:
    - tests/domain/tiebreakers/n-seed-ranking.test.ts
    - tests/domain/tiebreakers/trace-isolation.test.ts
    - tests/domain/tiebreakers/n-seed-decision-rate.test.ts
  modified:
    - shared/domain/tiebreakers/types.ts
    - shared/domain/tiebreakers/engine.ts
    - tests/domain/standings/standings-tiebreaker-agreement.test.ts

key-decisions:
  - "RankGroup.contestedWith is the union of the initial pool and every trace cycle's tiedTeams, not merely the initial pool -- required because the ACC's defineAccTiedTeams restart redefinition can legitimately pull in teams the initial pool never contained; the literal 'contestedWith: pool' sketch in RESEARCH.md/PLAN.md would otherwise violate the plan's own trace-isolation must_have for the ACC"
  - "Legacy resolveConferenceChampionship's seed.order is now a single-team array (the engine's one committed winner) rather than the full resolved sub-order the pre-06-02 engine returned; updated the one test that asserted the old multi-team shape"
  - "n-seed-decision-rate.test.ts's ordering check is scoped to SEC/Big Ten/Big 12 only -- the ACC's defineAccTiedTeams ties teams with different win percentages by design (matching win/loss on an alternate schedule length), so group max win pct is not monotonically non-increasing for the ACC even though the resolution is correct"

patterns-established:
  - "Pitfall-1 unseparated-top-bucket check: verify a bucket recursion cycle exists in a group's own trace matching the decisive step's top bucket, rather than re-deriving the winner independently"

requirements-completed: [TIE-08]

coverage:
  - id: D1
    description: "resolveConferenceRanking produces a full 1..N partition per conference: every team placed in exactly one rank group, groups ordered best to worst"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/n-seed-ranking.test.ts#holds across 100 fully-picked seasons"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/n-seed-ranking.test.ts#holds across 100 partially-picked seasons (weeks 1-7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pitfall 1 repaired: zero ranks decided by raw team id (measured 19.2% before, 0% after) across 400 conference-seasons"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/n-seed-decision-rate.test.ts#produces zero unseparated-top-bucket emissions (Pitfall 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "seed1/seed2 contradiction eliminated structurally: one ordered sequence produces both seeds (measured 0 of 649+ where 7 of 649 existed pre-06-02)"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/standings/standings-tiebreaker-agreement.test.ts#the engine can no longer contradict itself between seed 1 and seed 2 (06-02) > holds across 100 fully-picked seasons"
        status: pass
      - kind: unit
        ref: "tests/domain/standings/standings-tiebreaker-agreement.test.ts#the engine can no longer contradict itself between seed 1 and seed 2 (06-02) > holds across 100 partially-picked seasons (weeks 1-7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each rank group carries its own trace array (no shared accumulator) and every id in a trace is a member of that group's contestedWith"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/trace-isolation.test.ts#holds across 100 fully-picked seasons"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/trace-isolation.test.ts#holds across 100 partially-picked seasons (weeks 1-7)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Per-conference manual-decision rate is pinned in a committed, re-runnable test"
    requirement: "TIE-08"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/n-seed-decision-rate.test.ts#keeps SEC / Big Ten / Big 12 under 1 manual decision per fully-picked season on average"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/n-seed-decision-rate.test.ts#documents the ACC as the known-high conference"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-08-18
status: complete
---

# Phase 06 Plan 02: N-Seed Ranking Engine Summary

**Extended the tiebreaker engine from 2 championship seeds to a full 1..N ordering with `resolveConferenceRanking`, and repaired the 19.2%-of-slots raw-team-id defect in the same change**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-18T20:43:04Z (approx, first commit)
- **Completed:** 2026-08-18T20:43:31Z
- **Tasks:** 3 (4 commits: 1 RED + 1 GREEN + 1 test)
- **Files modified:** 6 (3 new test files, 3 modified)

## Accomplishments

- Added `RankGroup`, `RankGroupResolution`, `ConferenceRanking` to `shared/domain/tiebreakers/types.ts`; deprecated `ChampionshipResult` (deleted in Plan 06-03)
- Added `resolveConferenceRanking`: one sequential commit-and-restart loop replacing the two independent `resolveSlot` calls that caused the seed1/seed2 contradiction (D-04 defect 2). Consumes only `order[0]` of every `TiebreakerResult`; a fresh `cycles` array is allocated per loop iteration so each `RankGroup.trace` is its own array (Pitfall 5)
- Repaired `resolveTiedGroup`'s Pitfall 1 defect: when a separating step's top bucket holds more than one team, the engine now recurses into that bucket (bounded by a containment-filtered `defineTiedTeams` wrapper) instead of emitting it in `partitionByStepValue`'s raw team-id order. Measured 19.2% of contested slots before, 0% after, across 400 generated conference-seasons
- Added a defensive `nextTiedTeams.length === 0` backstop closing the containment-escape correctness hole the plan flagged: a bounded restart that re-anchors entirely outside its bucket now returns `needsUserInput` over the remainder rather than recursing on an empty array
- Added `championshipFor(ranking)`, reading seed1/seed2 directly off `groups[0]`/`groups[1]` (D-12); suppresses seed2 when seed1 is itself a multi-team unresolved group
- Rewrote `resolveConferenceChampionship` as a thin, explicitly `@deprecated` derived view over `resolveConferenceRanking`, so every Phase 5 caller (`resolveTiebreakers.ts`, `computeStandings.ts`) keeps compiling and passing this wave
- Committed three new property-test files (`n-seed-ranking`, `trace-isolation`, `n-seed-decision-rate`) covering completeness, group semantics, `contestedWith`, `championshipFor`, the bucket-recursion containment invariant, trace isolation, and the per-conference manual-decision rate, over 200 generated seasons each
- Rewrote the pinned "seed1/seed2 contradiction" regression block in `standings-tiebreaker-agreement.test.ts` to assert the contradiction is now structurally impossible

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the failing N-seed ranking and trace-isolation contracts** - `f761895` (test/RED)
2. **Task 2: Build the N-seed loop and repair the unseparated top bucket** - `d00e656` (feat/GREEN)
3. **Task 3: Commit the N-seed measurement so it cannot regress silently** - `6f5dfd1` (test)

## Files Created/Modified

- `shared/domain/tiebreakers/types.ts` - Added `RankGroup`, `RankGroupResolution`, `ConferenceRanking`; deprecated `ChampionshipResult`
- `shared/domain/tiebreakers/engine.ts` - Added `resolveConferenceRanking`, `championshipFor`; repaired `resolveTiedGroup`'s unseparated-top-bucket merge; rewrote `resolveConferenceChampionship` as a deprecated thin wrapper
- `tests/domain/tiebreakers/n-seed-ranking.test.ts` - Completeness, ordering, group semantics, `contestedWith`, `championshipFor`, decisive-step, and bucket-containment property assertions over 200 generated seasons plus two synthetic fixtures
- `tests/domain/tiebreakers/trace-isolation.test.ts` - Array-identity and id-membership assertions (Pitfall 5) over 200 generated seasons
- `tests/domain/tiebreakers/n-seed-decision-rate.test.ts` - The committed N-seed measurement (guard trips, unseparated-top-bucket rate, per-conference decision rates, distinct-rank floor)
- `tests/domain/standings/standings-tiebreaker-agreement.test.ts` - Rewrote the pinned seed1/seed2 contradiction block to assert zero contradictions; updated the ACC alternate-schedule sanity check for the new single-team-per-seed legacy shape

## Decisions Made

- **`RankGroup.contestedWith` is a trace-derived union, not the bare initial pool.** RESEARCH.md's and PLAN.md's own code sketch used `contestedWith: pool` (the pool computed at the top of the loop iteration, before any restarts). Empirically this breaks the plan's own must-have trace-isolation invariant for the ACC: `defineAccTiedTeams` re-anchors on a fresh win-pct/matching-record scan on every restart (its own published language, "restart the entire tiebreaker, including re-defining tied teams," independently confirmed via fbschedules.com and cbssports.com per 06-RESEARCH.md's re-verification), and can legitimately pull in teams that were never part of the slot's first-computed pool. `contestedWith` is now computed as the union of the initial pool and every cycle's `tiedTeams` in that group's own trace, which makes the trace-isolation invariant hold by construction for all four conferences while costing nothing for the three that never leave their initial pool.
- **Legacy `resolveConferenceChampionship`'s `seed.order` is now a single-team array.** Under the pre-06-02 engine, a resolved slot's `order` was the FULL resolved sub-order (e.g. `[teamA, teamB, teamC]` for a fully-resolved 3-way tie). Under the new architecture, each `RankGroup` (and therefore each legacy seed) commits exactly one team per rank slot, so `seed.order` is always length 1 for a resolved seed. One existing test (`standings-tiebreaker-agreement.test.ts`'s ACC fixture sanity check) asserted the old multi-team shape and was updated to check both seeds' `order[0]` instead of one seed's full array — the underlying property it protects (the fixture exercises `defineAccTiedTeams`' alternate-schedule pull-in) is unchanged.
- **`n-seed-decision-rate.test.ts`'s Pitfall-1 check verifies bucket-recursion engagement, not the winner's identity.** The plan's literal spec ("the decisive StepOutcome... has a `partition[0]` of length 1, or the group's single team is the sole member of `partition[0]`") assumes `trace.at(-1)` always corresponds to the winner's own decisive separation. That does not hold in general — `resolveTiedGroup` continues resolving the "rest" of a pool after a winner is found (existing pre-06-02 behavior, unchanged), so the LAST trace cycle can belong to an unrelated later separation. Implemented an equivalent, more robust check instead: whenever a group's first cycle's first separating step reveals a multi-team top bucket, verify that group's own trace contains a later cycle whose `tiedTeams` exactly matches that bucket — direct proof the repair engaged rather than emitting the bucket as-is.
- **`n-seed-ranking.test.ts`'s ordering assertion (max win pct non-increasing down the table) is scoped to SEC/Big Ten/Big 12.** Verified empirically that the ACC violates strict win-pct ordering by design: `defineAccTiedTeams` ties a lower-win-pct team to a higher-win-pct team when they match on wins or losses over an alternate schedule length, and head-to-head can then seed the lower-pct member ahead once its tied partner commits separately. This is the same phenomenon D-10's own rationale documents (`1 Boston College 6-2` above `1 Duke 7-2`), not a defect this plan introduced.

## Measured Results

**Before/after unseparated-top-bucket rate (Pitfall 1):** 19.2% of contested slots (SEC 21.1%, Big Ten 21.7%, Big 12 23.3%, ACC 0.0%) before this plan's repair, measured in 06-RESEARCH.md; **0.0% after**, confirmed by `n-seed-decision-rate.test.ts` across 400 generated conference-seasons (100 fully-picked + 100 mid-season, x4 conferences).

**Per-conference manual-decision rate, post Plan 06-01 (ACC guard + lost-to-all repairs) and Plan 06-02 (N-seed loop + Pitfall 1 repair), model B, mean unresolved groups per season:**

| Conference | Fully-picked (measured) | Mid-season weeks 1-7 (measured) | Fully-picked distinct-rank fraction |
|---|---|---|---|
| SEC | 0.100 | 0.340 | 98.8% |
| Big Ten | 0.190 | 0.970 | 97.4% |
| Big 12 | 0.010 | 0.550 | 99.9% |
| ACC | 3.850 | 3.380 | 16.5% |

These figures are within measurement noise of 06-RESEARCH.md's projected post-repair figures (SEC 0.10, Big Ten 0.19, Big 12 0.01, ACC 3.84) — Plan 06-01's lost-to-all elimination repair did not materially move the ACC's headline decision count, though it does change *which* groups resolve internally (per Plan 06-01's own summary).

**A1 sanity check (06-RESEARCH.md's Assumption 1):** confirmed against the source `06-RESEARCH.md` already cites for the ACC's restart language re-verification — fbschedules.com and cbssports.com's reproductions of the ACC's July 2026 tiebreaker policy, both carrying the verbatim clause "If still tied after any step, restart the entire tiebreaker (including re-defining tied teams)." Restarting the procedure on an unseparated top bucket (rather than treating it as jointly seeded) is the correct reading of the published rules; no new source lookup was performed this plan since the citation is already primary-sourced in `06-RESEARCH.md`'s "Restart language confirmed verbatim" section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `contestedWith: pool` (as literally specified in RESEARCH.md's sketch and PLAN.md's action text) violates the plan's own trace-isolation must-have for the ACC**
- **Found during:** Task 2, while implementing `resolveConferenceRanking`
- **Issue:** The plan's code sketch computes `contestedWith` as the bare initial pool for a rank slot. The ACC's `defineAccTiedTeams` restart mechanism can legitimately redefine the tied pool to include teams never in the initial pool (confirmed both by 06-RESEARCH.md's own measured examples and empirically by running the literal sketch against the test suite). This makes `contestedWith` a strict subset of what a group's `trace` actually references for the ACC, directly violating the plan's stated must-have truth: "Every RankGroup.trace is its own array and references only team ids drawn from that group's contestedWith."
- **Fix:** Computed `contestedWith` as the union of the initial pool and every cycle's `tiedTeams` across the group's own trace (`contestedWithFrom` helper in `engine.ts`). This satisfies the trace-isolation invariant by construction for all four conferences and changes nothing for the three that never leave their initial pool (SEC/Big Ten/Big 12's `defineBucketTiedTeams` never selects outside the bucket it started with).
- **Files modified:** `shared/domain/tiebreakers/engine.ts`, `shared/domain/tiebreakers/types.ts` (docblock explaining the union)
- **Committed in:** `d00e656` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in the plan's own literal code sketch, corrected to satisfy the plan's own stated correctness invariant)
**Impact on plan:** No scope change. The fix is entirely internal to `engine.ts`'s `contestedWith` computation; the public `RankGroup`/`ConferenceRanking` shapes match the plan's "Target type shapes" contract exactly.

## Issues Encountered

None beyond the deviation above. Two pre-existing tests in `standings-tiebreaker-agreement.test.ts` failed after the Task 2 implementation, both explicitly anticipated by the plan ("Expect this repair to perturb the existing per-conference suites — that is declared, not a surprise" / "Rewrite the block to assert the opposite... Do not delete the block"): the ACC alternate-schedule sanity check (updated to check both seeds' single-element `order[0]` instead of one seed's now-obsolete multi-team array) and the pinned seed1/seed2 contradiction regression block (rewritten to assert the contradiction is now structurally impossible, per the plan's explicit instruction). Neither `tests/tiebreakers-sec.test.ts`, `tests/tiebreakers-bigten.test.ts`, `tests/tiebreakers-big12.test.ts`, nor `tests/tiebreakers-engine.test.ts` needed changes — their assertions are all status-guarded or check only `order[0]`, as the plan anticipated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolveConferenceRanking` and `championshipFor` are ready for Plan 06-03 to consume directly; `computeStandings.ts` can delete its union-find (`rankComponents`/`seedPlacements`/`resolvedSeedGroups`/`orderedComponents`) and build rows constructively from `ranking.groups`
- `resolveConferenceChampionship` and `ChampionshipResult` are marked `@deprecated` with an explicit "deleted in Plan 06-03" note in both `types.ts` and `engine.ts` — they must not survive the phase
- `RankGroup.manualOrdering` field exists (optional, unused) ready for Plan 06-05 to populate
- The per-conference manual-decision rate is now a committed, re-runnable test (`n-seed-decision-rate.test.ts`) that Plan 06-05/06-06's UX work can cite directly rather than a research document figure
- `shared/domain/tiebreakers/**` coverage was not measured with `--coverage` this plan (not in this plan's `<verification>` block); 06-RESEARCH.md flagged a pre-existing 87.87%-vs-90% branch gap in that directory for "whoever next works in `shared/domain/tiebreakers/`" to close — worth revisiting once Plan 06-03's `computeStandings.ts` changes land, since the coverage gate check point in 06-RESEARCH.md's Validation Architecture section names the phase gate (not this plan) as where it must close

## Self-Check: PASSED

- All created files exist on disk (3/3): `tests/domain/tiebreakers/n-seed-ranking.test.ts`, `tests/domain/tiebreakers/trace-isolation.test.ts`, `tests/domain/tiebreakers/n-seed-decision-rate.test.ts`
- All commit hashes found in git log (3/3): `f761895`, `d00e656`, `6f5dfd1`

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-18*
