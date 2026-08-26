import { z } from 'zod'

/**
 * Raw CFBD `/teams/fbs` shape. Every field except `id`/`school` is nullable
 * on the wire (RESEARCH.md Pitfall 4) — this schema is the single source of
 * truth for that nullability, not hand-typed assumptions.
 */
export const RawTeamSchema = z.object({
  id: z.number(),
  school: z.string(),
  mascot: z.string().nullable(),
  abbreviation: z.string().nullable(),
  conference: z.string().nullable(),
  classification: z.string().nullable(),
  color: z.string().nullable(),
  alternateColor: z.string().nullable(),
  logos: z.array(z.string()).nullable()
})

/**
 * Narrower schema for D-09's hard-fail check — same shape as `RawTeamSchema`,
 * but `conference`/`color`/`alternateColor` are required non-null. A team
 * failing this schema hard-fails the whole fetch script (nothing is
 * committed); logo presence is deliberately NOT part of this schema — that's
 * a soft-warn concern handled by Plan 04's coverage report (D-10).
 */
export const RequiredTeamFieldsSchema = RawTeamSchema.extend({
  conference: z.string(),
  color: z.string(),
  alternateColor: z.string()
})

export interface TeamOutput {
  id: number
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string
  classification: string | null
  color: string
  alternateColor: string
}

/**
 * Parses `raw` against `RequiredTeamFieldsSchema` and returns the minimal,
 * documented TeamOutput shape. No `logo`/`logos` field here — that is added
 * later by Plan 05's orchestration after calling `vendorLogo` (Plan 04).
 */
export function transformTeam(raw: unknown): TeamOutput {
  const team = RequiredTeamFieldsSchema.parse(raw)
  return {
    id: team.id,
    school: team.school,
    mascot: team.mascot,
    abbreviation: team.abbreviation,
    conference: team.conference,
    classification: team.classification,
    color: team.color,
    alternateColor: team.alternateColor
  }
}

export interface RequiredFieldFailure {
  teamId: number | undefined
  errors: Record<string, string[] | undefined>
}

/**
 * Maps every raw team through `RequiredTeamFieldsSchema.safeParse` and
 * returns only the failures — never throws. Drives D-09's hard-fail gate in
 * Plan 05's fetch-data.ts: nothing is written if this returns any failures.
 */
export function reportRequiredFieldFailures(rawTeams: unknown[]): RequiredFieldFailure[] {
  return rawTeams
    .map(raw => ({ raw, result: RequiredTeamFieldsSchema.safeParse(raw) }))
    .filter(({ result }) => !result.success)
    .map(({ raw, result }) => ({
      teamId: (raw as { id?: number }).id,
      errors: z.flattenError(result.error!).fieldErrors
    }))
}

/**
 * Raw CFBD `/games` shape. `conferenceGame`, `seasonType`, and `neutralSite`
 * are required, non-nullable fields on the wire (RESEARCH.md, confirmed
 * against the SDK source and the live OpenAPI spec) — that is what makes
 * verbatim passthrough safe by construction.
 */
export const RawGameSchema = z.object({
  id: z.number(),
  week: z.number(),
  seasonType: z.string(),
  homeId: z.number(),
  homeTeam: z.string(),
  awayId: z.number(),
  awayTeam: z.string(),
  conferenceGame: z.boolean(),
  neutralSite: z.boolean()
})

export interface GameOutput {
  id: number
  week: number
  seasonType: string
  homeId: number
  homeTeam: string
  awayId: number
  awayTeam: string
  conferenceGame: boolean
  neutralSite: boolean
}

/**
 * Parses `raw` against `RawGameSchema` and returns those 9 fields directly
 * from the parse result — zero derivation logic. `conferenceGame` and
 * `seasonType` must never be recomputed by comparing home/away team
 * conferences (DATA-06's constraint, RESEARCH.md Anti-Patterns) — this
 * function copies them straight through.
 *
 * Callers should gate on `reportGameFailures` first (mirroring the team
 * path's `reportRequiredFieldFailures`) so a single malformed game doesn't
 * throw an uncaught `ZodError` mid-`.map()`.
 */
export function transformGame(raw: unknown): GameOutput {
  const game = RawGameSchema.parse(raw)
  return {
    id: game.id,
    week: game.week,
    seasonType: game.seasonType,
    homeId: game.homeId,
    homeTeam: game.homeTeam,
    awayId: game.awayId,
    awayTeam: game.awayTeam,
    conferenceGame: game.conferenceGame,
    neutralSite: game.neutralSite
  }
}

/**
 * Raw CFBD `/rankings` shape (one entry per season+week+seasonType). `polls`
 * holds every poll published that week (AP, Coaches, CFP once it starts) —
 * selection between them happens in `pickPoll`, not here.
 */
export const RawPollRankSchema = z.object({
  rank: z.number().nullable(),
  teamId: z.number(),
  school: z.string()
})

export const RawPollSchema = z.object({
  poll: z.string(),
  ranks: z.array(RawPollRankSchema)
})

export const RawPollWeekSchema = z.object({
  season: z.number(),
  week: z.number(),
  polls: z.array(RawPollSchema)
})

/**
 * Picks the CFP committee poll when present (published from roughly week 9
 * on), falling back to AP Top 25 — matches the poll-source decision made
 * when this feature was scoped. Returns `undefined` if neither poll is in
 * the response (e.g. very early preseason weeks).
 */
export function pickPoll(polls: z.infer<typeof RawPollSchema>[]) {
  return (
    polls.find(p => p.poll.toLowerCase().includes('playoff committee'))
    ?? polls.find(p => p.poll === 'AP Top 25')
  )
}

export interface RankingsOutput {
  season: number
  week: number
  poll: string
  rankings: { teamId: number, rank: number }[]
}

/**
 * Transforms the latest `PollWeek` entry (already selected by the caller —
 * `/rankings` with no `week` param returns every week of the season) into
 * the committed `rankings.json` shape. Drops unranked teams (`rank: null`).
 */
export function transformRankings(raw: unknown): RankingsOutput | undefined {
  const week = RawPollWeekSchema.parse(raw)
  const poll = pickPoll(week.polls)
  if (!poll) return undefined

  return {
    season: week.season,
    week: week.week,
    poll: poll.poll,
    rankings: poll.ranks
      .filter((r): r is typeof r & { rank: number } => r.rank !== null)
      .map(r => ({ teamId: r.teamId, rank: r.rank }))
  }
}

/**
 * Raw CFBD `/metrics/wp/pregame` shape — one entry per game with a published
 * pregame model estimate. Not every game gets one (FCS opponents, games
 * without enough model inputs), so this is a sparse list keyed by `gameId`.
 */
export const RawPregameWinProbabilitySchema = z.object({
  gameId: z.number(),
  homeWinProbability: z.number()
})

export interface WinProbabilityOutput {
  gameId: number
  homeWinProbability: number
}

export function transformWinProbabilities(rawList: unknown[]): WinProbabilityOutput[] {
  return rawList.map((raw) => {
    const wp = RawPregameWinProbabilitySchema.parse(raw)
    return { gameId: wp.gameId, homeWinProbability: wp.homeWinProbability }
  })
}

export interface GameFailure {
  gameId: number | undefined
  errors: Record<string, string[] | undefined>
}

/**
 * Maps every raw game through `RawGameSchema.safeParse` and returns only the
 * failures — never throws. The game-validation sibling of
 * `reportRequiredFieldFailures`: drives the same hard-fail-before-any-write
 * gate for games that teams already have, and reports every failing game in
 * one pass instead of throwing mid-`.map()` on the first bad record.
 */
export function reportGameFailures(rawGames: unknown[]): GameFailure[] {
  return rawGames
    .map(raw => ({ raw, result: RawGameSchema.safeParse(raw) }))
    .filter(({ result }) => !result.success)
    .map(({ raw, result }) => ({
      gameId: (raw as { id?: number }).id,
      errors: z.flattenError(result.error!).fieldErrors
    }))
}
