/**
 * The single generated-season harness for the project (CLAUDE.md DRY constraint).
 *
 * Provides a deterministic PRNG (`mulberry32`), a random-pick generator
 * (`generatePicks`), and a slate loader (`readJson`, `readSlate`) for
 * property-based testing across many generated seasons of the committed
 * 2026 schedule.
 *
 * `mulberry32` is written inline rather than pulled from a package so this
 * project installs nothing (threat T-05-03-SC). Identical seeds produce
 * identical pick sets across runs, which is what makes Phase 6's measurements
 * comparable to Phase 5's.
 *
 * **Environment requirement:** Every test file that imports from this module
 * must carry a `@vitest-environment node` docblock. The `readJson` helper
 * resolves file paths through `fileURLToPath(new URL(..., import.meta.url))`,
 * and happy-dom's global `URL` produces a non-`file:`-schemed URL that
 * Node's `fileURLToPath` rejects (see
 * `.planning/phases/05-standings-engine-ui/deferred-items.md`, class B).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Game, Team } from '../../shared/types/schedule'

/**
 * Reads a JSON file relative to THIS module's location on disk.
 *
 * Uses `import.meta.url` + `fileURLToPath` so it works under vitest's
 * Node environment regardless of working directory.
 */
export function readJson<T>(relativePath: string): T {
  const url = new URL(relativePath, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as T
}

/**
 * mulberry32 — a self-contained deterministic PRNG. Written inline rather than
 * pulled from a package so this plan installs nothing (threat T-05-03-SC).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates a full or partial set of random picks for the given games,
 * using the supplied PRNG. Each picked game maps `game.id` to either
 * `game.homeId` or `game.awayId` with equal probability.
 *
 * @param games the game list (must carry `id`, `week`, `homeId`, `awayId`)
 * @param random a deterministic PRNG (e.g. from `mulberry32`)
 * @param throughWeek if provided, only games with `week <= throughWeek` are picked
 */
export function generatePicks(
  games: readonly Pick<Game, 'id' | 'week' | 'homeId' | 'awayId'>[],
  random: () => number,
  throughWeek?: number
): Record<number, number> {
  const picks: Record<number, number> = {}
  for (const game of games) {
    if (throughWeek !== undefined && game.week > throughWeek) continue
    picks[game.id] = random() < 0.5 ? game.homeId : game.awayId
  }
  return picks
}

/**
 * Loads the committed 2026 slate from `public/data/2026/`.
 *
 * Returns the full FBS roster (138 teams) and game list (888 games),
 * NOT filtered to P4 — `resolveTiebreakers` derives the FBS id set
 * from the full roster for the Big 12's FCS-win cap, so filtering
 * to P4 would silently corrupt `deriveOverallWinCount`.
 */
export function readSlate(): { games: Game[], teams: Team[] } {
  const { games } = readJson<{ games: Game[] }>('../../public/data/2026/games.json')
  const { teams } = readJson<{ teams: Team[] }>('../../public/data/2026/teams.json')
  return { games, teams }
}
