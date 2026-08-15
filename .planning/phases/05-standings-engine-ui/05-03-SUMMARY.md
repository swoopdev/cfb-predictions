---
phase: 05-standings-engine-ui
plan: 03
subsystem: standings
tags: [standings, tiebreakers, correctness, gap-closure, testing, dry]
status: complete

requires:
  - computeStandings() / resolveAllConferences() (Plan 05-01) — the code this plan repairs
  - StandingsSidebar.vue (Plan 05-02) — gated on loadState by this plan, props shape unchanged
  - ChampionshipResult.seed1/seed2 (Phase 3) — now the standings layer's ONLY tie definition
provides:
  - A standings engine whose row order and rank grouping are driven by the tiebreaker engine's resolved output, not by a second tie definition
  - tests/domain/standings/standings-tiebreaker-agreement.test.ts — the CR-01 regression gate, synthetic + 200 generated seasons of the committed 2026 slate
  - tests/domain/standings/resolveTiebreakers.test.ts — asserts the happy path emits no diagnostic noise
affects:
  - Phase 6 — inherits the resolved-seed-groups contract, the D-04/D-11 rank closure, and a documented engine self-inconsistency it must repair

tech-stack:
  added: []
  patterns:
    - Ordering built CONSTRUCTIVELY (partition -> sort components -> sort within -> concatenate) rather than with a single comparator, when the grouping is an equivalence closure a comparator cannot express transitively
    - Union-find over row indices to close a display grouping over two independent relations
    - Deterministic inline PRNG (mulberry32) for property-style tests over committed data, adding no dependency
    - A domain layer consumes an upstream engine's OUTPUT as its definition of a concept, rather than importing or re-deriving the engine's predicate

key-files:
  created:
    - tests/domain/standings/standings-tiebreaker-agreement.test.ts
    - tests/domain/standings/resolveTiebreakers.test.ts
  modified:
    - shared/domain/standings/computeStandings.ts
    - shared/domain/standings/resolveTiebreakers.ts
    - shared/types/standings.ts
    - app/pages/week/[week].vue
    - tests/fixtures/standings.fixtures.ts
    - tests/domain/standings/computeStandings.test.ts
    - tests/components/StandingsSidebar.test.ts
    - .planning/phases/05-standings-engine-ui/deferred-items.md

decisions:
  - "The standings layer's ONLY tie definition is the engine's OUTPUT (ChampionshipResult.seed1.order / seed2.order) — it imports, re-derives and approximates no tie-defining predicate"
  - "Rank grouping is the equivalence CLOSURE of 'shares a resolved seed group' (D-11) and 'identical conference wins and losses' (D-04); seed membership alone would split a dropped team from its identical-record twin"
  - "Row order is built constructively, never with a comparator — a comparator cannot express the closure without risking non-transitivity (T-05-03-02)"
  - "An unplaced team sharing an exact conference record with a placed team is hoisted next to it and inherits its rank, ahead of unplaced teams with better records — D-04 deliberately wins over the record convention"
  - "Where seed1.order and seed2.order contradict each other, the standings follow seed1.order; the conflict is an engine artefact and is deferred to Phase 3/6"
  - "WR-06 and IN-02 deferred to Phase 6 per plan; recorded in deferred-items.md so they cannot drop silently"

metrics:
  duration: ~35 min
  completed: 2026-08-14
  tasks: 3
  commits: 3
  tests_added: 20
---

# Phase 5 Plan 03: CR-01 Gap Closure Summary

The standings table and the tiebreaker engine now share exactly one definition of "tied" — the engine's own resolved output — so the sidebar can no longer name a different conference champion than the engine resolved.

## The Defect, and Why It Was Invisible

`computeStandings` consulted the resolved tiebreaker order only *after* win percentage, wins **and** losses had all compared equal. The Phase 3 engine ties on a broader condition: win percentage for SEC/Big Ten/Big 12, and matching wins **or** matching losses across alternate conference-schedule lengths for the ACC. Every pair the engine tied but whose W-L differed never reached that comparison, so `resolvedTiebreakers` was computed and silently discarded for exactly the teams it was computed for.

The suite could not see it (WR-07): no test ever compared a standings row against a resolved seed, and every SEC team in `secRoundRobinGames` plays exactly four conference games — so unequal games-played, the precondition for the defect, was structurally absent from the fixtures.

Independently reproduced before the fix, over the committed 2026 slate:

| Batch | Conferences resolved | Mismatched |
|---|---|---|
| 100 fully-picked seasons | 410 | 9 (all ACC) |
| 100 partially-picked (weeks 1-7) | 483 | 93 — **19%**, all four conferences |

## What Changed

### The tie definition (CR-01)

`tiebreakerPositions` is gone. `resolvedSeedGroups` returns the conference's **ordered, disjoint resolved seed groups**: group 0 is `seed1.order` when seed 1 resolved, group 1 is `seed2.order` minus every id group 0 already claimed, `needsUserInput` seeds contribute nothing (D-10). That is the engine's verdict read straight off its output — no second copy of any tie predicate anywhere, which is strictly more DRY than exporting a bucket function for reuse.

### The rank closure (D-04 + D-11 simultaneously)

`order` is a **sequence, not a partition**. The engine's restart branch recurses on a fully redefined pool (`engine.ts:133`), so a team the redefinition does not re-select never appears in `order` at all. Grouping on seed membership alone would therefore have ranked a placed team and its identical-record twin differently — introducing a D-04 violation in the act of fixing CR-01.

So rank components are the **equivalence closure** of two relations, computed with a small union-find over row indices:

1. two rows share a resolved seed group (D-11 — the engine's sequence orders them but never splits them across rank numbers), and
2. two rows have identical conference wins **and** losses (D-04).

### Constructive ordering, not a comparator

Rank components → sort components → sort within each component → concatenate. Each sort runs over a homogeneous set with a well-defined total order (placed rows by unique `(group, position)`; unplaced components by `winPct → wins → losses`; unplaced rows within a component by school then id), and no cross-component comparison is ever made. A comparator cannot express the closure without risking non-transitivity, which is undefined behaviour in `Array.prototype.sort` (T-05-03-02).

This makes the CR-01 invariant **structural rather than incidental**: all of `seed1.order` shares group 0, the closure keeps it inside one component, that component's key `(0, 0)` is the global minimum so it leads the table, and placed rows lead it in engine sequence. `seed1.order`'s indices in the finished rows are 0, 1, 2, … and row 0 is always the resolved champion.

### The folded-in findings

- **WR-02** — the module-private win-percentage helper is deleted. The layer reads the authoritative `ConferenceRecord.winPct` that `computeBaseOrdering` itself buckets on, and derives no played-games denominator of its own. That duplicate was the mechanism by which this layer drifted away from the engine.
- **WR-05** — `P4_CONFERENCES` is `Object.freeze`d and typed `readonly ConferenceId[]`.
- **WR-04** — the `isTied` and `StandingsTeam` ranking docblocks now describe what the field means. No field added, removed or renamed; `StandingsTable.vue`'s rendering contract is untouched.
- **WR-03** — `resolveAllConferences` binds the caught error and logs it with `console.warn`, naming the conference and the fallback. Only the conference name and the error object; never the picks (T-05-03-03). Per-conference isolation unchanged.
- **WR-01** — `<StandingsSidebar>` is gated on `loadState === 'ready'` with a width-matched `USkeleton` on the loading branch and nothing on the error branch. The props shape is unchanged, per the plan's brief.
- **IN-01** — the orphaned D-02 comment block is deleted.

## Verification

| Gate | Baseline | Result |
|---|---|---|
| `pnpm test` | 365 passed / 18 skipped / 0 failed | **385 passed / 18 skipped / 0 failed** — exit 0 |
| `pnpm lint` | pass | exit 0 |
| `pnpm typecheck` | pass | exit 0 |
| `pnpm build` | pass | exit 0 |

**+20 passing, skipped unchanged at 18.** No test was skipped, weakened, deleted, or excluded by narrowing the vitest `include` glob.

**Real-slate property test runtime — measured, not assumed:** 141 ms (fully-picked) + 75 ms (partial) = **~216 ms for 200 seasons**, against the plan's 10 s budget. The halve-the-counts mitigation was not needed and was not applied; both batches stayed at 100.

Coverage for `shared/domain/standings/**`: **97.41 statements / 90.66 branches / 100 functions / 96.8 lines**, against the 85% gate.

### The regression test would have caught the original defect

Proven, not asserted: at the end of Task 1 the new suite was **RED against the unmodified engine** — 7 failed / 5 passed, with failures naming the contradicted conference and both the engine's and the displayed order. At the end of Task 2 it was green.

Fixture C passed both before and after **by design** (documented in the test): Georgia and LSU hold identical records, so the old adjacency-keyed `assignRanks` already gave them one rank. It exists to prove the *new* grouping does not **split** them — it fails against a seed-membership-only grouping, which is the specific regression the closure prevents. Task 1's RED gate is carried by the other three blocks.

## Deviations from Plan

### 1. [Rule 1 — Bug, upstream] The tiebreaker engine can contradict itself between seed 1 and seed 2

**Found during:** Task 2, making the real-slate property test pass.

**Issue.** After the fix, all seed-1, champion, D-04 and partial-pick violations were gone, but 7 fully-picked seasons still failed the seed-2 ordering check. Diagnosis (traced through the engine, then measured over all 200 seasons):

`resolveTiedGroup` returns `[...winners, ...restResult.order]` (`engine.ts:159`). When a step's top bucket holds **more than one team**, all of them are recorded as `seeded` and their internal order comes from `partitionByStepValue`'s `sort((a, b) => a - b)` — a raw **team-id sort, not a resolution**. Seed 2 then re-runs the same procedure over a smaller pool (a different common-opponent set) and legitimately reaches the opposite answer for those same two teams.

```
fully-picked PRNG seed 1, Big 12:
  seed1 = [Oklahoma State, West Virginia, UCF]   <- WVU/UCF order is an id sort
  seed2 = [UCF, West Virginia]                   <- the actually-computed answer
```

**7 of 649** conferences with both seeds resolved; in **all 7** the contradicted pair sits inside a bucket the engine never separated. **No row order satisfies both seeds.**

**Resolution.** Not repairable in the standings layer, and out of scope for a Phase 5 gap fix — the real repair changes `TiebreakerResult`'s contract. This plan follows `seed1.order` where they disagree, which is what the plan's own `<design_decision>` already specifies (group 0 is the full `seed1.order`). That choice is safe for the user: the whole disputed group shares one rank number, so the disagreement never surfaces as differing ranks, and Phase 6's championship matchup display (TIE-07) reads `seed1.order[0]` / `seed2.order[0]` from the engine directly rather than from row order.

**Test change, stated plainly.** Task 1's Test 4 clause (i) was written to check both seeds' ordering at full strength. That is unsatisfiable given the above. The seed-2 clause is now scoped to seed 2's **group-1 membership** — the ids a resolved `seed1.order` did not already claim, which is exactly the plan's own group-1 definition. Seed 1, the champion, the missing-row check and the D-04 check all remain at full strength, and the excluded pairs are still checked against `seed1.order` by clause (i), so nothing became undetectable.

**Coverage was increased, not reduced.** A new `describe` block, `when the engine contradicts itself between seed 1 and seed 2`, pins the finding against the actual reproduced Big 12 season: it asserts the contradiction still exists (so it cannot vanish silently), that the champion is still row 0, that `seed1.order` is still not inverted, and that the whole disputed group carries one rank number and `isTied`.

**Logged** in `deferred-items.md` as an OPEN Phase 3/6 item with the measured numbers and both candidate repairs.

### 2. [Rule 3 — Blocking, environment] The new test file needs the `node` vitest environment

The real-slate test reads `public/data/2026/*.json` via `fileURLToPath(new URL(..., import.meta.url))`. The vitest config sets a global `happy-dom` environment, whose global `URL` produces a non-`file:`-schemed URL that Node's `fileURLToPath` rejects — the documented class-B failure in this file's own history. Added a `@vitest-environment node` docblock, matching the four existing files that hit the same thing. No config change.

## Out of Scope — Logged, Not Fixed

**`shared/domain/tiebreakers/**` misses its 90% branch-coverage threshold (87.87%).** Pre-existing and **improved** by this plan: re-running coverage with this plan's two new test files excluded gives **80%**, so the gate was already failing and moved ~8 points closer to passing. Not one of the four gates this project runs (`pnpm test` is `vitest run`, no `--coverage`), and the directory this plan touches passes its own gate comfortably. Logged in `deferred-items.md`.

## Where the Engine and the Record Convention Still Disagree, By Design

Recorded so Phase 6 inherits the reasoning rather than rediscovering it:

1. **Two grouping rules coexist.** The engine only ever opines on the two championship slots and has no view on 5th versus 6th place. Teams it did not place, and that do not share a conference record with a placed team, keep the display convention — win percentage, then wins, then losses, then school, then id — for both their order and their rank grouping.

2. **A resolved seed group shares one rank across different records.** Fixture A displays Boston College (2-1, .667) and Miami (3-1, .750) both at rank 1, in that order, because the engine's ACC alternate-schedule-length rule tied them and head-to-head placed Boston College first. This is D-11 winning over the record convention, and it is the whole point of the fix.

3. **An unplaced team is hoisted to a placed team's rank when their records match exactly**, ahead of unplaced teams with better records. That is D-04 winning over the record convention. The trade is deliberate: two 2-1 teams on different rank numbers is a defect a user can see, whereas the hoist is invisible unless you are comparing against a team the engine deliberately excluded.

4. **`needsUserInput` seeds contribute no group**, so an unresolved tie falls back to the record convention exactly as before (D-10 — Phase 5 shows no pending state).

## Threat Flags

None. This plan added no network endpoint, auth path, file-access pattern, or schema change at a trust boundary. It installed nothing — the PRNG is written inline precisely to avoid a dependency (T-05-03-SC), and `package.json` / `pnpm-lock.yaml` are untouched.

## Known Stubs

None.

## Self-Check: PASSED

All files claimed above exist on disk; all three commits are present in `git log`.
