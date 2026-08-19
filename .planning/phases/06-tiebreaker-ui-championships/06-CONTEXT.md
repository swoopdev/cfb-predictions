# Phase 6: Tiebreaker UI & Championships - Context

**Gathered:** 2026-08-14 (locked decisions), 2026-08-15 (discuss session — open questions resolved)
**Status:** Ready for planning

> **Provenance.** D-01 through D-06 were made by the user in conversation while reviewing
> Phase 5's shipped rank semantics and recorded on 2026-08-14. D-07 through D-15 come from
> the `/gsd-discuss-phase 6` session on 2026-08-15, which resolved the five open questions
> that file deliberately left open. All are locked in the same sense.

<domain>
## Phase Boundary

Wire the tiebreaker engine into the UI: show each conference's championship matchup,
show the reasoning that produced it, let the user resolve ties the procedure cannot,
AND rank each conference 1..N rather than stopping after the two championship spots.

Out of scope: Playoff bracket, named scenarios, share links.

</domain>

<decisions>
## Implementation Decisions

### Ranking semantics — REVERSES Phase 5's D-04

- **D-01:** Conference standings show **distinct ranks 1..N**, not shared ranks.
- **D-02:** Ties are broken by **iteratively applying the published tiebreaker procedure**:
  resolve the top team, commit it, re-run the procedure on the remainder. The engine's
  `alreadyCommitted` mechanism already works this way for two slots; this extends it.
- **Rationale (user, verbatim intent):** the entire point of the app is seeing who is
  in the best position to make the conference championship game. Shared rank numbers
  obscure that. If more than two teams are tied at season's end, only the top two by
  tiebreaker play in the title game — the standings should show that ordering.

### Engine extension

- **D-03:** `ChampionshipResult` (`shared/domain/tiebreakers/types.ts`) exposes only `seed1`
  and `seed2`. Nothing resolves below seed 2. Extend the commit-and-restart loop past two
  slots. This is an extension of existing machinery, not a rewrite.
- **D-04:** **Fix these two logged engine bugs as part of this work, not on top of them** —
  1..N iteration will exercise both harder:
  1. The ACC trips the infinite-recursion guard (`engine.ts:137`, "defineTiedTeams did
     not strictly shrink the tied group on restart") on 12 of 1,200 conference
     resolutions (~4% of ACC resolutions) at just two seeds.
  2. The engine can contradict itself between seed 1 and seed 2 (7 of 649 resolved
     conferences) because an unseparated multi-team bucket is emitted in raw team-id
     order rather than as a group.

  Both are documented in full, with candidate repairs, in
  `.planning/phases/05-standings-engine-ui/deferred-items.md`.

### Manual resolution — when to prompt

- **D-05:** Teams the procedure genuinely cannot separate **share a rank and are marked
  tied**. Do NOT prompt for manual resolution while the conference slate is incomplete —
  more picks may resolve the tie on their own, and nagging mid-season is wrong.
- **D-06:** Once that conference's slate is fully picked, prompt for manual resolution of
  whatever remains.
- **D-07 — "Fully picked" predicate:** a conference's slate is complete when **every game
  in which both teams belong to that conference is picked**. Non-conference games are NOT
  part of the gate.
  - **Known exposure, accepted deliberately:** this predicate is not sufficient to freeze
    the procedure's *inputs*. Big 12 uses `deriveOverallWinCount` (including FCS wins) and
    cumulative-opponent-win-pct steps read opponents' full records, so a later
    non-conference pick can change a step's values without changing who is tied. D-08 is
    what absorbs that exposure — the two decisions must be implemented together.
  - Chosen over stricter predicates because it is the one a user can explain to themselves
    ("the conference is done") and it prompts as early as that intuition allows.

### Manual resolution — validity and lifetime

- **D-08 — Invalidation key:** a manual selection is keyed on a hash of **(tied group
  membership, terminal step, each team's value at that step)**. Any drift in any of the
  three invalidates the selection and re-prompts. This is stricter than TIE-06's literal
  floor (which only requires invalidation when the group changes) and is what makes D-07's
  conference-games-only gate safe: a non-conference pick that shifts a step value cannot
  leave a stale hand-made decision applied.
- **D-09 — Incomplete slate discards:** if a conference's slate stops being complete (the
  user clears or changes a conference pick), that conference's stored manual decisions are
  **discarded**, not suspended. Re-completing the slate re-prompts from scratch.
  - **Consequence, understood and accepted:** manual decisions are strictly ephemeral —
    they exist only while the conference slate is complete AND its inputs are unchanged.
    A user who clears one pick to check something loses that conference's hand-made
    decisions. Chosen because it yields a two-state machine (no suspended-limbo third
    state) and guarantees a hand-chosen rank is never displayed under conditions the user
    did not approve.
  - Planning note: D-08 + D-09 together mean re-prompting is the normal case, not the
    exception. The prompt surface (D-14) must be cheap to re-answer.

### Tie indication — REVERSES Phase 5's D-05

- **D-10:** Add visual marking for **both** cases, with **different** treatments:
  - **(a) Separated only by tiebreaker** — distinct ranks despite identical or close
    records: a subtle "decided by tiebreaker" affordance on the rank cell.
  - **(b) Genuinely unresolvable** — shared rank: a stronger shared-rank grouping
    treatment marking the teams as tied.
  - **Decision history:** the user first chose "mark shared ranks only," then reversed to
    "mark both" once it was flagged that marking only (b) does not satisfy ROADMAP.md
    Phase 6 success criterion 6 as written. Criterion 6 stands unamended.
- **Why Phase 5's D-05 is reversed:** D-05 declined a badge on the rationale that a
  matching rank number *plus* matching W-L values were sufficient. Phase 5 verification
  measured that rationale false on ~1% of tables — ACC teams share a rank with
  **different** records (e.g. `1 Boston College 6-2` displayed above `1 Duke 7-2`),
  because the ACC ties on alternate schedule lengths rather than win percentage.
  A rank gap must never be mistakable for a record gap.
- **D-11 — Marker palette:** both markers are drawn **from the neutral shell palette only.
  No team color anywhere in either marker.** Contrast is then verifiable once for two
  markers rather than once per team, which sidesteps Phase 5's unverified per-pair WCAG
  item entirely. Team color stays reserved for picked winners, per PROJECT.md.

### Championship matchup display

- **D-12:** Must read `seed1.order[0]` / `seed2.order[0]` **from the engine directly**.
  Never infer the matchup from standings row order — the seed1/seed2 contradiction in D-04
  means row order cannot satisfy both seeds.
- **D-13 — Unresolved seed presentation:** an unresolved seed renders as a **named candidate
  set**, not a placeholder. E.g. `Georgia vs. one of: Duke / Miami / Clemson`. A resolved
  seed is always named even when the other seed is pending — a half-filled matchup is
  preferred over discarding a seed the engine did resolve.
- **D-14 — No pending-reason distinction:** the card uses **one** pending presentation
  regardless of cause. It does NOT distinguish "more picks will settle this" (mid-season)
  from "permanently uncomputable, needs your decision" (`ranking-step` / `needs-scores`).
  The "act now" signal comes from the manual-resolution prompt appearing once the slate is
  complete (D-06), not from the card.

### Reasoning display and prompt surface

- **D-15 — Reasoning surface:** step-by-step reasoning lives **expandable in place, per
  tied group, inside the standings table**. Not a drawer off the championship card. This
  puts the explanation adjacent to the ranks it explains and covers every rank 1..N rather
  than only the championship seeds. Scales to the measured ~4.3 groups per table.
- **D-16 — Default depth:** on expand, lead with **the step that actually separated the
  teams and each team's value at it**. Earlier non-separating steps and restart events sit
  behind a "show full procedure" toggle. TIE-05's full content (tied group, step applied,
  per-team values, restart events) must all be reachable — this governs default depth, not
  completeness.
- **D-17 — Prompt surface:** the manual-resolution selection happens **inside that same
  expanded group**, presented as the terminus of the reasoning ("nothing separates these —
  you choose"). No modal, and no separate call-out chrome. The user sees exactly what the
  procedure exhausted before being asked to decide.
  - **Known cost, accepted:** nothing announces a waiting decision — the user must expand
    the group to discover it. The user declined both the "N decisions needed" call-out and
    the completion modal.

### Claude's Discretion

- Exact visual form of the two D-10 markers within the D-11 neutral-palette constraint
  (glyph vs. border vs. background band vs. row bracket).
- Layout and typography of the expanded reasoning block.
- Whether the D-08 hash is stored alongside each decision or recomputed on read.
- Structure of the `useStandings`-style composable extracted per IN-02.

</decisions>

<measured_constraints>
## Measured Constraints — these bound what is achievable

All measured against the committed 2026 slate over 200 generated seasons.

| Fact | Value |
|---|---|
| Seed slots resolving, fully picked | 82.9% |
| Seed slots resolving, weeks 1-7 | 73.0% |
| Failures that are `ranking-step` | 270/271 fully picked, 421/430 partial |
| Shared-rank groups per conference table | ~4.3 (3,433 groups over 800 tables) |
| Teams sitting in shared ranks | ~11,391 |

**`ranking-step` and `needs-scores` are PERMANENTLY uncomputable in this app.** There is
no rankings data in a static build (and real-world polls are meaningless for a
user-simulated season), and users pick winners rather than scores. Only a human choosing
can resolve those. This is a hard ceiling, not an implementation gap.

**Ties resolve LESS earlier in a season.** Mid-season tables will show many shared ranks
and converge toward clean 1..N as the slate fills. "1..N everywhere" is inherently an
end-of-season experience. Design the mid-season view for that reality rather than
treating it as a degraded state.

**The teams in those ~4.3 groups per table are ones the engine never evaluates today** —
they sit below seed 2, so extending to N seeds is what brings them into scope.

### The one open question planning MUST close

**Is "1-2 manual decisions per conference per season" actually true at N seeds?**
Extrapolating 17% unresolvable across ~4.3 groups gives ~0.7 per conference — but that
17% was measured only at seeds 1-2, where separation is easiest. **Planning MUST measure
the real figure at N seeds before committing to the UX.** This is a measurement task, not
a user decision, which is why it was not put to the user in the discuss session.

**Why it matters more now, not less:** D-17 puts the prompt behind an expand interaction
with no announcement, and D-08 + D-09 make re-prompting routine. That combination is
comfortable at ~1 decision per conference and hostile at 5-10. If the measured figure is
high, bring it back to the user — the likely remedy is reversing D-17 toward the declined
"N decisions needed" call-out, which is a contained change.

</measured_constraints>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The engine being extended
- `shared/domain/tiebreakers/engine.ts` — `resolveTiedGroup` (restart recursion at :133, return at :159), `resolveSlot` (:270), `resolveConferenceChampionship` (:283), entry validation (:218-229)
- `shared/domain/tiebreakers/types.ts` — `ChampionshipResult` (:138), `TiebreakerResult`, `TerminalReason` (`ranking-step` | `needs-scores` | `draw`)
- `shared/domain/tiebreakers/acc.ts` — `defineAccTiedTeams`, the non-percentage tie rule and its restart re-anchoring (:53-89)
- `shared/domain/tiebreakers/steps.ts` — `evaluateHeadToHead` round-robin branch (:47-76), `partitionByStepValue` team-id sort (:296-307)

### The standings code this changes
- `shared/domain/standings/computeStandings.ts` — `rankComponents` union-find over the equivalence closure of "same seed group" ∪ "identical conference W-L"; this is the grouping Phase 6 replaces
- `shared/domain/standings/resolveTiebreakers.ts` — `resolveAllConferences`, pick validation and per-conference throw isolation
- `app/components/StandingsTable.vue`, `app/components/StandingsSidebar.vue`
- `app/pages/week/[week].vue` — the orchestration IN-02 extracts into a composable

### Inputs the D-07 predicate does NOT freeze (read before implementing D-07/D-08)
- `shared/domain/standings/deriveConferenceRecords.ts` (Phase 3) — the single W-L tallier
- `deriveOverallWinCount` — Big 12's FCS-inclusive overall win count, fed by non-conference picks
- `shared/domain/tiebreakers/steps.ts` cumulative-opponent-win-pct — reads opponents' full records

### Requirements and criteria
- `.planning/REQUIREMENTS.md` §TIE-05, TIE-06, TIE-07, TIE-08 (lines 56-59)
- `.planning/ROADMAP.md` §"Phase 6: Tiebreaker UI & Championships" — six success criteria; criterion 6 is what forced D-10's reversal and stands unamended

### Prior decisions and known issues
- `.planning/phases/05-standings-engine-ui/05-CONTEXT.md` — D-04, D-05, D-10, D-11, D-14 (Phase 5's D-04 and D-05 are reversed here; the rest stand)
- `.planning/phases/05-standings-engine-ui/deferred-items.md` — both engine bugs, in full
- `.planning/phases/05-standings-engine-ui/05-REVIEW.md` — CR-01 and its fix; WR-06 and IN-02 deferred to this phase
- `.planning/phases/05-standings-engine-ui/05-VERIFICATION.md` — W-05, the measured 12/1200 shared-rank-different-record finding

### Project constraints
- `.claude/CLAUDE.md` — DRY constraint (one implementation each for team lookup, standings, tiebreakers); neutral shell with team color used sparingly; contrast must hold at small sizes (the basis for D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns
- The vitest project registers **no Nuxt auto-import plugin**, so components needing
  render tests must use explicit imports (`import { computed, ref, useId } from 'vue'`)
  and avoid Nuxt UI components entirely. `StandingsSidebar.vue` hand-rolls its toggle
  for exactly this reason. **The D-15 expandable group and the D-17 inline prompt inherit
  this constraint** unless a `nuxt`-environment vitest project is added first — planning
  should decide which, explicitly.
- Standings row order is built **constructively** (rank components → component sort →
  within-component sort → concatenate), never with a comparator, because a comparator
  cannot express an equivalence closure without risking non-transitivity. Whatever
  replaces it for 1..N should preserve that property.

### Reusable Assets
- `deriveConferenceRecords` (Phase 3) is the single W-L tallier for both layers. Do not
  add a second one — CLAUDE.md's DRY constraint.
- The engine's `alreadyCommitted` mechanism already implements commit-and-restart for two
  slots; D-03 extends it rather than replacing it.

### Integration Points
- `app/components/StandingsTable.vue` gains: distinct 1..N ranks, two marker treatments
  (D-10), per-group expansion (D-15), and the inline resolution control (D-17). It is the
  center of gravity for this phase's UI work.
- **There is no page-level integration test coverage** — `tests/pages/week.test.ts` was
  deleted in favour of honest absence. The pick → `picks` ref → `computed` → DOM chain is
  unexercised, and D-08/D-09's invalidation behavior lives squarely on that chain.

</code_context>

<specifics>
## Specific Ideas

- Championship card copy shape, from the discussion: `Georgia vs. one of: Duke / Miami / Clemson`.
- Reasoning terminus copy, from the discussion: "nothing separates these — you choose".
- The concrete defect that drives D-10: `1 Boston College 6-2` rendering above `1 Duke 7-2`.

</specifics>

<deferred>
## Deferred Into This Phase From Phase 5

- **WR-06** — `StandingsResult`'s loose string index signature does not express "every
  P4 conference is always present". Deferred because tightening it ripples into
  `StandingsSidebar`'s prop type, which Phase 5 was forbidden to change. This phase is
  already extending `StandingsResult`, so fold it in.
- **IN-02** — extract the standings/tiebreaker orchestration in `app/pages/week/[week].vue`
  into a composable. Deferred because it put a new app-layer seam in front of code
  Phase 5 was actively changing. This phase needs that seam anyway.

## Deferred Out Of This Phase

- **Per-team-color contrast verification.** D-11 avoids the problem rather than solving it
  by keeping markers neutral. Phase 5's unverified per-pair WCAG item remains open for
  wherever team color IS used (picked winners). Not this phase's work.
- **A "N decisions needed" call-out per conference.** Declined at D-17. Re-open only if the
  measurement in `<measured_constraints>` shows manual decisions are common.
- **Distinguishing pending-because-incomplete from pending-because-uncomputable on the
  championship card.** Declined at D-14.

</deferred>

---

*Phase: 06-tiebreaker-ui-championships*
*Context recorded: 2026-08-14 (locked decisions) / 2026-08-15 (discuss session)*
