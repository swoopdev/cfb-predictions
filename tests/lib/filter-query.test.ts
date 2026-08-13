import { describe, it, expect } from 'vitest'
import { buildConfQuery, buildTeamQuery } from '../../app/utils/schedule'

describe('buildConfQuery', () => {
  it('always nulls out team, regardless of input', () => {
    expect(buildConfQuery({ team: '5' }, 'SEC')).toEqual({ team: undefined, conf: 'SEC' })
  })

  it('preserves unrelated keys', () => {
    expect(buildConfQuery({ foo: 'bar' }, 'SEC')).toEqual({ foo: 'bar', conf: 'SEC', team: undefined })
  })

  it('sets conf to undefined when clearing the filter', () => {
    expect(buildConfQuery({ conf: 'SEC' }, undefined)).toEqual({ conf: undefined, team: undefined })
  })
})

describe('buildTeamQuery', () => {
  it('always nulls out conf, regardless of input', () => {
    expect(buildTeamQuery({ conf: 'SEC' }, 5)).toEqual({ conf: undefined, team: 5 })
  })

  it('preserves unrelated keys', () => {
    expect(buildTeamQuery({ foo: 'bar' }, 5)).toEqual({ foo: 'bar', team: 5, conf: undefined })
  })

  it('sets team to undefined when clearing the filter', () => {
    expect(buildTeamQuery({ team: 5 }, undefined)).toEqual({ team: undefined, conf: undefined })
  })
})
