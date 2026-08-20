---
phase: 08-share-links
reviewed: 2026-08-20T20:58:49Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/components/PicksWorkspace.vue
  - app/components/ScenarioSwitcher.vue
  - app/components/ShareLinkModal.vue
  - app/components/SharedScenarioBanner.vue
  - app/composables/useManualTiebreakers.ts
  - app/composables/useSharedPreview.ts
  - app/composables/usePicksStorage.ts
  - app/pages/week/[week].vue
  - shared/domain/shareLink.ts
  - shared/domain/tiebreakers/invalidation.ts
  - tests/components/ScenarioSwitcher.test.ts
  - tests/components/ShareLinkModal.test.ts
  - tests/components/SharedScenarioBanner.test.ts
  - tests/composables/useSharedPreview.test.ts
  - tests/domain/shareLink.test.ts
  - tests/helpers/nuxtUiStubs.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-20T20:58:49Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 8 wires the bitpacked share-link codec (`shared/domain/shareLink.ts`) into a
non-persisted preview flow (`useSharedPreview.ts` → `PicksWorkspace.vue` →
`week/[week].vue`), plus a Share affordance on `ScenarioSwitcher.vue` /
`ShareLinkModal.vue` and a three-variant `SharedScenarioBanner.vue`. This is a
genuinely well-defended untrusted-input boundary: fragment-length gating before any
decode work, base64url-alphabet pre-validation before `atob`, explicit header/bitfield
length checks, fail-closed positional-pick re-application on a schedule-hash mismatch
(with a dedicated CR-01 regression test for the "mid-list removal" misattribution
case), and a TLV section that drops manual-tiebreaker overrides independently of the
picks bitfield without ever throwing. I ran the full test suite for these files
(186 tests, all passing), `vue-tsc --noEmit` (clean), and `eslint` against every
reviewed source file (clean) — no functional regressions surfaced there.

The issues found here are all real but sit below BLOCKER severity: a silently
swallowed non-`ShareLinkTooLargeError` exception in the Share click handler (the user
gets zero feedback if `encodeShareLink` ever throws something unexpected), a
write-path/read-path asymmetry in `useManualTiebreakers.ts`'s per-conference entry cap
that can silently drop a user's own manual-tiebreaker history (not just an attacker's)
on a later page load, duplicated pipeline-composition logic between
`useStandings.ts` and `PicksWorkspace.vue`'s preview branch that DRY-violates
CLAUDE.md's "standings computation... has exactly one implementation" constraint, and
a missing component-level test file for `PicksWorkspace.vue`'s preview wiring itself
(the composable and domain-logic layers are thoroughly tested; the component that
actually branches behavior on `props.preview` is not).

## Warnings

### WR-01: Share click silently swallows any error that isn't `ShareLinkTooLargeError`

**File:** `app/pages/week/[week].vue:93-102`
**Issue:** `handleShare`'s `catch (err)` block only logs when `err instanceof
ShareLinkTooLargeError`; any other exception (e.g. a `RangeError` from `DataView`
if `games.value.scheduleHash` is ever malformed, or any future exception
`encodeShareLink` grows) is caught and discarded with `return` and zero
console output. From the user's perspective, clicking "Share" simply does
nothing — no modal, no error, no log trail to diagnose the problem, even in dev.
Even the documented `ShareLinkTooLargeError` case is developer-only: the
`console.warn` is not visible to a real user, who is left with a Share button that
silently no-ops.
**Fix:**
```ts
} catch (err) {
  if (err instanceof ShareLinkTooLargeError) {
    console.warn(`Scenario "${target.name}" is too large to share (${err.encodedLength} chars, limit is smaller).`)
  } else {
    console.error(`Unexpected error building share link for scenario "${target.name}":`, err)
  }
  // Consider surfacing a toast/inline message here too — a silent no-op button
  // is indistinguishable from a broken feature to the user.
  return
}
```

### WR-02: `useManualTiebreakers.commitOrdering` has no write-side cap, but the read-side cap drops the whole conference

**File:** `app/composables/useManualTiebreakers.ts:117-127`, `shared/domain/tiebreakers/invalidation.ts:128-135, 172-198`
**Issue:** `MAX_ENTRIES_PER_CONFERENCE` (32) and `MAX_IDS_PER_ENTRY` (20) are enforced
only in `validateConferenceDecisions`, which runs on the `useStorage` **read**
serializer (i.e. on the next parse of the raw localStorage string). `commitOrdering`
writes directly to `decisions.value` with no equivalent check, so a session that
accumulates more than 32 distinct hash-keyed decisions for one conference (plausible
over a full season of picks-and-repicks, since `decisionHash` changes whenever the
tied group's terminal-step values change) can grow past the cap entirely
unnoticed. On the *next* page load, `validateConferenceDecisions` sees
`entryPairs.length > MAX_ENTRIES_PER_CONFERENCE` and drops the **entire
conference's** decisions — not just the overflow — silently, with no user-facing
message (matching this file's own documented "no logging" policy, but that policy
was written for hostile/hand-edited payloads, not the app's own legitimately-written
data). This is a real, if low-probability, data-loss path for a power user's own
work, not just a defense against a malicious payload.
**Fix:** Either enforce the same cap at write time in `commitOrdering` (evict the
oldest entry, e.g. LRU by insertion order, when adding would exceed 32) so the
in-memory/stored shape can never legitimately drift past what the read-side
validator accepts, or widen the read-side recovery to drop only the oldest
entries beyond the cap instead of the whole conference.

### WR-03: Standings/tiebreaker pipeline composition order is duplicated between `useStandings.ts` and `PicksWorkspace.vue`

**File:** `app/components/PicksWorkspace.vue:87-119` (duplicates `app/composables/useStandings.ts:106-141`, out of this phase's file list but the duplication target)
**Issue:** CLAUDE.md's DRY constraint states "standings computation, and
tiebreaker logic each have exactly one implementation, consumed through
composables." The underlying pure functions (`resolveAllConferences`,
`slateCompletionByConference`, `applyManualOrdering`, `computeStandings`) do stay
single-implementation, but the **order** in which they're composed — resolve →
slate-completion → apply-manual-ordering → compute-standings — is now written out
twice: once in `useStandings.ts`'s `rankings`/`standings` computeds, and again,
by-hand, in `PicksWorkspace.vue`'s `previewRankings`/`previewSlateComplete`/
`previewRankingsWithManual`/`previewStandings` computeds. The docblock at
`PicksWorkspace.vue:87-90` even says so explicitly ("duplicating
useStandings.ts's own composition order exactly"). If that order or a future step
in the pipeline changes in `useStandings.ts` (e.g. Phase 9 inserts a new stage),
nothing forces the preview branch to be updated to match — real vs. previewed
standings can silently diverge.
**Fix:** Extract the shared composition into one pure function, e.g.
`computeStandingsPipeline(games, teams, picks, manualDecisions, conferences)` in
`shared/domain/standings.ts` (or a new `shared/domain/standingsPipeline.ts`), and
have both `useStandings.ts`'s computeds and `PicksWorkspace.vue`'s preview computeds
call it. `useStandings.ts`'s `pruneStale` side effect can stay composable-only since
it's storage-specific and legitimately doesn't apply to a preview.

### WR-04: `commitOrdering` silently no-ops during an active preview with no user-facing feedback

**File:** `app/components/PicksWorkspace.vue:151-154`
**Issue:**
```ts
function commitOrdering(conference: ConferenceId, group: RankGroup, orderedTeamIds: readonly TeamId[]) {
  if (props.preview) return
  storedCommitOrdering(conference, group, orderedTeamIds)
}
```
This is passed straight through to `StandingsSidebar`'s manual-tiebreaker-reorder
UI. If a user is viewing a shared preview and attempts to manually resolve a tied
group, the click/drag succeeds in the UI's own local interaction but the commit is
a silent no-op — nothing persists, and nothing tells the user why their choice
"didn't stick." This matches a documented assumption (RESEARCH.md Assumption A3)
but there's no UI-level guard preventing the interaction from starting in the first
place, so the failure mode is silent rather than prevented.
**Fix:** Either disable/hide the manual-reorder affordance in `StandingsSidebar`
when a preview is active (pass `props.preview` down, or a derived
`readonly`/`previewActive` flag), or surface a brief inline message ("Save a copy
first to set manual tiebreakers") when the no-op path is hit.

### WR-05: No component-level test for `PicksWorkspace.vue`'s preview branching

**File:** `app/components/PicksWorkspace.vue` (no corresponding `tests/components/PicksWorkspace.test.ts` exists anywhere in the repo)
**Issue:** The composable (`useSharedPreview.test.ts`) and domain (`shareLink.test.ts`)
layers are exhaustively tested, but the component that actually implements the
preview contract — the writable `picks` computed's in-place mutation of
`props.preview.picks` (`vue/no-mutating-props`-disabled by design), the
bulk-operation handlers' preview-vs-real branching (`handleFillWeek`,
`handleFillSeason`, `handleClearWeek`, `handleClearSeason`), and the
`commitOrdering` no-op documented in WR-04 above — has zero direct test coverage.
Given T-08-08's explicit requirement ("structurally incapable of a `localStorage`
write") is a property of `useSharedPreview` alone, nothing currently proves that
`PicksWorkspace.vue`'s preview-mode picks mutation similarly never reaches
`storedPicks`/localStorage, nor that the bulk handlers correctly skip
`markAutoFilled`/`autoFilled.value.splice` during a preview.
**Fix:** Add `tests/components/PicksWorkspace.test.ts` covering: (1) mutating
`picks` while `preview` is set never touches the `usePicksStorage`-backed ref, (2)
`handleFillWeek`/`handleFillSeason` under preview mutate `preview.picks` and skip
`markAutoFilled`, (3) `handleClearSeason` under preview does not call
`autoFilled.value.splice`.

### WR-06: Duplicated `SharedPreviewState`/preview-object shape between the composable and its consumer

**File:** `app/components/PicksWorkspace.vue:57`, `app/composables/useSharedPreview.ts:33-36`
**Issue:** `useSharedPreview.ts` exports `SharedPreviewState` (`{ picks:
Record<number, number>, manualDecisions: ConferenceDecisions }`), but
`PicksWorkspace.vue`'s `preview` prop re-declares the identical shape inline
instead of importing the exported type:
```ts
preview?: { picks: Record<number, number>, manualDecisions: ConferenceDecisions } | null
```
TypeScript's structural typing means this doesn't cause a compile error today, but
it's a second source of truth for a shape that already has a name — a future field
added to `SharedPreviewState` (e.g. a `scheduleHash` echo for display) silently
fails to widen `PicksWorkspace`'s prop type, and the mismatch would only surface as
a confusing "property does not exist" error at the call site in `week/[week].vue`
rather than at the natural definition site.
**Fix:** `import type { SharedPreviewState } from '~/composables/useSharedPreview'`
and use `preview?: SharedPreviewState | null` in `PicksWorkspace.vue`'s `Props`.

## Info

### IN-01: `MAX_SCENARIO_NAME_LENGTH` is a hand-duplicated magic number across two files

**File:** `app/components/ScenarioSwitcher.vue:14`
**Issue:** `ScenarioSwitcher.vue` re-declares `const MAX_SCENARIO_NAME_LENGTH = 60`
rather than importing it from `useScenarios.ts`, which owns the same constant as the
untrusted-storage-boundary cap. The in-file comment (lines 9-13) explains this is
deliberate — the UI cap and the storage cap are allowed to drift in the future —
but today they are numerically identical and drift-by-omission (someone changes one
copy and forgets the other) is a real risk with zero compiler enforcement.
**Fix:** If the two are meant to stay in lockstep for now, export the constant
from `useScenarios.ts` and import it here; only fork it into a second, differently
named constant once the UI cap is actually intended to diverge from the storage cap.

### IN-02: `scheduleHash` comparison assumes lowercase-hex on both sides with no normalization

**File:** `shared/domain/shareLink.ts:82-89, 224`
**Issue:** `readHeader` always reconstructs `scheduleHash` as lowercase hex
(`.toString(16).padStart(8, '0')`), and `hashMatched` compares it via `===`
against `currentScheduleHash` verbatim. This is almost certainly safe in practice
(Node's `Buffer.toString('hex')`/`crypto` digests are lowercase by convention), but
nothing in this file defensively normalizes case on the `currentScheduleHash` input,
so if the upstream schedule-hash generator (outside this phase's file scope) ever
changes to uppercase or mixed-case hex, every legitimately-matching share link would
silently degrade to the `'mismatch'` banner (fail-closed picks) rather than erroring
loudly.
**Fix:** `header.scheduleHash === currentScheduleHash.toLowerCase()` costs nothing
and removes the implicit cross-module casing assumption entirely.

---

_Reviewed: 2026-08-20T20:58:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
