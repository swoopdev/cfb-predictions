/**
 * A CFBD team id. Kept as a distinct alias (not a bare `number`) so every
 * tiebreaker function signature below documents its own intent at a glance.
 */
export type TeamId = number

/**
 * A CFBD game id.
 */
export type GameId = number

/**
 * The four power conferences this phase's tiebreaker engine resolves
 * championship participants for (PROJECT.md's stated v1 scope — G5
 * conferences are pickable but have no standings/tiebreaker UI).
 */
export type ConferenceId = 'SEC' | 'Big Ten' | 'Big 12' | 'ACC'

/**
 * The minimal game shape the tiebreaker engine needs. Deliberately NOT
 * importing `GameOutput` from `scripts/lib/schemas.ts` -- `shared/domain/`
 * must stay decoupled from the `scripts/` directory, which is a one-time
 * build-time fetch tool, not app runtime code. `Game` is structurally
 * compatible with `GameOutput` (a subset of its fields), so Phase 2/4/5
 * callers can pass a real fetched `GameOutput` value directly wherever a
 * `Game` is expected, with no cast and no adapter layer required.
 */
export interface Game {
  id: GameId
  homeId: TeamId
  awayId: TeamId
  conferenceGame: boolean
}

/**
 * The frozen, best-to-worst raw-win-percentage ordering of a conference's
 * teams, grouped into buckets: `bucket.length > 1` means those teams are
 * tied on raw win percentage at that slot. Computed once per
 * `resolveConferenceRanking` call and passed as a plain value into
 * every step evaluator -- this is the direct fix for PITFALLS.md Pitfall
 * 4's circularity trap ("resolving a tie for 1st requires resolving the
 * tie for 4th"). Never recomputed mid-procedure.
 */
export type BaseOrdering = readonly TeamId[][]

/**
 * Identifier for a tiebreaker step. All five step types are implemented
 * by `evaluateStep` in `steps.ts`.
 */
export type TiebreakerStepId
  = | 'head-to-head'
    | 'common-opponents'
    | 'next-highest-placed-common-opponent'
    | 'cumulative-opponent-win-pct'
    | 'total-wins'

/**
 * The result of evaluating a team at a single tiebreaker step.
 * - `{ kind: 'record' }`: a win percentage computed over a defined set of games
 * - `{ kind: 'indeterminate' }`: the step does not apply (e.g. zero common opponents)
 * - `{ kind: 'headToHead' }`: the result of a head-to-head comparison (round-robin or non-round-robin)
 */
export type StepValue
  = | { kind: 'record', wins: number, losses: number, winPct: number }
    | { kind: 'indeterminate' }
    | { kind: 'headToHead', result: 'beat-all' | 'lost-to-all' | 'mixed' | 'no-common-games' }

/**
 * The outcome of applying a single tiebreaker step to a tied group.
 * Partitions the group into ordered buckets (best to worst); separated
 * indicates whether the top bucket is a strict subset (true) or the entire
 * group tied (false).
 */
export interface StepOutcome {
  step: TiebreakerStepId
  values: ReadonlyArray<{ teamId: TeamId, value: StepValue }>
  partition: readonly TeamId[][]
  separated: boolean
}

/**
 * A single cycle in the recursive tiebreaker resolution.
 * Records the tied teams at the start of the cycle, all steps attempted
 * in this cycle, the outcome (resolved, restart, or exhausted), and which
 * teams were removed (seeded or eliminated) at the end.
 *
 * D-08: Restarts are represented as nested cycle groups, not a flat step
 * list. The trace is an array of cycles; each cycle has its own ordered
 * step list and records which team(s), if any, were removed at the end.
 *
 * D-09: Every cycle records its own explicit tied-team list. This gives
 * one consistent trace shape across conferences.
 */
export interface TiebreakerCycle {
  tiedTeams: readonly TeamId[]
  steps: readonly StepOutcome[]
  outcome: 'resolved' | 'restart' | 'exhausted'
  removed: readonly { teamId: TeamId, reason: 'seeded' | 'eliminated', atStep: TiebreakerStepId }[]
}

/**
 * Terminal-step metadata used to populate NeedsUserInput.reason when the
 * last computable step doesn't fully separate the tied group.
 *
 * D-04: static metadata (reason code + citation text + source name) attached
 * separately from the executable step list, used to populate ruleCitation
 * when manual intervention is needed. Keeps the step list purely executable;
 * citation text is purely descriptive.
 */
export interface TerminalReason {
  code: 'ranking-step' | 'needs-scores' | 'draw'
  ruleCitation: string
  sourceName: string
}

/**
 * The result of resolving a tied group to a final order (or identifying
 * that the group cannot be resolved without user input).
 *
 * D-01: Return type is 2-valued: Resolved(order) | NeedsUserInput(tiedTeams,
 * reason, trace). No separate Impossible variant — a human can always pick
 * a winner, even where the official procedure would use a coin-flip draw.
 */
export type TiebreakerResult
  = | { status: 'resolved', order: readonly TeamId[], trace: readonly TiebreakerCycle[] }
    | {
      status: 'needsUserInput'
      tiedTeams: readonly TeamId[]
      reason: TerminalReason
      trace: readonly TiebreakerCycle[]
    }

/**
 * How a single rank slot (or shared rank) was determined.
 *
 * - `sole-candidate`: exactly one team occupied the pool for this slot; no
 *   tiebreaker procedure ran at all.
 * - `tiebreaker`: the published procedure separated a real tie and produced
 *   a single winner for this slot.
 * - `manual`: the user ordered an irreducible group by hand (D-17). Plan
 *   06-05 populates this variant; unused until then.
 * - `unresolved`: the procedure exhausted every computable step without
 *   separating the group; all of `RankGroup.teams` share this one rank.
 */
export type RankGroupResolution = 'sole-candidate' | 'tiebreaker' | 'manual' | 'unresolved'

/**
 * One rank slot in a conference's full 1..N ordering (D-01, D-03, TIE-08).
 *
 * `ConferenceRanking.groups` is an ORDERED sequence, best to worst — this is
 * what makes seed 1 (`groups[0]`) and seed 2 (`groups[1]`) structurally
 * incapable of contradicting each other (D-12): one sequence produces both,
 * unlike the two independent per-seed resolutions the pre-Plan-06-02 engine
 * used to run.
 */
export interface RankGroup {
  /**
   * D-01/D-05: `teams.length === 1` is a single resolved rank. `teams.length
   * > 1` means the procedure genuinely could not separate these teams — they
   * share one rank number and are marked tied. Never both true and false at
   * once: `teams.length === 1` implies `resolvedBy` is `'sole-candidate'` or
   * `'tiebreaker'`; `teams.length > 1` implies `resolvedBy` is `'unresolved'`
   * (until Plan 06-05 introduces `'manual'`) and `terminalReason` is set.
   */
  teams: readonly TeamId[]
  resolvedBy: RankGroupResolution
  /**
   * D-10: the full pool of candidates ever in contention for this slot —
   * drives marker (a), "separated only by tiebreaker despite other
   * candidates." `contestedWith.length === 1` exactly when `resolvedBy` is
   * `'sole-candidate'`.
   *
   * Computed as the UNION of the initial pool and every cycle's `tiedTeams`
   * in this group's own `trace`, not merely the initial pool in isolation.
   * This is a deliberate widening from the naive "initial pool only" reading:
   * the ACC's `defineAccTiedTeams` re-anchors on a fresh win-pct/record match
   * on every restart (its own published language, "restart the entire
   * tiebreaker, including re-defining tied teams") and can legitimately pull
   * in teams that were never part of the slot's first-computed pool. Defining
   * `contestedWith` as the initial pool alone would then be a strict subset
   * of what `trace` actually references, breaking the trace-isolation
   * invariant below for the one conference that restarts the most. Since
   * `pool` is already the first cycle's `tiedTeams`, this union costs nothing
   * for the other three conferences (whose bucket-walk `defineTiedTeams`
   * never leaves the initial pool) and repairs it for the ACC.
   */
  contestedWith: readonly TeamId[]
  /**
   * This group's OWN reasoning trace — a fresh array per rank slot, never the
   * same array instance as any other group's `trace` (Pitfall 5,
   * 06-RESEARCH.md). Every team id anywhere in this array (`tiedTeams`,
   * `steps[].values[].teamId`, `steps[].partition`, `removed[].teamId`) is a
   * member of `contestedWith` — see that field's docblock for why
   * `contestedWith` is a trace-derived union rather than the bare initial
   * pool.
   */
  trace: readonly TiebreakerCycle[]
  /** Set when `resolvedBy === 'unresolved'` — the reason manual input is needed. */
  terminalReason?: TerminalReason
  /**
   * D-17: set only when `resolvedBy === 'manual'`. Carries the full ordering
   * the user committed for the group this rank was split out of. Unused
   * until Plan 06-05 populates it and Plan 06-06 renders it.
   */
  manualOrdering?: readonly TeamId[]
}

/**
 * A conference's full 1..N ranking (D-01, D-03, TIE-08): an ORDERED sequence
 * of rank groups, best to worst, produced by iteratively applying the
 * published tiebreaker procedure and committing one slot (or one irreducible
 * group, model B) at a time.
 */
export interface ConferenceRanking {
  conference: ConferenceId
  groups: readonly RankGroup[]
}
