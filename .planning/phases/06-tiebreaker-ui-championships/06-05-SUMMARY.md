---
phase: 06-tiebreaker-ui-championships
plan: 05
subsystem: tiebreakers
tags: [tiebreakers, standings, invalidation, hashing, localstorage, vueuse, composables]

requires:
  - phase: 06-tiebreaker-ui-championships
    provides: "Plan 02 -- ConferenceRanking/RankGroup shapes (contestedWith, trace, terminalReason, manualOrdering) that this plan's D-07/D-08 predicates and D-17 application consume directly"
provides:
  - "isConferenceSlateComplete / slateCompletionByConference (shared/domain/standings/slateCompletion.ts) -- the D-07 per-conference, conference-games-only completion gate"
  - "decisionHash / applyManualOrdering (shared/domain/tiebreakers/invalidation.ts) -- the D-08 synchronous invalidation key and the pure function that splits a matched unresolved group into k manual single-team groups"
  - "useManualTiebreakers composable (app/composables/useManualTiebreakers.ts) -- season-namespaced localStorage-backed manual-decision storage implementing 06-UI-SPEC.md's preserve-and-suspend lifecycle (P-1 = C, supersedes 06-CONTEXT.md D-09)"
affects: [06-06, 06-07]

tech-stack:
  added: []
  patterns:
    - "D-08 canonical key: version prefix + sorted team ids + terminal step id + per-team StepValue encoding with the kind discriminant included, hashed synchronously with 20-line FNV-1a -- no crypto.subtle, no hashing library"
    - "Suspension has no stored representation: a decision is suspended purely because gate 1 (slateComplete) is false at read time, never a stored flag or timestamp"
    - "Untrusted-storage validation drops the smallest possible unit (one entry, then one conference, then the whole payload) rather than resetting everything on any single violation"

key-files:
  created:
    - shared/domain/standings/slateCompletion.ts
    - shared/domain/tiebreakers/invalidation.ts
    - app/composables/useManualTiebreakers.ts
    - tests/domain/standings/slateCompletion.test.ts
    - tests/domain/tiebreakers/invalidation.test.ts
    - tests/composables/useManualTiebreakers.test.ts
  modified:
    - shared/domain/standings/index.ts

key-decisions:
  - "The slate-completion test file stayed SINGLE, not split across environments. Convention #4 (Plan 01) only requires the node docblock on files that import tests/helpers/generated-seasons.ts -- since this file DOES import readSlate for the committed-slate case, the whole file legally carries @vitest-environment node, and none of the hand-built fixture cases need happy-dom/DOM APIs, so running them under node costs nothing. No split was needed; the plan's fallback (split into two files) was not exercised."
  - "isTeamSetEqual is duplicated (not exported/imported) between invalidation.ts and useManualTiebreakers.ts. Six lines, and exporting it would have widened invalidation.ts's surface past the four exports the plan's acceptance criteria enumerate exactly (decisionHash, applyManualOrdering, ManualDecisions, ConferenceDecisions)."
  - "A stored conference exceeding MAX_ENTRIES_PER_CONFERENCE (32) is dropped IN FULL, not trimmed to the first 32 -- matches the plan's literal wording ('a stored conference holding more entries than the cap ... is dropped') and avoids an arbitrary, un-auditable choice of which 32 entries to keep."
  - "commitOrdering enforces set-equality against the group's teams before writing (in addition to applyManualOrdering's read-time check), so a caller bug can never persist an internally inconsistent entry in the first place -- belt-and-suspenders around the same T-06-01 threat, not a substitute for the read-time check."

patterns-established:
  - "Manual-decision storage is validated at three independent points: the serializer's shape/cap check on read (T-06-02 DoS), commitOrdering's set-equality guard on write, and applyManualOrdering's set-equality re-check on application -- no single layer is trusted alone"

requirements-completed: [TIE-06]

coverage:
  - id: D1
    description: "isConferenceSlateComplete/slateCompletionByConference implement D-07's per-conference, conference-games-only completion predicate, reachable after ~8% of a season's picks (SEC 72, Big Ten 81, Big 12 72, ACC 74 conference games out of 888 total on the committed 2026 slate)"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/domain/standings/slateCompletion.test.ts#isConferenceSlateComplete (D-07)"
        status: pass
      - kind: unit
        ref: "tests/domain/standings/slateCompletion.test.ts#the committed 2026 slate (reachability check) > has exactly SEC 72, Big Ten 81, Big 12 72, ACC 74 conference games out of 888 total"
        status: pass
    human_judgment: false
  - id: D2
    description: "decisionHash is a synchronous, versioned, kind-discriminant-aware fingerprint of (group membership, terminal step, each team's terminal value); applyManualOrdering applies a stored ordering only under gate 1 (slate complete) AND gate 2 (exact set-equality), splitting a match into k manual single-team groups that preserve contestedWith/trace/terminalReason"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/domain/tiebreakers/invalidation.test.ts#decisionHash (D-08)"
        status: pass
      - kind: unit
        ref: "tests/domain/tiebreakers/invalidation.test.ts#applyManualOrdering (D-08/D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "useManualTiebreakers persists manual decisions in season-namespaced localStorage with the 06-UI-SPEC.md preserve-and-suspend lifecycle: pruneStale is a no-op while the slate is incomplete (suspension) and deletes only non-matching entries once complete; a hash-mismatched decision behaves identically whether it was suspended or continuously active"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/composables/useManualTiebreakers.test.ts#pruneStale (D-08/D-09, 06-UI-SPEC.md Section 9)"
        status: pass
      - kind: unit
        ref: "tests/composables/useManualTiebreakers.test.ts#pruneStale (D-08/D-09, 06-UI-SPEC.md Section 9) > the suspended-versus-continuous equivalence: a hash-mismatched decision behaves identically whether suspended or continuously active"
        status: pass
    human_judgment: false
  - id: D4
    description: "Untrusted localStorage input is validated on read: unparseable JSON or a non-object payload resets to empty silently with no secondary key; an oversized conference (>32 entries) is dropped in full; an individual entry exceeding 20 ids, containing a duplicate, or containing a non-integer is dropped alone"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/composables/useManualTiebreakers.test.ts#malformed storage payloads"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-18
status: complete
---

# Phase 06 Plan 05: Manual-Resolution Lifecycle Summary

**Three pure/composable pieces of the manual-tiebreaker lifecycle -- the D-07 conference-slate-complete gate, the D-08 synchronous invalidation hash and its pure application function, and a localStorage-backed composable implementing 06-UI-SPEC.md's preserve-and-suspend semantics -- with no UI wired to them yet**

## Performance

- **Duration:** 11 min (task-commit span; excludes initial context-reading)
- **Started:** 2026-08-18T19:45:35-06:00 (first commit)
- **Completed:** 2026-08-18T19:55:10-06:00 (last commit)
- **Tasks:** 3 (6 commits: 3 test/RED + 3 feat/GREEN)
- **Files modified:** 7 (6 new, 1 modified)

## Accomplishments

- `shared/domain/standings/slateCompletion.ts`: `isConferenceSlateComplete` and `slateCompletionByConference` implement D-07's predicate -- a conference's slate is complete exactly when every game `conferenceGamesFor` returns for it has a key in `picks`, regardless of what else in the season is picked. Verified reachable at ~8% of a season's picks (72/81/72/74 conference games out of 888 total) via a committed-slate test case.
- `shared/domain/tiebreakers/invalidation.ts`: `decisionHash` is a synchronous FNV-1a hash over a versioned canonical string (sorted team ids, terminal step id, per-team `StepValue` encoding that includes the `kind` discriminant so no variant can collide). `applyManualOrdering` is the pure two-gate application function: gate 1 (slate-complete) is a single early return; gate 2 (exact id-set equality, not containment) is checked per unresolved group before splitting it into k single-team `resolvedBy: 'manual'` groups that preserve `contestedWith`, `trace`, and `terminalReason`.
- `app/composables/useManualTiebreakers.ts`: season-namespaced `useStorage`-backed composable (`cfb_manual_tiebreakers_${season}`) exposing `decisions`, `decisionsFor`, `commitOrdering`, and `pruneStale`. Implements 06-UI-SPEC.md Section 0.1's "preserve and suspend" lifecycle, which supersedes 06-CONTEXT.md D-09's literal "discard" wording: `pruneStale` returns immediately without touching storage while `slateComplete` is false (suspension), and only deletes an entry once the slate is complete AND that entry's hash-or-id-set no longer matches a live unresolved group (the genuine D-08 invalidation path). No `suspended` flag or timestamp exists anywhere in storage -- suspension is structurally just "gate 1 is false right now."
- Untrusted-storage validation (T-06-01 tampering, T-06-02 DoS) drops the smallest unit possible: one bad entry, then one bad conference, then falls back to `{}` only on unparseable JSON or a non-object payload -- mirroring `toOutcomes`' silent-drop discipline rather than nuking the whole store on any single violation.
- Committed a test proving the plan's sharpest invariant directly: a decision that was suspended (slate went incomplete, then complete again with a changed group) and a decision that was continuously active through the same group change produce byte-identical post-mismatch state (`{}` in both paths).

## Task Commits

Each task was committed atomically (test/RED then feat/GREEN):

1. **Task 1: The D-07 conference slate completion predicate** - `416fa05` (test) / `5703031` (feat)
2. **Task 2: The D-08 invalidation key and manual-ordering application** - `2c83ccf` (test) / `da683c3` (feat)
3. **Task 3: useManualTiebreakers -- storage, the two gates, and delete-on-read** - `0f37af8` (test) / `a46753b` (feat)

## Files Created/Modified

- `shared/domain/standings/slateCompletion.ts` - D-07 predicate: `isConferenceSlateComplete`, `slateCompletionByConference`, `SlateCompletion` type
- `shared/domain/standings/index.ts` - re-exports the three new symbols from the barrel
- `shared/domain/tiebreakers/invalidation.ts` - D-08: `decisionHash`, `applyManualOrdering`, `ManualDecisions`, `ConferenceDecisions`
- `app/composables/useManualTiebreakers.ts` - `useManualTiebreakers`: storage, validation, `commitOrdering`, `pruneStale`
- `tests/domain/standings/slateCompletion.test.ts` - D-07 behavior + committed-slate reachability count
- `tests/domain/tiebreakers/invalidation.test.ts` - D-08 hash stability/drift + `applyManualOrdering` gate behavior
- `tests/composables/useManualTiebreakers.test.ts` - storage lifecycle, suspend/delete, malformed-payload caps, season namespacing

## Decisions Made

- **The slate-completion test stayed a single file, not split across environments.** Plan 01's convention #4 only requires the `@vitest-environment node` docblock on files that import `tests/helpers/generated-seasons.ts` -- since this file imports `readSlate` for the committed-slate case, the whole file legally carries the docblock, and the hand-built fixture cases don't touch the DOM, so running them under `node` too costs nothing. The plan's permitted fallback ("split into two files") was not needed.
- **`isTeamSetEqual` is duplicated, not shared, between `invalidation.ts` and `useManualTiebreakers.ts`.** Six lines each; exporting it from `invalidation.ts` would have widened that module's export surface past the four symbols the plan's acceptance criteria enumerate exactly.
- **An oversized conference (>32 hash entries) is dropped IN FULL on read, not trimmed to the first 32.** Matches the plan's literal wording and avoids an arbitrary, un-auditable choice of which entries survive a truncation.
- **`commitOrdering` re-validates set-equality on write, in addition to `applyManualOrdering`'s read-time check.** Belt-and-suspenders against the same T-06-01 threat class (a caller bug persisting an inconsistent entry), not a substitute for the read-time gate.

## Deviations from Plan

None -- plan executed exactly as written. The one test-authoring correction (three assertions initially expected `localStorage.getItem(key)` to be `null` after a fresh composable was created, but VueUse's `useStorage` eagerly writes its default value for a missing key) was caught and fixed during this plan's own TDD RED/GREEN cycle before any commit landed -- not a deviation from the plan's design, a test-authoring bug against a library behavior the plan didn't need to specify.

## Issues Encountered

None beyond the test-authoring correction above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `slateCompletionByConference`, `decisionHash`, `applyManualOrdering`, and `useManualTiebreakers` are all ready for Plan 06-06/06-07 to wire into `useStandings.ts` and the UI: `useStandings` gains a `slateComplete` computed from `slateCompletionByConference`, a `useManualTiebreakers()` instance, and a `computed` that runs `applyManualOrdering(ranking, decisionsFor(conference).value, slateComplete[conference])` per conference before handing the result to `computeStandings`/`ChampionshipCard`/`StandingsTable`.
- `pruneStale` is not yet called from anywhere -- it needs to run once per conference per `standings` recompute (a `watchEffect` or inside the `useStandings` composable itself) so delete-on-read actually fires during normal use. This plan built and tested the function in isolation per its own scope; wiring it into the reactive graph is explicitly Plan 06-06/06-07's job (D-15/D-17's UI surface and the `useStandings` extension both live there).
- `RankGroup.manualOrdering` (added in Plan 06-02, unused until now) is populated for the first time by `applyManualOrdering`'s split groups -- Plan 06-06's `TiebreakerReasoning.vue` (Section 7.5, "DECIDED BY YOU") is the first consumer.
- Coverage (`shared/domain/tiebreakers/**` at 90% branches, `shared/domain/standings/**` at 85%) was not measured with `--coverage` this plan, consistent with Plan 06-02's precedent of deferring that check to whoever next touches those directories at the phase gate.

## Self-Check: PASSED

- All created files exist on disk (6/6): `shared/domain/standings/slateCompletion.ts`, `shared/domain/tiebreakers/invalidation.ts`, `app/composables/useManualTiebreakers.ts`, `tests/domain/standings/slateCompletion.test.ts`, `tests/domain/tiebreakers/invalidation.test.ts`, `tests/composables/useManualTiebreakers.test.ts`
- All commit hashes found in git log (6/6): `416fa05`, `5703031`, `2c83ccf`, `da683c3`, `0f37af8`, `a46753b`

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-18*
