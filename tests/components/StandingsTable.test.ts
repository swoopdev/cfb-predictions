import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsTable from '~/components/StandingsTable.vue'
import type { StandingsTeam } from '../../shared/types/standings'
import type { ConferenceRanking, RankGroup } from '../../shared/domain/tiebreakers/types'

/**
 * StandingsTable rendering tests.
 *
 * The component is intentionally free of Nuxt UI components and Nuxt
 * auto-imports, which is what makes it mountable in the plain vitest project
 * (unlike GameCard — see the note at the top of GameCard.test.ts). That keeps
 * the plan's "renders correctly with sample standings data" verification
 * automated rather than manual-only.
 */

function row(overrides: Partial<StandingsTeam> = {}): StandingsTeam {
  return {
    id: 1,
    school: 'Alabama',
    conference: 'SEC',
    overallRecord: { wins: 9, losses: 2 },
    confRecord: { wins: 6, losses: 2 },
    rank: 1,
    isTied: false,
    ...overrides
  }
}

function rankGroup(overrides: Partial<RankGroup> = {}): RankGroup {
  return {
    teams: [1],
    resolvedBy: 'sole-candidate',
    contestedWith: [1],
    trace: [],
    ...overrides
  }
}

/** Extracts a rank `<td>`'s raw HTML for the D-11 no-team-colour assertion. */
function rankCellHtml(wrapper: ReturnType<typeof mount>, rowIndex: number): string {
  return wrapper.findAll('tbody tr')[rowIndex]!.find('td').element.outerHTML
}

describe('StandingsTable', () => {
  it('renders the four columns in D-08/D-09 order: rank, team, overall, conference', () => {
    const wrapper = mount(StandingsTable, {
      props: { standings: [row()], conferenceName: 'SEC' }
    })

    const headers = wrapper.findAll('thead th').map(th => th.text())
    expect(headers).toEqual(['Rank', 'Team', 'Overall Record', 'Conf Record'])
  })

  it('renders each team as a row with both records formatted W-L', () => {
    const wrapper = mount(StandingsTable, {
      props: {
        standings: [
          row({ id: 1, school: 'Alabama', rank: 1, overallRecord: { wins: 9, losses: 2 }, confRecord: { wins: 6, losses: 2 } }),
          row({ id: 2, school: 'Florida', rank: 2, overallRecord: { wins: 7, losses: 4 }, confRecord: { wins: 4, losses: 4 } })
        ],
        conferenceName: 'SEC'
      }
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)

    const first = rows[0]!.findAll('td, th').map(cell => cell.text())
    expect(first).toEqual(['1', 'Alabama', '9-2', '6-2'])

    const second = rows[1]!.findAll('td, th').map(cell => cell.text())
    expect(second).toEqual(['2', 'Florida', '7-4', '4-4'])
  })

  // Plan 06-07: D-10 reverses Phase 5's D-05/D-06, which declined a badge on
  // the rationale that a matching rank number plus matching W-L values were
  // sufficient indication. Phase 5 measured that rationale false on ~1% of
  // tables (the ACC ties on alternate schedule lengths, so `1 Boston
  // College 6-2` can render above `1 Duke 7-2`) -- so this phase adds two
  // markers, both derived exclusively from the `ranking` prop's
  // `RankGroup`s, never from comparing two rows' own `confRecord`.
  describe('rank markers (D-10/D-11)', () => {
    it('renders an uncontested rank as a plain number with no button', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({ teams: [1], contestedWith: [1] }),
          rankGroup({ teams: [2], contestedWith: [2] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Alabama', rank: 1 }),
            row({ id: 2, school: 'Florida', rank: 2 })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })

      const cells = wrapper.findAll('tbody tr').map(tr => tr.find('td')!)
      for (const cell of cells) {
        expect(cell.find('button').exists()).toBe(false)
      }
      expect(cells.map(c => c.text())).toEqual(['1', '2'])
    })

    it('renders marker (a) -- a square chip button -- for a tiebreaker-decided rank', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({ teams: [1], resolvedBy: 'tiebreaker', contestedWith: [1, 2] }),
          rankGroup({ teams: [2], contestedWith: [2] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [row({ id: 1, rank: 1 }), row({ id: 2, rank: 2 })],
          conferenceName: 'SEC',
          ranking
        }
      })

      const button = wrapper.find('tbody tr').find('button')
      expect(button.exists()).toBe(true)
      expect(button.classes()).toContain('rounded')
      expect(button.classes()).not.toContain('rounded-full')
      expect(button.attributes('type')).toBe('button')
      expect(button.attributes('aria-expanded')).toBe('false')
      expect(button.attributes('aria-label')).toBe('Rank 1, decided by tiebreaker. Show reasoning.')
      expect(button.text()).toBe('1')
    })

    it('renders marker (a) with the your-choice accessible name for a manually-ordered rank (§6.2)', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({ teams: [1], resolvedBy: 'manual', contestedWith: [1, 2], manualOrdering: [1, 2] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: { standings: [row({ id: 1, rank: 1 })], conferenceName: 'SEC', ranking }
      })

      const button = wrapper.get('tbody button')
      expect(button.attributes('aria-label')).toBe('Rank 1, decided by your choice. Show reasoning.')
    })

    it('renders marker (b) -- a lighter round pill, no row-level band or border -- for a shared rank', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({
            teams: [1, 2],
            resolvedBy: 'unresolved',
            contestedWith: [1, 2],
            terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
          })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Alabama', rank: 1, isTied: true, confRecord: { wins: 6, losses: 2 } }),
            row({ id: 2, school: 'Georgia', rank: 1, isTied: true, confRecord: { wins: 6, losses: 2 } })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })

      const rows = wrapper.findAll('tbody tr').filter(tr => tr.find('th').exists())
      expect(rows).toHaveLength(2)
      for (const tr of rows) {
        expect(tr.classes()).not.toContain('bg-muted')
        expect(tr.classes()).not.toContain('border-l-2')
        expect(tr.classes()).not.toContain('border-inverted')
        const button = tr.get('button')
        expect(button.classes()).toContain('bg-muted')
        expect(button.classes()).toContain('ring')
        expect(button.classes()).not.toContain('bg-inverted')
        expect(button.classes()).not.toContain('text-inverted')
        // Stays distinct from marker (a)'s bg-accented/rounded chip -- shape
        // and fill, not just fill.
        expect(button.classes()).not.toContain('bg-accented')
        expect(button.classes()).not.toContain('rounded')
        expect(button.classes()).toContain('rounded-full')
        expect(button.attributes('aria-label')).toBe('Rank 1, tied with 1 other team. Show reasoning.')
        // The rank number repeats on EVERY row -- never blanked past the
        // first (§6): each row must stay self-describing for a screen reader.
        expect(button.text()).toBe('1')
      }
    })

    // §12/simplification: the Rank column (header + both render paths) is
    // horizontally centered -- covers the plain-number path (no `ranking`)
    // and the marker/button path (a shared rank), since both share the same
    // `<td>` wrapper.
    it('centers the Rank column header and cell in both the plain-number and marker render paths', () => {
      const plainWrapper = mount(StandingsTable, {
        props: { standings: [row({ id: 1, rank: 1 })], conferenceName: 'SEC' }
      })
      expect(plainWrapper.findAll('thead th')[0]!.classes()).toContain('text-center')
      expect(plainWrapper.findAll('tbody tr')[0]!.find('td').classes()).toContain('text-center')

      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({
            teams: [1, 2],
            resolvedBy: 'unresolved',
            contestedWith: [1, 2],
            terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
          })
        ]
      }
      const markerWrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Alabama', rank: 1, isTied: true }),
            row({ id: 2, school: 'Georgia', rank: 1, isTied: true })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })
      expect(markerWrapper.findAll('thead th')[0]!.classes()).toContain('text-center')
      expect(markerWrapper.findAll('tbody tr')[0]!.find('td').classes()).toContain('text-center')
    })

    it('marker (a) appears for two adjacent rows with DIFFERENT conference records in separate contested groups -- proving derivation from the group, not from record comparison', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({ teams: [1], resolvedBy: 'tiebreaker', contestedWith: [1, 9] }),
          rankGroup({ teams: [2], resolvedBy: 'tiebreaker', contestedWith: [2, 10] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Boston College', rank: 1, confRecord: { wins: 6, losses: 2 } }),
            row({ id: 2, school: 'Duke', rank: 2, confRecord: { wins: 7, losses: 2 } })
          ],
          conferenceName: 'ACC',
          ranking
        }
      })

      const cells = wrapper.findAll('tbody tr').map(tr => tr.find('td')!)
      expect(cells[0]!.find('button').exists()).toBe(true)
      expect(cells[1]!.find('button').exists()).toBe(true)
    })

    it('renders no marker for two adjacent rows with IDENTICAL conference records whose groups were uncontested', () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({ teams: [1], contestedWith: [1] }),
          rankGroup({ teams: [2], contestedWith: [2] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, rank: 1, confRecord: { wins: 6, losses: 2 } }),
            row({ id: 2, rank: 2, confRecord: { wins: 6, losses: 2 } })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })

      const cells = wrapper.findAll('tbody tr').map(tr => tr.find('td')!)
      expect(cells[0]!.find('button').exists()).toBe(false)
      expect(cells[1]!.find('button').exists()).toBe(false)
    })

    it('activating a marker inserts the reasoning row immediately after the group\'s last row, and removes it entirely on toggle-off', async () => {
      const ranking: ConferenceRanking = {
        conference: 'SEC',
        groups: [
          rankGroup({
            teams: [1, 2],
            resolvedBy: 'unresolved',
            contestedWith: [1, 2],
            trace: [{
              tiedTeams: [1, 2],
              steps: [{
                step: 'head-to-head',
                values: [
                  { teamId: 1, value: { kind: 'indeterminate' } },
                  { teamId: 2, value: { kind: 'indeterminate' } }
                ],
                partition: [[1, 2]],
                separated: false
              }],
              outcome: 'exhausted',
              removed: []
            }],
            terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
          }),
          rankGroup({ teams: [3], contestedWith: [3] })
        ]
      }
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Alabama', rank: 1, isTied: true }),
            row({ id: 2, school: 'Georgia', rank: 1, isTied: true }),
            row({ id: 3, school: 'Florida', rank: 3 })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })

      expect(wrapper.findAll('tbody tr')).toHaveLength(3)

      const groupButtons = wrapper.findAll('tbody button')
      await groupButtons[0]!.trigger('click')

      const rowsAfterExpand = wrapper.findAll('tbody tr')
      expect(rowsAfterExpand).toHaveLength(4)
      // Reasoning row sits immediately after Georgia's row (the group's last
      // row) and before Florida's row (the next group).
      expect(rowsAfterExpand[1]!.text()).toContain('Georgia')
      expect(rowsAfterExpand[2]!.find('td[colspan="4"]').exists()).toBe(true)
      expect(rowsAfterExpand[3]!.text()).toContain('Florida')
      expect(wrapper.findAll('tbody button')[0]!.attributes('aria-expanded')).toBe('true')

      await wrapper.findAll('tbody button')[0]!.trigger('click')

      expect(wrapper.findAll('tbody tr')).toHaveLength(3)
      expect(wrapper.find('td[colspan="4"]').exists()).toBe(false)
      expect(wrapper.findAll('tbody button')[0]!.attributes('aria-expanded')).toBe('false')
    })

    it('WR-02: keeps disclosure state pinned to a group\'s membership, not its array index, when a recompute reorders groups', async () => {
      const groupA = rankGroup({
        teams: [1, 2],
        resolvedBy: 'unresolved',
        contestedWith: [1, 2],
        trace: [{
          tiedTeams: [1, 2],
          steps: [{
            step: 'head-to-head',
            values: [
              { teamId: 1, value: { kind: 'indeterminate' } },
              { teamId: 2, value: { kind: 'indeterminate' } }
            ],
            partition: [[1, 2]],
            separated: false
          }],
          outcome: 'exhausted',
          removed: []
        }],
        terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
      })
      const groupB = rankGroup({ teams: [3], resolvedBy: 'tiebreaker', contestedWith: [3, 4] })

      const standings = [
        row({ id: 1, school: 'Alabama', rank: 1, isTied: true }),
        row({ id: 2, school: 'Georgia', rank: 1, isTied: true }),
        row({ id: 3, school: 'Florida', rank: 2 })
      ]

      const wrapper = mount(StandingsTable, {
        props: {
          standings,
          conferenceName: 'SEC',
          ranking: { conference: 'SEC', groups: [groupA, groupB] }
        }
      })

      // Expand groupA -- it's the first (index 0) chip button, ahead of Florida's.
      await wrapper.findAll('tbody button')[0]!.trigger('click')
      expect(wrapper.findAll('tbody button')[0]!.attributes('aria-expanded')).toBe('true')
      expect(wrapper.find('td[colspan="4"]').exists()).toBe(true)

      // A recompute (e.g. a later pick) reorders `ranking.groups` -- groupB
      // now occupies index 0 and groupA index 1 -- while `standings` (and
      // therefore row order) is unchanged.
      await wrapper.setProps({
        ranking: { conference: 'SEC', groups: [groupB, groupA] }
      })

      // groupA (Alabama/Georgia) is still the group the user expanded --
      // membership, not the index it now occupies, is what disclosure state
      // tracks. Its reasoning row must still be present, positioned after
      // Georgia's row (groupA's own last row).
      const rowsAfterReorder = wrapper.findAll('tbody tr')
      const georgiaIndex = rowsAfterReorder.findIndex(r => r.text().includes('Georgia'))
      expect(rowsAfterReorder[georgiaIndex + 1]!.find('td[colspan="4"]').exists()).toBe(true)

      // groupB (Florida, now at index 0) was never toggled and must render
      // collapsed -- exactly one reasoning panel exists (groupA's), never
      // two and never groupB's alone. The pre-fix bug tracked disclosure by
      // index, so it would have shown index 0's group (now Florida/groupB)
      // expanded instead of groupA.
      expect(wrapper.findAll('td[colspan="4"]')).toHaveLength(1)
    })

    it('renders no button, no chip, no pill and no band when the ranking prop is undefined', () => {
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, rank: 1, isTied: true }),
            row({ id: 2, rank: 1, isTied: true })
          ],
          conferenceName: 'SEC'
        }
      })

      expect(wrapper.find('tbody button').exists()).toBe(false)
      for (const tr of wrapper.findAll('tbody tr')) {
        expect(tr.classes()).not.toContain('bg-muted')
        expect(tr.classes()).not.toContain('border-inverted')
      }
    })

    // D-11: both markers are drawn from the neutral shell palette only.
    // Extracts the rank cell's raw markup and asserts it matches no
    // team-colour binding, no `style` attribute and no bare Tailwind
    // palette-scale class (e.g. `bg-slate-200`) -- the mechanical
    // enforcement, not a convention someone has to remember.
    it('D-11: the rank cell markup contains no team-colour binding, no style attribute and no bare palette-scale class', () => {
      const markerAHtml = rankCellHtml(
        mount(StandingsTable, {
          props: {
            standings: [row({ id: 1, rank: 1 })],
            conferenceName: 'SEC',
            ranking: { conference: 'SEC', groups: [rankGroup({ teams: [1], resolvedBy: 'tiebreaker', contestedWith: [1, 2] })] }
          }
        }),
        0
      )
      const markerBHtml = rankCellHtml(
        mount(StandingsTable, {
          props: {
            standings: [row({ id: 1, rank: 1, isTied: true }), row({ id: 2, rank: 1, isTied: true })],
            conferenceName: 'SEC',
            ranking: {
              conference: 'SEC',
              groups: [rankGroup({
                teams: [1, 2],
                resolvedBy: 'unresolved',
                contestedWith: [1, 2],
                terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
              })]
            }
          }
        }),
        0
      )

      for (const html of [markerAHtml, markerBHtml]) {
        expect(html).not.toMatch(/style=/)
        expect(html).not.toMatch(/\b(?:bg|text|border|ring|outline|fill|stroke)-[a-z]+-\d{2,4}\b/)
        expect(html.toLowerCase()).not.toContain('team.color')
      }
    })
  })

  it('labels the section with the conference name', () => {
    const wrapper = mount(StandingsTable, {
      props: { standings: [row()], conferenceName: 'Big Ten' }
    })

    expect(wrapper.find('h3').text()).toBe('Big Ten')
    expect(wrapper.find('caption').text()).toContain('Big Ten standings')
  })

  it('renders an empty state instead of a headerless table when there are no teams', () => {
    const wrapper = mount(StandingsTable, {
      props: { standings: [], conferenceName: 'ACC' }
    })

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('No teams to show for ACC.')
  })

  // Plan 06-04 (TIE-07): the ONLY new prop this component gains. Full
  // ChampionshipCard behavior is covered in ChampionshipCard.test.ts -- this
  // asserts only the threading contract: the card renders inside this
  // section, above the table, when a ranking is supplied, and the table
  // renders unaffected when it is not.
  describe('championship card threading (Plan 06-04)', () => {
    const ranking: ConferenceRanking = {
      conference: 'SEC',
      groups: [
        { teams: [1], resolvedBy: 'sole-candidate', contestedWith: [1], trace: [] },
        { teams: [2], resolvedBy: 'sole-candidate', contestedWith: [2], trace: [] }
      ]
    }

    it('renders the card above the table when a ranking is supplied', () => {
      const wrapper = mount(StandingsTable, {
        props: {
          standings: [
            row({ id: 1, school: 'Alabama' }),
            row({ id: 2, school: 'Georgia' })
          ],
          conferenceName: 'SEC',
          ranking
        }
      })

      const section = wrapper.get('section')
      const children = [...section.element.children]
      const cardIndex = children.findIndex(el => el.tagName === 'DIV')
      const tableIndex = children.findIndex(el => el.tagName === 'TABLE')

      expect(cardIndex).toBeGreaterThanOrEqual(0)
      expect(tableIndex).toBeGreaterThan(cardIndex)
      expect(wrapper.text()).toContain('CHAMPIONSHIP GAME')
    })

    it('still renders the table when ranking is not supplied', () => {
      const wrapper = mount(StandingsTable, {
        props: { standings: [row()], conferenceName: 'SEC' }
      })

      expect(wrapper.find('table').exists()).toBe(true)
    })
  })
})
