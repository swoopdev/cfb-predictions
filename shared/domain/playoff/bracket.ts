import type { BracketSlotDef, PlayoffFormat } from './formats'
import type { FieldEntry } from './field'

/** `{ slotId: winningTeamId }` -- the user's bracket picks for one bracket. */
export type BracketPicks = Readonly<Record<string, number>>

export interface BracketGameResult {
  homeId: number
  awayId: number
  completed: boolean
  homePoints: number | null
  awayPoints: number | null
}

export interface ResolvedSlot {
  def: BracketSlotDef
  top: number | null
  bottom: number | null
  topSeed: number | null
  bottomSeed: number | null
  winner: number | null
  /** `result` once the real game is final (locks the slot), `pick` for the user's pick. */
  winnerSource: 'result' | 'pick' | null
  score: { top: number, bottom: number } | null
}

function findResult(results: readonly BracketGameResult[], a: number, b: number): BracketGameResult | undefined {
  return results.find(g => g.completed && g.homePoints != null && g.awayPoints != null && g.homePoints !== g.awayPoints
    && ((g.homeId === a && g.awayId === b) || (g.homeId === b && g.awayId === a)))
}

/**
 * Resolves every slot of `format`'s bracket for a seeded field: who plays in
 * each slot and who advances. A real, final CFP game between the slot's two
 * teams always wins over a pick; a pick for a team not in the slot (stale
 * after the field changed) is ignored rather than deleted, so it comes back
 * if the field changes back.
 */
export function resolveBracket(
  format: PlayoffFormat,
  field: readonly FieldEntry[],
  picks: BracketPicks,
  results: readonly BracketGameResult[] = []
): ResolvedSlot[] {
  const seedTeam = new Map(field.map(e => [e.seed, e.teamId]))
  const seedOf = new Map(field.map(e => [e.teamId, e.seed]))
  const resolved = new Map<string, ResolvedSlot>()

  const sourceTeam = (source: BracketSlotDef['top']): number | null =>
    'seed' in source ? (seedTeam.get(source.seed) ?? null) : (resolved.get(source.winnerOf)?.winner ?? null)

  for (const def of format.slots) {
    const top = sourceTeam(def.top)
    const bottom = sourceTeam(def.bottom)
    let winner: number | null = null
    let winnerSource: ResolvedSlot['winnerSource'] = null
    let score: ResolvedSlot['score'] = null

    if (top !== null && bottom !== null) {
      const result = findResult(results, top, bottom)
      if (result) {
        const homeWon = result.homePoints! > result.awayPoints!
        winner = homeWon ? result.homeId : result.awayId
        winnerSource = 'result'
        const topPoints = result.homeId === top ? result.homePoints! : result.awayPoints!
        const bottomPoints = result.homeId === top ? result.awayPoints! : result.homePoints!
        score = { top: topPoints, bottom: bottomPoints }
      } else {
        const pick = picks[def.id]
        if (pick === top || pick === bottom) {
          winner = pick
          winnerSource = 'pick'
        }
      }
    }

    resolved.set(def.id, {
      def,
      top,
      bottom,
      topSeed: top === null ? null : (seedOf.get(top) ?? null),
      bottomSeed: bottom === null ? null : (seedOf.get(bottom) ?? null),
      winner,
      winnerSource,
      score
    })
  }

  return format.slots.map(def => resolved.get(def.id)!)
}

/**
 * "Sim the rest": fills every slot that has no winner yet by sampling from
 * `winProbability(top, bottom, topHosts)`, round by round, keeping the
 * user's existing valid picks and every real result. Returns a complete
 * picks object (existing picks plus the simulated ones).
 */
export function simulateBracketPicks(
  format: PlayoffFormat,
  field: readonly FieldEntry[],
  picks: BracketPicks,
  results: readonly BracketGameResult[],
  winProbability: (topId: number, bottomId: number, topHosts: boolean) => number,
  random: () => number = Math.random
): Record<string, number> {
  const next: Record<string, number> = { ...picks }
  for (let i = 0; i < format.slots.length; i++) {
    const slots = resolveBracket(format, field, next, results)
    const open = slots.find(s => s.winner === null && s.top !== null && s.bottom !== null)
    if (!open) break
    const p = winProbability(open.top!, open.bottom!, open.def.topHosts)
    next[open.def.id] = random() < p ? open.top! : open.bottom!
  }
  return next
}

/** National champion, or `null` until the final has a winner. */
export function bracketChampion(slots: readonly ResolvedSlot[]): number | null {
  return slots.find(s => s.def.round === 'final')?.winner ?? null
}
