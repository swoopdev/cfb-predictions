# Phase 8: Share Links - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `shared/domain/shareLink.ts` | service/utility (pure codec) | transform (binary encode/decode, untrusted-input validation) | `app/composables/useScenarios.ts`'s `validateRegistry`/`isValidScenarioMeta` + `shared/domain/tiebreakers/invalidation.ts`'s `validateConferenceDecisions` | role-match (validation discipline); no existing binary-codec analog exists in-repo (RESEARCH's own code examples are the primitive-level reference) |
| `shared/domain/tiebreakers/invalidation.ts` (modified — hoist `isValidOrderedIds`/`validateConferenceDecisions` to exported) | utility | transform | itself (pre-existing file, `applyManualOrdering`/`decisionHash` already exported from it) | exact (same file, additive export) |
| `app/composables/useSharedPreview.ts` | provider/composable | request-response (route.hash → decode → reactive preview state) | `app/composables/useScenarios.ts` (registry/active-pointer composable shape, `season=2026` default, synchronous self-healing pattern) | role-match |
| `app/components/ShareLinkModal.vue` | component (modal) | request-response (display + copy action) | `app/components/DeleteScenarioModal.vue` | exact |
| `app/components/SharedScenarioBanner.vue` | component (banner) | request-response (display + dismiss/save-copy actions) | none existing in repo (first `UAlert` usage) — closest structural analog is `DeleteScenarioModal.vue` for prop/emit shape | role-match (no banner precedent; prop/emit convention borrowed) |
| `app/components/ScenarioSwitcher.vue` (modified — add Share row action) | component | event-driven (emit) | itself (existing rename/duplicate/delete `UButton` row actions) | exact |
| `app/components/PicksWorkspace.vue` (modified — new optional `preview` prop) | component | CRUD (picks read/write) | itself (existing `usePicksStorage`/`useStandings` wiring) | exact |
| `app/pages/week/[week].vue` (modified — mount `useSharedPreview`, wire banner/modal) | route/page | request-response | itself (existing `useScenarios`/`ScenarioSwitcher`/`DeleteScenarioModal` wiring, Phase 7) | exact |

## Pattern Assignments

### `shared/domain/shareLink.ts` (service, transform)

**Analog:** `app/composables/useScenarios.ts` (validation/corruption-disposition pattern) + `shared/domain/tiebreakers/invalidation.ts` (per-entry-drop discipline) + `scripts/lib/schedule-hash.ts` (sort convention)

**Imports pattern** — this file lives in `shared/domain/`, so it must NOT import from `app/` (established convention, confirmed by RESEARCH.md and by `shared/domain/tiebreakers/types.ts`'s docblock). It imports only from other `shared/` modules and Web Platform APIs:
```typescript
import type { ConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import { validateConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import type { Game } from '#shared/types/schedule'
```

**Sort-before-index pattern** (from `scripts/lib/schedule-hash.ts` lines 13-17):
```typescript
export function computeScheduleHash(gameIds: number[]): string {
  const sorted = [...gameIds].sort((a, b) => a - b)
  const input = sorted.join(',')
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}
```
`shareLink.ts` must reuse the exact same `[...games].sort((a, b) => a.id - b.id)` numeric-sort convention as its bitpack index — the docblock explicitly says this ordering is shared with Phase 8.

**Per-entry-drop validation pattern** (from `shared/domain/tiebreakers/invalidation.ts` lines 65-91, `validateConferenceDecisions`):
```typescript
function validateConferenceDecisions(payload: unknown): ConferenceDecisions {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {}
  }
  const result: Record<string, ManualDecisions> = {}
  for (const [conference, entries] of Object.entries(payload as Record<string, unknown>)) {
    if (!P4_CONFERENCE_NAMES.has(conference)) continue
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) continue
    const entryPairs = Object.entries(entries as Record<string, unknown>)
    if (entryPairs.length > MAX_ENTRIES_PER_CONFERENCE) continue // drop the whole conference
    const validEntries: Record<string, readonly TeamId[]> = {}
    for (const [hash, ids] of entryPairs) {
      if (isValidOrderedIds(ids)) validEntries[hash] = ids
      // else: drop this one entry silently
    }
    result[conference] = validEntries
  }
  return result as ConferenceDecisions
}
```
`shareLink.ts`'s TLV decode should call this SAME function (imported, per Don't Hand-Roll in RESEARCH.md) rather than reimplementing it — requires hoisting it to an exported name in `invalidation.ts` first (currently module-private, lines 46 and 65).

**Corruption-disposition / never-throw pattern** (from `useScenarios.ts` lines 111-124, the `useStorage` serializer):
```typescript
serializer: {
  read(v: string) {
    try {
      const parsed = JSON.parse(v)
      return validateRegistry(parsed)
    } catch {
      return []
    }
  },
  write(v: ScenarioMeta[]) {
    return JSON.stringify(v)
  }
}
```
`decodeShareLink` must follow the same "any parse failure returns a safe typed result, never throws" discipline — wrap `atob`/`DataView` reads/`JSON.parse` so every fallible step maps to `{ status: 'malformed' }` (per RESEARCH.md's `fromBase64Url` sketch, which already returns `null` on `atob` throw rather than propagating).

**Base64url / DataView / bit-pack primitives** (from RESEARCH.md Code Examples — no existing in-repo analog, use directly as sketched):
```typescript
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
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
```

---

### `shared/domain/tiebreakers/invalidation.ts` (modified)

**Analog:** itself — additive change only.

**Change:** export `isValidOrderedIds` and `validateConferenceDecisions` (currently module-private at lines 46 and 65) so both `app/composables/useManualTiebreakers.ts` (existing caller, update its own copy to import instead of redefine) and the new `shared/domain/shareLink.ts` import the same implementation. `MAX_ENTRIES_PER_CONFERENCE`/`MAX_IDS_PER_ENTRY`/`P4_CONFERENCE_NAMES` constants currently live in `useManualTiebreakers.ts` (lines 8, 16, 23) — these need to move alongside the hoisted functions since the validators reference them.

---

### `app/composables/useSharedPreview.ts` (composable, request-response)

**Analog:** `app/composables/useScenarios.ts`

**Imports pattern** (mirrors lines 1-6 of `useScenarios.ts`):
```typescript
import { ref, computed } from 'vue'
import { decodeShareLink } from '#shared/domain/shareLink'
import type { ConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
```

**Composable shape / `season` default parameter pattern** (from `useScenarios.ts` line 103, `useStandings.ts` line 106):
```typescript
export function useScenarios(season = 2026) { ... }
export function useStandings(scenarioId: string, season = 2026) { ... }
```
`useSharedPreview` should take a `games` ref (from `useGames()`, already resolved by the caller) as an argument rather than calling `useGames()` internally a second time — matches `useStandings.ts`'s pattern of composing already-fetched query data rather than re-fetching (lines 108-109).

**Zero-write-until-explicit-action pattern** — the critical anti-pattern flagged in RESEARCH.md: `useStorage()` defaults to `writeDefaults: true` and synchronously persists on construction (documented explicitly in `useScenarios.ts`'s own docblock, lines 92-97: "checking for a null registry key AFTER construction would always read false"). `useSharedPreview`'s preview state MUST be a plain `ref()`, never a `useStorage()` call, to honor D-07's zero-localStorage-writes-until-save-a-copy contract.

**Reactive gate on async query data** (`ready` computed pattern, `useStandings.ts` line 112):
```typescript
const ready = computed(() => Boolean(games.value?.games && teams.value))
```
`useSharedPreview` needs an equivalent gate — decode must not run until `games.value` resolves (Pitfall 4), so wire it as a `computed`/`watch` over the passed-in `games` ref, not a one-shot synchronous read at setup time.

---

### `app/components/ShareLinkModal.vue` (component, request-response)

**Analog:** `app/components/DeleteScenarioModal.vue` (full file, 40 lines — read entirely, reproduced below)

```vue
<script setup lang="ts">
interface Props {
  open: boolean
  scenarioName: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [boolean]
  'confirm': []
}>()
</script>

<template>
  <UModal
    :open="props.open"
    :title="`Delete &quot;${props.scenarioName}&quot;?`"
    @update:open="v => emit('update:open', v)"
  >
    <template #body>
      <p class="text-sm">
        This permanently removes its picks, auto-fill history, and tiebreaker decisions. This can't be undone.
      </p>
    </template>
    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="ghost" @click="close" />
      <UButton label="Delete scenario" color="error" @click="() => { emit('confirm'); close() }" />
    </template>
  </UModal>
</template>
```

**Apply to `ShareLinkModal.vue`:** same `open`/title-interpolation prop shape (`scenarioName` prop → `Share "{scenario name}"` title per 08-UI-SPEC.md), same `update:open` emit wiring, same `#body`/`#footer` slot structure. Differs in content: body has a `UInput` (read-only, `select-all` on focus per UI-SPEC) instead of a confirmation paragraph, and the single footer action is "Copy Link" (`color="primary"`, `variant="solid"`, icon swap `lucide:copy` → `lucide:check` on success, ~2s revert — mirrors `GameCard.vue`'s existing checkmark-swap precedent per UI-SPEC line 94) instead of Cancel/Delete.

---

### `app/components/SharedScenarioBanner.vue` (component, request-response)

**Analog:** No existing `UAlert` usage in the codebase (first this phase, confirmed by UI-SPEC's registry-safety scan). Structural analog for prop/emit conventions: `DeleteScenarioModal.vue`'s `defineProps`/`defineEmits` shape.

**Prop/emit shape to follow:**
```typescript
interface Props {
  variant: 'default' | 'mismatch' | 'malformed'
  appliedCount?: number
  totalCount?: number
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'save-copy': []
  'dismiss': []
}>()
```
Three copy/color variants per 08-UI-SPEC.md's Copywriting Contract (lines 96-98): `info`/`warning`/`error` (Nuxt UI semantic colors, matching icons `lucide:info`/`lucide:triangle-alert`/`lucide:circle-x`). "Save a copy" action omitted entirely for the `malformed` variant (no valid decoded state to save).

---

### `app/components/ScenarioSwitcher.vue` (modified — add Share row action)

**Analog:** itself, lines 113-143 (existing rename/duplicate/delete `UButton` row actions in the `#item-trailing` slot)

```vue
<UButton
  icon="lucide:copy"
  size="xs"
  color="neutral"
  variant="ghost"
  class="size-8"
  :aria-label="`Duplicate ${item.name}`"
  @click.stop="emit('duplicate', item.id)"
/>
```

**Apply:** add a fourth `UButton` following this exact shape — `icon="lucide:share-2"`, `color="neutral"`, `variant="ghost"`, `class="size-8"`, `:aria-label="`Share ${item.name}`"`, `@click.stop="emit('share', item.id)"` — positioned per D-01 "alongside the existing rename/duplicate/delete icons." Add `'share': [id: string]` to the `defineEmits<{}>()` block (lines 34-40), matching the existing `'duplicate': [id: string]` entry exactly.

---

### `app/components/PicksWorkspace.vue` (modified — new optional `preview` prop)

**Analog:** itself, lines 48-53 (existing `usePicksStorage`/`useStandings` composable wiring)

```typescript
const picks = usePicksStorage(props.scenarioId, props.season)
const { autoFilled, markAutoFilled } = useAutoFilledGames(props.scenarioId, props.season)
const { standings, rankings, slateComplete, commitOrdering } = useStandings(props.scenarioId, props.season)
```

**Apply:** add optional prop `preview: { picks: Record<number, number>, manualDecisions: ConferenceDecisions } | null` (default `null`). When `props.preview` is set, bypass `usePicksStorage`/`useStandings`'s internal composables and instead call the underlying pure functions directly with `props.preview.picks`/`props.preview.manualDecisions` — the SAME functions `useStandings.ts` already imports (`resolveAllConferences`, `slateCompletionByConference`, `applyManualOrdering`, `computeStandings`, all from `#shared/domain/standings` and `#shared/domain/tiebreakers/invalidation`, per `useStandings.ts` lines 3-10). `GameCard.vue` (which mutates its `picks` prop in place, no emitted event — confirmed, no changes needed there) and `StandingsSidebar.vue` receive the resulting `picks`/`standings` identically regardless of source, requiring zero changes to either.

---

### `app/pages/week/[week].vue` (modified — wire `useSharedPreview`, banner, modal)

**Analog:** itself, lines 21-33 (existing `useScenarios`/delete-modal-state wiring, Phase 7)

```typescript
const { scenarios, activeScenarioId, createScenario, renameScenario, duplicateScenario, deleteScenario } = useScenarios(2026)

const deleteTarget = ref<{ id: string, name: string } | null>(null)
const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => { if (!v) deleteTarget.value = null }
})
function handleDeleteRequest(id: string) {
  const target = scenarios.value.find(s => s.id === id)
  if (target) deleteTarget.value = { id: target.id, name: target.name }
}
```

**Apply:** follow the identical "bridge a per-row emit id onto a modal's open/name contract" pattern for `handleShare(id)` → `ShareLinkModal.vue`'s `open`/`scenarioName`/generated-URL props. Mount `useSharedPreview(games)` at the page's unkeyed top level (alongside `useScenarios`, not inside `PicksWorkspace`, since the banner renders above `PicksWorkspace` per D-05) and pass its `preview` output down through `PicksWorkspace`'s new prop, following the same one-way prop-down/emit-up wiring already used for `scenarios`/`activeScenarioId` (template lines 136-147) and the `PicksWorkspace` binding (lines 162-180).

**Generation/save-a-copy raw-`localStorage` pattern** (from `useScenarios.ts` lines 218-267, `duplicateScenario`/`deleteScenario` — the exact Phase 7 "Pattern 2" precedent for acting on a non-active scenario):
```typescript
function duplicateScenario(id: string): ScenarioMeta | undefined {
  const source = registry.value.find(s => s.id === id)
  if (!source) return undefined
  const keyPairs: Array<[string, string]> = [
    [scenarioKeys.picks(season, id), scenarioKeys.picks(season, newId)],
    [scenarioKeys.autofilled(season, id), scenarioKeys.autofilled(season, newId)],
    [scenarioKeys.manualTiebreakers(season, id), scenarioKeys.manualTiebreakers(season, newId)]
  ]
  for (const [sourceKey, targetKey] of keyPairs) {
    const raw = localStorage.getItem(sourceKey)
    if (raw !== null) localStorage.setItem(targetKey, raw)
  }
  ...
}
```
Share generation (reading a possibly-non-active scenario's picks/decisions) and "Save a copy" (writing a newly-created scenario's picks/decisions) must both use `scenarioKeys.picks(season, id)`/`scenarioKeys.manualTiebreakers(season, id)` via raw `localStorage.getItem`/`setItem`, exactly like this — never constructing a live `usePicksStorage`/`useManualTiebreakers` instance for a scenario id that isn't the currently-mounted one (RESEARCH.md's explicit Anti-Pattern warning, since `useStorage`'s `writeDefaults: true` would immediately persist a phantom default).

---

## Shared Patterns

### Untrusted-input validation: never throw, always return a safe typed default
**Source:** `app/composables/useScenarios.ts` lines 111-124 (`useStorage` serializer `try/catch` → `[]`); `shared/domain/tiebreakers/invalidation.ts` lines 65-91 (`validateConferenceDecisions`, per-entry drop)
**Apply to:** `shared/domain/shareLink.ts`'s entire `decodeShareLink` — every fallible step (base64 decode, header field reads, TLV JSON parse) wrapped so any exception maps to `{ status: 'malformed' }`, never propagates. This is the THIRD instance of this exact precedent in the codebase (`usePicksStorage`, `useManualTiebreakers`/`useScenarios`, now `shareLink.ts`) — degrade gracefully, no crash.

### Per-entry drop, not whole-payload rejection
**Source:** `shared/domain/tiebreakers/invalidation.ts` lines 76-85 (a violating conference dropped in full; a violating entry inside an otherwise-valid conference dropped alone)
**Apply to:** `decodeShareLink`'s unknown-game-id handling (D-12: drop that one bit's game, count against "N of M", keep the rest of the payload) and TLV structural-invalidity handling (D-11 semantics for the overrides section specifically — drop overrides only, keep the picks bitfield).

### Raw `localStorage` access via `scenarioKeys`, never a live composable, for a non-active scenario
**Source:** `app/composables/useScenarios.ts` lines 218-267 (`duplicateScenario`/`deleteScenario`), `app/utils/scenarioKeys.ts` (the single key-builder source of truth)
**Apply to:** Share generation (`handleShare`) and "Save a copy" (`handleSaveCopy`) in `week/[week].vue` — both operate on a scenario id that may not be `activeScenarioId`.

### `UModal` confirmation/detail-surface pattern
**Source:** `app/components/DeleteScenarioModal.vue` (full file)
**Apply to:** `ShareLinkModal.vue` — same `open`/`update:open` prop-emit contract, `#body`/`#footer` slot structure.

### Per-row icon-button action in `ScenarioSwitcher.vue`
**Source:** `app/components/ScenarioSwitcher.vue` lines 113-143
**Apply to:** the new Share action — identical `UButton` prop set (`size="xs"`, `color="neutral"`, `variant="ghost"`, `class="size-8"`, `@click.stop`).

### `season = 2026` default parameter, scenario-scoped composable shape
**Source:** `app/composables/useScenarios.ts` line 103, `app/composables/useStandings.ts` line 106
**Apply to:** `useSharedPreview.ts`'s function signature.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shared/domain/shareLink.ts`'s binary codec internals (base64url, `DataView` header, bit-packing) | utility | transform | No existing binary-encoding code in this repo — every prior `shared/domain/` file operates on JSON-shaped objects, not raw bytes. Use RESEARCH.md's Code Examples section directly (Web Platform primitives only, no library) rather than an in-repo analog. |
| `SharedScenarioBanner.vue` | component | request-response | First `UAlert` usage in the codebase (confirmed via grep in 08-UI-SPEC.md's Design System scan) — no existing banner component to copy layout from; only prop/emit conventions borrowed from `DeleteScenarioModal.vue`. |

## Metadata

**Analog search scope:** `app/components/`, `app/composables/`, `shared/domain/`, `app/utils/`, `scripts/lib/`
**Files scanned:** `ScenarioSwitcher.vue`, `DeleteScenarioModal.vue`, `useScenarios.ts`, `useManualTiebreakers.ts`, `useStandings.ts`, `PicksWorkspace.vue`, `week/[week].vue`, `scenarioKeys.ts`, `schedule-hash.ts`, `shared/domain/tiebreakers/invalidation.ts`
**Pattern extraction date:** 2026-08-20
