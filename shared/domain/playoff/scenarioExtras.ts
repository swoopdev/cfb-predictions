/**
 * The parts of a scenario beyond its game picks and manual tiebreakers:
 * conference championship picks, CFP bracket picks and the user's
 * projected-ranking override. Each is stored under its own scenario key
 * and travels in share links as one extra TLV record, so the validators
 * live here -- one implementation for both untrusted boundaries
 * (localStorage and `#s=` codes).
 */

export type BracketKind = 'current' | 'projected'
export type StoredBracketPicks = Record<BracketKind, Record<string, number>>

export interface ScenarioExtras {
  /** `{ conference: winningTeamId }` -- the week-14 championship cards. */
  championshipPicks: Record<string, number>
  bracketPicks: StoredBracketPicks
  /** Projected-ranking override, team ids best first; empty = the model's order. */
  rankingOverride: number[]
}

export const emptyBracketPicks = (): StoredBracketPicks => ({ current: {}, projected: {} })
export const emptyScenarioExtras = (): ScenarioExtras => ({ championshipPicks: {}, bracketPicks: emptyBracketPicks(), rankingOverride: [] })

const SLOT_ID = /^[a-z0-9-]{1,16}$/
const MAX_SLOTS = 32
const MAX_OVERRIDE = 40
const MAX_CONFERENCES = 16
const MAX_CONFERENCE_NAME = 40

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `{ current, projected }`, each `{ slotId: teamId }`. Malformed entries are dropped one at a time. */
export function validateBracketPicks(parsed: unknown): StoredBracketPicks {
  const out = emptyBracketPicks()
  if (!isPlainObject(parsed)) return out
  for (const kind of ['current', 'projected'] as const) {
    const picks = parsed[kind]
    if (!isPlainObject(picks)) continue
    for (const [slot, teamId] of Object.entries(picks).slice(0, MAX_SLOTS)) {
      if (SLOT_ID.test(slot) && Number.isInteger(teamId)) out[kind][slot] = teamId as number
    }
  }
  return out
}

/** Unique integer team ids, capped. Anything else -> `[]`. */
export function validateRankingOverride(parsed: unknown): number[] {
  if (!Array.isArray(parsed)) return []
  const ids = parsed.filter((v): v is number => Number.isInteger(v)).slice(0, MAX_OVERRIDE)
  return [...new Set(ids)]
}

/** `{ conference: teamId }` with short conference names and integer ids. */
export function validateChampionshipPicks(parsed: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isPlainObject(parsed)) return out
  for (const [conference, teamId] of Object.entries(parsed).slice(0, MAX_CONFERENCES)) {
    if (conference.length > 0 && conference.length <= MAX_CONFERENCE_NAME && Number.isInteger(teamId)) out[conference] = teamId as number
  }
  return out
}

/** Share-link wire shape: `{ c?, b?, r? }`, each validated independently. */
export function validateScenarioExtras(parsed: unknown): ScenarioExtras {
  if (!isPlainObject(parsed)) return emptyScenarioExtras()
  return {
    championshipPicks: validateChampionshipPicks(parsed.c),
    bracketPicks: validateBracketPicks(parsed.b),
    rankingOverride: validateRankingOverride(parsed.r)
  }
}

export function hasScenarioExtras(extras: ScenarioExtras): boolean {
  return Object.keys(extras.championshipPicks).length > 0
    || Object.keys(extras.bracketPicks.current).length > 0
    || Object.keys(extras.bracketPicks.projected).length > 0
    || extras.rankingOverride.length > 0
}

/** Compact wire form, omitting empty parts. */
export function scenarioExtrasWire(extras: ScenarioExtras): Record<string, unknown> {
  const wire: Record<string, unknown> = {}
  if (Object.keys(extras.championshipPicks).length > 0) wire.c = extras.championshipPicks
  if (Object.keys(extras.bracketPicks.current).length > 0 || Object.keys(extras.bracketPicks.projected).length > 0) wire.b = extras.bracketPicks
  if (extras.rankingOverride.length > 0) wire.r = extras.rankingOverride
  return wire
}
