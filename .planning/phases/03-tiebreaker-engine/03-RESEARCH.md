# Phase 3: Tiebreaker Engine - Research

**Researched:** 2026-08-13
**Domain:** Deterministic multi-step tiebreaker resolution for P4 college football conference championships (pure TypeScript domain logic)
**Confidence:** HIGH for conference rule content (all 3 non-SEC primary PDFs re-fetched and re-verified verbatim today; SEC remains MEDIUM, secondary-source only); MEDIUM-HIGH for the concrete engine/trace design (grounded in real Phase 1 data + existing project conventions, but the design itself is new and untested until Wave 0)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Return type is 2-valued: `Resolved(order)` | `NeedsUserInput(tiedTeams, reason, ruleCitation)`. No separate `Impossible` variant — a human can always pick a winner, even where the official procedure would use a coin-flip draw, so every uncomputable case (including a true draw) becomes `NeedsUserInput` with an appropriate reason code (e.g. `'draw'`).
- **D-02:** The SEC's `CONFERENCE_RULES` omits the scoring-margin step (step E) entirely — this app doesn't track scores, so the SEC is modeled as having one fewer computable step than the other three conferences, not as having a step that's always attempted and always fails.
- **D-03:** The terminal SportSource Analytics ranking step is omitted from all 4 conferences' `CONFERENCE_RULES` — no conference's rule list includes a step that can never actually resolve anything. All rule lists stop at the last genuinely computable step.
- **D-04:** Each conference's rules object carries a `terminalReason` — static metadata (reason code + citation text + source name) attached separately from the executable step list, used to populate `ruleCitation` when the last computable step doesn't fully separate the tied group. Keeps the step list purely executable; citation text is purely descriptive and lives with the conference's rules definition, not hardcoded into the UI layer.
- **D-05:** For the Big 12's "next highest-placed common opponent" step, when multiple tied teams share several common opponents at the same placement level, the engine compares **one opponent at a time**, walking down the frozen base ordering — not a collective bucket of same-tier opponents. This is the more conservative reading and matches how the analogous Big Ten/SEC steps are literally worded.
- **D-06:** This assumption is a genuine specification gap, not a settled implementation detail — it must be flagged explicitly: a code comment at the Big 12 rule definition citing the gap and the assumption made, plus a dedicated fixture test exercising the collective-tie scenario, so a future re-read of the primary source can verify or correct it. User-provided source checked during discussion (`big12sports.com/sports/2024/9/6/FB_0906243427.aspx`) confirmed the 2-team Step A–G language but not the collective-bucket question; the full 3+-team procedure was said to live in a separate linked PDF.
  - **⚠️ See "Primary Source Re-Verification" below — this phase's research fetched that separate PDF directly and found it explicitly answers this question, in language that reads as the opposite of D-05's chosen interpretation. Flagged, not overridden — see the dedicated subsection for the exact quote and a recommendation.**
- **D-07:** The trace records **every attempted step**, including steps that separated nobody and steps involving teams already eliminated in an earlier step of the same cycle — each with every remaining team's actual value at that step.
- **D-08:** Restarts are represented as **nested cycle groups**, not a flat step list. The trace is an array of cycles; each cycle has its own ordered step list and records which team(s), if any, were removed at the end of that cycle.
- **D-09:** Every cycle — for all 4 conferences, not just the ACC — records its own explicit tied-team list.
- **D-10:** Full hand-verified fixture matrix **per conference** (not shared-baseline + deltas): 2-, 3-, 4-, and 5-way ties, a restart-vs-continue divergence case, a partial head-to-head-graph case, and a zero-common-opponents NaN-safety case, for each of SEC, Big Ten, Big 12, and ACC.
- **D-11:** Add `@vitest/coverage-v8` with a per-file coverage threshold on the tiebreaker directory in this phase (not deferred).
- **D-12:** Fixtures assert the **full trace content** (every cycle, every step, every value compared) for cases that bottom out at `NeedsUserInput`, not just the final outcome and reason code.

### Claude's Discretion

- Exact TypeScript shapes/field names for the trace, cycle, step, and `terminalReason` objects beyond what D-07–D-09 specify — left to research/planning to design against the actual `Game`/`Team` types from Phase 1.
- Internal module structure within `shared/domain/tiebreakers/` (single file vs. `{engine,steps,rules}.ts` split as ARCHITECTURE.md sketches) — left to planning.
- Specific coverage threshold percentage for D-11 — left to planning, informed by how much of the fixture matrix (D-10) exists once written.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. TIE-05/06/07 (trace rendering, manual override persistence/invalidation, dedicated championship UI element) are already scoped to Phase 6, not deferred from this phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIE-01 | The two conference championship game participants for each of SEC, Big Ten, Big 12, and ACC are resolved automatically wherever the published conference procedure is computable from picked game outcomes | "Concrete Engine Design" section defines `resolveConferenceChampionship()`, the two-layer (per-group resolver + #1/#2 orchestration) architecture, and the `CONFERENCE_RULES` data table populated from re-verified primary sources |
| TIE-02 | Each conference's tiebreaker procedure is implemented per its own official published rules, including correct handling of unbalanced schedules and non-percentage tie definitions where applicable (e.g. ACC) | "Primary Source Re-Verification" re-confirms all 4 conferences' rule text; "ACC's `defineTiedTeams`" subsection gives the exact algorithm for the non-win-pct tie definition; real 2026 ACC data confirms the mixed 8/9-game schedule is live, not hypothetical |
| TIE-03 | Multi-team ties correctly restart the tiebreaker procedure from the first step when a step only partially separates the group, and continue to the next step when a step separates no one | "Recursive Restart Algorithm" gives concrete pseudocode adapted to the 2-valued/nested-cycle trace shape, with the two invariants (strictly-smaller recursive group; no re-admission of eliminated teams) |
| TIE-04 | When a tiebreaker procedure bottoms out at a step that cannot be computed from picks alone, the tied teams are surfaced with an explanation, and the user selects who advances | `TerminalReason`/`NeedsUserInput` shapes in "Concrete Engine Design"; `CONFERENCE_RULES[conf].terminalReason` static metadata per D-04 |

</phase_requirements>

## Summary

This phase has almost no new-technology risk and almost all of its risk concentrated in getting four independently-worded legal documents translated into one correct, restart-aware recursive algorithm. All three previously-fetched primary PDFs (Big Ten, Big 12, ACC as amended July 2026) were re-downloaded and re-read verbatim during this research pass; **none have changed since PITFALLS.md's original extraction** — confirmed current as of 2026-08-13. The SEC's primary PDF still resists direct retrieval; the secondary sources PITFALLS.md already cites remain the best available input, unchanged, MEDIUM confidence.

One primary-source finding surfaced during re-verification bears directly on a locked decision (D-05/D-06) and is flagged prominently below rather than silently resolved: the Big 12's own policy PDF states, in identical wording in **both** its two-team and multi-team sections, that when the "next highest-placed common opponent" walk arrives at a raw-standings-tied bucket of opponents, the comparison uses "each team's win percentage against the collective tied teams as a group... rather than the performance against individual tied teams." This is an affirmative statement, not a silence — it directly addresses the scenario D-06 characterized as an unresolved gap. See "Primary Source Re-Verification" for the full quote and a recommendation that does not override the locked decision.

Phase 1's committed `Team`/`Game` shapes are minimal by design (no scores, no `championshipGame` flag, no season-type variety beyond `'regular'` in the actual 2026 data) — this grounds every type in the "Concrete Engine Design" section in real, already-fetched data rather than the illustrative sketch in ARCHITECTURE.md. The engine's actual input is **conference games and picked outcomes only**; every tiebreaker step in every conference's document is defined in terms of conference record, conference opponents, and conference win percentage — no step anywhere references overall (non-conference) record, so the engine never needs `homeTeam`/`awayTeam` display strings or non-conference games at all.

No new npm packages are introduced by this phase. `@vitest/coverage-v8@^4.1.10` is already a committed devDependency (added during Phase 1 scaffolding) and its version already matches the installed `vitest@^4.1.10` exactly — D-11's coverage gate requires only a `vitest.config.ts` edit, not an install.

**Primary recommendation:** Build a two-layer engine — an inner, purely recursive `resolveTiedGroup()` that implements Pitfall 1's restart/continue logic against the 2-valued/nested-cycle trace shape defined below, and an outer `resolveConferenceChampionship()` that determines the #1 and (then) #2 seed by calling the inner resolver against each conference's own base-ordering and tied-group-definition rules. Keep `CONFERENCE_RULES` as data (Architecture Pattern 5) but do not shortcut the ACC's genuinely different `defineTiedTeams` (Architecture Contradiction 5 / Pitfall 3) into the same shape as the other three.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Conference record derivation (wins/losses/gamesPlayed/beat/lostTo per team, conference games only) | Domain (`shared/domain/`) | — | Pure aggregation over `Game[]` + picked outcomes; zero framework dependency; must be reusable by Phase 5's standings engine without duplication (DRY constraint) |
| Frozen base ordering (raw win-pct ranking, bucketed) | Domain (`shared/domain/tiebreakers/`) | — | Computed once per resolution call from conference records; never recomputed mid-procedure (Pitfall 4) |
| Per-conference tied-team definition (`defineTiedTeams`) | Domain (`shared/domain/tiebreakers/rules.ts`) | — | Conference-pluggable strategy; the ACC's is structurally different (Pitfall 3) |
| Step evaluation (head-to-head, common opponents, next-highest-placed, cumulative win pct, total wins) | Domain (`shared/domain/tiebreakers/steps.ts`) | — | Pure functions over `ConferenceRecord[]` + `BaseOrdering`; no Vue, no I/O |
| Recursive restart/continue orchestration | Domain (`shared/domain/tiebreakers/engine.ts`) | — | This IS the phase's core deliverable; must stay framework-free to be exhaustively unit-tested per D-10 |
| Trace rendering (human-readable step-by-step explanation) | Presentation (Phase 6, out of scope here) | — | This phase emits the trace data; Phase 6 renders it. Zero rule logic may live in Phase 6's components |
| Manual override persistence/invalidation | State/Persistence (Phase 6/7, out of scope here) | — | This phase's `NeedsUserInput` output is the trigger; storage is a later phase's concern |
| Conference standings (overall table, not just championship participants) | Domain (Phase 5, out of scope here) | — | Phase 5 must reuse this phase's `deriveConferenceRecords` rather than reimplementing win/loss tallying (see "Don't Hand-Roll") |

## Package Legitimacy Audit

**Not applicable to this phase.** No new npm packages are introduced. `@vitest/coverage-v8@^4.1.10` — the only dependency this phase's D-11 decision touches — was already added as a devDependency in Phase 1's scaffolding and its version (`4.1.10`) already matches the installed `vitest@^4.1.10` exactly (confirmed against the committed `package.json`, `[VERIFIED: local package.json]`). D-11 requires only a `vitest.config.ts` edit to add `coverage.thresholds`, not a `pnpm add`.

## Primary Source Re-Verification

All three previously-retrievable primary PDFs (Big Ten, Big 12, ACC-as-amended-July-2026) were re-fetched directly from their origin domains today (2026-08-13) via `curl` (the origin servers serve an HTML interstitial to a plain `WebFetch`, so a `curl`-then-`Read` round trip was required to get the actual binary PDF). Full text was read from all three. **Confirmed: no drift from PITFALLS.md's extraction.** Re-confirmation date: **2026-08-13**.

### ACC — `theacc.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf` (via S3 redirect)

Verbatim match to PITFALLS.md's citation, including:
- The exact "Top Two Teams" / win-pct-or-alternate-schedule-wins-or-losses definition
- The 1(a)/1(b)/1(c) "Defining Tied Teams" steps, verbatim
- The two-team tie steps (head-to-head → Team Success Ranking → draw)
- The three-or-more-team split on "common opponents" vs. "not common opponents," each branch's steps, and the "if necessary, the tiebreaker will restart, including the definition of tied teams" clause repeated after **every single step** in both branches (not just once at the end) — this is stronger and more explicit than a casual read of PITFALLS.md's summary suggests: literally every sub-step (i, ii, iii in each branch) carries its own independent restart clause.

`[VERIFIED: theacc.com, re-fetched 2026-08-13]` — no amendment since July 1, 2026.

### Big Ten — `bigten.org/api/media/file/...2024_Big_Ten_Football_Tiebreaker...pdf` (redirects to `img.boostsport.ai`)

Verbatim match to PITFALLS.md's citation. Confirmed additional detail not previously quoted in this project's research, worth carrying into fixtures: the document also defines what happens if a would-be participant is **postseason-ineligible** (the No. 2/No. 3 team advances instead, or the ineligible team is removed and the remainder revert to the tiebreak procedure) and what happens if the **championship game itself cannot be played** (co-champions declared; a separate mini-procedure determines the CFP Automatic Qualifier). Both are out of v1 scope (no postseason-ineligibility or game-cancellation modeling exists in this app), consistent with PITFALLS.md's own note — flagged here only so a future phase doesn't need to re-fetch the PDF to confirm this is genuinely out of scope.

`[VERIFIED: bigten.org, re-fetched 2026-08-13]` — unchanged.

### Big 12 — `big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf` (via S3 direct link)

Verbatim match to PITFALLS.md's citation for every step a–g (two-team) and a–g (multi-team). **This is where the flagged finding below comes from** — see the dedicated subsection immediately following.

`[VERIFIED: big12sports.com, re-fetched 2026-08-13]` — unchanged.

### SEC — no primary PDF found this session either

`secsports.com/news/2024/08/sec-announces-football-tie-breaking-process` was re-fetched; it returns only the announcement headline and a one-sentence summary ("first football season since 1991 to be conducted without divisions") — the same shallow content PITFALLS.md's research encountered. The 247Sports (full release + Appendix A worked example), ESPN, Pro Football Network, and DawgNation secondary sources PITFALLS.md already cites were not re-fetched individually this session (no indication of an SEC procedure change since 2024, and the 2026 nine-game-schedule announcement PITFALLS.md already incorporates is itself from August 2025 secsports.com, pre-dating this research window). **No drift found; confidence remains MEDIUM, unchanged from PITFALLS.md.**

### ⚠️ Flagged finding: Big 12's "collective bucket" clause is stated, not silent — bears on D-05/D-06

Both the two-team section (item c) and the multi-team section (item c) of the re-fetched Big 12 PDF contain, verbatim, in each case:

> *"Win percentage against the next highest placed common opponent in the standings (based on the record in all games played within the Conference), proceeding through the standings. **When arriving at another group of tied teams while comparing records, use each team's win percentage against the collective tied teams as a group (prior to that group's own tie-breaking procedure) rather than the performance against individual tied teams.**"*

This is the exact sentence PITFALLS.md's Pitfall 4 already quotes and labels "Rule 2" (the rule that makes the "next highest-placed opponent" step terminate rather than recurse infinitely). It states, affirmatively, that when the walk down the base ordering reaches a placement occupied by a **raw-standings-tied bucket of opponent teams**, the comparison uses the whole bucket collectively — explicitly "rather than the performance against individual tied teams."

D-05 documents choosing "one opponent at a time... not a collective bucket of same-tier opponents" for this exact scenario, and D-06 frames it as "a genuine specification gap, not a settled implementation detail," citing a shorter aggregator page that doesn't cover the 3+-team procedure as the reason the fuller text wasn't available during discuss-phase.

**This research is not overriding D-05/D-06** (per the explicit instruction not to re-litigate it), but the finding is material enough to record plainly:

1. The text quoted above is **identical in the 2-team and multi-team sections** of the Big 12's own document — so if it applies at all, it applies uniformly to both procedures, not just the multi-team one.
2. It reads as a direct, affirmative answer to the exact question D-06 frames as unanswered — not as a document that "does not resolve the collective-bucket ambiguity" (D-06's characterization of the shorter page it checked, which is accurate for *that* page but not for the fuller PDF now confirmed to contain this clause).
3. The genuine remaining gap — the one PROJECT-RESEARCH-SUMMARY.md's "Research Flags" section actually describes as unresolved — is different from what D-05 addresses: it's whether **Big Ten and SEC**, whose own documents do **not** contain this clause at all, should have the same collective-bucket treatment imported into their "next highest placed common opponent" / "highest placed common conference opponent" steps. That extrapolation is the part genuinely undocumented outside the Big 12.

**Recommendation for the planner:** surface this finding to the user (e.g. a `checkpoint:human-verify` task at the Big 12 rule definition, or a quick confirmation before Wave 0 locks in the fixture matrix) rather than silently building to either interpretation. If the user confirms the collective-bucket reading, D-05/D-06's code comment and dedicated fixture should be updated to match the Big 12's own text; if the user reaffirms the one-opponent-at-a-time reading as an intentional, conservative deviation from the literal text, keep D-05/D-06 as written but update D-06's rationale to reflect that the full PDF was in fact available and read (not still unread), so a future maintainer doesn't waste time re-deriving this.

## Concrete Engine Design

### Grounding: the actual Phase 1 `Team`/`Game` shapes

Read directly from `public/data/2026/teams.json` and `public/data/2026/games.json` (`[VERIFIED: public/data/2026/*.json, scripts/lib/schemas.ts]`):

```ts
// As actually committed by Phase 1 — NOT the illustrative ARCHITECTURE.md sketch.
// teams.json: { season: number, teams: Team[] }
interface Team {
  id: number                  // CFBD id
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string          // 'SEC' | 'Big Ten' | 'Big 12' | 'ACC' | ...other G5/independent strings
  classification: string | null
  color: string
  alternateColor: string
  logo?: string | null        // resolved local path; not needed by the tiebreaker engine at all
}

// games.json: { season: number, scheduleHash: string, games: Game[] }
interface Game {
  id: number
  week: number
  seasonType: string          // every 2026 game is 'regular' — confirmed live (see below); no separate
                               // 'postseason'/championship game record exists in the feed this season
  homeId: number
  homeTeam: string             // display name only — not needed by the engine
  awayId: number
  awayTeam: string             // display name only — not needed by the engine
  conferenceGame: boolean      // trust directly; never re-derive (DATA-06)
  neutralSite: boolean
}
```

Live-data facts confirmed by querying the committed 2026 JSON directly this session (`[VERIFIED: public/data/2026/games.json, public/data/2026/teams.json]`):

- **888 games total, 0 with `seasonType !== 'regular'`.** There is no pre-existing conference championship game record to read or accidentally ingest into standings — confirms STATE.md's Phase 1 Open Question #1 resolution and means the tiebreaker engine's output (the two participants) is the *only* source of "who plays in the CCG," never cross-checked against a feed record.
- **127 of 888 games have a `homeId`/`awayId` not present in `teams.json`** (FCS opponents) — irrelevant to this phase specifically, since every tiebreaker step is scoped to conference games between conference members, and an FCS team can never be `conferenceGame: true` for a P4 conference.
- **Conference sizes: SEC 16, Big Ten 18, Big 12 16, ACC 17** teams — matches PITFALLS.md's documented 2026 realignment exactly.
- **ACC conference-game counts, computed directly from the committed schedule:** Boston College 8, Clemson 8, Florida State 8, Georgia Tech 8, North Carolina 8; all 12 other ACC teams (Cal, Duke, Louisville, Miami, NC State, Pitt, SMU, Stanford, Syracuse, Virginia, Virginia Tech, Wake Forest) play 9. **This is the exact mixed-8/9 scenario PITFALLS.md predicted, confirmed live in the schedule the engine will actually run against — not hypothetical.** This gives Wave 0 a real, ready-made fixture seed for the ACC's `defineTiedTeams` test case (e.g. Florida State at 8 games and Clemson at 8 games vs. a 9-game team with the same win count).

### The engine's actual input contract — conference-scoped only

No tiebreaker step in any of the four conferences' documents references overall (non-conference) record. The engine therefore never needs `homeTeam`/`awayTeam` strings, non-conference games, or anything from `Team` beyond `id` and `conference`. Recommended entry-point signature:

```ts
// shared/domain/tiebreakers/index.ts
export function resolveConferenceChampionship(
  conference: ConferenceId,
  conferenceGames: readonly Game[],   // pre-filtered: conferenceGame === true AND both teams in `conference`
  outcomes: ReadonlyMap<GameId, TeamId>  // the picked winner for every game in conferenceGames — must be complete
): ChampionshipResult
```

**Completeness is the caller's concern, not the engine's.** This phase's fixtures always supply a complete outcome for every conference game (per TIE-01's "complete, unambiguous set of picks" framing and D-10's fixture scope). Whether/when Phase 6 calls this function with an incomplete picture (mid-season) is out of this phase's scope — document as an assumption below, not solved here.

### Conference-record derivation — the DRY seam with Phase 5

The tiebreaker engine needs a small, purely conference-scoped aggregation that Phase 5's future standings engine will also need. Per PROJECT.md's DRY constraint ("standings computation... has exactly one implementation"), this phase should **own and export** this helper so Phase 5 imports it rather than re-deriving win/loss counts independently:

```ts
// shared/domain/tiebreakers/records.ts — owned here, imported by Phase 5 later
export interface ConferenceRecord {
  teamId: TeamId
  wins: number
  losses: number
  gamesPlayed: number            // wins + losses, kept explicit — never derive ad hoc (Pitfall 4's NaN guard)
  winPct: number                 // NaN-safe: 0 when gamesPlayed === 0 (should not occur for a P4 team with picks complete)
  beat: ReadonlySet<TeamId>
  lostTo: ReadonlySet<TeamId>
  opponents: ReadonlySet<TeamId> // beat ∪ lostTo
}

export function deriveConferenceRecords(
  conferenceGames: readonly Game[],
  outcomes: ReadonlyMap<GameId, TeamId>
): ReadonlyMap<TeamId, ConferenceRecord>
```

**Don't Hand-Roll note:** Phase 5 must call `deriveConferenceRecords` (or a thin wrapper around it) rather than writing its own conference win/loss tally — see "Don't Hand-Roll" below.

### Frozen base ordering

```ts
// shared/domain/tiebreakers/baseOrdering.ts
export type BaseOrdering = readonly TeamId[][]   // buckets, best-to-worst; bucket.length > 1 = raw win-pct tie at that slot

export function computeBaseOrdering(records: ReadonlyMap<TeamId, ConferenceRecord>): BaseOrdering
```

Computed **once** per `resolveConferenceChampionship` call, from raw `winPct` only, passed as a plain value into every step evaluator. Never recomputed mid-procedure — this is the direct fix for Pitfall 4's circularity trap. Buckets make raw-standings ties structurally visible, which both the Big 12's "collective bucket" step (per the flagged finding above) and the "no other teams may be defined as Tied Teams" ACC boundary depend on being able to see directly.

### Per-conference tied-team definition — the ACC is genuinely different

```ts
// shared/domain/tiebreakers/rules.ts
export interface ConferenceRules {
  id: ConferenceId
  /** Determines which teams are in contention for a given CCG spot. For SEC/Big Ten/Big 12
   *  this is trivially "the bucket at this base-ordering slot." For the ACC it runs the
   *  win-pct-or-alternate-schedule-wins-or-losses definition (Pitfall 3) and must be
   *  RE-INVOKED on every restart, not reused, because the ACC's own text redefines the
   *  tied group at every step ("if necessary, the tiebreaker will restart, including the
   *  definition of tied teams"). */
  defineTiedTeams: (
    baseOrdering: BaseOrdering,
    records: ReadonlyMap<TeamId, ConferenceRecord>,
    slot: 1 | 2
  ) => readonly TeamId[]
  /** Ordered, EXECUTABLE steps only — the terminal ranking/draw step is omitted per D-03. */
  twoTeamSteps: readonly TiebreakerStepId[]
  multiTeamSteps: readonly TiebreakerStepId[]
  /** D-04: static metadata used to populate NeedsUserInput.reason when the last computable
   *  step doesn't fully separate the group. */
  terminalReason: TerminalReason
}
```

For SEC/Big Ten/Big 12, `defineTiedTeams` is a one-line shared helper: return the base-ordering bucket at the requested slot (index 0 for the #1 spot, or the bucket at whatever slot remains open after the #1 spot is resolved for the #2 spot). For the ACC, it must independently implement Pitfall 3's two-step definition:

```ts
// ACC-specific — shared/domain/tiebreakers/acc.ts
function defineAccTiedTeams(baseOrdering, records, slot): readonly TeamId[] {
  const bestPctRecords = /* the bucket at `slot`, or for slot=1, baseOrdering[0] */
  const bestWins = new Set(bestPctRecords.map(r => r.wins))
  const bestLosses = new Set(bestPctRecords.map(r => r.losses))
  // Step 2: pull in ANY other team (regardless of base-ordering position) that played an
  // alternate number of conference games AND matches wins-OR-losses with the Step-1 group.
  const extra = allAccRecords.filter(r =>
    r.gamesPlayed !== bestPctRecords[0].gamesPlayed &&
    (bestWins.has(r.wins) || bestLosses.has(r.losses))
  )
  return [...bestPctRecords.map(r => r.teamId), ...extra.map(r => r.teamId)]
}
```

This function must scan **all** ACC conference records, not just the base-ordering neighborhood of the target slot — a lower-placed team with a matching win/loss count on a different schedule length can be pulled into the tie from well below the raw win-pct cutoff. This is the concrete mechanism behind PITFALLS.md's "a 7-1 (.875) team and a 7-2 (.778) team are tied" example, and is directly testable against the real 2026 ACC schedule counts confirmed above.

### Recursive restart algorithm — adapted to the 2-valued/nested-cycle trace

This is the direct, type-concrete adaptation of Pitfall 1's pseudocode to D-01 (2-valued return) and D-07–D-09 (nested cycles, full step visibility, per-cycle tied-team lists):

```ts
// shared/domain/tiebreakers/engine.ts
function resolveTiedGroup(
  tiedTeams: readonly TeamId[],
  rules: ConferenceRules,
  procedureFor: (size: number) => readonly TiebreakerStepId[],  // rules.twoTeamSteps or rules.multiTeamSteps
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>,
  cycles: TiebreakerCycle[] = []                                 // accumulator, becomes `trace`
): TiebreakerResult {
  const steps: StepOutcome[] = []
  let remaining = tiedTeams

  for (const stepId of procedureFor(tiedTeams.length)) {
    const outcome = evaluateStep(stepId, remaining, baseOrdering, records)  // pure; never mutates
    steps.push(outcome)                                            // D-07: record EVERY attempted step

    if (!outcome.separated) continue                               // "continue on no separation" branch

    const [winners, ...restBuckets] = outcome.partition
    const rest = restBuckets.flat()

    if (winners.length === 1 && rest.length === 0) {
      // fully resolved within this cycle
      cycles.push({ tiedTeams, steps, outcome: 'resolved',
        removed: [{ teamId: winners[0], reason: 'seeded', atStep: stepId }] })
      return { status: 'resolved', order: [winners[0]], trace: cycles }
    }

    if (winners.length >= 1 && rest.length > 0) {
      // PARTIAL separation -> RESTART with the reduced group (Pitfall 1's core rule)
      cycles.push({ tiedTeams, steps, outcome: 'restart',
        removed: winners.map(teamId => ({ teamId, reason: 'seeded' as const, atStep: stepId })) })
      // invariant (a): `rest` is strictly smaller than `tiedTeams` -- guarantees termination
      const restResult = resolveTiedGroup(rest, rules, procedureFor, baseOrdering, records, cycles)
      return prepend(winners, restResult)   // winners rank ahead of whatever `rest` resolves to
    }
    // winners.length === 0 is impossible by construction of `partition` -- assert in dev builds
  }

  // Every executable step ran; group never fully separated -> D-01's NeedsUserInput
  cycles.push({ tiedTeams, steps, outcome: 'exhausted', removed: [] })
  return {
    status: 'needsUserInput',
    tiedTeams: remaining,
    reason: rules.terminalReason,          // D-04
    trace: cycles
  }
}
```

Two invariants to assert explicitly in the implementation (Pitfall 1's own recommendation, restated against this exact function):

1. **Every recursive call receives a strictly smaller `tiedTeams` array than its caller.** `rest.length < tiedTeams.length` must hold whenever `resolveTiedGroup` recurses — add a runtime assertion in dev/test builds, and a fixture that would infinite-loop without it (a step that "separates" a group but returns the full original set back as `rest`).
2. **An eliminated team never re-enters `remaining` in a later cycle.** Enforced structurally here since each recursive call only ever receives `rest` (a subset), never the original `tiedTeams` — but add a fixture asserting the final `order` contains no duplicates and exactly matches the original tied-team count.

**The "continue on no separation" branch is the `if (!outcome.separated) continue` line** — easy to omit by accident (Pitfall 1's own warning sign #2: "there is no recursion and no function that calls itself with a reduced team set" usually co-occurs with this branch being missing too, since a naive linear-loop implementation has no concept of "this step changed nothing, try the next one on the SAME group" vs. "restart from step one").

### `StepValue`/`Indeterminate` — the NaN guard (Pitfall 4)

```ts
export type StepValue =
  | { kind: 'record'; wins: number; losses: number; winPct: number }
  | { kind: 'indeterminate' }   // zero common opponents / zero games in this comparison -- NEVER a bare 0/0
  | { kind: 'headToHead'; result: 'beat-all' | 'lost-to-all' | 'mixed' | 'no-common-games' }
```

Ban bare `wins / games` arithmetic anywhere in `steps.ts`; route every ratio through a helper that returns `{ kind: 'indeterminate' }` for a zero denominator, and treat `'indeterminate'` values as **not separating** anyone at that step (falls through to `continue`, never poisons a comparison as if it were `0`). Add a fixture (already required by D-10) asserting no `StepValue` of kind `'record'` is ever constructed with a `NaN` `winPct`.

### Full type surface (consolidated)

```ts
// shared/domain/tiebreakers/types.ts
export type TeamId = number
export type GameId = number
export type ConferenceId = 'SEC' | 'Big Ten' | 'Big 12' | 'ACC'

export type TiebreakerStepId =
  | 'head-to-head'
  | 'common-opponents'
  | 'next-highest-placed-common-opponent'
  | 'cumulative-opponent-win-pct'
  | 'total-wins'                 // Big 12 step (e) only, with the FCS-win cap folded into deriveConferenceRecords or applied here

export interface StepOutcome {
  step: TiebreakerStepId
  values: ReadonlyArray<{ teamId: TeamId; value: StepValue }>   // D-07: every team, every step
  partition: readonly TeamId[][]                                 // best-to-worst; inner arrays = still-tied groups
  separated: boolean
}

export interface TiebreakerCycle {
  tiedTeams: readonly TeamId[]              // D-09: every cycle, every conference
  steps: readonly StepOutcome[]
  outcome: 'resolved' | 'restart' | 'exhausted'
  removed: readonly { teamId: TeamId; reason: 'seeded' | 'eliminated'; atStep: TiebreakerStepId }[]
}

export interface TerminalReason {
  code: 'ranking-step' | 'needs-scores' | 'draw'
  ruleCitation: string
  sourceName: string
}

export type TiebreakerResult =
  | { status: 'resolved'; order: readonly TeamId[]; trace: readonly TiebreakerCycle[] }
  | { status: 'needsUserInput'; tiedTeams: readonly TeamId[]; reason: TerminalReason; trace: readonly TiebreakerCycle[] }

export interface ChampionshipResult {
  conference: ConferenceId
  seed1: TiebreakerResult   // resolving the #1 spot
  seed2: TiebreakerResult   // resolving the #2 spot, run against whatever `seed1` leaves as contenders
}
```

`ChampionshipResult` is the outer, two-layer shape: `resolveConferenceChampionship` runs `resolveTiedGroup` once for the #1 spot (against `defineTiedTeams(baseOrdering, records, 1)` and `rules.twoTeamSteps`/`multiTeamSteps` as appropriate) and, using whatever teams remain uncommitted, again for the #2 spot. **Every conference's document treats "tied for No. 1" and "tied for No. 2" as at least partially distinct cases** (Big Ten/Big 12 both spell this out explicitly in their two-team sections; the ACC's "Top Two Teams" framing folds both into one definition, meaning the ACC's `defineTiedTeams(slot=1)` and `defineTiedTeams(slot=2)` may need to be a single combined call rather than two independent ones — flagged as an open question below, since neither PITFALLS.md nor this session's re-verification pins down the ACC's #1-vs-#2 orchestration in as much explicit procedural detail as Big Ten/Big 12).

### Module structure recommendation

Follow ARCHITECTURE.md's sketch, but note the project's own established test-file convention (from Phase 1: flat `tests/*.test.ts` with a `tests/fixtures/` subdirectory, not `shared/domain/__tests__/`):

```
shared/domain/tiebreakers/
├── types.ts          # TeamId, ConferenceId, StepOutcome, TiebreakerCycle, TerminalReason, TiebreakerResult, ChampionshipResult
├── records.ts         # deriveConferenceRecords -- the Phase 5 DRY seam
├── baseOrdering.ts     # computeBaseOrdering
├── steps.ts            # evaluateStep + one function per TiebreakerStepId, StepValue helpers (NaN guard)
├── engine.ts            # resolveTiedGroup (recursive core), resolveConferenceChampionship (2-layer orchestration)
├── rules.ts               # CONFERENCE_RULES data table; SEC/Big Ten/Big 12 share a `defineTiedTeams`
└── acc.ts                  # ACC-specific defineTiedTeams (Pitfall 3) -- kept separate since it's genuinely different code, not data

tests/
├── fixtures/
│   └── tiebreakers/
│       ├── sec.fixtures.ts
│       ├── bigten.fixtures.ts
│       ├── big12.fixtures.ts
│       └── acc.fixtures.ts
├── tiebreakers-sec.test.ts
├── tiebreakers-bigten.test.ts
├── tiebreakers-big12.test.ts
├── tiebreakers-acc.test.ts
└── tiebreakers-engine.test.ts       # conference-agnostic: restart/continue invariants, NaN guard, no-re-entry
```

The 6-file split (`{types,records,baseOrdering,steps,engine,rules}.ts` + `acc.ts`) is recommended over a single file: `records.ts` is the DRY seam Phase 5 will import independently and should be import-able without pulling in the recursive engine; `steps.ts` is where the NaN-guard discipline needs to be enforced and is the most fixture-dense file; keeping `acc.ts` separate from `rules.ts` makes the ACC's structural difference (Pitfall 3 / Architecture Contradiction 5) visible at the file-listing level, not just in a comment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conference win/loss/games-played tallying | A second implementation inside Phase 5's `computeStandings()` | This phase's `deriveConferenceRecords()`, imported by Phase 5 | PROJECT.md's DRY constraint states standings computation has exactly one implementation; this phase is built first and must own the canonical version so Phase 5 doesn't duplicate it |
| Multi-team tie resolution as a comparator chain | `teams.sort((a,b) => ...)` over any of the four conferences' steps | The recursive `resolveTiedGroup()` above | Every conference restarts on partial separation (Pitfall 1); a sort can never express "go back to step one for the remaining teams" |
| SportSource Analytics ranking approximation | A homegrown formula estimating the proprietary rating | `NeedsUserInput` with `reason.code: 'ranking-step'` | The rating is proprietary and unpublished (PITFALLS.md); any approximation is a guess presented as fact, which is worse than an honest "we can't compute this" |
| ACC tied-group definition | `groupBy(winPct)` reused from the SEC/Big Ten/Big 12 shared helper | The dedicated `defineAccTiedTeams()` in `acc.ts` | The ACC's definition includes teams with equal wins-or-losses on a different schedule length — a genuinely different algorithm, not a parameterization of the same one (Pitfall 3) |
| "Next highest-placed common opponent" ordering | Recomputing standings order mid-procedure to answer "who's next" | The frozen `BaseOrdering`, computed once and passed as a plain value | Recomputing mid-procedure creates the circular dependency Pitfall 4 describes (resolving a tie for 1st requires resolving the tie for 4th) |

**Key insight:** every "don't hand-roll" item above is really the same lesson stated four ways — the four conferences' documents are the API, and any shortcut that feels DRY but doesn't come directly from that text (a shared comparator, a shared `groupBy`, a recomputed ranking) is reintroducing exactly the bug class Pitfalls 1–6 catalog.

## Runtime State Inventory

Not applicable — this is a greenfield phase (new `shared/domain/tiebreakers/` module; no rename, refactor, or migration of existing runtime state).

## Common Pitfalls

The project's own PITFALLS.md already contains an exhaustive, primary-source-grounded catalog (Pitfalls 1–6) directly scoped to this phase. Re-verification this session found no drift in the underlying rule text (see "Primary Source Re-Verification" above). Restating only the parts that changed shape once grounded against the actual engine design above:

### Pitfall: The "continue" branch is easy to omit even when the "restart" branch is implemented correctly
**What goes wrong:** A `resolveTiedGroup` that handles partial separation (restart) correctly but treats "this step didn't separate anyone" as an implicit fallthrough to the next iteration of a `for` loop, without an explicit `continue`, can accidentally re-run the *same* step against the *same* group on the next call if the loop structure is later refactored into recursion-per-step rather than recursion-per-cycle.
**Why it happens:** The restart case is the "interesting" one and gets the most test-writer attention; the continue case (`if (all still tied) → try the next comparator on this exact group`) looks like a no-op and is easy to leave unstated.
**How to avoid:** Write the loop as in "Recursive Restart Algorithm" above — one `for` over `procedureFor(...)` with an explicit `if (!outcome.separated) continue`. Assert in a fixture that a group tied after step 1 and separated at step 3 produces a trace with **two** `StepOutcome` entries for step 1 and step 2 both showing `separated: false` before step 3's `separated: true` — this directly tests D-07's "record every attempted step" requirement and the continue branch simultaneously.

### Pitfall: The #1-vs-#2 seed orchestration is a second place restart semantics can be gotten wrong
**What goes wrong:** Big Ten and Big 12 explicitly differentiate "tied for No. 1" (both play the CCG; the tiebreaker only decides ranking) from "tied for No. 2" (the tiebreaker decides who represents, full stop) in their two-team sections. A naive implementation that runs the exact same `resolveTiedGroup` call for both seeds without accounting for this distinction can produce a wrong participant list even when the inner recursive engine is bug-free.
**Why it happens:** The inner recursive engine (this phase's main deliverable) is complex enough to absorb all the design attention; the outer #1-then-#2 orchestration looks like a trivial "call it twice" wrapper.
**How to avoid:** Model `resolveConferenceChampionship` as explicitly two calls (see `ChampionshipResult` above), each against the correct `defineTiedTeams(..., slot)` and — where the source text differs for slot 1 vs slot 2 (Big Ten/Big 12: "if tied for No. 1, both teams already play; the tiebreaker sets seeding order" vs. "if tied for No. 2, the tiebreaker decides who plays at all") — encode that difference explicitly rather than treating both calls as identical. Flagged as an open question below since the exact SEC/ACC treatment of this distinction needs a Wave 0 fixture-writing pass to pin down precisely.

### Pitfall: A `[VERIFIED]` PDF re-fetch can still be an interstitial page, not the document
**What goes wrong:** `theacc.com` and `big12sports.com` both serve an HTML "your document is ready to download" interstitial to a plain HTTP GET (including through `WebFetch`), not the PDF bytes — a build script or a future re-verification pass that does `fetch(url).then(r => r.text())` and greps for tiebreaker language will silently match nothing (or worse, match on stale cached text from a previous run) and report a false "no drift."
**Why it happens:** These sites use a client-side JS redirect or a signed-URL indirection layer (both resolved to a direct `s3.amazonaws.com` URL, extractable from the interstitial HTML's own markup) rather than serving the PDF at the documented URL directly.
**How to avoid:** If this project ever automates a re-verification check (not currently planned, but worth documenting since this phase's research needed to work around it live), download with a real `curl`/`fetch` that follows redirects and inspects the response `Content-Type`/magic bytes before trusting a "no drift" result — an HTML response where a PDF is expected should hard-fail the check, not silently pass.

## Code Examples

### `vitest.config.ts` — D-11's per-directory coverage threshold

`[VERIFIED: vitest.dev/config/coverage docs]`. The project's existing `vitest.config.ts` (committed by Phase 1) has no `coverage` block at all — this phase adds one:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts'],
      exclude: ['shared/**/*.d.ts'],
      thresholds: {
        // Global thresholds intentionally left unset/low until more of the app exists --
        // this phase's gate is scoped ONLY to the tiebreaker directory, per D-11.
        'shared/domain/tiebreakers/**': {
          statements: 90,   // exact percentage left to planning per D-11's discretion note
          branches: 90,     // branches matters most here -- the restart/continue split IS a branch
          functions: 90,
          lines: 90
        }
      }
    }
  }
})
```

Two things worth flagging for planning's threshold decision: (1) `branches` is the metric most worth holding to a high bar in this specific module, since the restart-vs-continue distinction (Pitfall 1) and the `Indeterminate`-vs-`record` distinction (Pitfall 4) are both literal branches that a fixture gap would leave silently untested; (2) `@vitest/coverage-v8`'s `v8` provider (not `istanbul`) is already the installed provider (`package.json` devDependency), consistent with the version already pinned to match `vitest@^4.1.10` — no provider-choice decision needed.

### A minimal fixture shape, grounded in the real ACC 2026 data

```ts
// tests/fixtures/tiebreakers/acc.fixtures.ts
// Real 2026 ACC team ids from public/data/2026/teams.json — confirmed 8-game teams:
// Boston College, Clemson, Florida State, Georgia Tech, North Carolina.
// A fixture exercising the mixed-8/9-game defineTiedTeams pull-in (Pitfall 3) needs at
// least one 8-game and one 9-game team landing on the SAME win count via distinct paths --
// e.g. an 8-game team going 7-1 (.875) and a 9-game team going 7-2 (.778): both have 7 wins,
// so ACC Step 1(b) pulls the 9-game team into the tie despite the lower win percentage.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| ACC tiebreaker keyed strictly on conference win percentage | ACC tiebreaker keyed on win percentage **plus** wins-or-losses-match for alternate-schedule teams | July 1, 2026 | Directly load-bearing for this phase's ACC `defineTiedTeams` — re-confirmed unchanged as of this research session (2026-08-13) |
| ACC 8-team divisional round-robin-adjacent scheduling | ACC 17-team, mixed 8/9-game conference schedule (5 teams at 8, 12 at 9) | 2026 season (per the July 2026 policy's own stated rationale) | This is why the alternate-schedule clause exists at all; confirmed live in the committed 2026 schedule, not just the policy text |

**Deprecated/outdated:** The 2023 ACC Tiebreaker Policy (superseded by the July 2026 amendment) used a strict win-percentage tie definition with no alternate-schedule accommodation — do not reference it for anything beyond understanding *why* the 2026 policy changed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | SEC's exact ordered-step list and multi-team restart clause (PITFALLS.md's extraction, re-affirmed here) are accurate, despite no primary PDF being directly retrievable this session or in prior research | Primary Source Re-Verification (SEC) | If the SEC's actual document differs in step order or restart wording from the secondary-source reproduction, the SEC's `CONFERENCE_RULES` entry and its fixtures would need rework; MEDIUM risk given 4 independent secondary sources (ESPN, 247Sports, PFN, DawgNation) agree |
| A2 | The SEC does not explicitly differentiate "tied for No. 1" vs. "tied for No. 2" procedures the way Big Ten/Big 12 do (no such split found in any source reviewed) | Concrete Engine Design (`ChampionshipResult` orchestration) | If the SEC does have an unstated #1-vs-#2 split, `resolveConferenceChampionship`'s two-call design would still work but might call the wrong `procedureFor` variant at the #1 spot; LOW risk since D-10's fixture matrix will surface this quickly |
| A3 | The ACC's "Top Two Teams" definition is applied once (yielding a group of 2+ contenders for both CCG spots together) rather than as two separate slot-1/slot-2 definition passes the way SEC/Big Ten/Big 12 structurally are | Concrete Engine Design (`ChampionshipResult`) | If wrong, the ACC-specific orchestration in `resolveConferenceChampionship` needs a different code path than the shared one; MEDIUM risk — this is the least explicitly documented part of the ACC's own text among the four conferences and is flagged as an Open Question below |
| A4 | Big 12's "collective tied teams as a group" clause (quoted in full above) is intended to apply exactly as literally written, uniformly, whenever the "next highest-placed common opponent" walk reaches a raw-standings-tied bucket — as opposed to D-05's more conservative one-opponent-at-a-time reading | Primary Source Re-Verification (flagged finding) | Directly determines whether a specific class of Big 12 4+/5-way tie fixture (D-10 requires one) produces a different champion under the two readings; the flagged-finding subsection recommends explicit user confirmation before Wave 0 locks in the fixture's expected output |
| A5 | Every P4 conference tiebreaker step is scoped strictly to conference games between conference members — no step anywhere in any of the four documents references overall/non-conference record | Concrete Engine Design (input contract) | If wrong, the engine's input contract (conference-games-only) would be incomplete and need overall-record data threaded through; LOW risk — directly confirmed by re-reading all 3 retrievable primary PDFs' full step lists this session, none reference non-conference games |

**If this table is empty:** not applicable — see entries above.

## Open Questions

1. **Should the Big 12's "collective bucket" opponent-tie treatment be implemented per its literal, now-reconfirmed text, or per D-05's conservative one-opponent-at-a-time reading?**
   - What we know: the primary PDF states the collective-group treatment affirmatively and identically in both its two-team and multi-team sections (quoted in full above).
   - What's unclear: whether D-05's conservative choice was made with full awareness of this exact text, or based on the shorter aggregator page that doesn't contain it — D-06's own wording suggests the latter.
   - Recommendation: surface to the user for an explicit confirmation before the Big 12's dedicated fixture (required by D-06) locks in an expected value; this is a `checkpoint:human-verify`-shaped decision, not a plan-time judgment call.

2. **How exactly does each conference structurally separate "who's tied for the No. 1 spot" from "who's tied for the No. 2 spot" when the raw base ordering has more than 2 teams in contention?**
   - What we know: Big Ten and Big 12 both spell this out explicitly and identically in their two-team sections (No. 1 tie → both already play, tiebreaker only orders them; No. 2 tie → tiebreaker decides who plays at all). The ACC's "Top Two Teams" language reads as a single combined definition. The SEC's sourced text does not make an explicit No. 1/No. 2 split at all in the material reviewed by this research or the prior PITFALLS.md pass.
   - What's unclear: the SEC's and ACC's exact orchestration when 3+ teams are in contention for the top 2 spots collectively (not just a clean 2-tied-for-1st or 2-tied-for-2nd case) — e.g. a 3-way tie for 1st where the loser of that tiebreaker might still be in contention for the 2nd spot against a 4th team.
   - Recommendation: this is exactly the kind of scenario D-10's "3-, 4-, and 5-way tie" fixture requirement should be written to exercise directly per conference; treat the fixture-writing pass itself as the mechanism that will force this question to a concrete, testable answer, rather than trying to resolve it in the abstract during planning.

3. **Does the Big 12's FCS-win cap (step e, "Total number of wins in a 12-game season... only one win against a team from the NCAA Football Championship Subdivision... will be counted annually") belong in `deriveConferenceRecords` (shared with Phase 5) or as a Big-12-specific adjustment inside `steps.ts`?**
   - What we know: the cap only affects overall win totals used in the Big 12's own step (e), which is not one of the fields `deriveConferenceRecords` currently computes (that function is conference-games-only; the Big 12's step (e) explicitly needs a season-wide "12-game season" win count, which includes non-conference and FCS opponents).
   - What's unclear: whether this pulls the engine's input contract to also need each team's *overall* record (not just conference-games), contradicting Assumption A5 above for this one specific step.
   - Recommendation: confirmed on closer reading of the Big 12 PDF — step (e) is genuinely the one exception to A5, since "total number of wins in a 12-game season" is explicitly a season-wide count, not a conference-games-only count. Planning should add a second, narrower helper (e.g. `deriveOverallWinCount(allGames, outcomes, fcsWinCap: 1)`) scoped only to the Big 12's step (e), rather than widening the shared `deriveConferenceRecords` contract for every conference over one Big-12-only step.

## Environment Availability

Not applicable — this phase has no external tool, service, or runtime dependency beyond the already-installed Node/pnpm/Vitest toolchain confirmed present in Phase 1 and Phase 2's scaffolding. No new installs, no network calls, no external services.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`[VERIFIED: package.json]`), `environment: 'node'` |
| Config file | `vitest.config.ts` (exists; needs the `coverage` block added per D-11 — see Code Examples above) |
| Quick run command | `pnpm test -- tests/tiebreakers-<conf>.test.ts` |
| Full suite command | `pnpm test` (runs `vitest run` — `[VERIFIED: package.json scripts.test]`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| TIE-01 | Automatic resolution to championship participants wherever computable, for each of SEC/Big Ten/Big 12/ACC | unit | `pnpm test -- tests/tiebreakers-sec.test.ts` (and `-bigten`, `-big12`, `-acc`) | ❌ Wave 0 |
| TIE-02 | Each conference's rules match its own published procedure, including ACC's 8/9-game and non-win-pct tie definition | unit | `pnpm test -- tests/tiebreakers-acc.test.ts` | ❌ Wave 0 |
| TIE-03 | Multi-team restart-on-partial-separation and continue-on-no-separation, both branches, with a divergence fixture | unit | `pnpm test -- tests/tiebreakers-engine.test.ts` | ❌ Wave 0 |
| TIE-04 | Uncomputable steps surface `NeedsUserInput` with a reason and citation, never guess | unit | `pnpm test -- tests/tiebreakers-engine.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the specific conference's fixture file (`pnpm test -- tests/tiebreakers-<conf>.test.ts`), sub-second given `environment: 'node'` and no Nuxt boot.
- **Per wave merge:** full suite (`pnpm test`).
- **Phase gate:** full suite green, plus D-11's coverage threshold on `shared/domain/tiebreakers/**` passing, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `shared/domain/tiebreakers/{types,records,baseOrdering,steps,engine,rules,acc}.ts` — none of this module exists yet; this entire phase is Wave 0 in the sense that there is no prior tiebreaker code to extend.
- [ ] `tests/fixtures/tiebreakers/{sec,bigten,big12,acc}.fixtures.ts` — hand-verified fixture data per D-10, none exist yet.
- [ ] `tests/tiebreakers-{sec,bigten,big12,acc,engine}.test.ts` — none exist yet.
- [ ] `vitest.config.ts` coverage block — needs the D-11 addition shown in Code Examples.
- [ ] `@vitest/coverage-v8` — already installed (`package.json`), no action needed beyond config.

*(No prior tiebreaker infrastructure exists to build on — every item above is new.)*

## Security Domain

`security_enforcement` is enabled in `.planning/config.json` (ASVS Level 1, block on `high`). This phase is pure, deterministic domain logic over already-validated, build-time-committed static data (`teams.json`/`games.json`, both schema-validated and hash-fingerprinted by Phase 1) plus in-memory picked outcomes supplied by the caller. It has **no network access, no user-controlled input parsing, no persistence, no rendering, and no authentication/session surface** — the ASVS categories that would normally apply to a phase are almost entirely not applicable here.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | No auth surface in this app at all (SCEN-05: no accounts) |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No multi-user access boundaries |
| V5 Input Validation | Partial | The engine's `outcomes: ReadonlyMap<GameId, TeamId>` input is caller-supplied; TypeScript's type system plus a dev-mode assertion that every `GameId` key corresponds to a real conference game and every `TeamId` value is one of that game's two participants is sufficient here — the actual untrusted-input boundary (share-link payload decoding) belongs to Phase 8, not this phase, per PITFALLS.md's Pitfall on share-link validation |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A malformed/incomplete `outcomes` map causing the recursive engine to infinite-loop or throw an unhandled exception | Denial of Service (localized — a client-side crash, not a network-facing DoS) | The two recursion invariants documented in "Recursive Restart Algorithm" (strictly-smaller group per call; no re-admission of eliminated teams), enforced with dev-mode assertions and directly fixture-tested per D-10's coverage requirement |
| A `GameId` in `outcomes` that doesn't correspond to any game in `conferenceGames`, or a `TeamId` value that isn't one of that game's two participants | Tampering (in the sense of malformed caller input, not an external attacker — this data never crosses a trust boundary within this phase) | Validate at the function boundary (`resolveConferenceChampionship`'s entry) and fail loudly (throw) rather than silently producing a wrong result; this is a programmer-error guard, not a security control against an external attacker, since the actual external-input boundary is Phase 8's share-link decoder |

## Sources

### Primary (HIGH confidence)

- ACC Football Tiebreaker Policy, as amended July 1, 2026 — `theacc.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf` (fetched via S3 redirect, full text read, re-confirmed 2026-08-13, no drift from PITFALLS.md)
- 2024 Big Ten Football Championship Game Tiebreaker — `bigten.org/api/media/file/...` (redirects to `img.boostsport.ai`, full text read, re-confirmed 2026-08-13, no drift)
- Big 12 Football Tiebreaker Policy (2024–present, 16-team) — `big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf` (fetched via S3 direct link, full text read, re-confirmed 2026-08-13, no drift — and see the flagged finding regarding the "collective bucket" clause)
- `public/data/2026/teams.json`, `public/data/2026/games.json` — the actual committed Phase 1 output, queried directly this session for real team/conference-size/schedule-count facts
- `scripts/lib/schemas.ts` — the actual committed `Team`/`Game` field shapes (`RawTeamSchema`, `RawGameSchema`, `TeamOutput`, `GameOutput`)
- `package.json` — confirms `@vitest/coverage-v8@^4.1.10` and `vitest@^4.1.10` already installed and version-matched
- `vitest.dev/config/coverage` official docs — glob-pattern per-directory thresholds, `perFile`, provider syntax

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` §"Conference Tiebreaker Specification Source" and Pitfalls 1–6 — this phase's primary re-verification target; found to be accurate and unchanged
- SEC procedure — `secsports.com` announcement (re-checked this session, shallow content only), plus PITFALLS.md's own already-cited ESPN/247Sports/PFN/DawgNation sources (not independently re-fetched this session; no indication of a policy change since 2024)
- `.planning/research/ARCHITECTURE.md` — Patterns 5 & 6, `CONFERENCE_RULES`/trace sketches (superseded in specifics by D-01/D-07–D-09 and this document's concrete types, but the overall shape recommendation stands)
- `.planning/research/SUMMARY.md` — "Phase 3b" scope and "Research Flags" section, which correctly identifies the Big Ten/SEC collective-bucket extrapolation gap (distinct from the Big 12's own, now-confirmed-unambiguous text)

### Tertiary (LOW confidence)

- None used as load-bearing sources in this document — every rule-content claim traces to a primary PDF re-read this session or to PITFALLS.md's own primary/secondary sourcing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing `@vitest/coverage-v8` version already matches `vitest`, confirmed directly against `package.json`
- Architecture (engine/trace design): MEDIUM-HIGH — grounded in real committed Phase 1 data and the project's own established test-file conventions, but the concrete shapes are new and will only be validated once Wave 0 fixtures are written against them
- Conference rule content (ACC/Big Ten/Big 12): HIGH — all three re-fetched and re-read verbatim this session, zero drift from PITFALLS.md
- Conference rule content (SEC): MEDIUM — unchanged from PITFALLS.md; primary PDF still not directly retrievable
- Pitfalls: HIGH — PITFALLS.md's Pitfalls 1–6 are directly grounded in the same primary sources re-verified this session

**Research date:** 2026-08-13
**Valid until:** 30 days for the engine-design content (stable once implemented); re-verify the ACC PDF specifically before each future season if this codebase is ever extended past 2026, since the ACC amended its policy once already (2023 → 2026) and explicitly designed the current policy around the 2026 season's specific 8/9-game split
