---
phase: 06-tiebreaker-ui-championships
plan: 06
subsystem: ui
tags: [vue, tiebreakers, accessibility, standings, reasoning]

requires:
  - phase: 06-tiebreaker-ui-championships
    provides: "Plan 02 -- RankGroup/ConferenceRanking types, resolveConferenceRanking's per-group trace isolation, championshipFor"
provides:
  - "TiebreakerReasoning.vue: self-contained props-in/events-out reasoning panel covering TIE-05's full display contract and D-17's ordering terminus"
  - "Decisive-step-first display (D-16): the last separating StepOutcome of a group's own last cycle leads, with full procedure (all cycles, all restart events) one toggle away"
  - "Model B ordering interaction: sequential team-by-team assignment that commits once, with the full §12.3 focus-management contract implemented"
affects: [06-07]

tech-stack:
  added: []
  patterns:
    - "Progress region carries role=\"status\" with a visible count and a visually-hidden per-assignment/all-ranked announcement span in the same node, never assertive (contract detail (b))"
    - "Template refs bound inside v-for (unassignedButtonRefs) auto-populate as an array in DOM order -- no manual function-ref bookkeeping needed for focus management"
    - "Win percentage formatted with formatWinPct() stripping the leading zero (.800, not 0.800) to match 06-UI-SPEC.md §7.2's literal copy example"

key-files:
  created:
    - app/components/TiebreakerReasoning.vue
    - tests/components/TiebreakerReasoning.test.ts
  modified: []

key-decisions:
  - "Restart-removal entries sharing a (reason, atStep) pair are combined onto one line (e.g. \"Duke, Miami seeded at common opponents.\"); entries with distinct reason/step pairs each get their own line so no team's specific reason or step is ever lost in a merge -- matches 06-UI-SPEC.md §7.3's mockup exactly rather than one line per removed team"
  - "decisiveStep is explicitly undefined whenever resolvedBy === 'manual', regardless of what the group's trace contains -- §7.5 leads a manual group with the decided-by-you provenance and the ordering, never a decisive-step header; what the procedure exhausted is only shown behind the full-procedure toggle"
  - "The full-procedure toggle button renders only when group.trace.length > 0 -- a group with an empty trace (sole-candidate, unreachable in practice since §6.1 gates the disclosure trigger on contestedWith.length > 1) has nothing to disclose"
  - "Both Start Over and Undo Last are given identical explicit .focus() calls after their own state change rather than relying on native post-click focus retention, because @vue/test-utils' trigger('click') does not simulate real click-driven focus in happy-dom -- the explicit focus call is required for the interaction to be correct in a real browser too, not just for testability"

patterns-established:
  - "Contract detail (b) (progress region carries both its visible label and its live-region announcement in one node) is now a concrete, tested implementation other components with a similar dual-audience progress line can copy"

requirements-completed: [TIE-05, TIE-06]

coverage:
  - id: D1
    description: "TIE-05's four required reasoning elements (tied group, step applied, per-team values, restart events) all render and are all reachable, with the decisive step leading and the rest one toggle away (D-16)"
    requirement: "TIE-05"
    verification:
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#decisive step"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#value rendering"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#full procedure"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#restart events"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#terminal reason"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#trace isolation (display-side)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A manually-resolved group states decided-by-you provenance and the applies-while sentence before its committed ordering, satisfying TIE-06's visible-provenance half"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#manual provenance"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D-17 ordering terminus renders only for an unresolved group whose conference slate is complete, orders the whole group in one sequence of k clicks, and emits exactly once with the complete ordering -- never a partial one"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#ordering gate"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#assignment"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#ordering of unassigned rows"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#correction"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#commit"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#scale"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full §12.3 keyboard focus-management contract: focus follows the first remaining unassigned button after each assignment, lands on Start over on completion, and stays on Undo last only while it remains enabled"
    requirement: "TIE-06"
    verification:
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#focus management"
        status: pass
      - kind: unit
        ref: "tests/components/TiebreakerReasoning.test.ts#announcement"
        status: pass
    human_judgment: false
  - id: D5
    description: "Human visual/functional verification of the reasoning panel and keyboard-only ordering, mounted inside the real standings table"
    verification: []
    human_judgment: true
    rationale: "This plan's own <human-check> defers verification to Plan 07, where the component is mounted inside StandingsTable against real data -- no standalone visual verification surface exists yet."
---

# Phase 06 Plan 06: Reasoning Panel and Ordering Terminus Summary

**Built `TiebreakerReasoning.vue` standalone -- decisive-step-first TIE-05 display with every cycle and restart event one toggle away, plus the D-17 sequential group-ordering interaction with a complete keyboard focus contract**

## Performance

- **Duration:** ~3 min (tasks); commits at 2026-08-18T19:24:34-06:00 and 2026-08-18T19:27:32-06:00
- **Started:** 2026-08-18T19:24:34-06:00 (first commit)
- **Completed:** 2026-08-18T19:27:32-06:00
- **Tasks:** 2
- **Files modified:** 2 (1 new component, 1 new test file)

## Accomplishments

- Built `TiebreakerReasoning.vue`: a self-contained, props-in (`group`, `schoolById`, `slateComplete`) / events-out (`commit`) component whose root is a `<div>` panel, never a `<tr>`, so it mounts standalone in the plain vitest project and Plan 07 can supply the row wrapper unchanged
- Decisive step (D-16): computed as the last `StepOutcome` with `separated === true` in the last `TiebreakerCycle` of the group's own trace, rendered as a `<dl>` grid pairing every team with its value; a later non-separating step never leads
- All four `StepValue` variants render as their own phrase with no icon: `record` as `wins-losses (.xxx)` (leading-zero-stripped per §7.2's literal copy example), `headToHead`'s four result codes each as their own plain phrase, `indeterminate` as `not applicable`
- Full procedure toggle (`<button type="button">`, label flips, `aria-expanded`/`aria-controls`) reveals every cycle above the decisive-step block; non-separating steps read `no separation`; restart events render on their own line naming the removed teams, their reason (`seeded`/`eliminated`) and the step, and are never hidden by any other control
- Terminal reason renders only for an unresolved group: `No further step applies.`, the quoted rule citation, and the source name
- Manual provenance (§7.5): a `resolvedBy: 'manual'` group leads with `Decided by you` and the applies-while sentence, then the committed ordering by school, then the full-procedure toggle -- no decisive-step header for the manual case
- D-17 ordering terminus: gated on `group.teams.length > 1 && slateComplete`; sequential assignment (k clicks orders k teams), assigned rows as static text with a position pill (never buttons), unassigned rows sorted alphabetically by school, undo/start-over correction disabled at zero assigned, and a single `commit` emit carrying the complete ordering -- never a partial one
- Full §12.3 focus-management contract: focus moves to the first remaining unassigned button after each assignment, to `Start over` on the final assignment, stays on `Undo last` while it remains enabled, and moves to the first unassigned button when `Undo last` becomes disabled
- Progress region carries `role="status"` with the visible `Ranked {n} of {k}.` count and a visually-hidden per-assignment/all-ranked announcement in the same node (contract detail (b)), never `aria-live="assertive"`
- Zero Nuxt UI components, zero Nuxt auto-imports, zero `<table>` (uses `<dl>` for team-to-value pairs), zero raw palette classes or hex literals, zero team-color/`:style` bindings in the file, zero forbidden-vocabulary strings in rendered copy, zero packages installed (`package.json`/`pnpm-lock.yaml` diff empty)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the reasoning-display contract** - `5702911` (test/RED)
2. **Task 2: Build the reasoning panel and its ordering terminus** - `7126df3` (feat/GREEN)

## Files Created/Modified

- `app/components/TiebreakerReasoning.vue` - The reasoning panel and D-17 ordering terminus, built exactly to the plan's props/emit contract
- `tests/components/TiebreakerReasoning.test.ts` - 30 tests across 15 describe blocks: decisive step, value rendering, full procedure, restart events, terminal reason, manual provenance, trace isolation (display-side), tone, ordering gate, assignment, ordering of unassigned rows, correction, commit, focus management, announcement, and scale

## Decisions Made

- **Restart-removal lines group by `(reason, atStep)`, not one line per team.** 06-UI-SPEC.md §7.3's own mockup shows `Duke, Miami seeded at common opponents.` as a single combined line. Entries with distinct reason/step pairs still each get their own line, so no team's specific circumstance is ever lost in a merge.
- **`decisiveStep` is unconditionally `undefined` for a manual group.** §7.5's manual-provenance layout never mentions a decisive-step header for the manual case (only the heading, the ordering, then the toggle), so the computed short-circuits on `resolvedBy === 'manual'` regardless of what the inherited trace contains.
- **The full-procedure toggle is gated on `group.trace.length > 0`.** A group with an empty trace (`sole-candidate`) has nothing to disclose; per §6.1 such a group's rank is not even expandable in the table, so this is defensive rather than load-bearing, but it keeps the component correct if ever mounted directly against a trace-less fixture.
- **`Undo last` and `Start over` both call `.focus()` explicitly after their own state change**, rather than relying on the browser's native "still focused after a click that doesn't remove the element" behavior. `@vue/test-utils`'s `trigger('click')` does not simulate real click-driven focus in happy-dom, so relying on implicit retention would have been untestable and, more importantly, is not how a screen-reader-driven activation (Enter/Space, not a mouse click) behaves either -- the explicit call is the correct implementation, not a test accommodation.

## Deviations from Plan

None - plan executed exactly as written. The plan's own two "contract details" (panel-not-row root; progress region carrying both its visible label and its announcement) were followed as specified, not deviated from.

## Issues Encountered

None. Both tasks passed on first implementation; no auto-fix iterations were needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `TiebreakerReasoning.vue` is ready for Plan 07 to mount inside `StandingsTable.vue`'s reasoning `<tr>`/`<td colspan="4">`, passing a real `RankGroup` from `resolveConferenceRanking`, a `schoolById` map derived from the roster, and `slateComplete[conference]` from the D-07 predicate (Plan 05), and wiring the `commit` event to `useManualTiebreakers` (Plan 05)
- The component's own `<human-check>` is explicitly deferred to Plan 07 per this plan's `<verification>` block: expand a contested rank and confirm the decisive step reads first; open the full procedure and confirm every cycle and restart line is present; with a complete conference slate, order a tied group entirely by keyboard using Tab and Enter and confirm focus never lands on `<body>` after an assignment. Flagged here so it reaches UAT.
- **Accessibility trade to carry into UAT (§12.3, recorded per the plan's explicit instruction):** the unassigned team buttons are full-width but only ~26px tall, below the usual 44px touch-target guideline, because they sit inside a dense standings table where a 44px row would break the table's rhythm. Full-row width is the compensating affordance; this is the one accessibility trade in the phase.
- `shared/domain/tiebreakers/**` and `shared/domain/standings/**` coverage thresholds (90%/85% respectively, `vitest.config.ts`) are unaffected by this plan -- no files in either directory were touched; only `app/components/` and `tests/components/` changed.

## Self-Check: PASSED

- Both created files exist on disk (2/2): `app/components/TiebreakerReasoning.vue`, `tests/components/TiebreakerReasoning.test.ts`
- Both commit hashes found in git log (2/2): `5702911`, `7126df3`

---
*Phase: 06-tiebreaker-ui-championships*
*Completed: 2026-08-18*
