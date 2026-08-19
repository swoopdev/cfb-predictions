---
status: testing
phase: 06-tiebreaker-ui-championships
source: [06-VERIFICATION.md]
started: 2026-08-19T13:30:00Z
updated: 2026-08-19T13:30:00Z
---

## Current Test

number: 1
name: Marker contrast (D-11)
expected: |
  In `pnpm dev`, with a contrast checker, at real rendered size (12-14px), not zoomed:
  1. Marker (a)'s square chip against the table surface, light theme
  2. Marker (a)'s square chip against the table surface, dark theme
  3. Marker (b)'s round pill against the surface, light theme
  4. Marker (b)'s round pill against the surface, dark theme
  Target WCAG AA — 4.5:1 for the marker text.
awaiting: user response

## Tests

### 1. Marker contrast (D-11)
expected: WCAG AA (4.5:1) holds for all four combinations. Nuxt UI injects its neutral color ramp at runtime, so this cannot be statically audited.
result: [pending]

### 2. Full-flow walkthrough
expected: |
  Pick a full ACC conference slate. Confirm: shared ranks show the marker; expanding one shows the decisive step first with the full procedure (incl. every restart line) one toggle away; the D-17 ordering control appears only once the ACC slate is complete; ordering a group by keyboard alone (Tab/Enter) works and focus never lands on `<body>`; on commit the shared-rank marker becomes a distinct-rank marker immediately, no reload. Then clear one ACC pick and confirm the group silently reverts (no toast/banner/badge), re-pick the same winner and confirm the ordering silently returns.
result: [pending]

### 3. Mid-season read
expected: With a partly-picked season, the ACC's many shared ranks read as intentional — no badge, count, warning color, or alert — and no copy anywhere describes the state as unfinished.
result: [pending]

### 4. CR-01 fix — live confirmation
expected: |
  Open the "Decided at" panel for a genuinely multi-restart Big 12/SEC/Big Ten tie and confirm the decisive step's team values are the group's own team, not a later-resolved team's. (Automated: a 200-generated-season regression test confirmed failing pre-fix and passing post-fix, plus the full 525-test suite is green — this check is the fixer's own requested human look at a real rendered panel before full confidence, since it's a logic-correctness fix to the tiebreaker engine.)
result: [pending]

### 5. CR-02 fix — live confirmation
expected: |
  Cause a tied group's membership to change while its reasoning row stays mounted at the same table position, and confirm the ordering control's local state resets rather than showing a stale assignment (no stale team names, no silent dead end on the final click). (Automated: component regression test confirmed failing pre-fix, passing post-fix.)
result: [pending]

### 6. §12.3 touch-target trade
expected: |
  The D-17 ordering control's unassigned-team buttons are ~26px tall (below the 44px accessibility guideline) because a 44px row would break the standings table's rhythm. Decide: accept as shipped, or route to a follow-up plan.
result: [pending]

### 7. Quick task's lightened marker (b)
expected: |
  Confirm the lightened marker (b) treatment (`bg-muted`/`text-toned`/`ring-default`, applied by quick task 260819-hm8 after the phase's own code review) still reads as sufficiently visually distinct from marker (a) (`bg-accented`, `rounded`) in both themes, now that the row-level band/border was removed.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
