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

### Big 12 spec gap (documented assumption)
- **D-05:** For the Big 12's "next highest-placed common opponent" step, when multiple tied teams share several common opponents at the same placement level, the engine compares **one opponent at a time**, walking down the frozen base ordering — not a collective bucket of same-tier opponents. This is the more conservative reading and matches how the analogous Big Ten/SEC steps are literally worded.
- **D-06:** This assumption is a genuine specification gap, not a settled implementation detail — it must be flagged explicitly: a code comment at the Big 12 rule definition citing the gap and the assumption made, plus a dedicated fixture test exercising the collective-tie scenario, so a future re-read of the primary source can verify or correct it.
- User-provided source checked during discussion: `https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football` — fetched and confirmed it reproduces the same 2-team Step A–G language already captured in `.planning/research/PITFALLS.md`, and does **not** resolve the collective-bucket ambiguity; the full 3+-team procedure lives in a separate linked PDF that PITFALLS.md already cites as the authoritative source for this gap.

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
- Big 12 Football Tiebreaker Policy (PDF, big12sports.com) — cited in PITFALLS.md, collective-bucket rule gap (D-05/D-06), FCS win cap
- `https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football` — Big 12 2-team tiebreaker steps A–G; confirmed during this discussion to be consistent with PITFALLS.md's citation and to not resolve the collective-bucket gap
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

No UI/visual requirements — this is a domain-logic phase. Key specifics captured above: 2-valued return type, per-conference terminal-reason metadata, one-opponent-at-a-time Big 12 comparison (documented assumption), nested-cycle trace with per-cycle tied-team lists, full per-conference fixture matrix with a coverage gate, full-trace-content fixture assertions.

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
