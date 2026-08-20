/**
 * @vitest-environment node
 */

/**
 * 08-REVIEW WR-03 (iteration 2): `computeStandingsPipeline` replaced two
 * hand-written copies of the same resolve -> slate-completion ->
 * apply-manual-ordering -> compute-standings composition order
 * (`useStandings.ts` and `PicksWorkspace.vue`'s preview branch). This suite
 * is a parity regression: `computeStandingsPipeline` must produce exactly
 * what manually chaining the same four calls, in the same order, produces --
 * proving the extraction did not silently change behavior.
 *
 * `applyManualOrdering` itself (the manual-decision application semantics)
 * already has dedicated unit coverage in `tests/domain/tiebreakers/
 * invalidation.test.ts` -- this file does not re-derive that, only that
 * `computeStandingsPipeline` wires the four steps together identically to
 * how the two duplicated call sites used to.
 *
 * Runs under the `node` environment -- see `generated-seasons.ts`'s own
 * docblock for why (`readSlate`'s `fileURLToPath` needs a `file:`-schemed
 * `URL`, which happy-dom's global `URL` does not produce).
 */

import { describe, it, expect } from 'vitest'
import {
  computeStandingsPipeline,
  resolveAllConferences,
  slateCompletionByConference,
  computeStandings,
  P4_CONFERENCES
} from '../../../shared/domain/standings'
import type { ResolvedTiebreakers } from '../../../shared/domain/standings'
import { applyManualOrdering } from '../../../shared/domain/tiebreakers/invalidation'
import type { ConferenceDecisions } from '../../../shared/domain/tiebreakers/invalidation'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'

const { games, teams } = readSlate()

/** The pre-extraction composition, written out by hand -- the parity oracle. */
function manualPipeline(picks: Record<number, number>, manualDecisions: ConferenceDecisions) {
  const raw = resolveAllConferences(games, teams, picks)
  const slateComplete = slateCompletionByConference(games, teams, picks)

  const rankings: ResolvedTiebreakers = {}
  for (const conference of P4_CONFERENCES) {
    const conferenceRaw = raw[conference]
    if (!conferenceRaw) continue
    const complete = slateComplete[conference] ?? false
    rankings[conference] = applyManualOrdering(conferenceRaw, manualDecisions[conference] ?? {}, complete)
  }

  const standings = computeStandings(games, teams, picks, rankings)

  return { rankings, slateComplete, standings }
}

describe('computeStandingsPipeline parity with the pre-extraction hand-composed pipeline', () => {
  it('matches the manual composition, with no manual decisions, across 25 fully-picked generated seasons', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = mulberry32(seed)
      const picks = generatePicks(games, random)

      const pipelineResult = computeStandingsPipeline(games, teams, picks, {})
      const manualResult = manualPipeline(picks, {})

      expect(pipelineResult).toEqual(manualResult)
    }
  })

  it('matches the manual composition across 25 partially-picked (weeks 1-7) generated seasons', () => {
    for (let seed = 1001; seed <= 1025; seed++) {
      const random = mulberry32(seed)
      const picks = generatePicks(games, random, 7)

      const pipelineResult = computeStandingsPipeline(games, teams, picks, {})
      const manualResult = manualPipeline(picks, {})

      expect(pipelineResult).toEqual(manualResult)
    }
  })

  it('threads a manualDecisions payload through identically to the manual composition, whatever it resolves to', () => {
    // A structurally valid but almost-certainly-non-matching manual payload
    // (P4_CONFERENCES's own membership guarantees at least one exists) --
    // this proves the parameter reaches `applyManualOrdering` unchanged
    // regardless of whether any hash actually matches a live group.
    const manualDecisions: ConferenceDecisions = {
      [P4_CONFERENCES[0]!]: { 'not-a-real-hash': [1, 2, 3] }
    }
    const random = mulberry32(42)
    const picks = generatePicks(games, random)

    const pipelineResult = computeStandingsPipeline(games, teams, picks, manualDecisions)
    const manualResult = manualPipeline(picks, manualDecisions)

    expect(pipelineResult).toEqual(manualResult)
  })
})
