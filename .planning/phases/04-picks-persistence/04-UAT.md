---
status: overridden
phase: 04-picks-persistence
source: [recovered from tests/pages/week.test.ts, deleted 2026-08-14]
started: 2026-08-14T21:40:00Z
updated: 2026-08-19T19:15:00Z
override_reason: "User explicitly chose to mark phase complete without walking UAT (2026-08-19). None of these 10 items were manually exercised. Items 5-7 also carry a pre-existing flag: commit 0314427 removed the Clear Season confirmation modal, so those three steps may no longer describe the shipped page at all — that was never re-verified either."
---

## Provenance

This checklist was embedded as a trailing comment block in `tests/pages/week.test.ts`.
That file held 17 empty test bodies and 1 tautology (`expect(true).toBe(true)`) — zero
real assertions — wrapped in a `describe.skip`, and was deleted rather than filled in.
The checklist itself is the one genuinely useful thing it contained, so it is preserved
here. The underlying bulk-pick logic retains 22 real unit tests in
`tests/utils/bulkPickOperations.test.ts`; what is unverified is the page wiring.

## Tests

### 1. Buttons are present
steps: Run `pnpm dev`, navigate to `/week/1`.
expected: Fill Week, Clear Week, Fill Season, and Clear Season buttons are all visible.
result: [skipped — overridden by user, not manually checked]

### 2. Fill Week
steps: Pick a game in Week 1, then click "Fill Week".
expected: All remaining unpicked games in Week 1 are filled with the home team. The game picked manually beforehand keeps its original pick.
result: [skipped — overridden by user, not manually checked]

### 3. Clear Week
steps: With Week 1 picks present, click "Clear Week".
expected: All Week 1 picks clear instantly. **No confirmation modal appears.**
result: [skipped — overridden by user, not manually checked]

### 4. Fill Season
steps: Click "Fill Season".
expected: All remaining unpicked games across the entire season are filled. Existing picks are preserved, not overwritten.
result: [skipped — overridden by user, not manually checked]

### 5. Clear Season opens a confirmation modal
steps: Click "Clear Season".
expected: A confirmation modal appears with the correct title and body text.
flag: ⚠ VERIFY THIS STEP STILL APPLIES BEFORE TESTING. Commit `0314427` ("remove clear season confirmation modal and streamline clear season logic") removed this modal, and it may have been only partially restored since. Confirm the modal's current existence against the shipped page rather than assuming this step is correct — if it no longer exists, this step and steps 6-7 need rewriting, not failing.
result: [skipped — overridden by user, not manually checked]

### 6. Modal Cancel is non-destructive
steps: With the Clear Season modal open, click Cancel.
expected: The modal closes and all picks remain unchanged.
flag: ⚠ Depends on step 5 — see its flag.
result: [skipped — overridden by user, not manually checked]

### 7. Modal Clear All
steps: Click "Clear Season" again, then click "Clear All" in the modal.
expected: Every pick across the season clears and the modal closes.
flag: ⚠ Depends on step 5 — see its flag.
result: [skipped — overridden by user, not manually checked]

### 8. Progress badges track every operation
steps: Watch the progress badges through each of the operations above.
expected: Badges update correctly after every fill and every clear, in both directions.
result: [skipped — overridden by user, not manually checked]

### 9. Mobile layout
steps: Resize to below 640px and repeat the button interactions.
expected: Buttons remain usable and readable without excessive wrapping.
result: [skipped — overridden by user, not manually checked]

### 10. Cross-tab sync
steps: Open the app in two browser tabs. Make picks in one.
expected: The other tab reflects the change.
result: [skipped — overridden by user, not manually checked]

## Summary

total: 10
passed: 0
issues: 0
pending: 0
skipped: 10
blocked: 0

## Gaps
