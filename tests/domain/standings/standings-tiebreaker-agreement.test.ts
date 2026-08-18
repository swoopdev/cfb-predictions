/**
 * @vitest-environment node
 */

/**
 * The CR-01 regression suite (05-REVIEW.md): standings row order must never
 * contradict the seed order the tiebreaker engine actually resolved.
 *
 * WR-07 recorded that the 05-01 suite is structurally BLIND to this — no test
 * ever compared a standings row against a resolved seed, and every SEC team in
 * `secRoundRobinGames` plays exactly four conference games, so unequal
 * games-played (the precondition for the defect) is absent from the fixtures.
 * This file closes both halves: synthetic fixtures that pin the mechanism, and
 * a property assertion over 200 generated seasons of the committed 2026 slate,
 * which is the reviewer's own reproduction turned into an automated gate.
 *
 * Every expected order below is derived from the engine's own output at
 * runtime. Nothing is hard-coded from a hand-run of the implementation.
 *
 * Runs under the `node` environment: happy-dom's global `URL` produces a
 * non-`file:`-schemed URL that Node's `fileURLToPath` rejects (see
 * `.planning/phases/05-standings-engine-ui/deferred-items.md`, class B).
 */

import { describe, it, expect } from 'vitest'
import { computeStandings, resolveAllConferences } from '../../../shared/domain/standings'
import type { StandingsTeam } from '../../../shared/types/standings'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'
import {
  allTeams,
  BOSTON_COLLEGE,
  MIAMI,
  ALABAMA,
  GEORGIA,
  LSU,
  accMixedScheduleTeams,
  accMixedScheduleGames,
  accMixedSchedulePicks,
  equalPctUnequalRecordGames,
  equalPctUnequalRecordPicks,
  equalPctUnequalRecordResolved,
  droppedTiedTeamGames,
  droppedTiedTeamPicks,
  droppedTiedTeamResolved
} from '../../fixtures/standings.fixtures'

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

/** Where each id in `order` landed in the displayed rows; `-1` when absent. */
function displayIndices(order: readonly number[], rows: readonly StandingsTeam[]): number[] {
  const indexById = new Map(rows.map((row, index) => [row.id, index]))
  return order.map(id => indexById.get(id) ?? -1)
}

function isStrictlyAscending(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || value > values[index - 1]!)
}

function bySchool(rows: readonly StandingsTeam[], school: string): StandingsTeam {
  const row = rows.find(r => r.school === school)
  if (!row) throw new Error(`No standings row for ${school}`)
  return row
}

// ---------------------------------------------------------------------------
// Test 1 — Fixture A, the real engine end to end
// ---------------------------------------------------------------------------

describe('ACC mixed conference-schedule lengths (real engine end to end)', () => {
  const resolved = resolveAllConferences(
    accMixedScheduleGames,
    accMixedScheduleTeams,
    accMixedSchedulePicks
  )
  const standings = computeStandings(
    accMixedScheduleGames,
    accMixedScheduleTeams,
    accMixedSchedulePicks,
    resolved
  )

  it('resolves seed 1 to the .667 team ahead of the .750 team', () => {
    // Sanity-check the fixture actually exercises `defineAccTiedTeams`'
    // alternate-schedule-length pull-in, so a later fixture edit that quietly
    // removes the tie shows up as a failure here rather than as a silently
    // vacuous test below.
    //
    // 06-02: `resolveConferenceChampionship` is now a thin derived view over
    // `resolveConferenceRanking` (D-03/D-12) -- each seed's `order` is the
    // ONE team `resolveConferenceRanking` committed for that slot, not the
    // whole resolved sub-order the pre-06-02 engine returned. The pull-in is
    // now verified across BOTH seeds rather than a single two-element array.
    const seed1 = resolved.ACC!.seed1
    const seed2 = resolved.ACC!.seed2
    expect(seed1.status).toBe('resolved')
    expect(seed2.status).toBe('resolved')
    if (seed1.status !== 'resolved' || seed2.status !== 'resolved') return
    expect(seed1.order[0]).toBe(BOSTON_COLLEGE)
    expect(seed2.order[0]).toBe(MIAMI)
  })

  it('puts the engine-resolved champion in the top standings row', () => {
    const seed1 = resolved.ACC!.seed1
    if (seed1.status !== 'resolved') throw new Error('fixture no longer resolves seed 1')

    expect(standings.ACC![0]!.id).toBe(seed1.order[0])
  })

  it('never inverts the resolved seed-1 order in the displayed rows', () => {
    const seed1 = resolved.ACC!.seed1
    if (seed1.status !== 'resolved') throw new Error('fixture no longer resolves seed 1')

    const indices = displayIndices(seed1.order, standings.ACC!)
    expect(indices).not.toContain(-1)
    expect(isStrictlyAscending(indices)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Fixture B, equal win percentage, unequal record
// ---------------------------------------------------------------------------

describe('equal win percentage, unequal conference record', () => {
  const standings = computeStandings(
    equalPctUnequalRecordGames,
    allTeams,
    equalPctUnequalRecordPicks,
    equalPctUnequalRecordResolved
  )

  it('puts the resolved seed-1 team on top even though it has fewer wins', () => {
    // Alabama is 2-0 and Georgia 3-0. Both are 1.000, which is the SEC's tie
    // definition, and the engine placed Alabama first.
    expect(standings.SEC![0]!.id).toBe(ALABAMA)
  })

  it('gives the whole resolved seed group one shared rank number', () => {
    const alabama = bySchool(standings.SEC!, 'Alabama')
    const georgia = bySchool(standings.SEC!, 'Georgia')

    expect(alabama.rank).toBe(georgia.rank)
  })

  it('never inverts the resolved seed-1 order in the displayed rows', () => {
    const indices = displayIndices(
      equalPctUnequalRecordResolved.SEC!.seed1.status === 'resolved'
        ? equalPctUnequalRecordResolved.SEC!.seed1.order
        : [],
      standings.SEC!
    )

    expect(indices).toHaveLength(2)
    expect(isStrictlyAscending(indices)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Fixture C, a team dropped by the restart redefinition
// ---------------------------------------------------------------------------

describe('a team the resolved order dropped but whose record is shared (D-04)', () => {
  const standings = computeStandings(
    droppedTiedTeamGames,
    allTeams,
    droppedTiedTeamPicks,
    droppedTiedTeamResolved
  )

  it('puts the resolved seed-1 team on top', () => {
    expect(standings.SEC![0]!.id).toBe(ALABAMA)
  })

  /**
   * The regression this test exists for is a SPLIT, not an inversion. It
   * passes against the pre-05-03 engine by accident — Georgia and LSU hold
   * identical records, so the old adjacency-keyed `assignRanks` already gave
   * them one rank. What it proves is that grouping on seed-group membership
   * ALONE — the obvious, wrong fix — would rank Georgia (placed in
   * `seed1.order`) apart from LSU (dropped from it) and break D-04 in the act
   * of fixing CR-01. The RED gate for this plan's Task 1 is carried by the
   * other three describe blocks.
   */
  it('keeps a dropped team on the same rank as the placed team it ties', () => {
    const georgia = bySchool(standings.SEC!, 'Georgia')
    const lsu = bySchool(standings.SEC!, 'LSU')

    expect(`${georgia.confRecord.wins}-${georgia.confRecord.losses}`).toBe('2-1')
    expect(`${lsu.confRecord.wins}-${lsu.confRecord.losses}`).toBe('2-1')
    expect(georgia.rank).toBe(lsu.rank)
  })

  it('never inverts the resolved seed-1 order in the displayed rows', () => {
    const seed1 = droppedTiedTeamResolved.SEC!.seed1
    if (seed1.status !== 'resolved') throw new Error('fixture no longer resolves seed 1')

    const indices = displayIndices(seed1.order, standings.SEC!)
    expect(indices).not.toContain(-1)
    expect(isStrictlyAscending(indices)).toBe(true)
  })

  it('places Georgia, not LSU, ahead — the engine order still decides display', () => {
    const rows = standings.SEC!
    const georgiaIndex = rows.findIndex(r => r.id === GEORGIA)
    const lsuIndex = rows.findIndex(r => r.id === LSU)

    expect(georgiaIndex).toBeLessThan(lsuIndex)
  })
})

// ---------------------------------------------------------------------------
// Test 4 — the committed 2026 slate (the reviewer's reproduction, automated)
// ---------------------------------------------------------------------------

describe('the committed 2026 slate never contradicts a resolved seed order', () => {
  const { games, teams } = readSlate()

  /**
   * Collects every way a single generated season can contradict the engine:
   *
   * (i)   a resolved seed order whose display indices are not strictly
   *       ascending, or whose first team is not row 0 (seed 1 only — seed 2's
   *       leader legitimately sits below the champion);
   * (ii)  an id in a resolved seed order that has no row at all, reported
   *       explicitly rather than being allowed to compare as ascending;
   * (iii) two rows in the same conference with identical conference W-L but
   *       different rank numbers — the D-04 invariant, which catches the
   *       natural restart-redefinition drop wherever it occurs.
   *
   * **Why seed 2's ordering check is scoped to the teams seed 1 did not
   * place.** `seed1.order` and `seed2.order` can genuinely disagree about the
   * relative order of two teams, in which case NO row order satisfies both and
   * the standings layer must pick one. This plan's design picks seed 1 (it is
   * the sequence that also carries the champion), so seed 2 is authoritative
   * exactly over its group-1 membership — the ids a resolved `seed1.order` did
   * not already claim. The disagreement is an engine-side artefact and is
   * pinned by its own describe block below; scoping here is not a relaxation
   * of what this suite can detect, because the excluded pairs are checked at
   * full strength against `seed1.order` in clause (i).
   */
  function violationsFor(label: string, picks: Record<number, number>): string[] {
    const violations: string[] = []
    const resolved = resolveAllConferences(games, teams, picks)
    const standings = computeStandings(games, teams, picks, resolved)

    for (const [conference, championship] of Object.entries(resolved)) {
      const rows = standings[conference] ?? []
      const schoolById = new Map(rows.map(r => [r.id, r.school]))
      const displayed = rows.map(r => `${r.school} ${r.confRecord.wins}-${r.confRecord.losses} #${r.rank}`)

      const seed1 = championship.seed1
      const claimedBySeed1 = new Set<number>(seed1.status === 'resolved' ? seed1.order : [])

      for (const seedName of ['seed1', 'seed2'] as const) {
        const seed = championship[seedName]
        if (seed.status !== 'resolved') continue

        const engineOrder = seed.order
          .map(id => schoolById.get(id) ?? `unknown id ${id}`)
          .join(' > ')

        // (ii) missing rows first, over the FULL order — an absent id must not
        // be smuggled past the ordering check as a `-1` that happens to sort
        // ascending.
        displayIndices(seed.order, rows).forEach((index, position) => {
          if (index === -1) {
            violations.push(
              `[missing-row] ${label} ${conference} ${seedName}: id ${seed.order[position]} is in the resolved order but has no standings row`
              + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
            )
          }
        })

        // (i) ordering
        const governed = seedName === 'seed1'
          ? seed.order
          : seed.order.filter(id => !claimedBySeed1.has(id))
        const present = displayIndices(governed, rows).filter(index => index !== -1)

        if (!isStrictlyAscending(present)) {
          violations.push(
            `[order] ${label} ${conference} ${seedName}: displayed order contradicts the engine`
            + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
          )
        }

        if (seedName === 'seed1' && rows.length > 0 && rows[0]!.id !== seed.order[0]) {
          violations.push(
            `[champion] ${label} ${conference} seed1: engine champion `
            + `${schoolById.get(seed.order[0]!) ?? seed.order[0]} is not the top row`
            + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
          )
        }
      }
    }

    // (iii) D-04 across every conference, resolved or not.
    for (const [conference, rows] of Object.entries(standings)) {
      const rankByRecord = new Map<string, { rank: number, school: string }>()
      for (const row of rows) {
        const key = `${row.confRecord.wins}-${row.confRecord.losses}`
        const seen = rankByRecord.get(key)
        if (seen === undefined) {
          rankByRecord.set(key, { rank: row.rank, school: row.school })
        } else if (seen.rank !== row.rank) {
          violations.push(
            `[d-04] ${label} ${conference}: ${seen.school} and ${row.school} are both ${key}`
            + ` but carry ranks ${seen.rank} and ${row.rank}`
          )
        }
      }
    }

    return violations
  }

  it('holds across 100 fully-picked seasons', () => {
    const violations: string[] = []
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed)
      violations.push(...violationsFor(`fully-picked seed ${seed}`, generatePicks(games, random)))
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })

  it('holds across 100 partially-picked seasons (weeks 1-7)', () => {
    const violations: string[] = []
    for (let seed = 1001; seed <= 1100; seed++) {
      const random = mulberry32(seed)
      violations.push(...violationsFor(`weeks 1-7 seed ${seed}`, generatePicks(games, random, 7)))
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })

  /**
   * PRE-06-02: `seed1.order` and `seed2.order` could genuinely contradict
   * each other — measured at 7 of 649 resolved conferences over 200
   * generated seasons of the committed 2026 slate — because `resolveSlot`
   * ran seed 1 and seed 2 as two INDEPENDENT resolutions and an unseparated
   * top bucket was presented as an ordered sequence (`partitionByStepValue`'s
   * raw team-id sort). Full detail in
   * `.planning/phases/05-standings-engine-ui/deferred-items.md`.
   *
   * 06-02 replaced both causes at once: `resolveConferenceRanking` produces
   * ONE ordered sequence of rank groups that both seeds now read from
   * (`championshipFor`), and any step whose top bucket holds more than one
   * team recurses into that bucket rather than emitting the raw-id sort
   * (`engine.ts`'s Pitfall-1 repair). One ordered sequence cannot disagree
   * with itself, so this shape is now structurally impossible rather than
   * merely rare — this block is rewritten to assert exactly that, across the
   * same 200 generated seasons the pre-fix measurement used, so a future
   * regression that reintroduces two independent resolutions fails loudly.
   */
  describe('the engine can no longer contradict itself between seed 1 and seed 2 (06-02)', () => {
    /**
     * Every pair of teams `seed2.order` places in one relative order that
     * `seed1.order` places in the OPPOSITE relative order, across every P4
     * conference where both seeds resolved. Skips the legacy "both spots
     * blocked on the same decision" case (`seed1 === seed2` by reference —
     * see `resolveConferenceChampionship`'s docblock), which has nothing to
     * compare.
     */
    function contradictionsFor(label: string, picks: Record<number, number>): string[] {
      const contradictions: string[] = []
      const resolved = resolveAllConferences(games, teams, picks)

      for (const [conference, championship] of Object.entries(resolved)) {
        const seed1 = championship.seed1
        const seed2 = championship.seed2
        if (seed1.status !== 'resolved' || seed2.status !== 'resolved') continue
        if (seed1 === seed2) continue

        const positionInSeed1 = new Map(seed1.order.map((id, index) => [id, index]))
        const sharedIds = seed2.order.filter(id => positionInSeed1.has(id))

        for (let i = 0; i < sharedIds.length; i++) {
          for (let j = i + 1; j < sharedIds.length; j++) {
            const earlierInSeed2 = sharedIds[i]!
            const laterInSeed2 = sharedIds[j]!
            if (positionInSeed1.get(earlierInSeed2)! > positionInSeed1.get(laterInSeed2)!) {
              contradictions.push(
                `${label} ${conference}: seed2 orders ${earlierInSeed2} before ${laterInSeed2}, `
                + `but seed1 orders them the other way around`
              )
            }
          }
        }
      }

      return contradictions
    }

    it('holds across 100 fully-picked seasons', () => {
      const contradictions: string[] = []
      for (let seed = 1; seed <= 100; seed++) {
        const random = mulberry32(seed)
        contradictions.push(...contradictionsFor(`fully-picked seed ${seed}`, generatePicks(games, random)))
      }

      expect(contradictions).toEqual([])
    })

    it('holds across 100 partially-picked seasons (weeks 1-7)', () => {
      const contradictions: string[] = []
      for (let seed = 1001; seed <= 1100; seed++) {
        const random = mulberry32(seed)
        contradictions.push(...contradictionsFor(`weeks 1-7 seed ${seed}`, generatePicks(games, random, 7)))
      }

      expect(contradictions).toEqual([])
    })
  })
})
