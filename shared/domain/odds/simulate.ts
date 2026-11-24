import { drawSeason, fixedWinners, randomChooser } from './seasonModel'
import type { ScenarioState, SeasonModel } from './seasonModel'
import { homeWinProbability, ratingWinProbability } from './winProbability'
import { simulateBracketPicks } from '../playoff/bracket'
import type { Game } from '../../types/schedule'

/** Seeded PRNG (mulberry32) -- reproducible baselines and tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface TeamOdds {
  teamId: number
  /** Plays in its conference title game (Power Four only -- the G6 has no standings engine). */
  titleGame: number
  conferenceTitle: number
  playoff: number
  bye: number
  nationalTitle: number
  /** `seedShare[i]` = share of simulations as seed i+1. */
  seedShare: number[]
}

export interface GameLeverage {
  gameId: number
  homeId: number
  awayId: number
  homeWinProbability: number
  /** P(outcome | home wins) - P(outcome | away wins). Positive = root for the home team. */
  delta: number
}

export interface SeasonOdds {
  season: number
  sims: number
  /** Unplayed, unpicked games the simulation drew. */
  openGames: number
  teams: TeamOdds[]
  /** Per team, the open games that move its title-game odds most. */
  titleGameLeverage: Record<number, GameLeverage[]>
  /** Per team, the open games that move its playoff odds most. */
  playoffLeverage: Record<number, GameLeverage[]>
  /** Per P4 conference, share of simulations where the title game came down to the ranking-metric proxy. */
  proxyShare: Record<string, number>
}

const LEVERAGE_KEEP = 12
const LEVERAGE_MIN_SAMPLES = 25
const LEVERAGE_MIN_DELTA = 0.005

/**
 * One Monte Carlo run over a scenario. Runs in chunks (`step`) so the Web
 * Worker can yield between them, post progressive results (`snapshot`)
 * and abandon a run the user's next pick made stale.
 */
export class SimulationRun {
  readonly model: SeasonModel
  readonly scenario: ScenarioState
  private readonly random: () => number
  private readonly fixed: Map<number, number>
  private readonly open: Game[]
  private readonly openIndex: Map<number, number>
  private readonly openHomeProbability: number[]
  private done = 0

  private readonly counts = new Map<number, { titleGame: number, conferenceTitle: number, playoff: number, bye: number, nationalTitle: number, seeds: number[] }>()
  private readonly sideCounts: Uint32Array
  private readonly titleGameByTeam = new Map<number, Uint32Array>()
  private readonly playoffByTeam = new Map<number, Uint32Array>()
  private readonly proxyCounts = new Map<string, number>()

  constructor(model: SeasonModel, scenario: ScenarioState, seed = 1) {
    this.model = model
    this.scenario = scenario
    this.random = mulberry32(seed)
    this.fixed = fixedWinners(model, scenario)
    this.open = model.regularGames.filter(g => !this.fixed.has(g.id))
    this.openIndex = new Map(this.open.map((g, i) => [g.id, i]))
    this.openHomeProbability = this.open.map(g => homeWinProbability(model.wp, g))
    this.sideCounts = new Uint32Array(this.open.length * 2)
  }

  get completed(): number {
    return this.done
  }

  private teamCounts(teamId: number) {
    let c = this.counts.get(teamId)
    if (!c) {
      c = { titleGame: 0, conferenceTitle: 0, playoff: 0, bye: 0, nationalTitle: 0, seeds: Array.from({ length: this.model.format.fieldSize }, () => 0) }
      this.counts.set(teamId, c)
    }
    return c
  }

  private bump(table: Map<number, Uint32Array>, teamId: number, sides: Uint8Array) {
    let arr = table.get(teamId)
    if (!arr) {
      arr = new Uint32Array(this.open.length * 2)
      table.set(teamId, arr)
    }
    for (let i = 0; i < sides.length; i++) arr[2 * i + sides[i]!]! += 1
  }

  step(sims: number): void {
    const choose = randomChooser(this.random)
    const { model } = this
    const sides = new Uint8Array(this.open.length)

    for (let s = 0; s < sims; s++) {
      const draw = drawSeason(model, this.scenario, choose, this.fixed)

      for (let i = 0; i < this.open.length; i++) {
        const g = this.open[i]!
        const side = draw.winners.get(g.id) === g.homeId ? 1 : 0
        sides[i] = side
        this.sideCounts[2 * i + side]! += 1
      }

      for (const [conference, resolution] of draw.titleGame) {
        if (!resolution.participants) continue
        if (resolution.proxyDecided) this.proxyCounts.set(conference, (this.proxyCounts.get(conference) ?? 0) + 1)
        for (const teamId of resolution.participants) {
          this.teamCounts(teamId).titleGame++
          this.bump(this.titleGameByTeam, teamId, sides)
        }
      }
      for (const r of draw.titleGameResults) this.teamCounts(r.winnerId).conferenceTitle++

      for (const entry of draw.field) {
        const c = this.teamCounts(entry.teamId)
        c.playoff++
        if (entry.seed <= model.format.byes) c.bye++
        c.seeds[entry.seed - 1]! += 1
        this.bump(this.playoffByTeam, entry.teamId, sides)
      }

      const bracket = simulateBracketPicks(
        model.format,
        draw.field,
        {},
        model.data.postseasonGames,
        (top, bottom, topHosts) => ratingWinProbability(model.wp, top, bottom, topHosts),
        this.random
      )
      const champion = bracket.final
      if (champion !== undefined) this.teamCounts(champion).nationalTitle++

      this.done++
    }
  }

  /**
   * Games that can structurally move a team's title-game odds: only the
   * games its own conference's tiebreaker engine reads. Restricting to
   * these removes sampling noise outright (a Miami game can't change the
   * SEC standings, however the random draws happened to correlate).
   */
  private titleGameRelevant(teamId: number): (gameId: number) => boolean {
    const conference = this.model.teamById.get(teamId)?.conference
    const ctx = this.model.contexts.find(c => c.conference === conference)
    if (!ctx) return () => false
    const ids = new Set(ctx.outcomeGames.map(g => g.id))
    return gameId => ids.has(gameId)
  }

  private leverage(table: Map<number, Uint32Array>, relevant?: (teamId: number) => (gameId: number) => boolean): Record<number, GameLeverage[]> {
    const out: Record<number, GameLeverage[]> = {}
    for (const [teamId, arr] of table) {
      const rows: GameLeverage[] = []
      const isRelevant = relevant?.(teamId)
      for (let i = 0; i < this.open.length; i++) {
        if (isRelevant && !isRelevant(this.open[i]!.id)) continue
        const awaySims = this.sideCounts[2 * i]!
        const homeSims = this.sideCounts[2 * i + 1]!
        if (awaySims < LEVERAGE_MIN_SAMPLES || homeSims < LEVERAGE_MIN_SAMPLES) continue
        const pHome = arr[2 * i + 1]! / homeSims
        const pAway = arr[2 * i]! / awaySims
        const delta = pHome - pAway
        if (Math.abs(delta) < LEVERAGE_MIN_DELTA) continue
        // Keep only deltas clearly bigger than their own sampling error.
        const standardError = Math.sqrt(pHome * (1 - pHome) / homeSims + pAway * (1 - pAway) / awaySims)
        if (!isRelevant && Math.abs(delta) < 2.5 * standardError) continue
        const g = this.open[i]!
        rows.push({ gameId: g.id, homeId: g.homeId, awayId: g.awayId, homeWinProbability: this.openHomeProbability[i]!, delta })
      }
      rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      out[teamId] = rows.slice(0, LEVERAGE_KEEP)
    }
    return out
  }

  snapshot(): SeasonOdds {
    const n = Math.max(1, this.done)
    const teams: TeamOdds[] = []
    for (const teamId of this.model.teamIds) {
      const c = this.counts.get(teamId)
      teams.push({
        teamId,
        titleGame: (c?.titleGame ?? 0) / n,
        conferenceTitle: (c?.conferenceTitle ?? 0) / n,
        playoff: (c?.playoff ?? 0) / n,
        bye: (c?.bye ?? 0) / n,
        nationalTitle: (c?.nationalTitle ?? 0) / n,
        seedShare: (c?.seeds ?? Array.from({ length: this.model.format.fieldSize }, () => 0)).map(v => v / n)
      })
    }
    const proxyShare: Record<string, number> = {}
    for (const ctx of this.model.contexts) proxyShare[ctx.conference] = (this.proxyCounts.get(ctx.conference) ?? 0) / n

    return {
      season: this.model.data.season,
      sims: this.done,
      openGames: this.open.length,
      teams,
      titleGameLeverage: this.leverage(this.titleGameByTeam, teamId => this.titleGameRelevant(teamId)),
      playoffLeverage: this.leverage(this.playoffByTeam),
      proxyShare
    }
  }

  /** Index of an open game within this run, or `undefined` if it's decided. */
  openGameIndex(gameId: number): number | undefined {
    return this.openIndex.get(gameId)
  }
}

/** Convenience: run `sims` simulations synchronously and return the result. */
export function simulateSeason(model: SeasonModel, scenario: ScenarioState, sims: number, seed = 1): SeasonOdds {
  const run = new SimulationRun(model, scenario, seed)
  run.step(sims)
  return run.snapshot()
}

export interface WinOutOdds {
  teamId: number
  /** Unplayed, unpicked games the team was forced to win. */
  gamesForced: number
  titleGame: number
  playoff: number
  bye: number
}

/**
 * "If they win out": re-runs the simulation with every one of the team's
 * remaining open games forced to a win (the scenario's own picks for its
 * games stand -- a picked loss stays a loss).
 */
export function winOutOdds(model: SeasonModel, scenario: ScenarioState, teamId: number, sims: number, seed = 7): WinOutOdds {
  const fixed = fixedWinners(model, scenario)
  const picks: Record<number, number> = { ...scenario.picks }
  let gamesForced = 0
  for (const g of model.regularGames) {
    if (fixed.has(g.id)) continue
    if (g.homeId === teamId || g.awayId === teamId) {
      picks[g.id] = teamId
      gamesForced++
    }
  }
  // Winning out includes the conference title game, if they get there.
  const conference = model.teamById.get(teamId)?.conference
  const championshipPicks = conference ? { ...scenario.championshipPicks, [conference]: teamId } : scenario.championshipPicks
  const odds = simulateSeason(model, { ...scenario, picks, championshipPicks }, sims, seed)
  const team = odds.teams.find(t => t.teamId === teamId)
  return { teamId, gamesForced, titleGame: team?.titleGame ?? 0, playoff: team?.playoff ?? 0, bye: team?.bye ?? 0 }
}
