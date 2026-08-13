import { reportRequiredFieldFailures } from './schemas'

export interface FetchSourceDeps {
  fetchTeams: () => Promise<{ data?: unknown[], error?: unknown }>
  fetchGames: () => Promise<{ data?: unknown[], error?: unknown }>
}

export type FetchSourceResult
  = | { ok: true, rawTeams: unknown[], rawGames: unknown[] }
    | { ok: false, reason: string }

function describeError(error: unknown): string {
  return error === undefined ? '(no data returned)' : JSON.stringify(error)
}

/**
 * Fetches raw teams/games from CFBD via the injected `deps` and gates on:
 *  - SDK-level HTTP failures (`error` present, or `data` missing) — CR-01/D-09.
 *    `@hey-api/client-fetch` resolves rather than throws on non-2xx
 *    responses, so `error`/`data` must be checked explicitly instead of
 *    trusting a `?? []` fallback.
 *  - a successful-but-suspiciously-empty response (misconfigured query
 *    params can return 200 with an empty array too).
 *  - per-team required-field validation (`reportRequiredFieldFailures`).
 *
 * Deliberately side-effect free — no `process.exit`, no console output —
 * so it is unit-testable in isolation with a mocked `deps`, and so nothing
 * is written to disk before every gate above has passed
 * (hard-fail-before-any-write, D-09).
 */
export async function fetchSourceData(season: number, deps: FetchSourceDeps): Promise<FetchSourceResult> {
  const { data: rawTeams, error: teamsError } = await deps.fetchTeams()
  if (teamsError || !rawTeams) {
    return { ok: false, reason: `Failed to fetch teams from CFBD: ${describeError(teamsError)}` }
  }
  if (rawTeams.length === 0) {
    return { ok: false, reason: `CFBD returned 0 teams for season ${season} — refusing to overwrite committed data.` }
  }

  const { data: rawGames, error: gamesError } = await deps.fetchGames()
  if (gamesError || !rawGames) {
    return { ok: false, reason: `Failed to fetch games from CFBD: ${describeError(gamesError)}` }
  }
  if (rawGames.length === 0) {
    return { ok: false, reason: `CFBD returned 0 games for season ${season} — refusing to overwrite committed data.` }
  }

  const failures = reportRequiredFieldFailures(rawTeams)
  if (failures.length > 0) {
    return { ok: false, reason: JSON.stringify(failures, null, 2) }
  }

  return { ok: true, rawTeams, rawGames }
}
