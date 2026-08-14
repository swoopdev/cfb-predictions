# Phase 2: Foundation & Read-Only Slate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 2-Foundation & Read-Only Slate
**Areas discussed:** Week & conference filter scope, Game card content & layout, URL structure for filters, Week navigation & default landing week

---

## Week & conference filter scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 11 conferences + All | Full slate is P4 + G5 + independents; G5 games affect P4 overall records | ✓ |
| Just SEC/Big Ten/Big 12/ACC + All | Matches eventual standings scope, hides ~40% of schedule | |

**User's choice:** All 11 conferences + All

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable combobox | Type-ahead across all 138 teams | ✓ |
| Grouped dropdown by conference | No typing, slower to scroll through 138 entries | |

**User's choice:** Searchable combobox

| Option | Description | Selected |
|--------|-------------|----------|
| Mutually exclusive | Picking a team clears conference filter and vice versa | ✓ |
| Combinable (AND filter) | E.g. "SEC games" + "Georgia" narrows further | |

**User's choice:** Mutually exclusive

| Option | Description | Selected |
|--------|-------------|----------|
| Identical treatment | Same card style regardless of conference | ✓ |
| Visually de-emphasized | Muted styling hinting at standings scope | |

**User's choice:** Identical treatment

**Notes:** None.

---

## Game card content & layout

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | Responsive grid, natural click target for Phase 4 picks | ✓ |
| List/table rows | Denser, less visually distinct | |

**User's choice:** Card grid — with an explicit addendum: "make sure to use the Nuxt UI component" (not a custom-built card).

| Option | Description | Selected |
|--------|-------------|----------|
| Name-only, placeholder logo | Consistent with Phase 1's placeholder SVG fallback | ✓ |
| Hide/exclude these games | Contradicts DATA-06/07 raw-passthrough | |

**User's choice:** Name-only, placeholder logo

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by conference, alphabetical | Structure for ~60 games/week with no kickoff-time data | ✓ |
| Flat list, natural order | Simpler, harder to scan | |

**User's choice:** Grouped by conference, alphabetical

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral-site badge | Changes how home/away reads | ✓ |
| Conference-game badge | Useful once filtering is in play | ✓ |
| Neither | Minimal cards | |

**User's choice:** Neutral-site badge + Conference-game badge (multiSelect)

**Notes:** User's requirement to use Nuxt UI's Card component specifically was captured verbatim in CONTEXT.md D-05.

---

## URL structure for filters

| Option | Description | Selected |
|--------|-------------|----------|
| Path segment /week/3 | Week is the primary navigation axis (SLATE-01) | ✓ |
| Query param /?week=3 | Simpler routing, undersells week's role | |

**User's choice:** Path segment /week/3

| Option | Description | Selected |
|--------|-------------|----------|
| Query params /week/3?conf=SEC | Filters are optional/secondary narrowing | ✓ |
| Also path segments /week/3/conf/SEC | More route complexity, awkward with multiple filters | |

**User's choice:** Query params

| Option | Description | Selected |
|--------|-------------|----------|
| CFBD numeric id ?team=2628 | Matches teams.json id field directly, no slug layer needed | ✓ |
| Team slug ?team=tcu | Readable, needs slug generation/lookup layer | |

**User's choice:** CFBD numeric id

**Notes:** None.

---

## Week navigation & default landing week

| Option | Description | Selected |
|--------|-------------|----------|
| Week 1 | No date-matching logic needed | ✓ (after clarification) |
| Detect nearest week to today | Not computable — no kickoff dates in data | |
| (User's first answer) "Start at week 0" | User initially believed the season starts at a "week 0" | superseded |

**User's choice:** Initially answered "start at week 0," believing that's when the first FBS games are played. Assistant checked the actual data: `games.json` has no week 0 — CFBD numbers the earliest slate (99 games) as week 1, and week 14 has zero games. Presented a follow-up clarification; user confirmed **week 1** is correct given the data, since that's the actual earliest slate.

| Option | Description | Selected |
|--------|-------------|----------|
| Prev/Next + week picker dropdown | Quick sequential browsing plus direct jump | ✓ |
| Prev/Next only | 13 clicks to jump from week 1 to 14 | |

**User's choice:** Prev/Next + week picker dropdown

| Option | Description | Selected |
|--------|-------------|----------|
| Disable the button | Clearest signal there's nothing further | ✓ |
| Wrap around | Unusual for a linear season schedule | |

**User's choice:** Disable the button

| Option | Description | Selected |
|--------|-------------|----------|
| Skip straight to week 15 | Never land on an empty page | |
| Land on week 14, show empty state | Preserves strict week-number sequence | ✓ |

**User's choice:** Land on week 14, show empty state ("No games this week")

| Option | Description | Selected |
|--------|-------------|----------|
| Regular season only, weeks 1–15 | Matches dataset exactly; championship games don't exist as schedule rows | ✓ |
| Reserve a placeholder now | Premature for Phase 2's read-only scope | |

**User's choice:** Regular season only, weeks 1–15

**Notes:** The week 0 / week 14 gap corrections were the most consequential exchange in this discussion — they change the default-week and boundary-navigation logic from what was initially assumed.

---

## Claude's Discretion

None — every gray area presented was explicitly decided by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
