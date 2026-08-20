---
phase: 08-share-links
plan: 03
subsystem: ui
tags: [vue, nuxt-ui, share-links, url-fragment, preview-state, vitest-component-tests]

# Dependency graph
requires:
  - phase: 08-share-links
    provides: "Plan 08-01's shared/domain/shareLink.ts decodeShareLink codec and DecodeShareLinkResult shape"
  - phase: 08-share-links
    provides: "Plan 08-02's week/[week].vue shareTarget/ShareLinkModal wiring and useScenarios(2026) call site this plan extends"
provides:
  - "app/composables/useSharedPreview.ts -- decodes a #s=<code> URL fragment via decodeShareLink, gated on both the share code and useGames()'s resolved schedule, plain non-useStorage state, decodes at most once per link"
  - "app/components/SharedScenarioBanner.vue -- the three-variant (default/mismatch/malformed) share-link banner from the Copywriting Contract"
  - "app/components/PicksWorkspace.vue's optional preview prop -- a writable computed picks and preview-branch standings/rankings/slateComplete, superseding usePicksStorage/useStandings' output only, with zero new GameCard.vue/StandingsSidebar.vue props"
  - "week/[week].vue's handleSaveCopy/handleDismissSharedPreview -- turns a temporary preview into an ordinary, indistinguishable scenario"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit-source watch([shareCode, games], ..., { immediate: true }) gates a one-time decode on both a synchronously-available URL fragment and an asynchronously-resolving TanStack Query result -- never watchEffect, so the callback's own consumed.value read/write never registers as a dependency of itself"
    - "A preview is a plain, non-useStorage ref threaded through a component via a new optional prop; the component's own writable computed selects between the storage-backed ref and the prop's picks object, so GameCard's existing in-place mutation and every bulk-pick handler work identically against either source with zero new child-component props"

key-files:
  created:
    - app/composables/useSharedPreview.ts
    - app/components/SharedScenarioBanner.vue
    - tests/composables/useSharedPreview.test.ts
    - tests/components/SharedScenarioBanner.test.ts
  modified:
    - app/components/PicksWorkspace.vue
    - app/pages/week/[week].vue
    - tests/helpers/nuxtUiStubs.ts

key-decisions:
  - "PicksWorkspace's real usePicksStorage/useStandings values are renamed storedPicks/storedStandings/storedRankings/storedSlateComplete/storedCommitOrdering -- the plain picks/standings/rankings/slateComplete/commitOrdering names select between those and the preview-branch computeds, so the template's existing GameCard/StandingsSidebar bindings need zero edits"
  - "Committing a NEW manual tiebreaker decision is disabled during an active preview (commitOrdering no-ops when props.preview is set) -- there is no scenario id to attach it to, and no requirement calls for it (RESEARCH.md Assumption A3)"
  - "Bulk fill/clear during a preview never calls markAutoFilled/autoFilled.value.splice -- guarded with if (!props.preview) at all three call sites, so a preview's provenance never leaks into the REAL active scenario's storage (T-08-11)"
  - "handleSaveCopy writes only scenarioKeys.picks/manualTiebreakers -- deliberately no scenarioKeys.autofilled entry, since a saved share-link copy's picks are all treated as user-made, never auto-filled"

patterns-established:
  - "SharedScenarioBanner.vue is the first UAlert usage in this codebase -- tests/helpers/nuxtUiStubs.ts gains a UAlertStub sibling to the existing four stubs"

requirements-completed: [SHARE-02, SHARE-03, SHARE-04]

coverage:
  - id: D1
    description: "Opening a URL containing a valid #s=<code> fragment decodes to a banner and a fully-populated, non-persisted preview -- gated on the schedule being resolved (Pitfall 4), zero localStorage writes"
    requirement: "SHARE-02"
    verification:
      - kind: unit
        ref: "tests/composables/useSharedPreview.test.ts#decodes to \"default\" once games resolves with a matching scheduleHash"
        status: pass
      - kind: unit
        ref: "tests/composables/useSharedPreview.test.ts#never calls localStorage.setItem across every case above (D-07)"
        status: pass
    human_judgment: true
    rationale: "The composable-level decode/zero-write contract is unit-tested (including a stays-\"none\"-while-games-is-undefined cold-cache case and a localStorage.setItem spy across the whole test file), but the full rendered-UI claim -- banner plus populated game grid/standings sidebar in a real browser, a second browser profile's own picks provably untouched in its own localStorage -- is this phase's own <human-check> walkthrough (08-03-PLAN.md, steps 3-4), not performed live during this execution pass. Per this plan's own note, the orchestrator handles that walkthrough separately after this plan completes."
  - id: D2
    description: "A #s=<code> whose scheduleHash doesn't match the current dataset still opens, reporting the exact 'N of M picks applied' count from decodeShareLink's own counts"
    requirement: "SHARE-03"
    verification:
      - kind: unit
        ref: "tests/composables/useSharedPreview.test.ts#decodes to \"mismatch\" when the code was encoded against a different scheduleHash, reflecting decodeShareLink's own counts"
        status: pass
      - kind: unit
        ref: "tests/components/SharedScenarioBanner.test.ts#renders the \"mismatch\" variant's exact N-of-M title, warning color, and a Save a copy action"
        status: pass
    human_judgment: true
    rationale: "Unit-covered at both the composable (counts pass through decodeShareLink unchanged) and banner-copy (exact N-of-M title, warning color) layers. The live confirmation that a deliberately-mismatched code, opened in a real browser, shows the warning banner and still offers a working Save a copy is this plan's own human-check step 8, not performed live in this pass."
  - id: D3
    description: "A malformed or corrupted #s=<code> shows a 'couldn't be read' banner with no partial state applied, and the visitor's own picks remain completely unaffected"
    requirement: "SHARE-04"
    verification:
      - kind: unit
        ref: "tests/composables/useSharedPreview.test.ts#decodes to \"malformed\" for a syntactically invalid code"
        status: pass
      - kind: unit
        ref: "tests/components/SharedScenarioBanner.test.ts#renders the \"malformed\" variant's exact copy, error color, and ZERO action buttons"
        status: pass
    human_judgment: true
    rationale: "Unit-covered: malformed decode yields preview=null/counts=null, and the malformed banner variant renders zero action buttons (nothing valid was decoded to save). The live confirmation against a hand-corrupted real URL, and that the visitor's OWN picks in localStorage are unaffected, is this plan's own human-check steps 9-10, not performed live in this pass."
  - id: D4
    description: "Clicking 'Save a copy' creates a new, ordinary scenario holding exactly the previewed picks/manual decisions, activates it, and dismisses the banner"
    requirement: "SHARE-02"
    verification: []
    human_judgment: true
    rationale: "handleSaveCopy lives in week/[week].vue, a page component with no dedicated unit-test harness in this repo (page-level integration deliberately uncovered, same precedent as Plan 08-02's D4 and the Phase 4/5 UAT record). Verified via grep (writes only scenarioKeys.picks/manualTiebreakers, never scenarioKeys.autofilled) and full-suite green (616/616), but the human-visible save-a-copy -> new scenario appears/activates -> banner dismisses -> original scenario untouched flow is this plan's own human-check step 7, not performed live in this pass."
  - id: D5
    description: "The preview picks grid remains fully interactive -- individual clicks and Fill/Clear Week/Season all work against the preview exactly as against a real scenario, using the same GameCard.vue/bulkPickOperations.ts paths, with zero new GameCard.vue props"
    requirement: "SHARE-02"
    verification:
      - kind: other
        ref: "grep -c preview app/components/GameCard.vue reports 0 (no new prop); PicksWorkspace.vue's <GameCard>/<StandingsSidebar> mounts are textually unchanged from before this task"
        status: pass
    human_judgment: true
    rationale: "PicksWorkspace's writable computed and preview-branch standings pipeline are exercised indirectly by the full 616/616 suite (no regression in any GameCard/bulk-pick/standings test), and the zero-new-props claim is grep-verified structurally. There is no dedicated PicksWorkspace mount test (page-level integration deliberately uncovered, same precedent as Phase 4/5/7). The live click-to-pick and Fill/Clear Week/Season interactivity against an actual preview is this plan's own human-check steps 5-6, not performed live in this pass."

# Metrics
duration: 12min
completed: 2026-08-20
status: complete
---

# Phase 8 Plan 3: Shared Preview Rendering Summary

**`useSharedPreview.ts` decodes a `#s=<code>` URL fragment into a temporary, non-persisted preview state; `SharedScenarioBanner.vue` renders the three-variant banner; `PicksWorkspace.vue` gains an optional `preview` prop that supersedes `usePicksStorage`/`useStandings`'s output with zero new `GameCard.vue`/`StandingsSidebar.vue` props -- closing out Phase 8's entire user-facing share-link surface.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-20T10:45:41Z
- **Completed:** 2026-08-20T10:54:10Z
- **Tasks:** 3
- **Files modified:** 7 (4 new, 3 modified)

## Accomplishments
- `useSharedPreview.ts` decodes a share code via Plan 08-01's `decodeShareLink`, gated on an explicit-source `watch([shareCode, games], ..., { immediate: true })` so a cold hard-refresh (schedule not yet cached) still shows the banner once `useGames()` resolves rather than silently no-oping (Pitfall 4) -- and decodes at most once per link, with `dismiss()` permanently suppressing a later decode so a query refetch can never re-trigger it
- `SharedScenarioBanner.vue` renders the exact Copywriting Contract copy for all three variants (`default`/`mismatch`/`malformed`), offering "Save a copy" everywhere EXCEPT `malformed` (nothing valid was decoded to save) and always offering dismiss
- `PicksWorkspace.vue`'s new optional `preview` prop threads a plain, non-`useStorage` picks/manual-decisions object through a writable computed `picks` that mutates the prop's picks object IN PLACE (mirroring `GameCard.vue`'s own established prop-mutation pattern) -- so `GameCard.vue`'s existing in-place mutation and all four bulk-pick handlers work identically whether previewing or not, with zero new props on either `GameCard.vue` or `StandingsSidebar.vue`
- Preview-branch standings duplicate `useStandings.ts`'s own composition order exactly (`resolveAllConferences` -> `slateCompletionByConference` -> `applyManualOrdering` per conference -> `computeStandings`), reusing the same pure domain functions rather than a second implementation (PROJECT.md DRY)
- Bulk fill/clear during a preview never calls `markAutoFilled`/`autoFilled.value.splice` (guarded `if (!props.preview)` at all three sites) -- T-08-11's mitigation, so a preview's provenance can never leak into the REAL active scenario's storage
- `week/[week].vue` mounts `useSharedPreview`, renders `SharedScenarioBanner` above `PicksWorkspace` whenever a preview is active, and adds `handleSaveCopy` (writes `scenarioKeys.picks`/`scenarioKeys.manualTiebreakers` only, deliberately never `scenarioKeys.autofilled`) and `handleDismissSharedPreview` (clears the `#s=` hash via `router.replace`)
- Full suite: 616/616 tests pass; `pnpm typecheck` and `pnpm lint` both exit 0; `git diff --stat package.json pnpm-lock.yaml` confirms zero dependency changes (T-08-SC)

## Task Commits

Each task was committed atomically:

1. **Task 1: useSharedPreview.ts composable** - `0de00e6` (test, TDD RED+GREEN combined in the create-file commit; 8/8 tests pass)
2. **Task 2: SharedScenarioBanner.vue** - `4a622c9` (test, TDD RED+GREEN combined in the create-file commit; 6/6 tests pass)
3. **Task 3: PicksWorkspace.vue preview wiring + week/[week].vue integration** - `d6f0c1f` (feat)

_Note: Tasks 1/2 are TDD tasks. The RED phase (module-not-found errors, verified via `npx vitest run` against each new test file before its implementation existed) was checked locally before each GREEN implementation but not committed separately -- matches this repo's existing TDD-task commit precedent (Plans 08-01/08-02's own SUMMARYs, and Phases 5/6/7)._

## Files Created/Modified
- `app/composables/useSharedPreview.ts` - New: `useSharedPreview`, `SharedPreviewVariant`, `SharedPreviewState`
- `tests/composables/useSharedPreview.test.ts` - New: 8 behavior cases (no-code/no-schedule, code-before-schedule, default, mismatch, malformed, non-`#s=`-prefixed hash, dismiss-then-no-retrigger, zero-`localStorage.setItem` sweep)
- `app/components/SharedScenarioBanner.vue` - New: three-variant `UAlert` banner, `save-copy`/`dismiss` emits
- `tests/components/SharedScenarioBanner.test.ts` - New: 6 behavior cases (default/mismatch/malformed copy+color+actions, dismiss-per-variant sweep)
- `tests/helpers/nuxtUiStubs.ts` - Modified: added `UAlertStub`, added to `nuxtUiTestStubs`, docblock updated
- `app/components/PicksWorkspace.vue` - Modified: optional `preview` prop, `stored`-prefixed real composable values, preview-branch standings computeds, writable computed `picks`, guarded `commitOrdering`/bulk-fill provenance
- `app/pages/week/[week].vue` - Modified: `useSharedPreview` mount, `SharedScenarioBanner` template wiring, `handleSaveCopy`/`handleDismissSharedPreview`, `:preview="sharedPreview"` on the `PicksWorkspace` mount

## Decisions Made
- Followed the plan's literal writable-computed `picks` design verbatim: `get()` selects `props.preview.picks` vs. `storedPicks.value`; `set()` mutates `props.preview.picks` in place (delete-loop then `Object.assign`) rather than reassigning the prop, using the identical `eslint-disable-next-line vue/no-mutating-props`/`@typescript-eslint/no-dynamic-delete` comment precedent `GameCard.vue` already established for this exact category of prop mutation.
- Kept the TDD RED+GREEN combined into a single commit for Tasks 1/2, following the exact precedent Plans 08-01/08-02's own SUMMARYs documented for this repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 9 pre-existing quote-style lint violations surfaced by this task's full `pnpm lint` run**
- **Found during:** Task 3 (`pnpm lint` verification step)
- **Issue:** `SharedScenarioBanner.vue`, its test, and `nuxtUiStubs.ts` (all written in Task 2) used double-quoted strings in three spots where this repo's ESLint config (`@stylistic/quotes`, `@stylistic/quote-props`) requires single quotes / consistent-quoting for object property keys -- not caught by Task 2's narrow `npx vitest run tests/components/SharedScenarioBanner.test.ts` verify command, only by Task 3's full-suite `pnpm lint` gate.
- **Fix:** `npx eslint --fix` on the three affected files -- pure formatting, zero behavior change (all 3 files' test suites re-verified green after the fix).
- **Files modified:** `app/components/SharedScenarioBanner.vue`, `tests/components/SharedScenarioBanner.test.ts`, `tests/helpers/nuxtUiStubs.ts`
- **Verification:** `pnpm lint` exits 0; `npx vitest run tests/components/SharedScenarioBanner.test.ts` re-confirms 6/6 pass after the fix
- **Committed in:** `d6f0c1f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, lint-only formatting)
**Impact on plan:** No scope creep -- a pure formatting fix required for the plan's own `pnpm lint` acceptance criterion to pass.

## Issues Encountered

None beyond the lint fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 (Share Links)'s entire automated/structural surface is now complete: `pnpm test` (616/616), `pnpm typecheck`, and `pnpm lint` all exit 0 across all three plans' combined changes, and `package.json`/`pnpm-lock.yaml` are unchanged across the whole phase (zero new dependencies).
- **This plan's own `<human-check>` block (08-03-PLAN.md) was NOT walked live in a browser during this execution pass.** It is an 11-step, two-browser-profile walkthrough covering SHARE-01 through SHARE-04 end-to-end: generating a link, opening it in a second profile, confirming zero `localStorage` writes via devtools while previewing, editing the preview grid, Fill Week/Season against the preview, Save a copy, the mismatch banner (via a deliberately-wrong `scheduleHash`), the malformed banner (via a hand-corrupted fragment), dismiss, and a zero-network-request confirmation. Per this plan's own prompt context, the orchestrator handles this walkthrough separately after this plan completes -- consistent with the `human_needed`/`overridden` disposition already on record for Phases 4/5/6 in STATE.md's Blockers/Concerns section.
- No blockers for the phase-level verification step. `08-03-PLAN.md`'s success criteria (ROADMAP Phase 8 criteria 1-4, SHARE-01 through SHARE-04) are all structurally implemented and unit/component-tested; only the live walkthrough remains outstanding.

---
*Phase: 08-share-links*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: app/composables/useSharedPreview.ts
- FOUND: app/components/SharedScenarioBanner.vue
- FOUND: tests/composables/useSharedPreview.test.ts
- FOUND: tests/components/SharedScenarioBanner.test.ts
- FOUND: app/components/PicksWorkspace.vue
- FOUND: app/pages/week/[week].vue
- FOUND: .planning/phases/08-share-links/08-03-SUMMARY.md
- FOUND commit: 0de00e6 (Task 1)
- FOUND commit: 4a622c9 (Task 2)
- FOUND commit: d6f0c1f (Task 3)
- FOUND commit: e119c65 (plan metadata)
