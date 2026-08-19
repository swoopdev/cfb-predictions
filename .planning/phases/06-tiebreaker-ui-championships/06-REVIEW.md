---
phase: 06-tiebreaker-ui-championships
reviewed: 2026-08-19T18:49:50Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - app/components/ChampionshipCard.vue
  - app/components/StandingsSidebar.vue
  - app/components/StandingsTable.vue
  - app/components/TiebreakerReasoning.vue
  - app/composables/useManualTiebreakers.ts
  - app/composables/useStandings.ts
  - app/pages/week/[week].vue
  - shared/domain/standings/computeStandings.ts
  - shared/domain/standings/index.ts
  - shared/domain/standings/resolveTiebreakers.ts
  - shared/domain/standings/slateCompletion.ts
  - shared/domain/tiebreakers/engine.ts
  - shared/domain/tiebreakers/invalidation.ts
  - shared/domain/tiebreakers/records.ts
  - shared/domain/tiebreakers/steps.ts
  - shared/domain/tiebreakers/types.ts
  - shared/types/standings.ts
  - tests/components/ChampionshipCard.test.ts
  - tests/components/StandingsSidebar.test.ts
  - tests/components/StandingsTable.test.ts
  - tests/components/TiebreakerReasoning.test.ts
  - tests/composables/useManualTiebreakers.test.ts
  - tests/composables/useStandings.test.ts
  - tests/domain/standings/computeStandings.test.ts
  - tests/domain/standings/slateCompletion.test.ts
  - tests/domain/standings/standings-tiebreaker-agreement.test.ts
  - tests/domain/tiebreakers/acc-guard-and-elimination.test.ts
  - tests/domain/tiebreakers/coverage-gaps.test.ts
  - tests/domain/tiebreakers/invalidation.test.ts
  - tests/domain/tiebreakers/n-seed-decision-rate.test.ts
  - tests/domain/tiebreakers/n-seed-ranking.test.ts
  - tests/domain/tiebreakers/trace-isolation.test.ts
  - tests/helpers/generated-seasons.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-19T18:49:50Z
**Depth:** standard
**Files Reviewed:** 33 (production sources; test files were read for coverage context but not findings-generating per house rules)
**Status:** issues_found

## Summary

Reviewed the tiebreaker-UI/championship phase: the `ConferenceRanking`-consuming components (`ChampionshipCard`, `StandingsTable`, `TiebreakerReasoning`, `StandingsSidebar`), the manual-decision lifecycle (`useManualTiebreakers`, `useStandings`), and the domain layer that feeds them (`computeStandings`, `resolveTiebreakers`, `slateCompletion`, and the `engine.ts`/`invalidation.ts`/`records.ts`/`steps.ts` tiebreaker core).

The property-based test suites added in this phase (`n-seed-ranking.test.ts`, `trace-isolation.test.ts`, `coverage-gaps.test.ts`) are unusually thorough for *structural self-consistency* (completeness, ordering, `contestedWith` containment, trace-array identity), and I could not break any of those invariants. However, that self-consistency is exactly what let a real correctness bug through: the reasoning trace attached to a resolved single-team `RankGroup` can — and, per direct reproduction against the real `resolveTiedGroup` export, does — contain a cascade of tiebreak cycles that actually belong to a *different, later-resolved* team, and `TiebreakerReasoning.vue`'s "Decided at" panel reads `trace.at(-1)`, so it can display another team's tiebreaker comparison as the reason a team is ranked where it is. This is a direct hit against the project's stated core value ("If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters") — the underlying *rank* is correct, but the *reasoning shown for it* is not, for TIE-05's entire purpose.

I also found a stale-local-state bug in the D-17 manual-ordering UI, plus three smaller correctness/quality issues in the trace formatting and disclosure-state keying.

## Critical Issues

### CR-01: A resolved rank slot's reasoning trace can belong to a different team entirely

**File:** `shared/domain/tiebreakers/engine.ts:174-243` (consumed by `app/components/TiebreakerReasoning.vue:96-102` and `:315-335`)

**Issue:** `resolveTiedGroup` threads a single `cycles` accumulator array by reference through the *entire* recursive resolution of one outer-loop pool — both the "winners" bucket sub-recursion **and** the "rest" (`nextTiedTeams`) cascade that resolves everything below the current slot. When a step produces a **partial** separation (`winners.length === 1` but `rest.length > 0`, e.g. a step identifies exactly one team as "beat all others" out of a 3+-way tie but leaves the remaining teams still tied), the function recurses into `nextTiedTeams` using the *same* `cycles` array (`engine.ts:220-231`), and on success returns `trace: restResult.trace` (`engine.ts:234-239`) — i.e. **the whole cascade**, not just the cycle(s) that actually separated the winner.

`resolveConferenceRanking` then attaches this over-inclusive trace directly to the winning team's single-team `RankGroup` (`engine.ts:396-404`, `trace: result.trace`) and only ever consumes `order[0]` — the docblock explicitly warns that the *order* tail is untrustworthy for exactly this reason ("Consumes only order[0] ... no caller of this loop may read past index 0", `engine.ts:272-276`), but the same discipline was never applied to `trace`.

Downstream, `TiebreakerReasoning.vue`'s `decisiveStep` reads `props.group.trace.at(-1)` (`TiebreakerReasoning.vue:96-102`) and renders its `values` (team names + step values) under a "Decided at" heading (`TiebreakerReasoning.vue:315-335`). When the trace is over-inclusive, `trace.at(-1)` is the *last* cascaded cycle — which, for the originally-resolved team, is about a **completely different subset of teams** that were separated *afterward*, while resolving what comes next. The "Show full procedure" toggle (`TiebreakerReasoning.vue:262-313`) renders the same over-inclusive cycles as if they were all part of this one team's own procedure.

**Reproduction (directly against the real, unmocked `resolveTiedGroup` export):** a 4-team pool `[1,2,3,4]` where each restart peels exactly one winner (a very ordinary shape — SEC/Big Ten/Big 12's `defineBucketTiedTeams` returns *every* team sharing the best raw win-pct bucket as the initial pool, so any 3+-way raw record tie that a step separates one team at a time hits this path):

```
status: resolved
order: [1, 2, 3, 4]
trace length: 3
cycle 0: tiedTeams=[1,2,3,4] outcome=restart removed=[{teamId:1, reason:'seeded', atStep:'head-to-head'}]
cycle 1: tiedTeams=[2,3,4] outcome=restart removed=[{teamId:2, reason:'seeded', atStep:'head-to-head'}]
cycle 2: tiedTeams=[3,4] outcome=restart removed=[{teamId:3, reason:'seeded', atStep:'head-to-head'}]
```

`resolveConferenceRanking` commits `order[0] = 1` and attaches all 3 cycles as team 1's `RankGroup.trace`. `TiebreakerReasoning.vue`'s `decisiveStep` for team 1's rank slot reads `trace.at(-1)` = cycle 2, whose `tiedTeams`/`values` are `[3, 4]` — **team 1 never appears in the "Decided at" panel rendered for its own rank.** The panel instead shows how team 3 beat team 4.

This is not caught by the new property-based suites because they check *self-consistency* (every id in the trace is in `contestedWith`, no two groups share a trace array instance, "the last cycle has *some* separating step") — none of them check that the decisive step's `values` actually include the team the `RankGroup` is *for*.

**Fix:** `resolveTiedGroup` needs to stop conflating "the full cascade needed to internally validate/rank the rest of the pool" with "the trace that explains why *this* winner was separated." A minimal-diff fix: snapshot the cycles array length before recursing into `nextTiedTeams`, and when this call's own winner was fully decided by the cycles pushed so far, attach only that prefix as `trace` for the winner's group (letting the recursive `restResult`'s own trace apply only to whichever team(s) *it* resolves):

```ts
// Before recursing into nextTiedTeams:
const ownCycleCount = cycles.length // snapshot -- everything up to and
                                     // including this slot's own separation

const restResult = resolveTiedGroup(nextTiedTeams, /* ... */, cycles, depth + 1)

if (restResult.status === 'resolved') {
  return {
    status: 'resolved',
    order: [...orderedWinners, ...restResult.order],
    // Only this call's own cycles belong to the winner `resolveConferenceRanking`
    // will actually commit (order[0]); the rest belongs to whichever slot(s)
    // restResult's own order[0] corresponds to, not to this one.
    trace: cycles.slice(0, ownCycleCount)
  }
}
```
(The exact slicing needs to account for the `winners.length > 1` bucket-recursion branch too, which shares the same `cycles` array for the same reason.) At minimum, add a regression test asserting that for a `'tiebreaker'` group, every `teamId` referenced in `decisiveStep` (`trace.at(-1)`'s separating step) includes the group's own `teams[0]`.

---

### CR-02: D-17 manual-ordering local state is never reset when the tied group's composition changes

**File:** `app/components/TiebreakerReasoning.vue:148-220` (no `watch` on `props.group` anywhere in the file)

**Issue:** `assignedIds` is local `ref<TeamId[]>([])` state tracking which teams the user has clicked, in order, for the D-17 "you choose" ordering control. `StandingsTable.vue` mounts `TiebreakerReasoning` without an explicit `:key` (`StandingsTable.vue:333-338`), inside a `<template v-for="row in rowMeta" :key="row.team.id">` (`StandingsTable.vue:277-280`) — the key is the *team id of the group's last row*, not a hash of the group's membership. If a later pick changes which teams are tied at that rank slot while the *same* team happens to remain the group's last row (entirely possible: `group.teams` order is not alphabetical, so whichever id sorts last there can stay fixed across a membership change), Vue reuses the same `TiebreakerReasoning` component instance and its `assignedIds` is never cleared.

Consequences, once `group.teams` actually changes under a persisting instance:
- `assignedTeams` (`TiebreakerReasoning.vue:150-152`) can render team names for ids that are no longer in the current tied group at all — the visible "ranked" list shows stale, wrong teams.
- `isComplete`/`announcement` can report "all N teams ranked" based on a stale count that no longer corresponds to the live group.
- If `assignTeam` reaches `assignedIds.value.length === props.group.teams.length` (`TiebreakerReasoning.vue:207-220`) on stale ids, it `emit('commit', ...)` with a team-id array that does not set-equal the live group — `useManualTiebreakers.commitOrdering`'s `isTeamSetEqual` guard (`useManualTiebreakers.ts:172`) silently no-ops it, so no bad data reaches storage, but the user sees the UI declare completion and nothing happens when they interact further — a silent, unexplained dead end.

Not covered by `tests/components/TiebreakerReasoning.test.ts` (no test re-renders the component with a changed `group` prop while mounted).

**Fix:** add a watcher that resets local ordering state whenever the group's membership actually changes:
```ts
watch(
  () => props.group.teams,
  (next, prev) => {
    if (!next || !prev || next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
      assignedIds.value = []
    }
  }
)
```
or, more robustly, give `<TiebreakerReasoning>` a `:key` derived from a stable hash of `row.group.teams` (e.g. reuse `decisionHash`-style membership sorting) in `StandingsTable.vue` so Vue remounts it fresh on any composition change — this also fixes WR-02 below for free.

## Warnings

### WR-01: The Big 12's `total-wins` step renders a fabricated "0 losses" and a nonsensical win-percentage in the reasoning panel

**File:** `shared/domain/tiebreakers/steps.ts:449-455`, rendered generically by `app/components/TiebreakerReasoning.vue:66-83`

**Issue:** `evaluateTotalWins` builds `{ kind: 'record', wins, losses: 0, winPct: wins }` — the step's own comment says `winPct` is "repurposed as the raw win count for display consistency," but `TiebreakerReasoning.vue`'s `stepValueText` has no special case for the `total-wins` step and formats every `'record'` value identically: `` `${wins}-${losses} (${formatWinPct(winPct)})` ``. For a team with, say, 9 total wins, this renders `"9-0 (9.000)"` in the UI — a fabricated 0-loss record (the step never tracks losses) and a "win percentage" that is really just the win count reformatted to three decimals, which will read as nonsense (or as a wildly-wrong 900%-style percentage) to anyone looking at the Big 12's tiebreaker reasoning.

**Fix:** special-case `total-wins` in `stepValueText` (e.g. `` `${value.wins} total wins` ``) rather than routing it through the generic win-pct record formatter, or have `evaluateTotalWins` emit a distinct `StepValue` kind instead of overloading `'record'`.

### WR-02: `expandedGroups` disclosure state is keyed by array position, not by group identity

**File:** `app/components/StandingsTable.vue:155-169`

**Issue:** `expandedGroups` is a `Set<number>` of indices into `ranking.groups`. When a pick changes and the conference's ranking recomputes, `ranking.groups`' composition at a given index can change entirely (a different set of tied teams can now occupy index 2). Because expansion state survives the recompute (it is component-local `ref` state, not reset on `ranking` change), a previously-expanded index can silently start pointing at an unrelated group — auto-expanding the wrong reasoning panel, or leaving the panel the user actually opened collapsed after their own pick changes its index.

**Fix:** key `expandedGroups` by a stable identity derived from group membership (e.g. the sorted team-id string, as `invalidation.ts`'s `canonicalDecisionKey` already does) instead of the raw array index.

### WR-03: `useStandings`'s prune `watchEffect` implicitly depends on the storage ref it writes, causing a redundant extra run

**File:** `app/composables/useStandings.ts:126-136`, `app/composables/useManualTiebreakers.ts:183-210`

**Issue:** The `watchEffect` in `useStandings.ts` calls `pruneStale(conference, conferenceRaw, complete[conference] ?? false)`, and `pruneStale` reads `decisions.value[conference]` and, when something is stale, writes `decisions.value = {...}` (`useManualTiebreakers.ts:186, 208`). Vue's reactive dependency tracking is based on the currently-active effect at the time of the `.value` read, not on lexical scope, so this read inside a function called synchronously from `watchEffect` registers `decisions` as a tracked dependency of that same `watchEffect`. Any actual prune therefore triggers a second run of the whole effect (which re-derives `raw`/`complete` and calls `pruneStale` again for all four conferences). It happens to converge (the second run finds nothing left to prune), so this isn't a runaway loop, but it's an easy-to-miss self-triggering dependency that will bite the next time this function is edited (e.g. if the idempotency assumption stops holding).

**Fix:** have `pruneStale` return the next value instead of writing `decisions.value` itself and let the caller decide, or explicitly exclude the effect from tracking `decisions` (`untracked`/`pauseTracking` around the read, or restructure so `watchEffect` only watches `rawRankings`/`slateComplete` and calls an inner function that doesn't share the same reactive scope).

## Info

### IN-01: Dead `headToHead` branch in `partitionByStepValue`

**File:** `shared/domain/tiebreakers/steps.ts:310-315`

**Issue:** `partitionByStepValue` groups `headToHead`-kind `StepValue`s into a `'headToHead'` bucket, but every caller (`evaluateCommonOpponents`, `evaluateCumulativeOpponentWinPct`, `evaluateNextHighestPlacedCommonOpponent`, and the round-robin branch of `evaluateHeadToHead`) only ever produces `'record'` or `'indeterminate'` values via `winPctSafe`. The non-round-robin branch of `evaluateHeadToHead` — the only producer of `'headToHead'`-kind values — has its own bespoke partition logic (`steps.ts:132-158`) and never calls `partitionByStepValue`. This branch is unreachable.

**Fix:** remove the dead branch, or add a comment explaining it's defensive-only if intentionally retained.

### IN-02: Unreachable trailing `return ''` in `stepValueText`

**File:** `app/components/TiebreakerReasoning.vue:66-83`

**Issue:** The inner `switch (value.result)` for the `'headToHead'` case exhaustively covers all four literal members of that union and returns in every branch; the `break` that follows falls out to a trailing `return ''` that can never execute given the outer switch is also exhaustive on `value.kind`. Minor dead code / signal that the function's control flow could be simplified to a single exhaustive `switch`.

### IN-03: `decisionsFor(conference)` allocates a throwaway `ComputedRef` inside a hot loop

**File:** `app/composables/useStandings.ts:105-117`

**Issue:** The `rankings` computed calls `decisionsFor(conference).value` once per P4 conference on every recompute. `decisionsFor` (`useManualTiebreakers.ts:167-169`) constructs a brand-new `computed(...)` object on every call and is invoked only to immediately read `.value` and discard the wrapper — four short-lived `ComputedRef` allocations per recompute of `rankings` for no memoization benefit, since nothing else ever reads that specific `ComputedRef` instance.

**Fix:** read `decisions.value[conference] ?? {}` directly (or expose a plain function `decisionsFor(conference): ManualDecisions` that doesn't wrap the result in `computed()`), reserving `useManualTiebreakers`'s `computed`-returning `decisionsFor` for call sites that actually hold onto the ref across renders (e.g. a template binding).

---

_Reviewed: 2026-08-19T18:49:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
