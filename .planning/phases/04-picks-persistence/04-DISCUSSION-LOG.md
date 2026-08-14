# Phase 4: Picks & Persistence - Discussion Log

**Gathered:** 2026-08-14  
**Facilitator:** Claude  
**Duration:** 1 discussion session

---

## Gray Areas Discussed

### 1. Pick Interaction & Visual Feedback

**Question:** How should users pick a winner and see it visually?

**Options Presented:**
- Team card is clickable, picked team gets highlight/color
- Dedicated pick button per team
- Toggle UI (radio-like)
- Other

**User Selection:** Team card is clickable, picked team gets highlight/color

**Rationale & Notes:**
- Direct click on the team name/logo is more intuitive than a separate button.
- Visual distinction via highlight/color makes the picked state obvious.
- Supports the "click again to clear" behavior (PICK-02) without requiring a dedicated clear button.

---

### 2. Progress Indicator Placement & Format

**Question:** Where and how should the pick progress be shown?

**Options Presented:**
- Global progress bar + per-week text counts
- Just per-week text counts
- Global badge + per-week badge
- Other approach

**User Selection:** Global badge + per-week badge

**Rationale & Notes:**
- Minimal visual footprint with badge format.
- Global badge gives quick "at a glance" overview of season progress.
- Per-week badges keep users oriented about progress within each week.
- Format: text-based (e.g., "45/100") rather than percentage or progress bar — avoids false precision.

---

### 3. Bulk Operations UX

**Question:** How should users bulk-fill and bulk-clear picks?

**Options Presented:**
- Separate buttons per scope
- Single Fill/Clear buttons with modal confirmation
- Context-aware buttons in each section
- Other

**User Selection:** Context-aware buttons in each section

**Rationale & Notes:**
- "Fill Week" / "Clear Week" buttons in each week section operate on that week only.
- Global "Fill All" / "Clear All" buttons at the top operate on the full season.
- Keeps controls close to their scope, reducing cognitive load.
- Bulk operations mutate picks in batches and write localStorage once per operation, not per-pick.

---

### 4. Pick State Structure & Recovery

**Question:** How should picks be stored and recovered?

**Options Presented:**
- Object by game ID + silent recovery
- Array with provenance + banner recovery
- Object by game ID + auto-recovery
- Other

**User Selection:** Object by game ID + silent recovery

**Rationale & Notes:**
- Picks stored as `{gameId: winningTeamId, ...}` — compact, JSON-serializable, direct lookups.
- Provenance (user vs. auto-filled) tracked in a separate `autoFilledGameIds` set, not in the picks object itself.
- If parsing fails, silently reset to empty picks. Corrupt data preserved under a backup key for manual recovery.
- Season-namespaced keys (`cfb_picks_2026`, `cfb_autofilled_2026`) support future multi-scenario/multi-season extensions.

---

## Decisions Captured

All four gray areas were resolved. Key decisions documented in CONTEXT.md:
- D-01 to D-03: Pick interaction model (direct card click, highlight/color for picked state).
- D-04 to D-06: Pick state structure (flat object by game ID, separate provenance tracking).
- D-07 to D-08: Corrupt data recovery (silent reset with backup key).
- D-09 to D-11: Progress indicator (global + per-week badges, text format).
- D-12 to D-15: Bulk operations (context-aware buttons, batched mutations).
- D-16 to D-18: Integration with downstream phases (standings derivation, scenario support pattern).

---

## Next Steps

1. **Research phase:** Confirm VueUse composable integration pattern, review Phase 2's GameCard component for click-handler addition points.
2. **Planning phase:** Break down implementation into atomic tasks (storage composable, card interaction, progress badges, bulk operations).
3. **Execution:** Build and test each requirement in order, starting with the core pick toggling and persistence.

---

*Log generated: 2026-08-14*
