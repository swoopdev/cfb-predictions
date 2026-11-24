import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import type { ScenarioState } from '#shared/domain/odds/seasonModel'
import { simulateSeason, winOutOdds } from '#shared/domain/odds/simulate'
import type { SeasonOdds, WinOutOdds } from '#shared/domain/odds/simulate'
import { enumerateTitleGamePaths } from '#shared/domain/odds/paths'
import type { ConferencePaths } from '#shared/domain/odds/paths'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'
import { reconcilePicks } from '#shared/domain/standings'
import {
  cancelChannel,
  ensureWorkerModel,
  newChannel,
  requestOdds,
  requestPaths,
  requestWinOut,
  workersSupported
} from '~/utils/oddsWorkerClient'
import type { SeasonModelState } from './useSeasonModelData'
import { useOddsBaseline } from './useOddsBaseline'
import { usePicksStorage } from './usePicksStorage'
import { useChampionshipPicksStorage } from './useChampionshipPicksStorage'
import { useManualTiebreakers } from './useManualTiebreakers'
import { useGames } from './useGames'

/**
 * A scenario's model input, read from its storage: picks for games that
 * haven't been played yet (final scores override picks anyway, so dropping
 * the rest keeps "nothing picked" recognisable even after old picks were
 * reconciled), championship picks and manual tiebreaker orderings.
 *
 * Like every scenario-scoped composable, call it once per scenario id from a
 * component keyed by that id (RESEARCH.md Pitfall 1).
 */
export function useScenarioState(scenarioId: string, season = 2026) {
  const picks = usePicksStorage(scenarioId, season)
  const championshipPicks = useChampionshipPicksStorage(scenarioId, season)
  const { decisions } = useManualTiebreakers(scenarioId, season)
  const { data: games } = useGames(season)

  // Same reconciliation the picks page runs: final scores fill in (and
  // override) picks, so standings read real records on any page.
  watch(() => games.value?.games, (list) => {
    if (!list) return
    const reconciled = reconcilePicks(list, picks.value)
    if (reconciled !== picks.value) picks.value = reconciled
  }, { immediate: true })

  const scenario = computed<ScenarioState>(() => {
    const open: Record<number, number> = {}
    for (const g of games.value?.games ?? []) {
      if (g.completed) continue
      const pick = picks.value[g.id]
      if (pick === g.homeId || pick === g.awayId) open[g.id] = pick
    }
    return { picks: open, championshipPicks: { ...championshipPicks.value }, manualDecisions: decisions.value }
  })

  return { picks, championshipPicks, decisions, scenario }
}

/** No picks, no championship picks, no manual orderings: the scenario the nightly baseline was computed for. */
export function isDefaultScenario(s: ScenarioState): boolean {
  return Object.keys(s.picks).length === 0
    && Object.keys(s.championshipPicks).length === 0
    && Object.values(s.manualDecisions).every(d => !d || Object.keys(d).length === 0)
}

/** The nightly baseline, only while it was computed from exactly the data this page loaded. */
function useFreshBaseline(seasonData: SeasonModelState) {
  const baseline = useOddsBaseline(seasonData.season)
  const fresh = computed(() => {
    const b = baseline.data.value
    return b && b.fingerprint === seasonData.fingerprint.value ? b : undefined
  })
  const settled = computed(() => seasonData.ready.value && !baseline.isPending.value)
  return { fresh, settled }
}

const scenarioKey = (s: ScenarioState) => JSON.stringify(s)

/**
 * Simulated season odds for a scenario. The default (no-picks) scenario
 * reads the nightly baseline instantly; anything else runs in the Web
 * Worker, debounced, with progressive results so numbers appear within a
 * fraction of a second and sharpen as the run finishes.
 */
export function useScenarioOdds(
  seasonData: SeasonModelState,
  scenario: Ref<ScenarioState>,
  options: { sims?: number, debounce?: number } = {}
) {
  const sims = options.sims ?? 5000
  const debounce = options.debounce ?? 250
  const { fresh, settled } = useFreshBaseline(seasonData)

  const odds = shallowRef<SeasonOdds>()
  const computing = ref(false)
  const progress = ref(0)
  const error = ref<string | null>(null)
  const channel = newChannel('odds')
  let cancel: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const usingBaseline = computed(() => Boolean(fresh.value) && isDefaultScenario(scenario.value))
  const key = computed(() => (settled.value ? `${seasonData.fingerprint.value}|${scenarioKey(scenario.value)}` : undefined))

  function stop() {
    if (timer) clearTimeout(timer)
    timer = undefined
    cancel?.()
    cancel = null
  }

  function start() {
    const data = seasonData.data.value
    const fingerprint = seasonData.fingerprint.value
    const model = seasonData.model.value
    if (!data || !fingerprint || !model) return
    const s = scenario.value
    error.value = null
    if (!workersSupported()) {
      odds.value = simulateSeason(model, s, Math.min(sims, 2000), 1)
      computing.value = false
      progress.value = 1
      return
    }
    ensureWorkerModel(fingerprint, data)
    cancel = requestOdds(channel, s, sims, (result, done) => {
      odds.value = result
      progress.value = Math.min(1, result.sims / sims)
      if (done) {
        computing.value = false
        cancel = null
      }
    }, (message) => {
      error.value = message
      computing.value = false
      cancel = null
    })
  }

  watch(key, (k) => {
    stop()
    if (!k) return
    if (usingBaseline.value) {
      odds.value = fresh.value!.odds
      computing.value = false
      progress.value = 1
      return
    }
    computing.value = true
    progress.value = 0
    timer = setTimeout(start, odds.value ? debounce : 0)
  }, { immediate: true })

  onScopeDispose(() => {
    stop()
    cancelChannel(channel)
  })

  const teamOdds = computed(() => new Map((odds.value?.teams ?? []).map(t => [t.teamId, t])))

  return { odds, teamOdds, computing, progress, error, usingBaseline }
}

/**
 * Exact title-game paths for one Power Four conference (or a "too many
 * games left" marker). Baseline for the default scenario, Web Worker
 * otherwise.
 */
export function useConferencePaths(
  seasonData: SeasonModelState,
  scenario: Ref<ScenarioState>,
  conference: Ref<ConferenceId | undefined>
) {
  const { fresh, settled } = useFreshBaseline(seasonData)
  const paths = shallowRef<ConferencePaths>()
  const computing = ref(false)
  const channel = newChannel('paths')
  let token = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const key = computed(() => (settled.value && conference.value
    ? `${conference.value}|${seasonData.fingerprint.value}|${scenarioKey(scenario.value)}`
    : undefined))

  watch(key, (k) => {
    const mine = ++token
    if (timer) clearTimeout(timer)
    const conf = conference.value
    if (!k || !conf) {
      paths.value = undefined
      computing.value = false
      return
    }
    if (paths.value && paths.value.conference !== conf) paths.value = undefined
    if (fresh.value && isDefaultScenario(scenario.value)) {
      paths.value = fresh.value.paths.find(p => p.conference === conf)
      computing.value = false
      return
    }
    computing.value = true
    timer = setTimeout(async () => {
      const data = seasonData.data.value
      const fingerprint = seasonData.fingerprint.value
      const model = seasonData.model.value
      if (mine !== token || !data || !fingerprint || !model) return
      try {
        let result: ConferencePaths
        if (workersSupported()) {
          ensureWorkerModel(fingerprint, data)
          result = await requestPaths(channel, scenario.value, conf)
        } else {
          result = enumerateTitleGamePaths(model, scenario.value, conf)
        }
        if (mine === token) paths.value = result
      } catch {
        // Leave the previous result up; the next pick retries.
      } finally {
        if (mine === token) computing.value = false
      }
    }, paths.value ? 200 : 0)
  }, { immediate: true })

  onScopeDispose(() => {
    token++
    if (timer) clearTimeout(timer)
    cancelChannel(channel)
  })

  return { paths, computing }
}

/** "If they win out" odds for one team under the scenario. */
export function useWinOut(
  seasonData: SeasonModelState,
  scenario: Ref<ScenarioState>,
  teamId: Ref<number | undefined>,
  sims = 1500
) {
  const winOut = shallowRef<WinOutOdds>()
  const computing = ref(false)
  const channel = newChannel('winout')
  let token = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const key = computed(() => (seasonData.ready.value && teamId.value !== undefined
    ? `${teamId.value}|${seasonData.fingerprint.value}|${scenarioKey(scenario.value)}`
    : undefined))

  watch(key, (k) => {
    const mine = ++token
    if (timer) clearTimeout(timer)
    const id = teamId.value
    if (!k || id === undefined) {
      winOut.value = undefined
      computing.value = false
      return
    }
    if (winOut.value && winOut.value.teamId !== id) winOut.value = undefined
    computing.value = true
    timer = setTimeout(async () => {
      const data = seasonData.data.value
      const fingerprint = seasonData.fingerprint.value
      const model = seasonData.model.value
      if (mine !== token || !data || !fingerprint || !model) return
      try {
        let result: WinOutOdds
        if (workersSupported()) {
          ensureWorkerModel(fingerprint, data)
          result = await requestWinOut(channel, scenario.value, id, sims)
        } else {
          result = winOutOdds(model, scenario.value, id, Math.min(sims, 800))
        }
        if (mine === token) winOut.value = result
      } catch {
        // Leave the previous result up.
      } finally {
        if (mine === token) computing.value = false
      }
    }, 300)
  }, { immediate: true })

  onScopeDispose(() => {
    token++
    if (timer) clearTimeout(timer)
    cancelChannel(channel)
  })

  return { winOut, computing }
}
