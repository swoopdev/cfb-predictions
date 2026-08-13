import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { WEEKS, isWeekBoundary, buildWeekQuery } from '../../app/utils/schedule'

describe('WEEKS', () => {
  it('has exactly 15 entries, 1 through 15 inclusive, including 14', () => {
    expect(WEEKS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })
})

describe('isWeekBoundary', () => {
  it('disables prev at week 1', () => {
    expect(isWeekBoundary(1)).toEqual({ prevDisabled: true, nextDisabled: false })
  })

  it('disables next at week 15', () => {
    expect(isWeekBoundary(15)).toEqual({ prevDisabled: false, nextDisabled: true })
  })

  it('disables neither in the middle of the range', () => {
    expect(isWeekBoundary(8)).toEqual({ prevDisabled: false, nextDisabled: false })
  })
})

describe('buildWeekQuery', () => {
  it('sets week while preserving the existing conf filter unchanged', () => {
    expect(buildWeekQuery({ conf: 'SEC' }, 7)).toEqual({ params: { week: 7 }, query: { conf: 'SEC' } })
  })

  it('sets week while preserving the existing team filter unchanged', () => {
    expect(buildWeekQuery({ team: 5 }, 3)).toEqual({ params: { week: 3 }, query: { team: 5 } })
  })

  it('sets week with an empty current query', () => {
    expect(buildWeekQuery({}, 1)).toEqual({ params: { week: 1 }, query: {} })
  })
})

describe('WeekNav.vue source', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../app/components/WeekNav.vue', import.meta.url)),
    'utf-8'
  )

  it('has an explicit aria-label for the Previous week button', () => {
    expect(source).toMatch(/aria-label="Previous week"/)
  })

  it('has an explicit aria-label for the Next week button', () => {
    expect(source).toMatch(/aria-label="Next week"/)
  })
})
