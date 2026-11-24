import type { ScenarioState, SeasonModelData } from '#shared/domain/odds/seasonModel'
import type { SeasonOdds, WinOutOdds } from '#shared/domain/odds/simulate'
import type { ConferencePaths } from '#shared/domain/odds/paths'
import type { ConferenceId } from '#shared/domain/tiebreakers/types'

/**
 * Main-thread side of `app/workers/odds.worker.ts`: one shared worker for
 * the whole app, created lazily, with request ids so replies route back to
 * whoever asked. Everything posted goes through a JSON round-trip first --
 * Vue's reactive proxies (picks come straight out of `useStorage`) can't be
 * structured-cloned, and the payloads are small enough not to care.
 */

interface WorkerReply {
  id: number
  type: 'odds' | 'paths' | 'winOut' | 'error'
  done: boolean
  result?: unknown
  error?: string
}

let worker: Worker | null = null
let loadedFingerprint: string | null = null
let nextId = 1
const handlers = new Map<number, (reply: WorkerReply) => void>()

export const workersSupported = () => typeof Worker !== 'undefined'

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/odds.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const handler = handlers.get(event.data.id)
      if (!handler) return
      if (event.data.done) handlers.delete(event.data.id)
      handler(event.data)
    }
  }
  return worker
}

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/** Loads `data` into the worker unless it already holds this fingerprint. */
export function ensureWorkerModel(fingerprint: string, data: SeasonModelData): void {
  if (loadedFingerprint === fingerprint) return
  getWorker().postMessage({ type: 'init', fingerprint, data: plain(data) })
  loadedFingerprint = fingerprint
}

/**
 * Starts a simulation; `onUpdate` fires with progressive results, the last
 * one with `done: true`. Returns a cancel function. A newer request on the
 * same `channel` also supersedes this one inside the worker. A fixed seed
 * by default: two scenarios then share random draws (common random
 * numbers), so flipping one pick moves the odds by its real effect rather
 * than by fresh simulation noise.
 */
export function requestOdds(
  channel: string,
  scenario: ScenarioState,
  sims: number,
  onUpdate: (odds: SeasonOdds, done: boolean) => void,
  onError: (message: string) => void,
  seed = 1
): () => void {
  const id = nextId++
  handlers.set(id, (reply) => {
    if (reply.type !== 'error') onUpdate(reply.result as SeasonOdds, reply.done)
    else if (reply.error !== 'superseded') onError(reply.error ?? 'Simulation failed')
  })
  getWorker().postMessage({ type: 'odds', id, channel, scenario: plain(scenario), sims, seed })
  return () => handlers.delete(id)
}

function requestOnce<T>(message: Record<string, unknown>): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    handlers.set(id, (reply) => {
      if (reply.type === 'error') reject(new Error(reply.error))
      else resolve(reply.result as T)
    })
    getWorker().postMessage({ ...message, id })
  })
}

/**
 * Exact title-game paths for one conference. A superseded request (newer
 * one on the same channel) never resolves -- callers only ever await the
 * latest, so the dangling promise is simply dropped.
 */
export function requestPaths(channel: string, scenario: ScenarioState, conference: ConferenceId): Promise<ConferencePaths> {
  return requestOnce<ConferencePaths>({ type: 'paths', channel, scenario: plain(scenario), conference })
}

export function requestWinOut(channel: string, scenario: ScenarioState, teamId: number, sims = 1500): Promise<WinOutOdds> {
  return requestOnce<WinOutOdds>({ type: 'winOut', channel, scenario: plain(scenario), teamId, sims })
}

/** Stops whatever `channel` is running (its owner unmounted). */
export function cancelChannel(channel: string): void {
  if (worker) worker.postMessage({ type: 'cancel', channel })
}

let channelCounter = 0
/** A fresh channel name per composable instance. */
export const newChannel = (prefix: string) => `${prefix}-${++channelCounter}`
