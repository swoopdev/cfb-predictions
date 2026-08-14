/**
 * @vitest-environment node
 */
// Reads source files off disk via Node URL APIs (fileURLToPath + import.meta.url),
// which the project's global happy-dom default breaks by shadowing the file:-schemed URL.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  RawTeamSchema,
  RequiredTeamFieldsSchema,
  transformTeam,
  reportRequiredFieldFailures,
  RawGameSchema,
  transformGame,
  reportGameFailures
} from '../scripts/lib/schemas'

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url))

const rawTeams = JSON.parse(readFileSync(`${fixturesDir}cfbd-teams-sample.json`, 'utf-8')) as unknown[]
const rawGames = JSON.parse(readFileSync(`${fixturesDir}cfbd-games-sample.json`, 'utf-8')) as unknown[]

const wellFormedTeam = rawTeams.find(t => (t as { id: number }).id === 1)!
const missingConferenceTeam = rawTeams.find(t => (t as { id: number }).id === 2)!
const noLogoTeam = rawTeams.find(t => (t as { id: number }).id === 3)!

const TEAM_OUTPUT_KEYS = ['id', 'school', 'mascot', 'abbreviation', 'conference', 'classification', 'color', 'alternateColor'].sort()
const GAME_OUTPUT_KEYS = ['id', 'week', 'seasonType', 'homeId', 'homeTeam', 'awayId', 'awayTeam', 'conferenceGame', 'neutralSite'].sort()

describe('team transform', () => {
  it('returns exactly the 8 TeamOutput fields matching the well-formed fixture verbatim', () => {
    const output = transformTeam(wellFormedTeam)
    expect(Object.keys(output).sort()).toEqual(TEAM_OUTPUT_KEYS)
    expect(output).toEqual({
      id: 1,
      school: 'Ohio State',
      mascot: 'Buckeyes',
      abbreviation: 'OSU',
      conference: 'Big Ten',
      classification: 'fbs',
      color: '#BB0000',
      alternateColor: '#666666'
    })
  })

  it('RawTeamSchema rejects a fixture-derived object with id missing or non-numeric', () => {
    const missingId = { ...(wellFormedTeam as Record<string, unknown>) }
    delete missingId.id
    expect(RawTeamSchema.safeParse(missingId).success).toBe(false)

    const nonNumericId = { ...(wellFormedTeam as Record<string, unknown>), id: 'not-a-number' }
    expect(RawTeamSchema.safeParse(nonNumericId).success).toBe(false)
  })
})

describe('game transform', () => {
  it('returns exactly the 9 GameOutput fields matching each fixture game verbatim', () => {
    for (const raw of rawGames) {
      const output = transformGame(raw)
      expect(Object.keys(output).sort()).toEqual(GAME_OUTPUT_KEYS)
      expect(output).toEqual(raw)
    }
  })

  it('RawGameSchema rejects a fixture-derived object with conferenceGame missing', () => {
    const missingConferenceGame = { ...(rawGames[0] as Record<string, unknown>) }
    delete missingConferenceGame.conferenceGame
    expect(RawGameSchema.safeParse(missingConferenceGame).success).toBe(false)
  })
})

describe('required field failures', () => {
  it('flags exactly one entry, for teamId 2, with a conference key in errors', () => {
    const failures = reportRequiredFieldFailures([wellFormedTeam, missingConferenceTeam, noLogoTeam])
    expect(failures).toHaveLength(1)
    expect(failures[0].teamId).toBe(2)
    expect(failures[0].errors).toHaveProperty('conference')
  })

  it('returns an empty array when every team has all required fields populated', () => {
    const failures = reportRequiredFieldFailures([wellFormedTeam, noLogoTeam])
    expect(failures).toEqual([])
  })
})

describe('conferenceGame passthrough', () => {
  it('equals the raw input verbatim for both the true and false fixture cases', () => {
    const falseCase = rawGames.find(g => (g as { id: number }).id === 401628355)!
    const trueCaseA = rawGames.find(g => (g as { id: number }).id === 401628301)!
    const trueCaseB = rawGames.find(g => (g as { id: number }).id === 401628288)!

    expect(transformGame(falseCase).conferenceGame).toBe((falseCase as { conferenceGame: boolean }).conferenceGame)
    expect(transformGame(falseCase).conferenceGame).toBe(false)
    expect(transformGame(trueCaseA).conferenceGame).toBe((trueCaseA as { conferenceGame: boolean }).conferenceGame)
    expect(transformGame(trueCaseA).conferenceGame).toBe(true)
    expect(transformGame(trueCaseB).conferenceGame).toBe((trueCaseB as { conferenceGame: boolean }).conferenceGame)
    expect(transformGame(trueCaseB).conferenceGame).toBe(true)
  })
})

describe('seasonType passthrough', () => {
  it('equals the raw input verbatim for both regular fixture cases and the postseason case', () => {
    const regularCases = rawGames.filter(g => (g as { seasonType: string }).seasonType === 'regular')
    const postseasonCase = rawGames.find(g => (g as { id: number }).id === 401628301)!

    expect(regularCases.length).toBeGreaterThan(0)
    for (const raw of regularCases) {
      expect(transformGame(raw).seasonType).toBe((raw as { seasonType: string }).seasonType)
    }
    expect(transformGame(postseasonCase).seasonType).toBe('postseason')
  })
})

describe('reportGameFailures', () => {
  it('flags exactly one entry, for the fixture id, with a conferenceGame key in errors, and never throws', () => {
    const missingConferenceGame = { ...(rawGames[0] as Record<string, unknown>) }
    delete missingConferenceGame.conferenceGame

    const failures = reportGameFailures([rawGames[1], missingConferenceGame, rawGames[2]])
    expect(failures).toHaveLength(1)
    expect(failures[0].gameId).toBe((rawGames[0] as { id: number }).id)
    expect(failures[0].errors).toHaveProperty('conferenceGame')
  })

  it('returns an empty array when every game satisfies RawGameSchema', () => {
    const failures = reportGameFailures(rawGames)
    expect(failures).toEqual([])
  })
})

describe('RequiredTeamFieldsSchema', () => {
  it('rejects the missing-conference fixture directly', () => {
    expect(RequiredTeamFieldsSchema.safeParse(missingConferenceTeam).success).toBe(false)
  })

  it('accepts the well-formed fixture directly', () => {
    expect(RequiredTeamFieldsSchema.safeParse(wellFormedTeam).success).toBe(true)
  })
})
