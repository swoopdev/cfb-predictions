---
status: testing
phase: 05-standings-engine-ui
source: [05-VERIFICATION.md]
started: 2026-08-14T21:05:00Z
updated: 2026-08-14T21:05:00Z
---

## Current Test

number: 1
name: Pick and clear a conference game on /week/5 and watch the standings sidebar
expected: |
  The picked team's Conf Record W increments and the opponent's L increments in the
  same frame; rank numbers re-order with no visible lag, no spinner, and no stale row.
  Clearing the pick reverts both.
awaiting: user response

## Tests

### 1. Standings recompute live on pick and clear (STAND-02)
expected: Conf Record and rank update in the same frame in both directions, with no perceptible delay, no spinner, no stale row.
why_human: The reactive chain (picks ref → two computeds → sidebar re-render) has no executing test. `tests/pages/week.test.ts` is entirely `describe.skip` — all 18 skipped tests in the suite are that one file. The pure computation half IS measured (median 0.88ms, p95 2.69ms over 240 generated seasons of the full 888-game slate), but a fast pure function plus a correctly-shaped computed does not prove the DOM updates.
result: [pending]

### 2. Per-pair WCAG contrast in both themes
expected: Every foreground/background pair in the sidebar meets WCAG AA — 4.5:1 for the ≤12px column headers and record text, 3:1 for large text. Sample the rank number, team name, Overall Record cell, Conf Record cell, and column headers against the sidebar surface.
why_human: Nuxt UI injects the `--ui-color-neutral-*` ramp at runtime rather than into `entry.css`, so a static numeric audit is not feasible without a live browser. Verified statically: zero hard-coded colors, every utility bound to a real `--ui-*` token, and the one plainly risky pair already fixed (10px `text-dimmed` headers → 12px `text-muted`).
result: [pending]

### 3. Responsive layout at 375px and 1200px
expected: At 375px the sidebar is collapsed behind a "Show standings" toggle that expands and collapses. At 1200px it is a pinned, independently scrollable right panel. No team name is clipped at either width — longest P4 name is "Mississippi State".
why_human: Unit tests assert the aria-expanded/hidden class contract and the absence of truncate/nowrap on the team cell, but actual layout, wrapping, and reachability at real viewport widths are visual judgments.
result: [pending]

### 4. Does a shared rank read as a tie when the records differ? (D-05 judgment call)
expected: In an ACC table where two teams share rank 1 with DIFFERENT conference records — e.g. `1 Boston College 6-2` directly above `1 Duke 7-2` — a user reads the two rows as tied without further explanation.
why_human: |
  Decision D-05 declined a tie badge on the stated rationale that "the matching rank
  number + matching W-L values are sufficient." On the committed 2026 slate the W-L
  values do NOT always match inside a shared rank: measured 12 of 1200 conference
  tables (1%, all ACC) display a strictly worse conference record above a better one
  at the same rank.

  This is CORRECT behavior — it is the ACC's own published alternate-schedule-length
  tie definition (TIE-02) working as intended, and inversions with *different* rank
  numbers measured zero. But it falsifies half of D-05's stated rationale, so only a
  human can judge whether the rank number alone still communicates the tie, or whether
  a badge/icon is now warranted.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
