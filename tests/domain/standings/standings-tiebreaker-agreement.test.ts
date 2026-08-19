/**
 * @vitest-environment node
 */

/**
 * The CR-01 regression suite (05-REVIEW.md): standings row order must never
 * contradict the order the tiebreaker engine actually resolved.
 *
 * WR-07 recorded that the 05-01 suite is structurally BLIND to this — no test
 * ever compared a standings row against a resolved group, and every SEC team
 * in `secRoundRobinGames` plays exactly four conference games, so unequal
 * games-played (the precondition for the defect) is absent from the fixtures.
 * This file closes both halves: synthetic fixtures that pin the mechanism, and
 * a property assertion over 200 generated seasons of the committed 2026 slate,
 * which is the reviewer's own reproduction turned into an automated gate.
 *
 * Every expected order below is derived from the engine's own output at
 * runtime. Nothing is hard-coded from a hand-run of the implementation.
 *
 * 06-03: rewritten from the pre-Plan-06-02 `{ conference, seed1, seed2 }`
 * shape to `ConferenceRanking.groups` — the engine's single ordered
 * partition — and from D-04's "identical record implies identical rank"
 * invariant to D-01's "same rank iff same RankGroup" invariant. See each
 * describe block below for what changed and why.
 *
 * Runs under the `node` environment: happy-dom's global `URL` produces a
 * non-`file:`-schemed URL that Node's `fileURLToPath` rejects (see
 * `.planning/phases/05-standings-engine-ui/deferred-items.md`, class B).
 */

import { describe, it, expect } from 'vitest'
import { computeStandings, resolveAllConferences } from '../../../shared/domain/standings'
import type { StandingsTeam } from '../../../shared/types/standings'
import { championshipFor } from '../../../shared/domain/tiebreakers/engine'
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

  it('resolves the top two groups to the .667 team ahead of the .750 team', () => {
    // Sanity-check the fixture actually exercises `defineAccTiedTeams`'
    // alternate-schedule-length pull-in, so a later fixture edit that quietly
    // removes the tie shows up as a failure here rather than as a silently
    // vacuous test below.
    //
    // 06-03: `championshipFor` reads the championship spots directly off
    // `ranking.groups[0]`/`groups[1]` -- there is no separate seed1/seed2
    // resolution left to read `.order` from.
    const { seed1, seed2 } = championshipFor(resolved.ACC!)
    expect(seed1?.teams).toEqual([BOSTON_COLLEGE])
    expect(seed2?.teams).toEqual([MIAMI])
  })

  it('puts the engine-resolved champion in the top standings row', () => {
    const champion = resolved.ACC!.groups[0]!.teams[0]
    expect(standings.ACC![0]!.id).toBe(champion)
  })

  it('never inverts the resolved group order in the displayed rows', () => {
    const order = resolved.ACC!.groups.flatMap(group => group.teams)
    const indices = displayIndices(order, standings.ACC!)
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

  it('puts the resolved group\'s first-listed team on top even though it has fewer wins', () => {
    // Alabama is 2-0 and Georgia 3-0. Both are 1.000, which is the SEC's tie
    // definition, and the fixture's group lists Alabama first.
    expect(standings.SEC![0]!.id).toBe(ALABAMA)
  })

  it('gives the whole resolved group one shared rank number', () => {
    const alabama = bySchool(standings.SEC!, 'Alabama')
    const georgia = bySchool(standings.SEC!, 'Georgia')

    expect(alabama.rank).toBe(georgia.rank)
  })

  it('never inverts the resolved group order in the displayed rows', () => {
    const order = equalPctUnequalRecordResolved.SEC!.groups[0]!.teams
    const indices = displayIndices(order, standings.SEC!)

    expect(indices).toHaveLength(2)
    expect(isStrictlyAscending(indices)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Fixture C, a team dropped entirely from every group (D-01 reversal)
// ---------------------------------------------------------------------------

describe('a team the resolved ranking dropped entirely (the defensive fallback path)', () => {
  const standings = computeStandings(droppedTiedTeamGames, allTeams, droppedTiedTeamPicks, droppedTiedTeamResolved)

  it('puts the resolved group\'s team on top', () => {
    expect(standings.SEC![0]!.id).toBe(ALABAMA)
  })

  /**
   * D-01 reverses what this test proved before Plan 06-03. Under Phase 5's
   * D-04 closure, a team the resolved order dropped (LSU) still shared a
   * rank with its identical-record twin (Georgia), because rank was partly
   * record-derived. Under D-01, rank comes ONLY from `ranking.groups`: LSU
   * is named in no group here, so it falls through to `fallbackOrder` and
   * lands on its OWN rank, distinct from Georgia's placed rank, even though
   * their conference records are identical. This is the intended behaviour,
   * not a regression — only the engine's own partition can put two teams on
   * the same rank now.
   */
  it('gives the dropped team its own rank, separate from the placed team it once shared a record with', () => {
    const georgia = bySchool(standings.SEC!, 'Georgia')
    const lsu = bySchool(standings.SEC!, 'LSU')

    expect(`${georgia.confRecord.wins}-${georgia.confRecord.losses}`).toBe('2-1')
    expect(`${lsu.confRecord.wins}-${lsu.confRecord.losses}`).toBe('2-1')
    expect(georgia.rank).not.toBe(lsu.rank)
  })

  it('never inverts the resolved group order for the placed teams in the displayed rows', () => {
    const order = droppedTiedTeamResolved.SEC!.groups.flatMap(group => group.teams)
    const indices = displayIndices(order, standings.SEC!)

    expect(indices).not.toContain(-1)
    expect(isStrictlyAscending(indices)).toBe(true)
  })

  it('places Georgia, the placed team, ahead of LSU, the dropped team', () => {
    const rows = standings.SEC!
    const georgiaIndex = rows.findIndex(r => r.id === GEORGIA)
    const lsuIndex = rows.findIndex(r => r.id === LSU)

    expect(georgiaIndex).toBeLessThan(lsuIndex)
  })
})

// ---------------------------------------------------------------------------
// Test 4 — the committed 2026 slate (the reviewer's reproduction, automated)
// ---------------------------------------------------------------------------

describe('the committed 2026 slate never contradicts a resolved ranking', () => {
  const { games, teams } = readSlate()

  /**
   * Collects every way a single generated season can contradict the engine:
   *
   * (i)   the full group walk's display indices are not strictly ascending,
   *       or the first team named across all groups is not row 0 (the
   *       conference's #1 seed);
   * (ii)  an id named in a group has no row at all, reported explicitly
   *       rather than being allowed to compare as ascending;
   * (iii) **D-01 (replaces the D-04 clause).** Two rows carry the same rank
   *       number IF AND ONLY IF they are in the SAME `RankGroup`. Built from
   *       an id-to-rank map (off the standings rows) and an
   *       id-to-group-index map (off `ranking.groups`); any pair whose rank
   *       equality and group-membership equality disagree, in EITHER
   *       direction, is a violation.
   *
   * **The old seed-2 scoping caveat is now moot.** Pre-06-02, seed 1 and
   * seed 2 were two INDEPENDENT resolutions that could genuinely disagree
   * about a shared team's relative order, so this suite scoped seed 2's
   * ordering check to the ids seed 1 did not already claim. Plan 06-02 made
   * every group in `ranking.groups` come from ONE ordered sequence, so there
   * is no second, independently-resolved order left to disagree with — the
   * single full-group walk in clause (i) already checks everything seed 1
   * and seed 2 used to check between them, at full strength, everywhere.
   */
  function violationsFor(label: string, picks: Record<number, number>): string[] {
    const violations: string[] = []
    const resolved = resolveAllConferences(games, teams, picks)
    const standings = computeStandings(games, teams, picks, resolved)

    for (const [conference, ranking] of Object.entries(resolved)) {
      const rows = standings[conference] ?? []
      const schoolById = new Map(rows.map(r => [r.id, r.school]))
      const displayed = rows.map(r => `${r.school} ${r.confRecord.wins}-${r.confRecord.losses} #${r.rank}`)

      const fullOrder = ranking.groups.flatMap(group => group.teams)
      const engineOrder = fullOrder.map(id => schoolById.get(id) ?? `unknown id ${id}`).join(' > ')

      // (ii) missing rows first, over the FULL order — an absent id must not
      // be smuggled past the ordering check as a `-1` that happens to sort
      // ascending.
      const indices = displayIndices(fullOrder, rows)
      indices.forEach((index, position) => {
        if (index === -1) {
          violations.push(
            `[missing-row] ${label} ${conference}: id ${fullOrder[position]} is in the resolved ranking but has no standings row`
            + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
          )
        }
      })

      // (i) ordering
      const present = indices.filter(index => index !== -1)
      if (!isStrictlyAscending(present)) {
        violations.push(
          `[order] ${label} ${conference}: displayed order contradicts the engine`
          + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
        )
      }

      if (rows.length > 0 && fullOrder.length > 0 && rows[0]!.id !== fullOrder[0]) {
        violations.push(
          `[champion] ${label} ${conference}: engine champion `
          + `${schoolById.get(fullOrder[0]!) ?? fullOrder[0]} is not the top row`
          + ` | engine: ${engineOrder} | displayed: ${displayed.join(' | ')}`
        )
      }

      // (iii) D-01: same rank iff same RankGroup.
      const groupIndexById = new Map<number, number>()
      ranking.groups.forEach((group, index) => {
        for (const teamId of group.teams) groupIndexById.set(teamId, index)
      })

      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i]!
          const b = rows[j]!
          const sameRank = a.rank === b.rank
          const sameGroup = groupIndexById.has(a.id)
            && groupIndexById.has(b.id)
            && groupIndexById.get(a.id) === groupIndexById.get(b.id)

          if (sameRank !== sameGroup) {
            violations.push(
              `[d-01] ${label} ${conference}: ${a.school} (rank ${a.rank}) and ${b.school} (rank ${b.rank}) `
              + `${sameRank ? 'share a rank but are not in the same RankGroup' : 'are in the same RankGroup but carry different ranks'}`
            )
          }
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
   * 06-02 replaced both causes at once, and 06-03 removed the separate
   * seed1/seed2 return shape entirely: `resolveConferenceRanking` now
   * produces ONE ordered sequence of rank groups (`ranking.groups`), and
   * `championshipFor` reads the championship spots off `groups[0]`/`groups[1]`
   * of that SAME array. Two views into one array cannot disagree with each
   * other by construction — there is no second, independently-computed order
   * left to contradict, so the elaborate cross-seed contradiction search this
   * block used to run is no longer expressible (there is nothing left to
   * compare). What remains worth guarding is that `championshipFor` STAYS a
   * pure read of `ranking.groups` rather than quietly reintroducing a second,
   * independent resolution path.
   */
  describe('the engine can no longer contradict itself between seed 1 and seed 2 (06-02/06-03)', () => {
    it('derives seed1/seed2 as a pure read of groups[0]/groups[1], never a second resolution', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const random = mulberry32(seed)
        const resolved = resolveAllConferences(games, teams, generatePicks(games, random))

        for (const ranking of Object.values(resolved)) {
          const { seed1, seed2 } = championshipFor(ranking)
          expect(seed1).toBe(ranking.groups[0])
          if (ranking.groups[0] !== undefined && ranking.groups[0].teams.length === 1) {
            expect(seed2).toBe(ranking.groups[1])
          } else {
            expect(seed2).toBeUndefined()
          }
        }
      }
    })
  })
})
