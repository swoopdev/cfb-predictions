import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsSidebar from '~/components/StandingsSidebar.vue'
import type { StandingsResult, StandingsTeam } from '../../shared/types/standings'
import type { ConferenceRanking, RankGroup } from '../../shared/domain/tiebreakers/types'
import type { ResolvedTiebreakers } from '../../shared/domain/standings'
import { nuxtUiTestStubs } from '../helpers/nuxtUiStubs'

/**
 * StandingsSidebar rendering tests.
 *
 * The sidebar owns exactly one decision — WHICH conferences to render (D-02) —
 * and that decision is driven by a user-controlled URL query param, which
 * makes it both the plan's headline behaviour and its registered threat
 * (T-05-03). Both halves are asserted here rather than left to manual
 * browser checks.
 *
 * The sidebar's chrome is now `USidebar` + `UAccordion` (one independently
 * collapsible panel per conference), so it mounts with the shared Nuxt UI
 * stubs -- see `tests/helpers/nuxtUiStubs.ts`. The accordion stub renders
 * every item's trigger label as an `<h3>`, which is what `renderedConferences`
 * below reads, so these tests still assert the same thing they always did:
 * WHICH conferences the sidebar chooses to render, not how the accordion
 * animates.
 *
 * `activeConference` is a string ARRAY (multi-select filters), so a
 * single-conference filter is `['SEC']`, and "no filter" is `[]`/`null`.
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

/**
 * Unfiltered display order is ALPHABETICAL. `P4_CONFERENCES` still owns
 * "which conferences are P4"; the sidebar re-sorts a copy of it purely for
 * display, so this is the sidebar's own concern and is asserted here.
 */
const ALPHABETICAL_P4 = ['ACC', 'Big 12', 'Big Ten', 'SEC']

/** The conference headings the sidebar rendered, in document order. */
function renderedConferences(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('h3').map(h => h.text())
}

describe('StandingsSidebar', () => {
  it('renders all four P4 conferences in alphabetical order when no filter is active', () => {
    const wrapper = mount(StandingsSidebar, { global: { stubs: nuxtUiTestStubs }, props: { standings } })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
  })

  it('treats an explicitly null activeConference the same as no filter', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: null }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
  })

  it.each(['SEC', 'Big Ten', 'Big 12', 'ACC'])(
    'renders only %s when that conference filter is active',
    (conference) => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: { standings, activeConference: [conference] }
      })

      expect(renderedConferences(wrapper)).toEqual([conference])
    }
  )

  it('shows the filtered conference\'s own rows, not another conference\'s', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: ['Big Ten'] }
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
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: [value] }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
  })

  // Task 3 (06-03): `standings` is now `StandingsResult | undefined` — the
  // week page gates this component's mount on `loadState === 'ready'`, so
  // `undefined` reaches it only defensively, never in the normal flow. It
  // must degrade to the same "no teams" panel every conference already shows
  // when empty, never throw on the tightened `Readonly<Record<ConferenceId,
  // ...>>` type it now reads through optional chaining.
  it('renders an empty panel per conference, not an empty page, when standings is undefined', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings: undefined }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
    expect(wrapper.text()).toContain('No teams to show for SEC.')
  })

  // T-06-07: an unrecognised `activeConference` must fall back to all four
  // conferences, never an empty panel — this is the sanitization the
  // tightened `StandingsResult` type depends on to index safely.
  it('falls back to all four conferences rather than an empty panel for an unrecognised conference', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: ['not-a-real-conference'] }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
    expect(wrapper.text()).not.toContain('No teams to show for SEC.')
  })

  it('explains itself when the active filter names a conference with no standings', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: ['Mountain West'] }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
    expect(wrapper.text()).toContain('Standings cover the four power conferences.')
  })

  it('stays silent about power conferences when the filter is a P4 conference or absent', () => {
    const unfiltered = mount(StandingsSidebar, { global: { stubs: nuxtUiTestStubs }, props: { standings } })
    expect(unfiltered.text()).not.toContain('Standings cover the four power conferences.')

    const filtered = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings, activeConference: ['ACC'] }
    })
    expect(filtered.text()).not.toContain('Standings cover the four power conferences.')
  })

  // This covers a conference with GENUINELY no members — not "the schedule has
  // not loaded yet". Reading it as the latter is what let WR-01 through: the
  // sidebar used to mount outside the page's `loadState` branch, so a missing
  // key during loading rendered four empty tables beside the skeletons. The
  // not-loaded-yet case is now handled by the `loadState === 'ready'` gate on
  // `<StandingsSidebar>` in `app/pages/week/[week].vue`, which this component
  // deliberately knows nothing about.
  it('renders every conference section even when a conference has no members', () => {
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: { standings: { SEC: standings.SEC! } }
    })

    expect(renderedConferences(wrapper)).toEqual(ALPHABETICAL_P4)
    expect(wrapper.text()).toContain('No teams to show for ACC.')
  })

  describe('responsive collapse (D-01)', () => {
    // The hand-rolled disclosure button this block used to assert (its own
    // aria-expanded/aria-controls pair, `hidden`/`block` class flipping and
    // `lg:hidden`/`lg:block` breakpoint classes) no longer exists: collapse
    // is `USidebar`'s job now, driven by the page's own toggle through
    // `v-model:open`. What remains this component's responsibility -- and so
    // what is asserted here -- is that it forwards that model and labels the
    // region.
    it('forwards the open model to the sidebar chrome', async () => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: { standings, open: true }
      })

      expect(wrapper.findComponent({ name: 'USidebar' }).props('open')).toBe(true)

      await wrapper.setProps({ open: false })
      expect(wrapper.findComponent({ name: 'USidebar' }).props('open')).toBe(false)
    })

    it('labels the region for assistive tech', () => {
      const wrapper = mount(StandingsSidebar, { global: { stubs: nuxtUiTestStubs }, props: { standings } })

      expect(wrapper.get('aside').attributes('aria-label')).toBe('Conference standings')
    })

    it('never clips a team name', () => {
      const wrapper = mount(StandingsSidebar, { global: { stubs: nuxtUiTestStubs }, props: { standings } })

      const classes = wrapper.findAll('tbody th').flatMap(th => th.classes())
      expect(classes).not.toContain('truncate')
      expect(classes).not.toContain('whitespace-nowrap')
    })
  })

  it('does not re-filter or reorder the rows it is given', () => {
    const secondPlace = team('Georgia', 'SEC', 2)
    const wrapper = mount(StandingsSidebar, {
      global: { stubs: nuxtUiTestStubs },
      props: {
        standings: { SEC: [team('Alabama', 'SEC'), secondPlace] },
        activeConference: ['SEC']
      }
    })

    const schools = wrapper.findAll('tbody th').map(th => th.text())
    expect(schools).toEqual(['Alabama', 'Georgia'])
  })

  // Plan 06-04 (TIE-07): `rankings` is the seam Task 3 threads down to
  // `ChampionshipCard`. This component performs no filtering or computation
  // on it -- it only indexes and passes the per-conference entry through.
  describe('rankings threading (Plan 06-04)', () => {
    const secTeam = team('Alabama', 'SEC')
    const secOnly: StandingsResult = { 'SEC': [secTeam], 'Big Ten': [], 'Big 12': [], 'ACC': [] }

    const secRanking: ConferenceRanking = {
      conference: 'SEC',
      groups: [
        { teams: [secTeam.id], resolvedBy: 'sole-candidate', contestedWith: [secTeam.id], trace: [] }
      ]
    }
    const rankings: ResolvedTiebreakers = { SEC: secRanking }

    // The championship matchup itself is no longer rendered here -- it moved
    // to the week 14 page's own `ChampionshipCard` grid (covered by
    // `tests/components/ChampionshipCard.test.ts`). The sidebar's remaining
    // responsibility is purely to INDEX `rankings` by conference and hand the
    // matching entry to that conference's `StandingsTable`, which is what
    // this asserts.
    it('passes the matching conference entry down to that conference table', () => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: { standings: secOnly, activeConference: ['SEC'], rankings }
      })

      const tables = wrapper.findAllComponents({ name: 'StandingsTable' })
      expect(tables).toHaveLength(1)
      expect(tables[0]!.props('conferenceName')).toBe('SEC')
      expect(tables[0]!.props('ranking')).toEqual(rankings.SEC)
      expect(wrapper.text()).toContain('Alabama')
    })

    it('renders every table without throwing when rankings is undefined', () => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: { standings: secOnly, activeConference: ['SEC'] }
      })

      expect(renderedConferences(wrapper)).toEqual(['SEC'])
      expect(wrapper.find('table').exists()).toBe(true)
    })
  })

  // Plan 06-07 (Task 2): `slateComplete`/`commitOrdering` are the D-17
  // ordering-interaction seam. This component performs no completion
  // computation or storage access of its own -- it only indexes the
  // per-conference boolean and passes the shared handler straight through.
  describe('slateComplete/commitOrdering threading (Plan 06-07)', () => {
    const alabama = team('Alabama', 'SEC')
    const georgia = team('Georgia', 'SEC', 1)
    const tiedStandings: StandingsResult = {
      'SEC': [
        { ...alabama, isTied: true },
        { ...georgia, isTied: true }
      ],
      'Big Ten': [],
      'Big 12': [],
      'ACC': []
    }
    const unresolvedGroup: RankGroup = {
      teams: [alabama.id, georgia.id],
      resolvedBy: 'unresolved',
      contestedWith: [alabama.id, georgia.id],
      trace: [],
      terminalReason: { code: 'needs-scores', ruleCitation: 'x', sourceName: 'y' }
    }
    const rankings: ResolvedTiebreakers = { SEC: { conference: 'SEC', groups: [unresolvedGroup] } }

    async function expandTheOnlyGroup(wrapper: ReturnType<typeof mount>) {
      await wrapper.get('tbody button').trigger('click')
    }

    it('never offers the ordering interaction when the slate-complete map is absent', async () => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: { standings: tiedStandings, activeConference: ['SEC'], rankings }
      })

      await expandTheOnlyGroup(wrapper)

      expect(wrapper.text()).not.toContain('Nothing separates these')
    })

    it('never offers the ordering interaction when this conference\'s slate is explicitly incomplete', async () => {
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: {
          standings: tiedStandings,
          activeConference: ['SEC'],
          rankings,
          slateComplete: { 'SEC': false, 'Big Ten': false, 'Big 12': false, 'ACC': false }
        }
      })

      await expandTheOnlyGroup(wrapper)

      expect(wrapper.text()).not.toContain('Nothing separates these')
    })

    it('offers the ordering interaction and forwards a commit to the supplied handler once the slate is complete', async () => {
      const commitOrdering = vi.fn()
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: {
          standings: tiedStandings,
          activeConference: ['SEC'],
          rankings,
          slateComplete: { 'SEC': true, 'Big Ten': false, 'Big 12': false, 'ACC': false },
          commitOrdering
        }
      })

      await expandTheOnlyGroup(wrapper)
      expect(wrapper.text()).toContain('Nothing separates these')

      const teamButtons = wrapper.findAll('[role="group"] button')
      await teamButtons[0]!.trigger('click')
      await teamButtons[1]!.trigger('click')

      expect(commitOrdering).toHaveBeenCalledTimes(1)
      expect(commitOrdering).toHaveBeenCalledWith('SEC', unresolvedGroup, expect.arrayContaining([alabama.id, georgia.id]))
    })

    // 08-REVIEW WR-04 (iteration 2): `previewActive` threads straight
    // through StandingsSidebar -> StandingsTable -> TiebreakerReasoning,
    // unchanged, replacing the interactive terminus with an explanatory
    // message during an active share-link preview (where commitOrdering is
    // a silent no-op in PicksWorkspace.vue).
    it('replaces the ordering interaction with an explanatory message when previewActive is set, and never calls commitOrdering', async () => {
      const commitOrdering = vi.fn()
      const wrapper = mount(StandingsSidebar, {
        global: { stubs: nuxtUiTestStubs },
        props: {
          standings: tiedStandings,
          activeConference: ['SEC'],
          rankings,
          slateComplete: { 'SEC': true, 'Big Ten': false, 'Big 12': false, 'ACC': false },
          commitOrdering,
          previewActive: true
        }
      })

      await expandTheOnlyGroup(wrapper)

      expect(wrapper.text()).not.toContain('Nothing separates these')
      expect(wrapper.find('[role="group"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Save a copy of this scenario to set manual tiebreakers.')
      expect(commitOrdering).not.toHaveBeenCalled()
    })
  })
})
