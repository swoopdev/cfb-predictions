import type {
  TeamId,
  TiebreakerStepId,
  BaseOrdering,
  TiebreakerCycle,
  TerminalReason,
  TiebreakerResult,
  ChampionshipResult,
  ConferenceId
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
 * **Two invariants enforced:**
 * 1. Every recursive call receives a strictly-smaller `tiedTeams` array than
 *    its caller, guaranteeing termination (enforced via assertion at restart).
 * 2. An eliminated/seeded team never re-enters a later cycle, enforced
 *    structurally because `alreadyCommitted` only grows and `defineTiedTeams`
 *    is contracted to exclude every id in it.
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
  cycles: TiebreakerCycle[] = []
): TiebreakerResult {
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
  let remaining = tiedTeams

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
    if (winners.length === 1 && rest.length === 0) {
      // Fully resolved within this cycle
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'resolved',
        removed: [{ teamId: winners[0]!, reason: 'seeded', atStep: stepId }]
      })
      return {
        status: 'resolved',
        order: [...winners],
        trace: cycles
      }
    }

    if (winners.length >= 1 && rest.length > 0) {
      // Partial separation: restart with the reduced group (Pitfall 1)
      cycles.push({
        tiedTeams,
        steps,
        outcome: 'restart',
        removed: winners.map((teamId) => ({ teamId, reason: 'seeded' as const, atStep: stepId }))
      })

      // Invariant (a): `rest` must be strictly smaller than `tiedTeams`
      if (rest.length >= tiedTeams.length) {
        throw new Error(
          'resolveTiedGroup: restart did not strictly shrink the tied group -- infinite recursion guard tripped'
        )
      }

      // Compute the next alreadyCommitted set, growing it to include the just-seeded teams
      const nextAlreadyCommitted = new Set([...alreadyCommitted, ...winners])

      // Re-invoke defineTiedTeams with the growing alreadyCommitted set
      // (This is how the ACC's per-restart redefinition works correctly)
      const nextTiedTeams = defineTiedTeams(baseOrdering, records, nextAlreadyCommitted)

      // Verify the restart strictly shrinks
      if (nextTiedTeams.length >= tiedTeams.length) {
        throw new Error(
          'resolveTiedGroup: defineTiedTeams did not strictly shrink the tied group on restart -- infinite recursion guard tripped'
        )
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
        cycles
      )

      // Merge the resolved rest with the winners (winners rank ahead)
      if (restResult.status === 'resolved') {
        return {
          status: 'resolved',
          order: [...winners, ...restResult.order],
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

// Re-export StepOutcome for use in engine module
import type { StepOutcome } from './types'

/**
 * Resolves the #1 and #2 championship spots for a given conference.
 *
 * Resolves seed 1 first (with an empty alreadyCommitted set), then
 * resolves seed 2 (with alreadyCommitted = the seed 1 winner, if any).
 * If seed 1 is needsUserInput, seed 2 is set to the same result
 * (both spots blocked on the same manual decision).
 *
 * Validates that every gameId in `outcomes` corresponds to a real
 * conference game and that every TeamId value is one of that game's
 * two participants (T-03-02 entry validation).
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
export function resolveConferenceChampionship(
  conference: ConferenceId,
  conferenceGames: readonly { id: number; homeId: TeamId; awayId: TeamId }[],
  outcomes: ReadonlyMap<number, TeamId>,
  teamIds: ReadonlySet<TeamId>,
  allSeasonGames?: readonly { id: number; homeId: TeamId; awayId: TeamId }[],
  knownFbsTeamIds?: ReadonlySet<TeamId>
): ChampionshipResult {
  // Validate entry boundary (T-03-02): every outcome entry must map to a valid game/team pair
  for (const [gameId, winnerId] of outcomes.entries()) {
    const game = conferenceGames.find((g) => g.id === gameId)
    if (!game) {
      // gameId is not in conferenceGames, so skip it (may be from allSeasonGames)
      continue
    }
    if (winnerId !== game.homeId && winnerId !== game.awayId) {
      throw new Error(
        `resolveConferenceChampionship: outcomes contains a teamId that is not a participant in gameId ${gameId}`
      )
    }
  }

  // Derive conference records from outcomes
  const records = deriveConferenceRecords(conferenceGames, outcomes, teamIds)

  // Compute the frozen base ordering (best-to-worst raw win percentage)
  const baseOrdering = computeBaseOrdering(records)

  // Get the conference rules
  const rules = CONFERENCE_RULES[conference]

  if (!rules) {
    throw new Error(`Unknown conference: ${conference}`)
  }

  // Compute overall win counts if this is the Big 12 (for the total-wins step)
  const overallWinCounts =
    conference === 'Big 12' && allSeasonGames && knownFbsTeamIds
      ? deriveOverallWinCount(allSeasonGames, outcomes, knownFbsTeamIds, 1)
      : undefined

  /**
   * Local helper: resolves one championship spot (either #1 or #2).
   * Determines which teams are in contention, then applies the recursive
   * tiebreaker engine to either separate them or identify which teams
   * need manual resolution.
   */
  const resolveSlot = (committed: ReadonlySet<TeamId>): TiebreakerResult => {
    // Get the tied group for this slot (filtered by committed teams)
    const pool = rules.defineTiedTeams(baseOrdering, records, committed)

    // Single team: no tie to break
    if (pool.length === 1) {
      return {
        status: 'resolved',
        order: pool,
        trace: []
      }
    }

    // Multiple teams: apply the recursive tiebreaker engine
    return resolveTiedGroup(
      pool,
      rules.defineTiedTeams,
      (size: number) => (size === 2 ? rules.twoTeamSteps : rules.multiTeamSteps),
      baseOrdering,
      records,
      overallWinCounts,
      committed,
      rules.terminalReason
    )
  }

  // Resolve seed 1 (championship spot) with no teams already committed
  const seed1 = resolveSlot(new Set<TeamId>())

  // Resolve seed 2:
  // - If seed 1 resolved to a single team, add it to committed and resolve seed 2
  // - If seed 1 needs manual input, seed 2 is the same (both spots blocked)
  const seed2 =
    seed1.status === 'resolved'
      ? resolveSlot(new Set([seed1.order[0]!]))
      : seed1 // Same result object (both spots blocked on the same decision)

  return {
    conference,
    seed1,
    seed2
  }
}
