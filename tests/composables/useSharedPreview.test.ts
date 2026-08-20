import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSharedPreview } from '../../app/composables/useSharedPreview'
import { encodeShareLink } from '../../shared/domain/shareLink'
import type { Game } from '../../shared/types/schedule'
import type { GamesEnvelope } from '../../app/utils/fetchSchedule'

/** Minimal, deterministic fixture Game -- mirrors tests/domain/shareLink.test.ts's shape. */
function makeGame(id: number, homeId: number, awayId: number): Game {
  return {
    id,
    week: 1,
    seasonType: 'regular',
    homeId,
    homeTeam: `Team${homeId}`,
    awayId,
    awayTeam: `Team${awayId}`,
    conferenceGame: false,
    neutralSite: false
  }
}

const games3: Game[] = [
  makeGame(401856766, 101, 102),
  makeGame(401864494, 103, 104),
  makeGame(401858202, 105, 106)
]

const SCHEDULE_HASH = '19c9e609'
const OTHER_SCHEDULE_HASH = 'aaaaaaaa'

function makeEnvelope(scheduleHash: string): GamesEnvelope {
  return { season: 2026, scheduleHash, games: games3 }
}

/**
 * `useSharedPreview`'s watcher body is async as of the v2 (deflate-raw) wire
 * format -- `decodeShareLink` awaits a DecompressionStream. A single
 * `nextTick()` only flushes the watcher's *invocation*, not the promise chain
 * inside it, so every assertion on a decoded result has to drain the
 * microtask queue too.
 */
async function flushDecode(): Promise<void> {
  await nextTick()
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
}

describe('useSharedPreview', () => {
  it('stays "none" with no share code and no resolved schedule', async () => {
    const games = ref<GamesEnvelope | undefined>(undefined)
    const hash = ref('')

    const { bannerVariant, preview } = useSharedPreview(games, hash)

    expect(bannerVariant.value).toBe('none')
    expect(preview.value).toBeNull()
  })

  it('stays "none" with a valid share code but an unresolved schedule (Pitfall 4)', async () => {
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: SCHEDULE_HASH, picks: { 401856766: 101 }, manualDecisions: {} })
    const games = ref<GamesEnvelope | undefined>(undefined)
    const hash = ref(`#s=${code}`)

    const { bannerVariant } = useSharedPreview(games, hash)

    expect(bannerVariant.value).toBe('none')
  })

  it('decodes to "default" once games resolves with a matching scheduleHash', async () => {
    const picks = { 401856766: 101, 401858202: 106 }
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: SCHEDULE_HASH, picks, manualDecisions: {} })
    const games = ref<GamesEnvelope | undefined>(undefined)
    const hash = ref(`#s=${code}`)

    const { bannerVariant, preview, counts } = useSharedPreview(games, hash)

    games.value = makeEnvelope(SCHEDULE_HASH)
    await flushDecode()

    expect(bannerVariant.value).toBe('default')
    expect(preview.value).toEqual({ picks, manualDecisions: {} })
    expect(counts.value).toEqual({ applied: 2, total: 2 })
  })

  it('decodes to "mismatch" when the code was encoded against a different scheduleHash, reflecting decodeShareLink\'s own fail-closed counts (CR-01)', async () => {
    const picks = { 401856766: 101 }
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: OTHER_SCHEDULE_HASH, picks, manualDecisions: {} })
    const games = ref<GamesEnvelope | undefined>(makeEnvelope(SCHEDULE_HASH))
    const hash = ref(`#s=${code}`)

    const { bannerVariant, preview, counts } = useSharedPreview(games, hash)
    await flushDecode()

    expect(bannerVariant.value).toBe('mismatch')
    // CR-01 fail-closed: a hash mismatch means positional re-application is
    // unsafe, so nothing is applied even though the payload declared 1 pick.
    expect(counts.value).toEqual({ applied: 0, total: 1 })
    expect(preview.value).toEqual({ picks: {}, manualDecisions: {} })
  })

  it('decodes to "malformed" for a syntactically invalid code', async () => {
    const games = ref<GamesEnvelope | undefined>(makeEnvelope(SCHEDULE_HASH))
    const hash = ref('#s=not-valid!!!')

    const { bannerVariant, preview, counts } = useSharedPreview(games, hash)
    // Even the `immediate: true` first run is only synchronous up to the
    // await inside the watcher body -- the variant is not settled until the
    // decode's promise chain drains.
    await flushDecode()

    expect(bannerVariant.value).toBe('malformed')
    expect(preview.value).toBeNull()
    expect(counts.value).toBeNull()
  })

  it('never decodes when the hash does not start with "#s=", even after the schedule later resolves', async () => {
    const games = ref<GamesEnvelope | undefined>(undefined)
    const hash = ref('#week1')

    const { bannerVariant } = useSharedPreview(games, hash)

    games.value = makeEnvelope(SCHEDULE_HASH)
    await flushDecode()

    expect(bannerVariant.value).toBe('none')
  })

  it('dismiss() resets state and permanently suppresses a later decode', async () => {
    const picks = { 401856766: 101 }
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: SCHEDULE_HASH, picks, manualDecisions: {} })
    const games = ref<GamesEnvelope | undefined>(makeEnvelope(SCHEDULE_HASH))
    const hash = ref(`#s=${code}`)

    const { bannerVariant, preview, counts, dismiss } = useSharedPreview(games, hash)
    await flushDecode()
    expect(bannerVariant.value).toBe('default')

    dismiss()
    expect(bannerVariant.value).toBe('none')
    expect(preview.value).toBeNull()
    expect(counts.value).toBeNull()

    // Simulate a query refetch -- must NOT re-trigger a decode.
    games.value = makeEnvelope(SCHEDULE_HASH)
    await flushDecode()
    expect(bannerVariant.value).toBe('none')
  })

  it('never calls localStorage.setItem across every case above (D-07)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const picks = { 401856766: 101 }
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: SCHEDULE_HASH, picks, manualDecisions: {} })
    const mismatchCode = await encodeShareLink({ games: games3, season: 2026, scheduleHash: OTHER_SCHEDULE_HASH, picks, manualDecisions: {} })

    const games1 = ref<GamesEnvelope | undefined>(undefined)
    const hash1 = ref(`#s=${code}`)
    const { dismiss } = useSharedPreview(games1, hash1)
    games1.value = makeEnvelope(SCHEDULE_HASH)
    await flushDecode()
    dismiss()

    const games2 = ref<GamesEnvelope | undefined>(makeEnvelope(SCHEDULE_HASH))
    const hash2 = ref(`#s=${mismatchCode}`)
    useSharedPreview(games2, hash2)
    await flushDecode()

    const games3Ref = ref<GamesEnvelope | undefined>(makeEnvelope(SCHEDULE_HASH))
    const hash3 = ref('#s=garbage!!!')
    useSharedPreview(games3Ref, hash3)

    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })
})
