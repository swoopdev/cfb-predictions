import { describe, it, expect } from 'vitest'
import { computeScheduleHash } from '../scripts/lib/schedule-hash'

describe('computeScheduleHash', () => {
  it('returns the RESEARCH.md-verified hash for the known fixture ids', () => {
    expect(computeScheduleHash([401628355, 401628301, 401628288])).toBe('ffe3f098')
  })

  it('is invariant to input array order', () => {
    const a = computeScheduleHash([401628301, 401628355, 401628288])
    const b = computeScheduleHash([401628355, 401628301, 401628288])
    expect(a).toBe(b)
  })

  it('always returns a string matching /^[0-9a-f]{8}$/ for any non-empty numeric array', () => {
    expect(computeScheduleHash([401628355, 401628301, 401628288])).toMatch(/^[0-9a-f]{8}$/)
    expect(computeScheduleHash([1, 2, 3])).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic across calls with the same input in any order', () => {
    const first = computeScheduleHash([401628355, 401628301, 401628288])
    const second = computeScheduleHash([401628355, 401628301, 401628288])
    const third = computeScheduleHash([401628288, 401628301, 401628355])
    expect(first).toBe(second)
    expect(second).toBe(third)
  })

  it('returns a defined 8-character hex string for an empty array without throwing', () => {
    expect(() => computeScheduleHash([])).not.toThrow()
    expect(computeScheduleHash([])).toMatch(/^[0-9a-f]{8}$/)
  })
})
