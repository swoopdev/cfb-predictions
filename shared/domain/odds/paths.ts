import type { ConferenceId } from '../tiebreakers/types'
import { resolveTitleGame } from './conferenceResolver'
import { fixedWinners } from './seasonModel'
import type { ScenarioState, SeasonModel } from './seasonModel'
import { homeWinProbability } from './winProbability'

/**
 * Exact "paths to the title game": when few enough games that can move a
 * conference's standings are still undecided, every combination of their
 * outcomes is run through the tiebreaker engine, and each team's winning
 * combinations are reduced to a short list of plain conditions ("beats
 * Texas A&M and Ole Miss beats Mississippi State").
 *
 * The user's picks are fixed inputs, so as they pick games the remaining
 * combinations shrink and the paths become "how they get there given
 * everything I've picked".
 */

/** 2^12 = 4,096 tiebreaker runs, ~1 s in a worker. Beyond this the hub shows simulated odds instead. */
export const MAX_EXACT_GAMES = 12

export interface PathCondition {
  gameId: number
  winnerId: number
  loserId: number
}

export interface TitleGamePath {
  conditions: PathCondition[]
  /** Probability every condition happens (paths overlap, so these don't sum to the team's total). */
  probability: number
}

export type TitleGameStatus = 'clinched' | 'eliminated' | 'alive'

export interface TeamTitleGamePaths {
  teamId: number
  /** Exact probability, weighting each combination by its games' win probabilities. */
  probability: number
  status: TitleGameStatus
  /** Combinations that put the team in without the ranking-metric proxy. */
  definiteCombinations: number
  /** Combinations where the team's spot came down to the ranking-based final tiebreaker. */
  metricCombinations: number
  /** Minimal paths that guarantee a spot, most likely first. */
  paths: TitleGamePath[]
  /** Minimal paths that put the team in the ranking-metric tie (could go either way). */
  metricPaths: TitleGamePath[]
  /** Paths beyond the ones listed, so the UI can say "and N more". */
  morePaths: number
  /** Winning every remaining game guarantees a spot. */
  controlsDestiny: boolean
}

export interface OpenGame {
  gameId: number
  homeId: number
  awayId: number
  homeWinProbability: number
  conferenceGame: boolean
}

export type ConferencePaths
  = | {
    mode: 'exact'
    conference: ConferenceId
    games: OpenGame[]
    combinations: number
    teams: TeamTitleGamePaths[]
  }
  | {
    mode: 'too-many'
    conference: ConferenceId
    /** Undecided games that can move this conference's standings. */
    openGames: number
  }

const MAX_PATHS = 8

/** Every assignment inside a cube (fixed bits `mask` = `value`) satisfies `inside`. */
function cubeInside(n: number, mask: number, value: number, inside: (m: number) => boolean): boolean {
  const free = ~mask & ((1 << n) - 1)
  let sub = free
  for (;;) {
    if (!inside(value | sub)) return false
    if (sub === 0) return true
    sub = (sub - 1) & free
  }
}

/**
 * Greedy cover: take the most likely uncovered combination, widen it by
 * dropping conditions (least influential games first, the team's own games
 * last) while every combination it covers stays good, repeat. Produces
 * prime implicants -- short, true statements -- ordered by likelihood.
 */
function coverPaths(
  n: number,
  targets: readonly number[],
  inside: (m: number) => boolean,
  weight: Float64Array,
  dropOrder: readonly number[],
  maxPaths: number
): { cubes: { mask: number, value: number }[], uncovered: number } {
  const full = (1 << n) - 1
  const remaining = new Set(targets)
  const sorted = [...targets].sort((a, b) => weight[b]! - weight[a]!)
  const cubes: { mask: number, value: number }[] = []
  for (const start of sorted) {
    if (!remaining.has(start)) continue
    if (cubes.length >= maxPaths) break
    let mask = full
    for (const v of dropOrder) {
      const next = mask & ~(1 << v)
      if (cubeInside(n, next, start & next, inside)) mask = next
    }
    const value = start & mask
    cubes.push({ mask, value })
    for (const m of [...remaining]) if ((m & mask) === value) remaining.delete(m)
  }
  // Count how many more cubes a full cover would need, without listing them.
  let more = 0
  while (remaining.size > 0 && more < 50) {
    const start = [...remaining].sort((a, b) => weight[b]! - weight[a]!)[0]!
    let mask = full
    for (const v of dropOrder) {
      const next = mask & ~(1 << v)
      if (cubeInside(n, next, start & next, inside)) mask = next
    }
    const value = start & mask
    for (const m of [...remaining]) if ((m & mask) === value) remaining.delete(m)
    more++
  }
  return { cubes, uncovered: more }
}

export function enumerateTitleGamePaths(
  model: SeasonModel,
  scenario: ScenarioState,
  conference: ConferenceId,
  maxGames = MAX_EXACT_GAMES
): ConferencePaths {
  const ctx = model.contextByConference.get(conference)
  if (!ctx) return { mode: 'too-many', conference, openGames: 0 }

  const fixed = fixedWinners(model, scenario)
  const open = ctx.outcomeGames.filter(g => !fixed.has(g.id))
  if (open.length > maxGames) return { mode: 'too-many', conference, openGames: open.length }

  const n = open.length
  const N = 1 << n
  const pHome = open.map(g => homeWinProbability(model.wp, g))
  const weight = new Float64Array(N)
  const members = [...ctx.teamIds]
  /** 0 = out, 1 = in, 2 = in the ranking-metric tie at the cut line. */
  const status = new Map<number, Uint8Array>(members.map(t => [t, new Uint8Array(N)]))
  const probability = new Map<number, number>(members.map(t => [t, 0]))
  const manual = scenario.manualDecisions[conference]

  const winners = new Map(fixed)
  for (let m = 0; m < N; m++) {
    let w = 1
    for (let i = 0; i < n; i++) {
      const g = open[i]!
      const homeWins = ((m >> i) & 1) === 1
      winners.set(g.id, homeWins ? g.homeId : g.awayId)
      w *= homeWins ? pHome[i]! : 1 - pHome[i]!
    }
    weight[m] = w
    const res = resolveTitleGame(ctx, id => winners.get(id), model.proxy, manual, true)
    if (!res.participants) continue
    const boundary = new Set(res.boundaryGroup)
    for (const t of res.participants) {
      status.get(t)![m] = res.proxyDecided && boundary.has(t) ? 2 : 1
      probability.set(t, probability.get(t)! + w)
    }
    if (res.proxyDecided) for (const t of boundary) if (status.get(t)![m] === 0) status.get(t)![m] = 2
  }

  const teams: TeamTitleGamePaths[] = members.map((teamId) => {
    const st = status.get(teamId)!
    const definite: number[] = []
    const metric: number[] = []
    for (let m = 0; m < N; m++) {
      if (st[m] === 1) definite.push(m)
      else if (st[m] === 2) metric.push(m)
    }
    const own = open.map((g, i) => (g.homeId === teamId || g.awayId === teamId ? i : -1)).filter(i => i >= 0)
    const ownSet = new Set(own)
    // Influence of each game on this team's status: how often flipping it alone changes the answer.
    const influence = open.map((_, i) => {
      let flips = 0
      for (let m = 0; m < N; m++) if (st[m] !== st[m ^ (1 << i)]) flips++
      return flips
    })
    const dropOrder = open
      .map((_, i) => i)
      .sort((a, b) => Number(ownSet.has(a)) - Number(ownSet.has(b)) || influence[a]! - influence[b]!)

    const toPath = ({ mask, value }: { mask: number, value: number }): TitleGamePath => {
      const conditions: PathCondition[] = []
      let p = 1
      for (let i = 0; i < n; i++) {
        if (((mask >> i) & 1) === 0) continue
        const g = open[i]!
        const homeWins = ((value >> i) & 1) === 1
        conditions.push({ gameId: g.id, winnerId: homeWins ? g.homeId : g.awayId, loserId: homeWins ? g.awayId : g.homeId })
        p *= homeWins ? pHome[i]! : 1 - pHome[i]!
      }
      // The team's own games first, then everyone else's.
      conditions.sort((a, b) => Number(b.winnerId === teamId || b.loserId === teamId) - Number(a.winnerId === teamId || a.loserId === teamId))
      return { conditions, probability: p }
    }

    const isDefinite = (m: number) => st[m] === 1
    const isPossible = (m: number) => st[m] !== 0
    const clinched = definite.length === N
    const definiteCover = clinched || definite.length === 0
      ? { cubes: [], uncovered: 0 }
      : coverPaths(n, definite, isDefinite, weight, dropOrder, MAX_PATHS)
    const metricCover = metric.length === 0
      ? { cubes: [], uncovered: 0 }
      : coverPaths(n, metric, isPossible, weight, dropOrder, 4)

    let ownMask = 0
    let ownWins = 0
    for (const i of own) {
      ownMask |= 1 << i
      if (open[i]!.homeId === teamId) ownWins |= 1 << i
    }

    return {
      teamId,
      probability: probability.get(teamId)!,
      status: clinched ? 'clinched' : definite.length === 0 && metric.length === 0 ? 'eliminated' : 'alive',
      definiteCombinations: definite.length,
      metricCombinations: metric.length,
      paths: definiteCover.cubes.map(toPath).sort((a, b) => b.probability - a.probability),
      metricPaths: metricCover.cubes.map(toPath).sort((a, b) => b.probability - a.probability),
      morePaths: definiteCover.uncovered,
      controlsDestiny: definite.length > 0 && cubeInside(n, ownMask, ownWins, isDefinite)
    }
  })

  teams.sort((a, b) => b.probability - a.probability || a.teamId - b.teamId)

  return {
    mode: 'exact',
    conference,
    games: open.map((g, i) => ({ gameId: g.id, homeId: g.homeId, awayId: g.awayId, homeWinProbability: pHome[i]!, conferenceGame: g.conferenceGame })),
    combinations: N,
    teams
  }
}
