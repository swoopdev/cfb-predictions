/**
 * @vitest-environment node
 */
// Reads source files off disk via Node URL APIs (fileURLToPath + import.meta.url),
// which the project's global happy-dom default breaks by shadowing the file:-schemed URL.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { WEEKS, isWeekBoundary, buildWeekQuery, getAdjacentWeek } from '../../app/utils/schedule'

// Week 14 is BACK in navigation: it is conference championship week, and the
// week 14 page now renders the four ChampionshipCard matchups instead of a
// GameCard grid, so it has real content and must be reachable. The
// "week 14 is skipped" expectations these tests used to carry described the
// Phase 2 state and no longer describe the app.
describe('WEEKS', () => {
  it('has exactly 15 entries, 1 through 15 — week 14 is championship week and is navigable', () => {
    expect(WEEKS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('includes 14', () => {
    expect(WEEKS).toContain(14)
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

describe('getAdjacentWeek', () => {
  it('steps from 13 into championship week 14', () => {
    expect(getAdjacentWeek(13, 'next')).toBe(14)
  })

  it('steps from 15 back into championship week 14', () => {
    expect(getAdjacentWeek(15, 'prev')).toBe(14)
  })

  it('steps normally in the middle of the range', () => {
    expect(getAdjacentWeek(8, 'next')).toBe(9)
    expect(getAdjacentWeek(8, 'prev')).toBe(7)
  })

  it('is a no-op at the start boundary going prev', () => {
    expect(getAdjacentWeek(1, 'prev')).toBe(1)
  })

  it('is a no-op at the end boundary going next', () => {
    expect(getAdjacentWeek(15, 'next')).toBe(15)
  })

  it('steps normally in both directions from championship week 14', () => {
    expect(getAdjacentWeek(14, 'prev')).toBe(13)
    expect(getAdjacentWeek(14, 'next')).toBe(15)
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
