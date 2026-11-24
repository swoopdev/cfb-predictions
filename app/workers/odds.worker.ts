/// <reference lib="webworker" />
import { createSeasonModel } from '../../shared/domain/odds/seasonModel'
import type { ScenarioState, SeasonModel, SeasonModelData } from '../../shared/domain/odds/seasonModel'
import { SimulationRun, winOutOdds } from '../../shared/domain/odds/simulate'
import { enumerateTitleGamePaths } from '../../shared/domain/odds/paths'
import type { ConferenceId } from '../../shared/domain/tiebreakers/types'

/**
 * Off-main-thread odds: Monte Carlo seasons, exact title-game paths and
 * "if they win out" runs. Imports the same pure domain modules the nightly
 * baseline script uses (relative imports -- workers get their own bundle).
 *
 * Protocol (see `app/utils/oddsWorkerClient.ts`):
 * - `init` loads a dataset once per model fingerprint;
 * - every other request carries a `channel`; a newer request on the same
 *   channel makes older ones stale, and a stale simulation stops at its next
 *   chunk boundary instead of finishing work nobody will read.
 */

export type OddsWorkerRequest
  = | { type: 'init', fingerprint: string, data: SeasonModelData }
    | { type: 'odds', id: number, channel: string, scenario: ScenarioState, sims: number, seed: number }
    | { type: 'paths', id: number, channel: string, scenario: ScenarioState, conference: ConferenceId }
    | { type: 'winOut', id: number, channel: string, scenario: ScenarioState, teamId: number, sims: number }
    | { type: 'cancel', channel: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope
let model: SeasonModel | null = null
const latest = new Map<string, number>()
const CHUNK = 250
const FIRST_POST = 500
const POST_EVERY = 1500
const SUPERSEDED = 'superseded'

const isStale = (channel: string, id: number) => latest.get(channel) !== id
const yieldToMessages = () => new Promise<void>(resolve => setTimeout(resolve, 0))

async function runOdds(msg: Extract<OddsWorkerRequest, { type: 'odds' }>) {
  if (!model) return
  const run = new SimulationRun(model, msg.scenario, msg.seed)
  let nextPost = FIRST_POST
  while (run.completed < msg.sims) {
    if (isStale(msg.channel, msg.id)) return
    run.step(Math.min(CHUNK, msg.sims - run.completed))
    if (run.completed >= nextPost && run.completed < msg.sims) {
      ctx.postMessage({ id: msg.id, type: 'odds', done: false, result: run.snapshot() })
      nextPost += POST_EVERY
    }
    await yieldToMessages()
  }
  if (isStale(msg.channel, msg.id)) return
  ctx.postMessage({ id: msg.id, type: 'odds', done: true, result: run.snapshot() })
}

ctx.onmessage = async (event: MessageEvent<OddsWorkerRequest>) => {
  const msg = event.data
  if (msg.type === 'init') {
    model = createSeasonModel(msg.data)
    return
  }
  if (msg.type === 'cancel') {
    latest.delete(msg.channel)
    return
  }
  latest.set(msg.channel, msg.id)
  // Let any already-queued newer request for this channel land first.
  await yieldToMessages()
  if (isStale(msg.channel, msg.id) || !model) {
    // Settle the caller's promise; it ignores this because it already moved on.
    ctx.postMessage({ id: msg.id, type: 'error', done: true, error: SUPERSEDED })
    return
  }

  try {
    if (msg.type === 'odds') {
      await runOdds(msg)
    } else if (msg.type === 'paths') {
      ctx.postMessage({ id: msg.id, type: 'paths', done: true, result: enumerateTitleGamePaths(model, msg.scenario, msg.conference) })
    } else {
      ctx.postMessage({ id: msg.id, type: 'winOut', done: true, result: winOutOdds(model, msg.scenario, msg.teamId, msg.sims) })
    }
  } catch (error) {
    ctx.postMessage({ id: msg.id, type: 'error', done: true, error: error instanceof Error ? error.message : String(error) })
  }
}
