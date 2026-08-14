# Phase 5: Standings Engine & UI - Discussion Log

**Session:** 2026-08-15
**Facilitator:** Claude (Haiku 4.5)
**Participant:** tdhancock

---

## Discussion Summary

Four gray areas were identified and discussed in depth:

1. **Standings View Layout** — where and how to display standings
2. **Tied Teams Visual Indication** — how to show teams with identical records
3. **Conference Record Display Format** — how to layout and emphasize record columns
4. **Unresolved Ties & Manual Resolution Handoff** — Phase 5 vs. Phase 6 boundary

All areas were resolved without deferred ideas.

---

## Area 1: Standings View Layout

**Questions asked:**

| # | Question | Options Presented | User's Choice |
|---|----------|-------------------|---------------|
| 1 | Where should standings be displayed? | Separate page (/standings) vs. Embedded in week view | Embedded in week view |
| 2 | Within week view, how organized? | Tab panel vs. Collapsible section vs. Sidebar panel | Sidebar panel (beside games) |
| 3 | How should 4 conferences appear? | Stacked/scrollable vs. Tabs within sidebar | All visible by default; if user filters to a conference, only show that conference's standings |
| 4 | Display format for each conference? | Table rows vs. Card-based | Table rows |

**Decisions locked:**
- D-01: Standings embedded in week view as right sidebar (collapsible on mobile)
- D-02: Conference-aware display (all 4 if no filter; single conference if filter active)
- D-03: Traditional HTML table format (rank | team | records)

---

## Area 2: Tied Teams Visual Indication

**Questions asked:**

| # | Question | Options Presented | User's Choice |
|---|----------|-------------------|---------------|
| 1 | How show rank when teams are tied? | Same rank number vs. Sequential + visual grouping | Same rank number (sports standard) |
| 2 | Add badge/icon to show tie? | Yes (icon/badge) vs. No (records are enough) | No — matching rank and records sufficient |
| 3 | Explain why teams are tied? | Tooltip/hover explanation vs. No (self-explanatory) | No — self-explanatory |

**Decisions locked:**
- D-04: Same rank number for tied teams (e.g., three teams at "2")
- D-05: No badge or icon
- D-06: No tooltip or explanation text

---

## Area 3: Conference Record Display Format

**Questions asked:**

| # | Question | Options Presented | User's Choice |
|---|----------|-------------------|---------------|
| 1 | Column format? | Four separate (W \| L \| W \| L) vs. Two combined (W-L \| W-L) | Two combined columns (W-L format) |
| 2 | Column headers? | "Conf Record" \| "Overall Record" vs. "Conference" \| "All Games" vs. "Conf W-L" \| "Total W-L" | "Conf Record" \| "Overall Record" |
| 3 | Which record first? | Conference Record first vs. Overall Record first | Overall Record first |

**Decisions locked:**
- D-07: Two combined columns with W-L format (e.g., "6-2")
- D-08: Headers: "Overall Record" | "Conf Record"
- D-09: Overall Record column appears first

---

## Area 4: Unresolved Ties & Manual Resolution Handoff to Phase 6

**Questions asked:**

| # | Question | Options Presented | User's Choice |
|---|----------|-------------------|---------------|
| 1 | Show unresolved ties how? | Provisional ranking vs. "Needs Resolution" badge vs. Assume Phase 6 handles it | Assume Phase 6 handles it |
| 2 | How does Phase 5 know when resolved? | Phase 6 updates picks/state vs. Phase 6 provides resolved result | Phase 6 provides resolved result directly |

**Decisions locked:**
- D-10: Phase 5 assumes all ties are resolved (no "pending" state display)
- D-11: Phase 6 computes and provides resolved tiebreaker result; Phase 5 consumes it
- D-12: When Phase 6 updates: Phase 6 updates state → Phase 5 watches → Phase 5 re-ranks standings

---

## Key Insights

1. **Embedded sidebar** beats separate route — standings are tightly wired to the week view, not a separate concern. Users will check standings while browsing weeks.

2. **Conference-aware display** — when filtered to a specific conference, show only that conference's standings. Reduces cognitive load.

3. **Simple visual language for ties** — matching rank + matching records = "these teams are tied." No badges, no tooltips. Let the data speak.

4. **Phase 5 / Phase 6 boundary** — Phase 5 shows standings assuming resolution is done (either auto or manual). Phase 6 does the resolution. Clean separation.

5. **Overall Record first** — even though conference record is the tiebreaker criterion, overall record is what casual fans care about most.

---

## Decisions Not Re-Asked (Carried Forward)

From prior phases:
- **Picks/persistence** (Phase 4): stored under `cfb_picks_2026`, available via `usePicksStorage` composable
- **Tiebreaker engine** (Phase 3): returns `Resolved | NeedsUserInput`, frozen base ordering for flagging ties
- **Tiebreaker computation** (Phase 4 design): a pure `computeStandings()` function in `shared/domain/`, called from reactive `computed()`
- **Week view layout** (Phase 2): games displayed at `/week/[n]`, conference/team filters as query params

---

## No Deferred Ideas

All gray areas were resolved. No scope creep, no open questions.

---

*Discussion log: 2026-08-15*
*All decisions locked; ready for planning phase*
