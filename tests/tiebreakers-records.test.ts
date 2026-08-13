import { describe, it, expect } from 'vitest'
import { deriveConferenceRecords } from '../shared/domain/tiebreakers/records'
import type { Game } from '../shared/domain/tiebreakers/types'

// Team ids follow the real CFBD id shape (arbitrary large integers) but use
// small readable numbers here since these are hand-authored fixtures, not
// live data.
const TEAM_A = 1
const TEAM_B = 2
const TEAM_C = 3

describe('deriveConferenceRecords', () => {
  it('produces correct wins/losses/gamesPlayed/beat/lostTo/opponents for a 2-team round-robin', () => {
    const games: Game[] = [
      { id: 101, homeId: TEAM_A, awayId: TEAM_B, conferenceGame: true },
      { id: 102, homeId: TEAM_B, awayId: TEAM_A, conferenceGame: true }
    ]
    // A wins the first meeting, B wins the second -- a split.
    const outcomes = new Map<number, number>([
      [101, TEAM_A],
      [102, TEAM_B]
    ])
    const teamIds = new Set([TEAM_A, TEAM_B])

    const records = deriveConferenceRecords(games, outcomes, teamIds)

    const a = records.get(TEAM_A)!
    const b = records.get(TEAM_B)!

    expect(a.wins).toBe(1)
    expect(a.losses).toBe(1)
    expect(a.gamesPlayed).toBe(2)
    expect(a.winPct).toBeCloseTo(0.5)
    expect([...a.beat]).toEqual([TEAM_B])
    expect([...a.lostTo]).toEqual([TEAM_B])
    expect([...a.opponents]).toEqual([TEAM_B])

    expect(b.wins).toBe(1)
    expect(b.losses).toBe(1)
    expect(b.gamesPlayed).toBe(2)
    expect(b.winPct).toBeCloseTo(0.5)
    expect([...b.beat]).toEqual([TEAM_A])
    expect([...b.lostTo]).toEqual([TEAM_A])
    expect([...b.opponents]).toEqual([TEAM_A])
  })

  it('gives a team with zero supplied games a zero-value record with winPct exactly 0, never NaN', () => {
    const games: Game[] = [
      { id: 201, homeId: TEAM_A, awayId: TEAM_B, conferenceGame: true }
    ]
    const outcomes = new Map<number, number>([[201, TEAM_A]])
    // TEAM_C is a conference member but appears in none of the supplied games.
    const teamIds = new Set([TEAM_A, TEAM_B, TEAM_C])

    const records = deriveConferenceRecords(games, outcomes, teamIds)
    const c = records.get(TEAM_C)!

    expect(c.wins).toBe(0)
    expect(c.losses).toBe(0)
    expect(c.gamesPlayed).toBe(0)
    expect(c.winPct).toBe(0)
    expect(Number.isNaN(c.winPct)).toBe(false)
    expect([...c.beat]).toEqual([])
    expect([...c.lostTo]).toEqual([])
    expect([...c.opponents]).toEqual([])
  })

  it('always has gamesPlayed === wins + losses for every team in a multi-team fixture', () => {
    const games: Game[] = [
      { id: 301, homeId: TEAM_A, awayId: TEAM_B, conferenceGame: true },
      { id: 302, homeId: TEAM_B, awayId: TEAM_C, conferenceGame: true },
      { id: 303, homeId: TEAM_A, awayId: TEAM_C, conferenceGame: true }
    ]
    const outcomes = new Map<number, number>([
      [301, TEAM_A],
      [302, TEAM_B],
      [303, TEAM_C]
    ])
    const teamIds = new Set([TEAM_A, TEAM_B, TEAM_C])

    const records = deriveConferenceRecords(games, outcomes, teamIds)

    for (const record of records.values()) {
      expect(record.gamesPlayed).toBe(record.wins + record.losses)
    }
  })

  it('is deterministic regardless of the supplied games array order', () => {
    const gamesInOrder: Game[] = [
      { id: 301, homeId: TEAM_A, awayId: TEAM_B, conferenceGame: true },
      { id: 302, homeId: TEAM_B, awayId: TEAM_C, conferenceGame: true },
      { id: 303, homeId: TEAM_A, awayId: TEAM_C, conferenceGame: true }
    ]
    const gamesReversed = [...gamesInOrder].reverse()
    const outcomes = new Map<number, number>([
      [301, TEAM_A],
      [302, TEAM_B],
      [303, TEAM_C]
    ])
    const teamIds = new Set([TEAM_A, TEAM_B, TEAM_C])

    const first = deriveConferenceRecords(gamesInOrder, outcomes, teamIds)
    const second = deriveConferenceRecords(gamesReversed, outcomes, teamIds)

    for (const teamId of teamIds) {
      const a = first.get(teamId)!
      const b = second.get(teamId)!
      expect(a.wins).toBe(b.wins)
      expect(a.losses).toBe(b.losses)
      expect(a.gamesPlayed).toBe(b.gamesPlayed)
      expect(a.winPct).toBe(b.winPct)
      expect([...a.beat].sort()).toEqual([...b.beat].sort())
      expect([...a.lostTo].sort()).toEqual([...b.lostTo].sort())
      expect([...a.opponents].sort()).toEqual([...b.opponents].sort())
    }
  })
})
