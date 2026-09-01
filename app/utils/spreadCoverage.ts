import type { BettingLine } from '#shared/types/bettingLines'

/**
 * Which side covered a betting spread once a game is final. `undefined`
 * covers three cases GameCard treats identically (hide both spread labels):
 * no line published, no final score yet, or a push (margin exactly equals
 * the spread -- neither side "won" it).
 *
 * A pick 'em's `spread` is `0`, so the straight-up winner is also the ATS
 * winner without any special-casing -- `favoredMargin > spread` (i.e. `> 0`)
 * already picks out whichever side actually won.
 */
export function computeSpreadCoverage(
  bettingLine: BettingLine | undefined,
  homePoints: number | null,
  awayPoints: number | null
): 'home' | 'away' | undefined {
  if (!bettingLine || homePoints === null || awayPoints === null) return undefined
  const { favored, spread } = bettingLine

  if (favored === 'even') {
    if (homePoints === awayPoints) return undefined
    return homePoints > awayPoints ? 'home' : 'away'
  }

  const favoredMargin = favored === 'home'
    ? homePoints - awayPoints
    : awayPoints - homePoints

  if (favoredMargin === spread) return undefined // push
  return favoredMargin > spread ? favored : (favored === 'home' ? 'away' : 'home')
}
