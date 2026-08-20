import type { Game } from '../types/schedule'
import type { ConferenceDecisions } from './tiebreakers/invalidation'
import { validateConferenceDecisions } from './tiebreakers/invalidation'

/**
 * D-10's cheap first gate: a `#s=<code>` fragment longer than this is rejected
 * as the LITERAL FIRST statement of `decodeShareLink`, before any `atob`/
 * `DataView`/JSON work runs. 6000 is comfortably above the *realistic* usage
 * shape (a full 888-game bitfield is ~296 base64url chars; the code's own
 * comments in `invalidation.ts` put actual manual-tiebreaker usage at
 * ~0.01-3.85 decisions/season) and comfortably below CLAUDE.md's own cited
 * ~8,000-char Safari address-bar ceiling once the origin+path prefix is
 * accounted for.
 *
 * WR-02: this is NOT a bound on the *maximal structurally-valid* TLV size --
 * `invalidation.ts`'s own caps (`MAX_ENTRIES_PER_CONFERENCE` x
 * `MAX_IDS_PER_ENTRY`, across all 4 P4 conferences) permit a payload that
 * serializes to roughly ~19-20 KB of JSON, ~25-27K base64url chars once
 * expanded -- more than 4x this budget. `encodeShareLink` enforces this
 * limit explicitly (throwing `ShareLinkTooLargeError`) rather than silently
 * returning a code that `decodeShareLink`'s own gate above would reject.
 */
export const MAX_FRAGMENT_CHARS = 6000

/**
 * WR-02: thrown by `encodeShareLink` when the fully-encoded result would
 * exceed `MAX_FRAGMENT_CHARS` -- almost always an unusually large
 * accumulation of distinct, still-cap-compliant manual-tiebreaker-decision
 * hashes (a tail case, not realistic per-season usage). Surfacing this at
 * share time avoids silently handing back a code that `decodeShareLink`
 * would later read as `'malformed'` with no error ever shown to the sharer.
 */
export class ShareLinkTooLargeError extends Error {
  constructor(public readonly encodedLength: number) {
    super(`Encoded share link (${encodedLength} chars) exceeds MAX_FRAGMENT_CHARS (${MAX_FRAGMENT_CHARS})`)
    this.name = 'ShareLinkTooLargeError'
  }
}

/** version(1) + season(2) + scheduleHash(4) + gameCount(2), all big-endian. */
const HEADER_BYTES = 9

/**
 * Wire versions. `1` is the original uncompressed layout (header followed by
 * the raw pick bitfield + optional TLV section); `2` is byte-identical except
 * that everything AFTER the 9-byte header is `deflate-raw`-compressed.
 *
 * The header itself is never compressed -- it is only 9 bytes, and keeping it
 * in the clear means `version`/`gameCount` can be read (and the payload
 * length-checked) before any decompression is attempted.
 *
 * `encodeShareLink` emits whichever of the two is SHORTER, so a v2 link is
 * never longer than the v1 link for the same scenario, and `decodeShareLink`
 * still reads v1 codes shared before compression existed.
 */
const VERSION_UNCOMPRESSED = 1
const VERSION_DEFLATED = 2

/**
 * Hard ceiling on the INFLATED payload, checked while inflating rather than
 * after. `decodeShareLink` is this app's untrusted-input boundary, and
 * `deflate-raw` trivially compresses a multi-megabyte run of zero bytes into
 * a few hundred characters -- without this cap a share link well under
 * `MAX_FRAGMENT_CHARS` could still expand into an allocation large enough to
 * hang the tab. 64 KiB is ~200x the largest legitimate payload (a full
 * 888-game bitfield plus a cap-compliant TLV section is well under 1 KiB).
 */
const MAX_INFLATED_BYTES = 64 * 1024

/** True when the browser/runtime exposes the Compression Streams API. */
function hasCompressionStreams(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

/**
 * `deflate-raw`-compresses `input`. Returns `null` when the API is
 * unavailable or the stream errors -- callers fall back to emitting an
 * uncompressed v1 code, so compression is strictly an optimization and never
 * a correctness dependency.
 */
async function deflateRaw(input: Uint8Array): Promise<Uint8Array | null> {
  if (!hasCompressionStreams()) return null
  try {
    const stream = new Blob([input as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Inflates a `deflate-raw` payload, aborting past `MAX_INFLATED_BYTES`.
 * Returns `null` on any failure (unavailable API, corrupt stream, or the
 * bomb cap) so the caller degrades to `{status: 'malformed'}` rather than
 * throwing out of the decode path (D-11).
 */
async function inflateRaw(input: Uint8Array): Promise<Uint8Array | null> {
  if (!hasCompressionStreams()) return null
  try {
    const stream = new Blob([input as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_INFLATED_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  } catch {
    return null
  }
}

/**
 * Base64url-encodes raw bytes: builds a binary string via `String.fromCharCode`,
 * `btoa`s it, then substitutes the URL-safe alphabet and strips padding.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64url-decodes a string back to raw bytes. Rejects up front (before
 * calling `atob`) anything outside the base64url alphabet, and wraps `atob`
 * itself in `try/catch` -- it throws a `SyntaxError` on malformed base64
 * content even when the regex/padding above look correct.
 */
function fromBase64Url(str: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return null
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Writes the 9-byte header: version(u8)=1, season(u16), scheduleHash(u32), gameCount(u16). */
function writeHeader(view: DataView, season: number, scheduleHashHex: string, gameCount: number): void {
  view.setUint8(0, VERSION_UNCOMPRESSED)
  view.setUint16(1, season, false)
  view.setUint32(3, parseInt(scheduleHashHex, 16), false)
  view.setUint16(7, gameCount, false)
}

/** Reads the 9-byte header back, converting the u32 scheduleHash to an 8-hex-char string. */
function readHeader(view: DataView): { version: number, season: number, scheduleHash: string, gameCount: number } {
  return {
    version: view.getUint8(0),
    season: view.getUint16(1, false),
    scheduleHash: view.getUint32(3, false).toString(16).padStart(8, '0'),
    gameCount: view.getUint16(7, false)
  }
}

/** Writes one game's 2-bit pick value (0=unpicked, 1=home, 2=away) at `gameIndex`, LSB-first within each byte. */
function packPick(bytes: Uint8Array, offsetBytes: number, gameIndex: number, value: 0 | 1 | 2): void {
  const byteIndex = offsetBytes + Math.floor((gameIndex * 2) / 8)
  const bitOffset = (gameIndex * 2) % 8
  bytes[byteIndex]! |= (value & 0b11) << bitOffset
}

/** Reads one game's raw 2-bit pick value back at `gameIndex`. */
function unpackPick(bytes: Uint8Array, offsetBytes: number, gameIndex: number): number {
  const byteIndex = offsetBytes + Math.floor((gameIndex * 2) / 8)
  const bitOffset = (gameIndex * 2) % 8
  return (bytes[byteIndex]! >> bitOffset) & 0b11
}

export interface EncodeShareLinkParams {
  games: readonly Game[]
  season: number
  scheduleHash: string
  picks: Readonly<Record<number, number>>
  manualDecisions: ConferenceDecisions
}

/**
 * Bitpacks a scenario's picks (and, when non-empty, its manual tiebreaker
 * overrides) into a base64url string per CLAUDE.md's locked design, extended
 * to a 9-byte header (D-08/gameCount, see 08-RESEARCH.md Pattern 1).
 *
 * Never trusts the caller's `games` array order -- always sorts by numeric
 * id ascending first (Pitfall 1; matches `scripts/lib/schedule-hash.ts`'s
 * own numeric-sort convention exactly), so the encoded string is identical
 * regardless of what order `games` was passed in.
 *
 * @throws {ShareLinkTooLargeError} WR-02: when the TLV section's JSON would
 * overflow the 16-bit length field, or the fully-encoded result would exceed
 * `MAX_FRAGMENT_CHARS` -- caught before either produces an internally
 * inconsistent or oversized payload that `decodeShareLink` would silently
 * reject later with no error ever shown to the sharer.
 */
export async function encodeShareLink(params: EncodeShareLinkParams): Promise<string> {
  const sorted = [...params.games].sort((a, b) => a.id - b.id)
  const gameCount = sorted.length
  const bitfieldBytes = Math.ceil((gameCount * 2) / 8)

  const hasTlv = Object.keys(params.manualDecisions).length > 0
  const jsonBytes = hasTlv ? new TextEncoder().encode(JSON.stringify(params.manualDecisions)) : null
  // WR-02: `DataView.setUint16` silently wraps mod 65536 rather than
  // throwing -- guard explicitly so a jsonBytes.length this large can never
  // reach that write and produce an internally-inconsistent TLV record.
  if (jsonBytes && jsonBytes.length > 0xFFFF) {
    throw new ShareLinkTooLargeError(jsonBytes.length)
  }
  const tlvSectionBytes = hasTlv ? 3 + jsonBytes!.length : 0 // 1 tag byte + 2 length bytes + value

  const bytes = new Uint8Array(HEADER_BYTES + bitfieldBytes + tlvSectionBytes)
  writeHeader(new DataView(bytes.buffer), params.season, params.scheduleHash, gameCount)

  sorted.forEach((game, i) => {
    const winner = params.picks[game.id]
    const value: 0 | 1 | 2 = winner === game.homeId ? 1 : winner === game.awayId ? 2 : 0
    packPick(bytes, HEADER_BYTES, i, value)
  })

  if (hasTlv) {
    const tlvOffset = HEADER_BYTES + bitfieldBytes
    bytes[tlvOffset] = 1 // tag
    new DataView(bytes.buffer).setUint16(tlvOffset + 1, jsonBytes!.length, false)
    bytes.set(jsonBytes!, tlvOffset + 3)
  }

  // Compression (v2): the pick bitfield is fixed-width -- 888 games always
  // cost 222 bytes (~308 base64url chars) even when only a handful of games
  // are picked, since every unpicked game still spends its 2 bits. Those runs
  // of zero bytes are exactly what `deflate-raw` is best at: a 5-pick
  // scenario drops from ~308 chars to ~24, a 25-pick one to ~76, and even a
  // fully-picked season to ~188. The uncompressed form is kept whenever
  // deflate fails to help (or is unavailable), so the emitted code is never
  // longer than v1 would have been.
  const payload = bytes.subarray(HEADER_BYTES)
  const deflated = await deflateRaw(payload)

  let out = bytes
  if (deflated !== null && deflated.length < payload.length) {
    out = new Uint8Array(HEADER_BYTES + deflated.length)
    out.set(bytes.subarray(0, HEADER_BYTES))
    out.set(deflated, HEADER_BYTES)
    out[0] = VERSION_DEFLATED
  }

  const code = toBase64Url(out)
  // WR-02: MAX_FRAGMENT_CHARS's own doc comment above materially understated
  // the worst-case TLV size `invalidation.ts`'s own caps permit -- enforce
  // the budget explicitly here rather than letting it surface later as
  // `decodeShareLink` rejecting the sharer's own generated link.
  if (code.length > MAX_FRAGMENT_CHARS) {
    throw new ShareLinkTooLargeError(code.length)
  }

  return code
}

export interface DecodedShareLink {
  status: 'ok'
  hashMatched: boolean
  appliedCount: number
  totalCount: number
  picks: Record<number, number>
  manualDecisions: ConferenceDecisions
}

export type DecodeShareLinkResult = DecodedShareLink | { status: 'malformed' }

/**
 * Decodes a share-link fragment code against the CURRENT schedule.
 *
 * This is Phase 8's untrusted-input boundary (T-08-01..T-08-04) -- the first
 * genuinely externally-supplied input this app has ever parsed. Every
 * fallible step is bounds-checked or wrapped so malformed/hostile input
 * degrades to `{status: 'malformed'}` rather than throwing or corrupting
 * state (D-11). A schedule-length drift between share-time and open-time is
 * NOT malformed -- it reports "N of M" (D-08/D-12) -- but picks are FAIL
 * CLOSED whenever `scheduleHash` doesn't match: the wire format only carries
 * a positional index per game, not the game's id, so re-applying picks by
 * position into the current sorted-by-id array is only safe when that array
 * is byte-for-byte the one the sharer encoded against. A game removed (or
 * reordered) anywhere except the tail would otherwise silently shift every
 * later position onto an unrelated game (CR-01) -- exactly the
 * "silently applying picks to the wrong games" failure CLAUDE.md's
 * `scheduleHash` header exists to prevent. `totalCount` still reports how
 * many picks the payload contained even on a hash mismatch, so the banner
 * can say "0 of N picks applied", but `appliedCount` is always 0 and `picks`
 * always empty in that case. The TLV manual-tiebreaker section is NOT
 * positional (keyed by decision hash, not by array index) so it's applied
 * regardless of hash match.
 */
export async function decodeShareLink(
  code: string,
  currentGames: readonly Game[],
  currentScheduleHash: string
): Promise<DecodeShareLinkResult> {
  if (code.length > MAX_FRAGMENT_CHARS) return { status: 'malformed' }

  const raw = fromBase64Url(code)
  if (!raw) return { status: 'malformed' }
  if (raw.length < HEADER_BYTES) return { status: 'malformed' }

  const header = readHeader(new DataView(raw.buffer))
  if (header.version !== VERSION_UNCOMPRESSED && header.version !== VERSION_DEFLATED) {
    return { status: 'malformed' }
  }

  // A v2 code carries a plaintext header followed by a deflated payload.
  // Re-materializing it as one contiguous `header + inflated payload` array
  // means every offset below (and `readTlvOverrides`) stays identical for
  // both wire versions -- there is exactly one layout to reason about once
  // this step is done.
  let bytes: Uint8Array
  if (header.version === VERSION_DEFLATED) {
    const inflated = await inflateRaw(raw.subarray(HEADER_BYTES))
    if (!inflated) return { status: 'malformed' }
    bytes = new Uint8Array(HEADER_BYTES + inflated.length)
    bytes.set(raw.subarray(0, HEADER_BYTES))
    bytes.set(inflated, HEADER_BYTES)
  } else {
    bytes = raw
  }

  const bitfieldBytes = Math.ceil((header.gameCount * 2) / 8)
  if (bytes.length < HEADER_BYTES + bitfieldBytes) return { status: 'malformed' }

  const sortedCurrent = [...currentGames].sort((a, b) => a.id - b.id)
  const hashMatched = header.scheduleHash === currentScheduleHash

  const picks: Record<number, number> = {}
  let appliedCount = 0
  let totalCount = 0

  for (let i = 0; i < header.gameCount; i++) {
    const value = unpackPick(bytes, HEADER_BYTES, i)
    if (value === 0 || value === 3) continue // unpicked, or reserved treated defensively as unpicked

    totalCount++

    if (!hashMatched) continue // CR-01 fail-closed: positional re-application is unsafe once the sorted schedule has drifted -- don't misattribute picks to the wrong game

    const game = sortedCurrent[i]
    if (!game) continue // unknown game id (D-12): schedule shrank past this position, drop, don't apply

    picks[game.id] = value === 1 ? game.homeId : game.awayId
    appliedCount++
  }

  const manualDecisions = readTlvOverrides(bytes, HEADER_BYTES + bitfieldBytes)

  return { status: 'ok', hashMatched, appliedCount, totalCount, picks, manualDecisions }
}

/**
 * Reads the optional TLV manual-tiebreaker-overrides section starting at
 * `offset` (= HEADER_BYTES + bitfieldBytes, the payload's OWN gameCount-derived
 * boundary -- never `currentGames.length`, per D-08's whole reason for
 * existing). A structurally invalid or truncated TLV, or JSON that fails
 * `validateConferenceDecisions`'s shape checks, drops the overrides ONLY --
 * the caller's already-decoded picks bitfield is never affected, and this
 * never throws (D-11/D-12, T-08-03).
 */
function readTlvOverrides(bytes: Uint8Array, offset: number): ConferenceDecisions {
  if (bytes.length <= offset) return {}

  try {
    if (bytes[offset] !== 1) return {} // not a recognized TLV record -- drop silently

    const length = new DataView(bytes.buffer).getUint16(offset + 1, false)
    if (offset + 3 + length > bytes.length) return {} // truncated TLV -- drop silently

    const valueBytes = bytes.slice(offset + 3, offset + 3 + length)
    const json = new TextDecoder().decode(valueBytes)
    const parsed = JSON.parse(json) // malformed JSON throws here, caught below
    return validateConferenceDecisions(parsed)
  } catch {
    return {}
  }
}
