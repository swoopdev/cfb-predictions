import { describe, it, expect } from 'vitest'
import { determineLoadState } from '../../app/utils/schedule'

describe('determineLoadState', () => {
  it('returns "error" when any state has isError true, even if another is isPending', () => {
    const result = determineLoadState([
      { isPending: false, isError: true },
      { isPending: true, isError: false }
    ])
    expect(result).toBe('error')
  })

  it('returns "loading" when no error is present and any state has isPending true', () => {
    const result = determineLoadState([
      { isPending: true, isError: false },
      { isPending: false, isError: false }
    ])
    expect(result).toBe('loading')
  })

  it('returns "ready" only when no state has isPending or isError true', () => {
    const result = determineLoadState([
      { isPending: false, isError: false },
      { isPending: false, isError: false }
    ])
    expect(result).toBe('ready')
  })
})
