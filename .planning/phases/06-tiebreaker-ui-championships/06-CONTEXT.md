# Phase 6: Tiebreaker UI & Championships - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Source:** Direct user decision during Phase 5 closeout — NOT a `/gsd-discuss-phase` session

> **Provenance note.** These decisions were made by the user in conversation while
> reviewing Phase 5's shipped rank semantics, and were recorded here so they survive
> into planning. They are locked in the same sense a discuss-phase CONTEXT.md is
> locked. Gray areas that a full discuss-phase would normally surface are listed in
> `<open_questions>` at the bottom — those are NOT decided and should be resolved
> before or during planning.

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

- Conference standings show **distinct ranks 1..N**, not shared ranks.
- Ties are broken by **iteratively applying the published tiebreaker procedure**:
  resolve the top team, commit it, re-run the procedure on the remainder. The engine's
  `alreadyCommitted` mechanism already works this way for two slots; this extends it.
- **Rationale (user, verbatim intent):** the entire point of the app is seeing who is
  in the best position to make the conference championship game. Shared rank numbers
  obscure that. If more than two teams are tied at season's end, only the top two by
  tiebreaker play in the title game — the standings should show that ordering.

### When the procedure cannot resolve

- Teams the procedure genuinely cannot separate **share a rank and are marked tied**.
- **Do NOT prompt for manual resolution while the conference slate is incomplete.**
  More picks may resolve the tie on their own; nagging mid-season is wrong.
- **Once that conference's slate is fully picked**, prompt for manual resolution of
  whatever remains.
- User's expectation: at most 1-2 manual decisions per conference per season.
  **This is UNVALIDATED — see `<open_questions>`.**

### Tie indication — REVERSES Phase 5's D-05

- Add a **visual tie marker** for teams separated only by tiebreaker rather than by
  record. Distinct ranks alone destroy STAND-04's "visually indicated as tied" signal.
- **Why D-05 is reversed:** D-05 declined a badge on the rationale that a matching rank
  number *plus* matching W-L values were sufficient. Phase 5 verification measured that
  rationale false on ~1% of tables — ACC teams share a rank with **different** records
  (e.g. `1 Boston College 6-2` displayed above `1 Duke 7-2`), because the ACC ties on
  alternate schedule lengths rather than win percentage.
- A rank gap must never be mistakable for a record gap.

### Engine extension

- `ChampionshipResult` (`shared/domain/tiebreakers/types.ts`) exposes only `seed1` and
  `seed2`. Nothing resolves below seed 2. Extend the commit-and-restart loop past two
  slots. This is an extension of existing machinery, not a rewrite.
- **Fix these two logged engine bugs as part of this work, not on top of them** — 1..N
  iteration will exercise both harder:
  1. The ACC trips the infinite-recursion guard (`engine.ts:137`, "defineTiedTeams did
     not strictly shrink the tied group on restart") on 12 of 1,200 conference
     resolutions (~4% of ACC resolutions) at just two seeds.
  2. The engine can contradict itself between seed 1 and seed 2 (7 of 649 resolved
     conferences) because an unseparated multi-team bucket is emitted in raw team-id
     order rather than as a group.
- Both are documented in full, with candidate repairs, in
  `.planning/phases/05-standings-engine-ui/deferred-items.md`.

### Championship matchup display

- Must read `seed1.order[0]` / `seed2.order[0]` **from the engine directly**. Never
  infer the matchup from standings row order — the seed1/seed2 contradiction above
  means row order cannot satisfy both seeds.

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

### Prior decisions and known issues
- `.planning/phases/05-standings-engine-ui/05-CONTEXT.md` — D-04, D-05, D-10, D-11, D-14 (D-04 and D-05 are reversed here; the rest stand)
- `.planning/phases/05-standings-engine-ui/deferred-items.md` — both engine bugs, in full
- `.planning/phases/05-standings-engine-ui/05-REVIEW.md` — CR-01 and its fix; WR-06 and IN-02 deferred to this phase
- `.planning/phases/05-standings-engine-ui/05-VERIFICATION.md` — W-05, the measured 12/1200 shared-rank-different-record finding

</canonical_refs>

<code_context>
## Existing Code Insights

- The vitest project registers **no Nuxt auto-import plugin**, so components needing
  render tests must use explicit imports (`import { computed, ref, useId } from 'vue'`)
  and avoid Nuxt UI components entirely. `StandingsSidebar.vue` hand-rolls its toggle
  for exactly this reason. Any new UI in this phase inherits that constraint unless a
  `nuxt`-environment vitest project is added first.
- There is **no page-level integration test coverage** — `tests/pages/week.test.ts` was
  deleted in favour of honest absence. The pick → `picks` ref → `computed` → DOM chain
  is unexercised.
- `deriveConferenceRecords` (Phase 3) is the single W-L tallier for both layers. Do not
  add a second one — CLAUDE.md's DRY constraint.
- Standings row order is built **constructively** (rank components → component sort →
  within-component sort → concatenate), never with a comparator, because a comparator
  cannot express an equivalence closure without risking non-transitivity. Whatever
  replaces it should preserve that property.

</code_context>

<deferred>
## Deferred Into This Phase From Phase 5

- **WR-06** — `StandingsResult`'s loose string index signature does not express "every
  P4 conference is always present". Deferred because tightening it ripples into
  `StandingsSidebar`'s prop type, which Phase 5 was forbidden to change. This phase is
  already extending `StandingsResult`, so fold it in.
- **IN-02** — extract the standings/tiebreaker orchestration in `app/pages/week/[week].vue`
  into a composable. Deferred because it put a new app-layer seam in front of code
  Phase 5 was actively changing. This phase needs that seam anyway.

</deferred>

<open_questions>
## NOT DECIDED — resolve before or during planning

These are the gray areas a full `/gsd-discuss-phase 6` would normally surface. They are
deliberately left open rather than guessed at.

1. **Is "1-2 manual decisions per conference per season" actually true at N seeds?**
   The user's target. Extrapolating 17% unresolvable across ~4.3 groups gives ~0.7 per
   conference — but that 17% was measured only at seeds 1-2, where separation is
   easiest. **Planning MUST measure the real figure at N seeds before committing to the
   UX**, because the whole manual-resolution design assumes a small number. If it turns
   out to be 5-10 per conference, the interaction model needs rethinking.

2. **What exactly counts as "the conference slate is fully picked"?** Every conference
   game for every team in that conference? What about a team whose remaining games are
   all non-conference? Needs a precise predicate.

3. **What happens to a manual decision when picks change afterward?** TIE-06 requires
   invalidation rather than silent misapplication, but the interaction between "prompt
   only when slate complete" and "user goes back and changes a week 3 pick" is
   unspecified.

4. **How is the tie marker rendered?** Badge, icon, row grouping, or connecting rule.
   Must survive both themes at small sizes, and per-pair WCAG contrast is an
   unverified open item from Phase 5.

5. **Do unresolvable ties block the championship matchup display**, or does it show a
   pending state? TIE-07 says "resolved matchup (or the pending tie)", so probably the
   latter, but the exact presentation is undecided.

</open_questions>

---

*Phase: 06-tiebreaker-ui-championships*
*Context recorded: 2026-08-14 from direct user decision during Phase 5 closeout*
