import { describe, it, expect } from 'vitest'
import { sanitizeConfParam, sanitizeTeamParam } from '../../app/utils/schedule'
import type { Team } from '../../shared/types/schedule'

function makeTeam(id: number): Team {
  return {
    id,
    school: `Team ${id}`,
    mascot: null,
    abbreviation: null,
    conference: 'SEC',
    classification: 'fbs',
    color: '#000000',
    alternateColor: '#ffffff',
    logo: `/logos/${id}.png`
  }
}

const knownConferences = ['SEC', 'Big Ten', 'Big 12', 'ACC']

describe('sanitizeConfParam', () => {
  it('returns the value when it is an exact member of the known conference list', () => {
    expect(sanitizeConfParam('SEC', knownConferences)).toBe('SEC')
  })

  it('returns undefined for a value not present in the known conference list', () => {
    expect(sanitizeConfParam('<script>', knownConferences)).toBeUndefined()
  })

  it('returns undefined when raw is undefined', () => {
    expect(sanitizeConfParam(undefined, knownConferences)).toBeUndefined()
  })
})

describe('sanitizeTeamParam', () => {
  const teamsById = new Map<number, Team>([[5, makeTeam(5)]])

  it('returns the numeric id when present in teamsById', () => {
    expect(sanitizeTeamParam('5', teamsById)).toBe(5)
  })

  it('returns undefined for a well-formed integer not present in teamsById', () => {
    expect(sanitizeTeamParam('99999999', teamsById)).toBeUndefined()
  })

  it('returns undefined for a non-numeric string', () => {
    expect(sanitizeTeamParam('not-a-number', teamsById)).toBeUndefined()
  })

  it('returns undefined when raw is undefined', () => {
    expect(sanitizeTeamParam(undefined, teamsById)).toBeUndefined()
  })
})
