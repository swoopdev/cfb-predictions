/**
 * @vitest-environment node
 */
// Reads source files off disk via Node URL APIs (fileURLToPath + import.meta.url),
// which the project's global happy-dom default breaks by shadowing the file:-schemed URL.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import { fetchSourceData } from '../scripts/lib/fetch-source'

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url))

const rawTeams = JSON.parse(readFileSync(`${fixturesDir}cfbd-teams-sample.json`, 'utf-8')) as unknown[]
const rawGames = JSON.parse(readFileSync(`${fixturesDir}cfbd-games-sample.json`, 'utf-8')) as unknown[]

const wellFormedTeams = rawTeams.filter(t => (t as { id: number }).id !== 2)

describe('fetchSourceData', () => {
  it('resolves ok:true with rawTeams/rawGames when both requests succeed and validate', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: wellFormedTeams, error: undefined })
    const fetchGames = vi.fn().mockResolvedValue({ data: rawGames, error: undefined })

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result).toEqual({ ok: true, rawTeams: wellFormedTeams, rawGames })
    expect(fetchTeams).toHaveBeenCalledTimes(1)
    expect(fetchGames).toHaveBeenCalledTimes(1)
  })

  it('fails without calling fetchGames when the teams request resolves with an error (CR-01)', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: undefined, error: { message: '401 Unauthorized' } })
    const fetchGames = vi.fn()

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Failed to fetch teams from CFBD')
    expect(fetchGames).not.toHaveBeenCalled()
  })

  it('fails when the teams request resolves with data: undefined and no error (missing data)', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: undefined, error: undefined })
    const fetchGames = vi.fn()

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('(no data returned)')
  })

  it('fails on a successful-but-empty teams response instead of writing an empty dataset', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: [], error: undefined })
    const fetchGames = vi.fn()

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('0 teams')
    expect(fetchGames).not.toHaveBeenCalled()
  })

  it('fails when the games request resolves with an error, after teams already succeeded', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: wellFormedTeams, error: undefined })
    const fetchGames = vi.fn().mockResolvedValue({ data: undefined, error: { message: '429 Too Many Requests' } })

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Failed to fetch games from CFBD')
  })

  it('fails on a successful-but-empty games response', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: wellFormedTeams, error: undefined })
    const fetchGames = vi.fn().mockResolvedValue({ data: [], error: undefined })

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('0 games')
  })

  it('fails and reports the structured team failures when a team is missing a required field', async () => {
    const fetchTeams = vi.fn().mockResolvedValue({ data: rawTeams, error: undefined })
    const fetchGames = vi.fn().mockResolvedValue({ data: rawGames, error: undefined })

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const parsed = JSON.parse(result.reason) as Array<{ teamId: number }>
      expect(parsed).toHaveLength(1)
      expect(parsed[0].teamId).toBe(2)
    }
  })

  it('fails and reports the structured game failures (WR-02) instead of throwing mid-map when a game is malformed', async () => {
    const malformedGame = { ...(rawGames[0] as Record<string, unknown>) }
    delete malformedGame.conferenceGame

    const fetchTeams = vi.fn().mockResolvedValue({ data: wellFormedTeams, error: undefined })
    const fetchGames = vi.fn().mockResolvedValue({ data: [malformedGame, rawGames[1], rawGames[2]], error: undefined })

    const result = await fetchSourceData(2026, { fetchTeams, fetchGames })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const parsed = JSON.parse(result.reason) as Array<{ gameId: number, errors: Record<string, unknown> }>
      expect(parsed).toHaveLength(1)
      expect(parsed[0].gameId).toBe((rawGames[0] as { id: number }).id)
      expect(parsed[0].errors).toHaveProperty('conferenceGame')
    }
  })

  it('never throws even when a mocked dependency rejects — surfaced as a rejected promise, not silently swallowed', async () => {
    const fetchTeams = vi.fn().mockRejectedValue(new Error('DNS lookup failed'))
    const fetchGames = vi.fn()

    await expect(fetchSourceData(2026, { fetchTeams, fetchGames })).rejects.toThrow('DNS lookup failed')
  })
})
