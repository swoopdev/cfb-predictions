import type { ConferenceId, TiebreakerStepId, BaseOrdering, TerminalReason } from './types'
import type { ConferenceRecord } from './records'
import { defineAccTiedTeams } from './acc'

/**
 * Conference-specific configuration for tiebreaker resolution.
 *
 * The `defineTiedTeams` strategy is conference-pluggable because the ACC's
 * definition is structurally different (it restarts with a redefined set rather
 * than reusing the partition's remainder). Every other conference uses the same
 * simple bucket-walk strategy.
 *
 * Per RESEARCH.md's Open Question 2: this structure unifies the #1-then-#2 walk
 * (SEC/Big Ten/Big 12) with the ACC's per-restart redefinition by using a
 * single `alreadyCommitted` exclusion-set mechanism, rather than separate #1/
 * #2-specific branch logic.
 */
export interface ConferenceRules {
  id: ConferenceId
  /**
   * Conference-pluggable strategy for determining which teams are in contention
   * for a given championship spot.
   *
   * For SEC/Big Ten/Big 12: simply walk `baseOrdering`'s buckets and return the
   * first bucket whose filtered (minus `alreadyCommitted`) length is > 0.
   *
   * For the ACC: runs Pitfall 3's two-step definition (best win-pct bucket plus
   * any team with matching wins/losses on a different schedule length).
   *
   * **Critical invariant:** This function is re-invoked (not reused) at every
   * restart with a growing `alreadyCommitted` set. This is what makes the ACC's
   * per-restart tied-team redefinition work correctly with the exact same
   * recursive engine the other three conferences use.
   */
  defineTiedTeams: (
    baseOrdering: BaseOrdering,
    records: ReadonlyMap<number, ConferenceRecord>,
    alreadyCommitted: ReadonlySet<number>
  ) => readonly number[]

  /**
   * Ordered, executable tiebreaker steps for a two-team tie. Does NOT include
   * the terminal ranking/draw step (per D-03 — the last computable step only).
   *
   * These steps are applied in order; if a step does not separate the two teams,
   * the procedure advances to the next step. If a step fully separates them, the
   * top team is selected and the bottom team is eliminated.
   */
  twoTeamSteps: readonly TiebreakerStepId[]

  /**
   * Ordered, executable tiebreaker steps for a multi-team tie (3+). Applied
   * recursively per PITFALLS.md Pitfall 1's semantics: on partial separation,
   * restart from step one with the reduced group; on no separation, continue
   * to the next step.
   */
  multiTeamSteps: readonly TiebreakerStepId[]

  /**
   * Static metadata attached to this conference's rules. Used to populate
   * `NeedsUserInput.reason` when the last computable step doesn't fully
   * separate the tied group. Keeps step lists purely executable; citation
   * text is purely descriptive (D-04).
   */
  terminalReason: TerminalReason
}

/**
 * Shared tied-team definition for SEC, Big Ten, and Big 12: walk the base
 * ordering (best-to-worst raw win percentage buckets) and return the first
 * bucket whose filtered (minus `alreadyCommitted` teams) length is > 0.
 *
 * This one function, driven purely by `alreadyCommitted`, correctly produces
 * both the #1 pool when `alreadyCommitted` is empty and the #2 pool once the
 * #1 winner is added — including the case where 3+ teams were originally tied
 * for #1 and 2 of them remain in contention for #2.
 *
 * @param records conference records (accepted for interface compliance; not used by this strategy)
 */
function defineBucketTiedTeams(
  baseOrdering: BaseOrdering,
  records: ReadonlyMap<number, ConferenceRecord>,
  alreadyCommitted: ReadonlySet<number>
): readonly number[] {
  // Walk baseOrdering's buckets in order (best to worst)
  for (const bucket of baseOrdering) {
    // Filter this bucket: keep teams not already committed
    const remaining = bucket.filter(teamId => !alreadyCommitted.has(teamId))
    if (remaining.length > 0) {
      return remaining
    }
  }
  // Should not be reached in normal operation (always at least one team left)
  return []
}

/**
 * Conference tiebreaker rules for all four power conferences.
 *
 * **Step lists:**
 * - All four conferences share head-to-head, common-opponents, next-highest-placed,
 *   and cumulative-opponent-win-pct (though the ACC's head-to-head is the only
 *   computable step).
 * - SEC omits step E (capped relative scoring margin) per D-02 — this app does
 *   not collect scores.
 * - Big 12 additionally includes total-wins (with FCS cap per RESEARCH.md OQ3).
 * - All four omit their terminal ranking/draw step per D-03 (step that can never
 *   resolve anything is not included).
 *
 * **Terminal reasons:**
 * - SEC, Big Ten, Big 12: `needs-scores` (SEC) or `ranking-step` (the others).
 * - ACC: `ranking-step` (head-to-head is the only computable step).
 *
 * **Citations:**
 * Quoted verbatim from PITFALLS.md's "Conference Tiebreaker Specification Source"
 * section for each conference's final uncomputable step. Sources confirmed primary-
 * document or multi-outlet reproduction during Phase 3 research (2026-08-13).
 */
export const CONFERENCE_RULES: Record<ConferenceId, ConferenceRules> = {
  'SEC': {
    id: 'SEC',
    defineTiedTeams: defineBucketTiedTeams,
    twoTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct'],
    multiTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct'],
    terminalReason: {
      code: 'needs-scores',
      ruleCitation:
        'Capped relative total scoring margin per SportSource Analytics vs. all conference opponents; cap of 42 points scored on offense and 48 allowed on defense, each margin clamped to ±100%.',
      sourceName: 'SEC Football Tie-Breaking Procedure (2024–present)'
    }
  },

  'Big Ten': {
    id: 'Big Ten',
    defineTiedTeams: defineBucketTiedTeams,
    twoTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct'],
    multiTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct'],
    terminalReason: {
      code: 'ranking-step',
      ruleCitation: 'Highest SportSource Analytics Team Rating Score.',
      sourceName: '2024 Big Ten Football Championship Game Tiebreaker'
    }
  },

  'Big 12': {
    id: 'Big 12',
    defineTiedTeams: defineBucketTiedTeams,
    twoTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct', 'total-wins'],
    multiTeamSteps: ['head-to-head', 'common-opponents', 'next-highest-placed-common-opponent', 'cumulative-opponent-win-pct', 'total-wins'],
    terminalReason: {
      code: 'ranking-step',
      ruleCitation: 'Highest SportSource Analytics Team Rating Score.',
      sourceName: 'Big 12 Football Tiebreaker Policy (2024–present)'
    }
  },

  'ACC': {
    id: 'ACC',
    // ACC's defineTiedTeams is structurally different (Pitfall 3):
    // it pulls in teams with matching wins/losses on different schedule lengths.
    // It is re-invoked at every restart (not reused), which is how the ACC's
    // "restart, including the definition of tied teams" language is correctly
    // modeled with the same recursive engine the other three conferences use.
    defineTiedTeams: defineAccTiedTeams,
    twoTeamSteps: ['head-to-head'],
    multiTeamSteps: ['head-to-head'],
    terminalReason: {
      code: 'ranking-step',
      ruleCitation: 'Better SportSource Analytics Team Success Ranking.',
      sourceName: 'ACC Football Tiebreaker Policy (as amended July 1, 2026)'
    }
  }
}
