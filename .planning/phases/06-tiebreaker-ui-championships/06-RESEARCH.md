# Phase 6: Tiebreaker UI & Championships - Research

**Researched:** 2026-08-15
**Domain:** Tiebreaker engine extension (2 seeds → 1..N) + standings/tiebreaker UI
**Confidence:** HIGH on the measurements and the engine defects (measured this session against the committed 2026 slate); MEDIUM on UI shaping

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ranking semantics — REVERSES Phase 5's D-04**

- **D-01:** Conference standings show **distinct ranks 1..N**, not shared ranks.
- **D-02:** Ties are broken by **iteratively applying the published tiebreaker procedure**:
  resolve the top team, commit it, re-run the procedure on the remainder. The engine's
  `alreadyCommitted` mechanism already works this way for two slots; this extends it.
- **Rationale (user, verbatim intent):** the entire point of the app is seeing who is
  in the best position to make the conference championship game. Shared rank numbers
  obscure that. If more than two teams are tied at season's end, only the top two by
  tiebreaker play in the title game — the standings should show that ordering.

**Engine extension**

- **D-03:** `ChampionshipResult` (`shared/domain/tiebreakers/types.ts`) exposes only `seed1`
  and `seed2`. Nothing resolves below seed 2. Extend the commit-and-restart loop past two
  slots. This is an extension of existing machinery, not a rewrite.
- **D-04:** **Fix these two logged engine bugs as part of this work, not on top of them** —
  1. The ACC trips the infinite-recursion guard (`engine.ts:137`, "defineTiedTeams did
     not strictly shrink the tied group on restart") on 12 of 1,200 conference
     resolutions (~4% of ACC resolutions) at just two seeds.
  2. The engine can contradict itself between seed 1 and seed 2 (7 of 649 resolved
     conferences) because an unseparated multi-team bucket is emitted in raw team-id
     order rather than as a group.

  Both are documented in full, with candidate repairs, in
  `.planning/phases/05-standings-engine-ui/deferred-items.md`.

**Manual resolution — when to prompt**

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

**Manual resolution — validity and lifetime**

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

**Tie indication — REVERSES Phase 5's D-05**

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

**Championship matchup display**

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

**Reasoning display and prompt surface**

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

### Deferred Ideas (OUT OF SCOPE)

- **Per-team-color contrast verification.** D-11 avoids the problem rather than solving it
  by keeping markers neutral. Phase 5's unverified per-pair WCAG item remains open for
  wherever team color IS used (picked winners). Not this phase's work.
- **A "N decisions needed" call-out per conference.** Declined at D-17. Re-open only if the
  measurement in `<measured_constraints>` shows manual decisions are common.
- **Distinguishing pending-because-incomplete from pending-because-uncomputable on the
  championship card.** Declined at D-14.
- Playoff bracket, named scenarios, share links (phase boundary).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TIE-05** | The resolution UI shows the step-by-step reasoning that produced the result — the tied group, the step applied, each team's value at that step, and any restart events — not just the final answer | `TiebreakerCycle[]` already carries all four elements (`tiedTeams`, `steps[].values`, `outcome: 'restart'`, `removed[]`). §Architecture Pattern 3 specifies the per-group trace restructure that makes it consumable; §Pitfall 5 covers the shared-array aliasing that currently makes traces cross-contaminate |
| **TIE-06** | A manual tiebreaker selection is tied to the specific tied group and step it resolved, so it stays valid if picks are unchanged and is invalidated (not silently misapplied) if the tied group changes | §Architecture Pattern 4 (D-08 invalidation key) gives the exact serialization and a synchronous hash; §Pitfall 4 covers the async-crypto trap; §Correction 1 narrows the D-07 exposure the key must absorb to a single conference and a single step |
| **TIE-07** | The resolved conference championship matchup (or the pending tie) is displayed as a dedicated, prominent element above each conference's standings table | §Architecture Pattern 2's `ConferenceRanking.groups[0]/[1]` gives D-12 its direct engine read with no row-order inference; §Pitfall 6 covers the ACC case where seed 2 is a 10-team candidate set and D-13's copy shape breaks down |
| **TIE-08** | Each conference's standings are ranked 1..N by iteratively applying the published tiebreaker procedure — resolve the top team, commit it, re-run on the remainder — rather than stopping after the two championship participants; teams the procedure genuinely cannot separate share a rank and are surfaced for manual resolution once that conference's slate is fully picked | §The Measurement quantifies exactly how far 1..N is achievable per conference; §Architecture Pattern 1 gives the loop; §Architecture Pattern 5 replaces `computeStandings`' union-find with the engine's own partition |
</phase_requirements>

## Summary

This phase's risk is **not** the UI. It is that extending the tiebreaker engine from 2 seeds
to 1..N exposes two latent defects that Phase 5's shared-rank display was structurally
hiding, and reveals that **the ACC cannot produce a clean 1..N ranking at all** — not
because of a bug, but because its published policy has exactly one computable step.

I ran the N-seed measurement the roadmap requires as a planning MUST, against the committed
2026 slate over 200 generated seasons, using the same mulberry32 harness Phase 5 built. The
headline answer to *"is 1-2 manual decisions per conference per season true at N seeds?"* is
**yes for the SEC, Big Ten and Big 12 — and no for the ACC by roughly 4x.** The ACC needs
~3.8 manual decisions per fully-picked season (p90 = 5) under the best interaction model,
and ~9.2 under a literal reading of D-02. Every other conference lands at 0.01–0.20.

The second finding is more serious than the first. **19.2% of contested rank slots currently
resolve their top team by raw team id rather than by the tiebreaker procedure** — 21% of SEC
slots, 22% of Big Ten, 23% of Big 12, and 0% of ACC. At two seeds this was almost invisible
(7 of 649 conferences) because `computeStandings` collapsed the whole disputed group onto one
shared rank. **D-01 removes the shared rank that was hiding it.** Under distinct 1..N ranks
each of those slots displays a specific ordering that is a database-id sort presented as a
tiebreaker result — and D-10(a) would put a "decided by tiebreaker" marker on it, which turns
a silent defect into an affirmative false claim. This must be fixed before, not alongside,
the UI work.

**Primary recommendation:** Sequence the phase as **engine-first, in three gates** — (1) fix
both defects and prove it with the measurement harness committed as a test; (2) build the
N-seed loop emitting an ordered list of rank groups, which lets `computeStandings` delete its
union-find entirely rather than extend it; (3) then build the UI. Adopt **interaction model B**
(the user orders an entire unresolvable group in one interaction) rather than the literal
pick-the-top-and-re-run of D-02 — it is a 2.4x reduction in ACC prompts for no loss of
correctness. Bring the ACC number back to the user before committing to D-17, exactly as
CONTEXT.md instructs.

## The Measurement — closing CONTEXT.md's mandatory open question

> CONTEXT.md `<measured_constraints>`: *"Planning MUST measure the real figure at N seeds
> before committing to the UX."*

**Status: MEASURED THIS SESSION.** All figures below are `[VERIFIED: measured against
public/data/2026/games.json over 200 generated seasons]` — 100 fully-picked
(mulberry32 seeds 1–100) and 100 partially-picked through week 7 (seeds 1001–1100), the same
generator and seed ranges `tests/domain/standings/standings-tiebreaker-agreement.test.ts`
already uses, so these numbers are directly comparable to Phase 5's.

### Answer: the target holds for three conferences and fails badly for the ACC

Manual decisions per conference per fully-picked season, **with both engine repairs applied**:

| Conference | Teams | Model A (literal D-02) | **Model B (recommended)** | p90 (B) | max (B) | Seasons needing none |
|---|---|---|---|---|---|---|
| SEC | 16 | 0.10 | **0.10** | 0 | 2 | 91% |
| Big Ten | 18 | 0.20 | **0.19** | 1 | 2 | 83% |
| Big 12 | 16 | 0.01 | **0.01** | 0 | 1 | 99% |
| **ACC** | 17 | **9.23** | **3.84** | **5** | **6** | **0%** |
| *Overall* | — | *2.38* | ***1.03*** | — | — | *68.3%* |

Mid-season (weeks 1–7), model B: SEC 0.34, Big Ten 0.97, Big 12 0.55, **ACC 3.38**, overall 1.31.

- **Model A** = D-02 read literally: the user picks the single top team of an unresolvable
  group, the procedure re-runs on the remainder, and the same group minus one team is
  usually stuck again — so one 5-way tie costs four separate prompts.
- **Model B** = the user orders the entire unresolvable group in one interaction. Same
  correctness, same ranks produced, one interaction instead of *k*−1.

**Model B is strictly better and should be adopted.** It does not contradict D-02 (the
commit-and-restart loop is unchanged; only the number of teams the *human* commits per
interaction changes) and it fits D-17's "nothing separates these — you choose" copy naturally:
the user is ordering the group, not repeatedly picking a top.

### Why the ACC is the outlier — structural, not a bug

`CONFERENCE_RULES.ACC` declares `twoTeamSteps: ['head-to-head']` and
`multiTeamSteps: ['head-to-head']`. **One computable step.** The other three each have four
or five. `[VERIFIED: shared/domain/tiebreakers/rules.ts]`

This is faithful to the published policy, not an implementation gap. The ACC's July 2026
amendment is: head-to-head, then SportSource Analytics Team Success Ranking, then a
commissioner's draw. `[CITED: theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx; espn.com/college-football/story/_/id/49366844]`
Steps 2 and 3 are both permanently uncomputable in a static, winner-only app. Phase 3
re-verified the primary PDF verbatim on 2026-08-13 with zero drift.

Worse, the ACC's `defineAccTiedTeams` deliberately pulls in teams on *alternate schedule
lengths* — teams that, by construction, frequently have not played each other. So the tied
pool composition actively maximizes the chance that head-to-head is indeterminate.

**Consequence for success criterion 4** — distinct ranks 1..N *before* any manual resolution:

| Conference | Teams | Distinct ranks shown (fully picked) | Teams sharing a rank |
|---|---|---|---|
| SEC | 16 | **16.0** | 0.1 (1%) |
| Big Ten | 18 | **17.9** | 0.2 (1%) |
| Big 12 | 16 | **16.0** | 0.0 (0%) |
| **ACC** | 17 | **6.5** | **14.4 (85%)** |

Mid-season the ACC shows **4.1 distinct ranks across 17 teams — 96% of the conference sharing
a rank.** CONTEXT.md's framing that "'1..N everywhere' is an end-of-season experience" is
right in spirit but understates the ACC: for the ACC it is a *post-manual-resolution*
experience, and it never arrives from picks alone.

### What this means for the UX decisions

CONTEXT.md pre-committed the remedy: *"If the measured figure is high, bring it back to the
user — the likely remedy is reversing D-17 toward the declined 'N decisions needed' call-out."*

**The measured figure is high, for one conference only.** Recommendation for planning:

1. **Adopt model B** unconditionally. It is free and halves the problem.
2. **Escalate the ACC number to the user before building D-17.** At SEC/Big Ten/Big 12 rates
   (~0.1, 83–99% of seasons needing zero decisions) D-17's "no announcement, expand to
   discover" design is comfortable and the declined call-out would be noise. At the ACC's
   3.8 decisions in **100% of seasons**, a user who never expands an ACC group will never
   see a complete ACC table and will have no idea why. The two regimes may warrant different
   treatment — a per-conference call-out shown only when that conference has outstanding
   decisions is a contained change that costs nothing in the three quiet conferences.
3. **Do not let D-09's discard-on-incompletion interact unexamined with the ACC number.**
   Clearing one ACC conference pick discards ~4 hand-made decisions covering ~14 of 17 teams,
   and re-completing re-prompts all of them. Flag this to the user as part of (2); it is the
   sharpest edge in the whole design and it only bites in the ACC.

### The harness — commit it, do not re-derive it

The measurement above is reproducible and should become a committed artifact so the numbers
can be re-checked whenever the engine changes. Phase 5 already embeds `mulberry32`,
`generatePicks` and `readJson` inline in
`tests/domain/standings/standings-tiebreaker-agreement.test.ts` (lines 209–240) — **extract
those three into a shared test helper rather than writing a fourth copy** (DRY, per
CLAUDE.md). See §Code Examples for the loop; §Validation Architecture for where it lands.

## Correction to CONTEXT.md D-07's stated exposure

> CONTEXT.md D-07: *"Big 12 uses `deriveOverallWinCount` (including FCS wins) **and
> cumulative-opponent-win-pct steps read opponents' full records**, so a later
> non-conference pick can change a step's values."*

**The second half is incorrect.** `evaluateCumulativeOpponentWinPct`
(`shared/domain/tiebreakers/steps.ts:223-247`) receives the **conference-scoped** `records`
map built by `deriveConferenceRecords(conferenceGamesFor(...), ...)`, iterates
`record.opponents` (conference opponents only), and reads those opponents' **conference**
records. A non-conference pick cannot move it. `[VERIFIED: read steps.ts:223-247 and
engine.ts:232]`

**The real exposure is exactly one step in exactly one conference:** the Big 12's
`total-wins`, fed by `deriveOverallWinCount(allSeasonGames, ...)`.

This materially shrinks the risk D-08 exists to absorb — and the Big 12 is the conference with
the *lowest* measured manual-decision rate (0.01 per season, 99% of seasons needing none). The
D-07 + D-08 pairing is still correct and should be implemented as decided, but planning should
know the hole it patches is far smaller than CONTEXT.md assumed, and should not spend
disproportionate effort there. **The ACC — source of ~95% of all prompts — reads nothing
outside conference games and is completely immune to the D-07 exposure.**

## ACC policy re-verification — closes Open Question 2 (added 2026-08-15, post-research)

> Performed by the orchestrator after this research was committed, in response to Open Question 2
> and STATE.md:108's standing LOW-confidence blocker on conference step orders.

### Verdict: the step list is CORRECT. The ACC problem does not collapse.

Head-to-head genuinely is the ACC's only computable step. Two independent verbatim reproductions
of the July 2026 policy agree, and ESPN supplies the confirming detail: the **old** system's fifth
step, *conference opponent win percentage* — the one that separated Duke and Miami — **is no longer
in the new hierarchy**. `CONFERENCE_RULES.ACC` omitting it is faithful to the amended policy, not a
Phase 3 transcription error.

The tied-team definition also matches `defineAccTiedTeams`. Policy verbatim: *"Identify team(s)
with the best Conference win percentage. Add any team(s) that played an alternate number of games
and match the wins or losses of the above team(s). No other teams are included."*

**The measured 3.84 decisions/season for the ACC stands. Plan the UX for it.**

### But re-verification surfaced a THIRD engine defect

The ACC's multi-team procedure has two branches. Verbatim (fbschedules; CBS states the same rule):

> **If tied teams are not all common opponents:**
> 1. *"The team that defeated every other Tied Team advances to the Championship Game and is removed from the tie."*
> 2. *"The team that lost to every other Tied Team is eliminated."*

`evaluateHeadToHead` (`shared/domain/tiebreakers/steps.ts`) implements step 1 and **drops step 2**.
It declares `_lostToAllOthersTeam` at `steps.ts:81`, assigns it at `steps.ts:99`, and **never reads
it** — the underscore prefix is a deliberately silenced unused-variable warning. When no team swept
the group, `steps.ts:136` returns `separated: false` and the whole group stays tied, even when one
team was swept by all the others and the policy says it must drop.
`[VERIFIED: read steps.ts:34-143; grepped — the identifier has exactly two occurrences, both writes]`

The round-robin branch is correct: partitioning by win pct among tied teams is exactly the policy's
*"Best record among the Tied Teams."*

**Why Phase 5 could not see this.** At seeds 1–2 you only need the *top* team, so failing to push a
swept team downward costs almost nothing. At N seeds, eliminating the swept team **is** a separation
and directly produces rank order. This is a third defect in the same class as the two already logged
in `deferred-items.md`, and it lands on the conference driving ~95% of all manual prompts.

**Magnitude is UNMEASURED.** It should recover some of the ACC's 3.84, but it cannot approach the
SEC's 0.10 — one computable step is still one step. Quantifying the delta belongs in the Wave 0
harness this document already specifies (`n-seed-decision-rate.test.ts`).

### Planning implications

1. Treat the missing lost-to-all elimination as a **fourth engine task**, alongside the recursion
   guard, the seed1/seed2 contradiction, and the 19.2% team-id ordering defect. Fix it in the same
   engine-first gate, with the measurement committed as a test.
2. Because the fix may lower the ACC rate, **do not hard-code "~4 decisions"** into copy or layout
   that would break if it drops to 2.
3. D-09's discard-on-incompletion gets *worse*, not better, at 3.84 — press hardest on it in the
   UI spec.

### Restart language confirmed verbatim — independently validates the Pitfall 2 repair

> *"If still tied after any step, restart the entire tiebreaker (including re-defining tied teams)."*

The recursion guard demands the tied group strictly shrink; the policy explicitly permits
redefinition to produce a **different** set. The 44/400 → 0/400 repair measured above is therefore
consistent with the actual published rule, not merely with suppressing a symptom.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| N-seed commit-and-restart loop | Domain (`shared/domain/tiebreakers/engine.ts`) | — | Pure function of (games, outcomes, roster); CLAUDE.md DRY — one tiebreaker implementation |
| Both engine defect repairs | Domain (`engine.ts`) | — | Same module that owns the recursion invariants |
| Rank-group → standings rows | Domain (`shared/domain/standings/computeStandings.ts`) | — | Already the single ranking implementation; Phase 6 *simplifies* it |
| "Conference slate fully picked" predicate (D-07) | Domain (`shared/domain/standings/`) | — | Pure predicate over (games, picks, conference); needed by both UI and any future share-link validation |
| D-08 invalidation hash | Domain (`shared/domain/tiebreakers/`) | — | Derived from engine output; must not drift from the trace shape it hashes |
| Manual-decision storage + D-09 lifecycle | Client (`app/composables/`) | Browser localStorage | Mutable user state, not server state — `useStorage`, per CLAUDE.md's explicit ruling against `setQueryData` for picks |
| Orchestration seam (IN-02) | Client (`app/composables/useStandings.ts`) | — | Reactive glue only; zero domain logic |
| Championship card, markers, expandable reasoning, inline prompt | Client (`app/components/`) | — | Presentation of already-computed domain output |
| Schedule/teams data | CDN / Static | TanStack Query | Unchanged from Phase 2; `staleTime: Infinity` |

**Nothing in this phase belongs on a server tier.** FOUND-01 (fully static, no runtime API
key, no server routes) is unaffected — every computation is a synchronous pure function over
already-committed JSON plus localStorage.

## Standard Stack

### Core

**No new runtime or dev dependencies are required or recommended for this phase.**

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none added)* | — | — | Every capability this phase needs is already installed and already used in this repo |

Everything the phase needs is present: `vue@^3.5.41` (explicit `computed`/`ref`/`useId`
imports), `@vueuse/nuxt@14.4.0` (`useStorage` for manual decisions), `vitest@^4.1.10`,
`@vue/test-utils@^2.4.11`, `happy-dom@20.11.2`. `[VERIFIED: package.json, read this session]`

### Explicitly NOT needed

| Not needed | Why |
|------------|-----|
| Any hashing library (`object-hash`, `hash-sum`, `crypto-js`) | D-08's key is a change-detection fingerprint, not a security boundary. A 20-line FNV-1a over a canonical string is sufficient, synchronous, and dependency-free. See §Don't Hand-Roll for the one thing you *should* be careful about |
| `crypto.subtle.digest` (built-in) | **Async.** It cannot be called from a `computed()`, which is where the invalidation check has to live. This is a real trap — see Pitfall 4 |
| A graph/topological-sort library | The engine emits an already-ordered list of rank groups. There is no sort to perform, and Phase 5's own decision record warns that a comparator cannot express the grouping safely |
| `@nuxt/test-utils` `defineVitestProject` | Would let components use Nuxt auto-imports and Nuxt UI in tests, but adds a second vitest project and its config risk. Phase 5 set the precedent of explicit `vue` imports + plain HTML controls and it worked. See §Open Question 1 — planning must decide explicitly, and the recommendation is to keep the existing single project |
| Any state library (Pinia) | CLAUDE.md already ruled this out for the whole project |

**Version verification:** no packages to verify — nothing is being installed.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.**

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| *(none)* | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If planning later decides to add `@nuxt/test-utils`' `defineVitestProject` project (Open
Question 1), note the package is **already in `devDependencies` at `^4.1.0`** — that is a
config change, not an install, and no legitimacy gate is triggered.

## Architecture Patterns

### System Architecture Diagram

```
  picks (localStorage, reactive Ref)          games.json + teams.json (TanStack Query, staleTime:Infinity)
            │                                                    │
            └──────────────────────┬─────────────────────────────┘
                                   ▼
                          toOutcomes(games, picks)          ← untrusted-input boundary (existing, unchanged)
                                   │  Map<gameId, winnerId>
                                   ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  per conference:  deriveConferenceRecords → computeBaseOrdering │
        └──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ╔═══════════════════════════════════╗
                    ║   N-SEED COMMIT-AND-RESTART LOOP  ║   ← NEW (Pattern 1)
                    ║   while teams remain:             ║
                    ║     pool = defineTiedTeams(...)   ║
                    ║     resolveTop(pool) ─────────────╫──► resolved  → emit 1-team group
                    ║     commit; repeat                ║   └► exhausted → emit k-team group
                    ╚═══════════════════════════════════╝                  + TerminalReason
                                   │
                                   ▼  ConferenceRanking { groups: RankGroup[] }   ← NEW (Pattern 2)
                                   │  each group carries its OWN trace (Pattern 3)
                    ┌──────────────┴───────────────┬──────────────────────┐
                    ▼                              ▼                      ▼
        manual-decision store              computeStandings         championship card
        (useStorage, D-08 hash)            groups → rows 1..N       groups[0]/groups[1]
                    │  applied where hash matches   │  (union-find DELETED)      │  (D-12: never row order)
                    └──────────────┬────────────────┘                            │
                                   ▼                                             ▼
                          StandingsTable  ── expandable per group (D-15) ── inline prompt (D-17)
                                          ── marker (a) tiebreaker-decided
                                          ── marker (b) shared rank
```

### Recommended Project Structure

```
shared/domain/tiebreakers/
├── engine.ts          # + resolveConferenceRanking (N-seed loop); resolveTiedGroup REPAIRED
├── types.ts           # + RankGroup, ConferenceRanking; ChampionshipResult derived
├── invalidation.ts    # NEW — D-08 canonical serialization + synchronous hash
└── acc.ts, rules.ts, steps.ts, records.ts, baseOrdering.ts   # unchanged

shared/domain/standings/
├── computeStandings.ts    # union-find DELETED; consumes ConferenceRanking.groups
├── resolveTiebreakers.ts  # returns ConferenceRanking per conference
└── slateCompletion.ts     # NEW — D-07 predicate

app/composables/
└── useStandings.ts        # NEW — IN-02 seam: outcomes + ranking + standings + completion
└── useManualTiebreakers.ts # NEW — useStorage-backed decisions, D-08/D-09 lifecycle

app/components/
├── ChampionshipCard.vue   # NEW — TIE-07 / D-12 / D-13
├── TiebreakerReasoning.vue # NEW — TIE-05 / D-15 / D-16, and D-17's prompt terminus
└── StandingsTable.vue     # markers (D-10), per-group expansion, inline prompt
```

### Pattern 1: The N-seed loop resolves ONE top team per iteration

**What:** Replace `resolveConferenceChampionship`'s two hard-coded `resolveSlot` calls with a
loop that runs until every team is placed. The loop body is unchanged from today's
`resolveSlot`; only the termination condition and the accumulation change.

**When to use:** This is the whole of D-03/TIE-08.

**Critical:** the loop must consume **only the top team** of each resolution — never
`order[1..]`. That tail is exactly the raw-team-id sequence Pitfall 1 describes. Pattern 1 and
the Pitfall 1 repair are two halves of one change; doing the loop without the repair
propagates the defect to every rank in the table instead of hiding it in one shared rank.

```ts
// shared/domain/tiebreakers/engine.ts — sketch, structure verified against the
// existing resolveSlot closure (engine.ts:256-280)
export function resolveConferenceRanking(/* same args as resolveConferenceChampionship */): ConferenceRanking {
  const records = deriveConferenceRecords(conferenceGames, outcomes, teamIds)
  const baseOrdering = computeBaseOrdering(records)          // frozen once — Pitfall 4 of Phase 3
  const rules = CONFERENCE_RULES[conference]
  const overallWinCounts = conference === 'Big 12' ? deriveOverallWinCount(...) : undefined

  const groups: RankGroup[] = []
  const committed = new Set<TeamId>()

  while (committed.size < teamIds.size) {
    const pool = rules.defineTiedTeams(baseOrdering, records, committed)
    if (pool.length === 0) break                              // defensive; measured 0 occurrences

    if (pool.length === 1) {
      groups.push({ teams: pool, resolvedBy: 'sole-candidate', contestedWith: pool, trace: [] })
      committed.add(pool[0]!)
      continue
    }

    const result = resolveTop(pool, /* ...rules, records, committed... */)

    if (result.status === 'resolved') {
      groups.push({ teams: [result.order[0]!], resolvedBy: 'tiebreaker', contestedWith: pool, trace: result.trace })
      committed.add(result.order[0]!)
    } else {
      // Irreducible. The whole group shares one rank (D-05) until the user orders it.
      groups.push({ teams: result.tiedTeams, resolvedBy: 'unresolved', contestedWith: pool,
                    trace: result.trace, terminalReason: result.reason })
      for (const id of result.tiedTeams) committed.add(id)    // model B: advance past the group
    }
  }
  return { conference, groups }
}
```

**Termination:** `committed` grows by ≥1 every iteration and `defineTiedTeams` is contracted
to exclude every id in it, so the loop runs at most N times. Keep a defensive iteration cap
anyway — it costs nothing and the ACC has already proven this codebase can surprise you.

**Performance:** `[VERIFIED: measured]` **0.45 ms** for all four conferences' full N-seed
resolution including record derivation, on the committed 888-game slate. Phase 5's whole
standings recompute measured 0.88 ms median. N-seed is **not** a performance concern and needs
no memoization, debounce, or watcher — keep the plain `computed`, per Phase 5's D-13.

### Pattern 2: `ConferenceRanking` subsumes `ChampionshipResult`

**What:** The engine's output becomes an ordered list of rank groups. The championship
matchup is then a *read* of the first two groups, not a separate resolution.

```ts
export interface RankGroup {
  /** 1 team = a resolved rank. 2+ = irreducible; all share one rank number (D-05). */
  teams: readonly TeamId[]
  resolvedBy: 'sole-candidate' | 'tiebreaker' | 'manual' | 'unresolved'
  /** The pool this group was resolved OUT OF. Drives D-10 marker (a) — see Pattern 6. */
  contestedWith: readonly TeamId[]
  /** This group's own reasoning. NOT shared with any other group — see Pitfall 5. */
  trace: readonly TiebreakerCycle[]
  terminalReason?: TerminalReason
}

export interface ConferenceRanking {
  conference: ConferenceId
  groups: readonly RankGroup[]
}
```

**D-12 satisfied structurally:** `groups[0]` is seed 1 and `groups[1]` is seed 2. Because the
loop produces a single ordered sequence, seed 1 and seed 2 **cannot contradict each other** —
the contradiction in deferred bug #2 arose precisely from resolving the two seeds as two
independent procedures. Pattern 1 eliminates the class of defect, not just an instance.

Keep a thin `championshipFor(ranking)` helper returning `{ seed1, seed2 }` so the card never
indexes `groups` by hand, and delete `ChampionshipResult` or alias it — do not maintain both
shapes (DRY).

### Pattern 3: One trace per rank group, not one accumulator per conference

**What:** Today `resolveTiedGroup` threads a single mutable `cycles: TiebreakerCycle[]` array
down the entire recursion and every return hands back that same array object
(`engine.ts:67, 99, 143-153, 160`). For two seeds that was harmless. For N groups, D-15 needs
each expandable group to show *its own* reasoning.

**How:** Start a fresh `cycles` array per loop iteration in Pattern 1 and let it stay local to
that slot's resolution. Do not thread the conference-level accumulator through. See Pitfall 5
for the specific bug this avoids.

**TIE-05 coverage check** — every element the requirement names is already in the shape:

| TIE-05 element | Where it lives |
|---|---|
| the tied group | `TiebreakerCycle.tiedTeams` |
| the step applied | `StepOutcome.step` |
| each team's value at that step | `StepOutcome.values[].value` (`StepValue` union) |
| restart events | `TiebreakerCycle.outcome === 'restart'` + `removed[]` |

**D-16's "decisive step":** the last `StepOutcome` in the last cycle whose `separated === true`.
Everything before it is the "show full procedure" tail. No new data is needed.

### Pattern 4: The D-08 invalidation key — canonical string, synchronous hash

**What:** `hash(tied group membership, terminal step, each team's value at that step)`.

```ts
// shared/domain/tiebreakers/invalidation.ts
function canonicalDecisionKey(group: RankGroup): string {
  const terminalCycle = group.trace.at(-1)
  const terminalStep  = terminalCycle?.steps.at(-1)
  const ids = [...group.teams].sort((a, b) => a - b)          // sort: Set/array order is not stable input
  const values = ids.map((id) => {
    const v = terminalStep?.values.find(x => x.teamId === id)?.value
    if (!v) return `${id}:none`
    // Encode the DISCRIMINANT plus every field of that variant — a StepValue
    // whose kind changed but whose winPct coincided must not hash equal.
    switch (v.kind) {
      case 'record':        return `${id}:record:${v.wins}:${v.losses}:${v.winPct.toFixed(6)}`
      case 'headToHead':    return `${id}:h2h:${v.result}`
      case 'indeterminate': return `${id}:indet`
    }
  })
  return `v1|${ids.join(',')}|${terminalStep?.step ?? 'none'}|${values.join('|')}`
}

/** FNV-1a. Change detection only — NOT a security boundary. Synchronous by requirement. */
export function decisionHash(group: RankGroup): string {
  const s = canonicalDecisionKey(group)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}
```

**Prefix the version (`v1|`).** If the trace shape or the step list ever changes, bumping the
prefix invalidates every stored decision at once, which is the correct and safe behaviour.

**Recommendation on Claude's-discretion item "stored alongside or recomputed on read":**
**recompute on read.** Storage then holds only `{ conference: { hash: orderedTeamIds } }`, a
lookup is `decisions[conf][decisionHash(group)]`, and a stale entry simply never matches — the
"invalidated, not silently misapplied" guarantee of TIE-06 becomes structural rather than
enforced by a comparison someone could forget. Recomputation cost is negligible at the
measured group counts.

**Note on discrimination:** for the ACC the terminal step is always `head-to-head` and the
values are almost always the same `{kind:'headToHead', result:'mixed'|'no-common-games'}`, so
the *values* component of the key contributes near-zero entropy there. Group membership does
all the work. That is fine — combined with §Correction 1 (the ACC is immune to the D-07
non-conference exposure), the ACC needs no more than membership keying anyway.

### Pattern 5: `computeStandings` deletes its union-find

**What:** `rankComponents` (`computeStandings.ts:185-237`) is a union-find over the
equivalence closure of "same seed group" ∪ "identical conference W-L". **D-01 and D-04's
reversal remove both relations' reason to exist.** The engine now emits the partition
directly, in order.

```ts
// Replaces resolvedSeedGroups + seedPlacements + rankComponents + orderedComponents
const ordered: StandingsTeam[] = []
for (const group of ranking.groups) {
  const rank = ordered.length + 1                    // standard competition ranking, unchanged
  for (const teamId of group.teams) {
    ordered.push({ ...rowFor(teamId), rank, isTied: group.teams.length > 1 })
  }
}
```

This **preserves Phase 5's load-bearing property** — "row order is built constructively, never
with a comparator, because a comparator cannot express an equivalence closure without risking
non-transitivity" — and does so more strongly: there is no longer any closure to express.
`[VERIFIED: 05-CONTEXT.md code_context, computeStandings.ts:269-286]`

**Fallback path:** `resolveAllConferences` catches per-conference throws and omits the
conference; `computeStandings` currently degrades to record ordering. Keep that, but note the
degraded path now has to produce 1..N too — use conference win pct → wins → losses → school →
id, each team its own rank group, and mark nothing as tiebreaker-decided.

**Fold in WR-06 here:** tighten `StandingsResult` to
`Readonly<Record<ConferenceId, readonly StandingsTeam[]>>`. The ripple is known and bounded:
`StandingsSidebar`'s prop type, `StandingsTable`, and the week page's `{}` not-computed-yet
sentinel (`app/pages/week/[week].vue:111`), which the new type makes illegal — the IN-02
composable is the natural place to hold `undefined` instead of `{}`.

### Pattern 6: Deriving the two D-10 markers from engine output, not from records

**Marker (a) — "separated only by tiebreaker":** `group.contestedWith.length > 1 &&
group.resolvedBy === 'tiebreaker'`. This is the engine's own statement that the rank was
earned against other candidates rather than by standing alone.

**Do not derive marker (a) by comparing adjacent rows' W-L.** That reimplements a tie
predicate in the display layer, which is exactly the CR-01 defect Phase 5 spent a whole plan
repairing: *"the standings layer's ONLY tie definition is the engine's OUTPUT."*
`[VERIFIED: computeStandings.ts:88-113, STATE.md decision log]` Adjacent-record comparison
also gets the ACC wrong by construction — the ACC ties teams with *different* records.

**Marker (b) — "genuinely unresolvable":** `group.teams.length > 1`, i.e. the existing
`StandingsTeam.isTied`. Already computed; only the visual treatment is new.

Both markers must come from the neutral shell palette with no team color (D-11), and both
need a non-color affordance for screen readers — a `<caption>`/`sr-only` phrase or
`aria-describedby` on the rank cell, since a purely visual band conveys nothing to assistive
tech. (The user declined *visual* colorblind redundancy at Q5; that is not the same as
declining an accessible name, and TIE-05's whole premise is that the reasoning is available.)

### Anti-Patterns to Avoid

- **Extending `resolveConferenceChampionship` to three, four, N explicit seed calls.** The
  seed1/seed2 contradiction is caused by independent per-slot resolutions; N independent
  resolutions multiply it. Use one sequential loop with one growing `committed` set.
- **Consuming `result.order[1]` and beyond.** See Pitfall 1. Only `order[0]` is ever a
  procedure-derived answer.
- **Inferring the championship matchup from `standings[conf][0]` and `[1]`.** Explicitly
  forbidden by D-12, and now unnecessary — `groups[0]`/`groups[1]` is a direct read.
- **Prompting on `Object.keys(picks).length === games.length`.** D-07 is per-conference and
  conference-games-only; a global gate would never fire for a user who only cares about the SEC.
- **Storing manual decisions in the TanStack Query cache.** CLAUDE.md forbids this explicitly
  for picks and the same reasoning applies verbatim: client state, not server state.
- **Re-deriving W-L anywhere.** `deriveConferenceRecords` is the single tallier (CLAUDE.md DRY).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Win/loss tallying for the new completion predicate or reasoning display | A second counter over `games` | `deriveConferenceRecords` (Phase 3) | CLAUDE.md DRY constraint, stated explicitly for this exact function |
| "Which games belong to this conference" | A `homeTeam.conference === awayTeam.conference` check | `conferenceGamesFor` (`computeStandings.ts:67`) | DATA-06: `conferenceGame` is trusted from CFBD and never re-derived; one 2026 game is same-conference but flagged non-conference |
| Which conferences are P4, and in what order | A literal array | `P4_CONFERENCES` (= `Object.keys(CONFERENCE_RULES)`) | Already the single definition; frozen and `readonly` for a reason (WR-05) |
| Deciding whether two teams are "tied" for a marker | Comparing `confRecord` across adjacent rows | `RankGroup.teams.length` / `contestedWith.length` | This *is* CR-01. The display layer must never own a tie predicate |
| Validating picks before they reach the engine | A new guard in the composable | `toOutcomes` (`computeStandings.ts:40`) | Already the untrusted-input boundary (T-05-SC); drops unknown gameIds and non-participant winners |
| Deterministic season generation for the harness | A new PRNG or `Math.random()` | The existing `mulberry32` in `standings-tiebreaker-agreement.test.ts:218` | Same seeds ⇒ numbers comparable to Phase 5's; a new generator silently invalidates every prior measurement |
| Hashing the D-08 key | `crypto.subtle.digest` | 20 lines of FNV-1a | Web Crypto is async and unusable from `computed()`; see Pitfall 4 |

**Key insight:** almost every "don't hand-roll" item here is a *second implementation of
something this repo already has exactly one of*. Phase 5's single largest defect (CR-01) was
precisely a duplicate tie predicate that drifted from the engine. The DRY constraint in
CLAUDE.md is not stylistic in this codebase — it is the mechanism that keeps the standings
math and the tiebreaker math from disagreeing.

## Common Pitfalls

### Pitfall 1: `order[0]` is not always a procedure-derived answer — 19.2% of the time it is a database-id sort

**What goes wrong:** `resolveTiedGroup` returns `[...winners, ...restResult.order]`
(`engine.ts:159`). When a separating step's **top bucket holds more than one team**, all of
them are recorded as `seeded` and their internal order comes from `partitionByStepValue`'s
`teamIds.sort((a, b) => a - b)` (`steps.ts:296`) — a raw CFBD team-id sort. `order[0]` is then
whichever tied team happens to have the smaller database id.

**Measured frequency** `[VERIFIED: measured, 100 fully-picked seasons]`:

| Conference | Contested slots | Top bucket unseparated | Rate |
|---|---|---|---|
| SEC | 1,006 | 212 | **21.1%** |
| Big Ten | 1,187 | 258 | **21.7%** |
| Big 12 | 1,005 | 234 | **23.3%** |
| ACC | 476 | 0 | 0.0% |
| **Total** | **3,674** | **704** | **19.2%** |

Real example from the run: `Big Ten: pool [Indiana, Maryland, Rutgers, Penn State, Oregon] →
step 'common-opponents' top bucket holds 3 UNSEPARATED teams [Maryland, Penn State, Oregon];
order[0] = Maryland chosen by raw team id.`

**Why it happens:** the engine treats "this step separated *someone*" as "the top bucket is
resolved." For a two-seed champion+runner-up read that was usually survivable and the
standings layer collapsed the disputed teams onto one shared rank, so no user could see it
(deferred-items.md measured only 7 of 649 conferences as *visibly* contradictory).

**Why Phase 6 makes it critical:** D-01 removes the shared rank. Each of those 704 slots
becomes a specific displayed rank ordering, and D-10(a) would attach a "decided by
tiebreaker" marker to it. The app would be affirmatively asserting a tiebreaker result for a
rank decided by database id. Given PROJECT.md's core value — *"if the standings math or the
tiebreaker resolution is wrong, nothing else about the app matters"* — this is the phase's
highest-severity item.

**How to avoid:** when a separating step's top bucket holds >1 team, **restart the procedure
on that bucket** rather than emitting it in id order. If the bucket cannot be separated
internally, it is genuinely irreducible → `needsUserInput` for that bucket. This is
deferred-items.md's own first candidate repair ("do not present an unseparated bucket as an
ordered sequence"), and it is what the `resolveTop` sketch in Pattern 1 does.

**Measured cost of the repair:** SEC 0.04 → 0.10, Big Ten 0.10 → 0.19, Big 12 0.01 → 0.01
manual decisions per season. Tiny — and the increase is precisely the set of ranks that were
previously being faked.

**Warning signs:** any assertion of the form `expect(order[1]).toBe(...)`; any consumer
reading past `order[0]`.

### Pitfall 2: the recursion guard at `engine.ts:136` rejects legal ACC behaviour — and it is not needed for termination

**What goes wrong:**

```ts
const nextTiedTeams = defineTiedTeams(baseOrdering, records, nextAlreadyCommitted)
if (nextTiedTeams.length >= tiedTeams.length) throw new Error(/* infinite recursion guard */)
```

The guard assumes a restart must yield a *strictly smaller* pool. For the ACC that assumption
is false: `defineAccTiedTeams` re-anchors on the new best-win-pct group and pulls in fresh
alternate-schedule teams, so the redefined pool is a **different set**, freely larger.

**Measured, with the guard messages captured** `[VERIFIED: measured]`:

```
seed 7:  nextTied=3 (Syracuse, Boston College, Georgia Tech)      >= tied=2 (Clemson, Syracuse)
seed 8:  nextTied=5 (Boston College, California, Miami,
                     NC State, Wake Forest)                        >= tied=2 (Syracuse, Boston College)
seed 13: nextTied=3 (NC State, Pittsburgh, Georgia Tech)           >= tied=3 (Florida State, NC State, Pittsburgh)
```

Note seed 8: two teams become five, and they are *not a superset* — Syracuse is gone. This is
exactly the ACC's published language, *"the tiebreaker will restart, including the definition
of tied teams,"* working correctly and being rejected.

**Why it happens:** the guard encodes the wrong termination invariant. Termination is already
guaranteed by a different mechanism the code's own docblock states (`engine.ts:24-30`):
`alreadyCommitted` grows by at least one team on every restart (`winners` is non-empty), and
`defineTiedTeams` is contracted to exclude every id in it, so the selectable universe strictly
shrinks. Recursion depth is bounded by the team count regardless of pool size.

**Severity escalation at N seeds** `[VERIFIED: measured]`: **44 of 100 fully-picked ACC
seasons** trip the guard under the literal pick-top loop, versus the 12-of-1200 (~4% of ACC)
Phase 5 measured at two seeds — roughly an 11x amplification, because every additional rank is
another chance to trip. In production a trip means `resolveAllConferences` omits the entire
conference and the ACC silently falls back to plain record order.

**How to avoid:** delete the size guard; keep the `rest.length >= tiedTeams.length` guard
above it (that one *is* a real invariant) and add a defensive depth cap.

**Verified result of the repair** `[VERIFIED: measured]`: **44/400 → 0/400** conference-seasons
trip, fully picked; **13/400 → 0/400** mid-season. No runaway recursion. Performance unchanged
(0.44 ms → 0.43 ms).

**Important caveat for planning:** the repair **raises** the measured ACC decision count
(6.91 → 9.23 under model A), because the guard trip was previously aborting the loop and
hiding the remaining unresolvable ranks. The pre-repair numbers understate the problem; do not
read the increase as a regression.

### Pitfall 3: D-09's discard-on-incompletion is cheap in three conferences and brutal in the ACC

**What goes wrong:** a user with a complete ACC slate has answered ~3.8 prompts covering ~14
of 17 teams. Clearing or flipping **one** ACC conference pick makes the slate incomplete,
which per D-09 discards **all** of that conference's decisions. Re-completing re-prompts every
one of them from scratch — and D-17 provides no announcement, so the user's ACC table silently
reverts to 6.5 distinct ranks across 17 teams with no explanation.

**Why it happens:** D-09 was chosen for its clean two-state machine on the assumption of ~1
decision per conference. That assumption holds for the SEC/Big Ten/Big 12 and fails 4x for the ACC.

**How to avoid:** this is a user decision, not an implementation choice — surface it with the
ACC number when escalating per §The Measurement. If D-09 stands unchanged, the implementation
is trivial (drop the conference's key when the predicate goes false). If the user softens it,
the "retain, suspend, re-apply on hash match" option from Q3 is the contained alternative and
D-08's hash already provides the matching mechanism.

**Warning signs:** UAT reporting "my ACC standings keep resetting."

### Pitfall 4: the D-08 hash cannot be async, and `computed()` will not tell you

**What goes wrong:** `crypto.subtle.digest` returns a Promise. Called from inside a `computed`,
it yields a `Promise` object, and `Promise !== Promise` on every recompute — so every stored
decision appears invalidated on every render, or (worse) a `.then()` that mutates a ref creates
an infinite render loop. The failure is silent: no type error, no console message, just
manual decisions that never stick.

**How to avoid:** use the synchronous FNV-1a in Pattern 4. There is no security requirement
here — the key detects change, it does not resist forgery.

**Warning signs:** a decision that re-prompts immediately after being answered; a `computed`
that re-evaluates without any dependency changing.

### Pitfall 5: the shared `cycles` array makes every group's trace show every other group's reasoning

**What goes wrong:** `resolveTiedGroup` accepts `cycles: TiebreakerCycle[] = []` and threads
**the same array instance** through the whole recursion, pushing into it at
`engine.ts:99, 114, 173` and returning it (or `restResult.trace`, which is the same object) at
every exit. Within one slot that is intentional and correct. But if the N-seed loop reuses one
accumulator across iterations, group 7's expandable reasoning renders groups 1–6's steps too —
and D-16's "lead with the decisive step" would pick the wrong cycle, because `trace.at(-1)`
would be some later group's.

This also silently corrupts the D-08 key, which reads `trace.at(-1)`.

**How to avoid:** fresh `cycles: []` per loop iteration (Pattern 3). Assert it in a test:
each `RankGroup.trace` must reference only team ids drawn from that group's `contestedWith`.

**Warning signs:** an expanded 8th-place group showing a head-to-head between two teams that
are not in it; a `trace` array whose length grows monotonically down the table.

### Pitfall 6: D-13's candidate-set copy does not survive the ACC

**What goes wrong:** D-13 specifies `Georgia vs. one of: Duke / Miami / Clemson`. In the ACC
the unresolvable group at seed 2 has a **measured mean of 3.7 teams and a maximum of 10**
(13 mid-season). `Syracuse vs. one of: Boston College / California / Clemson / Duke /
Florida State / Georgia Tech / Louisville / Miami / NC State / Wake Forest` is not a card, it
is a paragraph — and D-14 forbids the "TBD + disclosure" fallback that would have absorbed it.

**Why it happens:** D-13 was chosen against an implicit small-group mental model, before the
N-seed group sizes were measured.

**How to avoid:** keep D-13's named-candidate-set as the design, and add a **purely
presentational** overflow rule inside Claude's discretion on layout — e.g. name the first
*k* and render `+N more` with the full list reachable via the group's D-15 expansion, which is
already the designated home for group detail. This does not reverse D-13 (candidates are named,
not replaced by a placeholder) and does not reintroduce D-14's declined distinction. If
planning judges that it *does* stretch D-13, escalate it alongside the ACC number rather than
deciding unilaterally.

### Pitfall 7: the vitest project has no Nuxt auto-imports, and the new components need state

**What goes wrong:** `vitest.config.ts` registers only `@vitejs/plugin-vue` — no Nuxt module,
no auto-import plugin. A component using `ref`/`computed` without an explicit `vue` import, or
any `U*` Nuxt UI component, throws at mount. Phase 5 hit this twice
(`deferred-items.md` class E: `PickProgress` and `PickProgressWeek`, 21 tests) and
`StandingsSidebar` hand-rolls its toggle for exactly this reason.

D-15's expandable group and D-17's inline prompt both need local state and interactive
controls, so they are squarely in the blast radius.

**How to avoid:** explicit `import { computed, ref, useId } from 'vue'`, plain `<button>` /
`<table>` markup, relative component imports (`./TiebreakerReasoning.vue`), no Nuxt UI. This
is the established precedent and needs no config change. See Open Question 1 for the
alternative and why it is not recommended.

**Warning signs:** `ReferenceError: computed is not defined` at mount; a component that works
in `pnpm dev` and throws in `pnpm test`.

### Pitfall 8: manual decisions read from localStorage are untrusted input

**What goes wrong:** a hand-edited `localStorage` entry can name team ids that are not in the
conference, or list the same team twice, or carry a group of 40. Applied blindly to
`RankGroup.teams` it can inject a phantom standings row or duplicate a team across two ranks.

**How to avoid:** validate on read at the composable boundary, exactly as `toOutcomes` does for
picks — a stored decision applies only if its id set, as a set, **equals** the live group's id
set. Since the hash already keys on sorted membership, a set-equality check on top is two
lines and makes the guarantee structural. Drop silently and fall back to the unresolved group
(matching `toOutcomes`' precedent: a corrupt entry costs that one decision, not the page).
Note that PICK-08's corruption-preservation behaviour is Phase 4's contract for *picks*;
decide explicitly whether manual decisions get the same treatment or are simply dropped
(D-09 already makes them ephemeral, which argues for dropping).

## Code Examples

### The measurement harness — extract, don't duplicate

The three helpers already exist inline at
`tests/domain/standings/standings-tiebreaker-agreement.test.ts:209-240`. Move them to
`tests/helpers/generated-seasons.ts` and import from both places.

```ts
// tests/helpers/generated-seasons.ts — moved verbatim from the Phase 5 test
export function mulberry32(seed: number): () => number { /* engine.ts-adjacent, unchanged */ }
export function generatePicks(games, random, throughWeek?): Record<number, number> { /* unchanged */ }
export function readSlate(): { games: Game[], teams: Team[] } { /* readJson x2 */ }
```

```ts
// tests/domain/tiebreakers/n-seed-decision-rate.test.ts
// Locks in the measurement so a future engine change cannot regress it silently.
import { describe, it, expect } from 'vitest'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'
import { resolveConferenceRanking } from '../../../shared/domain/tiebreakers/engine'

describe('N-seed manual-decision rate over 100 fully-picked generated seasons', () => {
  const { games, teams } = readSlate()

  it('never trips a recursion guard', () => {
    // Pitfall 2's repair. 44/400 before, 0/400 after — measured 2026-08-15.
    const failures: string[] = []
    for (let seed = 1; seed <= 100; seed++) { /* resolve all four; collect throws */ }
    expect(failures).toEqual([])
  })

  it('keeps SEC / Big Ten / Big 12 at or below 1 decision per season on average', () => {
    // Measured 0.10 / 0.19 / 0.01. A generous ceiling, so the test pins the
    // REGIME (quiet) rather than the exact figure, which legitimate step-order
    // corrections could move.
    expect(meanDecisions('SEC')).toBeLessThan(1)
    expect(meanDecisions('Big Ten')).toBeLessThan(1)
    expect(meanDecisions('Big 12')).toBeLessThan(1)
  })

  it('documents the ACC as the known-high conference', () => {
    // Measured 3.84 (model B). Asserted as a RANGE so the number is visible in
    // the suite and a silent 3x drift fails loudly.
    expect(meanDecisions('ACC')).toBeGreaterThan(2)
    expect(meanDecisions('ACC')).toBeLessThan(6)
  })
})
```

### The D-07 completion predicate

```ts
// shared/domain/standings/slateCompletion.ts
import { conferenceGamesFor } from './computeStandings'

/**
 * D-07: a conference's slate is complete when every game in which BOTH teams
 * belong to that conference is picked. Non-conference games are excluded by
 * decision, not by oversight — see 06-CONTEXT.md D-07's accepted exposure and
 * 06-RESEARCH.md's correction narrowing it to the Big 12's total-wins step.
 *
 * Uses conferenceGamesFor (the single definition, which trusts CFBD's
 * conferenceGame flag per DATA-06) rather than comparing team conferences.
 */
export function isConferenceSlateComplete(
  games: readonly Game[],
  confTeamIds: ReadonlySet<TeamId>,
  picks: Readonly<Record<number, number>>
): boolean {
  return conferenceGamesFor(games, confTeamIds).every(g => g.id in picks)
}
```

Slate sizes `[VERIFIED: computed from public/data/2026/games.json]` — SEC 72 conference games,
Big Ten 81, Big 12 72, ACC 74 (of 888 total). So the D-07 gate is reachable after ~8% of the
season's picks, which is what makes it a usable gate rather than a theoretical one.

### The IN-02 composable seam

```ts
// app/composables/useStandings.ts — closes IN-02; toOutcomes derived ONCE
export function useStandings(season: number) {
  const { data: teams } = useTeams()
  const { data: games } = useGames()
  const picks = usePicksStorage(season)
  const { decisions } = useManualTiebreakers(season)

  const slate = computed(() => games.value?.games)
  const ready = computed(() => Boolean(slate.value && teams.value))

  // ONE readiness guard, one sentinel — the two divergent guards WR-06/IN-02
  // flagged in app/pages/week/[week].vue:103-113 collapse into this.
  const rankings = computed(() =>
    ready.value ? resolveAllConferences(slate.value!, teams.value!, picks.value, decisions.value) : undefined
  )
  const standings = computed(() =>
    ready.value ? computeStandings(slate.value!, teams.value!, picks.value, rankings.value) : undefined
  )
  const slateComplete = computed(() => /* per-conference D-07 map */)

  return { standings, rankings, slateComplete, picks }
}
```

Note `standings` returns `undefined`, not `{}` — that is what makes WR-06's tightened
`StandingsResult` type legal.

## State of the Art

| Old approach (Phase 5) | Current approach (Phase 6) | Why it changed |
|---|---|---|
| Two independent seed resolutions | One sequential N-seed loop | Independent resolutions are the *cause* of the seed1/seed2 contradiction |
| Rank = union-find closure of "same seed group" ∪ "identical W-L" | Rank = the engine's emitted group partition | D-01/D-04 reversal removes both relations; the closure has nothing left to close over |
| `isTied` means "displayed on the same rank number" | `isTied` means "the procedure could not separate these" | D-05's stronger claim; the two coincided in Phase 5 only because ranks were shared |
| Ties need no badge (Phase 5 D-05) | Two distinct markers (D-10) | Falsified on ~1% of tables: `1 Boston College 6-2` above `1 Duke 7-2` |
| Trace is one array per conference | Trace is one array per rank group | D-15 renders reasoning per group |

**Deprecated by this phase:** `ChampionshipResult` (subsumed by `ConferenceRanking`);
`rankComponents` / `seedPlacements` / `resolvedSeedGroups` / `orderedComponents` in
`computeStandings.ts`; the `nextTiedTeams.length >= tiedTeams.length` guard at `engine.ts:136`.

## Runtime State Inventory

*Not a rename/refactor phase, but this phase introduces new persisted state and changes the
meaning of existing display state. Recorded for completeness.*

| Category | Items found | Action required |
|---|---|---|
| Stored data | **NEW** — manual tiebreaker decisions in localStorage, season-namespaced. No existing key changes meaning. Phase 4's picks key and Phase 5's auto-filled key are untouched | Add one key; validate on read (Pitfall 8) |
| Live service config | None — no backend, no external service (FOUND-01) | None |
| OS-registered state | None | None |
| Secrets / env vars | None — no runtime API key exists in this app by constraint | None |
| Build artifacts | None. `public/data/2026/*.json` is unchanged by this phase; `scheduleHash` is unaffected | None |
| **In-memory / type contracts** | `StandingsResult` tightens (WR-06); `ChampionshipResult` is replaced. Both are compile-time, caught by `pnpm typecheck` | Update `StandingsSidebar` props, `StandingsTable`, week page sentinel |

**Migration note:** because manual decisions are new *and* D-09 makes them ephemeral, there is
no stored-data migration to write. A user upgrading simply has no decisions yet.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | Test + harness execution | ✓ | 24.12.0 | — |
| pnpm | All scripts | ✓ | 11.20.0 (`packageManager`) | — |
| vitest | All gates | ✓ | ^4.1.10 | — |
| tsx | Running the measurement harness standalone | ✓ | ^4.23.12 | Run it as a vitest test instead (recommended anyway) |
| `public/data/2026/games.json` | The harness and every test | ✓ | 888 games, committed | — |
| `public/data/2026/teams.json` | Same | ✓ | 67 P4 teams across 4 conferences, committed | — |
| happy-dom | Component tests | ✓ | 20.11.2 | — |
| Browser + contrast checker | D-11 marker contrast verification | ✗ (human task) | — | **None** — same class as Phase 5's open UAT item; must be a `checkpoint:human-verify` task, not an automated assertion |

**Missing with no fallback:** WCAG contrast verification of the two D-10 markers requires a
human in a live browser, because Nuxt UI injects the `--ui-color-neutral-*` ramp at runtime and
a static audit is not feasible (Phase 5 tried and produced a bogus 13.89:1). D-11's
neutral-only palette reduces this to **two markers checked once in two themes** rather than
~135 team pairs — which is exactly why D-11 was chosen. Plan it as one small human checkpoint.

**Everything else needed is present.** No installs, no service dependencies.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | vitest 4.1.10 + @vue/test-utils 2.4.11 |
| Config file | `vitest.config.ts` (single project, `happy-dom` global, no Nuxt plugin) |
| Quick run command | `pnpm exec vitest run tests/domain/` |
| Full suite command | `pnpm test` (= `vitest run`) |
| Coverage gates | `shared/domain/tiebreakers/**` 90% all metrics; `shared/domain/standings/**` 85% |

**Pre-existing gate debt:** `shared/domain/tiebreakers/**` currently sits at **87.87% branches
vs a 90% threshold** and has been failing since before Phase 5. It is not in any gate the
project actually runs (`pnpm test` has no `--coverage`). This phase touches that exact
directory heavily, so **close it here** — deferred-items.md explicitly assigns it to "whoever
next works in `shared/domain/tiebreakers/`."

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | Exists? |
|---|---|---|---|---|
| TIE-08 | N-seed loop assigns every team a rank; no team unplaced, no duplicate ranks | unit | `vitest run tests/domain/tiebreakers/n-seed-ranking.test.ts` | ❌ Wave 0 |
| TIE-08 | Loop never trips a recursion guard over 100 generated seasons (Pitfall 2) | property | `vitest run tests/domain/tiebreakers/n-seed-decision-rate.test.ts` | ❌ Wave 0 |
| TIE-08 | No rank is decided by team id — every `resolvedBy:'tiebreaker'` group's `contestedWith` was separated by a real step (Pitfall 1) | property | same file | ❌ Wave 0 |
| TIE-08 | Unresolvable groups share a rank; `isTied` true exactly when `teams.length > 1` | unit | `vitest run tests/domain/standings/computeStandings.test.ts` | ⚠️ exists, must be rewritten for D-01 |
| TIE-08 | D-07 predicate: true iff every conference game picked; unaffected by non-conference picks | unit | `vitest run tests/domain/standings/slateCompletion.test.ts` | ❌ Wave 0 |
| TIE-05 | Each group's trace contains only its own teams (Pitfall 5) | unit | `vitest run tests/domain/tiebreakers/trace-isolation.test.ts` | ❌ Wave 0 |
| TIE-05 | Decisive step = last separating StepOutcome; full trace reachable | unit | same file | ❌ Wave 0 |
| TIE-05 | Expanded group renders tied group, step, per-team values, restart events | component | `vitest run tests/components/TiebreakerReasoning.test.ts` | ❌ Wave 0 |
| TIE-06 | Hash changes when membership changes / terminal step changes / any value changes; stable otherwise | unit | `vitest run tests/domain/tiebreakers/invalidation.test.ts` | ❌ Wave 0 |
| TIE-06 | A stored decision whose id set differs from the live group is dropped, not applied (Pitfall 8) | unit | `vitest run tests/composables/useManualTiebreakers.test.ts` | ❌ Wave 0 |
| TIE-06 | D-09: decisions discarded when the slate stops being complete | unit | same file | ❌ Wave 0 |
| TIE-07 | Card reads `groups[0]`/`groups[1]`, never row order (D-12) | component | `vitest run tests/components/ChampionshipCard.test.ts` | ❌ Wave 0 |
| TIE-07 | Resolved seed named even when the other is pending (D-13) | component | same file | ❌ Wave 0 |
| TIE-07 | One pending presentation regardless of `TerminalReason` (D-14) | component | same file | ❌ Wave 0 |
| D-10 | Marker (a) on tiebreaker-decided ranks; marker (b) on shared ranks; both distinguishable | component | `vitest run tests/components/StandingsTable.test.ts` | ⚠️ exists, extend |
| D-11 | Zero team-color classes in either marker | unit (grep-style assertion) | same file | ❌ Wave 0 |
| — | Marker contrast, both themes, WCAG AA | **manual** | `checkpoint:human-verify` | N/A — see §Environment Availability |
| — | Pick → recompute → DOM chain | **manual** | `.planning/phases/04-picks-persistence/04-UAT.md` | Deliberately uncovered (see Open Question 1) |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run tests/domain/` — pure logic, sub-second
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` green **and** `pnpm exec vitest run --coverage` meeting both
  directory thresholds (closing the pre-existing 87.87% branch gap) **and** `pnpm lint` **and**
  `pnpm typecheck` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/helpers/generated-seasons.ts` — extract `mulberry32` / `generatePicks` / `readSlate` from the Phase 5 test (DRY; do not write a second PRNG)
- [ ] `tests/domain/tiebreakers/n-seed-decision-rate.test.ts` — the committed measurement (TIE-08, Pitfalls 1 & 2)
- [ ] `tests/domain/tiebreakers/n-seed-ranking.test.ts` — loop correctness (TIE-08)
- [ ] `tests/domain/tiebreakers/trace-isolation.test.ts` — TIE-05, Pitfall 5
- [ ] `tests/domain/tiebreakers/invalidation.test.ts` — TIE-06, D-08
- [ ] `tests/domain/standings/slateCompletion.test.ts` — D-07
- [ ] `tests/composables/useManualTiebreakers.test.ts` — TIE-06, D-09, Pitfall 8
- [ ] `tests/components/ChampionshipCard.test.ts` — TIE-07
- [ ] `tests/components/TiebreakerReasoning.test.ts` — TIE-05, D-15/D-16/D-17
- [ ] Rewrite the D-04 assertions in `tests/domain/standings/computeStandings.test.ts` and `standings-tiebreaker-agreement.test.ts` — **they currently assert the behaviour this phase reverses.** Clause (iii) of `violationsFor` asserts *"two rows with identical conference W-L must carry the same rank"*, which D-01 makes false by design. Rewriting these is a required, deliberate task — not a test fixing itself.
- [ ] Framework install: **none required**

## Security Domain

**ASVS Level 1**, `security_enforcement: true`. This is a static, no-backend, no-auth,
single-user-per-browser app; most categories are structurally out of scope.

### Applicable ASVS Categories

| Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | No accounts by constraint (SCEN-05); nothing to authenticate |
| V3 Session Management | no | No sessions, no cookies, no server |
| V4 Access Control | no | All data is public and client-side; no multi-tenant boundary exists |
| V5 Input Validation | **yes** | Manual decisions read from localStorage are user-editable untrusted input. Validate at the composable boundary by **set equality against the live group's ids** before applying (Pitfall 8), mirroring `toOutcomes`' existing silent-drop discipline. Cap the stored object's size |
| V6 Cryptography | **no (and do not add any)** | The D-08 hash is change detection, not a security control. Using a crypto hash here would imply a threat model that does not exist, and `crypto.subtle` is async (Pitfall 4). FNV-1a is correct |
| V7 Error Handling / Logging | **yes** | Preserve the T-05-03-03 rule already in `resolveTiebreakers.ts:78`: log the conference name and error object only — **never** picks, storage keys, or share codes |
| V12 Files / Resources | no | No upload, no file handling |
| V13 API | no | No API |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Hand-edited localStorage injects a phantom or duplicate team into a rank group | Tampering | Set-equality validation against the live group; silent drop on mismatch (Pitfall 8) |
| Hand-edited localStorage carries an enormous decisions object | DoS | Cap entry count and group size on read; the engine already bounds real groups at ≤ conference size |
| A stale manual decision is applied after inputs changed, misrepresenting the ranking | Tampering / Repudiation | This is precisely TIE-06 + D-08. Recompute-on-read (Pattern 4) makes non-application structural |
| Diagnostic logging leaks a user's full pick set | Information Disclosure | Existing WR-03 / T-05-03-03 rule; extend it verbatim to any new `console.warn` in this phase |
| Engine throw blanks the whole standings panel | DoS (self-inflicted) | Existing per-conference try/catch isolation in `resolveAllConferences`; the N-seed loop must stay inside it |

**Out of scope but adjacent:** SHARE-01 will need to encode manual tiebreaker overrides into
the share link, and SHARE-04 requires validating those as untrusted input. Designing the
decisions storage shape as a flat `{ conference: { hash: teamId[] } }` map keeps that Phase 8
work cheap. Not this phase's requirement — just do not design something hostile to it.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Restarting the procedure on an unseparated top bucket is the correct reading of the published rules (vs. e.g. treating the bucket as jointly seeded) | Pitfall 1 | Ranks within such buckets would be ordered by a different rule. Mitigated: it matches deferred-items.md's own first candidate repair, and *any* defined procedure beats the current team-id sort. **Should be sanity-checked against one conference's PDF during planning** |
| A2 | The measured decision rates generalize from uniform-random 50/50 picks to real user picks | The Measurement | Real users pick favourites, producing more lopsided records and *fewer* ties — so these figures are likely a **pessimistic upper bound**. Direction of error is favourable, magnitude unknown |
| A3 | Model B (order the whole group in one interaction) is acceptable under D-02's "resolve the top team, commit it, re-run" wording | The Measurement | D-02 describes the *engine* loop, which is unchanged; only the human's commit granularity differs. Low risk, but it is an interpretation — confirm when escalating the ACC number |
| A4 | ACC `twoTeamSteps`/`multiTeamSteps` correctly contain only `head-to-head` | The Measurement | If the real policy has a computable step Phase 3 omitted, every ACC figure improves substantially. Cross-checked against theacc.com and ESPN reporting of the July 2026 amendment, which describe exactly H2H → Team Success Ranking → draw. **STATE.md still carries a LOW-confidence blocker on ACC step order** — see Open Question 2 |
| A5 | 100 seasons per condition is a sufficient sample | The Measurement | Effect sizes are enormous (0.10 vs 3.84), so sampling error cannot flip the conclusion. Matches Phase 5's existing sample size for comparability |
| A6 | Removing the size guard introduces no pathological recursion on inputs not covered by 200 generated seasons | Pitfall 2 | Mitigated by the monotonic-`alreadyCommitted` termination argument plus a defensive depth cap |

## Open Questions

1. **Do the new interactive components get a `nuxt`-environment vitest project?**
   - *Known:* the single plain project has no auto-imports (Pitfall 7); Phase 5 worked around it successfully; `@nuxt/test-utils@^4.1.0` is already installed, so adding `defineVitestProject` is config-only. Separately, page-level integration (pick → `picks` → `computed` → DOM) has **no executing test at all**, and D-08/D-09's invalidation behaviour lives exactly on that chain.
   - *Unclear:* whether closing that integration gap is worth a second project inside a phase whose real risk is the ranking math.
   - *Recommendation:* **keep the single plain project** for the new components (explicit imports, plain HTML — the D-15/D-17 controls do not need Nuxt UI). Cover D-08/D-09 at the **composable** level, where the logic actually lives and where a plain test reaches it, rather than through the DOM. Leave the page-level gap open and honestly recorded, as Phase 5 did. Planning must state this choice explicitly either way — CONTEXT.md `<code_context>` asks for it.

2. ~~**Should the ACC step list be re-verified before these numbers are trusted?**~~ — **RESOLVED 2026-08-15.** See *"ACC policy re-verification"* above. The step list is correct and the 3.84 figure stands; ESPN independently confirms the old conference-opponent-win-pct step was removed by the July 2026 amendment. Re-verification did, however, surface a **third engine defect** — the multi-team non-round-robin branch drops the policy's *"the team that lost to every other Tied Team is eliminated"* — which planning must treat as a fourth engine task. STATE.md:108's LOW-confidence blocker is discharged **for the ACC only**; SEC / Big Ten / Big 12 step orders remain re-verified only as of Phase 3 (2026-08-13).

3. **Is D-13's candidate-set copy amended, or is Pitfall 6's overflow rule within Claude's discretion on layout?**
   - *Known:* measured mean group size 3.7, max 10 (13 mid-season). D-14 forbids the placeholder fallback.
   - *Recommendation:* treat "name the first *k*, `+N more`, full list in the D-15 expansion" as presentational and inside discretion — but raise it with the user in the same conversation as the ACC number, since both stem from the same measurement.

4. **Does the fallback path (conference resolution throws) need to produce 1..N?**
   - *Known:* Pitfall 2's repair should drive throws to zero, but the try/catch stays.
   - *Recommendation:* yes — degrade to record ordering with every team its own rank group and no tiebreaker marker. Cheap, and it prevents a caught throw from producing a table that violates D-01.

## Sources

### Primary (HIGH confidence)

- **Measurements run this session** against `public/data/2026/games.json` (888 games) and `teams.json`, 200 generated seasons per condition using the Phase 5 `mulberry32` harness and seed ranges — decision rates, guard-trip rates, unseparated-top-bucket rates, distinct-rank counts, and timings
- `shared/domain/tiebreakers/engine.ts`, `types.ts`, `rules.ts`, `acc.ts`, `steps.ts`, `records.ts` — read in full or in the relevant ranges
- `shared/domain/standings/computeStandings.ts`, `resolveTiebreakers.ts`, `shared/types/standings.ts` — read in full
- `app/components/StandingsTable.vue`, `StandingsSidebar.vue`, `app/pages/week/[week].vue` — read in full
- `tests/domain/standings/standings-tiebreaker-agreement.test.ts` — read in full (harness source, and the D-04 assertions this phase must rewrite)
- `vitest.config.ts`, `package.json`, `.planning/config.json` — read in full
- `.planning/phases/05-standings-engine-ui/deferred-items.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `06-CONTEXT.md`, `06-DISCUSSION-LOG.md`
- `.claude/CLAUDE.md` — project constraints

### Secondary (MEDIUM confidence)

- ACC July 2026 tiebreaker amendment — `theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx` and `espn.com/college-football/story/_/id/49366844` — corroborate head-to-head → Team Success Ranking → commissioner's draw
- **Re-verification 2026-08-15** (see *"ACC policy re-verification"* section) — `fbschedules.com/acc-announces-new-football-tiebreaking-procedures/` and `cbssports.com/college-football/news/acc-new-tiebreaker-rules-disaster-scenario/` carry the **verbatim two-team and both multi-team branches**, the tied-team definition, and the restart clause. Two independent reproductions agree with each other. ESPN additionally confirms the *removal* of the old conference-opponent-win-pct fifth step. The primary PDF (`ACC_Football_Tiebreaker_Policy_Jully_2026.pdf`, sic) is linked from theacc.com but its body was not machine-readable through WebFetch — these reproductions are the best available source, hence MEDIUM rather than HIGH.
- `.planning/phases/03-tiebreaker-engine/03-RESEARCH.md` — Phase 3's primary-PDF re-verification (2026-08-13), ACC 8/9-game split confirmation, conference sizes

### Tertiary (LOW confidence)

- None relied upon.

## Project Constraints (from CLAUDE.md)

| Directive | How this phase complies |
|---|---|
| Nuxt 4 / Nuxt UI 4 / TanStack Query v5 / TS 6.x / Tailwind 4, all LOCKED | No framework change; no new dependency at all |
| pnpm | All commands use `pnpm` / `pnpm exec` |
| No backend; fully static; no server routes | Every addition is a pure function or a localStorage composable |
| Persistence: localStorage only, season-namespaced | Manual decisions follow the existing `usePicksStorage(2026)` namespacing pattern |
| CFBD data and logos only | No new data source |
| Neutral shell; team color used sparingly; contrast must hold at small sizes | D-11 mandates neutral-only markers; contrast verification is a planned human checkpoint |
| **DRY — team lookup, standings computation, and tiebreaker logic each have exactly one implementation, consumed through composables** | The single largest constraint on this phase. Enforced in §Don't Hand-Roll (7 named single-implementations), §Pattern 5 (delete the union-find rather than add a second ranking path), §Pattern 6 (no display-layer tie predicate — this is CR-01), and the harness extraction (no second PRNG). IN-02's `useStandings` composable is what satisfies "consumed through composables" |
| GSD workflow enforcement — no direct edits outside a GSD workflow | This research made no repository edits; harnesses were run from the scratchpad |
| TypeScript stays on 6.x (Nuxt UI peer range excludes TS 7) | No TS version change |

## Metadata

**Confidence breakdown:**

- **Measurements (decision rates, guard trips, unseparated buckets, timings): HIGH** — executed this session against the committed slate with the project's own harness; effect sizes are large enough that sampling error cannot change any conclusion
- **Engine defect root causes: HIGH** — Pitfall 2's diagnosis is confirmed by captured guard messages showing the redefined pool is a different, larger set; the repair was implemented and re-measured to 0 trips. Pitfall 1's diagnosis is confirmed by named examples and a 19.2% frequency
- **Standard stack: HIGH** — the finding is "add nothing," verified against `package.json`
- **Architecture patterns: MEDIUM-HIGH** — Patterns 1, 2, 5 follow directly from the measurements and existing code shape; Patterns 3, 4, 6 are design recommendations grounded in the codebase's own precedents
- **ACC step list correctness: MEDIUM** — implementation matches published policy per two independent secondary sources and Phase 3's primary-PDF read, but STATE.md's LOW-confidence blocker stands (Open Question 2)
- **UI shaping (markers, expansion layout, card overflow): MEDIUM** — inside Claude's discretion; Pitfall 6 flags one place where a locked decision meets a measurement it did not anticipate

**Research date:** 2026-08-15
**Valid until:** 30 days for the engine/architecture content. The measurements are valid as
long as `public/data/2026/games.json` and `CONFERENCE_RULES` are unchanged — **re-run the
committed harness after any step-list or `defineTiedTeams` change**, which is precisely why it
should be a test rather than a one-off script.
