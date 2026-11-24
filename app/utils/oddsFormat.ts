import type { PathCondition, TitleGamePath } from '#shared/domain/odds/paths'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'

/**
 * Display helpers for the odds/paths UI. Simulated probabilities never print
 * as a flat 0% or 100% unless they truly are (a clinched or eliminated
 * status comes from exact enumeration, not from a simulation that happened
 * to never draw the other outcome).
 */
export function formatOdds(p: number | undefined, exact = false): string {
  if (p === undefined || Number.isNaN(p)) return '—'
  // Exact probabilities are sums of float weights: 0.9999999999 is a lock.
  const EPS = 1e-9
  if (p <= EPS) return exact ? '0%' : '<1%'
  if (p >= 1 - EPS) return exact ? '100%' : '>99%'
  if (p < 0.005) return '<1%'
  if (p > 0.995) return '>99%'
  return `${Math.round(p * 100)}%`
}

/** Signed percentage-point change, e.g. `+12` / `−4`. */
export function formatDelta(delta: number): string {
  const points = Math.round(Math.abs(delta) * 100)
  if (points === 0) return '<1'
  return `${delta >= 0 ? '+' : '−'}${points}`
}

/** URL slug <-> Power Four conference, for `/conference/[id]`. */
export const CONFERENCE_SLUGS: Readonly<Record<string, ConferenceId>> = {
  'sec': 'SEC',
  'big-ten': 'Big Ten',
  'big-12': 'Big 12',
  'acc': 'ACC'
}

export function conferenceSlug(conference: string): string | undefined {
  return Object.entries(CONFERENCE_SLUGS).find(([, c]) => c === conference)?.[0]
}

/**
 * A team's minimal paths regrouped for reading: paths that need the same
 * results from the team itself share one heading ("If Texas beats Texas
 * A&M"), and the help it needs from elsewhere becomes a list of
 * alternatives under it. `options` empty = the team's own results are
 * enough.
 */
export interface PathGroup {
  own: PathCondition[]
  /** Each option is a set of other results that, together with `own`, guarantees the spot. */
  options: PathCondition[][]
  /** The most likely single path in the group. */
  bestProbability: number
}

const conditionKey = (c: PathCondition) => `${c.gameId}:${c.winnerId}`

export function groupPaths(teamId: number, paths: readonly TitleGamePath[]): PathGroup[] {
  const groups = new Map<string, PathGroup & { sufficient: boolean }>()
  for (const path of paths) {
    const own = path.conditions.filter(c => c.winnerId === teamId || c.loserId === teamId)
    const others = path.conditions.filter(c => c.winnerId !== teamId && c.loserId !== teamId)
    const key = own.map(conditionKey).sort().join('|')
    let group = groups.get(key)
    if (!group) {
      group = { own, options: [], bestProbability: 0, sufficient: false }
      groups.set(key, group)
    }
    group.bestProbability = Math.max(group.bestProbability, path.probability)
    if (others.length === 0) group.sufficient = true
    else group.options.push(others)
  }
  // A group whose own results suffice needs no list of outside help.
  return [...groups.values()].map(g => ({ own: g.own, options: g.sufficient ? [] : g.options, bestProbability: g.bestProbability }))
}
