# Phase 3: Tiebreaker Engine - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Given a complete set of picked game outcomes, correctly determine each P4 conference's (SEC, Big Ten, Big 12, ACC) championship game participants — or correctly identify who's tied and why. Pure domain logic, framework-free, no UI dependency. Buildable in parallel with Phases 2, 4, and 5 since it only needs the `Game`/`Team` shape pinned in Phase 1. Wired into the UI in Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Return type & uncomputable steps
- **D-01:** Return type is 2-valued: `Resolved(order)` | `NeedsUserInput(tiedTeams, reason, ruleCitation)`. No separate `Impossible` variant — a human can always pick a winner, even where the official procedure would use a coin-flip draw, so every uncomputable case (including a true draw) becomes `NeedsUserInput` with an appropriate reason code (e.g. `'draw'`).
- **D-02:** The SEC's `CONFERENCE_RULES` omits the scoring-margin step (step E) entirely — this app doesn't track scores, so the SEC is modeled as having one fewer computable step than the other three conferences, not as having a step that's always attempted and always fails.
- **D-03:** The terminal SportSource Analytics ranking step is omitted from all 4 conferences' `CONFERENCE_RULES` — no conference's rule list includes a step that can never actually resolve anything. All rule lists stop at the last genuinely computable step.
- **D-04:** Each conference's rules object carries a `terminalReason` — static metadata (reason code + citation text + source name) attached separately from the executable step list, used to populate `ruleCitation` when the last computable step doesn't fully separate the tied group. Keeps the step list purely executable; citation text is purely descriptive and lives with the conference's rules definition, not hardcoded into the UI layer.

### Big 12 "next highest-placed common opponent" — collective-bucket comparison
- **D-05 (revised during Phase 3 research/planning, 2026-08-13):** For the Big 12's "next highest-placed common opponent" step, when the walk down the frozen base ordering reaches a raw-standings-tied bucket of opponents, the engine compares tied teams' win percentage against that **entire bucket collectively as a group** — not one opponent at a time. This follows the Big 12's own tiebreaker PDF verbatim, identically worded in both its two-team and multi-team sections: *"When arriving at another group of tied teams while comparing records, use each team's win percentage against the collective tied teams as a group... rather than the performance against individual tied teams."*
  - **Original D-05 (superseded):** During discuss-phase, the engine was specified to compare one opponent at a time, as "the more conservative reading," matching how the analogous Big Ten/SEC steps are worded. Superseded once the full primary-source text was located.
- **D-06 (revised):** This is **not** a specification gap. The Big 12's full policy PDF states the collective-bucket treatment affirmatively and has now been read in full twice — once by the original project-level `PITFALLS.md` research (which already quoted this exact sentence under Pitfall 4, but whose implication wasn't cross-checked against D-05 at discuss-phase time), and again by Phase 3's dedicated research pass. The original discuss-phase assumption was made after checking only a shorter aggregator page (`big12sports.com/sports/2024/9/6/FB_0906243427.aspx`) that reproduces the 2-team steps but not the full 3+-team procedure containing this clause. A dedicated fixture test exercising the collective-tie scenario is still required (per the original intent) — it now verifies the *correct*, PDF-confirmed behavior rather than flagging an open assumption. The code comment at the Big 12 rule definition should cite the exact PDF quote above, not describe the behavior as unresolved.
- Source: Big 12 Football Tiebreaker Policy PDF (`big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf`), re-fetched and read in full during Phase 3 research (2026-08-13); quoted in `.planning/research/PITFALLS.md` Pitfall 4 and `.planning/phases/03-tiebreaker-engine/03-RESEARCH.md` "Primary Source Re-Verification."

### SEC/Big Ten "next highest-placed common opponent" — collective-bucket extrapolation (documented assumption)
- **D-13 (added during Phase 3 planning, 2026-08-13):** SEC's and Big Ten's own tiebreaker documents are **silent** on how to compare against a raw-standings-tied bucket of opponents at the "next highest-placed common opponent" step — neither document contains the Big 12's specific collective-bucket sentence (D-05) at all. The engine applies the **same collective-bucket treatment** to SEC and Big Ten's analogous step as the Big 12 (D-05, revised), rather than falling back to one-opponent-at-a-time.
- **Rationale:** This is a documented extrapolation, not a primary-source confirmation for SEC/Big Ten specifically. It follows `.planning/research/PITFALLS.md` Pitfall 4's own standing recommendation, written during the project's original research (2026-08-12), before this phase's D-05 revision: *"Where the SEC/Big Ten wording is silent, adopt the Big 12's collective-bucket treatment and record it as an explicit documented assumption in the code and in the phase's decision log, so a future correction is a one-line change rather than an archaeology exercise."* Flagged by the Phase 3 plan-checker (`03-02-PLAN.md`'s conference-agnostic `evaluateNextHighestPlacedCommonOpponent` silently generalized D-05 to all four conferences with no decision backing it); resolved by making the existing PITFALLS.md recommendation an explicit, tracked decision instead of a silent implementation choice.
- **Requires:** a code comment at the shared step-evaluator citing this decision (not just D-05's Big 12-specific comment), plus a dedicated bucket-collision fixture case for **both** SEC (`03-04-PLAN.md`) and Big Ten (`03-05-PLAN.md`) proving the collective-bucket behavior is deliberate and tested for those conferences too — mirroring `03-06-PLAN.md`'s existing Big 12 `big12CollectiveBucketComparison` fixture, not merely asserted by inheriting D-05's implementation.
- **If wrong:** since this is an extrapolation rather than a primary-source confirmation, a future re-read of the SEC's or Big Ten's own tiebreaker document (SEC's primary PDF has never been directly retrieved — see Assumption A1 in RESEARCH.md) could reveal a different intended treatment. The explicit decision + dedicated fixture here (rather than silent inheritance) is what keeps that correction a one-line change.

### Trace shape (consumed directly by Phase 6's UI)
- **D-07:** The trace records **every attempted step**, including steps that separated nobody and steps involving teams already eliminated in an earlier step of the same cycle — each with every remaining team's actual value at that step. TIE-05 requires step-by-step reasoning, and "we checked this step and it didn't help" is itself meaningful information, not noise to omit.
- **D-08:** Restarts are represented as **nested cycle groups**, not a flat step list. The trace is an array of cycles; each cycle has its own ordered step list and records which team(s), if any, were removed at the end of that cycle. This matches how the published rules actually read ("run the steps; if that doesn't fully separate them, start over") and lets Phase 6 render each pass distinctly without inferring cycle boundaries itself.
- **D-09:** Every cycle — for all 4 conferences, not just the ACC — records its own explicit tied-team list. This gives one consistent trace shape across conferences even though only the ACC's policy actually redefines the tied group between cycles (the other three conferences' cycles always narrow the same starting group). Simpler, uniform rendering in Phase 6; correctly represents the ACC's actual behavior without a conference-specific trace variant.

### Fixture & verification depth
- **D-10:** Full hand-verified fixture matrix **per conference** (not shared-baseline + deltas): 2-, 3-, 4-, and 5-way ties, a restart-vs-continue divergence case, a partial head-to-head-graph case, and a zero-common-opponents NaN-safety case, for each of SEC, Big Ten, Big 12, and ACC. This is the project's single highest-risk, highest-recovery-cost component (per PROJECT.md: "If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters") — the full matrix is worth the upfront cost over relying on shared-engine-logic-is-correct assumptions.
- **D-11:** Add `@vitest/coverage-v8` with a per-file coverage threshold on the tiebreaker directory in this phase (not deferred), per STACK.md's own suggestion — cheap insurance against an untested branch (e.g. an unreachable restart path) the hand-written fixture list happens to miss.
- **D-12:** Fixtures assert the **full trace content** (every cycle, every step, every value compared) for cases that bottom out at `NeedsUserInput`, not just the final outcome and reason code. Since the trace IS the product per TIE-05, a fixture that only checks the final answer could let a subtly wrong trace ship even when the final resolved team happens to be correct.

### Claude's Discretion
- Exact TypeScript shapes/field names for the trace, cycle, step, and `terminalReason` objects beyond what D-07–D-09 specify — left to research/planning to design against the actual `Game`/`Team` types from Phase 1.
- Internal module structure within `shared/domain/tiebreakers/` (single file vs. `{engine,steps,rules}.ts` split as ARCHITECTURE.md sketches) — left to planning.
- Specific coverage threshold percentage for D-11 — left to planning, informed by how much of the fixture matrix (D-10) exists once written.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints & decisions
- `.planning/PROJECT.md` — Core value framing ("if tiebreaker resolution is wrong, nothing else matters"), constraints, Key Decisions table (tiebreakers auto-resolve with manual override at ranking steps — Pending, Phase 3)
- `.planning/REQUIREMENTS.md` §Tiebreakers (TIE) — TIE-01 through TIE-04, the locked requirements for this phase (TIE-05/06/07 belong to Phase 6, consuming this phase's output)
- `.claude/CLAUDE.md` — Stack decisions (Vitest node-environment project for domain logic, `@vitest/coverage-v8`)

### Roadmap
- `.planning/ROADMAP.md` §Phase 3: Tiebreaker Engine — goal, success criteria, and explicit note that this phase is buildable in parallel with Phases 2, 4, 5

### Research — MANDATORY, primary-source tiebreaker specification
- `.planning/research/PITFALLS.md` §"Conference Tiebreaker Specification Source" (around line 497) — **the specification input** for all 4 conferences' rules, quoting primary policy PDFs verbatim. Supersedes any secondary summary, including this CONTEXT.md's own prose above. Where ARCHITECTURE.md's `CONFERENCE_RULES` sketch disagrees with this section on a step list, PITFALLS.md wins.
- `.planning/research/PITFALLS.md` Pitfalls 1–6 (restart semantics, non-terminating tiebreakers, unbalanced schedules, "next highest-placed" circularity, head-to-head partial-graph applicability, division-based dead weight) — each pitfall maps directly to a required fixture case
- `.planning/research/ARCHITECTURE.md` — `shared/domain/tiebreakers/{engine,steps,rules}.ts` module sketch, three-valued return type sketch (superseded by D-01's 2-valued decision above), pure/framework-free requirement (no Vue imports)
- `.planning/research/SUMMARY.md` §"Phase 3b (parallel with 3-5): Tiebreaker Engine" — phase delivery scope, `defineTiedTeams` per-conference strategies, frozen bucketed base ordering
- Big Ten Football Championship Game Tiebreaker (PDF, bigten.org) — cited in PITFALLS.md, verbatim restart-on-partial-separation / continue-on-no-separation language
- Big 12 Football Tiebreaker Policy (PDF, big12sports.com) — cited in PITFALLS.md Pitfall 4, resolves the collective-bucket comparison affirmatively (D-05/D-06, revised 2026-08-13 during Phase 3 research), FCS win cap
- `https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football` — Big 12 2-team tiebreaker steps A–G; a shorter aggregator page consistent with PITFALLS.md's citation but not containing the full 3+-team procedure's collective-bucket clause; superseded as the operative source by the full PDF above
- ACC Football Tiebreaker Policy, as amended July 1, 2026 (PDF, theacc.com) — cited in PITFALLS.md, restart-including-redefinition language underlying D-09
- SEC tiebreaker procedure (official release, reproduced across independent outlets) — cited in PITFALLS.md, multi-team restart clause, scoring-margin step underlying D-02

**Note on source confidence:** PITFALLS.md rates itself HIGH confidence for Big Ten/Big 12/ACC (primary PDFs retrieved verbatim) and MEDIUM for SEC (official release text reproduced by multiple outlets, primary PDF not directly retrievable). STATE.md flags that the ACC amended its policy 2026-07-01 and could do so again — re-verify against primary PDFs at implementation time per PITFALLS.md's own recommendation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this phase has no dependency on Phase 2's app layer. It consumes only the `Game`/`Team` shapes Phase 1 produced (`public/data/2026/{teams,games}.json`).

### Established Patterns
- No existing `shared/domain/` code yet. Research (ARCHITECTURE.md) recommends this phase's output live at `shared/domain/tiebreakers/`, pure TypeScript, zero Vue imports — Nuxt's `shared/` directory structurally forbids Vue/Nitro/Nuxt-context imports, which enforces the "framework-free" requirement rather than just convention.

### Integration Points
- Output is consumed starting in Phase 6 (`TiebreakerTrace`, `TiebreakerResolver`, `ChampionshipCard` components render `result.trace` directly, per research — "zero rule logic" in the UI layer). Phase 5's standings engine also needs the frozen base ordering this phase computes, to visually flag ties before any tiebreaker resolves them.

</code_context>

<specifics>
## Specific Ideas

No UI/visual requirements — this is a domain-logic phase. Key specifics captured above: 2-valued return type, per-conference terminal-reason metadata, collective-bucket Big 12 comparison confirmed against the primary-source PDF (D-05, revised) and extrapolated to SEC/Big Ten as a documented assumption (D-13), nested-cycle trace with per-cycle tied-team lists, full per-conference fixture matrix with a coverage gate, full-trace-content fixture assertions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (TIE-05/06/07 — trace rendering, manual override persistence/invalidation, and the dedicated championship UI element — are already scoped to Phase 6, not deferred from this phase; they were referenced during discussion only as the consumer of this phase's output.)

### Reviewed Todos (not folded)
None — `todo.match-phase` was not run as part of this ad-hoc resumed session; no pending todos file was found in prior context.

</deferred>

---

*Phase: 3-Tiebreaker Engine*
*Context gathered: 2026-08-13*
