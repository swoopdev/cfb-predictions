# Phase 6: Tiebreaker UI & Championships - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 06-tiebreaker-ui-championships
**Areas discussed:** Manual resolution lifecycle, Tie marker rendering, Championship card with pending tie, Reasoning display surface

**Session mode:** update — a CONTEXT.md recorded 2026-08-14 from direct user decision during
Phase 5 closeout already locked the 1..N ranking call, the tie-marker reversal, and the
engine bug fixes. This session resolved the five open questions that file left open.

---

## Manual resolution lifecycle

### Q1 — "Fully picked" predicate

| Option | Description | Selected |
|--------|-------------|----------|
| Every conference game picked | All games where both teams are in that conference. Simple and explainable; risk that a later non-conference pick shifts a Big 12 total-wins or cumulative-opponent-win-pct step. | ✓ |
| Every game for every member team | Conference and non-conference alike. Strictly correct, no later pick can change inputs; costs later prompting and is harder to explain. | |
| Every input the procedure reads | Engine-derived per conference from which steps touch which data. Prompts as early as legitimately possible; predicate varies by conference. | |
| Whole season picked | One gate for the whole app. Trivially correct; a user who only cares about the SEC must pick all 800 games first. | |

**User's choice:** Every conference game picked.
**Notes:** The known-insufficient-inputs exposure was surfaced in the option text before the
choice was made, and was accepted knowingly. Q2's answer is what absorbs it — the two
decisions (D-07, D-08) are only sound together.

### Q2 — Invalidation key

| Option | Description | Selected |
|--------|-------------|----------|
| Key on group + step only | Selection survives an input shift if the same teams are stuck at the same step. Fewest re-prompts; accepts a changed input keeping an old answer. | |
| Key on group + step + values | Any input drift invalidates and re-prompts. Most faithful to "not silently misapplied"; more re-prompts. | ✓ |
| Survive, but mark stale | Keep applying with an "inputs changed" marker and one-click re-open. Nothing silent, nothing thrown away; costs a third UI state. | |

**User's choice:** Key on group + step + values.
**Notes:** Chosen over TIE-06's literal floor. Directly closes the Q1 exposure.

### Q3 — Manual decisions when the slate stops being complete

| Option | Description | Selected |
|--------|-------------|----------|
| Retain, suspend, re-apply on hash match | Keep in storage, stop applying while incomplete, resume silently if the hash matches again. Never destroys work for a transient edit; stores decisions that may never re-apply. | |
| Retain and keep applying | The gate governs prompting, never applying. Most stable ranks while editing; blurs auto-resolved vs hand-chosen mid-season. | |
| Discard on incompletion | Slate incomplete means no manual decisions exist. Simplest state machine; punishes a user who clears one pick to check something. | ✓ |

**User's choice:** Discard on incompletion.
**Notes:** Makes manual decisions strictly ephemeral. Accepted for the two-state machine and
the guarantee that a hand-chosen rank is never displayed under unapproved conditions.

---

## Tie marker rendering

### Q4 — Marking approach

| Option | Description | Selected |
|--------|-------------|----------|
| Mark shared ranks only | Only unresolvable teams get a marker; distinct ranks are self-explanatory. Minimal ink; user can't tell a tiebreaker-earned rank from a record-earned one. | (initially chosen, then reversed) |
| Mark both, differently | Subtle affordance on tiebreaker-decided rank cells; stronger grouping treatment on shared ranks. Satisfies criterion 6 literally; two visual languages to verify. | ✓ |
| Group visually, don't badge | Bracket/hairline/band spanning a tied group rather than per-row badges. Scales better at ~4.3 groups; harder for screen readers. | |

**User's choice:** Mark shared ranks only → **reversed to** Mark both, differently.
**Notes:** After the first selection, Claude flagged that it does not satisfy ROADMAP.md
Phase 6 success criterion 6 as written, and offered three resolutions (satisfy via the
reasoning affordance / amend criterion 6 / reverse the decision). The user chose to reverse.
Criterion 6 stands unamended.

### Q5 — Marker palette

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral only, no team color | Contrast verifiable once for two markers instead of per team; sidesteps Phase 5's unverified per-pair item; keeps team color for picked winners. | ✓ |
| Neutral + non-color redundancy | As above plus a glyph/label/shape so markers survive greyscale and colorblindness. Strictly more accessible; more visual weight. | |
| Team color permitted, verified per pair | Build-time contrast check over ~135 teams with neutral fallback. Richest look and closes the Phase 5 item; meaningful work inside a phase whose real risk is the ranking math. | |

**User's choice:** Neutral only, no team color.

---

## Championship card with pending tie

### Q6 — Unresolved seed presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Named seed vs candidate set | `Georgia vs. one of: Duke / Miami / Clemson`. Maximum information; card width varies with group size. | ✓ |
| Named seed vs pending slot | `Georgia vs. TBD` with the group behind a disclosure. Fixed two-slot shape scans cleanly across four cards; hides what the user most wants to see. | |
| Whole card pending | One unambiguous rule, no partial-matchup edge cases; discards a genuinely resolved seed 1. | |

**User's choice:** Named seed vs candidate set.

### Q7 — Pending reason distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Distinguish, and state the reason | "more picks needed" vs "needs your decision", mapped from the engine's TerminalReason. Tells the user whether to keep picking or act. | |
| Distinguish only when complete | Neutral candidate set mid-slate; "needs your decision" only once complete. Keeps mid-season quiet; user can't tell mid-season which ties are doomed. | |
| No distinction | One pending presentation regardless of cause. Simplest card; user can't tell waiting from acting. | ✓ |

**User's choice:** No distinction.
**Notes:** The "act now" signal is left to the manual-resolution prompt appearing once the
slate is complete, rather than to the card.

---

## Reasoning display surface

### Q8 — Where reasoning lives

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable per tied group in the table | Reasoning adjacent to the ranks it explains, covering every rank 1..N; scales to ~4.3 groups. Adds expand/collapse state to a table already carrying two markers. | ✓ |
| Drawer off the championship card | One coherent narrative, dense table; distance between a rank and its explanation, long drawer for multi-group conferences. | |
| Both surfaces, one source | Drawer narrates the championship, table expands for the rest, one shared component. Best fit to how users ask; most build and test surface. | |

**User's choice:** Expandable per tied group in the table.

### Q9 — Prompt surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the same expanded group | Selection is the terminus of the reasoning. Reasoning and decision share one surface; nothing announces a waiting decision. | ✓ |
| Same place, plus a call-out | As above plus an "N decisions needed" affordance per conference. Discoverable without a modal; one more piece of chrome. | |
| Modal on slate completion | Focused dialog walking outstanding decisions. Impossible to miss; interrupts and re-fires on every hash invalidation. | |

**User's choice:** Inside the same expanded group.
**Notes:** The declined call-out is the designated remedy if the N-seed measurement shows
manual decisions are frequent.

### Q10 — Default reasoning depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full trace, always | Every step, value, and restart on expand. TIE-05 unambiguously satisfied; long for deep ACC resolutions. | |
| Decisive step first, rest on demand | Lead with the separating step and its values; earlier no-ops and restarts behind a toggle. Answers "why is Duke ahead?" in one line; second disclosure level. | ✓ |
| Full trace, no-op steps condensed | Collapse non-separating steps into one summary line, restarts as explicit markers. Complete without padding; needs the trace to distinguish separating steps. | |

**User's choice:** Decisive step first, rest on demand.

---

## Not Put To The User

**"Is 1-2 manual decisions per conference per season actually true at N seeds?"** — Open
question 1 from the prior CONTEXT.md. This is a measurement task against the committed 2026
slate, not a preference, so it was left for planning to close rather than asked. It is
recorded in CONTEXT.md `<measured_constraints>` as a MUST for planning, with the note that
D-17 and D-08/D-09 together raise the stakes on the answer.

## Claude's Discretion

- Exact visual form of the two markers within the neutral-palette constraint.
- Layout and typography of the expanded reasoning block.
- Whether the invalidation hash is stored per decision or recomputed on read.
- Structure of the composable extracted per IN-02.

## Deferred Ideas

- Per-team-color contrast verification for surfaces where team color IS used (picked winners) — Phase 5 open item, not this phase.
- A per-conference "N decisions needed" call-out — declined at Q9; re-open if the N-seed measurement warrants.
- Distinguishing pending-because-incomplete from pending-because-uncomputable on the championship card — declined at Q7.

No scope creep arose during this session; all four areas stayed inside the phase boundary.
