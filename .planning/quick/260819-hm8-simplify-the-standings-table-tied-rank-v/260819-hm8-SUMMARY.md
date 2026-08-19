---
phase: quick-260819-hm8
plan: 01
subsystem: ui
tags: [vue, tailwind, standings, accessibility]

requires:
  - phase: 06-tiebreaker-ui-championships
    provides: StandingsTable.vue's tied-rank marker system (markerKindFor, MARKER_A_CLASS/MARKER_B_CLASS, RowMeta)
provides:
  - Row-level tie band/border removed from StandingsTable.vue -- tied and uncontested rows share identical row classes
  - MARKER_B_CLASS lightened to bg-muted/text-toned/ring ring-default, staying shape- and fill-distinct from marker (a)
  - Rank column (header + both render paths) horizontally centered
affects: [standings-ui, tiebreaker-ui]

tech-stack:
  added: []
  patterns:
    - "Row-level styling for tied groups removed entirely -- the rank number/marker pill is now the sole row-level tie signal, not a background band or border"

key-files:
  created: []
  modified:
    - app/components/StandingsTable.vue
    - tests/components/StandingsTable.test.ts

key-decisions:
  - "MARKER_B_CLASS uses bg-muted/text-toned/ring ring-default rather than bg-inverted/text-inverted, per direct user feedback that the previous treatment (solid fill + row band + left border) was too noisy"
  - "Kept rounded-full on marker (b) vs marker (a)'s rounded, and bg-accented on marker (a) untouched, so shape+fill distinction between the two markers survives the lightening"

patterns-established: []

requirements-completed: [QUICK-260819-hm8]

coverage:
  - id: D1
    description: "No standings <tr> carries a tied-row background band or left border -- every row's class is identical regardless of markerKind"
    requirement: QUICK-260819-hm8
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#renders marker (b) -- a lighter round pill, no row-level band or border -- for a shared rank"
        status: pass
    human_judgment: false
  - id: D2
    description: "Marker (b) renders as a visually lighter round pill (bg-muted/text-toned/ring) than before, while remaining shape- and fill-distinct from marker (a)'s square bg-accented chip"
    requirement: QUICK-260819-hm8
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#renders marker (b) -- a lighter round pill, no row-level band or border -- for a shared rank"
        status: pass
    human_judgment: true
    rationale: "Whether the lightened bg-muted/ring pill reads as sufficiently distinct from marker (a) in both light and dark theme is a visual judgment call the automated class-presence assertions cannot fully settle -- consistent with the pre-existing UAT gap on Nuxt UI's runtime color tokens (see STATE.md Blockers)."
  - id: D3
    description: "Every Rank-column number (header, plain uncontested numbers, marker (a)/(b) numbers) is horizontally centered"
    requirement: QUICK-260819-hm8
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#centers the Rank column header and cell in both the plain-number and marker render paths"
        status: pass
    human_judgment: false
  - id: D4
    description: "Disclosure/ARIA behavior (aria-expanded/aria-controls/aria-label, focus handling, TiebreakerReasoning.vue mounting) is byte-for-byte unchanged; TiebreakerReasoning.vue and ChampionshipCard.vue are untouched"
    requirement: QUICK-260819-hm8
    verification:
      - kind: unit
        ref: "tests/components/StandingsTable.test.ts#activating a marker inserts the reasoning row immediately after the group's last row, and removes it entirely on toggle-off"
      - kind: other
        ref: "git status --short confirms TiebreakerReasoning.vue and ChampionshipCard.vue absent from the diff"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-19
status: complete
---

# Quick Task 260819-hm8: Simplify Standings Table Tied-Rank Visuals Summary

**Removed StandingsTable.vue's per-row tied band/border, lightened marker (b) to a bg-muted/ring pill distinct from marker (a)'s bg-accented chip, and centered the Rank column across both render paths.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-19T18:26:00Z
- **Completed:** 2026-08-19T18:51:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Deleted the `markerKind === 'b'` branch on the `<tr>` binding -- every standings row (tied or not) now renders with the same static `transition-colors hover:bg-elevated/60` classes, so the tie signal lives entirely in the rank cell/marker rather than the row background/border
- Lightened `MARKER_B_CLASS` from `bg-inverted text-inverted` to `bg-muted text-toned ring ring-default`, keeping `rounded-full` (vs. marker (a)'s `rounded`) and `bg-accented` (marker (a), untouched) so the two markers stay shape- and fill-distinct
- Centered the Rank `<th>` and Rank `<td>` (`text-left` → `text-center`, asymmetric `pr-2` → symmetric `px-2`), covering the header and both the plain-number and button render paths
- Updated `tests/components/StandingsTable.test.ts`: rewrote the marker (b) test to assert the row-level band/border classes are absent and the button carries the lighter treatment, and added a new test asserting `text-center` on the Rank header and cell for both render paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the tied-row band/border, lighten marker (b), and center the Rank column** - `ac0500e` (fix)
2. **Task 2: Update StandingsTable tests for the simplified markup and add centering coverage** - `a08595c` (test)

_Note: docs/state commit handled separately by the orchestrator._

## Files Created/Modified
- `app/components/StandingsTable.vue` - Row `<tr>` binding is now a static class (no `markerKind` branch); `MARKER_B_CLASS` lightened; Rank `<th>`/`<td>` centered
- `tests/components/StandingsTable.test.ts` - Marker (b) test rewritten for the new markup; new centering test added

## Decisions Made
- `MARKER_B_CLASS` uses `bg-muted text-toned ring ring-default rounded-full` (lighter than the previous `bg-inverted text-inverted`) per direct user feedback that the row band + solid pill + left border combination read as noisy; the shared rank NUMBER is now the primary tie signal, with the lighter pill as secondary confirmation
- No architectural changes -- purely Tailwind class edits and test updates within the existing `markerKindFor`/`rowMeta` derivation, which was left untouched per the plan's constraints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `StandingsTable.vue`'s tied-rank visuals now match the user's direct feedback; no further work queued from this quick task
- `pnpm test` (521/521), `pnpm lint`, and `pnpm typecheck` all exit 0 with these changes applied
- `TiebreakerReasoning.vue` and `ChampionshipCard.vue` confirmed untouched (absent from `git status --short`)

---
*Phase: quick-260819-hm8*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: app/components/StandingsTable.vue
- FOUND: tests/components/StandingsTable.test.ts
- FOUND: ac0500e (fix commit)
- FOUND: a08595c (test commit)
