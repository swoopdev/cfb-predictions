import type { Game, Team } from '../../types/schedule'
import type { StandingsResult } from '../../types/standings'
import type { ConferenceDecisions } from '../tiebreakers/invalidation'
import { applyManualOrdering } from '../tiebreakers/invalidation'
import { resolveAllConferences } from './resolveTiebreakers'
import type { ResolvedTiebreakers } from './resolveTiebreakers'
import { slateCompletionByConference } from './slateCompletion'
import type { SlateCompletion } from './slateCompletion'
import { computeStandings, P4_CONFERENCES } from './computeStandings'

/**
 * The full standings/tiebreaker composition RESULT: what both
 * `useStandings.ts` (the real, storage-backed scenario) and
 * `PicksWorkspace.vue`'s share-link preview branch (Phase 8) need to render.
 */
export interface StandingsPipelineResult {
  rankings: ResolvedTiebreakers
  slateComplete: SlateCompletion
  standings: StandingsResult
}

/**
 * The ONE place the standings/tiebreaker composition ORDER is written:
 * resolve -> slate-completion -> apply manual ordering per conference ->
 * compute standings (06-UI-SPEC.md §9.2's load-bearing order -- manual
 * application must sit after `resolveAllConferences` and before
 * `computeStandings`, because `computeStandings` assigns ranks by walking
 * groups, and the split manual groups have to exist by the time it runs).
 *
 * Extracted (08-REVIEW WR-03, iteration 2) because this exact order used to
 * be written out twice: once in `useStandings.ts`'s `rankings`/`standings`
 * computeds, and again, by hand, in `PicksWorkspace.vue`'s preview
 * computeds. CLAUDE.md's DRY constraint ("standings computation... has
 * exactly one implementation, consumed through composables") means the
 * COMPOSITION ORDER needs exactly one implementation too, not just the pure
 * functions it calls -- both callers now call this function so a future
 * change to the pipeline (e.g. a new stage) can never leave one branch
 * behind.
 *
 * Deliberately excludes `pruneStale`: that is a storage side effect
 * (`useManualTiebreakers.ts`'s `useStorage`-backed write), not a pure
 * derivation, and it legitimately does not apply to a preview, which has no
 * scenario id to prune against. Callers that need it (only `useStandings.ts`
 * today) still own that `watch` themselves.
 *
 * @param games every game in the season (the full committed slate)
 * @param teams every FBS team
 * @param picks `{ gameId: winningTeamId }`, untrusted -- validated internally by `toOutcomes`
 * @param manualDecisions per-conference manual tiebreaker overrides, `{}` when previewing a share link that carried none
 */
export function computeStandingsPipeline(
  games: readonly Game[],
  teams: readonly Team[],
  picks: Readonly<Record<number, number>>,
  manualDecisions: ConferenceDecisions
): StandingsPipelineResult {
  const raw = resolveAllConferences(games, teams, picks)
  const slateComplete = slateCompletionByConference(games, teams, picks)

  const rankings: ResolvedTiebreakers = {}
  for (const conference of P4_CONFERENCES) {
    const conferenceRaw = raw[conference]
    if (!conferenceRaw) continue
    const complete = slateComplete[conference] ?? false
    rankings[conference] = applyManualOrdering(conferenceRaw, manualDecisions[conference] ?? {}, complete)
  }

  const standings = computeStandings(games, teams, picks, rankings)

  return { rankings, slateComplete, standings }
}
