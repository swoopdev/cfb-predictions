import { computed } from 'vue'
import { createSeasonModel, seasonModelDataFrom } from '#shared/domain/odds/seasonModel'
import type { SeasonModel, SeasonModelData } from '#shared/domain/odds/seasonModel'
import { modelFingerprint } from '#shared/domain/odds/fingerprint'
import { useGames } from './useGames'
import { useTeams } from './useTeams'
import { useWinProbabilities } from './useWinProbabilities'
import { useTeamRatings } from './useTeamRatings'
import { useRankings } from './useRankings'
import { useCfpRankings } from './useCfpRankings'
import { usePostseasonGames } from './usePostseasonGames'

/**
 * Every dataset the odds/playoff engines read, combined through the same
 * `seasonModelDataFrom` mapping the nightly baseline script uses -- so the
 * browser and `odds-baseline.json` can never be built from different
 * inputs. Games and teams are required; every other file is optional and
 * only has to have *settled* (loaded or failed) before the model is built,
 * so a missing file degrades the model instead of blocking it.
 */
export function useSeasonModelData(season = 2026) {
  const games = useGames(season)
  const teams = useTeams(season)
  const winProbabilities = useWinProbabilities(season)
  const teamRatings = useTeamRatings(season)
  const rankings = useRankings(season)
  const cfpRankings = useCfpRankings(season)
  const postseason = usePostseasonGames(season)

  const optional = [winProbabilities, teamRatings, rankings, cfpRankings, postseason]

  const ready = computed(() =>
    Boolean(games.data.value?.games && teams.data.value)
    && optional.every(q => !q.isPending.value)
  )

  const data = computed<SeasonModelData | undefined>(() => {
    if (!ready.value) return undefined
    return seasonModelDataFrom({
      season,
      games: games.data.value!.games,
      teams: teams.data.value!,
      winProbabilities: winProbabilities.data.value ?? null,
      teamRatings: teamRatings.data.value ?? null,
      cfpRankings: cfpRankings.data.value ?? null,
      rankings: rankings.data.value ?? null,
      postseason: postseason.data.value ?? null
    })
  })

  const fingerprint = computed(() => (data.value ? modelFingerprint(data.value) : undefined))

  /** Main-thread model: cheap to build (~ms), used for deterministic projections and the current bracket. */
  const model = computed<SeasonModel | undefined>(() => (data.value ? createSeasonModel(data.value) : undefined))

  const error = computed(() => games.isError.value || teams.isError.value)

  return { season, data, fingerprint, model, ready, error, games, teams }
}

export type SeasonModelState = ReturnType<typeof useSeasonModelData>
