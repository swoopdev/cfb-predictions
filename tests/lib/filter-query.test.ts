import { describe, it, expect } from 'vitest'
import { buildConfQuery, buildTeamQuery } from '../../app/utils/schedule'

// Both builders are multi-select as of the filter rework: they take an ARRAY
// and serialize it into the comma-separated form `sanitizeConfParam`/
// `sanitizeTeamParam` parse back. An empty array is the same "no filter"
// signal as `undefined` -- both serialize to `undefined` so the key drops out
// of the URL entirely rather than leaving a bare `?conf=`.
describe('buildConfQuery', () => {
  it('always nulls out team, regardless of input', () => {
    expect(buildConfQuery({ team: '5' }, ['SEC'])).toEqual({ team: undefined, conf: 'SEC' })
  })

  it('preserves unrelated keys', () => {
    expect(buildConfQuery({ foo: 'bar' }, ['SEC'])).toEqual({ foo: 'bar', conf: 'SEC', team: undefined })
  })

  it('joins multiple conferences with commas', () => {
    expect(buildConfQuery({}, ['SEC', 'ACC'])).toEqual({ conf: 'SEC,ACC', team: undefined })
  })

  it('sets conf to undefined when clearing the filter', () => {
    expect(buildConfQuery({ conf: 'SEC' }, undefined)).toEqual({ conf: undefined, team: undefined })
  })

  it('treats an empty array as clearing the filter', () => {
    expect(buildConfQuery({ conf: 'SEC' }, [])).toEqual({ conf: undefined, team: undefined })
  })
})

describe('buildTeamQuery', () => {
  it('always nulls out conf, regardless of input', () => {
    expect(buildTeamQuery({ conf: 'SEC' }, [5])).toEqual({ conf: undefined, team: '5' })
  })

  it('preserves unrelated keys', () => {
    expect(buildTeamQuery({ foo: 'bar' }, [5])).toEqual({ foo: 'bar', team: '5', conf: undefined })
  })

  it('joins multiple team ids with commas', () => {
    expect(buildTeamQuery({}, [5, 6])).toEqual({ team: '5,6', conf: undefined })
  })

  it('sets team to undefined when clearing the filter', () => {
    expect(buildTeamQuery({ team: 5 }, undefined)).toEqual({ team: undefined, conf: undefined })
  })

  it('treats an empty array as clearing the filter', () => {
    expect(buildTeamQuery({ team: 5 }, [])).toEqual({ team: undefined, conf: undefined })
  })
})
