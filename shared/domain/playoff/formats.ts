/**
 * CFP format, as data. Everything season-specific about the playoff --
 * field size, who gets an automatic bid, how seeds pair up, round names --
 * lives in this table so a format change (the 2027 expansion that's been
 * reported) is a new entry here, not a code change in seeding or the
 * bracket UI.
 *
 * 2026 (12 teams), per the CFP Management Committee's January 2026
 * announcement as reported by ESPN, CBS Sports and Yahoo Sports:
 * - automatic bids for the SEC, Big Ten, Big 12 and ACC champions,
 *   regardless of where they're ranked;
 * - one bid for the highest-ranked Group of Six champion (the G6 now
 *   includes the rebuilt Pac-12);
 * - Notre Dame in if it finishes in the top 12;
 * - the rest at-large, by final ranking;
 * - straight seeding by final ranking (no seed protection for champions),
 *   top four seeds get byes, first round on the higher seed's campus,
 *   fixed bracket with no reseeding.
 *
 * One November 2026 explainer still described the older "five
 * highest-ranked conference champions" rule. If the official 2026-27 rules
 * on collegefootballplayoff.com differ, change `autoBids` below.
 */

export const POWER_FOUR = ['SEC', 'Big Ten', 'Big 12', 'ACC'] as const
export const GROUP_OF_SIX = ['American Athletic', 'Mountain West', 'Sun Belt', 'Mid-American', 'Conference USA', 'Pac-12'] as const
export const NOTRE_DAME_TEAM_ID = 87

export type AutoBidRule
  = | {
    /** Each listed conference's champion is in, regardless of rank. */
    kind: 'conference-champions'
    conferences: readonly string[]
  }
  | {
    /** The `count` highest-ranked champions among the listed conferences are in. */
    kind: 'best-champions'
    conferences: readonly string[]
    count: number
    label: string
  }
  | {
    /** A specific team is in if it finishes at or above `maxRank`. */
    kind: 'team-if-ranked'
    teamId: number
    maxRank: number
    label: string
  }

export type SlotSource = { seed: number } | { winnerOf: string }

export type BracketRound = 'first-round' | 'quarterfinal' | 'semifinal' | 'final'

export interface BracketSlotDef {
  id: string
  round: BracketRound
  top: SlotSource
  bottom: SlotSource
  /** True when the top team plays at home (first-round campus games). Otherwise neutral. */
  topHosts: boolean
}

export interface PlayoffFormat {
  season: number
  fieldSize: number
  byes: number
  autoBids: readonly AutoBidRule[]
  /** Slots in play order: every slot's `winnerOf` sources appear earlier in this list. */
  slots: readonly BracketSlotDef[]
  rounds: readonly { id: BracketRound, label: string, dates: string }[]
  /** ISO date of Selection Day -- after it, the "current" bracket is the official one. */
  selectionDay: string
}

const TWELVE_TEAM_SLOTS: readonly BracketSlotDef[] = [
  { id: 'r1-5-12', round: 'first-round', top: { seed: 5 }, bottom: { seed: 12 }, topHosts: true },
  { id: 'r1-6-11', round: 'first-round', top: { seed: 6 }, bottom: { seed: 11 }, topHosts: true },
  { id: 'r1-7-10', round: 'first-round', top: { seed: 7 }, bottom: { seed: 10 }, topHosts: true },
  { id: 'r1-8-9', round: 'first-round', top: { seed: 8 }, bottom: { seed: 9 }, topHosts: true },
  { id: 'qf-1', round: 'quarterfinal', top: { seed: 1 }, bottom: { winnerOf: 'r1-8-9' }, topHosts: false },
  { id: 'qf-4', round: 'quarterfinal', top: { seed: 4 }, bottom: { winnerOf: 'r1-5-12' }, topHosts: false },
  { id: 'qf-2', round: 'quarterfinal', top: { seed: 2 }, bottom: { winnerOf: 'r1-7-10' }, topHosts: false },
  { id: 'qf-3', round: 'quarterfinal', top: { seed: 3 }, bottom: { winnerOf: 'r1-6-11' }, topHosts: false },
  { id: 'sf-1', round: 'semifinal', top: { winnerOf: 'qf-1' }, bottom: { winnerOf: 'qf-4' }, topHosts: false },
  { id: 'sf-2', round: 'semifinal', top: { winnerOf: 'qf-2' }, bottom: { winnerOf: 'qf-3' }, topHosts: false },
  { id: 'final', round: 'final', top: { winnerOf: 'sf-1' }, bottom: { winnerOf: 'sf-2' }, topHosts: false }
]

export const PLAYOFF_FORMATS: Readonly<Record<number, PlayoffFormat>> = {
  2026: {
    season: 2026,
    fieldSize: 12,
    byes: 4,
    autoBids: [
      { kind: 'conference-champions', conferences: POWER_FOUR },
      { kind: 'best-champions', conferences: GROUP_OF_SIX, count: 1, label: 'Top Group of Six champion' },
      { kind: 'team-if-ranked', teamId: NOTRE_DAME_TEAM_ID, maxRank: 12, label: 'Notre Dame (top 12)' }
    ],
    slots: TWELVE_TEAM_SLOTS,
    rounds: [
      { id: 'first-round', label: 'First Round', dates: 'Dec 18–19 · campus sites' },
      { id: 'quarterfinal', label: 'Quarterfinals', dates: 'Dec 30 – Jan 1 · Fiesta, Cotton, Rose, Peach' },
      { id: 'semifinal', label: 'Semifinals', dates: 'January' },
      { id: 'final', label: 'National Championship', dates: 'January · Las Vegas' }
    ],
    selectionDay: '2026-12-06'
  }
}

/** The format for `season`, falling back to the latest earlier season that has one. */
export function playoffFormatFor(season: number): PlayoffFormat {
  const seasons = Object.keys(PLAYOFF_FORMATS).map(Number).sort((a, b) => b - a)
  const match = seasons.find(s => s <= season) ?? seasons[seasons.length - 1]!
  return PLAYOFF_FORMATS[match]!
}
