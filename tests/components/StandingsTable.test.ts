import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsTable from '~/components/StandingsTable.vue'
import type { StandingsTeam } from '../../shared/types/standings'

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

  it('shows tied teams with matching rank numbers and no badge or icon (D-05/D-06)', () => {
    const wrapper = mount(StandingsTable, {
      props: {
        standings: [
          row({ id: 1, school: 'Alabama', rank: 2, isTied: true, confRecord: { wins: 6, losses: 2 } }),
          row({ id: 2, school: 'Georgia', rank: 2, isTied: true, confRecord: { wins: 6, losses: 2 } }),
          row({ id: 3, school: 'LSU', rank: 2, isTied: true, confRecord: { wins: 6, losses: 2 } }),
          row({ id: 4, school: 'Auburn', rank: 5, isTied: false, confRecord: { wins: 5, losses: 3 } })
        ],
        conferenceName: 'SEC'
      }
    })

    const ranks = wrapper.findAll('tbody tr').map(tr => tr.find('td')!.text())
    expect(ranks).toEqual(['2', '2', '2', '5'])

    // No badge/icon markup anywhere — matching ranks are the whole indication.
    expect(wrapper.find('.badge').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('tied')
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
})
