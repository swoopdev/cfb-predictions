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

// Both sanitizers are multi-select as of the filter rework: they take a
// comma-separated `?conf=`/`?team=` value and return an ARRAY of the members
// that survived validation. "Rejected" is now an empty array rather than
// `undefined`, and an unfiltered page is `[]` -- there is no longer a
// single-value form of either function.
describe('sanitizeConfParam', () => {
  it('returns a single-element array when the value is an exact member of the known conference list', () => {
    expect(sanitizeConfParam('SEC', knownConferences)).toEqual(['SEC'])
  })

  it('returns every valid member of a comma-separated list, preserving order', () => {
    expect(sanitizeConfParam('SEC,ACC', knownConferences)).toEqual(['SEC', 'ACC'])
  })

  it('drops only the invalid members of a mixed list, keeping the valid ones', () => {
    expect(sanitizeConfParam('SEC,<script>,ACC', knownConferences)).toEqual(['SEC', 'ACC'])
  })

  it('returns an empty array for a value not present in the known conference list', () => {
    expect(sanitizeConfParam('<script>', knownConferences)).toEqual([])
  })

  it('returns an empty array when raw is undefined', () => {
    expect(sanitizeConfParam(undefined, knownConferences)).toEqual([])
  })
})

describe('sanitizeTeamParam', () => {
  const teamsById = new Map<number, Team>([[5, makeTeam(5)], [6, makeTeam(6)]])

  it('returns a single-element array when the id is present in teamsById', () => {
    expect(sanitizeTeamParam('5', teamsById)).toEqual([5])
  })

  it('returns every known id in a comma-separated list, preserving order', () => {
    expect(sanitizeTeamParam('6,5', teamsById)).toEqual([6, 5])
  })

  it('drops only the unknown ids of a mixed list, keeping the known ones', () => {
    expect(sanitizeTeamParam('5,99999999,6', teamsById)).toEqual([5, 6])
  })

  it('returns an empty array for a well-formed integer not present in teamsById', () => {
    expect(sanitizeTeamParam('99999999', teamsById)).toEqual([])
  })

  it('returns an empty array for a non-numeric string', () => {
    expect(sanitizeTeamParam('not-a-number', teamsById)).toEqual([])
  })

  it('returns an empty array when raw is undefined', () => {
    expect(sanitizeTeamParam(undefined, teamsById)).toEqual([])
  })
})
