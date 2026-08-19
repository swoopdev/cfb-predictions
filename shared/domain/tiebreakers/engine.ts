import type {
  TeamId,
  TiebreakerStepId,
  BaseOrdering,
  TiebreakerCycle,
  TerminalReason,
  TiebreakerResult,
  ConferenceId,
  StepOutcome,
  RankGroup,
  ConferenceRanking
} from './types'
import type { ConferenceRecord } from './records'
import { deriveConferenceRecords, deriveOverallWinCount } from './records'
import { computeBaseOrdering } from './baseOrdering'
import { evaluateStep } from './steps'
import { CONFERENCE_RULES } from './rules'

/**
 * Recursively resolves a tied group of teams through a conference's
 * tiebreaker procedure.
 *
 * **Termination argument:**
 * 1. `alreadyCommitted` grows by at least one team on every restart, while
 *    `defineTiedTeams` is contracted to exclude every id in it (see
 *    `acc.ts:51`, `acc.ts:85` for the ACC's exclusion). The selectable
 *    universe therefore strictly shrinks, and recursion depth is bounded by
 *    the conference's team count regardless of whether a redefined pool is
 *    momentarily larger.
 * 2. An eliminated/seeded team never re-enters a later cycle, enforced
 *    structurally because `alreadyCommitted` only grows and `defineTiedTeams`
 *    is contracted to exclude every id in it.
 *
 * The ACC's published language — "If still tied after any step, restart the
 * entire tiebreaker (including re-defining tied teams)" — explicitly permits
 * a redefined pool that is larger than the previous one. A guard that
 * required `nextTiedTeams.length < tiedTeams.length` rejected this legal
 * restart and caused ~4% of ACC resolutions to fall back to record order.
 * A defensive depth cap (128) provides the backstop instead.
 *
 * These invariants are load-bearing for Pitfall 1's "restart on partial
 * separation, continue on no separation" semantics, and for the ACC's
 * per-restart tied-team redefinition (Pitfall 3): every restart re-invokes
 * `defineTiedTeams` against a growing `alreadyCommitted` set, rather than
 * reusing the previous partition's remainder. This one mechanism correctly
 * models the ACC's own language ("the tiebreaker will restart, including the
 * definition of tied teams") with the exact same recursive core the other
 * three conferences use.
 *
 * @param tiedTeams the group of teams contending for the current slot
 * @param defineTiedTeams the conference's tied-team definition strategy; re-invoked
 *   at every restart with a growing alreadyCommitted set
 * @param procedureFor returns the ordered step ids to attempt for a group of
 *   a given size; typically `(size) => size === 2 ? conf.twoTeamSteps : conf.multiTeamSteps`
 * @param baseOrdering frozen, best-to-worst raw-win-pct ordering (computed once,
 *   never recomputed mid-procedure)
 * @param records conference record for every team
 * @param overallWinCounts pre-computed overall (season-wide) win counts; needed
 *   only for Big 12's total-wins step; undefined for other conferences
 * @param alreadyCommitted set of teams already seeded/eliminated in earlier cycles,
 *   used by defineTiedTeams to contract the pool
 * @param terminalReason metadata for when all steps are exhausted without
 *   separation (D-04)
 * @param cycles accumulator for the trace; defaults to [] on initial call
 */
export function resolveTiedGroup(
  tiedTeams: readonly TeamId[],
  defineTiedTeams: (
    baseOrdering: BaseOrdering,
    records: ReadonlyMap<TeamId, ConferenceRecord>,
    alreadyCommitted: ReadonlySet<TeamId>
  ) => readonly TeamId[],
  procedureFor: (size: number) => readonly TiebreakerStepId[],
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>,
  overallWinCounts: ReadonlyMap<TeamId, number> | undefined,
  alreadyCommitted: ReadonlySet<TeamId>,
  terminalReason: TerminalReason,
  cycles: TiebreakerCycle[] = [],
  depth: number = 0
): TiebreakerResult {
  // Defensive depth cap: 128 comfortably exceeds the largest P4 conference
  // (18 teams, SEC/Big Ten) while still failing fast on a genuine runaway.
  // This is a backstop, not the termination argument — see docblock above.
  if (depth > 128) {
    throw new Error('resolveTiedGroup: recursion depth cap exceeded')
  }

  // Base case: single team resolves immediately
  if (tiedTeams.length === 1) {
    return {
      status: 'resolved',
      order: [...tiedTeams],
      trace: cycles
    }
  }

  // Run the procedure for this group size
  const steps: StepOutcome[] = []

  for (const stepId of procedureFor(tiedTeams.length)) {
    const outcome = evaluateStep(stepId, tiedTeams, baseOrdering, records, overallWinCounts)
    steps.push(outcome)

    // D-07: record every attempted step, including steps that don't separate

    if (!outcome.separated) {
      // Continue branch: no separation, try next step on SAME group
      continue
    }

    // This step produced a partition
    const [winners, ...restBuckets] = outcome.partition
    const rest = restBuckets.flat()

    // Check if this step fully resolved the top bucket into a single team
    if (winners!.length === 1 && rest.length === 0) {
      // Fully resolved within this cycle
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'resolved',
        removed: [{ teamId: winners![0]!, reason: 'seeded', atStep: stepId }]
      })
      return {
        status: 'resolved',
        order: [...winners!],
        trace: cycles
      }
    }

    if (winners!.length >= 1 && rest.length > 0) {
      // Partial separation: restart with the reduced group (Pitfall 1)
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'restart',
        removed: winners!.map(teamId => ({ teamId, reason: 'seeded' as const, atStep: stepId }))
      })

      // Invariant (a): `rest` must be strictly smaller than `tiedTeams`
      if (rest.length >= tiedTeams.length) {
        throw new Error(
          'resolveTiedGroup: restart did not strictly shrink the tied group -- infinite recursion guard tripped'
        )
      }

      // Compute the next alreadyCommitted set, growing it to include the just-seeded teams
      const nextAlreadyCommitted = new Set([...alreadyCommitted, ...winners!])

      // Re-invoke defineTiedTeams with the growing alreadyCommitted set
      // (This is how the ACC's per-restart redefinition works correctly)
      const nextTiedTeams = defineTiedTeams(baseOrdering, records, nextAlreadyCommitted)

      if (nextTiedTeams.length === 0) {
        // Containment-escape backstop: a bounded restart (see the bucket
        // recursion below) intersected an unbounded `defineTiedTeams` result
        // with its bucket and got nothing back -- the redefinition re-anchored
        // entirely outside the set it was invoked against, rather than merely
        // narrowing it. Treat `rest` as irreducible instead of recursing on an
        // empty tiedTeams array, which every step evaluator treats as
        // vacuously unseparated and would spin until the depth cap.
        cycles.push({ tiedTeams: rest, steps: [], outcome: 'exhausted', removed: [] })
        return { status: 'needsUserInput', tiedTeams: rest, reason: terminalReason, trace: cycles }
      }

      // 19.2%-of-contested-slots repair (Pitfall 1): `winners` came straight
      // from `outcome.partition[0]`, which `partitionByStepValue` sorted by
      // raw CFBD team id whenever it holds more than one team. Presenting
      // that bucket as `[...winners, ...restResult.order]` would assert a
      // tiebreaker-derived order for a slot that was actually decided by
      // database id. When the bucket holds exactly one team there is nothing
      // to resolve, so this branch only runs for winners.length > 1.
      let orderedWinners: readonly TeamId[]
      if (winners!.length > 1) {
        // Containment invariant: every tied-team set considered while
        // resolving the winners bucket must be a SUBSET of that bucket. A
        // bare `defineTiedTeams` re-anchored on the full base ordering (the
        // ACC's `defineAccTiedTeams` in particular) could otherwise restart
        // INSIDE the bucket recursion and select a team that escaped
        // `winners` entirely -- the trace-isolation test will not catch this
        // on its own, because an escaped id is still a legitimate member of
        // the OUTER pool's `contestedWith`. The wrapper intersects every
        // candidate pool with `winners` so re-anchoring can only narrow,
        // never widen, what this recursion considers.
        const winnersSet = new Set(winners)
        const boundedDefineTiedTeams = (
          bo: BaseOrdering,
          rec: ReadonlyMap<TeamId, ConferenceRecord>,
          committed: ReadonlySet<TeamId>
        ): readonly TeamId[] => defineTiedTeams(bo, rec, committed).filter(id => winnersSet.has(id))

        const bucketResult = resolveTiedGroup(
          winners!,
          boundedDefineTiedTeams,
          procedureFor,
          baseOrdering,
          records,
          overallWinCounts,
          alreadyCommitted,
          terminalReason,
          cycles,
          depth + 1
        )

        if (bucketResult.status === 'needsUserInput') {
          // The bucket is genuinely irreducible -- propagate. This is the
          // correct and honest outcome per the ACC's own restart language
          // ("restart the entire tiebreaker, including re-defining tied
          // teams"), not a fallback to the discarded raw-id sort.
          return bucketResult
        }

        orderedWinners = bucketResult.order
      } else {
        orderedWinners = winners!
      }

      // Recurse on the reduced group
      const restResult = resolveTiedGroup(
        nextTiedTeams,
        defineTiedTeams,
        procedureFor,
        baseOrdering,
        records,
        overallWinCounts,
        nextAlreadyCommitted,
        terminalReason,
        cycles,
        depth + 1
      )

      // Merge the resolved rest with the (now genuinely resolved) winners
      if (restResult.status === 'resolved') {
        return {
          status: 'resolved',
          order: [...orderedWinners, ...restResult.order],
          trace: restResult.trace
        }
      } else {
        // Recursive call hit needsUserInput; propagate it (both spots are blocked)
        return restResult
      }
    }

    // winners.length === 0 should not happen by construction, but if it does,
    // treat as no separation and continue to next step
  }

  // Every executable step ran without fully separating the group
  cycles.push({
    tiedTeams,
    steps,
    outcome: 'exhausted',
    removed: []
  })

  return {
    status: 'needsUserInput',
    tiedTeams,
    reason: terminalReason,
    trace: cycles
  }
}

/**
 * Computes a conference's full 1..N ranking (D-01, D-03, TIE-08) by
 * iteratively resolving one rank slot at a time: define the tied pool for
 * everyone not yet committed, resolve its top team (or identify it as
 * irreducible), commit, and repeat until every team has a rank.
 *
 * **Consumes only `order[0]` of every `TiebreakerResult`.** The tail of a
 * resolved order is exactly the raw-team-id sequence Pitfall 1 describes
 * (06-RESEARCH.md) for any bucket `resolveTiedGroup` has not itself
 * recursively repaired -- no caller of this loop may read past index 0.
 *
 * **Model B (06-RESEARCH.md "The Measurement"):** when a pool cannot be
 * separated, every team in it is committed in the SAME iteration as one
 * `'unresolved'` group, rather than re-prompting per team. This is a 2.4x
 * reduction in ACC manual-decision count for identical correctness -- D-02's
 * commit-and-restart loop is unchanged; only how many teams a human commits
 * per interaction differs.
 *
 * **Termination.** `committed` grows by at least one team on every
 * iteration (a sole candidate, a tiebreaker winner, or an entire unresolved
 * group), and `defineTiedTeams` is contracted to exclude every id already in
 * it, so the loop runs at most `teamIds.size` times. The iteration cap below
 * is a defensive backstop, not the termination argument, mirroring
 * `resolveTiedGroup`'s own depth-cap docblock.
 *
 * **One sequential loop, not N independent resolutions.** This structurally
 * eliminates the seed1/seed2 contradiction class (D-04 defect 2): one ordered
 * sequence produces every slot, so no two slots can disagree about relative
 * order the way two independently-resolved seeds could.
 *
 * Validates that every gameId in `outcomes` corresponds to a real conference
 * game and that every TeamId value is one of that game's two participants
 * (T-03-02 entry validation) -- the sole entry-boundary check for the engine
 * as of Plan 06-03, which deleted the legacy two-seed entry point that used
 * to duplicate it.
 *
 * @param conference the four-letter P4 conference identifier
 * @param conferenceGames the full list of conference-scoped games (pre-filtered)
 * @param outcomes a complete map of {gameId -> winnerId} for every game in conferenceGames
 * @param teamIds the conference's full membership for deriving conference records
 * @param allSeasonGames optional; all games (conference + non-conference) used for Big 12's
 *   total-wins step (RESEARCH.md OQ3: the one exception to "all steps are conference-scoped")
 * @param knownFbsTeamIds optional; the set of FBS team ids (used with allSeasonGames to
 *   apply the Big 12's FCS-win cap)
 */
export function resolveConferenceRanking(
  conference: ConferenceId,
  conferenceGames: readonly { id: number, homeId: TeamId, awayId: TeamId, conferenceGame: boolean }[],
  outcomes: ReadonlyMap<number, TeamId>,
  teamIds: ReadonlySet<TeamId>,
  allSeasonGames?: readonly { id: number, homeId: TeamId, awayId: TeamId, conferenceGame: boolean }[],
  knownFbsTeamIds?: ReadonlySet<TeamId>
): ConferenceRanking {
  // Validate entry boundary (T-03-02): every outcome entry must map to a valid game/team pair
  for (const [gameId, winnerId] of outcomes.entries()) {
    const game = conferenceGames.find(g => g.id === gameId)
    if (!game) {
      // gameId is not in conferenceGames, so skip it (may be from allSeasonGames)
      continue
    }
    if (winnerId !== game.homeId && winnerId !== game.awayId) {
      throw new Error(
        `resolveConferenceRanking: outcomes contains a teamId that is not a participant in gameId ${gameId}`
      )
    }
  }

  // Derive conference records from outcomes
  const records = deriveConferenceRecords(conferenceGames, outcomes, teamIds)

  // Compute the frozen base ordering (best-to-worst raw win percentage) --
  // once, never recomputed mid-procedure (Pitfall 4 of Phase 3).
  const baseOrdering = computeBaseOrdering(records)

  // Get the conference rules
  const rules = CONFERENCE_RULES[conference]

  if (!rules) {
    throw new Error(`Unknown conference: ${conference}`)
  }

  // Compute overall win counts if this is the Big 12 (for the total-wins step)
  const overallWinCounts
    = conference === 'Big 12' && allSeasonGames && knownFbsTeamIds
      ? deriveOverallWinCount(allSeasonGames, outcomes, knownFbsTeamIds, 1)
      : undefined

  const groups: RankGroup[] = []
  const committed = new Set<TeamId>()
  const iterationCap = teamIds.size + 1

  for (let iteration = 0; committed.size < teamIds.size; iteration++) {
    if (iteration > iterationCap) {
      throw new Error(
        'resolveConferenceRanking: iteration cap exceeded -- committed set failed to grow'
      )
    }

    const pool = rules.defineTiedTeams(baseOrdering, records, committed)
    if (pool.length === 0) break // defensive; measured zero occurrences

    if (pool.length === 1) {
      groups.push({
        teams: pool,
        resolvedBy: 'sole-candidate',
        contestedWith: pool,
        trace: []
      })
      committed.add(pool[0]!)
      continue
    }

    // Fresh cycles array PER ITERATION (Pitfall 5) -- never threaded across
    // groups. Reusing one accumulator would make every later group's
    // expandable reasoning render every earlier group's steps too, and would
    // corrupt the D-08 invalidation hash, which reads `trace.at(-1)`.
    const cycles: TiebreakerCycle[] = []

    const result = resolveTiedGroup(
      pool,
      rules.defineTiedTeams,
      (size: number) => (size === 2 ? rules.twoTeamSteps : rules.multiTeamSteps),
      baseOrdering,
      records,
      overallWinCounts,
      committed,
      rules.terminalReason,
      cycles
    )

    if (result.status === 'resolved') {
      // Consume ONLY order[0] -- see the function docblock.
      const winner = result.order[0]!
      groups.push({
        teams: [winner],
        resolvedBy: 'tiebreaker',
        contestedWith: contestedWithFrom(pool, result.trace),
        trace: result.trace
      })
      committed.add(winner)
    } else {
      // Irreducible (model B): the whole group shares one rank until the
      // user orders it (Plan 06-05).
      groups.push({
        teams: result.tiedTeams,
        resolvedBy: 'unresolved',
        contestedWith: contestedWithFrom(pool, result.trace),
        trace: result.trace,
        terminalReason: result.reason
      })
      for (const id of result.tiedTeams) committed.add(id)
    }
  }

  return { conference, groups }
}

/**
 * `RankGroup.contestedWith` is the union of a slot's initial pool and every
 * cycle's `tiedTeams` across its own trace -- see `RankGroup.contestedWith`'s
 * docblock in `types.ts` for why this is a union rather than the bare
 * initial pool (the ACC's restart redefinition can legitimately pull in
 * teams the initial pool never contained).
 */
function contestedWithFrom(
  pool: readonly TeamId[],
  trace: readonly TiebreakerCycle[]
): readonly TeamId[] {
  const ids = new Set<TeamId>(pool)
  for (const cycle of trace) {
    for (const id of cycle.tiedTeams) ids.add(id)
  }
  return Array.from(ids)
}

/**
 * D-12: reads the championship matchup directly off a `ConferenceRanking`'s
 * first two groups, never off standings row order (row order cannot satisfy
 * both seeds simultaneously when the pre-Plan-06-02 engine contradicted
 * itself between them).
 *
 * Seed 2 is suppressed (`undefined`) when seed 1 is itself a multi-team
 * group: both championship spots come out of that one still-irreducible
 * group, and naming a second, overlapping candidate set as "seed 2" would
 * misrepresent the resolution rather than clarify it.
 */
export function championshipFor(
  ranking: ConferenceRanking
): { seed1?: RankGroup, seed2?: RankGroup } {
  const seed1 = ranking.groups[0]
  if (seed1 === undefined) return {}

  const seed2 = seed1.teams.length === 1 ? ranking.groups[1] : undefined
  return { seed1, seed2 }
}

