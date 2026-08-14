import { describe, it, expect, vi } from 'vitest'

const mockFetch = vi.fn()

vi.mock('ofetch', () => ({
  $fetch: mockFetch
}))

describe('fetchTeams', () => {
  it('returns the unwrapped .teams array, never the bare envelope', async () => {
    const { fetchTeams } = await import('../../app/utils/fetchSchedule')
    mockFetch.mockResolvedValueOnce({
      season: 2026,
      teams: [
        { id: 1, school: 'Air Force', mascot: 'Falcons', abbreviation: 'AF', conference: 'Mountain West', classification: 'fbs', color: '#003594', alternateColor: '#ffffff', logo: '/logos/1.png' }
      ]
    })

    const result = await fetchTeams(2026)

    expect(result).toEqual([
      { id: 1, school: 'Air Force', mascot: 'Falcons', abbreviation: 'AF', conference: 'Mountain West', classification: 'fbs', color: '#003594', alternateColor: '#ffffff', logo: '/logos/1.png' }
    ])
    expect(mockFetch).toHaveBeenCalledWith('/data/2026/teams.json')
  })
})

describe('fetchGamesEnvelope', () => {
  it('returns the full { season, scheduleHash, games } envelope unchanged, not just .games', async () => {
    const { fetchGamesEnvelope } = await import('../../app/utils/fetchSchedule')
    const envelope = {
      season: 2026,
      scheduleHash: '19c9e609',
      games: [
        { id: 401856766, week: 1, seasonType: 'regular', homeId: 2628, homeTeam: 'TCU', awayId: 153, awayTeam: 'North Carolina', conferenceGame: false, neutralSite: true }
      ]
    }
    mockFetch.mockResolvedValueOnce(envelope)

    const result = await fetchGamesEnvelope(2026)

    expect(result).toEqual(envelope)
    expect(mockFetch).toHaveBeenCalledWith('/data/2026/games.json')
  })
})
