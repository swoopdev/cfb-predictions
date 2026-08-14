# Phase 3: Tiebreaker Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 3-Tiebreaker Engine
**Areas discussed:** Uncomputable-step handling, Big 12 spec gap, Trace granularity, Fixture/verification depth

---

## Uncomputable-step handling

| Option | Description | Selected |
|--------|-------------|----------|
| Model as one step shorter | SEC's CONFERENCE_RULES omits the scoring-margin step entirely | ✓ |
| Include the step, always flag uncomputable | Keep the step for fidelity, evaluator always returns not-computable | |

**User's choice:** Model as one step shorter (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Omit terminal ranking step | All 4 conferences' rule lists stop at the last computable step | ✓ |
| Include as labeled uncomputable step | Keep as a literal mirror of the published procedure | |

**User's choice:** Omit it (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Static terminal-reason metadata | `terminalReason` object on conference rules, separate from step list | ✓ |
| Derive citation at UI render time | Engine returns only reason code; UI hardcodes citation text | |

**User's choice:** Yes — static terminal-reason metadata (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse to NeedsUserInput only | 2-valued Resolved \| NeedsUserInput; draw is a reason code | ✓ |
| Keep 3-valued as PITFALLS.md sketched | Resolved \| NeedsUserInput \| Impossible | |

**User's choice:** Collapse to NeedsUserInput only (Recommended)
**Notes:** All four sub-questions used the recommended option. No pushback.

---

## Big 12 spec gap

| Option | Description | Selected |
|--------|-------------|----------|
| One opponent at a time, in order | Walk down frozen base ordering one placed opponent at a time | ✓ |
| Collective bucket per tier | Group same-tier opponents into one combined comparison | |

**User's choice:** Compare one opponent at a time, in order (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Flag it explicitly | Code comment + dedicated fixture test citing the gap | ✓ |
| Treat as settled | No special flagging | |

**User's choice:** User initially responded with a URL (`https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football`) instead of selecting an option, asking it be used as a source. Claude fetched the page per the canonical-ref-accumulation rule; it reproduced the same 2-team Step A–G language already in PITFALLS.md and did not resolve the collective-bucket ambiguity (full 3+-team procedure is in a separate PDF PITFALLS.md already cites). Claude re-asked confirming the recommendation still stood given the fetch result — user selected "Flag it explicitly (Recommended)".
**Notes:** URL added to canonical refs in CONTEXT.md.

---

## Trace granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Every attempted step, full detail | Includes steps that separated nobody, with each team's value | ✓ |
| Only steps that changed the group | Skip recording no-op steps | |

**User's choice:** Every attempted step, full detail (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Nested cycle groups | Trace is an array of cycles, each with its own step list | ✓ |
| Flat sequential list | One array tagged with restart/cycle markers | |

**User's choice:** Nested cycle groups (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Every cycle records its own tied-team list | Uniform shape across all 4 conferences | ✓ |
| Only ACC cycles record tied-team lists | Others imply subset, saves redundancy | |

**User's choice:** Yes — every cycle records its own tied-team list (Recommended)
**Notes:** All three sub-questions used the recommended option. No pushback.

---

## Fixture/verification depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full matrix per conference | 2/3/4/5-way, restart-vs-continue, partial-graph, NaN-safety — per conference | ✓ |
| Shared cases + per-conference deltas | Full matrix once on a reference conference, deltas elsewhere | |

**User's choice:** Full matrix per conference (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Add a coverage threshold | @vitest/coverage-v8, per-file threshold on tiebreaker directory | ✓ |
| Skip coverage gate | Rely on fixture matrix alone | |

**User's choice:** Add a coverage threshold (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Assert full trace content | Every cycle, step, and value, not just final outcome | ✓ |
| Assert outcome + reason code only | Skip pinning exact trace wording | |

**User's choice:** Assert full trace content (Recommended)
**Notes:** All three sub-questions used the recommended option. No pushback.

---

## Claude's Discretion

- Exact TypeScript shapes/field names for trace, cycle, step, and `terminalReason` objects
- Internal module structure within `shared/domain/tiebreakers/` (single file vs. multi-file split)
- Specific coverage threshold percentage

## Deferred Ideas

None — discussion stayed within phase scope.
