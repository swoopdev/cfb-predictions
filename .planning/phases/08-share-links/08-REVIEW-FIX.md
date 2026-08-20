---
phase: 08-share-links
fixed_at: 2026-08-20T21:35:00Z
review_path: .planning/phases/08-share-links/08-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-08-20T21:35:00Z
**Source review:** .planning/phases/08-share-links/08-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 6 (`critical_warning` scope -- WR-01 through WR-06; the review found 0 critical findings this iteration. IN-01/IN-02 excluded as info-tier.)
- Fixed: 5
- Skipped: 1

## Fixed Issues

### WR-01: Share click silently swallows any error that isn't `ShareLinkTooLargeError`

**Files modified:** `app/pages/week/[week].vue`
**Commit:** `cc3cd9f`
**Applied fix:** Added an `else` branch to `handleShare`'s `catch` block that `console.error`s any exception that is not `ShareLinkTooLargeError`, including the offending scenario name and the error object, before returning without opening the Share modal. The existing `ShareLinkTooLargeError` branch (`console.warn`) is unchanged. This closes the "Share button silently no-ops with zero log trail" gap the review identified, while still not surfacing a user-facing toast -- consistent with this codebase's existing no-user-facing-banner disposition for this class of tail-case failure (`usePicksStorage.ts`'s corruption path, and this same file's own iteration-1 `ShareLinkTooLargeError` handling).

### WR-02: `useManualTiebreakers.commitOrdering` has no write-side cap, but the read-side cap drops the whole conference

**Files modified:** `app/composables/useManualTiebreakers.ts`, `shared/domain/tiebreakers/invalidation.ts`, `tests/composables/useManualTiebreakers.test.ts`
**Commit:** `f56caa3`
**Applied fix:** Took the review's first fix option: enforced `MAX_ENTRIES_PER_CONFERENCE` at write time in `commitOrdering`, mirroring the read-side cap exactly rather than widening the read-side recovery. Exported `MAX_ENTRIES_PER_CONFERENCE` from `invalidation.ts` (previously module-private) so `useManualTiebreakers.ts` can import and enforce the same number. `commitOrdering` now distinguishes "overwriting an already-stored hash" (never grows the entry count, no eviction needed) from "adding a genuinely new hash" (evicts the oldest entry -- the first-inserted key by object enumeration order -- only when the new entry would push the count past the cap). This keeps the in-memory/stored shape from ever legitimately drifting past what `validateConferenceDecisions` accepts on the next read, closing the "drops the whole conference silently" data-loss path for a power user's own legitimately-accumulated decisions. Added two new tests: one proving eviction happens and keeps the count at the cap when a new hash is committed at the boundary, one proving an overwrite of an already-stored hash never evicts anything even sitting exactly at the cap.

### WR-03: Standings/tiebreaker pipeline composition order is duplicated between `useStandings.ts` and `PicksWorkspace.vue`

**Files modified:** `shared/domain/standings/pipeline.ts` (new), `shared/domain/standings/index.ts`, `app/composables/useStandings.ts`, `app/components/PicksWorkspace.vue`, `tests/domain/standings/pipeline.test.ts` (new)
**Commit:** `0f0523f`
**Applied fix:** Extracted the shared composition order (resolve -> slate-completion -> apply-manual-ordering-per-conference -> compute-standings) into a new pure function `computeStandingsPipeline(games, teams, picks, manualDecisions)` in `shared/domain/standings/pipeline.ts`, exported from the domain's public barrel (`shared/domain/standings/index.ts`) alongside the existing exports. `useStandings.ts`'s `rankings`/`standings`/`slateComplete` computeds and `PicksWorkspace.vue`'s preview-branch computeds (`previewRankingsWithManual`/`previewStandings`/`previewSlateComplete`) both now call this one function instead of hand-composing the four steps independently -- a future pipeline change (e.g. a new stage) can no longer leave one branch behind. `pruneStale`'s storage side effect deliberately stays out of the extracted function and composable-only in `useStandings.ts` (it is a `useManualTiebreakers.ts`-backed write, not a pure derivation, and does not apply to a preview, which has no scenario id to prune against) -- `useStandings.ts` still computes `rawRankings` separately via `resolveAllConferences` for that watch's own use, exactly as before. Added `tests/domain/standings/pipeline.test.ts`: a parity regression suite proving `computeStandingsPipeline`'s output is identical to the pre-extraction hand-composed four-step chain across 50 generated seasons (25 fully-picked, 25 partially-picked) plus a manual-decisions-payload-threading check, so the extraction is proven behavior-preserving rather than merely code-reading-reviewed.
**Verification note:** This refactor touches the core standings/tiebreaker composition path -- CLAUDE.md's own words: "If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters." The isolated fixer worktree used for this run deliberately excludes `node_modules` (see the "environment constraints" note below), so `vue-tsc --noEmit` and `vitest run` could not be executed as part of this fix. The change was verified by careful re-reading (Tier 1) and is, by construction, a mechanical extract-method refactor (identical function calls, identical order, identical parameters) plus a new parity test suite designed to catch any behavioral drift once run. **Recommend running `pnpm test` and `npx vue-tsc --noEmit` before merging** to confirm the parity suite and full suite both pass. Marking this fix `fixed: requires human verification` per that residual risk.

### WR-04: `commitOrdering` silently no-ops during an active preview with no user-facing feedback

**Files modified:** `app/components/TiebreakerReasoning.vue`, `app/components/StandingsTable.vue`, `app/components/StandingsSidebar.vue`, `app/components/PicksWorkspace.vue`, `tests/components/TiebreakerReasoning.test.ts`, `tests/components/StandingsSidebar.test.ts`
**Commit:** `51e6983`
**Applied fix:** Took the review's first fix option: threaded a new `previewActive` boolean prop (default `false`) straight through `StandingsSidebar` -> `StandingsTable` -> `TiebreakerReasoning`, the same pattern already used for `slateComplete`/`commitOrdering`. `PicksWorkspace.vue` passes `:preview-active="Boolean(props.preview)"` to `StandingsSidebar`. In `TiebreakerReasoning.vue`, when the ordering gate would otherwise be open (`showOrderingControl`) AND `previewActive` is true, the interactive click-to-rank terminus is replaced entirely with an explanatory message ("Save a copy of this scenario to set manual tiebreakers.") instead of letting the interaction start and then silently no-op on commit. Added dedicated `previewActive` test coverage in `TiebreakerReasoning.test.ts` (message shown / terminus hidden / no buttons rendered when active; unchanged default behavior when the prop is omitted; still absent when the ordering gate itself is closed) and an end-to-end threading test in `StandingsSidebar.test.ts` proving the prop reaches `TiebreakerReasoning` through both intermediate components and that `commitOrdering` is never invoked while previewing.

### WR-06: Duplicated `SharedPreviewState`/preview-object shape between the composable and its consumer

**Files modified:** `app/components/PicksWorkspace.vue`
**Commit:** `aa41779`
**Applied fix:** Replaced `PicksWorkspace.vue`'s inline re-declaration of the preview prop's shape (`{ picks: Record<number, number>, manualDecisions: ConferenceDecisions }`) with `import type { SharedPreviewState } from '~/composables/useSharedPreview'` and `preview?: SharedPreviewState | null`. A future field added to `SharedPreviewState` now widens `PicksWorkspace`'s prop type automatically instead of silently failing to, closing the second-source-of-truth gap the review identified. The now-unused `ConferenceDecisions` type import was removed from this file (it was only referenced by the inline shape being replaced).

## Skipped Issues

### WR-05: No component-level test for `PicksWorkspace.vue`'s preview branching

**File:** `app/components/PicksWorkspace.vue` (no corresponding `tests/components/PicksWorkspace.test.ts`)
**Reason:** `PicksWorkspace.vue` calls three Nuxt-auto-imported composables (`usePicksStorage`, `useAutoFilledGames`, `useStandings`) and uses `computed` itself without any explicit `import ... from 'vue'` -- exactly the Nuxt directory-structure auto-import convention this codebase uses consistently for "smart" components, and it also renders several Nuxt-auto-imported UI/child components (`UButton`, `USkeleton`, `GameCard`, `ConferenceFilter`, `TeamFilter`, `PickProgress`, `PickProgressWeek`, `WeekNav`, `StandingsSidebar`) without local imports. This project's `vitest.config.ts` registers only plain `@vitejs/plugin-vue` -- no Nuxt Vite builder, no auto-import unplugin -- so none of those bare identifiers resolve at test-mount time; `mount(PicksWorkspace, ...)` would throw a `ReferenceError` before ever exercising the preview branching this finding wants covered. This is not a supposition: it is documented in-repo at two places already reviewed by `gsd-code-reviewer` in this same phase --
1. `tests/components/GameCard.test.ts`'s own header note: "Full component mounting tests require Nuxt's test environment setup... E2E testing through the week page will verify full interaction flow" (GameCard.vue has the identical bare-auto-import shape).
2. `tests/helpers/nuxtUiStubs.ts`'s docblock: "there is no in-repo precedent for mounting any Nuxt UI component this way (GameCard.vue/WeekNav.vue's own UButton/UIcon usage is never exercised via `mount()`, only through the live dev server)."

Closing this gap properly requires one of two changes that are each larger than an automated fix belongs making unreviewed: (a) refactor `PicksWorkspace.vue` to explicitly import its composables and child components (a source-convention change affecting how every "smart" component in this codebase is written, not scoped to this finding), or (b) add a Nuxt-aware vitest project (`@nuxt/test-utils`'s `defineVitestProject`, as CLAUDE.md's own tech-stack notes originally scoped for "the (few) component tests") to this project's test configuration. Given the fixer's isolated worktree also deliberately excludes `node_modules` this run (see below), there is no way to author and verify a speculative stub-heavy test file here without risking committing a test that fails for purely environmental reasons rather than a real regression. Left for manual follow-up -- flagged as non-blocking by the reviewer originally.

## Environment Constraints (this run)

Per project memory (`gsd-worktree-node-modules-incident`), a prior `/gsd-code-review --fix` run on this Windows repo used PowerShell-created NTFS junctions to link a fixer worktree's `node_modules`/`.nuxt` back to the main checkout for `tsc`/`vitest` resolution; tearing down that worktree (`git worktree remove --force`) wiped out the *main checkout's* `node_modules/.bin`. To avoid repeating that, this run's isolated worktree was created with a plain `git worktree add` and **no junctions or symlinks into `node_modules`** -- the worktree therefore has no `node_modules` at all, and Tier 2 syntax/type checks (`npx tsc --noEmit`, `npx vitest run`) could not be run from inside it. Every fix below was verified via Tier 1 (careful re-read of the modified sections, confirming the fix text is present and surrounding code is intact) per the fixer's documented Tier 3 fallback ("If no syntax checker is available... accept Tier 1 result... do NOT skip the fix"). **Recommend running `pnpm test` and `npx vue-tsc --noEmit` from the main checkout before this branch is considered verified**, particularly for WR-03 (the standings pipeline extraction) and WR-04 (the multi-component prop-threading change), which are the two fixes with the largest verification surface this run.

---

_Fixed: 2026-08-20T21:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
