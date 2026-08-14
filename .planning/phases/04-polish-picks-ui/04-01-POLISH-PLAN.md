---
phase: 04-polish-picks-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/components/PickProgress.vue
  - app/components/PickProgressWeek.vue
  - app/components/GameCard.vue
  - app/pages/week/[week].vue
  - app/utils/groupingLogic.ts
autonomous: true
requirements:
  - PICK-01
  - PICK-02
  - PICK-03
  - PICK-04
  - PICK-05
  - PICK-06
  - PICK-07
  - PICK-08
must_haves:
  truths:
    - Progress indicators are horizontal bars with centered labels, green fill, gray background
    - All picked game cards have white background to distinguish from unpicked cards
    - Week-level Fill/Clear buttons positioned below week heading in their own action row
    - Season-level Fill/Clear buttons positioned above game grid (already correct from Phase 4)
    - Conference-specific filters show all games in single section (no opponent-conference split)
  artifacts:
    - app/components/PickProgress.vue (horizontal bar layout)
    - app/components/PickProgressWeek.vue (horizontal bar layout)
    - app/components/GameCard.vue (white background on picked state)
    - app/pages/week/[week].vue (button repositioning, updated layout)
    - app/utils/groupingLogic.ts (simplified grouping for conference filters)
  key_links:
    - GameCard renders correctly with white background + border + checkmark when picked
    - Progress bars animate smoothly on width changes (0.3s transition)
    - Week buttons position below heading without overlapping game grid
    - Conference grouping logic handles out-of-conference games in single section
---

<objective>
Refine Phase 4 UI for clarity and usability — horizontal progress bars with centered labels, white backgrounds on picked game cards, repositioned bulk operation buttons, and simplified game grouping for conference-specific views.

Purpose: User experience improvements that make pick state and progress immediately obvious without requiring users to interpret text or navigate multiple sections.

Output: Updated component files (PickProgress, PickProgressWeek, GameCard), refactored week page layout (button positioning, game grouping logic), and visual refinements that pass UAT verification.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-polish-picks-ui/04-01-CONTEXT.md
@.planning/phases/04-picks-persistence/04-UI-SPEC.md
@.planning/ROADMAP.md

@app/components/GameCard.vue
@app/components/PickProgress.vue
@app/components/PickProgressWeek.vue
@app/composables/usePickProgress.ts
@app/pages/week/[week].vue
@app/utils/bulkPickOperations.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor PickProgress component to horizontal progress bar (D-01, D-04, D-05)</name>
  <files>app/components/PickProgress.vue</files>
  <action>
    Replace text-based "{X}/{Y} picked" badge with a horizontal progress bar component.

    Requirements (per CONTEXT.md D-01, D-04, D-05):
    - Horizontal bar layout with green fill (`primary` color from Nuxt UI, `#00DC82` light / `#016538` dark)
    - Gray background (`bg-muted` from Nuxt UI)
    - Height: ~24px to accommodate centered label
    - Label "{X}/{Y} picked" positioned in the middle of the bar, centered horizontally and vertically
    - Smooth 0.3s CSS transition on width changes when picks are made/cleared
    - Responsive: scales to available width on all breakpoints

    Implementation:
    - Use computed property to calculate percentage: `(progressOverall.picked / progressOverall.total) * 100`
    - Create bar container with relative positioning, label absolutely positioned at center
    - Use CSS `transition: width 0.3s` on the fill element
    - Label: `font-semibold text-sm` (Label typography from UI-SPEC), white text for contrast on green

    Styling (use Tailwind/Nuxt UI defaults):
    - Bar background: `bg-muted` (slate-100 light, slate-800 dark)
    - Fill background: `bg-primary` (green)
    - Text color: white/light enough for contrast on green
    - Gap from previous element: `mb-4` (16px)
  </action>
  <verify>
    <automated>grep -c "progress-bar\|fill-width\|0.3s" app/components/PickProgress.vue</automated>
  </verify>
  <done>PickProgress renders as horizontal bar with centered label; width updates smoothly when picks change; works in light and dark modes</done>
</task>

<task type="auto">
  <name>Task 2: Refactor PickProgressWeek component to horizontal progress bar (D-02, D-04, D-05)</name>
  <files>app/components/PickProgressWeek.vue</files>
  <action>
    Replace text-based "{X}/{Y} picked" badge with a horizontal progress bar component, identical styling to PickProgress but smaller height (~20px per D-04).

    Requirements (per CONTEXT.md D-02, D-04, D-05):
    - Same bar styling as PickProgress (green fill, gray background, centered label)
    - Height: ~20px (smaller than global 24px, per UI-SPEC Progress Indicators section)
    - Label "{X}/{Y} picked" centered in bar
    - 0.3s smooth animation on width changes
    - Inline layout ready (will be positioned inline with week heading in week/[week].vue)

    Implementation:
    - Reuse same bar logic as PickProgress but with height class variant (e.g., `h-6` for ~24px global, `h-5` for ~20px per-week)
    - Ensure component is flexible width for inline positioning in page layout
  </action>
  <verify>
    <automated>grep -c "progress-bar\|h-5\|0.3s" app/components/PickProgressWeek.vue</automated>
  </verify>
  <done>PickProgressWeek renders as horizontal bar at 20px height; label centered; smooth animation on pick changes; ready for inline positioning</done>
</task>

<task type="auto">
  <name>Task 3: Update GameCard component for white background on picked state (D-06, D-07, D-08, D-09)</name>
  <files>app/components/GameCard.vue</files>
  <action>
    Add white background to the entire game card when a winner is picked, to visually distinguish picked from unpicked cards.

    Requirements (per CONTEXT.md D-06 through D-09, UI-SPEC Color section):
    - Picked card: white background (`bg-white` light, appropriate elevated background in dark mode using Nuxt UI token)
    - Unpicked card: default card background (unchanged from Phase 4)
    - Background returns to default when pick is cleared (toggle behavior)
    - White background works in both light and dark modes (use Nuxt UI's `bg-elevated` or similar token for dark mode)

    Implementation:
    - Add computed to track `isPicked` (already exists)
    - Apply conditional class to the UCard wrapper: `:class="{ 'bg-white': isPicked }"` (light) or use Nuxt UI `bg-elevated` token for dark-mode compatibility
    - Verify that white background + left border (team color) + checkmark provides sufficient visual contrast per PROJECT.md constraints
    - Test with multiple team colors in both light and dark modes

    Note: The left border and checkmark are already implemented in Phase 4; this task adds the background.
  </action>
  <verify>
    <automated>grep -c "bg-white\|isPicked" app/components/GameCard.vue | grep -v "^0$"</automated>
  </verify>
  <done>Picked game cards have white background; unpicked cards use default background; background toggles correctly on pick/clear; contrast validated in both light and dark modes</done>
</task>

<task type="auto">
  <name>Task 4: Reposition bulk operation buttons in week page (D-10, D-11, D-12, D-13)</name>
  <files>app/pages/week/[week].vue</files>
  <action>
    Restructure the week page layout to reposition Fill/Clear buttons for better visual hierarchy.

    Requirements (per CONTEXT.md D-10 through D-13, UI-SPEC Bulk Operation Buttons section):
    - Season buttons (Fill Season, Clear Season): keep above game grid, already positioned correctly ✓
    - Week-level buttons (Fill Week, Clear Week): move below the "Week N" heading in their own dedicated action row (not inline with heading)
    - Progress bar: remains inline with week heading (after "Week N" text, before buttons)
    - Button styling: `UButton size="sm" variant="ghost"` (unchanged from Phase 4)
    - Disabled states: Fill button grayed when all games picked; Clear button grayed when no picks exist (per D-13)
    - Gap between buttons: `sm` (8px)

    Implementation:
    - Restructure the week heading row to contain: "Week N" heading + PickProgressWeek bar (flex gap-4)
    - Create new action row below week heading with just the Fill Week / Clear Week buttons
    - Buttons row layout: `flex gap-2` with appropriate vertical spacing (`mt-2` or `mb-4` from heading)
    - Add disabled state logic to buttons using game/pick state:
      - Fill Week disabled: `disabled={filteredGames.filter(g => !(g.id in picks)).length === 0}`
      - Clear Week disabled: `disabled={filteredGames.filter(g => g.id in picks).length === 0}`
    - Season buttons remain above grid, keep existing layout

    Current layout in week/[week].vue (lines 147-176):
    - Line 147-176: Week heading row with progress badge and week buttons inline, then WeekNav, then filters
    - This will be refactored to: Week heading with progress bar, then separate action row with buttons below
  </action>
  <verify>
    <automated>grep -A 20 "Week heading\|week-actions\|handleFillWeek" app/pages/week/[week].vue | head -30</automated>
  </verify>
  <done>Week buttons positioned below heading in dedicated row; disabled states working correctly; season buttons remain above grid; layout passes visual inspection</done>
</task>

<task type="auto">
  <name>Task 5: Update game grouping logic for conference-specific filters (D-14, D-15, D-16, D-17)</name>
  <files>app/pages/week/[week].vue, app/utils/groupingLogic.ts</files>
  <action>
    Simplify game grouping when a conference filter is applied: show all games in a single section instead of splitting by opponent conference.

    Requirements (per CONTEXT.md D-14 through D-17, UI-SPEC Conference-Specific Game Grouping):
    - When conference filter is active (D-14, D-16): show ALL games involving that conference in one section titled "{Conference} Games"
    - Includes: conference games (e.g., Big 12 vs Big 12), out-of-conference games (e.g., Big 12 vs SEC), and rivalry games
    - No sub-grouping by opponent conference (remove logic that splits "Big 12 vs SEC" from "Big 12 vs ACC")
    - When no conference filter: use existing groupByConference behavior (group by home team's conference)

    Current behavior (Phase 4):
    - `conferenceGroups` computed calls `groupByConference(filteredGames.value, teamsById.value)` which groups by home team conference
    - No special handling for conference filters currently exists

    Implementation:
    - Modify the `conferenceGroups` computed in week/[week].vue to detect when `conf.value` is set
    - If conference filter is active:
      - Create single-section group: `{ conference: "{conf.value} Games", games: filteredGames.value }` (already filtered by conference via filterGames)
      - This avoids the opponent-conference split entirely
    - If no conference filter (showing all):
      - Use existing `groupByConference(filteredGames.value, teamsById.value)` logic unchanged
    - No changes needed to `filterGames` or other utilities; the grouping logic alone changes

    Note: `filterGames` already handles conference/team filtering per Phase 4 (D-10). This task only changes HOW filtered results are grouped for display.
  </action>
  <verify>
    <automated>grep -c "conf.value\|Games Games\|single.*section" app/pages/week/[week].vue</automated>
  </verify>
  <done>Conference filter shows all games in single section; out-of-conference games appear naturally in that section; no opponent-conference sub-grouping; unfiltered view uses original grouping</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - Horizontal progress bars (global + per-week) with centered labels, green fill, 0.3s animation
    - White backgrounds on all picked game cards (light and dark modes)
    - Week-level buttons repositioned below headings
    - Conference filters showing all games in single section
  </what-built>
  <how-to-verify>
    1. Open app in browser at http://localhost:3000/week/1
    2. Verify progress bars:
       - Global progress bar visible above game grid with "{X}/{Y} picked" label centered in bar
       - Bar fill shows correct percentage of picks
       - Make a pick (click a team); verify bar width animates smoothly over 0.3s
       - Clear the pick; verify bar animates back smoothly
       - Per-week progress bar positioned inline with "Week 1" heading
       - Both bars use green fill color and gray background
    3. Verify game card styling:
       - Click a team to pick a winner; card should have white background with green left border and checkmark
       - Verify white background is readable in both light mode and dark mode
       - Click the picked team again to clear; background should return to default
       - Verify multiple picked cards in same week all show white background
    4. Verify button positioning:
       - Week-level buttons (Fill Week, Clear Week) positioned below "Week 1" heading in their own row, not inline
       - Season buttons (Fill Season, Clear Season) positioned above the progress bar, not moved
       - Test disabled states: button should gray out when action is no longer valid
    5. Test conference filter:
       - Apply conference filter (e.g., select "Big 12" from dropdown)
       - Verify all Big 12-related games appear in a single "Big 12 Games" section
       - Verify out-of-conference games (e.g., Kansas vs. non-conference opponent) appear in the same section
       - Verify no sub-grouping by opponent conference (e.g., no separate "Big 12 vs SEC" section)
       - Clear filter; verify games regroup by home conference as before
    6. Cross-check light/dark mode toggle:
       - Toggle dark mode; verify progress bars, card backgrounds, and all text remain readable
       - Verify white card background works in dark mode (use appropriate `bg-elevated` token)
    7. Accessibility:
       - Tab through team rows; verify keyboard navigation still works on picked cards
       - Test on mobile (<640px) to confirm buttons don't overflow; adjust spacing if needed

    Expected outcomes:
    - All visual refinements match UI-SPEC and CONTEXT.md decisions
    - No visual regressions from Phase 4
    - Performance: no noticeable lag on animations or interactions
  </how-to-verify>
  <resume-signal>
    Type "approved" if all visual refinements match expectations, or describe any issues found (e.g., "bar animation stutters", "white background too bright in dark mode", "button positioning breaks on mobile").
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User Input (Team Selection) | User clicks a team name to pick or clear; no untrusted input (already scoped to game/team IDs from committed schedule). |
| Pick Data (localStorage) | Picks loaded from localStorage and validated by Phase 4's corruption recovery; no new validation needed. |
| URL Query Params | Conference and team filters already sanitized by Phase 4 (D-10); no changes to filter validation in this phase. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04.1-01 | Tampering | localStorage picks | medium | accept | Picks already recovered from corruption in Phase 4; no new writes to storage in this phase (UI-only). |
| T-04.1-02 | Information Disclosure | progress bar display | low | accept | Progress bars show only aggregate pick counts (no sensitive data); visible to user via own browser. |
| T-04.1-03 | Denial of Service | CSS animation (progress bar) | low | accept | 0.3s animation on width change is performant (no heavy reflows); no malicious input can trigger excessive redraws. |

No new security constraints introduced. Existing Phase 4 safeguards (pick corruption recovery, URL sanitization, localStorage scoping by season) remain in effect.
</threat_model>

<verification>
**Phase 4.1 Verification Protocol:**

1. **Component Rendering:** Each component renders correctly in isolation and within the page context (progress bars, game cards, buttons)
2. **Visual Consistency:** Progress bars, buttons, and card styling match UI-SPEC and CONTEXT.md across all breakpoints and color modes
3. **Interaction Correctness:** Pick/clear toggling updates UI correctly; progress bars animate smoothly; button disabled states reflect game state
4. **Accessibility:** Keyboard navigation, screen reader labels, and focus management unchanged from Phase 4
5. **No Regressions:** All Phase 4 functionality remains intact (picks persist, bulk operations work, corruption recovery works)
6. **Performance:** No perceptible lag or flicker on animations; page load time unchanged from Phase 4

Completion gate: All visual refinements verified by human UAT checkpoint (Task 6); all code changes committed to git.
</verification>

<success_criteria>
1. **Progress indicators:** Horizontal bars with centered labels, green fill, gray background, 0.3s animation — replacing text badges completely ✓
2. **Picked game cards:** White background visible and readable in light and dark modes; returns to default on clear ✓
3. **Button positioning:** Week buttons below heading; season buttons above grid; no layout overflow on mobile ✓
4. **Conference grouping:** Single-section display for conference filters; out-of-conference games included naturally ✓
5. **No breaking changes:** All Phase 4 functionality preserved; picks persist, bulk operations work, accessibility maintained ✓
6. **UAT sign-off:** Visual refinements verified by human review and approved ✓

Success metric: Phase 4 requirements (PICK-01 through PICK-08) remain 100% satisfied after polish refinements; UI/UX improvements per CONTEXT.md decisions measurably increase clarity and usability.
</success_criteria>

<output>
Create `.planning/phases/04-polish-picks-ui/04-01-SUMMARY.md` when done

Summary should capture:
- What visual refinements were implemented (progress bars, white backgrounds, button positioning, grouping changes)
- How each CONTEXT.md decision (D-01 through D-17) was addressed
- Any implementation notes (e.g., dark mode color token used, responsive breakpoints adjusted)
- No new dependencies added
- All Phase 4 functionality preserved
- UAT verification completed
</output>
