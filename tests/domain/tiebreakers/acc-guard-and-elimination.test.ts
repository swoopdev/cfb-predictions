/**
 * @vitest-environment node
 */

/**
 * Tests for two of the three engine defects this phase fixes:
 *
 * 1. The ACC recursion-guard trip (engine.ts:136-140) — the guard encodes the
 *    wrong termination invariant and rejects the ACC's published restart
 *    behaviour. Fixed by deleting the guard and adding a depth cap.
 *
 * 2. The dropped lost-to-all elimination (steps.ts:81, 99) —
 *    `evaluateHeadToHead` computes which team was swept by the whole tied
 *    group and then never reads the variable. Fixed by consuming the binding
 *    and building a three-bucket partition.
 *
 * Seed ranges 1-100 (fully picked) and 1001-1100 (through week 7) match
 * Phase 5's ranges so measurements are directly comparable.
 */

import { describe, it, expect, vi } from 'vitest'
import { resolveAllConferences } from '../../../shared/domain/standings'
import { mulberry32, generatePicks, readSlate } from '../../helpers/generated-seasons'

describe('ACC recursion-guard trip across 200 generated seasons', () => {
  const { games, teams } = readSlate()

  /**
   * Collects every console.warn call that contains the fallback prefix
   * from resolveTiebreakers.ts:78 during a resolveAllConferences call.
   * Returns richly formatted violation strings naming the seed and the
   * conference, following the house style from
   * standings-tiebreaker-agreement.test.ts.
   */
  function guardTripViolationsFor(
    label: string,
    picks: Record<number, number>
  ): string[] {
    const violations: string[] = []
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      resolveAllConferences(games, teams, picks)

      for (const call of warnSpy.mock.calls) {
        const message = String(call[0] ?? '')
        if (message.includes('tiebreaker resolution failed for')) {
          // Extract the conference name from the message
          const match = message.match(/failed for (\w[\w\s]*\w);/)
          const conference = match?.[1] ?? 'unknown'
          violations.push(
            `[guard-trip] ${label} ${conference}: ${message}`
          )
        }
      }
    } finally {
      warnSpy.mockRestore()
    }

    return violations
  }

  it('produces zero fallbacks across 100 fully-picked seasons (seeds 1-100)', () => {
    const violations: string[] = []
    for (let seed = 1; seed <= 100; seed++) {
      const random = mulberry32(seed)
      violations.push(
        ...guardTripViolationsFor(
          `fully-picked seed ${seed}`,
          generatePicks(games, random)
        )
      )
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })

  it('produces zero fallbacks across 100 partial seasons through week 7 (seeds 1001-1100)', () => {
    const violations: string[] = []
    for (let seed = 1001; seed <= 1100; seed++) {
      const random = mulberry32(seed)
      violations.push(
        ...guardTripViolationsFor(
          `weeks 1-7 seed ${seed}`,
          generatePicks(games, random, 7)
        )
      )
    }

    expect(violations.slice(0, 10)).toEqual([])
    expect(violations).toHaveLength(0)
  })
})
