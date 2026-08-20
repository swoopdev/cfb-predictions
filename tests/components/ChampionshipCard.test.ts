import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChampionshipCard from '~/components/ChampionshipCard.vue'
import type { RankGroup, ConferenceRanking, TerminalReason } from '../../shared/domain/tiebreakers/types'

/**
 * ChampionshipCard rendering tests (TIE-07, D-12, D-13, D-14, P-2).
 *
 * Like StandingsTable/StandingsSidebar, this component is free of Nuxt UI
 * components and Nuxt auto-imports, so it mounts in the plain vitest
 * project. `mount()` with plain props, no global stubs, no Nuxt plugins.
 *
 * Fixtures drive the seed cases by constructing `ConferenceRanking` values
 * and letting the component's own `championshipFor` read produce seed 1/2 --
 * the same path the component exercises internally, not a parallel one.
 */

function terminalReason(code: TerminalReason['code'] = 'ranking-step'): TerminalReason {
  return {
    code,
    ruleCitation: 'If a tie remains, the participant is decided by the CFP selection committee ranking.',
    sourceName: 'SEC Championship Game Tiebreaker Procedures'
  }
}

function group(overrides: Partial<RankGroup> = {}): RankGroup {
  return {
    teams: [1],
    resolvedBy: 'sole-candidate',
    contestedWith: [1],
    trace: [],
    ...overrides
  }
}

function unresolvedGroup(teams: readonly number[], code: TerminalReason['code'] = 'ranking-step'): RankGroup {
  return {
    teams,
    resolvedBy: 'unresolved',
    contestedWith: teams,
    trace: [],
    terminalReason: terminalReason(code)
  }
}

function ranking(groups: RankGroup[]): ConferenceRanking {
  return { conference: 'SEC', groups }
}

describe('ChampionshipCard', () => {
  it('renders both team names with the connective when both seeds are resolved, and no candidate-list copy', () => {
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([group({ teams: [1] }), group({ teams: [2] })]),
        schoolById: new Map([[1, 'Georgia'], [2, 'Alabama']]),
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Georgia')
    expect(wrapper.text()).toContain('Alabama')
    expect(wrapper.text()).toContain('vs.')
    expect(wrapper.text()).not.toContain('One of:')
    expect(wrapper.text()).not.toContain('Two of:')
    expect(wrapper.text()).not.toContain('Listed alphabetically.')
  })

  it('names seed 1 and lists the first three of four seed-2 candidates alphabetically, plus a disclosure control', () => {
    const schoolById = new Map([[1, 'Georgia'], [10, 'Duke'], [20, 'Miami'], [30, 'Clemson'], [40, 'NC State']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([group({ teams: [1] }), unresolvedGroup([10, 20, 30, 40])]),
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Georgia')
    expect(wrapper.text()).toContain('One of:')
    // Alphabetical: Clemson, Duke, Miami, NC State -- first three visible.
    expect(wrapper.text()).toContain('Clemson')
    expect(wrapper.text()).toContain('Duke')
    expect(wrapper.text()).toContain('Miami')
    expect(wrapper.text()).not.toContain('NC State')
    expect(wrapper.text()).toContain('Listed alphabetically.')

    const button = wrapper.get('button')
    expect(button.text()).toContain('1 more')
  })

  it('renders one candidate block with the both-spots connective when seed 1 itself is unresolved, and no second seed block', () => {
    const schoolById = new Map([[10, 'Duke'], [20, 'Miami'], [30, 'Clemson']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([unresolvedGroup([10, 20, 30])]),
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Two of:')
    expect(wrapper.text()).not.toContain('One of:')
    expect(wrapper.text()).not.toContain('vs.')

    // Exactly one candidate block rendered -- the alphabetical note appears once.
    const alphabeticalMentions = wrapper.text().match(/Listed alphabetically\./g) ?? []
    expect(alphabeticalMentions).toHaveLength(1)
  })

  it('renders byte-identical text for an unresolved seed regardless of TerminalReason (D-14)', () => {
    const schoolById = new Map([[1, 'Georgia'], [10, 'Duke'], [20, 'Miami']])
    const codes: TerminalReason['code'][] = ['ranking-step', 'needs-scores', 'draw']

    const texts = codes.map((code) => {
      const wrapper = mount(ChampionshipCard, {
        props: {
          ranking: ranking([group({ teams: [1] }), unresolvedGroup([10, 20], code)]),
          schoolById,
          hasPickedConferenceGames: true,
          slateComplete: true
        }
      })
      return wrapper.text()
    })

    expect(texts[0]).toBe(texts[1])
    expect(texts[1]).toBe(texts[2])
  })

  it('discloses all ten candidates in place, relabels the control, and collapses back to three', async () => {
    const schoolById = new Map<number, string>([
      [101, 'Alpha'], [102, 'Bravo'], [103, 'Charlie'], [104, 'Delta'], [105, 'Echo'],
      [106, 'Foxtrot'], [107, 'Golf'], [108, 'Hotel'], [109, 'India'], [110, 'Juliett']
    ])
    const teams = [...schoolById.keys()]
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([unresolvedGroup(teams)]),
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('Charlie')
    expect(wrapper.text()).not.toContain('Delta')

    const button = wrapper.get('button')
    expect(button.text()).toContain('+7 more')

    await button.trigger('click')
    expect(wrapper.text()).toContain('Delta')
    expect(wrapper.text()).toContain('Juliett')
    expect(button.text()).toContain('Show fewer')

    await button.trigger('click')
    expect(wrapper.text()).not.toContain('Delta')
    expect(button.text()).toContain('+7 more')
  })

  it('orders candidates alphabetically by school regardless of team id order in the group', () => {
    const schoolById = new Map([[201, 'Zeta'], [202, 'Alpha'], [203, 'Mu']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([unresolvedGroup([201, 202, 203])]),
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    const text = wrapper.text()
    expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('Mu'))
    expect(text.indexOf('Mu')).toBeLessThan(text.indexOf('Zeta'))
  })

  // The card is now ALWAYS visible on the week 14 page -- one per conference,
  // rendered before anything is picked -- rather than appearing only once the
  // conference slate completed. "Nothing picked yet" is therefore a visible
  // placeholder ("TBD vs. TBD"), not an absent element.
  it('renders a TBD placeholder, not nothing, when no conference games are picked', () => {
    const schoolById = new Map([[1, 'Georgia'], [10, 'Duke'], [20, 'Miami']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([unresolvedGroup([1, 10, 20])]),
        schoolById,
        hasPickedConferenceGames: false,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Two of: Duke / Georgia / Miami')
  })

  // Same change as above, from the other direction: an incomplete slate now
  // renders the TBD placeholder rather than suppressing the card. The
  // `slateComplete` gate still governs whether a REAL matchup (names, pickable
  // rows) is shown -- it just no longer governs whether the card exists.
  it('renders the TBD placeholder while the conference slate is still incomplete', () => {
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([group({ teams: [1] }), group({ teams: [2] })]),
        schoolById: new Map([[1, 'Georgia'], [2, 'Alabama']]),
        hasPickedConferenceGames: true,
        slateComplete: false
      }
    })

    expect(wrapper.text()).toContain('TBD')
    expect(wrapper.text()).not.toContain('Georgia')
    expect(wrapper.text()).not.toContain('Alabama')
  })

  it('renders the unavailable heading and body, with no seed blocks and no raw exception, when the ranking is undefined but rows exist', () => {
    const schoolById = new Map([[1, 'Georgia']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: undefined,
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    expect(wrapper.text()).toContain('Tiebreakers unavailable')
    expect(wrapper.text()).toContain('ordered by record only')
    expect(wrapper.text()).not.toContain('vs.')
    expect(wrapper.text()).not.toContain('One of:')
    expect(wrapper.text()).not.toContain('Two of:')
    expect(wrapper.text()).not.toContain('Error')
    expect(wrapper.text()).not.toContain('undefined')
  })

  it('renders nothing when the ranking is undefined and no standings rows are supplied (loading)', () => {
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: undefined,
        schoolById: new Map(),
        hasPickedConferenceGames: false
      }
    })

    expect(wrapper.text()).toBe('')
    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('never renders progress-flavoured or storage-lifecycle vocabulary in any state', () => {
    const schoolById = new Map([[1, 'Georgia'], [10, 'Duke'], [20, 'Miami']])
    const forbidden = [
      'incomplete', 'unfinished', 'missing', 'pending', 'needs',
      'suspended', 'restored', 'paused', 'recovered'
    ]

    const wrappers = [
      mount(ChampionshipCard, {
        props: {
          ranking: ranking([group({ teams: [1] }), unresolvedGroup([10, 20])]),
          schoolById,
          hasPickedConferenceGames: true,
          slateComplete: true
        }
      }),
      mount(ChampionshipCard, {
        props: {
          ranking: ranking([unresolvedGroup([1, 10, 20])]),
          schoolById,
          hasPickedConferenceGames: false,
          slateComplete: false
        }
      }),
      mount(ChampionshipCard, {
        props: { ranking: undefined, schoolById, hasPickedConferenceGames: true, slateComplete: true }
      })
    ]

    for (const wrapper of wrappers) {
      const text = wrapper.text().toLowerCase()
      for (const word of forbidden) {
        expect(text).not.toContain(word)
      }
    }
  })

  // Team colors are now deliberately part of this card's design, exactly as
  // in `GameCard`: the matchup badge carries a two-color gradient and the card
  // a split gradient border, both fed by the participants' own team colors as
  // CSS custom properties. Hex literals and inline color styles are therefore
  // EXPECTED here now. What still must not appear is a hard-coded Tailwind
  // palette-scale class (`bg-zinc-800`, `text-red-500`, ...) -- surfaces and
  // text still come from semantic tokens so the card holds up in both themes.
  it('uses semantic tokens for surfaces -- no bare palette-scale class', () => {
    const schoolById = new Map([[1, 'Georgia'], [10, 'Duke'], [20, 'Miami'], [30, 'Clemson'], [40, 'NC State']])
    const wrapper = mount(ChampionshipCard, {
      props: {
        ranking: ranking([group({ teams: [1] }), unresolvedGroup([10, 20, 30, 40])]),
        schoolById,
        hasPickedConferenceGames: true,
        slateComplete: true
      }
    })

    const paletteScalePattern = /^(bg|text|border|ring|fill|stroke|outline)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}$/
    const classAttrs = wrapper.findAll('*')
      .flatMap(el => (el.attributes('class') ?? '').split(/\s+/))
      .filter(Boolean)

    expect(classAttrs.some(c => paletteScalePattern.test(c))).toBe(false)
  })
})
