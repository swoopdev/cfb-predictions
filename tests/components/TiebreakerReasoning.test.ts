import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TiebreakerReasoning from '~/components/TiebreakerReasoning.vue'
import type {
  RankGroup,
  TiebreakerCycle,
  StepOutcome,
  StepValue,
  TerminalReason,
  TeamId
} from '../../shared/domain/tiebreakers/types'

/**
 * TiebreakerReasoning rendering + interaction tests (TIE-05, TIE-06, D-15,
 * D-16, D-17). Mounted standalone with plain props, no Nuxt plugin, no
 * global stub -- the component is a self-contained props-in/events-out unit
 * per 06-06-PLAN.md's objective.
 *
 * A small fixed school map keeps assertions readable with real school names
 * rather than bare team ids.
 */

const SCHOOLS = new Map<number, string>([
  [1, 'Duke'],
  [2, 'Miami'],
  [3, 'Clemson'],
  [4, 'NC State'],
  [5, 'Louisville'],
  [6, 'Boston College'],
  [7, 'Georgia Tech'],
  [8, 'Syracuse'],
  [9, 'Wake Forest'],
  [10, 'California'],
  [11, 'Pittsburgh'],
  [12, 'Virginia']
])

// A neutral fixture rule citation/source, used everywhere a TerminalReason is
// needed. Real engine-supplied citation text is conference policy prose and
// is outside the copy contract's scope; a neutral fixture is what keeps the
// §13 tone assertion honest.
const NEUTRAL_REASON: TerminalReason = {
  code: 'ranking-step',
  ruleCitation: 'Neutral fixture citation text.',
  sourceName: 'Neutral Fixture Source'
}

function stepOutcome(overrides: Partial<StepOutcome> = {}): StepOutcome {
  return {
    step: 'head-to-head',
    values: [],
    partition: [],
    separated: true,
    ...overrides
  }
}

function cycle(overrides: Partial<TiebreakerCycle> = {}): TiebreakerCycle {
  return {
    tiedTeams: [],
    steps: [],
    outcome: 'resolved',
    removed: [],
    ...overrides
  }
}

function group(overrides: Partial<RankGroup> = {}): RankGroup {
  return {
    teams: [],
    resolvedBy: 'tiebreaker',
    contestedWith: [],
    trace: [],
    ...overrides
  }
}

/** A group whose decisive step carries exactly one team's value, for the
 * value-rendering cases (Task 1). */
function groupWithDecisiveValue(value: StepValue): RankGroup {
  return group({
    teams: [1],
    resolvedBy: 'tiebreaker',
    contestedWith: [1, 2],
    trace: [
      cycle({
        tiedTeams: [1, 2],
        steps: [
          stepOutcome({
            step: 'head-to-head',
            separated: true,
            values: [{ teamId: 1, value }],
            partition: [[1], [2]]
          })
        ],
        outcome: 'resolved',
        removed: []
      })
    ]
  })
}

describe('decisive step', () => {
  it('leads with the last separating step of the last cycle, not a later non-separating step', () => {
    const c = cycle({
      tiedTeams: [1, 2],
      steps: [
        stepOutcome({ step: 'head-to-head', separated: false, values: [], partition: [[1, 2]] }),
        stepOutcome({
          step: 'common-opponents',
          separated: true,
          values: [
            { teamId: 1, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
            { teamId: 2, value: { kind: 'record', wins: 3, losses: 2, winPct: 0.6 } }
          ],
          partition: [[1], [2]]
        }),
        stepOutcome({ step: 'total-wins', separated: false, values: [], partition: [[1, 2]] })
      ],
      outcome: 'resolved',
      removed: []
    })
    const g = group({ teams: [1], resolvedBy: 'tiebreaker', contestedWith: [1, 2], trace: [c] })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: false }
    })

    expect(wrapper.text()).toContain('Common opponents')
    expect(wrapper.text()).not.toContain('Total wins')
  })

  it('pairs every team with its value at the decisive step in a description list', () => {
    const c = cycle({
      tiedTeams: [1, 2],
      steps: [
        stepOutcome({
          step: 'common-opponents',
          separated: true,
          values: [
            { teamId: 1, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
            { teamId: 2, value: { kind: 'record', wins: 3, losses: 2, winPct: 0.6 } }
          ],
          partition: [[1], [2]]
        })
      ],
      outcome: 'resolved',
      removed: []
    })
    const g = group({ teams: [1], resolvedBy: 'tiebreaker', contestedWith: [1, 2], trace: [c] })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: false }
    })

    expect(wrapper.find('dl').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    const dts = wrapper.findAll('dt').map(n => n.text())
    const dds = wrapper.findAll('dd').map(n => n.text())
    expect(dts).toEqual(['Duke', 'Miami'])
    expect(dds).toEqual(['4-1 (.800)', '3-2 (.600)'])
  })
})

describe('value rendering', () => {
  it('renders a record value as wins-losses plus a three-decimal win percentage', () => {
    const wrapper = mount(TiebreakerReasoning, {
      props: {
        group: groupWithDecisiveValue({ kind: 'record', wins: 4, losses: 1, winPct: 0.8 }),
        schoolById: SCHOOLS,
        slateComplete: false
      }
    })
    expect(wrapper.find('dd').text()).toBe('4-1 (.800)')
  })

  it.each([
    ['beat-all', 'beat all others'],
    ['lost-to-all', 'lost to all others'],
    ['mixed', 'mixed'],
    ['no-common-games', 'no shared games']
  ] as const)('renders headToHead result %s as %s', (result, phrase) => {
    const wrapper = mount(TiebreakerReasoning, {
      props: {
        group: groupWithDecisiveValue({ kind: 'headToHead', result }),
        schoolById: SCHOOLS,
        slateComplete: false
      }
    })
    expect(wrapper.find('dd').text()).toBe(phrase)
  })

  it('renders an indeterminate value as its own phrase', () => {
    const wrapper = mount(TiebreakerReasoning, {
      props: {
        group: groupWithDecisiveValue({ kind: 'indeterminate' }),
        schoolById: SCHOOLS,
        slateComplete: false
      }
    })
    expect(wrapper.find('dd').text()).toBe('not applicable')
  })
})

describe('full procedure', () => {
  function multiCycleGroup(): RankGroup {
    return group({
      teams: [1],
      resolvedBy: 'tiebreaker',
      contestedWith: [1, 2, 3],
      trace: [
        cycle({
          tiedTeams: [1, 2, 3],
          steps: [
            stepOutcome({ step: 'head-to-head', separated: false, values: [], partition: [[1, 2, 3]] }),
            stepOutcome({
              step: 'common-opponents',
              separated: true,
              values: [
                { teamId: 1, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
                { teamId: 2, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
                { teamId: 3, value: { kind: 'record', wins: 2, losses: 3, winPct: 0.4 } }
              ],
              partition: [[1, 2], [3]]
            })
          ],
          outcome: 'restart',
          removed: [{ teamId: 3, reason: 'eliminated', atStep: 'common-opponents' }]
        }),
        cycle({
          tiedTeams: [1, 2],
          steps: [
            stepOutcome({
              step: 'head-to-head',
              separated: true,
              values: [
                { teamId: 1, value: { kind: 'headToHead', result: 'beat-all' } },
                { teamId: 2, value: { kind: 'headToHead', result: 'lost-to-all' } }
              ],
              partition: [[1], [2]]
            })
          ],
          outcome: 'resolved',
          removed: []
        })
      ]
    })
  }

  it('is a plain button whose label flips and carries expanded-state and controls bindings', async () => {
    const wrapper = mount(TiebreakerReasoning, {
      props: { group: multiCycleGroup(), schoolById: SCHOOLS, slateComplete: false }
    })

    const toggle = wrapper.find('button[aria-controls]')
    expect(toggle.attributes('type')).toBe('button')
    expect(toggle.text()).toBe('Show full procedure')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')

    expect(toggle.text()).toBe('Hide full procedure')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('reveals every cycle in order with a non-separating step reading as such', async () => {
    const wrapper = mount(TiebreakerReasoning, {
      props: { group: multiCycleGroup(), schoolById: SCHOOLS, slateComplete: false }
    })

    await wrapper.find('button[aria-controls]').trigger('click')

    const text = wrapper.text()
    expect(text).toContain('Cycle 1')
    expect(text).toContain('Cycle 2')
    expect(text).toContain('no separation')
  })
})

describe('restart events', () => {
  it('renders the removed team, its reason and the step on one line, never hidden while the full procedure is shown', async () => {
    const g = group({
      teams: [1],
      resolvedBy: 'tiebreaker',
      contestedWith: [1, 2, 3],
      trace: [
        cycle({
          tiedTeams: [1, 2, 3],
          steps: [
            stepOutcome({
              step: 'common-opponents',
              separated: true,
              values: [
                { teamId: 1, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
                { teamId: 2, value: { kind: 'record', wins: 4, losses: 1, winPct: 0.8 } },
                { teamId: 3, value: { kind: 'record', wins: 2, losses: 3, winPct: 0.4 } }
              ],
              partition: [[1, 2], [3]]
            })
          ],
          outcome: 'restart',
          removed: [{ teamId: 3, reason: 'eliminated', atStep: 'common-opponents' }]
        }),
        cycle({
          tiedTeams: [1, 2],
          steps: [
            stepOutcome({
              step: 'head-to-head',
              separated: true,
              values: [
                { teamId: 1, value: { kind: 'headToHead', result: 'beat-all' } },
                { teamId: 2, value: { kind: 'headToHead', result: 'lost-to-all' } }
              ],
              partition: [[1], [2]]
            })
          ],
          outcome: 'resolved',
          removed: []
        })
      ]
    })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: false }
    })

    await wrapper.find('button[aria-controls]').trigger('click')

    const restartLine = wrapper.findAll('p').find(p => p.text().includes('Restarted'))
    expect(restartLine).toBeDefined()
    expect(restartLine!.text()).toContain('Clemson')
    expect(restartLine!.text()).toContain('eliminated')
    expect(restartLine!.text()).toContain('common opponents')

    // No control exists which could hide this line while the full procedure
    // is shown -- the only button in the tree is the toggle itself (the
    // ordering control is not offered: slateComplete is false).
    expect(wrapper.findAll('button')).toHaveLength(1)
  })
})

describe('terminal reason', () => {
  it('ends an unresolved group with the no-further-step line, rule citation and source name', () => {
    const g = group({
      teams: [1, 2],
      resolvedBy: 'unresolved',
      contestedWith: [1, 2],
      trace: [
        cycle({
          tiedTeams: [1, 2],
          steps: [stepOutcome({ step: 'head-to-head', separated: false, values: [], partition: [[1, 2]] })],
          outcome: 'exhausted',
          removed: []
        })
      ],
      terminalReason: NEUTRAL_REASON
    })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: false }
    })

    expect(wrapper.text()).toContain('No further step applies.')
    expect(wrapper.text()).toContain(NEUTRAL_REASON.ruleCitation)
    expect(wrapper.text()).toContain(NEUTRAL_REASON.sourceName)
  })

  it('does not render a terminal reason for a resolved group', () => {
    const g = group({
      teams: [1],
      resolvedBy: 'tiebreaker',
      contestedWith: [1, 2],
      trace: [
        cycle({
          tiedTeams: [1, 2],
          steps: [
            stepOutcome({
              step: 'head-to-head',
              separated: true,
              values: [
                { teamId: 1, value: { kind: 'headToHead', result: 'beat-all' } },
                { teamId: 2, value: { kind: 'headToHead', result: 'lost-to-all' } }
              ],
              partition: [[1], [2]]
            })
          ],
          outcome: 'resolved',
          removed: []
        })
      ]
    })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: false }
    })

    expect(wrapper.text()).not.toContain('No further step applies.')
  })
})

describe('manual provenance', () => {
  it('leads with the decided-by-you heading and applies-while sentence, then the committed ordering, then the toggle', () => {
    const g = group({
      teams: [3],
      resolvedBy: 'manual',
      contestedWith: [1, 2, 3],
      trace: [
        cycle({
          tiedTeams: [1, 2, 3],
          steps: [stepOutcome({ step: 'head-to-head', separated: false, values: [], partition: [[1, 2, 3]] })],
          outcome: 'exhausted',
          removed: []
        })
      ],
      manualOrdering: [3, 1, 2]
    })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: true }
    })

    const text = wrapper.text()
    expect(text).toContain('Decided by you')
    expect(text).toContain('It applies while this conference')

    const items = wrapper.findAll('li').map(li => li.text())
    expect(items.slice(0, 3)).toEqual(['Clemson', 'Duke', 'Miami'])

    expect(text.indexOf('Decided by you')).toBeLessThan(text.indexOf('Clemson'))
    expect(text.indexOf('Miami')).toBeLessThan(text.indexOf('Show full procedure'))
  })
})

describe('trace isolation (display-side)', () => {
  function traceTeamIds(g: RankGroup): Set<TeamId> {
    const ids = new Set<TeamId>()
    for (const c of g.trace) {
      for (const id of c.tiedTeams) ids.add(id)
      for (const step of c.steps) {
        for (const v of step.values) ids.add(v.teamId)
        for (const bucket of step.partition) for (const id of bucket) ids.add(id)
      }
      for (const r of c.removed) ids.add(r.teamId)
    }
    return ids
  }

  it('every team id referenced in a well-formed group\'s own trace is a member of its contestedWith pool', () => {
    const wellFormed = groupWithDecisiveValue({ kind: 'headToHead', result: 'beat-all' })
    for (const id of traceTeamIds(wellFormed)) {
      expect(wellFormed.contestedWith).toContain(id)
    }
  })

  it('catches a trace that mentions a team outside contestedWith -- the display-side mirror of the engine invariant', () => {
    const malformed = group({
      teams: [1],
      resolvedBy: 'tiebreaker',
      contestedWith: [1, 2],
      trace: [
        cycle({ tiedTeams: [1, 2, 99], steps: [], outcome: 'resolved', removed: [] })
      ]
    })

    const outsiders = [...traceTeamIds(malformed)].filter(id => !malformed.contestedWith.includes(id))
    expect(outsiders).toEqual([99])
  })
})

describe('tone', () => {
  it('never uses forbidden progress or storage-lifecycle vocabulary, with a neutral fixture citation', () => {
    const g = group({
      teams: [1, 2],
      resolvedBy: 'unresolved',
      contestedWith: [1, 2],
      trace: [
        cycle({
          tiedTeams: [1, 2],
          steps: [stepOutcome({ step: 'head-to-head', separated: false, values: [], partition: [[1, 2]] })],
          outcome: 'exhausted',
          removed: []
        })
      ],
      terminalReason: NEUTRAL_REASON
    })

    const wrapper = mount(TiebreakerReasoning, {
      props: { group: g, schoolById: SCHOOLS, slateComplete: true }
    })

    const text = wrapper.text().toLowerCase()
    const progressVocabulary = ['incomplete', 'unfinished', 'missing', 'pending', 'needs']
    const storageVocabulary = ['suspended', 'restored', 'paused', 'recovered']

    for (const word of [...progressVocabulary, ...storageVocabulary]) {
      expect(text).not.toContain(word)
    }
  })
})

// Task 2 (ordering interaction) adds its cases below this line once the
// component exists.
