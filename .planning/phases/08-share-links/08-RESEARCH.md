# Phase 8: Share Links - Research

**Researched:** 2026-08-20
**Domain:** Client-side binary encoding (bitpack + base64url, no library) + Nuxt/Vue Router URL-fragment reading (`ssr: false`) + preview-state architecture over an established scenario-storage system (Phase 7)
**Confidence:** HIGH on the encoding mechanics (bit manipulation, base64url, `route.hash` reading — all standard, verifiable techniques cross-checked against this repo's own data) and on the integration points with Phase 7's composables (read directly from source this session). MEDIUM on the preview-rendering architecture (a reasoned synthesis from the codebase's existing patterns, since 08-UI-SPEC.md documents no new props/behavior for `GameCard.vue`/`StandingsSidebar.vue`, meaning this research had to infer the preview mechanism from what's structurally possible without touching them). LOW/flagged on one necessary deviation from CLAUDE.md's literal header byte layout — see Open Questions #1.

## Summary

This phase's real engineering content is entirely in one file: a new `shared/domain/shareLink.ts` implementing CLAUDE.md's locked bitpack-to-base64url design. Two verified facts from this session change how that file must be built. First, `public/data/2026/games.json`'s `games` array is **not stored pre-sorted by id** (`[401856766, 401864494, 401858202, ...]` in the raw file) — CLAUDE.md's "stable index" (bit position `2i` = game `i`, sorted by CFBD id ascending) is a sort the encoder/decoder must perform themselves at runtime, every time, never an assumption about file order. Second, and more consequentially: CLAUDE.md's locked header (`[version:u8][season:u16][scheduleHash:u32]`, 7 bytes) has no field recording how many games the payload's bitfield covers. That gap was harmless under CLAUDE.md's original design ("fails loudly" — reject outright on any hash mismatch), but 08-CONTEXT.md's D-08 supersedes that with a **partial-apply-and-report** requirement (SHARE-03) — and partial application is structurally impossible to implement correctly without knowing the payload's own game count, because the decoder cannot otherwise locate the boundary between the picks bitfield and the TLV overrides section that follows it. This research recommends extending the header to `[version:u8][season:u16][scheduleHash:u32][gameCount:u16]` (9 bytes) — a minimal, backward-compatible-in-spirit addition that makes SHARE-03 implementable at all. Flagged explicitly in Open Questions #1 for a one-line confirmation, but written here as the working recommendation since the alternative (no `gameCount` field) leaves D-08 unimplementable.

With that fixed, the "N of M picks applied" semantics fall out of one unified decode algorithm (no separate mismatch-handling branch): decode always walks bit positions `0..payload.gameCount-1` against the **current** schedule's own id-sorted list; a position within current bounds resolves to a real current game and applies (counts toward both N and M); a position at or beyond current bounds is an "unknown game id" and drops (counts toward M only). When `scheduleHash` matches, this algorithm always yields N === M by construction — so `hashMatched` is purely a banner-copy switch (D-05's plain banner vs. D-08's warning banner), never a second code path.

The second major finding concerns the "zero storage writes until Save a copy" preview (D-07). `GameCard.vue` mutates its `picks` prop **in place** (`props.picks[gameId] = teamId`) with no emitted event — it has no concept of read-only and 08-UI-SPEC.md documents no new prop for it. The correct, zero-new-props answer is that "picks" in this codebase has always been "whatever `Record<number, number>` ref is currently bound," and the ONLY thing that made real picks persistent was `usePicksStorage` wrapping that ref in VueUse's `useStorage`. A preview is simply a **plain, non-`useStorage` `ref<Record<number, number>>()`** seeded from the decode result — GameCard, the bulk-fill/clear pure functions, and the standings pure functions (`resolveAllConferences`/`computeStandings`/`applyManualOrdering`, all already storage-agnostic exports from `shared/domain/`) accept it identically to a real picks ref, including remaining interactively editable during preview (which is a reasonable, zero-extra-code product behavior, not a gap). `PicksWorkspace.vue` needs one new optional prop (`preview: { picks: Record<number, number>, manualDecisions: ConferenceDecisions } | null`) to select between its normal `usePicksStorage`-backed ref and this plain one; everything downstream is unchanged.

Third: encoding a share link (D-01/D-02) and applying "Save a copy" (D-06) both need to read/write a scenario's picks/decisions by id **without necessarily being the currently-mounted scenario** — this is exactly Phase 7's already-established "Pattern 2" (`duplicateScenario`/`deleteScenario` operate on raw `localStorage` via `scenarioKeys`, never a live composable instance). This phase's share-generation and save-a-copy code should follow that precedent exactly rather than inventing a new access path.

**Primary recommendation:** Build `shared/domain/shareLink.ts` (pure, no `app/` imports) implementing `encodeShareLink`/`decodeShareLink` per the header/bitfield/TLV design in Architecture Patterns below, reusing `scripts/lib/schedule-hash.ts`'s exact numeric-sort convention for the game-id index. Wire share generation and "Save a copy" through raw `localStorage` reads/writes via `app/utils/scenarioKeys.ts` (Phase 7 Pattern 2), never through a live composable instance for a non-active scenario. Implement the preview banner as a new `app/composables/useSharedPreview.ts` that reads `route.hash` once, decodes via `shareLink.ts`, and hands `week/[week].vue` a plain preview-picks ref threaded into `PicksWorkspace` through one new optional prop.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bitpack encode/decode, base64url, TLV parsing | Browser / Client | — | Pure functions in `shared/domain/shareLink.ts`; no server exists (`FOUND-01`) |
| Share-link generation (per-row action) | Browser / Client | — | `ScenarioSwitcher.vue`'s new Share action, reads raw `localStorage` for a possibly-non-active scenario |
| Reading `#s=<code>` on load | Browser / Client | — | `useRoute().hash` via Vue Router, entirely client-side (`ssr: false`) |
| Preview rendering (banner, temporarily-shown picks/standings) | Browser / Client | — | In-memory `ref`, never persisted until "Save a copy" |
| "Save a copy" persistence | Browser / Client | — | Reuses `useScenarios().createScenario()` + raw `localStorage` writes (Phase 7 Pattern 2) |
| Schedule-fingerprint comparison | Browser / Client | — | Compares payload's `scheduleHash` against `useGames()`'s already-fetched envelope; no network round-trip |

No API/backend, CDN, or database tier exists in this app — every capability in this phase lives entirely client-side, unchanged from Phase 7's map.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHARE-01 | User can generate a shareable URL that encodes a scenario's picks and any manual tiebreaker overrides | `encodeShareLink()` (Architecture Patterns, Pattern 1) + Phase 7 Pattern 2 raw-`localStorage` read for a non-active scenario (Code Examples) |
| SHARE-02 | Opening a share link does not silently overwrite the visitor's own existing picks — banner + save-a-copy option | `useSharedPreview()` composable (Pattern 3) — plain, non-`useStorage` preview ref, zero writes until `createScenario()` fires (Pattern 2/Don't Hand-Roll) |
| SHARE-03 | Schedule fingerprint mismatch reports how many picks applied, doesn't silently misapply/drop | Unified decode algorithm (Summary, Pattern 1) — requires the `gameCount` header extension (Open Questions #1); `hashMatched` only switches banner copy |
| SHARE-04 | Incoming share-link payloads validated before being applied (unknown game ids rejected, size capped) | `MAX_FRAGMENT_CHARS` pre-decode gate (Pitfall 3) + per-position bounds check (drops "unknown game id" individually, Pitfall 2) + TLV structural validation reusing the hoisted `validateConferenceDecisions` (Don't Hand-Roll) |
</phase_requirements>

## Standard Stack

### Core

No new packages this phase — CLAUDE.md explicitly locks "bitpack to base64url, no library" (rejecting `lz-string`, `CompressionStream` deferred to v2, query-string encoding rejected). Everything needed is a Web Platform API already available in this app's target environment (evergreen browsers, `ssr: false`, same baseline Phase 7 already assumed for `crypto.randomUUID()`):

| API | Availability | Purpose | Why Standard |
|-----|--------------|---------|---------------|
| `btoa`/`atob` | Universal, decades-stable [VERIFIED: MDN, no version gate] | Base64 encode/decode of the raw byte string before URL-safe character substitution | The only base64 primitive with truly universal support; CLAUDE.md's own measured-size table (200 bytes -> 268 chars) assumes exactly this expansion ratio |
| `DataView` / `Uint8Array` | Universal, ES2015+ | Multi-byte header field read/write (`u16`/`u32`), 2-bits-per-game bitfield packing | Standard binary-manipulation primitives; no reason to hand-roll bit-shifting on plain numbers when `DataView` already exists |
| `TextEncoder`/`TextDecoder` | Universal | UTF-8 encode/decode of the TLV section's JSON payload (manual tiebreaker overrides) | Needed to convert a JSON string into bytes for the TLV `value`; standard, zero-dependency |
| `crypto.subtle.digest` | Not used | — | Explicitly NOT needed — `scheduleHash` is already computed once at build time (`scripts/lib/schedule-hash.ts`) and shipped as a plain string in `games.json`; the client only needs to `parseInt(hash, 16)` it into a u32, never re-hash anything |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `btoa`/`atob` hand-rolled base64url | `Uint8Array.prototype.toBase64()`/`Uint8Array.fromBase64()` (native, URL-safe alphabet option built in) | **Not recommended for v1.** [VERIFIED via WebSearch, MDN/TC39] These methods landed in browsers in 2025 and reached Baseline **"Newly available"** status in September 2025 — meaning fewer than the ~30 months of universal support Baseline "Widely available" requires. `btoa`/`atob` has zero such risk. Revisit at the v2 boundary once this feature is Widely Available; today it would need a fallback anyway, which is more code than the `btoa`/`atob` approach it would replace |
| Hand-rolled TLV structural validator in `shareLink.ts` | Import `useManualTiebreakers.ts`'s private `validateConferenceDecisions`/`isValidOrderedIds` | **Not directly importable as-is** — those functions live in `app/composables/useManualTiebreakers.ts` (app layer), and `shared/domain/` must stay decoupled from `app/` (existing, explicit codebase convention — see `shared/domain/tiebreakers/types.ts`'s `Game` interface docblock). Recommend **hoisting** `isValidOrderedIds`/`validateConferenceDecisions` into `shared/domain/tiebreakers/invalidation.ts` as exported functions (both are already pure, referencing only `TeamId`/`ConferenceId` types that already live there) so both `useManualTiebreakers.ts` and `shareLink.ts` import the same implementation — see Don't Hand-Roll |
| `gameCount` header field | Skip TLV parsing entirely on any hash mismatch (no header change) | Rejected — see Summary and Open Questions #1. Without knowing the payload's own game count, the decoder cannot locate the bitfield/TLV boundary on a schedule-length change, making the boundary read either read garbage into picks or truncate them |

**Installation:** none required.

**Version verification:** not applicable — no packages. Confirmed via `npm view` pattern used in prior phases: N/A this phase (see `package.json`, unchanged dependency list from Phase 7).

## Package Legitimacy Audit

**Not applicable.** This phase installs no new packages. CLAUDE.md's own "What NOT to Use" table already rejected `lz-string` for this exact feature (`lz-string` compresses the JSON payload to 2,620 chars vs. bitpacking's measured 268 — bitpacking wins outright, no compression library needed). Everything is hand-rolled Web Platform API usage, matching the project's existing zero-new-dependency precedent from Phase 7.

## Architecture Patterns

### System Architecture Diagram

```
GENERATE (D-01/D-02, SHARE-01)
┌──────────────────────────────────────────────────────────────────┐
│ ScenarioSwitcher.vue  (new "Share" row action, lucide:share-2)    │
│   @share(scenarioId) ──────────────────────────────────────┐     │
└──────────────────────────────────────────────────────────────────┘
                                                               │
                                                               ▼
                                          week/[week].vue: handleShare(id)
                                          ── raw localStorage read via
                                             scenarioKeys.picks/manualTiebreakers
                                             (Phase 7 Pattern 2 — id may not
                                             be the active scenario) ──┐
                                                                       ▼
                                          shared/domain/shareLink.ts
                                          encodeShareLink({ games, season,
                                            scheduleHash, picks, decisions })
                                            1. sort games by id ascending
                                            2. write header (v, season,
                                               scheduleHash, gameCount)
                                            3. pack 2 bits/game
                                            4. append TLV (JSON decisions,
                                               only if non-empty)
                                            5. base64url-encode
                                                                       │
                                                                       ▼
                                          ShareLinkModal.vue (UModal)
                                          shows `${origin}${path}#s=<code>`
                                          + Copy Link button

OPEN (D-05..D-12, SHARE-02/03/04)
┌──────────────────────────────────────────────────────────────────┐
│ week/[week].vue (onMounted / setup, ssr:false — no hydration gap) │
│   const { preview, status, dismiss, saveCopy } = useSharedPreview()│
│     reads route.hash ONCE ── "#s=<code>" ──┐                      │
└──────────────────────────────────────────────────────────────────┘
                                              ▼
                              shared/domain/shareLink.ts
                              decodeShareLink(code, currentGames, currentScheduleHash)
                                1. length gate (D-10, BEFORE base64 decode)
                                2. base64url decode -> bytes (malformed -> reject)
                                3. read header, validate version/length
                                4. unpack bitfield using PAYLOAD's own
                                   gameCount (not current schedule's)
                                5. walk positions 0..gameCount-1 against
                                   CURRENT id-sorted games list:
                                     in bounds  -> apply, N++, M++
                                     out of bounds -> "unknown game id", M++ only
                                6. parse TLV (if present); structurally
                                   invalid TLV drops overrides only, keeps
                                   picks bitfield (D-12-style partial drop)
                                → { status: 'ok', hashMatched, appliedCount,
                                    totalCount, picks, manualDecisions }
                                  | { status: 'malformed' }
                                              │
                                              ▼
                              SharedScenarioBanner.vue (UAlert)
                              status === 'malformed'      -> D-11 copy, no action
                              hashMatched === true         -> D-05 copy, "Save a copy"
                              hashMatched === false         -> D-08 "{N} of {M}" copy, "Save a copy"
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        ▼ (dismiss ×)                                ▼ (Save a copy)
                  clear route.hash                    useScenarios().createScenario()
                  (router.replace)                     + raw localStorage write of
                  preview stays visible                  preview.picks/manualDecisions
                  until user also                        into the NEW scenario's keys
                  navigates away                          (Phase 7 Pattern 2) — activates it
                                              │
                                              ▼
                              PicksWorkspace.vue — NEW optional `preview` prop
                                preview !== null:
                                  picks = a plain ref(preview.picks) — NOT
                                    usePicksStorage's ref — mutable in place
                                    by GameCard exactly like real picks, but
                                    never synced to localStorage
                                  standings/rankings computed via the SAME
                                    pure functions useStandings.ts already
                                    calls (resolveAllConferences,
                                    slateCompletionByConference,
                                    applyManualOrdering, computeStandings),
                                    fed preview.picks/manualDecisions instead
                                    of usePicksStorage/useManualTiebreakers'
                                    storage-backed refs
                                preview === null: unchanged from Phase 7
                                              │
                                              ▼
                              GameCard.vue / StandingsSidebar.vue — UNCHANGED,
                              zero new props (08-UI-SPEC.md documents none) —
                              they already just consume a Record<number,number>
                              and a computed StandingsResult, agnostic to source
```

### Recommended Project Structure

```
shared/
├── domain/
│   ├── shareLink.ts               # NEW — encodeShareLink/decodeShareLink, pure
│   └── tiebreakers/
│       └── invalidation.ts        # MODIFIED — export isValidOrderedIds,
│                                   #   validateConferenceDecisions (hoisted from
│                                   #   useManualTiebreakers.ts, see Don't Hand-Roll)
app/
├── composables/
│   ├── useSharedPreview.ts        # NEW — route.hash read, decode, preview state,
│   │                               #   dismiss/saveCopy actions
│   └── useManualTiebreakers.ts    # MODIFIED — imports validateConferenceDecisions
│                                   #   from shared/domain instead of defining it
├── components/
│   ├── ShareLinkModal.vue         # NEW — UModal, mirrors DeleteScenarioModal.vue
│   ├── SharedScenarioBanner.vue   # NEW — UAlert, 3 copy variants (D-05/D-08/D-11)
│   ├── ScenarioSwitcher.vue       # MODIFIED — new Share row action (lucide:share-2)
│   └── PicksWorkspace.vue         # MODIFIED — new optional `preview` prop
└── pages/week/[week].vue          # MODIFIED — mounts useSharedPreview(), renders
                                    #   SharedScenarioBanner + ShareLinkModal,
                                    #   passes preview down to PicksWorkspace
```

### Pattern 1: Header layout, bit encoding, and the unified decode algorithm

**What:** A 9-byte header, immediately followed by a `ceil(gameCount * 2 / 8)`-byte bitfield, immediately followed by an optional TLV section.

```
byte 0:      version (u8) = 1
bytes 1-2:   season (u16, big-endian)
bytes 3-6:   scheduleHash (u32, big-endian) — parseInt(games.json's 8-hex-char scheduleHash, 16)
bytes 7-8:   gameCount (u16, big-endian) — number of games this payload's bitfield covers
bytes 9..:   bitfield, 2 bits/game, LSB-first within each byte, games ordered by
             sorting the schedule's games ascending by `id` (never the JSON file's
             stored array order — VERIFIED this session: games.json's raw array is
             NOT id-sorted, e.g. first three ids are 401856766, 401864494, 401858202)
             values: 00 = unpicked, 01 = home team wins, 10 = away team wins,
                     11 = reserved (decode treats defensively as unpicked)
bytes after: optional single TLV record — tag(u8)=1, length(u16, byte count of
             value), value = UTF-8 JSON bytes of a compacted ConferenceDecisions-
             shaped object. Omitted entirely (zero bytes) when the scenario has
             no manual tiebreaker overrides — the common case per Phase 6
             research's measured "1-2 manual decisions per conference per season."
```

**Why `gameCount`, not just re-deriving from the current schedule:** the decoder must know how many bytes the bitfield occupies BEFORE it can find where the TLV section starts. If that byte count came from the CURRENT schedule (888 games today) rather than the payload's own value, a schedule-length change between share-time and open-time would misalign every byte read after the point of divergence — corrupting or losing the TLV section, and potentially misreading pick bits as TLV bytes or vice versa. Encoding `gameCount` in the header (2 bytes, well within CLAUDE.md's 268-char budget) removes all ambiguity. See Open Questions #1 for why this is presented as a recommendation, not treated as fully pre-locked.

**Unified decode (works identically whether `scheduleHash` matches or not):**
```typescript
// shared/domain/shareLink.ts (sketch — see Code Examples for the full base64url/bit helpers)
function decodePicks(bitfieldBytes: Uint8Array, payloadGameCount: number, currentGamesSortedById: Game[]) {
  const picks: Record<number, number> = {}
  let appliedCount = 0
  let totalCount = 0

  for (let i = 0; i < payloadGameCount; i++) {
    const byteIndex = Math.floor((i * 2) / 8)
    const bitOffset = (i * 2) % 8
    const value = (bitfieldBytes[byteIndex]! >> bitOffset) & 0b11
    if (value === 0b00 || value === 0b11) continue // unpicked, or reserved treated as unpicked

    totalCount++ // this position WAS a pick in the sender's payload

    const game = currentGamesSortedById[i] // undefined when i >= current game count
    if (!game) continue // "unknown game id" — schedule shrank past this position; drop, don't apply

    picks[game.id] = value === 0b01 ? game.homeId : game.awayId
    appliedCount++
  }

  return { picks, appliedCount, totalCount }
}
```
`hashMatched = (payloadScheduleHash === currentScheduleHash)` is computed once, separately, and used ONLY to choose banner copy — when it's `true`, `appliedCount === totalCount` always, by construction (matching hash implies matching sorted id list implies every position resolves).

**When to use:** This is the entire SHARE-03 implementation. No separate "mismatch" code path exists or should be written — writing one would duplicate the position-walk logic for no behavioral difference.

### Pattern 2: Generation and "Save a copy" both operate on raw `localStorage`, never a live composable (reuse of Phase 7's established pattern)

**What:** `ScenarioSwitcher.vue`'s new Share action fires for whichever row's icon was clicked — not necessarily the scenario currently mounted under `week/[week].vue`'s `:key="activeScenarioId"` boundary. There is no live `useStorage()` ref for a non-active scenario to read through, exactly the situation Phase 7's `duplicateScenario`/`deleteScenario` already solved.

**When to use:** Reading a specific scenario's picks/decisions for encoding (SHARE-01), and writing a newly-created scenario's picks/decisions after "Save a copy" (D-06).

**Example (mirrors `useScenarios.ts`'s `duplicateScenario`, already in this codebase):**
```typescript
// Generation — week/[week].vue or a small useShareGeneration.ts
function handleShare(scenarioId: string) {
  const picksRaw = localStorage.getItem(scenarioKeys.picks(2026, scenarioId))
  const decisionsRaw = localStorage.getItem(scenarioKeys.manualTiebreakers(2026, scenarioId))
  const picks: Record<number, number> = picksRaw ? JSON.parse(picksRaw) : {}
  const manualDecisions: ConferenceDecisions = decisionsRaw ? JSON.parse(decisionsRaw) : {}
  // NOTE: these are OUR OWN previously-validated writes (usePicksStorage/
  // useManualTiebreakers already enforced shape on the way in) — a bare
  // JSON.parse here is consistent with duplicateScenario's existing raw-copy
  // precedent, which also never re-validates on the way out.

  const code = encodeShareLink({
    games: games.value!.games,
    season: 2026,
    scheduleHash: games.value!.scheduleHash,
    picks,
    manualDecisions
  })
  shareUrl.value = `${window.location.origin}${window.location.pathname}#s=${code}`
}

// Save a copy — after decode succeeded
function handleSaveCopy() {
  const meta = createScenario() // Phase 7's useScenarios(), activates it immediately
  localStorage.setItem(scenarioKeys.picks(2026, meta.id), JSON.stringify(preview.value!.picks))
  if (Object.keys(preview.value!.manualDecisions).length > 0) {
    localStorage.setItem(scenarioKeys.manualTiebreakers(2026, meta.id), JSON.stringify(preview.value!.manualDecisions))
  }
  // Deliberately no useAutoFilledGames write — a saved share-link copy's
  // picks are all treated as user-made, not auto-filled; the share payload
  // never carried provenance and inventing it would misrepresent Fill Week/
  // Fill Season history that never happened in this browser.
  clearShareHash()
  preview.value = null
}
```

### Pattern 3: Preview state is a plain `ref`, not a `useStorage` instance — zero new props on `GameCard.vue`/`StandingsSidebar.vue`

**What:** `GameCard.vue` mutates its `picks` prop in place (`props.picks[game.id] = teamId` / `delete props.picks[game.id]`, no emitted event) and has no read-only concept. 08-UI-SPEC.md documents no new prop for it. The correct read of D-07 ("decoded picks render in a temporary, non-persisted preview state") is that the preview picks object is *itself* an ordinary `Record<number, number>` — it just isn't wrapped in `useStorage`, so nothing about it ever touches `localStorage`. It remains interactively editable during preview (clicking a game in a shared link tweaks the in-memory preview, same as any picks object) — this is a deliberate simplification recommendation, not a gap: it requires zero new component props for `GameCard.vue`, matches the UI-SPEC's total silence on it, and is a reasonable product behavior ("adjust before you save").

**When to use:** Any time `week/[week].vue` has an active, undismissed share-link preview.

**Example:**
```typescript
// app/composables/useSharedPreview.ts (sketch)
export function useSharedPreview(games: Ref<GamesEnvelope | undefined>) {
  const route = useRoute()
  const router = useRouter()

  const shareCode = computed(() => {
    const hash = route.hash // vue-router's route.hash includes the leading '#'
    return hash.startsWith('#s=') ? hash.slice(3) : null
  })

  const preview = ref<{ picks: Record<number, number>, manualDecisions: ConferenceDecisions } | null>(null)
  const bannerVariant = ref<'none' | 'default' | 'mismatch' | 'malformed'>('none')
  const counts = ref<{ applied: number, total: number } | null>(null)

  // Runs once per mount, synchronously — ssr:false means no hydration
  // mismatch risk (VERIFIED via WebSearch: route.hash is safely readable in
  // setup()/onMounted for an SPA with ssr disabled).
  if (shareCode.value && games.value) {
    const result = decodeShareLink(shareCode.value, games.value.games, games.value.scheduleHash)
    if (result.status === 'malformed') {
      bannerVariant.value = 'malformed'
    } else {
      preview.value = { picks: result.picks, manualDecisions: result.manualDecisions }
      counts.value = { applied: result.appliedCount, total: result.totalCount }
      bannerVariant.value = result.hashMatched ? 'default' : 'mismatch'
    }
  }

  function dismiss() {
    bannerVariant.value = 'none'
    preview.value = null
    router.replace({ hash: '' }) // clears #s=... so a refresh doesn't re-trigger
  }

  return { preview, bannerVariant, counts, dismiss }
}
```
`PicksWorkspace.vue` receives `preview` as a new prop; internally:
```typescript
// PicksWorkspace.vue — inside <script setup>, alongside the existing usePicksStorage call
const storedPicks = usePicksStorage(props.scenarioId, props.season)
const picks = computed(() => props.preview ? props.preview.picks : storedPicks.value)
// standings/rankings: when props.preview is set, call resolveAllConferences/
// slateCompletionByConference/applyManualOrdering/computeStandings directly
// (imported from #shared/domain/standings + #shared/domain/tiebreakers/invalidation)
// with props.preview.picks/manualDecisions — the SAME pure functions
// useStandings.ts already calls internally, so no standings math is
// duplicated, only the ~10-line composed-computed wiring useStandings.ts
// itself already does.
```

### Anti-Patterns to Avoid

- **Re-deriving `gameCount` from the current schedule instead of the header:** silently misreads the TLV boundary on any schedule-length change — see Pattern 1.
- **Calling `usePicksStorage(sharedScenarioIdThatDoesNotExist, ...)` to preview a share link:** there is no real scenario id for an unsaved share link; constructing a throwaway `useStorage()` instance for it would write to `localStorage` immediately (`writeDefaults: true` is `useStorage`'s default, confirmed in `useScenarios.ts`'s own docblock) — directly violating D-07's zero-writes requirement.
- **Trusting `games.json`'s array order as the bitpack index:** VERIFIED this session to be unsorted; always `[...games].sort((a, b) => a.id - b.id)` before indexing, matching `scripts/lib/schedule-hash.ts`'s own numeric-sort convention exactly (that file's docblock literally says "This numeric sort order is also the exact ordering Phase 8's share-link bitpack index relies on").
- **Re-validating a scenario's own `localStorage.getItem` output on the generation path:** `usePicksStorage`/`useManualTiebreakers` already validated this data on write; Phase 7's `duplicateScenario` already establishes the precedent of a bare `JSON.parse` on the way out for this exact reason (see Pattern 2's comment).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLV structural validation for the manual-tiebreaker-overrides section | A second, share-link-specific copy of `useManualTiebreakers.ts`'s shape-validation logic | Hoist `isValidOrderedIds`/`validateConferenceDecisions` out of `app/composables/useManualTiebreakers.ts` into `shared/domain/tiebreakers/invalidation.ts` as exported functions; both the composable and `shared/domain/shareLink.ts` import the same implementation | Both need byte-for-byte identical validation (unknown conference names, oversized entry counts, non-integer/duplicate team ids); a second copy is exactly the drift risk Phase 7's RESEARCH.md Pitfall 3 already warned about for storage-key prefixes — the same principle applies to validators |
| Base64/base64url encoding | A hand-written base64 alphabet lookup table and bit-shifter | `btoa`/`atob` + a 3-character-class regex substitution (`+`→`-`, `/`→`_`, strip `=`) | `btoa`/`atob` already do the actual base64 math correctly and universally; the only "custom" part CLAUDE.md's design needs is the URL-safe substitution, which is 2 lines |
| Bit-position packing | A manual byte-array-of-strings or array-of-booleans approach | `Uint8Array` + `DataView` + bitwise shift/mask (`>> `, `&`, `\|=`) | Standard, fast, and exactly what CLAUDE.md's own measured 200-byte figure assumes; anything else either allocates far more memory (array of booleans) or reimplements what `Uint8Array` already is |
| Fingerprint comparison | Re-hashing the current schedule's game-id list client-side to compare against the payload | `parseInt(games.value.scheduleHash, 16) === payloadScheduleHash` (u32 integer comparison) | `scheduleHash` is already computed once at build time and shipped in `games.json`; hashing it again client-side would require porting `scripts/lib/schedule-hash.ts`'s SHA-256 call into the browser for zero benefit — the value is already there to compare directly |

**Key insight:** every piece of "new math" this phase needs (base64, bit-packing, hashing) already has either a Web Platform primitive or an already-computed value sitting in `games.json` — the actual engineering risk is entirely in getting the header/boundary bookkeeping exactly right (Pattern 1) and in not duplicating the standings/validation logic Phases 5–7 already built (Pattern 3, Don't Hand-Roll row 1).

## Runtime State Inventory

> Not applicable — this phase introduces no rename/refactor/migration. It adds new storage-adjacent behavior (reading raw `localStorage` for non-active scenarios) but reuses Phase 7's exact key scheme and creates no new persistent storage category — a saved-copy scenario is a completely ordinary scenario indistinguishable from one created any other way, by design (D-06).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None new — share codes are never persisted to `localStorage`; "Save a copy" writes into the exact same three per-scenario keys (`cfb_picks_*`, `cfb_manual_tiebreakers_*`, and implicitly `cfb_autofilled_*` which stays empty) every other scenario already uses | None |
| Live service config | None — no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no new build-time script | None |

## Common Pitfalls

### Pitfall 1: `games.json`'s array is not id-sorted — the bitpack index must be computed, never assumed

**What goes wrong:** Encoding/decoding using `games.games` in its raw fetched order (rather than sorting by `id` first) silently maps every bit position to the wrong game — a corrupted-looking result that has nothing to do with the schedule actually changing.

**Why it happens:** CFBD's fetch order (whatever order the API returned games in) has no relationship to numeric id order — VERIFIED this session: `public/data/2026/games.json`'s first three raw entries have ids `401856766, 401864494, 401858202` — visibly not ascending.

**How to avoid:** Both `encodeShareLink` and `decodeShareLink` must independently perform `[...games].sort((a, b) => a.id - b.id)` as their very first step — never accept a pre-sorted list as an assumption, and never memoize a sorted copy across calls in a way that could go stale.

**Warning signs:** A share link generated and immediately opened in the SAME browser/session (hash matches, so this should be a no-op round trip) shows different picks than what was shared.

### Pitfall 2: The header needs `gameCount`, or SHARE-03's partial-apply becomes unimplementable

**What goes wrong:** Without an explicit `gameCount` field, decode has no reliable way to know where the picks bitfield ends and the TLV section begins once the current schedule's game count has diverged from the sender's — see Summary and Pattern 1 for the full reasoning.

**How to avoid:** Extend CLAUDE.md's literal 7-byte header to 9 bytes with a `gameCount: u16` field, per Pattern 1. Flagged in Open Questions #1 for confirmation since it is a small deviation from the header bytes as literally written in CLAUDE.md — this research recommends proceeding with it regardless, since D-08/SHARE-03 cannot otherwise be correctly built.

**Warning signs:** A test that changes the "current" schedule's game count (simulating a season correction) between encode and decode produces garbage TLV data or truncated picks instead of a clean "N of M" result.

### Pitfall 3: The size cap (D-10) must reject BEFORE `atob()`, not after

**What goes wrong:** Calling `atob()` (or worse, `JSON.parse` on a decoded TLV value) on an attacker-controlled, deliberately enormous fragment string before any length check wastes CPU/memory on the decode itself — the exact "cheap first gate" D-10 calls for exists specifically to avoid this.

**How to avoid:** Check `shareCode.length > MAX_FRAGMENT_CHARS` as the literal first line of `decodeShareLink`, before any `atob`/bit-unpacking/JSON work. Recommend `MAX_FRAGMENT_CHARS = 6000` — comfortably above the largest realistic payload (a full 888-game bitfield is 222 bytes -> ~296 base64url chars; even a maximal TLV section bounded by `useManualTiebreakers.ts`'s existing `MAX_ENTRIES_PER_CONFERENCE`(32) × 4 conferences × `MAX_IDS_PER_ENTRY`(20) team ids would add only a few KB of JSON), and comfortably below CLAUDE.md's own cited ~8,000-character Safari address-bar ceiling (the tightest mainstream browser limit in its own research table) once the origin+path prefix is accounted for.

**Warning signs:** A crafted `#s=` fragment of e.g. 500,000 characters causes a visible UI freeze on load instead of an instant "This link couldn't be read" banner.

### Pitfall 4: `route.hash` fires before `useGames()`'s data resolves

**What goes wrong:** `useSharedPreview()` needs the current schedule (`games.value.games`, sorted by id) to decode positions — if it runs its decode logic before `useGames()`'s TanStack Query has resolved (first load, network/cache not yet populated), it either crashes on `undefined` or silently no-ops the whole share link.

**Why it happens:** `route.hash` is available synchronously from the very first render (`ssr: false`), but `useGames()`'s `data` is asynchronous even with `staleTime: Infinity` (still async until the first resolution).

**How to avoid:** Gate the decode on `games.value` being defined — e.g. a `watch(games, ..., { immediate: true })` inside `useSharedPreview()`, or simply computing `preview`/`bannerVariant` as `computed`s that read `games.value` reactively rather than doing the decode once eagerly at setup time. This is a real difference from Phase 7's migration logic (which could run synchronously because `localStorage` reads are always synchronous) — schedule data is not.

**Warning signs:** A share link opened on a hard refresh (cold cache) never shows the banner, but the same link opened via in-app navigation (schedule already cached) works fine.

## Code Examples

### base64url encode/decode without a library

```typescript
// shared/domain/shareLink.ts
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) return null // reject anything outside the base64url alphabet up front
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null // atob throws SyntaxError on invalid base64 content even when the regex/padding above look correct
  }
}
```
[VERIFIED: standard `btoa`/`atob` + regex substitution technique, universally supported — no version gate to cite]

### Header read/write via `DataView`

```typescript
const HEADER_BYTES = 9 // version(1) + season(2) + scheduleHash(4) + gameCount(2)

function writeHeader(view: DataView, season: number, scheduleHashHex: string, gameCount: number) {
  view.setUint8(0, 1) // version
  view.setUint16(1, season, false) // big-endian
  view.setUint32(3, parseInt(scheduleHashHex, 16), false)
  view.setUint16(7, gameCount, false)
}

function readHeader(view: DataView) {
  return {
    version: view.getUint8(0),
    season: view.getUint16(1, false),
    scheduleHash: view.getUint32(3, false).toString(16).padStart(8, '0'),
    gameCount: view.getUint16(7, false)
  }
}
```
[VERIFIED: standard `DataView` API, no library]

### 2-bit-per-game pack/unpack

```typescript
function packPick(bytes: Uint8Array, offsetBytes: number, gameIndex: number, value: 0 | 1 | 2) {
  const byteIndex = offsetBytes + Math.floor((gameIndex * 2) / 8)
  const bitOffset = (gameIndex * 2) % 8
  bytes[byteIndex]! |= (value & 0b11) << bitOffset
}

function unpackPick(bytes: Uint8Array, offsetBytes: number, gameIndex: number): number {
  const byteIndex = offsetBytes + Math.floor((gameIndex * 2) / 8)
  const bitOffset = (gameIndex * 2) % 8
  return (bytes[byteIndex]! >> bitOffset) & 0b11
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single-scenario picks, no sharing concept (pre-Phase-8) | Bitpack-encoded, fragment-carried share codes decoded into a temporary preview state | This phase | First time this app parses genuinely untrusted external input (a URL fragment someone else generated) — every other "untrusted input" boundary so far (Phase 7's registry, Phase 6's manual decisions) was the user's own possibly-corrupted `localStorage`, not attacker-supplied data from outside the browser |
| CLAUDE.md's original "fails loudly" mismatch design | 08-CONTEXT.md D-08's "partial apply + report" | Discuss-phase, 2026-08-20 | Requires the `gameCount` header field this research recommends adding (Open Questions #1) — CLAUDE.md's literal header bytes predate this softened requirement |

**Deprecated/outdated:** none — additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The header should be extended to include `gameCount: u16` beyond CLAUDE.md's literal `[version][season][scheduleHash]` layout | Pattern 1, Open Questions #1 | Medium — if the planner/user instead wants to keep the header byte-for-byte as CLAUDE.md states it, SHARE-03's partial-apply behavior needs an alternative design (e.g., skip TLV parsing entirely on any hash mismatch, discarding manual tiebreaker overrides in that case) rather than the unified decode this research recommends. Either is buildable; this research recommends the header extension as strictly better and lower-risk |
| A2 | The preview picks grid renders interactively (editable, not read-only) during a share-link preview | Pattern 3 | Low-medium — 08-UI-SPEC.md documents no read-only visual treatment or new `GameCard.vue` prop, which is the strongest signal for this reading, but it is this research's inference, not an explicit CONTEXT.md decision. If the planner/user actually wants the grid locked read-only during preview, `GameCard.vue` needs a new `readonly` prop (small, contained change) |
| A3 | Committing NEW manual tiebreaker overrides is disabled during an active preview (StandingsSidebar's `commit-ordering` wired to a no-op or hidden), while previewing an already-decoded TLV override is fine | Pattern 3 | Low — this is a narrow edge case (only reachable when a conference's slate is fully picked in the preview AND has an unresolved tie), not covered by 08-UI-SPEC.md at all; recommend scoping it out explicitly rather than leaving it undefined behavior |
| A4 | `happy-dom` (this repo's configured vitest test environment, `20.11.2`) provides global `atob`/`btoa`/`DataView`/`TextEncoder` matching real browser behavior closely enough for `shareLink.ts`'s unit tests to run under it without a separate `node`-environment project | Standard Stack, Validation Architecture | Low — these are all long-standing Web/DOM API surface `happy-dom` is known to implement; worst case a Wave 0 smoke test surfaces a gap early and the fix is a one-line `environment: 'node'` override for just this test file (this repo currently has only ONE vitest project, all `happy-dom`, per `vitest.config.ts`) |
| A5 | `MAX_FRAGMENT_CHARS = 6000` is an appropriate D-10 cap | Pitfall 3 | Low — the number is derived from CLAUDE.md's own cited browser-limit table plus a generous multiple of the measured/realistic payload size; not independently tool-verified this session, easy to tune later without any storage-format implications (it's a pure client-side guard, not part of the wire format) |

## Open Questions (RESOLVED)

1. **Should the header literally add a `gameCount: u16` field (9 bytes total), extending CLAUDE.md's stated 7-byte layout?**
   - What we know: CLAUDE.md's header is described as `[version:u8][season:u16][scheduleHash:u32]`. 08-CONTEXT.md D-08 requires partial-apply-with-count on a schedule mismatch, which this research has determined is not correctly implementable without the decoder knowing the payload's own game count (needed to locate the TLV boundary).
   - What's unclear: whether the planner/user wants a quick explicit re-confirmation of this specific byte-layout change before implementation, given CLAUDE.md frames the header as already "locked."
   - Recommendation: proceed with the 9-byte header (Pattern 1) — it is a strict superset need driven directly by an already-locked CONTEXT.md decision (D-08), not a scope expansion. If the planner wants to avoid touching CLAUDE.md's stated bytes at all, the fallback is: on any `scheduleHash` mismatch, decode ONLY the picks bitfield using the CURRENT schedule's own game count (accept that positions past the shorter of {payload, current} length are silently unusable) and skip TLV parsing entirely (drop manual tiebreaker overrides on any mismatch) — strictly worse (loses tiebreaker overrides on every mismatch, not just when the game count actually changed) but avoids the header byte change.
   - **RESOLVED (orchestrator, 2026-08-20):** Proceed with the 9-byte header. Implemented in 08-01-PLAN.md, with an explicit regression test proving the TLV section survives schedule-length drift.

2. **Does the shared/preview picks grid need a `readonly` visual/interaction mode, or is free editing during preview acceptable?**
   - What we know: 08-UI-SPEC.md documents zero new props or visual treatment for `GameCard.vue`; `GameCard.vue` has no existing read-only concept.
   - What's unclear: whether product intent is "look but don't touch until you save" vs. "feel free to adjust before saving."
   - Recommendation: ship the zero-new-props version (Pattern 3, A2) — editable preview, matching the UI-SPEC's silence and requiring no `GameCard.vue` changes. Cheap to add a `readonly` prop later if UAT surfaces it as confusing.
   - **RESOLVED (orchestrator, 2026-08-20):** Ship the editable, zero-new-props version. Implemented in 08-03-PLAN.md.

## Environment Availability

Not applicable — this phase adds no new external tool, service, or runtime dependency. Same as Phase 7.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` [VERIFIED: package.json], `happy-dom` `20.11.2` environment (single project, per `vitest.config.ts`) |
| Config file | `vitest.config.ts` (project root) — note the existing per-directory coverage threshold on `shared/domain/tiebreakers/**` (90%) and `shared/domain/standings/**` (85%); `shared/domain/shareLink.ts` is a new, similarly risk-sensitive file (it is this phase's SHARE-04 untrusted-input boundary) and should get an equivalent threshold added for `shared/domain/shareLink.ts` at plan time |
| Quick run command | `npx vitest run tests/domain/shareLink.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01 | `encodeShareLink` round-trips picks + manual decisions through `decodeShareLink` unchanged when schedules match | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |
| SHARE-01 | Generating a share link for a NON-active scenario reads that scenario's raw `localStorage`, not the mounted one | unit | `npx vitest run tests/composables/useShareGeneration.test.ts` (or wherever the generation handler lands) | ❌ Wave 0 — new file |
| SHARE-02 | Opening a share link writes zero new/changed `localStorage` keys until `saveCopy()` is called | unit | `npx vitest run tests/composables/useSharedPreview.test.ts` — assert `localStorage` snapshot unchanged pre/post decode, changed only post-`saveCopy` | ❌ Wave 0 — new file |
| SHARE-03 | A payload with a game count larger than the current schedule reports correct N of M and applies only in-bounds picks | unit | `npx vitest run tests/domain/shareLink.test.ts` — this is the Pitfall 1/2 regression test, the highest-value new test in this phase | ❌ Wave 0 — new file |
| SHARE-03 | A payload with a matching `scheduleHash` always yields `appliedCount === totalCount` | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |
| SHARE-04 | A fragment longer than `MAX_FRAGMENT_CHARS` is rejected before any `atob`/JSON work | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |
| SHARE-04 | An out-of-bounds bit position ("unknown game id") is dropped per-pick, not rejecting the whole payload | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |
| SHARE-04 | A structurally invalid TLV section drops overrides only, keeps the picks bitfield | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |
| SHARE-04 | A non-base64url string, or a byte sequence shorter than the header, is `status: 'malformed'` | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ Wave 0 — new file |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/domain/shareLink.test.ts` (plus any touched composable/component test files)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/domain/shareLink.test.ts` — the highest-value new file this phase needs; must include the header-boundary/`gameCount` regression (Pitfall 2) explicitly, since it is the one concrete design gap this research found in CLAUDE.md's original locked layout
- [ ] `tests/composables/useSharedPreview.test.ts` — covers the zero-writes-until-save contract (SHARE-02) and the `route.hash`/`useGames()` timing gate (Pitfall 4)
- [ ] `tests/components/SharedScenarioBanner.test.ts` — covers the three copy/color variants (default/mismatch/malformed) wire correctly to `useSharedPreview()`'s output
- [ ] `tests/components/ShareLinkModal.test.ts` — covers Copy Link button behavior (Clipboard API + manual-select fallback, Claude's Discretion item)
- [ ] Consider adding `shared/domain/shareLink.ts` to `vitest.config.ts`'s `coverage.thresholds` alongside the existing `tiebreakers/**`/`standings/**` entries, given it is this phase's own untrusted-input boundary (ASVS V5) — precedent already set by those two directories
- [ ] Framework install: none — Vitest is already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts (`SCEN-05`, `FOUND-01`), unchanged |
| V3 Session Management | No | No server sessions |
| V4 Access Control | No | Single-browser-profile local data; a share link's "access control" is purely "did you receive the URL," which is out of scope for this app's threat model (same as any URL-based sharing) |
| V5 Input Validation | **Yes — this phase's primary threat surface.** | The decoded share-link payload is the FIRST genuinely externally-supplied (not just possibly-corrupted-by-the-same-user) untrusted input this app has ever parsed. Every byte must be validated before use: fragment length cap (D-10, Pitfall 3) before any decode work; base64url character-set check before `atob`; header length/version check before field reads; per-position bounds check for "unknown game id" (D-12); TLV structural validation reusing the hoisted `validateConferenceDecisions` (Don't Hand-Roll) |
| V6 Cryptography | No | `scheduleHash` is a non-cryptographic drift-detection fingerprint, not a security boundary — same explicit note already made in `shared/domain/tiebreakers/invalidation.ts`'s `decisionHash` docblock ("This is change detection, not a security boundary") applies identically here; no new crypto primitive is introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Deliberately oversized `#s=` fragment (a crafted URL with a multi-hundred-KB string) causing a CPU/memory spike on `atob`/JSON parsing | Denial of Service | `MAX_FRAGMENT_CHARS` pre-decode gate (D-10, Pitfall 3) — checked before ANY decode work, not just before the bitfield unpack |
| Malformed base64url, truncated header, or a `gameCount` implying more bytes than the payload actually contains | Tampering | Structural validation at every decode stage; any structural failure → `status: 'malformed'`, zero partial state applied (D-11) — distinct from a semantically-fine-but-schedule-mismatched payload, which DOES partially apply (D-08) |
| A bit position pointing past the current schedule's bounds (deliberately or via genuine schedule drift) | Tampering | Per-position bounds check drops that one pick ("unknown game id," D-12) without rejecting the whole payload — mirrors `useManualTiebreakers.ts`'s existing per-entry-drop discipline exactly |
| A TLV `value` containing an unknown conference name, oversized entry count, or non-integer/duplicate team ids (a hand-crafted or bit-flipped share code) | Tampering | Reuses the hoisted `validateConferenceDecisions`/`isValidOrderedIds` validators (Don't Hand-Roll) — same caps (`MAX_ENTRIES_PER_CONFERENCE`, `MAX_IDS_PER_ENTRY`) already proven against this exact shape in Phase 6 |
| A share code crafted to make `decodeShareLink` throw an uncaught exception (rather than returning a typed result), crashing the page on load | Tampering / DoS | Every fallible step (base64 decode, header field reads, TLV JSON parse) MUST be wrapped so any exception maps to `status: 'malformed'`, never propagates — this app's established rule (three prior composables already follow "malformed input never crashes, always degrades to a safe default") applies identically here, and this is a HIGHER-stakes instance of it since the input source is external |

This phase's threat surface is genuinely new for this app: previously "untrusted input" meant "the same user's own possibly-corrupted `localStorage`." A share link is the first input that can originate from anyone with a URL — worth treating with the most defensive posture in the codebase so far, even though the actual damage ceiling (client-side-only, no accounts, no server) stays low.

## Sources

### Primary (HIGH confidence)
- `public/data/2026/games.json` — read directly this session; confirmed `scheduleHash: "19c9e609"`, 888 games, raw array NOT sorted by id (Pitfall 1)
- `public/data/2026/teams.json` — read directly; confirmed team id range (2–2751), informing TLV team-id field sizing considerations
- `scripts/lib/schedule-hash.ts` — read directly; confirmed the exact numeric-sort convention (`sort((a,b) => a-b)`) and that it's explicitly documented as "the exact ordering Phase 8's share-link bitpack index relies on"
- `app/composables/useScenarios.ts`, `usePicksStorage.ts`, `useManualTiebreakers.ts`, `useAutoFilledGames.ts`, `useStandings.ts` — read directly this session; confirmed exact signatures, storage-key scheme, `writeDefaults: true` behavior, and the "picks object stays flat specifically for Phase 8" note already left in `useAutoFilledGames.ts`'s own docblock
- `app/components/GameCard.vue`, `ScenarioSwitcher.vue`, `DeleteScenarioModal.vue`, `PicksWorkspace.vue` — read directly; confirmed `GameCard.vue`'s in-place prop mutation (no emitted event) and the Phase 7 Pattern 2 precedent in `ScenarioSwitcher.vue`/`useScenarios.ts`
- `app/pages/week/[week].vue` — read directly; confirmed current `:key="activeScenarioId"` remount boundary and `useScenarios(2026)` call site this phase must extend
- `shared/domain/tiebreakers/invalidation.ts`, `types.ts` — read directly; confirmed `ConferenceDecisions`/`ManualDecisions`/`TeamId` shapes and the existing `decisionHash`/`applyManualOrdering` pure functions this phase reuses unchanged
- `vitest.config.ts` — read directly; confirmed single `happy-dom` project and the existing per-directory coverage-threshold precedent

### Secondary (MEDIUM confidence)
- WebSearch, MDN + TC39 proposal pages — `Uint8Array.prototype.toBase64()`/`fromBase64()` reached Baseline "Newly available" in September 2025, informing the recommendation to use `btoa`/`atob` instead for v1 (Alternatives Considered)
- WebSearch, Vue Router/Nuxt docs summary — `route.hash` includes the leading `#`, is safely readable in setup/`onMounted` for an `ssr: false` SPA with no hydration-mismatch risk (Pattern 3, Pitfall 4)
- `ui.nuxt.com/components/alert`, `ui.nuxt.com/components/input` — fetched live this session for `UAlert`/`UInput` prop/slot surface, confirming compatibility with 08-UI-SPEC.md's stated usage (color/variant/actions/close for `UAlert`; readonly + `#trailing` slot for `UInput`)

### Tertiary (LOW confidence)
- `happy-dom`'s exact `atob`/`btoa`/`DataView` fidelity — not independently verified against the installed `20.11.2` package source this session (Assumption A4); low risk, easy Wave 0 smoke-test catch if wrong

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive used (`btoa`/`atob`, `DataView`, `TextEncoder`) is universally supported and directly verified against this repo's own data (`games.json`, `teams.json`)
- Architecture (Patterns 1–3): MEDIUM-HIGH — Pattern 1 (header/bitfield/TLV design) is HIGH confidence engineering necessity directly derived from CONTEXT.md's own D-08 requirement; Pattern 3 (preview-as-plain-ref) is MEDIUM, a reasoned inference from `GameCard.vue`'s actual mutation contract and 08-UI-SPEC.md's silence, not an explicit locked decision — flagged in Open Questions #2
- Pitfalls: HIGH for Pitfalls 1/2/3 (each independently verified this session — unsorted array, header boundary math, CLAUDE.md's own cited browser limits); MEDIUM for Pitfall 4 (sound reasoning from `useGames()`'s async nature, not independently reproduced with a running dev server this session)

**Research date:** 2026-08-20
**Valid until:** 30 days (stable dependency versions; the one time-sensitive fact — `Uint8Array.toBase64` Baseline status — is worth re-checking at the v2 boundary, not before)
