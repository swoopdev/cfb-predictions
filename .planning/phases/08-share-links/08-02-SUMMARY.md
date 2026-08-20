---
phase: 08-share-links
plan: 02
subsystem: ui
tags: [vue, nuxt-ui, clipboard-api, vitest-component-tests, scenario-management]

# Dependency graph
requires:
  - phase: 08-share-links
    provides: "Plan 08-01's shared/domain/shareLink.ts encodeShareLink/decodeShareLink codec, and scenarioKeys.ts/Phase 7's non-active-scenario raw-localStorage read pattern"
  - phase: 07-named-scenarios
    provides: "ScenarioSwitcher.vue's per-row action pattern, DeleteScenarioModal.vue's UModal prop/emit shape, scenarioKeys.ts key-builder, tests/helpers/nuxtUiStubs.ts"
provides:
  - "ScenarioSwitcher.vue's fourth per-row action: Share, emitting 'share': [id: string]"
  - "app/components/ShareLinkModal.vue -- displays a scenario's share URL, copies it to the clipboard with a visible confirmation, degrades gracefully with no Clipboard API"
  - "week/[week].vue's handleShare -- reads any scenario's (active or not) raw picks/manual decisions and encodes a share URL with zero localStorage writes"
  - "tests/helpers/nuxtUiStubs.ts's UInputStub, sibling to UButtonStub/UModalStub/etc."
affects: [08-03-shared-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy-to-clipboard with a timed confirmation-state swap (ref + setTimeout, no external library), select-on-focus as the no-Clipboard-API fallback"
    - "handleShare bridges a per-row emit id onto a modal's open/name/url contract, mirroring week/[week].vue's existing deleteTarget/deleteModalOpen pattern exactly"

key-files:
  created:
    - app/components/ShareLinkModal.vue
    - tests/components/ShareLinkModal.test.ts
  modified:
    - app/components/ScenarioSwitcher.vue
    - tests/components/ScenarioSwitcher.test.ts
    - tests/helpers/nuxtUiStubs.ts
    - app/pages/week/[week].vue

key-decisions:
  - "handleShare reads scenarioKeys.picks/manualTiebreakers for the clicked row's id via raw localStorage.getItem -- never constructs a live usePicksStorage/useManualTiebreakers instance for a non-active scenario (T-08-07 mitigation), matching Phase 7's duplicateScenario/deleteScenario precedent exactly"
  - "encodeShareLink's params object includes only games/season/scheduleHash/picks/manualDecisions -- the scenario's local name/id are never passed (D-04)"

patterns-established:
  - "ShareLinkModal.vue's Copy Link button is the second precedent (after GameCard.vue's pick checkmark) for an icon+label swap-on-success UI affordance"

requirements-completed: [SHARE-01]

coverage:
  - id: D1
    description: "Clicking a scenario's Share action (any row, active or not) opens ShareLinkModal showing a working #s=<code> URL generated from that scenario's own picks/manual decisions"
    requirement: "SHARE-01"
    verification:
      - kind: unit
        ref: "tests/components/ScenarioSwitcher.test.ts#share: share icon emits share(id) and does not emit update:modelValue"
        status: pass
      - kind: unit
        ref: "tests/components/ShareLinkModal.test.ts#renders the share URL input with the exact shareUrl prop value and a readonly attribute"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sharing works identically at zero picks and at any partial/complete pick state -- no completeness gate blocks the Share action"
    requirement: "SHARE-01"
    verification:
      - kind: unit
        ref: "tests/components/ScenarioSwitcher.test.ts#share affordance carries no disabled binding regardless of scenario count"
        status: pass
    human_judgment: false
  - id: D3
    description: "Copy Link writes the exact shareUrl to the clipboard, shows a Copied! confirmation that reverts after ~2s, and degrades gracefully (no throw, no Copied! state) when navigator.clipboard is unavailable; focusing the URL field selects its full text as the fallback"
    requirement: "SHARE-01"
    verification:
      - kind: unit
        ref: "tests/components/ShareLinkModal.test.ts#clicking \"Copy Link\" calls navigator.clipboard.writeText with the exact shareUrl prop value"
        status: pass
      - kind: unit
        ref: "tests/components/ShareLinkModal.test.ts#after a successful copy, the button swaps to \"Copied!\" then reverts to \"Copy Link\" after ~2000ms"
        status: pass
      - kind: unit
        ref: "tests/components/ShareLinkModal.test.ts#when navigator.clipboard is undefined, clicking \"Copy Link\" does not throw and does not enter the \"Copied!\" state"
        status: pass
      - kind: unit
        ref: "tests/components/ShareLinkModal.test.ts#focusing the URL input selects its full text"
        status: pass
    human_judgment: false
  - id: D4
    description: "handleShare performs zero localStorage writes and never includes the scenario's local name/id in the encoded payload -- verified by static grep, not automatable as a unit assertion without a full page mount/localStorage spy harness"
    requirement: "SHARE-01"
    verification: []
    human_judgment: true
    rationale: "handleShare lives in week/[week].vue, a page component with no dedicated unit test harness in this repo (page-level integration is deliberately uncovered per the Phase 4/5 UAT precedent already on record in STATE.md). Verified via grep (no usePicksStorage/useManualTiebreakers call, encodeShareLink params list matches exactly) and via full-suite green (602/602), but the human-visible end-to-end URL-generation-and-copy flow across the real ScenarioSwitcher -> handleShare -> ShareLinkModal wiring is best confirmed in a live browser walkthrough, same as Phase 7's own scenario-switching UAT."
---

# Phase 8 Plan 2: Share Link Generation UI Summary

**A "Share" row action on every scenario (active or not) that opens ShareLinkModal.vue with a working `#s=<code>` URL -- generated by reading raw localStorage via `scenarioKeys` and encoding through Plan 08-01's `encodeShareLink`, with zero localStorage writes and a Clipboard-API copy affordance that degrades to select-on-focus.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-20T10:37:00Z
- **Completed:** 2026-08-20T10:49:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 new, 3 modified, plus 1 test file modified for Task 1)

## Accomplishments
- `ScenarioSwitcher.vue` gains a fourth per-row `UButton` (`lucide:share-2`, neutral/ghost, always enabled -- unlike Delete, Share has no completeness gate per D-03) and a `'share': [id: string]` emit, wired identically to the existing rename/duplicate/delete actions
- `ShareLinkModal.vue` mirrors `DeleteScenarioModal.vue`'s exact `UModal` prop/emit/slot pattern: a read-only `UInput` showing the share URL (select-on-focus), and a single "Copy Link" `UButton` that writes to the clipboard, swaps to a "Copied!" confirmation for ~2s, and silently no-ops (never throws) when `navigator.clipboard` is unavailable
- `week/[week].vue`'s new `handleShare(id)` reads the CLICKED scenario's raw `localStorage` picks/manual-tiebreaker-decisions via `scenarioKeys` -- never the active scenario, never a live `usePicksStorage`/`useManualTiebreakers` instance -- and passes only `games`/`season`/`scheduleHash`/`picks`/`manualDecisions` to `encodeShareLink` (D-04: no scenario name/id leaks into the URL)
- `tests/helpers/nuxtUiStubs.ts` gains a `UInputStub` sibling to the existing four stubs, enabling `ShareLinkModal.test.ts`'s 8 behavior cases under this project's plain (non-Nuxt) vitest project
- Full suite: 602/602 tests pass; `pnpm typecheck` and `pnpm lint` both exit 0; `git diff --stat package.json pnpm-lock.yaml` confirms zero dependency changes (T-08-SC)

## Task Commits

Each task was committed atomically:

1. **Task 1: ScenarioSwitcher.vue Share row action** - `683c532` (feat)
2. **Task 2: ShareLinkModal.vue** - `7a03721` (test, TDD RED+GREEN combined in the create-file commit; 8/8 tests pass)
3. **Task 3: week/[week].vue handleShare wiring** - `3a81889` (feat)

_Note: Task 2 is a TDD task. The RED phase (module-not-found/failing assertions) was verified locally before the GREEN implementation but not committed separately -- matches this repo's existing TDD-task commit precedent (Phase 5/6/7 plans, and Plan 08-01's own note on this exact convention)._

## Files Created/Modified
- `app/components/ScenarioSwitcher.vue` - Modified: fourth `UButton` (Share, `lucide:share-2`) in `#item-trailing`, `'share': [id: string]` emit
- `tests/components/ScenarioSwitcher.test.ts` - Modified: Share emit-contract test, always-enabled assertion, aria-label sweep updated to include Share
- `app/components/ShareLinkModal.vue` - New: displays/copies a scenario's share URL, mirrors `DeleteScenarioModal.vue`
- `tests/components/ShareLinkModal.test.ts` - New: 8 behavior cases (title/body copy, URL rendering, copy-to-clipboard, Copied! swap/revert, no-Clipboard-API degrade, select-on-focus, open=false, update:open passthrough)
- `tests/helpers/nuxtUiStubs.ts` - Modified: added `UInputStub`, added to `nuxtUiTestStubs`, docblock updated
- `app/pages/week/[week].vue` - Modified: `shareTarget`/`shareModalOpen` state, `handleShare(id)`, `@share="handleShare"` on `ScenarioSwitcher`, `ShareLinkModal` mount

## Decisions Made
- Followed the plan's literal `handleShare` implementation verbatim: a bare `JSON.parse` with no `try/catch` on the scenario's own previously-validated stored picks/decisions, matching `duplicateScenario`'s established "our own writes, no re-validation on the way out" precedent (RESEARCH.md Pattern 2).
- Kept the TDD RED+GREEN combined into a single commit for Task 2, following the exact precedent Plan 08-01's own SUMMARY documented for this repo (Phase 5/6/7 also combine).

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were met on the first implementation pass with no auto-fixes required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 08-03 (`useSharedPreview` composable, `SharedScenarioBanner.vue`, `PicksWorkspace.vue`'s `preview` prop) can proceed independently -- this plan's only surface for Plan 08-03 is `shareTarget`/`shareModalOpen`'s naming convention, which Plan 08-03 does not need to reference directly (it consumes `decodeShareLink` from Plan 08-01, not anything from this plan).
- A share URL generated via this plan's UI has not yet been round-tripped through `decodeShareLink` in a live browser (Plan 08-01's codec tests cover the pure-function round-trip; Plan 08-03 is where the receiving end actually consumes a real generated URL for the first time end-to-end).
- No blockers for Plan 08-03.

---
*Phase: 08-share-links*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: app/components/ScenarioSwitcher.vue
- FOUND: app/components/ShareLinkModal.vue
- FOUND: tests/components/ShareLinkModal.test.ts
- FOUND: tests/helpers/nuxtUiStubs.ts
- FOUND: app/pages/week/[week].vue
- FOUND: .planning/phases/08-share-links/08-02-SUMMARY.md
- FOUND commit: 683c532 (Task 1)
- FOUND commit: 7a03721 (Task 2)
- FOUND commit: 3a81889 (Task 3)
