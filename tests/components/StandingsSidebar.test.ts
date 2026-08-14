import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsSidebar from '~/components/StandingsSidebar.vue'
import type { StandingsResult, StandingsTeam } from '../../shared/types/standings'

/**
 * StandingsSidebar rendering tests.
 *
 * The sidebar owns exactly one decision — WHICH conferences to render (D-02) —
 * and that decision is driven by a user-controlled URL query param, which
 * makes it both the plan's headline behaviour and its registered threat
 * (T-05-03). Both halves are asserted here rather than left to manual
 * browser checks.
 *
 * Like StandingsTable, this component avoids Nuxt UI components and Nuxt
 * auto-imports so it mounts in the plain vitest project.
 */

function team(school: string, conference: string, rank = 1): StandingsTeam {
  return {
    id: school.length * 1000 + rank,
    school,
    conference,
    overallRecord: { wins: 9, losses: 2 },
    confRecord: { wins: 6, losses: 2 },
    rank,
    isTied: false
  }
}

const standings: StandingsResult = {
  'SEC': [team('Alabama', 'SEC')],
  'Big Ten': [team('Ohio State', 'Big Ten')],
  'Big 12': [team('Utah', 'Big 12')],
  'ACC': [team('Clemson', 'ACC')]
}

/** The conference headings the sidebar rendered, in document order. */
function renderedConferences(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('h3').map(h => h.text())
}

describe('StandingsSidebar', () => {
  it('renders all four P4 conferences in SEC, Big Ten, Big 12, ACC order when no filter is active', () => {
    const wrapper = mount(StandingsSidebar, { props: { standings } })

    expect(renderedConferences(wrapper)).toEqual(['SEC', 'Big Ten', 'Big 12', 'ACC'])
  })

  it('treats an explicitly null activeConference the same as no filter', () => {
    const wrapper = mount(StandingsSidebar, {
      props: { standings, activeConference: null }
    })

    expect(renderedConferences(wrapper)).toEqual(['SEC', 'Big Ten', 'Big 12', 'ACC'])
  })

  it.each(['SEC', 'Big Ten', 'Big 12', 'ACC'])(
    'renders only %s when that conference filter is active',
    (conference) => {
      const wrapper = mount(StandingsSidebar, {
        props: { standings, activeConference: conference }
      })

      expect(renderedConferences(wrapper)).toEqual([conference])
    }
  )

  it('shows the filtered conference\'s own rows, not another conference\'s', () => {
    const wrapper = mount(StandingsSidebar, {
      props: { standings, activeConference: 'Big Ten' }
    })

    expect(wrapper.text()).toContain('Ohio State')
    expect(wrapper.text()).not.toContain('Alabama')
  })

  // T-05-03: `activeConference` is a user-controlled URL query param.
  it.each([
    ['the "All" sentinel', 'All'],
    ['an unknown conference name', 'Big Twelve'],
    ['an empty string', ''],
    ['an injection-shaped string', '<script>alert(1)</script>']
  ])('falls back to all four conferences for %s', (_label, value) => {
    const wrapper = mount(StandingsSidebar, {
      props: { standings, activeConference: value }
    })

    expect(renderedConferences(wrapper)).toEqual(['SEC', 'Big Ten', 'Big 12', 'ACC'])
  })

  it('explains itself when the active filter names a conference with no standings', () => {
    const wrapper = mount(StandingsSidebar, {
      props: { standings, activeConference: 'Mountain West' }
    })

    expect(renderedConferences(wrapper)).toEqual(['SEC', 'Big Ten', 'Big 12', 'ACC'])
    expect(wrapper.text()).toContain('Standings cover the four power conferences.')
  })

  it('stays silent about power conferences when the filter is a P4 conference or absent', () => {
    const unfiltered = mount(StandingsSidebar, { props: { standings } })
    expect(unfiltered.text()).not.toContain('Standings cover the four power conferences.')

    const filtered = mount(StandingsSidebar, {
      props: { standings, activeConference: 'ACC' }
    })
    expect(filtered.text()).not.toContain('Standings cover the four power conferences.')
  })

  it('renders every conference section even when the standings object is missing keys', () => {
    const wrapper = mount(StandingsSidebar, {
      props: { standings: { SEC: standings.SEC! } }
    })

    expect(renderedConferences(wrapper)).toEqual(['SEC', 'Big Ten', 'Big 12', 'ACC'])
    expect(wrapper.text()).toContain('No teams to show for ACC.')
  })

  it('does not re-filter or reorder the rows it is given', () => {
    const secondPlace = team('Georgia', 'SEC', 2)
    const wrapper = mount(StandingsSidebar, {
      props: {
        standings: { SEC: [team('Alabama', 'SEC'), secondPlace] },
        activeConference: 'SEC'
      }
    })

    const schools = wrapper.findAll('tbody th').map(th => th.text())
    expect(schools).toEqual(['Alabama', 'Georgia'])
  })
})
