/**
 * The single public entry point into the standings domain (PROJECT.md's DRY
 * constraint: standings computation has exactly one implementation). Phase 5's
 * UI and Phase 6's tiebreaker UI both import from here, never from the
 * individual modules.
 *
 * `shared/domain/` is NOT part of Nuxt 4's auto-import scope (only
 * `shared/utils` and `shared/types` are), so callers import explicitly:
 * `import { computeStandings } from '#shared/domain/standings'`.
 */

export {
  computeStandings,
  conferenceGamesFor,
  toOutcomes,
  P4_CONFERENCES
} from './computeStandings'

export { resolveAllConferences } from './resolveTiebreakers'
export type { ResolvedTiebreakers } from './resolveTiebreakers'

export { isConferenceSlateComplete, slateCompletionByConference } from './slateCompletion'
export type { SlateCompletion } from './slateCompletion'

export { computeStandingsPipeline } from './pipeline'
export type { StandingsPipelineResult } from './pipeline'

export { reconcilePicks } from './gameCompletion'
