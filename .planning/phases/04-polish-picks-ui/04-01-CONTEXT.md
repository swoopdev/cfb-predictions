# Phase 4.1: Picks & Persistence — UI Polish

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

UI refinements to Phase 4 (Picks & Persistence) based on user feedback. No logic changes — only visual and interaction improvements for clarity and UX.

Scope:
- Progress indicators: text badges → horizontal progress bars
- Picked game cards: standard background → white background for distinction
- Bulk operation buttons: repositioned for clearer hierarchy
- Game grouping: split by opponent conference → single section for conference-specific views

</domain>

<decisions>
## Implementation Decisions

### Progress Indicators (Horizontal Bars)

**Decision:** Replace text-based "{X}/{Y} picked" badges with horizontal progress bars showing visual fill percentage.

- **D-01:** Global progress bar appears above the game grid, showing season progress
- **D-02:** Per-week progress bar appears inline with week heading (before bulk operation buttons)
- **D-03:** Label "{X}/{Y} picked" is positioned **in the middle of the bar** for clarity
- **D-04:** Bar styling: green fill (`primary` color), gray background (`bg-muted`), ~24px height for global, ~20px for per-week
- **D-05:** Smooth animation (0.3s) on width changes when picks are made/cleared

### Picked Game Card Background

**Decision:** Add white background to game cards when a winner is picked, to visually distinguish from unpicked cards.

- **D-06:** Picked game card has `bg-white` (or Nuxt UI's `bg-elevated` equivalent)
- **D-07:** Unpicked game cards remain at default card background
- **D-08:** When pick is cleared, card background returns to default
- **D-09:** White background works in both light and dark modes (use appropriate color tokens)

### Bulk Operation Button Positioning

**Decision:** Reposition Fill/Clear buttons for clearer visual hierarchy.

- **D-10:** Week-level buttons (Fill Week, Clear Week) moved **below the week heading** in their own action row
- **D-11:** Season-level buttons (Fill Season, Clear Season) positioned **above the game grid**, near or below the progress bar
- **D-12:** Buttons remain `UButton size="sm" variant="ghost"` (no style changes)
- **D-13:** Disabled states: Fill buttons gray when all games picked; Clear buttons gray when no picks exist

### Conference-Specific Game Grouping

**Decision:** When a conference filter is applied, show all games in a single section (not split by opponent conference).

- **D-14:** Conference filter shows: ALL games involving that conference (conference games + out-of-conference games + rivalries)
- **D-15:** No sub-grouping by opponent conference (e.g., no separate "Big 12 vs SEC" section)
- **D-16:** Single "Big 12 Games" (or respective conference) section contains all relevant games
- **D-17:** Out-of-conference games (e.g., Missouri vs Kansas) appear naturally in the single section, not split away

### Claude's Discretion

- Exact progress bar height and label font sizing (as long as label is centered and readable)
- Progress bar animation timing (0.3s is suggested, adjustable for feel)
- Whether to show progress bar animation on initial page load or only on user-driven pick changes
- Mobile-specific layout adjustments for very small screens (<320px)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 context & decisions
- `.planning/phases/04-picks-persistence/04-CONTEXT.md` — Original Phase 4 decisions (D-01 through D-18)
- `.planning/phases/04-picks-persistence/04-UI-SPEC.md` — Updated visual contract with polish refinements
- `.planning/phases/04-picks-persistence/04-RESEARCH.md` — Implementation patterns (Vue 3, VueUse, component patterns)

### Phase 4 code baseline
- `.planning/phases/04-picks-persistence/04-{01..04}-PLAN.md` and SUMMARY.md files — what was built
- `app/components/GameCard.vue` — will be modified (add white background, remove inline buttons)
- `app/components/PickProgress.vue` and `PickProgressWeek.vue` — will be refactored (text badges → progress bars)
- `app/pages/week/[week].vue` — will be refactored (button positioning, game grouping logic)

### Project constraints
- `.claude/CLAUDE.md` — No new dependencies, use existing Nuxt UI components
- `.planning/PROJECT.md` — Team colors, contrast requirements, no backend

</canonical_refs>

<specifics>
## Specific Ideas

- Progress bars provide visual clarity without requiring users to count numbers (X out of Y)
- White background on picked cards makes the current state obvious at a glance
- Button repositioning groups controls by scope (week-level below heading, season-level at top)
- Conference-specific grouping simplifies filtering UX and handles edge cases naturally

</specifics>

<deferred>
## Deferred Ideas

None — all feedback incorporated into this phase.

</deferred>

---

*Phase: 4.1-picks-persistence-ui-polish*
*Context gathered: 2026-08-15*
