/**
 * @vitest-environment node
 *
 * Runs under `node` (not the project's default `happy-dom`) because the
 * committed-slate case below imports `readSlate` from
 * `tests/helpers/generated-seasons.ts`, whose `fileURLToPath` call rejects
 * happy-dom's non-`file:`-schemed global `URL` (see that helper's own
 * docblock). None of the hand-built fixture cases in this file touch the
 * DOM, so running the whole file under `node` costs nothing -- this keeps
 * every D-07 assertion in the single file the plan expects, rather than
 * splitting the slate-count case into its own file.
 */

import { describe, it, expect } from 'vitest'
import {
  isConferenceSlateComplete,
  slateCompletionByConference
} from '../../../shared/domain/standings/slateCompletion'
import { P4_CONFERENCES, conferenceGamesFor } from '../../../shared/domain/standings/computeStandings'
import { readSlate } from '../../helpers/generated-seasons'
import {
  allTeams,
  game,
  ALABAMA,
  FLORIDA,
  GEORGIA,
  LSU,
  MICHIGAN,
  OHIO_STATE,
  AKRON
} from '../../fixtures/standings.fixtures'
import type { TeamId } from '../../../shared/domain/tiebreakers/types'

const secTeamIds = new Set<TeamId>([ALABAMA, FLORIDA, GEORGIA, LSU])

describe('isConferenceSlateComplete (D-07)', () => {
  it('reports complete once every SEC conference game is picked, even while the rest of the season is unpicked', () => {
    const games = [
      game(1, ALABAMA, FLORIDA, true),
      game(2, GEORGIA, LSU, true),
      // Big Ten game, deliberately unpicked -- must not affect the SEC answer
      game(3, MICHIGAN, OHIO_STATE, true)
    ]
    const picks = { 1: ALABAMA, 2: GEORGIA }

    expect(isConferenceSlateComplete(games, secTeamIds, picks)).toBe(true)
  })

  it('flips to incomplete when one conference-game pick is removed', () => {
    const games = [
      game(1, ALABAMA, FLORIDA, true),
      game(2, GEORGIA, LSU, true)
    ]
    const picks = { 1: ALABAMA }

    expect(isConferenceSlateComplete(games, secTeamIds, picks)).toBe(false)
  })

  it('is unaffected by adding or removing a non-conference pick', () => {
    const games = [
      game(1, ALABAMA, FLORIDA, true),
      game(2, GEORGIA, LSU, true),
      game(3, ALABAMA, AKRON, false)
    ]
    const withoutNonConf = { 1: ALABAMA, 2: GEORGIA }
    const withNonConf = { 1: ALABAMA, 2: GEORGIA, 3: ALABAMA }

    expect(isConferenceSlateComplete(games, secTeamIds, withoutNonConf)).toBe(true)
    expect(isConferenceSlateComplete(games, secTeamIds, withNonConf)).toBe(true)
  })

  it('does not count a pick for a game the source data flags non-conference, even when both teams belong to the conference', () => {
    const games = [
      game(1, ALABAMA, FLORIDA, false) // unflagged same-conference game
    ]
    const picks = { 1: ALABAMA }

    // conferenceGamesFor requires the flag, so this game is never in the
    // "must be picked" set -- picking it changes nothing, and the empty
    // required set is vacuously complete.
    expect(isConferenceSlateComplete(games, secTeamIds, picks)).toBe(true)
    expect(conferenceGamesFor(games, secTeamIds)).toHaveLength(0)
  })

  it('reports complete vacuously for a conference with zero teams in the roster', () => {
    const games = [game(1, ALABAMA, FLORIDA, true)]
    expect(isConferenceSlateComplete(games, new Set<TeamId>(), {})).toBe(true)
  })

  it('counts a pick naming a team that did not play in that game as picked -- validity is toOutcomes’ job, not this predicate’s', () => {
    const games = [game(1, ALABAMA, FLORIDA, true)]
    // LSU didn't play in game 1 -- toOutcomes would drop this downstream,
    // but completeness only checks key presence.
    const picks = { 1: LSU }
    expect(isConferenceSlateComplete(games, secTeamIds, picks)).toBe(true)
  })
})

describe('slateCompletionByConference', () => {
  it('always reports all four P4 conference keys', () => {
    const result = slateCompletionByConference([], allTeams, {})
    expect(Object.keys(result).sort()).toEqual([...P4_CONFERENCES].sort())
  })
})

describe('the committed 2026 slate (reachability check)', () => {
  it('has exactly SEC 72, Big Ten 81, Big 12 72, ACC 74 conference games out of 888 total', () => {
    const { games, teams } = readSlate()
    expect(games).toHaveLength(888)

    const expected: Record<string, number> = {
      'SEC': 72,
      'Big Ten': 81,
      'Big 12': 72,
      'ACC': 74
    }

    for (const conference of P4_CONFERENCES) {
      const confTeamIds = new Set<TeamId>(
        teams.filter(t => t.conference === conference).map(t => t.id)
      )
      expect(conferenceGamesFor(games, confTeamIds)).toHaveLength(expected[conference]!)
    }
  })
})
