---
phase: 06-tiebreaker-ui-championships
verified: 2026-08-19T13:30:00Z
status: human_needed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Marker contrast (D-11): marker (a)'s square chip and marker (b)'s round pill against their surfaces, in both light and dark theme, at real rendered size (12-14px)."
    expected: "WCAG AA (4.5:1) holds for all four combinations. Nuxt UI injects its neutral color ramp at runtime, so this cannot be statically audited (Phase 5 tried and produced a bogus figure)."
    why_human: "No static tool can resolve Nuxt UI's runtime CSS custom properties; requires a live pnpm dev render and a contrast checker."
  - test: "Full-flow walkthrough: pick a full ACC conference slate; expand a contested rank and confirm the decisive step reads first with the full procedure (incl. every restart line) one toggle away; confirm the D-17 ordering control appears only once the ACC slate is complete; order a tied group entirely by keyboard (Tab/Enter) and confirm focus never lands on <body>; confirm pills become square chips immediately on commit with no reload; clear one ACC pick and confirm the group silently reverts with no toast/banner/badge; re-pick the same winner and confirm the ordering silently returns."
    expected: "Every step matches 06-UI-SPEC.md §7-§9 and §12.3 exactly; no announcement anywhere in the suspend/restore sequence."
    why_human: "Multi-step interactive keyboard flow and 'nothing appeared' negative assertions are not practical to fully exercise via static analysis; explicitly deferred by 06-06-PLAN.md and 06-07-PLAN.md's own <human-check> blocks and never exercised in any executor session per 06-07-SUMMARY.md."
  - test: "Mid-season read: with a partly-picked season, confirm the ACC's many shared ranks read as intentional (no badge, count, warning color, or alert) and that no copy anywhere describes the state as unfinished."
    expected: "Matches 06-UI-SPEC.md §11's no-nagging rules."
    why_human: "Visual/tone judgment call across the whole standings panel; explicitly deferred to UAT per 06-07-PLAN.md's <human-check> block."
  - test: "CR-01 fix (engine.ts's per-team trace composition): open the 'Decided at' panel for a genuinely multi-restart Big 12/SEC/Big Ten tie in a real rendered UI and confirm the decisive step's team values are the group's own team, not a later-resolved team's."
    expected: "The reasoning shown always names the team the rank is actually for."
    why_human: "The fixer's own fix report (06-REVIEW-FIX.md) explicitly flags this as 'fixed: requires human verification' despite a 200-generated-season regression test (added to n-seed-ranking.test.ts) that fails pre-fix and passes post-fix, plus a full 525-test suite green -- because this is a logic-correctness fix to PROJECT.md's highest-risk area (the tiebreaker engine) and the fixer's stated policy is not to claim full confidence on that class of fix from automated evidence alone."
  - test: "CR-02 fix (TiebreakerReasoning.vue's group-membership watcher): in a real browser, cause a tied group's membership to change while its reasoning row stays mounted at the same table position (the unkeyed-by-membership v-for scenario the review reproduced), and confirm the ordering control's local state resets rather than showing a stale assignment."
    expected: "No stale team names in the 'ranked' list after the underlying group changes; no silent dead end on the final click."
    why_human: "Same fixer policy as CR-01: a component test reproduces and passes/fails correctly (33/33 in TiebreakerReasoning.test.ts) but the fix touches interactive UI state and is flagged 'requires human verification' rather than claimed fully confident from the test alone."
  - test: "§12.3 touch-target trade: the D-17 ordering control's unassigned-team buttons are ~26px tall (below the 44px guideline) because a 44px row would break the standings table's rhythm. Confirm this is acceptable as shipped, or route to a follow-up plan."
    expected: "A recorded accept/reject decision, not a code change by itself."
    why_human: "This is an accessibility trade explicitly recorded by 06-06-SUMMARY.md and carried forward by 06-07-SUMMARY.md as 'the one accessibility trade in the phase' awaiting a UAT sign-off decision."
  - test: "Quick task 260819-hm8's lightened marker (b) treatment (bg-muted/text-toned/ring vs. marker (a)'s bg-accented): confirm it still reads as sufficiently visually distinct from marker (a) in both themes now that the row-level band/border was removed."
    expected: "The rank number plus the shape/fill difference between the two markers is enough to convey the tie without the removed row band/border."
    why_human: "The quick task's own SUMMARY.md marks this exact judgment (D2) as human_judgment: true, unresolved by automated class-presence assertions alone."
---

# Phase 6: Tiebreaker UI & Championships Verification Report

**Phase Goal:** Users can see exactly how each conference's championship matchup was determined, see a fully ranked 1..N conference table wherever the tiebreaker procedure can determine an order, and resolve any tie the engine can't settle on its own.
**Verified:** 2026-08-19T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## MVP-mode goal-format note (not a blocker, surfaced per verifier protocol)

This phase's ROADMAP entry declares `Mode: mvp`, and the MVP-mode verification protocol requires the phase `Goal:` to be a canonical User Story (`As a … I want to … so that ….`). Running the canonical validator against the literal ROADMAP goal text confirms it is **not** in that form (`valid: false`):

> "Users can see exactly how each conference's championship matchup was determined, see a fully ranked 1..N conference table wherever the tiebreaker procedure can determine an order, and resolve any tie the engine can't settle on its own."

This was a **known, documented planning-time decision**, not an oversight: 06-01-PLAN.md's frontmatter states verbatim, *"the ROADMAP `**Goal:**` line for Phase 6 is outcome-shaped but not in the `As a … I want to … so that …` user-story form MVP mode expects. It is reproduced verbatim above rather than rewritten, per the 'do not invent a story' rule."* Given this is a deliberate, already-surfaced deviation carried through all seven plans, and given ROADMAP.md supplies six well-formed, independently testable Success Criteria that serve the same verification purpose a User-Flow-Coverage table would, I proceeded with standard must-have-based goal-backward verification (below) rather than halting the whole verification pass on a goal-format technicality. If a canonical User Story is wanted for future phases, `/gsd mvp-phase 6` can retrofit one, but that is a documentation clean-up, not a code gap.

## Goal Achievement

### Observable Truths

Truths below are the six ROADMAP Success Criteria (the authoritative contract for this phase), cross-checked against every PLAN's `must_haves.truths` across all seven plans.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each conference's resolved (or pending) championship matchup is displayed as a dedicated, prominent element above that conference's standings table | ✓ VERIFIED | `app/components/ChampionshipCard.vue` reads exclusively via `championshipFor(ranking)` (D-12); mounted inside `StandingsTable.vue`'s `<section>` between the `<h3>` and `<table>` (`app/components/StandingsTable.vue:238-243`). `tests/components/ChampionshipCard.test.ts` (11 cases) and `StandingsTable.test.ts`'s threading block pass. `ChampionshipCard.vue` never imports `TerminalReason` — D-14's one-presentation rule is structurally enforced, not conventional. |
| 2 | User can see the step-by-step reasoning behind a resolved tiebreaker — tied group, step applied, each team's value, and restart events | ✓ VERIFIED | `app/components/TiebreakerReasoning.vue` renders the decisive step first (`trace.at(-1)`'s last separating step), a "Show full procedure" toggle revealing every cycle, and restart lines naming removed teams/reason/step, never collapsed. `tests/components/TiebreakerReasoning.test.ts` (33 cases) pass. **CR-01** (a real correctness bug where a resolved rank's `trace` could belong to a different, later-resolved team) was found by code review and fixed in `shared/domain/tiebreakers/engine.ts` (commit `956178d`) so every `'resolved'` return composes its own trace locally rather than reading a shared accumulator positionally. Verified directly: `tests/domain/tiebreakers/n-seed-ranking.test.ts`'s CR-01 regression assertion (every `'tiebreaker'` group's decisive-step values reference `group.teams[0]`) passes across 200 generated seasons and was confirmed to fail pre-fix (300+ violations via `git stash` isolation, per 06-REVIEW-FIX.md). See human-check items — the fixer itself asked for a human look at a real rendered panel before full confidence. |
| 3 | When a tie can't be auto-resolved, the user's selection stays valid while the group is unchanged and is clearly invalidated (not silently misapplied) if it changes | ✓ VERIFIED | Two independent gates implemented exactly as specced: gate 1 (`slateComplete[conference]`, `shared/domain/standings/slateCompletion.ts`) and gate 2 (`decisionHash` + exact set-equality, `shared/domain/tiebreakers/invalidation.ts`'s `applyManualOrdering`), wired in `app/composables/useStandings.ts` between `resolveAllConferences` and `computeStandings`. `pruneStale` deletes only on a complete-slate mismatch, never during suspension (`useManualTiebreakers.ts:183-210`). `tests/composables/useStandings.test.ts` implements 06-UI-SPEC.md §9.3's four-part silent-restoration criterion and §9.4's suspended-vs-continuous equivalence as dedicated tests, both passing. **CR-02** (D-17 local ordering state not reset on a group-membership change under Vue's unkeyed `v-for` reuse) was found and fixed with a `watch(() => props.group.teams, ...)` (commit `0aa4c56`); its regression test (stale-assignment reproduction) fails pre-fix, passes post-fix. See human-check items. |
| 4 | Conference standings show distinct ranks 1..N wherever the tiebreaker procedure can determine an order | ✓ VERIFIED | `shared/domain/standings/computeStandings.ts` assembles rows by walking `ConferenceRanking.groups` and concatenating — the Phase 5 union-find (`recordKey`/`rankComponents`/etc.) is deleted (`grep` confirms none remain). `tests/domain/standings/computeStandings.test.ts`'s D-01 block and `standings-tiebreaker-agreement.test.ts`'s rank/group-membership-agreement invariant both pass across 200 generated seasons. |
| 5 | Teams that remain genuinely unresolvable share a rank and are marked as tied, prompted only once that conference's slate is fully picked | ✓ VERIFIED | Marker (b) (`group.teams.length > 1`) renders the shared-rank pill in `StandingsTable.vue`; the D-17 ordering control in `TiebreakerReasoning.vue` is gated on `group.teams.length > 1 && slateComplete` — absent from the DOM with either false. `tests/components/TiebreakerReasoning.test.ts`'s "ordering gate" block and `StandingsTable.test.ts`'s D-10/D-11 block both assert this. |
| 6 | Teams separated only by a tiebreaker are visually distinguishable from teams separated by record, so a rank gap is never mistaken for a record gap | ✓ VERIFIED | Marker state is derived exclusively from `RankGroup` (`markerKindFor`, `StandingsTable.vue:92-97`) — no comparison of two rows' `confRecord` anywhere in the file (grep-confirmed). Both markers use semantic Nuxt UI tokens only (no team color, no `:style`, no bare palette class), enforced by a markup-level grep assertion in `StandingsTable.test.ts`. Quick task 260819-hm8 (commits `ac0500e`/`a08595c`, applied *after* the phase's own code review) lightened marker (b) to `bg-muted/text-toned/ring-default` and removed the row-level band/border per direct user feedback — confirmed this does **not** conflict with D-11: marker (a) (`rounded`, `bg-accented`) and marker (b) (`rounded-full`, `bg-muted`+`ring`) remain shape- and fill-distinct from each other, and both remain neutral-palette-only. Real-size WCAG AA contrast in both themes is a human-check item (below) — it always was, since Phase 5, because Nuxt UI injects its color ramp at runtime and cannot be statically audited. |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/domain/tiebreakers/engine.ts` (`resolveConferenceRanking`, `championshipFor`) | N-seed ranking loop, championship-seed reader | ✓ VERIFIED | Present, exported, consumed by `resolveTiebreakers.ts`, `ChampionshipCard.vue`. CR-01 fix confirmed present in source. |
| `shared/domain/tiebreakers/types.ts` (`RankGroup`, `ConferenceRanking`, `RankGroupResolution`) | Target type shapes from Plan 02 | ✓ VERIFIED | Field names match the plan's binding contract exactly (`teams`, `resolvedBy`, `contestedWith`, `trace`, `terminalReason`, `manualOrdering`). |
| `shared/domain/standings/computeStandings.ts` | Ranks from engine partition, union-find deleted | ✓ VERIFIED | `grep -rn "recordKey\|rankComponents\|resolvedSeedGroups\|seedPlacements" shared app tests` returns no matches. |
| `shared/domain/standings/slateCompletion.ts` | D-07 per-conference completion predicate | ✓ VERIFIED | Exports `isConferenceSlateComplete`, `slateCompletionByConference`; calls `conferenceGamesFor`, never compares team conference fields. |
| `shared/domain/tiebreakers/invalidation.ts` | D-08 synchronous hash + `applyManualOrdering` | ✓ VERIFIED | `decisionHash` returns `string`; file contains no `async`/`await`/`Promise` (grep-confirmed). |
| `app/composables/useStandings.ts` | Single seam: picks/rankings/standings/slateComplete/commitOrdering | ✓ VERIFIED | Manual application sits between `resolveAllConferences` and `computeStandings`; pruning via explicit-source `watch` (WR-03 fix), never `watchEffect`. |
| `app/composables/useManualTiebreakers.ts` | Storage, two gates, delete-on-read, untrusted-input validation | ✓ VERIFIED | Caps (32 entries/conference, 20 ids/entry), set-equality checks at write and read, silent-reset-on-parse-failure (no secondary corruption key, a deliberate departure from `usePicksStorage`). |
| `app/components/ChampionshipCard.vue` | TIE-07 dedicated matchup element | ✓ VERIFIED | Dumb/presentational, `championshipFor`-only, D-14 structurally enforced. |
| `app/components/TiebreakerReasoning.vue` | TIE-05 reasoning panel + D-17 ordering terminus | ✓ VERIFIED | `<div>` root (not `<tr>`), `<dl>` for value pairs (no nested `<table>`), full §12.3 focus-management contract implemented. |
| `app/components/StandingsTable.vue` | Three-state rank cell (D-10/D-11), reasoning row mount | ✓ VERIFIED | `markerKindFor` derives state purely from `RankGroup`; reasoning `<tr>` absent from DOM when collapsed. |
| `tests/domain/tiebreakers/coverage-gaps.test.ts` | Closes pre-Phase-5 coverage debt | ✓ VERIFIED | `shared/domain/tiebreakers/**` at 96.89%/92.05%/98.82%/97.36% (stmts/branch/funcs/lines) against a 90% threshold on all four; `shared/domain/standings/**` clears its 85% threshold too. No exclusion added, no threshold lowered (`vitest.config.ts` thresholds block confirmed unchanged). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ChampionshipCard.vue` | `championshipFor(ranking)` | direct call, no manual `groups` indexing | ✓ WIRED | Confirmed by source read: `const seeds = computed(() => (props.ranking ? championshipFor(props.ranking) : {}))`. |
| `StandingsTable.vue` rank cell | `RankGroup` (via `ranking` prop) | `markerKindFor(group)` | ✓ WIRED | No adjacent-row `confRecord` comparison exists anywhere in the file (grep-confirmed). |
| `useStandings.ts` `rankings` | `applyManualOrdering` | called per-conference, between `resolveAllConferences` and `computeStandings` | ✓ WIRED | Order confirmed correct by source read (`rankings` computed at `useStandings.ts:120-132`, consumed by `standings` computed immediately after). |
| `useStandings.ts` pruning | `useManualTiebreakers.pruneStale` | explicit-source `watch([rawRankings, slateComplete], ...)` | ✓ WIRED | WR-03 fix confirmed present (commit `45ceb33`); reads `rawRankings`, never the manually-adjusted `rankings`, matching the docblock's stated reasoning. |
| `TiebreakerReasoning.vue` commit event | `useManualTiebreakers.commitOrdering` | re-emitted through `StandingsTable.vue`'s `handleReasoningCommit` | ✓ WIRED | Set-equality re-checked at `commitOrdering` before persisting (belt-and-suspenders with `applyManualOrdering`'s own check). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TIE-05 | Plan 06 | Step-by-step reasoning display | ✓ SATISFIED | `TiebreakerReasoning.vue` + tests; CR-01 fix confirmed present. |
| TIE-06 | Plans 05, 06, 07 | Manual selection validity/invalidation lifecycle | ✓ SATISFIED | Two-gate predicate wired end-to-end; CR-02 fix confirmed present. |
| TIE-07 | Plan 04 | Championship matchup dedicated element | ✓ SATISFIED | `ChampionshipCard.vue` mounted above every conference table. |
| TIE-08 | Plans 01, 02, 03, 07 | 1..N iterative ranking with shared-rank surfacing | ✓ SATISFIED | `resolveConferenceRanking` + `computeStandings`'s constructive assembly. |

**Note (documentation-sync gap, not a code gap):** `.planning/REQUIREMENTS.md`'s checkboxes for TIE-05/TIE-06/TIE-07 are still unchecked (`[ ]`) and its traceability table still marks them "Pending," even though TIE-08 (added the same day) is marked "Complete." This is a stale tracking artifact that should be updated (likely at ship/milestone-completion time), not evidence the requirements are unmet — the code and test evidence above stands independently of this doc.

**Orphaned requirements:** none. `grep -n "Phase 6" .planning/REQUIREMENTS.md` shows exactly TIE-05/06/07/08, all four claimed by at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

None. `grep -rn -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across every production file touched by this phase (`ChampionshipCard.vue`, `TiebreakerReasoning.vue`, `StandingsTable.vue`, `useStandings.ts`, `useManualTiebreakers.ts`, `engine.ts`, `invalidation.ts`, `computeStandings.ts`, `slateCompletion.ts`) returns no matches.

One pre-existing Info-severity item from 06-REVIEW.md was left unfixed by design (IN-03: `decisionsFor(conference)` allocates a throwaway `ComputedRef` per conference per recompute inside `useStandings.ts`'s `rankings` computed) — a minor performance note, not a correctness issue, and the review fix report explicitly scoped its fix pass to the 2 Critical + 3 Warning findings only.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `pnpm test` | 525/525 passed, 44 files | ✓ PASS |
| Lint clean | `pnpm lint` | exit 0 | ✓ PASS |
| Typecheck clean | `pnpm typecheck` | exit 0 | ✓ PASS |
| Coverage gate | `pnpm exec vitest run --coverage` | `shared/domain/tiebreakers/**` 96.89/92.05/98.82/97.36 vs 90% threshold; `shared/domain/standings/**` clears its 85% threshold | ✓ PASS |
| CR-01 regression (single named test) | `pnpm exec vitest run tests/domain/tiebreakers/n-seed-ranking.test.ts` | 6/6 passed, including the CR-01 decisive-step-references-own-team assertion across 200 generated seasons | ✓ PASS |
| Targeted component/composable suite | `pnpm exec vitest run tests/components/ChampionshipCard.test.ts tests/components/TiebreakerReasoning.test.ts tests/components/StandingsTable.test.ts tests/composables/useStandings.test.ts tests/composables/useManualTiebreakers.test.ts tests/domain/tiebreakers/invalidation.test.ts tests/domain/standings/slateCompletion.test.ts` | 114/114 passed | ✓ PASS |
| No package/threshold drift | `git diff --stat package.json pnpm-lock.yaml vitest.config.ts` (against phase start) | Every plan's own SUMMARY confirms empty; `vitest.config.ts` thresholds block inspected directly and matches the 90%/85% figures every plan committed to | ✓ PASS |

### Human Verification Required

See the `human_verification` list in this document's frontmatter for the full structured list (7 items). Summary:

1. **Marker contrast (D-11)** — 4 checks (marker a/b × light/dark theme), WCAG AA, cannot be statically audited against Nuxt UI's runtime color ramp.
2. **Full-flow walkthrough** — pick a full ACC slate, keyboard-only ordering, silent suspend/restore, immediate marker transition on commit. Never exercised in any executor session per 06-07-SUMMARY.md's own "Human-Check: Deferred to UAT" section.
3. **Mid-season read** — confirm no nagging/unfinished-state copy anywhere in the standings panel.
4. **CR-01 fix, live confirmation** — the fixer's own report explicitly requests a human look at a real rendered "Decided at" panel for a genuinely multi-restart scenario, despite strong automated (property-test) evidence.
5. **CR-02 fix, live confirmation** — same fixer policy, for the D-17 stale-state reset fix.
6. **§12.3 touch-target trade** — an explicit accept/reject decision on the 26px (vs. 44px guideline) ordering-control buttons, carried forward from Plan 06 through Plan 07's SUMMARY as still open.
7. **Quick task's lightened marker (b)** — the quick task's own SUMMARY.md flags this exact visual-distinctness judgment as `human_judgment: true`, unresolved by its own class-presence assertions.

None of these are new gaps this verification pass discovered — every one of them was already flagged as open by the phase's own plans, summaries, code review, or fixer report. This verification pass adds no new human-check items; it consolidates and confirms the existing ones are still open (none were resolved between the last SUMMARY and this verification).

### Gaps Summary

No BLOCKER-level gaps. All six ROADMAP Success Criteria are observably true in the codebase, backed by passing automated tests (525/525), a clean lint/typecheck, a passing coverage gate, and two correctness bugs (CR-01, CR-02) found by code review and fixed with verified-failing-then-passing regression tests. The phase cannot be marked `passed` only because a substantial, well-documented list of human-check items (contrast verification, live interactive walkthroughs, and two fixer-requested manual confirmations on the phase's two most safety-critical fixes) remain open and were never exercised in any automated session — this is the correct and expected state for a UI-heavy phase whose color system cannot be statically audited, not a sign of incomplete work.

---

_Verified: 2026-08-19T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
