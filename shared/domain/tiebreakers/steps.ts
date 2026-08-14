import type { TeamId, TiebreakerStepId, StepValue, StepOutcome, BaseOrdering } from './types'
import type { ConferenceRecord } from './records'

/**
 * Safely computes a win percentage, returning `{ kind: 'indeterminate' }`
 * when gamesPlayed is 0 (PITFALLS.md Pitfall 4's direct fix for NaN poisoning).
 *
 * Exported so test fixtures and other conference-specific steps can reuse
 * this guard without reimplementing it.
 */
export function winPctSafe(wins: number, gamesPlayed: number): StepValue {
  if (gamesPlayed === 0) {
    return { kind: 'indeterminate' }
  }
  return {
    kind: 'record',
    wins,
    losses: gamesPlayed - wins,
    winPct: wins / gamesPlayed
  }
}

/**
 * Evaluates a tied group via head-to-head competition.
 *
 * For a complete round-robin among the tied teams (every pair played),
 * partitions by win percentage computed only over games against the other
 * tied teams. For a non-round-robin group, applies beatAllOthers/lostToAllOthers
 * predicates: a team satisfies neither if it didn't play one of the other
 * tied teams (missing games are not losses).
 *
 * Addresses PITFALLS.md Pitfalls 4 and 5.
 */
export function evaluateHeadToHead(
  tiedTeams: readonly TeamId[],
  records: ReadonlyMap<TeamId, ConferenceRecord>
): StepOutcome {
  // Check if this is a complete round-robin among the tied teams
  const isRoundRobin = tiedTeams.every((teamA) => {
    const recordA = records.get(teamA)!
    return tiedTeams.every((teamB) => {
      if (teamA === teamB) return true
      return recordA.opponents.has(teamB)
    })
  })

  if (isRoundRobin) {
    // Compute win/loss records restricted to games among tied teams
    const values: Array<{ teamId: TeamId, value: StepValue }> = []
    const valuesByTeam = new Map<TeamId, StepValue>()

    for (const teamId of tiedTeams) {
      const record = records.get(teamId)!
      // Count wins and games only against other tied teams
      const winsAgainstTied = Array.from(record.beat).filter(opponent =>
        tiedTeams.includes(opponent)
      ).length
      const gamesAgainstTied = Array.from(record.opponents).filter(opponent =>
        tiedTeams.includes(opponent)
      ).length

      const value = winPctSafe(winsAgainstTied, gamesAgainstTied)
      valuesByTeam.set(teamId, value)
      values.push({ teamId, value })
    }

    // Partition by value (best to worst)
    const partition = partitionByStepValue(tiedTeams, valuesByTeam)
    const separated = partition.length > 0 && partition[0]!.length < tiedTeams.length

    return {
      step: 'head-to-head',
      values,
      partition,
      separated
    }
  } else {
    // Non-round-robin: check for beatAllOthers and lostToAllOthers
    const values: Array<{ teamId: TeamId, value: StepValue }> = []
    let beatAllOthersTeam: TeamId | null = null
    let _lostToAllOthersTeam: TeamId | null = null

    for (const teamId of tiedTeams) {
      const record = records.get(teamId)!
      const otherTeams = tiedTeams.filter(t => t !== teamId)

      // Check if this team beat all other tied teams
      const beatAllOthers
        = otherTeams.length > 0 && otherTeams.every(other => record.beat.has(other))

      // Check if this team lost to all other tied teams
      const lostToAllOthers
        = otherTeams.length > 0 && otherTeams.every(other => record.lostTo.has(other))

      if (beatAllOthers) {
        beatAllOthersTeam = teamId
      }
      if (lostToAllOthers) {
        _lostToAllOthersTeam = teamId
      }

      // Determine result code
      let result: 'beat-all' | 'lost-to-all' | 'mixed' | 'no-common-games'
      if (beatAllOthers) {
        result = 'beat-all'
      } else if (lostToAllOthers) {
        result = 'lost-to-all'
      } else if (record.opponents.size === 0) {
        result = 'no-common-games'
      } else {
        result = 'mixed'
      }

      values.push({
        teamId,
        value: { kind: 'headToHead', result }
      })
    }

    // Partition: if exactly one team beat all others, separate it
    if (beatAllOthersTeam !== null) {
      const partition = tiedTeams.map(t => (t === beatAllOthersTeam ? [t] : [])).filter(b => b.length > 0)
      const rest = tiedTeams.filter(t => t !== beatAllOthersTeam)
      if (rest.length > 0) {
        partition.push(rest)
      }
      return {
        step: 'head-to-head',
        values,
        partition: partition.length > 0 ? partition : [tiedTeams as unknown as TeamId[]],
        separated: partition[0]?.length === 1 && partition[0][0] === beatAllOthersTeam
      }
    }

    // If no beatAllOthers team, everyone stays tied
    return {
      step: 'head-to-head',
      values,
      partition: [Array.from(tiedTeams)],
      separated: false
    }
  }
}

/**
 * Evaluates a tied group via common opponents.
 *
 * Finds opponents common to all tied teams. If none, returns separated:false
 * with every team's value indeterminate (PITFALLS.md Pitfall 4's NaN guard).
 * Otherwise partitions by win percentage computed only over games against
 * the common-opponent set.
 */
export function evaluateCommonOpponents(
  tiedTeams: readonly TeamId[],
  records: ReadonlyMap<TeamId, ConferenceRecord>
): StepOutcome {
  // Find opponents common to ALL tied teams
  let commonOpponents: Set<TeamId> | null = null
  for (const teamId of tiedTeams) {
    const record = records.get(teamId)!
    if (commonOpponents === null) {
      commonOpponents = new Set(record.opponents)
    } else {
      // Intersect
      const filtered: TeamId[] = Array.from(commonOpponents as Set<TeamId>).filter((opp: TeamId) =>
        record.opponents.has(opp)
      )
      commonOpponents = new Set(filtered)
    }
  }

  if (!commonOpponents || commonOpponents.size === 0) {
    // No common opponents: return indeterminate for everyone
    const values = tiedTeams.map(teamId => ({
      teamId,
      value: { kind: 'indeterminate' } as StepValue
    }))
    return {
      step: 'common-opponents',
      values,
      partition: [Array.from(tiedTeams)],
      separated: false
    }
  }

  // Compute win percentages against common opponents only
  const values: Array<{ teamId: TeamId, value: StepValue }> = []
  const valuesByTeam = new Map<TeamId, StepValue>()

  for (const teamId of tiedTeams) {
    const record = records.get(teamId)!
    const winsAgainstCommon = Array.from(record.beat).filter(opp =>
      commonOpponents.has(opp)
    ).length
    const gamesAgainstCommon = Array.from(record.opponents).filter(opp =>
      commonOpponents.has(opp)
    ).length

    const value = winPctSafe(winsAgainstCommon, gamesAgainstCommon)
    valuesByTeam.set(teamId, value)
    values.push({ teamId, value })
  }

  const partition = partitionByStepValue(tiedTeams, valuesByTeam)
  const separated = partition[0]!.length < tiedTeams.length

  return {
    step: 'common-opponents',
    values,
    partition,
    separated
  }
}

/**
 * Evaluates a tied group via cumulative conference opponent win percentage.
 *
 * For each tied team, sums wins and gamesPlayed across all of that team's own
 * conference opponents' records, then computes a single winPctSafe over the totals.
 * This is the record-weighted aggregate, not the unweighted mean (PITFALLS.md
 * Pitfall 6's classic silent bug).
 */
export function evaluateCumulativeOpponentWinPct(
  tiedTeams: readonly TeamId[],
  records: ReadonlyMap<TeamId, ConferenceRecord>
): StepOutcome {
  const values: Array<{ teamId: TeamId, value: StepValue }> = []
  const valuesByTeam = new Map<TeamId, StepValue>()

  for (const teamId of tiedTeams) {
    const record = records.get(teamId)!
    let summedWins = 0
    let summedGames = 0

    // Sum across all this team's conference opponents
    for (const opponentId of record.opponents) {
      const opponentRecord = records.get(opponentId)
      if (opponentRecord) {
        summedWins += opponentRecord.wins
        summedGames += opponentRecord.gamesPlayed
      }
    }

    const value = winPctSafe(summedWins, summedGames)
    valuesByTeam.set(teamId, value)
    values.push({ teamId, value })
  }

  const partition = partitionByStepValue(tiedTeams, valuesByTeam)
  const separated = partition[0]!.length < tiedTeams.length

  return {
    step: 'cumulative-opponent-win-pct',
    values,
    partition,
    separated
  }
}

/**
 * Helper to partition teams by their StepValue, producing buckets ordered
 * best to worst. Teams with the same value land in the same bucket.
 */
function partitionByStepValue(
  teams: readonly TeamId[],
  valuesByTeam: ReadonlyMap<TeamId, StepValue>
): readonly TeamId[][] {
  // Group by numeric comparable (only 'record' kind is comparable)
  const byValue = new Map<number, TeamId[]>()
  const nonComparableBuckets: Map<string, TeamId[]> = new Map() // For indeterminate/headToHead

  for (const teamId of teams) {
    const value = valuesByTeam.get(teamId)
    if (!value) continue

    if (value.kind === 'record') {
      const key = value.winPct
      if (!byValue.has(key)) byValue.set(key, [])
      byValue.get(key)!.push(teamId)
    } else if (value.kind === 'indeterminate') {
      // All indeterminate values go in same bucket
      const key = 'indeterminate'
      if (!nonComparableBuckets.has(key)) nonComparableBuckets.set(key, [])
      nonComparableBuckets.get(key)!.push(teamId)
    } else if (value.kind === 'headToHead') {
      // All mixed headToHead values go in same bucket
      const key = 'headToHead'
      if (!nonComparableBuckets.has(key)) nonComparableBuckets.set(key, [])
      nonComparableBuckets.get(key)!.push(teamId)
    }
  }

  // Sort record buckets by winPct descending (best to worst); sort teams within bucket by id
  const recordBuckets = Array.from(byValue.entries())
    .sort(([keyA], [keyB]) => keyB - keyA)
    .map(([, teamIds]) => teamIds.sort((a, b) => a - b))

  // Non-comparable buckets come after all comparable buckets (worst)
  const nonComparableBucketArrays = Array.from(nonComparableBuckets.values()).map(teamIds =>
    teamIds.sort((a, b) => a - b)
  )

  const result = [...recordBuckets, ...nonComparableBucketArrays]

  // Fallback: if no buckets were populated, return all teams as one tied group
  if (result.length === 0) {
    return [Array.from(teams).sort((a, b) => a - b)]
  }

  return result
}

/**
 * Evaluates a tied group via the next highest-placed common opponent,
 * walking down the frozen base ordering and comparing against the
 * first bucket containing qualifying common opponents.
 *
 * When the walk reaches a bucket with 2+ raw-standings-tied teams,
 * compares each tied team's win percentage against that entire bucket
 * collectively (summed wins / summed games), not one opponent at a time.
 *
 * Per D-05 (revised 2026-08-13): For the Big 12, this collective-bucket
 * treatment is primary-source-confirmed, verbatim from the tiebreaker PDF:
 * "use each team's win percentage against the collective tied teams as a
 * group (prior to that group's own tie-breaking procedure) rather than the
 * performance against individual tied teams."
 *
 * Per D-13 (added 2026-08-13): The SEC and Big Ten's own tiebreaker
 * documents do not contain this collective-bucket clause. This same
 * collective-bucket comparison is applied to their analogous step as a
 * documented extrapolation, per the standing recommendation in PITFALLS.md.
 * This is not primary-source-confirmed for SEC/Big Ten; it is an explicit
 * choice to extend the Big 12's documented behavior where those conferences'
 * own documents are silent on the bucket-collision case.
 */
export function evaluateNextHighestPlacedCommonOpponent(
  tiedTeams: readonly TeamId[],
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>
): StepOutcome {
  // Walk down the baseOrdering (best to worst raw standings)
  for (const bucket of baseOrdering) {
    // Find which teams in this bucket are common opponents of all tied teams
    const qualifyingOpponents = bucket.filter(opponent =>
      tiedTeams.every((team) => {
        const record = records.get(team)
        return record && record.opponents.has(opponent)
      })
    )

    if (qualifyingOpponents.length === 0) {
      // No qualifying opponents in this bucket; skip and continue
      continue
    }

    // Found a bucket with qualifying common opponents
    // Compute win percentages against this bucket collectively
    const values: Array<{ teamId: TeamId, value: StepValue }> = []
    const valuesByTeam = new Map<TeamId, StepValue>()

    for (const teamId of tiedTeams) {
      const record = records.get(teamId)!
      // Count wins and games only against qualifying opponents in this bucket
      const winsAgainstBucket = Array.from(record.beat).filter(opponent =>
        qualifyingOpponents.includes(opponent)
      ).length
      const gamesAgainstBucket = Array.from(record.opponents).filter(opponent =>
        qualifyingOpponents.includes(opponent)
      ).length

      const value = winPctSafe(winsAgainstBucket, gamesAgainstBucket)
      valuesByTeam.set(teamId, value)
      values.push({ teamId, value })
    }

    const partition = partitionByStepValue(tiedTeams, valuesByTeam)
    const separated = partition[0]!.length < tiedTeams.length

    return {
      step: 'next-highest-placed-common-opponent',
      values,
      partition,
      separated
    }
  }

  // No qualifying bucket found in entire baseOrdering
  const values = tiedTeams.map(teamId => ({
    teamId,
    value: { kind: 'indeterminate' } as StepValue
  }))
  return {
    step: 'next-highest-placed-common-opponent',
    values,
    partition: [Array.from(tiedTeams)],
    separated: false
  }
}

/**
 * Evaluates a tied group via total wins in a 12-game season.
 *
 * This is a Big 12-only step that counts overall (non-conference) wins,
 * with an FCS-win cap (only one win against a non-FBS opponent counts
 * annually). The `overallWinCounts` argument is pre-computed by
 * `deriveOverallWinCount` in `records.ts` and already includes the cap.
 *
 * Throws if overallWinCounts is undefined (a programmer error — only
 * the Big 12's CONFERENCE_RULES should ever include this step).
 */
export function evaluateTotalWins(
  tiedTeams: readonly TeamId[],
  overallWinCounts: ReadonlyMap<TeamId, number> | undefined
): StepOutcome {
  if (overallWinCounts === undefined) {
    throw new Error('total-wins step requires overallWinCounts (Big 12 only)')
  }

  const values: Array<{ teamId: TeamId, value: StepValue }> = []
  const valuesByTeam = new Map<TeamId, StepValue>()

  for (const teamId of tiedTeams) {
    const wins = overallWinCounts.get(teamId) ?? 0
    // For this step, winPct is repurposed as the raw win count for display consistency
    const value: StepValue = {
      kind: 'record',
      wins,
      losses: 0,
      winPct: wins
    }
    valuesByTeam.set(teamId, value)
    values.push({ teamId, value })
  }

  const partition = partitionByStepValue(tiedTeams, valuesByTeam)
  const separated = partition[0]!.length < tiedTeams.length

  return {
    step: 'total-wins',
    values,
    partition,
    separated
  }
}

/**
 * Dispatcher for all tiebreaker step evaluators.
 * Routes to the appropriate function based on stepId.
 *
 * Task 1 (this plan) implements head-to-head, common-opponents, and cumulative-opponent-win-pct.
 * Task 2 (this plan) adds next-highest-placed-common-opponent and total-wins.
 */
export function evaluateStep(
  stepId: TiebreakerStepId,
  tiedTeams: readonly TeamId[],
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<TeamId, ConferenceRecord>,
  overallWinCounts?: ReadonlyMap<TeamId, number>
): StepOutcome {
  switch (stepId) {
    case 'head-to-head':
      return evaluateHeadToHead(tiedTeams, records)
    case 'common-opponents':
      return evaluateCommonOpponents(tiedTeams, records)
    case 'cumulative-opponent-win-pct':
      return evaluateCumulativeOpponentWinPct(tiedTeams, records)
    case 'next-highest-placed-common-opponent':
      return evaluateNextHighestPlacedCommonOpponent(tiedTeams, baseOrdering, records)
    case 'total-wins':
      return evaluateTotalWins(tiedTeams, overallWinCounts)
    default: {
      const exhaustive: never = stepId
      throw new Error(`Unknown step ID: ${exhaustive}`)
    }
  }
}
