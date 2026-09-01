import { describe, it, expect } from 'vitest'
import { encodeShareLink, decodeShareLink, MAX_FRAGMENT_CHARS, ShareLinkTooLargeError } from '../../shared/domain/shareLink'
import type { Game } from '../../shared/types/schedule'
import type { ConferenceDecisions } from '../../shared/domain/tiebreakers/invalidation'

/** Minimal, deterministic fixture Game -- placeholder fields only where the codec doesn't care. */
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
    neutralSite: false,
    venueId: null,
    completed: false,
    homePoints: null,
    awayPoints: null
  }
}

/** Test-local base64url encoder -- deliberately NOT imported from shareLink.ts, so raw
 * byte-level tests construct bytes independently of the module under test. */
function encodeBytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Test-local 9-byte header builder, mirroring shareLink.ts's own writeHeader layout. */
function buildHeaderBytes(opts: { version?: number, season?: number, scheduleHash?: string, gameCount?: number }): Uint8Array {
  const bytes = new Uint8Array(9)
  const view = new DataView(bytes.buffer)
  view.setUint8(0, opts.version ?? 1)
  view.setUint16(1, opts.season ?? 2026, false)
  view.setUint32(3, parseInt(opts.scheduleHash ?? '19c9e609', 16), false)
  view.setUint16(7, opts.gameCount ?? 0, false)
  return bytes
}

// Deliberately NOT id-sorted in this array's order -- proves the codec sorts itself
// (Pitfall 1). Ascending by id: 401856766, 401858202, 401864494.
const games3: Game[] = [
  makeGame(401856766, 101, 102),
  makeGame(401864494, 103, 104),
  makeGame(401858202, 105, 106)
]

// Already ascending by id -- used for the header-boundary/gameCount drift test.
const games5: Game[] = [2001, 2002, 2003, 2004, 2005].map(id => makeGame(id, id * 10 + 1, id * 10 + 2))

/** Test-local base64url decoder -- mirrors shareLink.ts's fromBase64Url, kept independent of it. */
function decodeBase64UrlForTest(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Builds a tag(1)/length(1)-recognized TLV record's raw bytes from a JSON string. */
function buildTlvBytes(json: string): Uint8Array {
  const jsonBytes = new TextEncoder().encode(json)
  const tlv = new Uint8Array(3 + jsonBytes.length)
  tlv[0] = 1 // tag
  new DataView(tlv.buffer).setUint16(1, jsonBytes.length, false)
  tlv.set(jsonBytes, 3)
  return tlv
}

/** Builds a full header+bitfield(+optional raw TLV bytes) payload independent of encodeShareLink,
 * so TLV-malformation tests can inject byte sequences the real encoder would never produce. */
function buildBytesWithTlv(
  games: readonly Game[],
  picks: Readonly<Record<number, number>>,
  scheduleHash: string,
  tlvBytes: Uint8Array | null
): Uint8Array {
  const sorted = [...games].sort((a, b) => a.id - b.id)
  const gameCount = sorted.length
  const bitfieldBytes = Math.ceil((gameCount * 2) / 8)
  const header = buildHeaderBytes({ scheduleHash, gameCount })
  const totalLen = 9 + bitfieldBytes + (tlvBytes ? tlvBytes.length : 0)
  const bytes = new Uint8Array(totalLen)
  bytes.set(header, 0)

  sorted.forEach((game, i) => {
    const winner = picks[game.id]
    const value = winner === game.homeId ? 1 : winner === game.awayId ? 2 : 0
    const byteIndex = 9 + Math.floor((i * 2) / 8)
    const bitOffset = (i * 2) % 8
    bytes[byteIndex]! |= (value & 0b11) << bitOffset
  })

  if (tlvBytes) bytes.set(tlvBytes, 9 + bitfieldBytes)
  return bytes
}

describe('shareLink codec', () => {
  it('round-trips picks through encode/decode when the schedule matches', async () => {
    const picks = { 401856766: 101, 401858202: 106 }
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks, manualDecisions: {} })
    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.hashMatched).toBe(true)
    expect(result.appliedCount).toBe(2)
    expect(result.totalCount).toBe(2)
    expect(result.picks).toEqual(picks)
    expect(result.manualDecisions).toEqual({})
  })

  it('produces a byte-identical encoded string regardless of caller-supplied games array order', async () => {
    const picks = { 401856766: 101, 401858202: 106 }
    const codeA = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks, manualDecisions: {} })
    const reordered = [games3[1]!, games3[2]!, games3[0]!]
    const codeB = await encodeShareLink({ games: reordered, season: 2026, scheduleHash: '19c9e609', picks, manualDecisions: {} })

    expect(codeB).toBe(codeA)
  })

  it('treats the reserved 2-bit value 0b11 defensively as unpicked -- never applied, never counted', async () => {
    const singleGame = [makeGame(9001, 1, 2)]
    const headerBytes = buildHeaderBytes({ scheduleHash: '19c9e609', gameCount: 1 })
    const bytes = new Uint8Array(10)
    bytes.set(headerBytes, 0)
    bytes[9] = 0b11
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, singleGame, '19c9e609')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.appliedCount).toBe(0)
    expect(result.totalCount).toBe(0)
  })

  it('reports N of M but fails closed (applies nothing) when the payload gameCount exceeds the current schedule (CR-01)', async () => {
    const picks: Record<number, number> = {}
    for (const g of games5) picks[g.id] = g.homeId
    const code = await encodeShareLink({ games: games5, season: 2026, scheduleHash: 'aaaaaaaa', picks, manualDecisions: {} })

    const currentGames3 = games5.slice(0, 3) // ascending-id prefix of the 5
    const result = await decodeShareLink(code, currentGames3, 'bbbbbbbb')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.hashMatched).toBe(false)
    expect(result.totalCount).toBe(5)
    expect(result.appliedCount).toBe(0)
    expect(result.picks).toEqual({})
  })

  it('fails closed on a MID-LIST removal, never misattributing a pick to an unrelated game (CR-01)', async () => {
    // Original sorted games: G1(100), G2(200), G3(300), G4(400) -- payload picks home/away/unpicked/home.
    const g1 = makeGame(100, 1001, 1002)
    const g2 = makeGame(200, 2001, 2002)
    const g3 = makeGame(300, 3001, 3002)
    const g4 = makeGame(400, 4001, 4002)
    const originalGames = [g1, g2, g3, g4]
    const picks = { [g1.id]: g1.homeId, [g2.id]: g2.awayId, [g4.id]: g4.homeId }
    const code = await encodeShareLink({ games: originalGames, season: 2026, scheduleHash: 'aaaaaaaa', picks, manualDecisions: {} })

    // G2 (id=200) is removed by a schedule correction -- new sorted games: G1, G3, G4.
    // Pre-fix, position 1 (originally G2's away pick) would have been silently
    // re-applied to G3, an unrelated game G2's sharer never touched.
    const currentGamesAfterRemoval = [g1, g3, g4]
    const result = await decodeShareLink(code, currentGamesAfterRemoval, 'bbbbbbbb')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.hashMatched).toBe(false)
    expect(result.totalCount).toBe(3)
    expect(result.appliedCount).toBe(0)
    expect(result.picks).toEqual({})
    // In particular, G3 must never receive a pick it was never given.
    expect(result.picks[g3.id]).toBeUndefined()
  })

  it('always yields appliedCount === totalCount when scheduleHash matches, for 0/partial/all picks', async () => {
    const cases: Array<Record<number, number>> = [
      {},
      { 401856766: 101 },
      { 401856766: 101, 401864494: 103, 401858202: 105 }
    ]

    for (const picks of cases) {
      const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks, manualDecisions: {} })
      const result = await decodeShareLink(code, games3, '19c9e609')

      expect(result.status).toBe('ok')
      if (result.status !== 'ok') throw new Error('unreachable')
      expect(result.appliedCount).toBe(result.totalCount)
    }
  })

  it('rejects a fragment exceeding MAX_FRAGMENT_CHARS before any decoding work', async () => {
    expect(MAX_FRAGMENT_CHARS).toBe(6000)
    const oversized = 'A'.repeat(6001)

    const result = await decodeShareLink(oversized, games3, '19c9e609')

    expect(result.status).toBe('malformed')
  })

  it('rejects a string containing characters outside the base64url alphabet before atob runs', async () => {
    const invalid = 'not-valid-base64url!!!'

    const result = await decodeShareLink(invalid, games3, '19c9e609')

    expect(result.status).toBe('malformed')
  })

  it('rejects a byte sequence shorter than the 9-byte header', async () => {
    const shortBytes = new Uint8Array([1, 2, 3, 4, 5])
    const code = encodeBytesToBase64Url(shortBytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('malformed')
  })

  it('rejects a well-formed header declaring an unsupported version', async () => {
    const bytes = buildHeaderBytes({ version: 2, gameCount: 0 })
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('malformed')
  })

  it('rejects a header whose declared gameCount requires more bitfield bytes than the payload actually contains', async () => {
    const headerBytes = buildHeaderBytes({ gameCount: 10 }) // needs ceil(20/8) = 3 bitfield bytes
    const bytes = new Uint8Array(10) // header(9) + only 1 bitfield byte
    bytes.set(headerBytes, 0)
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('malformed')
  })

  it('never throws on any malformed input path', async () => {
    const oversized = 'A'.repeat(6001)
    const invalidChars = 'not-valid-base64url!!!'
    const shortBytes = encodeBytesToBase64Url(new Uint8Array([1, 2, 3, 4, 5]))
    const unsupportedVersion = encodeBytesToBase64Url(buildHeaderBytes({ version: 2, gameCount: 0 }))
    const truncatedHeader = buildHeaderBytes({ gameCount: 10 })
    const truncatedBytes = new Uint8Array(10)
    truncatedBytes.set(truncatedHeader, 0)
    const truncated = encodeBytesToBase64Url(truncatedBytes)

    for (const input of [oversized, invalidChars, shortBytes, unsupportedVersion, truncated]) {
      await expect(decodeShareLink(input, games3, '19c9e609')).resolves.toBeDefined()
    }
  })
})

describe('TLV manual tiebreaker overrides', () => {
  it('round-trips non-empty manualDecisions through encode/decode, and lengthens the encoded string', async () => {
    const manualDecisions: ConferenceDecisions = { SEC: { h1: [201, 202, 203] } }
    const codeWithTlv = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks: {}, manualDecisions })
    const codeWithoutTlv = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks: {}, manualDecisions: {} })

    expect(codeWithTlv.length).toBeGreaterThan(codeWithoutTlv.length)

    const result = await decodeShareLink(codeWithTlv, games3, '19c9e609')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.manualDecisions).toEqual(manualDecisions)
  })

  it('omits the TLV section entirely when manualDecisions is empty -- not written as a zero-length record', async () => {
    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks: {}, manualDecisions: {} })
    const decoded = decodeBase64UrlForTest(code)
    const bitfieldBytes = Math.ceil((games3.length * 2) / 8)

    expect(decoded.length).toBe(9 + bitfieldBytes)
  })

  it('drops manualDecisions only (keeps the picks bitfield intact) when the TLV JSON fails structural validation', async () => {
    const picks = { 401856766: 101 }
    const tlv = buildTlvBytes(JSON.stringify({ NotAConference: { h1: [1, 2] } }))
    const bytes = buildBytesWithTlv(games3, picks, '19c9e609', tlv)
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.manualDecisions).toEqual({})
    expect(result.picks).toEqual(picks)
    expect(result.appliedCount).toBe(1)
    expect(result.totalCount).toBe(1)
  })

  it('drops manualDecisions only when the TLV declared length exceeds the actual payload length', async () => {
    const picks = { 401856766: 101 }
    const validTlv = buildTlvBytes(JSON.stringify({ SEC: { h1: [1, 2] } }))
    const corrupted = validTlv.slice(0, 4) // tag + length(2, still claims the full size) + 1 byte of value
    const bytes = buildBytesWithTlv(games3, picks, '19c9e609', corrupted)
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.manualDecisions).toEqual({})
    expect(result.picks).toEqual(picks)
  })

  it('drops manualDecisions only when the TLV value bytes are not valid JSON', async () => {
    const picks = { 401856766: 101 }
    const badJsonBytes = new TextEncoder().encode('{not valid json')
    const tlv = new Uint8Array(3 + badJsonBytes.length)
    tlv[0] = 1
    new DataView(tlv.buffer).setUint16(1, badJsonBytes.length, false)
    tlv.set(badJsonBytes, 3)
    const bytes = buildBytesWithTlv(games3, picks, '19c9e609', tlv)
    const code = encodeBytesToBase64Url(bytes)

    const result = await decodeShareLink(code, games3, '19c9e609')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.manualDecisions).toEqual({})
    expect(result.picks).toEqual(picks)
  })

  it('locates the TLV section using the payload\'s own gameCount, not currentGames.length, even across a schedule-length change -- and still applies manualDecisions (non-positional) even though picks fail closed (CR-01)', async () => {
    const games6: Game[] = [3001, 3002, 3003, 3004, 3005, 3006].map(id => makeGame(id, id * 10 + 1, id * 10 + 2))
    const picks: Record<number, number> = {}
    for (const g of games6) picks[g.id] = g.homeId
    const manualDecisions: ConferenceDecisions = { SEC: { h1: [201, 202, 203] } }

    const code = await encodeShareLink({ games: games6, season: 2026, scheduleHash: 'cccccccc', picks, manualDecisions })

    const currentGames3 = games6.slice(0, 3) // strict ascending-id prefix of the 6
    const result = await decodeShareLink(code, currentGames3, 'dddddddd')

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.hashMatched).toBe(false)
    expect(result.totalCount).toBe(6)
    expect(result.appliedCount).toBe(0)
    expect(result.picks).toEqual({})
    expect(result.manualDecisions).toEqual(manualDecisions)
  })

  it('never throws on any TLV-malformed input path', async () => {
    const picks = { 401856766: 101 }

    const badTag = buildTlvBytes(JSON.stringify({ SEC: { h1: [1, 2] } }))
    badTag[0] = 9 // not the recognized tag=1

    const badConference = buildTlvBytes(JSON.stringify({ NotAConference: { h1: [1, 2] } }))
    const truncated = buildTlvBytes(JSON.stringify({ SEC: { h1: [1, 2] } })).slice(0, 4)

    const badJsonBytes = new TextEncoder().encode('{not valid json')
    const badJson = new Uint8Array(3 + badJsonBytes.length)
    badJson[0] = 1
    new DataView(badJson.buffer).setUint16(1, badJsonBytes.length, false)
    badJson.set(badJsonBytes, 3)

    for (const tlv of [badTag, badConference, truncated, badJson]) {
      const bytes = buildBytesWithTlv(games3, picks, '19c9e609', tlv)
      const code = encodeBytesToBase64Url(bytes)
      await expect(decodeShareLink(code, games3, '19c9e609')).resolves.toBeDefined()
    }
  })
})

describe('encodeShareLink size guard (WR-02)', () => {
  /** Builds a manualDecisions payload at invalidation.ts's own maximal caps:
   * 4 P4 conferences x MAX_ENTRIES_PER_CONFERENCE(32) x MAX_IDS_PER_ENTRY(20). */
  function buildMaximalDecisions(): ConferenceDecisions {
    const conferences = ['SEC', 'Big Ten', 'Big 12', 'ACC'] as const
    const result: Record<string, Record<string, number[]>> = {}
    for (const conf of conferences) {
      const entries: Record<string, number[]> = {}
      for (let e = 0; e < 32; e++) {
        entries[`hash${conf}${e}`] = Array.from({ length: 20 }, (_, i) => e * 100 + i)
      }
      result[conf] = entries
    }
    return result as unknown as ConferenceDecisions
  }

  // This case USED to overflow MAX_FRAGMENT_CHARS and throw. It no longer
  // does: the v2 wire format deflates everything after the 9-byte header,
  // and a maximal TLV section is highly repetitive JSON (`hash<conf><n>`
  // keys over small integer arrays), so it compresses far below the budget.
  // The guard itself is still load-bearing -- see the incompressible case
  // below -- but asserting that THIS payload throws would now assert a
  // limitation the format no longer has.
  it('now encodes manualDecisions at the maximal caps comfortably under MAX_FRAGMENT_CHARS', async () => {
    const manualDecisions = buildMaximalDecisions()

    const code = await encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks: {}, manualDecisions })
    expect(code.length).toBeLessThan(MAX_FRAGMENT_CHARS)

    const result = await decodeShareLink(code, games3, '19c9e609')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.manualDecisions).toEqual(manualDecisions)
  })

  it('still throws ShareLinkTooLargeError when the encoded result exceeds the budget even after compression', async () => {
    // Deliberately incompressible: pseudo-random entry keys over
    // pseudo-random 7-digit ids, so deflate has almost no redundancy to
    // exploit and the encoded length tracks real entropy, not repetition.
    let seed = 1
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed
    }
    const decisions: Record<string, Record<string, number[]>> = {}
    for (const conf of ['SEC', 'Big Ten', 'Big 12', 'ACC']) {
      const entries: Record<string, number[]> = {}
      for (let e = 0; e < 32; e++) {
        entries[`${rand().toString(36)}${rand().toString(36)}`] = Array.from({ length: 20 }, () => rand() % 9000000 + 1000000)
      }
      decisions[conf] = entries
    }

    await expect(encodeShareLink({
      games: games3,
      season: 2026,
      scheduleHash: '19c9e609',
      picks: {},
      manualDecisions: decisions as unknown as ConferenceDecisions
    })).rejects.toThrow(ShareLinkTooLargeError)
  })

  it('does not throw for a small, realistic manualDecisions payload well under MAX_FRAGMENT_CHARS', async () => {
    const manualDecisions: ConferenceDecisions = { SEC: { h1: [201, 202, 203] } }

    await expect(encodeShareLink({ games: games3, season: 2026, scheduleHash: '19c9e609', picks: {}, manualDecisions }))
      .resolves.toBeTypeOf('string')
  })
})
