---
phase: 08-share-links
plan: 01
subsystem: domain
tags: [binary-encoding, base64url, bitpack, dataview, untrusted-input-validation, vitest-coverage]

# Dependency graph
requires:
  - phase: 06-tiebreaker-ui-championships
    provides: shared/domain/tiebreakers/invalidation.ts's ConferenceDecisions/ManualDecisions shapes and decisionHash/applyManualOrdering
  - phase: 01-data-pipeline
    provides: public/data/2026/games.json's scheduleHash fingerprint and scripts/lib/schedule-hash.ts's numeric-sort convention
provides:
  - shared/domain/shareLink.ts exporting encodeShareLink/decodeShareLink -- the pure codec every later Phase 8 plan wires into UI
  - shared/domain/tiebreakers/invalidation.ts now exports isValidOrderedIds/validateConferenceDecisions (hoisted, single implementation)
  - A 90%-floor coverage threshold on shared/domain/shareLink.ts in vitest.config.ts
affects: [08-02-share-generation, 08-03-shared-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "9-byte header (version u8, season u16, scheduleHash u32, gameCount u16) + 2-bit-per-game LSB-first bitfield + optional TLV overrides, all via DataView/Uint8Array, no library"
    - "Unified decode position-walk: works identically whether scheduleHash matches or not -- hashMatched only switches banner copy, never a second code path"
    - "TLV section boundary always derived from the payload's OWN gameCount, never currentGames.length -- the reason the header carries gameCount at all"

key-files:
  created:
    - shared/domain/shareLink.ts
    - tests/domain/shareLink.test.ts
  modified:
    - shared/domain/tiebreakers/invalidation.ts
    - app/composables/useManualTiebreakers.ts
    - vitest.config.ts

key-decisions:
  - "9-byte header confirmed per orchestrator-resolved Open Question #1 (gameCount:u16 extension beyond CLAUDE.md's literal 7-byte layout) -- required for SHARE-03's partial-apply-and-report semantics"
  - "isValidOrderedIds/validateConferenceDecisions hoisted to shared/domain/tiebreakers/invalidation.ts as the single shared implementation, imported by both useManualTiebreakers.ts and shareLink.ts"

patterns-established:
  - "Binary codec files live in shared/domain/ as pure functions with zero app/ imports, matching the existing shared/domain/ convention"
  - "Every fallible decode step (base64 decode, header reads, TLV JSON parse) is wrapped so any exception maps to a typed {status: 'malformed'} result -- never throws"

requirements-completed: [SHARE-01, SHARE-03, SHARE-04]

coverage:
  - id: D1
    description: "encodeShareLink/decodeShareLink round-trip picks and manual tiebreaker overrides unchanged when the schedule matches"
    requirement: "SHARE-01"
    verification:
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#round-trips picks through encode/decode when the schedule matches"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#round-trips non-empty manualDecisions through encode/decode, and lengthens the encoded string"
        status: pass
    human_judgment: false
  - id: D2
    description: "decodeShareLink locates the TLV section using the payload's own gameCount header field, surviving a schedule-length change between share-time and open-time without corrupting or misplacing overrides"
    requirement: "SHARE-03"
    verification:
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#reports N of M and applies only in-bounds picks when the payload gameCount exceeds the current schedule"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#locates the TLV section using the payload's own gameCount, not currentGames.length, even across a schedule-length change"
        status: pass
    human_judgment: false
  - id: D3
    description: "A share code longer than MAX_FRAGMENT_CHARS (6000) is rejected before any base64 decoding or JSON parsing runs"
    requirement: "SHARE-04"
    verification:
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#rejects a fragment exceeding MAX_FRAGMENT_CHARS before any decoding work"
        status: pass
    human_judgment: false
  - id: D4
    description: "An out-of-bounds bit position (game id no longer on the current schedule) is dropped individually -- excluded from appliedCount but still counted in totalCount, rest of payload still applies"
    requirement: "SHARE-04"
    verification:
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#reports N of M and applies only in-bounds picks when the payload gameCount exceeds the current schedule"
        status: pass
    human_judgment: false
  - id: D5
    description: "A structurally invalid or truncated TLV section drops the manual tiebreaker overrides only, leaving the picks bitfield's own result untouched; decodeShareLink never throws on any malformed input path"
    requirement: "SHARE-04"
    verification:
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#drops manualDecisions only (keeps the picks bitfield intact) when the TLV JSON fails structural validation"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#drops manualDecisions only when the TLV declared length exceeds the actual payload length"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#drops manualDecisions only when the TLV value bytes are not valid JSON"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#never throws on any TLV-malformed input path"
        status: pass
      - kind: unit
        ref: "tests/domain/shareLink.test.ts#never throws on any malformed input path"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-20
status: complete
---

# Phase 8 Plan 1: Share Link Codec Summary

**`shared/domain/shareLink.ts`'s pure `encodeShareLink`/`decodeShareLink` bitpack-to-base64url codec (9-byte header, 2-bit-per-game bitfield, optional TLV manual-tiebreaker-overrides section), with the per-entry-drop TLV validator hoisted out of `useManualTiebreakers.ts` into `shared/domain/tiebreakers/invalidation.ts` for reuse.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-20T16:25:00Z
- **Completed:** 2026-08-20T16:33:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `shared/domain/shareLink.ts` implements the entire wire format: a 9-byte header (`version:u8`, `season:u16`, `scheduleHash:u32`, `gameCount:u16`), a 2-bit-per-game LSB-first bitfield, and an optional TLV manual-tiebreaker-overrides section -- all via `btoa`/`atob`/`DataView`/`Uint8Array`, no library
- One unified decode position-walk reports accurate `appliedCount`/`totalCount` ("N of M") whether the current schedule's `scheduleHash` matches the payload's or not -- `hashMatched` only switches which banner copy Plan 08-03 will show, never a second code path
- The TLV overrides section is located using the payload's OWN `gameCount` header field, never `currentGames.length` -- proven by an explicit regression test that changes the schedule length between encode and decode and confirms the overrides survive intact
- `decodeShareLink` never throws: every fallible step (fragment size, base64url alphabet, header length, version, bitfield-length bounds, TLV tag/length/JSON) degrades to `{status: 'malformed'}` or a partial-drop, verified across 18 tests including two dedicated "never throws" sweeps
- `isValidOrderedIds`/`validateConferenceDecisions` now have exactly one implementation in the codebase (`shared/domain/tiebreakers/invalidation.ts`), imported by both `useManualTiebreakers.ts` and `shareLink.ts`'s TLV decode -- a hand-crafted share payload is held to the identical caps as a hand-edited localStorage entry
- `shared/domain/shareLink.ts` added to `vitest.config.ts`'s coverage thresholds at the same 90% floor as `shared/domain/tiebreakers/**`; clears it at 98.92% statements / 100% branches / 100% functions / 98.68% lines

## Task Commits

Each task was committed atomically:

1. **Task 1: Hoist the TLV validator into shared/domain/tiebreakers/invalidation.ts** - `eb99b4d` (refactor)
2. **Task 2: shareLink.ts core codec -- base64url, 9-byte header, bitfield, unified decode** - `91e291c` (test, TDD RED+GREEN combined in the create-file commit; 11/11 tests pass)
3. **Task 3: TLV manual-tiebreaker-overrides section + coverage threshold** - `12cbbde` (feat; 18/18 tests pass, coverage threshold added)

_Note: Tasks 2/3 are TDD tasks. The RED phase (failing/module-not-found tests) was verified locally before each GREEN implementation but not committed separately -- each commit captures the already-green state, matching this repo's existing TDD-task commit precedent (see Phase 5/6/7 plans' single feat/test commits per TDD task)._

## Files Created/Modified
- `shared/domain/shareLink.ts` - New: `encodeShareLink`/`decodeShareLink`, `MAX_FRAGMENT_CHARS`, base64url/header/bitfield/TLV helpers
- `tests/domain/shareLink.test.ts` - New: 18 tests covering round-trip, sort-order independence, reserved-bit defense, header-boundary drift (Pitfall 2 regression), size cap, malformed-input paths, and TLV validation/drop-only semantics
- `shared/domain/tiebreakers/invalidation.ts` - Modified: exports `isValidOrderedIds`/`validateConferenceDecisions` (hoisted from `useManualTiebreakers.ts`), constants moved alongside
- `app/composables/useManualTiebreakers.ts` - Modified: imports the hoisted validators instead of redefining them; `isTeamSetEqual` stays module-private as before (deliberately not hoisted)
- `vitest.config.ts` - Modified: added `'shared/domain/shareLink.ts'` coverage threshold entry (90% floor)

## Decisions Made
- Proceeded with the 9-byte header (`gameCount:u16` extension) per the orchestrator-resolved Open Question #1 -- required for SHARE-03's partial-apply-and-report behavior to be implementable at all; without it the decoder cannot locate the bitfield/TLV boundary once the schedule length diverges from the payload's own.
- Kept `isTeamSetEqual` duplicated (not hoisted) in `useManualTiebreakers.ts`, matching the plan's explicit instruction and the existing docblock's stated reasoning -- `shareLink.ts` never needed this particular helper, only `isValidOrderedIds`/`validateConferenceDecisions`.

## Deviations from Plan

None - plan executed exactly as written. One minor documentation-only note: Task 2's `<behavior>` section describes "the seven malformed-input cases above" while enumerating five explicit malformed-returning bullets (fragment-size cap, invalid alphabet, short byte sequence, unsupported version, truncated bitfield); the acceptance criteria's literal target ("All 11 behavior cases pass") was met with 11 `it()` blocks matching all 11 numbered bullets, embedding `not.toThrow()` assertions both inline in each malformed-case test and in a dedicated aggregate "never throws" test -- functionally equivalent coverage, just a wording mismatch in the plan's own prose that didn't affect implementation or test count.

## Issues Encountered

Running `npx vitest run --coverage tests/domain/shareLink.test.ts` in isolation (as the plan's literal `<verify>` command specifies) prints `ERROR: Coverage for ... does not meet "shared/domain/tiebreakers/**"/"shared/domain/standings/**" threshold` lines -- this is pre-existing `vitest.config.ts` behavior (verified by running the same narrow-file coverage command against `tests/domain/tiebreakers/invalidation.test.ts` on the pre-Task-1 commit: identical unrelated-threshold errors appear), not a regression introduced by this plan. The coverage thresholds are evaluated globally against `include: ['shared/**/*.ts']` regardless of which test file ran, so any single-file coverage invocation that doesn't exercise every directory with a configured threshold prints errors for the untouched ones. `shared/domain/shareLink.ts` itself clears its new 90% floor (98.92/100/100/98.68) in both the narrow run and the full-suite run (`npx vitest run --coverage`, 592/592 tests, zero threshold violations printed).

## Next Phase Readiness
- `shared/domain/shareLink.ts`'s `encodeShareLink`/`decodeShareLink` and their exact `DecodeShareLinkResult` shape (`status`/`hashMatched`/`appliedCount`/`totalCount`/`picks`/`manualDecisions`) are ready for Plan 08-02 (share-generation handler) and Plan 08-03 (`useSharedPreview` composable) to import and wire into UI -- no further codec work needed.
- Full test suite is green (592/592) and `pnpm typecheck` exits clean; `package.json`/`pnpm-lock.yaml` are unchanged (zero new dependencies, confirmed via `git diff --stat`).
- No blockers for Plan 08-02/08-03.

---
*Phase: 08-share-links*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: shared/domain/shareLink.ts
- FOUND: tests/domain/shareLink.test.ts
- FOUND: shared/domain/tiebreakers/invalidation.ts
- FOUND: .planning/phases/08-share-links/08-01-SUMMARY.md
- FOUND commit: eb99b4d (Task 1)
- FOUND commit: 91e291c (Task 2)
- FOUND commit: 12cbbde (Task 3)
