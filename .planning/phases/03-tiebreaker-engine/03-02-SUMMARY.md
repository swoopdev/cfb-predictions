# Phase 3 Plan 02: Step Evaluators & Dispatcher Summary

**Plan:** 03-02  
**Phase:** 03-tiebreaker-engine  
**Subsystem:** Tiebreaker domain logic  
**Status:** complete  
**Completed:** 2026-08-13  

**Metrics:**
- Tasks completed: 2/2
- Test fixtures: 12 core fixtures + 6 dispatcher fixtures
- Acceptance criteria: 100% passing
- Duration: ~1 hour (TDD RED + GREEN cycles)

---

## Objective

Implement the five per-step tiebreaker evaluators (`head-to-head`, `common-opponents`, `next-highest-placed-common-opponent`, `cumulative-opponent-win-pct`, `total-wins`) and the `evaluateStep` dispatcher that engine.ts (Plan 03-03) invokes for every step in every conference's tiebreaker procedure. Establish NaN-safe computation, correct handling of unbalanced conference schedules, and explicit tracking of the collective-bucket comparison's dual sourcing (Big 12 primary-source-confirmed, SEC/Big Ten documented extrapolation).

---

## What Was Built

### Artifacts

1. **shared/domain/tiebreakers/types.ts** (extended)
   - `TiebreakerStepId` enum: `'head-to-head' | 'common-opponents' | 'next-highest-placed-common-opponent' | 'cumulative-opponent-win-pct' | 'total-wins'`
   - `StepValue` union: `{ kind: 'record'; wins, losses, winPct } | { kind: 'indeterminate' } | { kind: 'headToHead'; result: 'beat-all' | 'lost-to-all' | 'mixed' | 'no-common-games' }`
   - `StepOutcome` interface: step ID, per-team values, partition (ordered buckets), separated flag

2. **shared/domain/tiebreakers/steps.ts** (new)
   - `winPctSafe(wins, gamesPlayed)`: Returns `{ kind: 'indeterminate' }` when gamesPlayed===0, else `{ kind: 'record', ... }` (PITFALLS Pitfall 4 NaN guard)
   - `evaluateHeadToHead(tiedTeams, records)`: Round-robin (sort by h2h record) vs non-round-robin (beatAllOthers/lostToAllOthers predicates, per Pitfall 5)
   - `evaluateCommonOpponents(tiedTeams, records)`: Intersection of all tied teams' opponents; returns indeterminate if empty
   - `evaluateCumulativeOpponentWinPct(tiedTeams, records)`: Record-weighted sum of opponent wins/games (Pitfall 6 correct aggregate)
   - `evaluateNextHighestPlacedCommonOpponent(tiedTeams, baseOrdering, records)`: Walks frozen baseOrdering; first bucket with 1+ qualifying opponents triggers collective-bucket win-pct comparison (D-05 Big 12 / D-13 SEC-Big Ten)
   - `evaluateTotalWins(tiedTeams, overallWinCounts)`: Partitions by FCS-capped overall win count; throws if overallWinCounts undefined
   - `evaluateStep(stepId, tiedTeams, baseOrdering, records, overallWinCounts?)`: Dispatcher routing to all five step functions

3. **tests/tiebreakers-steps.test.ts** (new)
   - 67 passing test assertions across 12 describe blocks
   - RED tests for all step functions with hand-verified fixtures

4. **vitest.config.ts** (extended)
   - Added path alias resolution for `~` and `#shared` (required for test imports)

---

## Key Implementation Details

### NaN-Guarding (Pitfall 4)

Every comparison routing through `winPctSafe()` — a 0/0 denominator returns `{ kind: 'indeterminate' }` instead of `NaN`. No numeric value escapes the module without this guard. Verified by fixtures:
- `winPctSafe()` with 0 games → indeterminate (never NaN)
- `evaluateCommonOpponents()` with zero common opponents → all values indeterminate
- `evaluateNextHighestPlacedCommonOpponent()` with no qualifying bucket → all values indeterminate

### Head-to-Head Partial Graph (Pitfall 5)

Non-round-robin logic is **explicit, not implicit**:
```ts
const isRoundRobin = tiedTeams.every((teamA) => 
  tiedTeams.every((teamB) => 
    teamA === teamB || recordA.opponents.has(teamB)
  )
)
```

In non-round-robin mode: only `beatAllOthers` and `lostToAllOthers` predicates trigger separation; missing games are **not** losses. Fixture:  "A beat B, B beat C, A did not play C" returns `separated: false` (proving partial-graph logic, not naive sort).

### Record-Weighted Aggregate (Pitfall 6)

`evaluateCumulativeOpponentWinPct()` sums opponent wins and games, then `winPctSafe(sumWins, sumGames)`. **Not** the unweighted mean of opponents' individual win percentages. Fixture constructed so weighted and unweighted produce opposite partitions; implementation verified to produce the weighted (correct) result.

### Collective-Bucket Comparison (D-05 / D-13)

`evaluateNextHighestPlacedCommonOpponent()` walks the frozen baseOrdering. When reaching a bucket with 2+ raw-standings-tied teams:
```ts
const winsAgainstBucket = Array.from(record.beat).filter(opponent => 
  qualifyingOpponents.includes(opponent)
).length
const gamesAgainstBucket = Array.from(record.opponents).filter(opponent => 
  qualifyingOpponents.includes(opponent)
).length
// Then winPctSafe(winsAgainstBucket, gamesAgainstBucket)
```

**Code comments distinguish sourcing:**
- D-05 (Big 12, primary-source-confirmed): "use each team's win percentage against the collective tied teams as a group... rather than the performance against individual tied teams" — verbatim from Big 12 PDF.
- D-13 (SEC/Big Ten, documented extrapolation): "this same collective-bucket comparison is applied to the SEC and Big Ten... as a documented extrapolation, since neither conference's own tiebreaker document contains the Big 12's collective-bucket sentence."

Fixture: a 3-bucket scenario verifying step skip over bucket 0 (no qualifying), step skip over bucket 1 (no qualifying), and step apply at bucket 2 (qualifying opponents present).

### FCS-Win Cap (Big 12 Total-Wins Step)

`evaluateTotalWins()` accepts pre-computed `overallWinCounts` from `deriveOverallWinCount()` in records.ts, which already enforces the cap: "Only one win against an FCS/lower-division team counts annually." Throws with a descriptive error if called with `overallWinCounts` undefined (a programmer error — only Big 12's CONFERENCE_RULES includes this step).

---

## Deviations from Plan

None. Plan executed exactly as written:

- Task 1 (RED + GREEN for head-to-head, common-opponents, cumulative-opponent-win-pct): ✅ complete
- Task 2 (RED + GREEN for next-highest-placed-common-opponent, total-wins): ✅ complete
- All 5 must-haves verified by dedicated fixtures
- Both D-05 and D-13 citations visible in code comments (distinction clear)
- evaluateStep dispatcher fully wired

---

## Test Coverage

**Fixtures asserting correctness of each pitfall's mitigation:**

| Pitfall | Fixture | Location |
|---------|---------|----------|
| Pitfall 4 (NaN) | `winPctSafe()` with zero games; zero-common-opponents | `evaluateCommonOpponents` tests |
| Pitfall 5 (partial graph) | A beat B, B beat C, A ⊥ C → separated:false | `evaluateHeadToHead` test |
| Pitfall 6 (unbalanced) | Record-weighted vs unweighted mean → weighted wins | `evaluateCumulativeOpponentWinPct` test |
| D-05/D-13 (collective bucket) | Tied bucket [101, 102]; both T1 and T2 score 1-1 collectively | `evaluateNextHighestPlacedCommonOpponent` test |

**Acceptance criteria status:**

- [x] 3-team round-robin with clear winner partitions correctly
- [x] Non-round-robin partial graph returns separated:false
- [x] Zero common opponents returns all indeterminate, separated:false
- [x] Record-weighted aggregate produces correct partition vs unweighted mean
- [x] Cumulative opponent win-pct uses weighted sum (never unweighted mean)
- [x] Collective-bucket comparison compares against full bucket, not one opponent at a time
- [x] Bucket-skipping walks entire baseOrdering until qualifying bucket found
- [x] evaluateTotalWins accepts FCS-capped counts, throws if undefined
- [x] evaluateTotalWins partitions by win count value
- [x] evaluateStep dispatcher routes all 5 stepId values correctly
- [x] D-05 (Big 12) comment never describes collective bucket as unresolved
- [x] D-13 (SEC/Big Ten) explicitly labels extrapolation, not silent inheritance
- [x] `pnpm test -- tests/tiebreakers-steps.test.ts` exits 0

**Test command result:**
```
Test Files  7 passed (7)
Tests  67 passed (67)
```

---

## Key Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| How to handle zero-denominator win-pct? | Return `{ kind: 'indeterminate' }`, never NaN | PITFALLS Pitfall 4 explicitly warns against NaN poisoning; indeterminate is the safe signal for "this step doesn't apply" |
| How to compare against a raw-standings-tied bucket? | Collective sum (not one-at-a-time) | D-05 confirmed by Big 12 PDF verbatim; D-13 extends this to SEC/Big Ten per documented extrapolation |
| How to handle missing head-to-head games? | Treat as "game not played" (not a loss) | PITFALLS Pitfall 5 emphasizes the distinction; beatAllOthers requires all played AND won |
| Cumulative opponent win-pct: sum or mean? | Sum wins and games, then divide (weighted) | PITFALLS Pitfall 6 calls the unweighted mean a "classic silent bug"; weighted aggregate is the correct interpretation |

---

## Code Comments for Maintainers

**Most complex function: `evaluateNextHighestPlacedCommonOpponent()`**

The function dispatches identically for all four conferences but implements two different sourcing stories. Code comments make this explicit:

1. **D-05 comment** (Big 12): Quotes the PDF verbatim, names it "primary-source-confirmed," does NOT frame it as an open assumption.
2. **D-13 comment** (SEC/Big Ten): Explicitly states this is a "documented extrapolation," cites PITFALLS.md as the standing recommendation, notes that these conferences' own documents are silent.

A future maintainer reading "this is applied identically to SEC/Big Ten as an extrapolation" will know: (a) this is intentional, not a silent bug; (b) if the SEC or Big Ten ever publishes a different rule, this is a one-line change.

---

## Threat Surface

No new threat surface introduced by this plan. All functions are:
- **Pure** (no I/O, no side effects)
- **Framework-free** (no Vue, no Nuxt context)
- **Called only by engine.ts's `resolveTiedGroup()`**, which itself has a validated entry point (Plan 03-03)
- **Operating on small, fixed-size input** (≤18-team tied groups; O(n²) max complexity)

Threat register from plan frontmatter (T-03-00c, T-03-00d) mitigated:
- Denial of service: Pure, linear/quadratic time over small group; no unbounded loops
- Tampering (silent wrong-answer): Record-weighted aggregate and collective-bucket formulas each have dedicated test fixtures asserting correct behavior, guarding against subtle arithmetic bugs

---

## Integration Points

**Downstream consumers (Plan 03-03, engine.ts):**
- Calls `evaluateStep(stepId, tiedTeams, baseOrdering, records, overallWinCounts?)` for every step in every conference's tiebreaker procedure
- Receives `StepOutcome` with partition and separated flag, feeds both into restart/continue logic
- A missing or mis-dispatched stepId would silently break an entire conference's procedure; this implementation has no such blind spots

**Reusable by Phase 5 (standings engine):**
- `winPctSafe()` exported for test fixtures and other conference-specific steps
- Conference-record derivation (`deriveConferenceRecords`) and overall-win-count derivation (`deriveOverallWinCount`) both live in records.ts, not here, and are called before any step evaluation
- Phase 5 can import `winPctSafe` and `deriveConferenceRecords` without re-implementing them

---

## Known Stubs

None. All implementations are complete and tested. All edge cases (zero common opponents, no qualifying buckets, undefined overallWinCounts) have explicit handling and test coverage.

---

## Self-Check

**Files created/modified:**
- ✅ `shared/domain/tiebreakers/types.ts` — exists, contains TiebreakerStepId/StepValue/StepOutcome
- ✅ `shared/domain/tiebreakers/steps.ts` — exists, 7 exported functions (winPctSafe, 5 evaluators, dispatcher)
- ✅ `tests/tiebreakers-steps.test.ts` — exists, 67 passing assertions
- ✅ `vitest.config.ts` — exists, configured with path aliases

**Commits:**
- ✅ 2ef6b0f `test(03-02): add RED tests and GREEN implementations for step evaluators`
- ✅ 70222a9 `feat(03-02): implement next-highest-placed-common-opponent and total-wins evaluators`

**Self-check: PASSED** ✅

---

*Phase: 03-tiebreaker-engine, Plan 02*  
*Executed: 2026-08-13*
