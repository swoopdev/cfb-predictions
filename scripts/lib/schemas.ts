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
  neutralSite: z.boolean(),
  venueId: z.number().nullable(),
  completed: z.boolean(),
  homePoints: z.number().nullable(),
  awayPoints: z.number().nullable()
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
  venueId: number | null
  completed: boolean
  homePoints: number | null
  awayPoints: number | null
}

/**
 * Parses `raw` against `RawGameSchema` and returns those fields directly
 * from the parse result — zero derivation logic. `conferenceGame` and
 * `seasonType` must never be recomputed by comparing home/away team
 * conferences (DATA-06's constraint, RESEARCH.md Anti-Patterns) — this
 * function copies them straight through. `venueId` joins against the
 * one-time `venues.json` (`scripts/fetch-data.ts`'s `getVenues()` call) for
 * the game-detail modal's venue row.
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
    neutralSite: game.neutralSite,
    venueId: game.venueId,
    completed: game.completed,
    homePoints: game.homePoints,
    awayPoints: game.awayPoints
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

/**
 * Raw CFBD `/lines` shape. `lines` holds one entry per betting provider for
 * a game -- selection between them happens in `pickLine`, not here.
 */
export const RawGameLineSchema = z.object({
  provider: z.string(),
  spread: z.number().nullable(),
  formattedSpread: z.string(),
  spreadOpen: z.number().nullable(),
  overUnder: z.number().nullable(),
  homeMoneyline: z.number().nullable(),
  awayMoneyline: z.number().nullable()
})

export const RawBettingGameSchema = z.object({
  id: z.number(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  lines: z.array(RawGameLineSchema)
})

/**
 * Picks a single line per game: prefers a "consensus" provider (CFBD's
 * blended line across books) when present, otherwise the first provider
 * returned. Returns `undefined` for a game with no lines published yet.
 */
export function pickLine(lines: z.infer<typeof RawGameLineSchema>[]) {
  return lines.find(l => l.provider.toLowerCase() === 'consensus') ?? lines[0]
}

export interface BettingLineOutput {
  gameId: number
  favored: 'home' | 'away' | 'even'
  spread: number
  homeMoneyline: number | null
  awayMoneyline: number | null
  /** Which side was favored at the opening line -- `null` when there's no `spreadOpen`, or the current line is a pick 'em (see `resolveOpenSpread`). */
  openFavored: 'home' | 'away' | 'even' | null
  openSpread: number | null
}

/**
 * Resolves the opening line's favored side from `spreadOpen`'s sign
 * relative to the CURRENT `spread`'s sign, rather than assuming an absolute
 * sign convention (CFBD doesn't document one — same reasoning as
 * `pickFavoredSide`). `spread` and `spreadOpen` are the same field family on
 * the same record, so whatever sign `spread` uses to mean "`favored`" is
 * guaranteed to mean the same thing for `spreadOpen` — if `spreadOpen`
 * shares that sign, the same side was favored at open (just a different
 * magnitude); if it's the opposite sign, the favorite flipped since
 * opening. Undecidable when the current line is a pick 'em (`spread === 0`
 * has no sign to compare against) — returns `null` rather than guessing.
 */
export function resolveOpenSpread(
  spreadOpen: number | null,
  currentSpreadRaw: number | null,
  favored: 'home' | 'away' | 'even'
): { favored: 'home' | 'away' | 'even', spread: number } | null {
  if (spreadOpen === null || favored === 'even' || !currentSpreadRaw) return null
  const signCurrent = Math.sign(currentSpreadRaw)
  const signOpen = Math.sign(spreadOpen)
  if (signOpen === 0) return { favored: 'even', spread: 0 }
  const sameSide = signOpen === signCurrent
  const otherSide = favored === 'home' ? 'away' : 'home'
  return { favored: sameSide ? favored : otherSide, spread: Math.abs(spreadOpen) }
}

/**
 * Resolves which side `formattedSpread` (e.g. "Florida State -14.5") favors
 * by matching its leading team name against the game's own `homeTeam`/
 * `awayTeam` strings — CFBD doesn't document a sign convention for the raw
 * `spread` field, but `formattedSpread` names the favored team explicitly,
 * so matching it is more reliable than guessing a sign. `spread === 0` (or
 * a `formattedSpread` that starts with neither team, e.g. "Pick") is a pick
 * 'em. Returns `undefined` only when the format is unrecognized in some
 * other way — better to drop the game than show a guessed favorite.
 */
export function pickFavoredSide(
  line: z.infer<typeof RawGameLineSchema>,
  homeTeam: string,
  awayTeam: string
): { favored: 'home' | 'away' | 'even', spread: number } | undefined {
  if (line.spread === 0) return { favored: 'even', spread: 0 }
  if (line.formattedSpread.startsWith(homeTeam)) {
    return { favored: 'home', spread: Math.abs(line.spread ?? 0) }
  }
  if (line.formattedSpread.startsWith(awayTeam)) {
    return { favored: 'away', spread: Math.abs(line.spread ?? 0) }
  }
  if (line.formattedSpread.toLowerCase().includes('pick')) {
    return { favored: 'even', spread: 0 }
  }
  return undefined
}

/**
 * Transforms the raw `/lines` response into the committed
 * `betting-lines.json` shape -- one row per game with a published line whose
 * favored side `pickFavoredSide` could resolve.
 */
export function transformBettingLines(rawList: unknown[]): BettingLineOutput[] {
  const output: BettingLineOutput[] = []
  for (const raw of rawList) {
    const game = RawBettingGameSchema.parse(raw)
    const line = pickLine(game.lines)
    if (!line) continue
    const resolved = pickFavoredSide(line, game.homeTeam, game.awayTeam)
    if (!resolved) continue
    const open = resolveOpenSpread(line.spreadOpen, line.spread, resolved.favored)
    output.push({
      gameId: game.id,
      favored: resolved.favored,
      spread: resolved.spread,
      homeMoneyline: line.homeMoneyline,
      awayMoneyline: line.awayMoneyline,
      openFavored: open?.favored ?? null,
      openSpread: open?.spread ?? null
    })
  }
  return output
}

/**
 * Builds a school-name -> team-id lookup from the committed `teams.json`
 * shape. SP+/FPI/Elo/talent all key their rows by team name string (no
 * `teamId` field on the wire), so every one of those transforms needs this
 * to resolve back to our canonical team id. Names are CFBD's own `school`
 * strings on both sides, so an exact match is expected to hold for every
 * FBS team; a team that doesn't match (should only happen for FCS/non-FBS
 * rows these endpoints sometimes include) is silently dropped by the caller
 * rather than guessed at.
 */
export function buildTeamIdByName(teams: { id: number, school: string }[]): Map<string, number> {
  return new Map(teams.map(t => [t.school, t.id]))
}

/**
 * Raw CFBD `/media` shape — one entry per game with a published broadcast.
 */
export const RawGameMediaSchema = z.object({
  id: z.number(),
  mediaType: z.string(),
  outlet: z.string(),
  startTime: z.string(),
  isStartTimeTBD: z.boolean()
})

export interface GameMediaOutput {
  gameId: number
  mediaType: string
  outlet: string
  startTime: string
  isStartTimeTBD: boolean
}

export function transformMedia(rawList: unknown[]): GameMediaOutput[] {
  return rawList.map((raw) => {
    const media = RawGameMediaSchema.parse(raw)
    return {
      gameId: media.id,
      mediaType: media.mediaType,
      outlet: media.outlet,
      startTime: media.startTime,
      isStartTimeTBD: media.isStartTimeTBD
    }
  })
}

/**
 * Raw CFBD shapes for the four team-rating sources merged into
 * `team-ratings.json`. Each is keyed by team name on the wire (`/lines`-
 * style teamId is only present on `/ratings/ats`) — resolved to a
 * `teamId` via `buildTeamIdByName` in `transformTeamRatings`.
 */
const RawSpSideSchema = z.object({
  rating: z.number(),
  ranking: z.number().nullable(),
  success: z.number().nullable(),
  explosiveness: z.number().nullable()
})

export const RawTeamSpSchema = z.object({
  team: z.string(),
  rating: z.number(),
  ranking: z.number().nullable(),
  offense: RawSpSideSchema,
  defense: RawSpSideSchema
})

export const RawTeamFpiSchema = z.object({
  team: z.string(),
  fpi: z.number().nullable(),
  resumeRanks: z.object({
    fpi: z.number().nullable()
  })
})

export const RawTeamEloSchema = z.object({
  team: z.string(),
  elo: z.number().nullable()
})

export const RawTeamAtsSchema = z.object({
  teamId: z.number(),
  atsWins: z.number(),
  atsLosses: z.number(),
  atsPushes: z.number()
})

/**
 * Merges the four raw rating lists into one row per team, keyed by teamId.
 * A team present in only some sources (e.g. an FCS team with no SP+ rating,
 * or a team with no Elo entry yet) still gets a row -- missing fields are
 * `null`, never a dropped row. Rows that can't resolve to a known teamId
 * (SP+/FPI/Elo name doesn't match any team in `teamIdByName`) are dropped
 * for that source only, not the whole merged row.
 */
export function transformTeamRatings(
  rawSp: unknown[],
  rawFpi: unknown[],
  rawElo: unknown[],
  rawAts: unknown[],
  teamIdByName: Map<string, number>
) {
  const byTeamId = new Map<number, {
    teamId: number
    spRating: number | null
    spRanking: number | null
    spOffense: { rating: number, ranking: number | null, success: number | null, explosiveness: number | null } | null
    spDefense: { rating: number, ranking: number | null, success: number | null, explosiveness: number | null } | null
    fpi: number | null
    fpiRanking: number | null
    elo: number | null
    atsWins: number | null
    atsLosses: number | null
    atsPushes: number | null
  }>()

  function getOrCreate(teamId: number) {
    let row = byTeamId.get(teamId)
    if (!row) {
      row = { teamId, spRating: null, spRanking: null, spOffense: null, spDefense: null, fpi: null, fpiRanking: null, elo: null, atsWins: null, atsLosses: null, atsPushes: null }
      byTeamId.set(teamId, row)
    }
    return row
  }

  for (const raw of rawSp) {
    const sp = RawTeamSpSchema.parse(raw)
    const teamId = teamIdByName.get(sp.team)
    if (teamId === undefined) continue
    const row = getOrCreate(teamId)
    row.spRating = sp.rating
    row.spRanking = sp.ranking
    row.spOffense = sp.offense
    row.spDefense = sp.defense
  }

  for (const raw of rawFpi) {
    const fpi = RawTeamFpiSchema.parse(raw)
    const teamId = teamIdByName.get(fpi.team)
    if (teamId === undefined) continue
    const row = getOrCreate(teamId)
    row.fpi = fpi.fpi
    row.fpiRanking = fpi.resumeRanks.fpi
  }

  for (const raw of rawElo) {
    const elo = RawTeamEloSchema.parse(raw)
    const teamId = teamIdByName.get(elo.team)
    if (teamId === undefined) continue
    getOrCreate(teamId).elo = elo.elo
  }

  for (const raw of rawAts) {
    const ats = RawTeamAtsSchema.parse(raw)
    const row = getOrCreate(ats.teamId)
    row.atsWins = ats.atsWins
    row.atsLosses = ats.atsLosses
    row.atsPushes = ats.atsPushes
  }

  return [...byTeamId.values()]
}

/**
 * Raw CFBD `/venues` shape — fetched once (Plan-05-style `fetch-data.ts`
 * addition), not on the weekly cadence.
 */
export const RawVenueSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  capacity: z.number().nullable(),
  grass: z.boolean().nullable().optional(),
  dome: z.boolean().nullable().optional()
})

export interface VenueOutput {
  id: number
  name: string | null
  city: string | null
  state: string | null
  capacity: number | null
  grass: boolean | null
  dome: boolean | null
}

/**
 * Drops any venue with a `null` id (CFBD nullability quirk on this
 * endpoint) — a venue we can't key by id is useless for the `venueId` join
 * `weather.json` needs.
 */
export function transformVenues(rawList: unknown[]): VenueOutput[] {
  const output: VenueOutput[] = []
  for (const raw of rawList) {
    const v = RawVenueSchema.parse(raw)
    if (v.id === null) continue
    output.push({
      id: v.id,
      name: v.name,
      city: v.city,
      state: v.state,
      capacity: v.capacity,
      grass: v.grass ?? null,
      dome: v.dome ?? null
    })
  }
  return output
}

/**
 * Raw CFBD `/talent` shape — fetched once, keyed by team name like
 * SP+/FPI/Elo above.
 */
export const RawTeamTalentSchema = z.object({
  team: z.string(),
  talent: z.number()
})

export interface TeamTalentOutput {
  teamId: number
  talent: number
}

export function transformTalent(rawList: unknown[], teamIdByName: Map<string, number>): TeamTalentOutput[] {
  const output: TeamTalentOutput[] = []
  for (const raw of rawList) {
    const t = RawTeamTalentSchema.parse(raw)
    const teamId = teamIdByName.get(t.team)
    if (teamId === undefined) continue
    output.push({ teamId, talent: t.talent })
  }
  return output
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

/**
 * Raw CFBD `/roster` shape — fetched once (`scripts/fetch-team-data.ts`),
 * keyed by team NAME on the wire like SP+/FPI/Elo/talent. Unlike those, the
 * player's own id is a string, not a number.
 */
export const RawRosterPlayerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  team: z.string(),
  position: z.string().nullable(),
  jersey: z.number().nullable(),
  height: z.number().nullable(),
  weight: z.number().nullable()
})

export interface RosterPlayerOutput {
  id: string
  teamId: number
  firstName: string
  lastName: string
  position: string | null
  jersey: number | null
  height: number | null
  weight: number | null
}

/**
 * Drops a player whose `team` name doesn't resolve to a known teamId
 * (transfer portal entries mid-fetch, or a non-FBS team) rather than
 * emitting a row with no usable join key.
 */
export function transformRoster(rawList: unknown[], teamIdByName: Map<string, number>): RosterPlayerOutput[] {
  const output: RosterPlayerOutput[] = []
  for (const raw of rawList) {
    const p = RawRosterPlayerSchema.parse(raw)
    const teamId = teamIdByName.get(p.team)
    if (teamId === undefined) continue
    output.push({
      id: p.id,
      teamId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jersey: p.jersey,
      height: p.height,
      weight: p.weight
    })
  }
  return output
}

/**
 * Raw CFBD `/coaches` shape — one coach with their FULL season-by-season
 * history (every team, every year they've coached), regardless of the
 * requested `year` query param. `teamId` lives on each `CoachSeason` entry,
 * not on the coach record itself, since a coach's team changes across
 * seasons.
 */
const RawCoachSeasonSchema = z.object({
  teamId: z.number(),
  year: z.number(),
  wins: z.number(),
  losses: z.number(),
  ties: z.number()
})

export const RawCoachSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  seasons: z.array(RawCoachSeasonSchema)
})

export interface CoachOutput {
  teamId: number
  firstName: string
  lastName: string
  careerRecord: { wins: number, losses: number, ties: number, firstYear: number, lastYear: number }
}

/**
 * One row per team: the coach whose `seasons` array has an entry for
 * `targetYear`, with that team as `teamId`. `careerRecord` sums the coach's
 * ENTIRE seasons array (every team, every year on record) -- a whole-career
 * total, not just the tenure at the current school.
 *
 * Deliberately does NOT expose the matched `targetYear` entry's own
 * wins/losses as a "this season" field: verified against the live API that
 * CFBD's `/coaches` win/loss counts for the CURRENT season lag behind
 * `/games`/`/records` (a completed, recorded win still read 0-0 on this
 * endpoint) -- the team page's Record card, sourced from `records.json`, is
 * the accurate "this season" number and this would only contradict it.
 *
 * If two raw coach records both have a `targetYear` entry for the same team
 * (a mid-season interim replacement, which CFBD represents as two coach
 * records rather than one), the LAST one encountered in `rawList` wins --
 * matches this endpoint's own ordering, which lists a season's replacement
 * coach after the one they replaced.
 */
export function transformCoaches(rawList: unknown[], targetYear: number): CoachOutput[] {
  const byTeamId = new Map<number, CoachOutput>()

  for (const raw of rawList) {
    const coach = RawCoachSchema.parse(raw)
    if (coach.seasons.length === 0) continue

    const current = coach.seasons.find(s => s.year === targetYear)
    if (!current) continue

    const years = coach.seasons.map(s => s.year)
    const careerRecord = coach.seasons.reduce(
      (acc, s) => ({
        wins: acc.wins + s.wins,
        losses: acc.losses + s.losses,
        ties: acc.ties + s.ties,
        firstYear: Math.min(acc.firstYear, s.year),
        lastYear: Math.max(acc.lastYear, s.year)
      }),
      { wins: 0, losses: 0, ties: 0, firstYear: Math.min(...years), lastYear: Math.max(...years) }
    )

    byTeamId.set(current.teamId, {
      teamId: current.teamId,
      firstName: coach.firstName,
      lastName: coach.lastName,
      careerRecord
    })
  }

  return [...byTeamId.values()]
}

/**
 * Raw CFBD `/recruiting/teams` shape — fetched once, like roster/coaches.
 * Keyed by team NAME on the wire.
 */
export const RawTeamRecruitingSchema = z.object({
  rank: z.number(),
  team: z.string(),
  points: z.number()
})

export interface RecruitingRankOutput {
  teamId: number
  rank: number
  points: number
}

export function transformRecruiting(rawList: unknown[], teamIdByName: Map<string, number>): RecruitingRankOutput[] {
  const output: RecruitingRankOutput[] = []
  for (const raw of rawList) {
    const r = RawTeamRecruitingSchema.parse(raw)
    const teamId = teamIdByName.get(r.team)
    if (teamId === undefined) continue
    output.push({ teamId, rank: r.rank, points: r.points })
  }
  return output
}

/**
 * Raw CFBD `/records` shape. Unlike SP+/FPI/Elo/talent/roster/recruiting,
 * `teamId` is already on the wire here -- no name resolution needed.
 */
const RawRecordSplitSchema = z.object({
  games: z.number(),
  wins: z.number(),
  losses: z.number(),
  ties: z.number()
})

export const RawTeamRecordsSchema = z.object({
  teamId: z.number(),
  expectedWins: z.number().nullable(),
  total: RawRecordSplitSchema,
  conferenceGames: RawRecordSplitSchema,
  homeGames: RawRecordSplitSchema,
  awayGames: RawRecordSplitSchema,
  neutralSiteGames: RawRecordSplitSchema
})

export interface TeamRecordsOutput {
  teamId: number
  expectedWins: number | null
  total: { games: number, wins: number, losses: number, ties: number }
  conferenceGames: { games: number, wins: number, losses: number, ties: number }
  homeGames: { games: number, wins: number, losses: number, ties: number }
  awayGames: { games: number, wins: number, losses: number, ties: number }
  neutralSiteGames: { games: number, wins: number, losses: number, ties: number }
}

export function transformRecords(rawList: unknown[]): TeamRecordsOutput[] {
  return rawList.map((raw) => {
    const r = RawTeamRecordsSchema.parse(raw)
    return {
      teamId: r.teamId,
      expectedWins: r.expectedWins,
      total: r.total,
      conferenceGames: r.conferenceGames,
      homeGames: r.homeGames,
      awayGames: r.awayGames,
      neutralSiteGames: r.neutralSiteGames
    }
  })
}

/**
 * Raw CFBD `/stats/season` shape -- one flat row per `statName` per team,
 * keyed by team NAME. `statValue` is `string | number` on the wire (CFBD
 * does not document a fixed set of `statName`s or guarantee numeric typing
 * for all of them).
 */
export const RawTeamStatSchema = z.object({
  team: z.string(),
  statName: z.string(),
  statValue: z.union([z.string(), z.number()])
})

export interface TeamStatsRowOutput {
  teamId: number
  stats: Record<string, number | string>
}

/**
 * Pivots the flat statName/statValue rows into one row per team. A team
 * whose name doesn't resolve is dropped for the same reason as every other
 * name-keyed source here (transfer/FCS name mismatch, not a data error worth
 * failing the whole fetch over).
 */
export function transformTeamStats(rawList: unknown[], teamIdByName: Map<string, number>): TeamStatsRowOutput[] {
  const byTeamId = new Map<number, TeamStatsRowOutput>()
  for (const raw of rawList) {
    const s = RawTeamStatSchema.parse(raw)
    const teamId = teamIdByName.get(s.team)
    if (teamId === undefined) continue
    let row = byTeamId.get(teamId)
    if (!row) {
      row = { teamId, stats: {} }
      byTeamId.set(teamId, row)
    }
    row.stats[s.statName] = s.statValue
  }
  return [...byTeamId.values()]
}

/**
 * Raw CFBD `/stats/player/season` shape -- one flat row per player per
 * category/statType, keyed by team NAME. Verbatim passthrough plus name
 * resolution and roster-jersey enrichment; which rows constitute a team's
 * "stat leaders" is a display decision made downstream by
 * `app/utils/statLeaders.ts`, not here.
 */
export const RawPlayerStatSchema = z.object({
  playerId: z.string(),
  player: z.string(),
  position: z.string(),
  team: z.string(),
  category: z.string(),
  statType: z.string(),
  stat: z.union([z.string(), z.number()])
})

export interface PlayerStatOutput {
  playerId: string
  player: string
  teamId: number
  position: string
  category: string
  statType: string
  stat: number | string
  jersey: number | null
}

/**
 * `jerseyByPlayerId` is the one-time `roster.json`'s ids -- built by the
 * caller once and passed in, rather than this function re-deriving it, so a
 * mid-season transfer/walk-on absent from the one-time roster fetch simply
 * gets `jersey: null` instead of failing the whole row.
 */
export function transformPlayerStats(
  rawList: unknown[],
  teamIdByName: Map<string, number>,
  jerseyByPlayerId: Map<string, number | null>
): PlayerStatOutput[] {
  const output: PlayerStatOutput[] = []
  for (const raw of rawList) {
    const s = RawPlayerStatSchema.parse(raw)
    const teamId = teamIdByName.get(s.team)
    if (teamId === undefined) continue
    output.push({
      playerId: s.playerId,
      player: s.player,
      teamId,
      position: s.position,
      category: s.category,
      statType: s.statType,
      stat: s.stat,
      jersey: jerseyByPlayerId.get(s.playerId) ?? null
    })
  }
  return output
}
