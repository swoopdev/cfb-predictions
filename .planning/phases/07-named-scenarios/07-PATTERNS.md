# Phase 7: Named Scenarios - Pattern Map

**Mapped:** 2026-08-19
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/composables/useScenarios.ts` | store (registry composable) | CRUD | `app/composables/useManualTiebreakers.ts` (validation/corruption shape) + `app/composables/usePicksStorage.ts` (useStorage wrapper) | role-match (new capability, composed from two analogs) |
| `app/composables/usePicksStorage.ts` (modified) | store | CRUD | itself (signature change only) | exact |
| `app/composables/useAutoFilledGames.ts` (modified) | store | CRUD | itself (signature change only) | exact |
| `app/composables/useManualTiebreakers.ts` (modified) | store | CRUD | itself (signature change only) | exact |
| `app/composables/usePickProgress.ts` (modified) | store (derived) | transform | itself (signature change only) | exact |
| `app/composables/useStandings.ts` (modified) | store (derived) | transform | itself (signature change only) | exact |
| `app/components/ScenarioSwitcher.vue` | component | event-driven | `app/components/PickProgress.vue` (props/composable-consumption shape); UI pattern from RESEARCH.md `USelectMenu` example | role-match, no true `USelectMenu`/dropdown analog exists in codebase yet |
| `app/components/DeleteScenarioModal.vue` | component | event-driven | `app/components/PickProgress.vue` (component conventions: explicit imports, `defineProps`/`defineEmits`); UI pattern from RESEARCH.md `UModal` example | role-match, no `UModal` analog exists in codebase yet |
| `app/pages/week/[week].vue` (modified) | route/page | request-response + event-driven | itself (existing header-controls section, `:key` boundary is new) | exact |
| `app/components/PickProgress.vue` (modified) | component | transform | itself (add `scenarioId` prop) | exact |
| `app/components/PickProgressWeek.vue` (modified — not read this pass, same shape as PickProgress.vue per RESEARCH.md) | component | transform | `app/components/PickProgress.vue` | exact (sibling file, same author pattern) |
| `tests/composables/useScenarios.test.ts` | test | CRUD | `tests/composables/useManualTiebreakers.test.ts` (corruption/validation test shape — not read this pass; inferred from composable's docblock describing test coverage areas) | role-match |

## Pattern Assignments

### `app/composables/useScenarios.ts` (store, CRUD)

**Analog A — corruption-safe `useStorage` wrapper shape:** `app/composables/usePicksStorage.ts` (lines 1-71, read in full)

**Imports pattern** (lines 1-2):
```typescript
import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'
```

**Core `useStorage` + custom serializer pattern** (lines 29-71):
```typescript
export function usePicksStorage(season = 2026): Ref<Record<number, number>> {
  const key = `cfb_picks_${season}`
  const corruptKey = `${key}_corrupt`

  const picks = useStorage<Record<number, number>>(
    key,
    {},
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed as Record<number, number>
            }
            throw new Error('Invalid picks shape: expected plain object')
          } catch {
            // preserve corrupted data under _corrupt key, silent reset, console.debug only
            return {}
          }
        },
        write(v: Record<number, number>) {
          return JSON.stringify(v)
        }
      }
    }
  )

  return picks as Ref<Record<number, number>>
}
```
For `useScenarios`, follow this exact shape for TWO new `useStorage` calls: `cfb_scenarios_2026` (array of `{id, name, createdAt}` — array validation, not object) and `cfb_active_scenario_2026` (a plain string — no custom serializer needed, VueUse's default JSON serializer is fine for a primitive per RESEARCH.md's Anti-Patterns note). Per D-17, use the **silent reset, no `_corrupt` preservation** disposition (see Analog B below), not `usePicksStorage`'s `_corrupt`-preserving disposition — scenario metadata is reconstructible, unlike picks.

**Analog B — array/object shape validation with drop-invalid-entries-not-whole-payload:** `app/composables/useManualTiebreakers.ts` (lines 45-90, `isValidOrderedIds` + `validateConferenceDecisions`)

```typescript
function isValidOrderedIds(value: unknown): value is TeamId[] {
  if (!Array.isArray(value)) return false
  if (value.length > MAX_IDS_PER_ENTRY) return false
  if (!value.every(id => Number.isInteger(id))) return false
  return new Set(value).size === value.length
}

function validateConferenceDecisions(payload: unknown): ConferenceDecisions {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {}
  }
  // ... per-entry validation, drop invalid entries individually, keep the rest
}
```
Apply this exact per-entry-drop discipline to the scenario registry's shape validator per RESEARCH.md's Security Domain V5: verify the parsed value is an array; for each entry, verify `id`/`name`/`createdAt` are the expected primitive types and drop malformed entries individually (not the whole registry); de-duplicate by `id`, keeping first occurrence (defense-in-depth against a hand-edited registry with a repeated id, per RESEARCH.md's Known Threat Patterns table). Top-level "not an array at all" is the only case that resets to a fresh single-scenario default (D-17).

**Silent-reset corruption disposition** (lines 156-158, `useManualTiebreakers.ts`):
```typescript
read(v: string) {
  try {
    const parsed = JSON.parse(v)
    return validateConferenceDecisions(parsed)
  } catch {
    return {}
  }
}
```
Use this disposition (no `_corrupt` key, no console.debug requirement) for both the registry and active-pointer serializers.

**Docblock convention** — both `usePicksStorage.ts` and `useManualTiebreakers.ts` carry substantial JSDoc docblocks above the exported function explaining storage shape, corruption disposition, and cross-references to D-numbers/pitfalls. Follow this convention in `useScenarios.ts`: document D-01 through D-17's storage/migration/recovery decisions inline, referencing RESEARCH.md's Pattern 1/2 and Pitfall 1/3/5 by name since those are the load-bearing constraints this file must satisfy.

**Raw localStorage read/write for duplicate/delete (Pattern 2, not a composable pattern already in the codebase — copy directly from RESEARCH.md's Code Examples section, "Composable signature swap" + "Pattern 2" code block, lines 191-220 of 07-RESEARCH.md):**
```typescript
function duplicateScenario(sourceId: string, season: number): ScenarioMeta {
  const newId = crypto.randomUUID()
  const kinds = ['picks', 'autofilled', 'manual_tiebreakers'] as const
  for (const kind of kinds) {
    const sourceKey = `cfb_${kind}_${season}_${sourceId}`
    const targetKey = `cfb_${kind}_${season}_${newId}`
    const raw = localStorage.getItem(sourceKey)
    if (raw !== null) localStorage.setItem(targetKey, raw)
  }
  const meta: ScenarioMeta = { id: newId, name: `${nameOf(sourceId)} (copy)`, createdAt: new Date().toISOString() }
  registry.value = [...registry.value, meta]
  return meta
}

function deleteScenario(id: string, season: number) {
  if (registry.value.length <= 1) return // D-14 guard
  const kinds = ['picks', 'autofilled', 'manual_tiebreakers'] as const
  for (const kind of kinds) localStorage.removeItem(`cfb_${kind}_${season}_${id}`)
  registry.value = registry.value.filter(s => s.id !== id)
  if (activeScenarioId.value === id) {
    activeScenarioId.value = registry.value[0]!.id // D-16
  }
}
```
**Critical constraint (RESEARCH.md Pitfall 3):** the three key-prefix strings (`cfb_picks_`, `cfb_autofilled_`, `cfb_manual_tiebreakers_`) must not drift between this file and the three composables that build the "live" version of the same keys. Recommend exporting named constants (e.g. `shared/utils/scenarioKeys.ts` or per-composable named exports) that both sides import, per RESEARCH.md's Open Question 1 (either resolution is acceptable — planner's call).

---

### `app/composables/usePicksStorage.ts`, `useAutoFilledGames.ts`, `useManualTiebreakers.ts`, `usePickProgress.ts`, `useStandings.ts` (modified — signature swap only)

**Analog:** each file, itself — RESEARCH.md's exact before/after diff (Code Examples, "Composable signature swap"):

```typescript
// BEFORE
export function usePicksStorage(season = 2026): Ref<Record<number, number>> {
  const key = `cfb_picks_${season}`
  // ...
}

// AFTER
export function usePicksStorage(scenarioId: string, season = 2026): Ref<Record<number, number>> {
  const key = `cfb_picks_${season}_${scenarioId}`
  // ... rest of the corruption-recovery serializer logic unchanged
}
```

Apply the same `(scenarioId: string, season = 2026)` reordering (Pitfall 2 — required param before defaulted param) to all five files' function signatures and their internal `key` string template. **No other logic inside any of these five files changes** — the corruption-recovery serializers, `computed()` derivations, and returned object shapes are untouched. `usePickProgress.ts` (lines 30-31) and `useStandings.ts` (lines 103-106) both internally call `usePicksStorage(season)` / `useManualTiebreakers(season)` — these internal call sites need the same argument threaded through: `usePicksStorage(scenarioId, season)`.

---

### `app/components/ScenarioSwitcher.vue` (component, event-driven)

**Analog (codebase convention — explicit imports, typed props, no auto-import reliance):** `app/components/PickProgress.vue` (lines 1-18, read in full)

```typescript
// `computed` is imported explicitly rather than relying on Nuxt's auto-import,
// so this component mounts under the plain vitest run (which registers no Nuxt
// auto-import plugin) — same pattern as StandingsTable.vue.
import { computed } from 'vue'
import type { Game } from '#shared/types/schedule'
import { usePickProgress } from '~/composables/usePickProgress'
import { usePicksStorage } from '~/composables/usePicksStorage'

interface Props {
  season?: number
  games?: Game[]
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })
```
`ScenarioSwitcher.vue` should follow this same "explicit Vue imports, typed `Props` interface, `defineProps`/`defineEmits`" convention — no analog for `USelectMenu` usage exists in the codebase, so for the dropdown markup itself use RESEARCH.md's Code Examples verbatim (07-RESEARCH.md lines 329-373, the full `USelectMenu` + `item-trailing`/`@click.stop` example). Copy that block directly — it is sourced from the live Nuxt UI docs, not invented.

**Icon convention** — `GameCard.vue` establishes `UIcon name="lucide:*"` (per 07-UI-SPEC.md); new icons needed: `lucide:layers`, `lucide:plus`, `lucide:pencil`, `lucide:copy`, `lucide:trash-2`.

---

### `app/components/DeleteScenarioModal.vue` (component, event-driven)

**Analog:** same as `ScenarioSwitcher.vue` for import/props conventions (`PickProgress.vue`). No `UModal` analog exists in the codebase; use RESEARCH.md's Code Examples verbatim (07-RESEARCH.md lines 378-402, the full `UModal` delete-confirmation example with `#footer="{ close }"` scoped slot). Copy that block directly.

Copy exactly per 07-UI-SPEC.md's Copywriting Contract:
- Title: `Delete "{scenario name}"?`
- Body: `This permanently removes its picks, auto-fill history, and tiebreaker decisions. This can't be undone.`
- Confirm button: `Delete scenario` (`color="error"`)
- Cancel button: `Cancel` (`color="neutral"`, `variant="ghost"`)

---

### `app/pages/week/[week].vue` (modified)

**Analog:** itself — read in full (lines 1-326). Two structural additions on top of the existing pattern:

**1. Header controls insertion point** (existing pattern, lines 146-166 — the "Season Controls" `<div class="flex flex-wrap items-center gap-4 mb-6">` block housing Fill Season/Clear Season `UButton`s). Per D-07, `ScenarioSwitcher` slots into this exact same row/section, unkeyed (must survive scenario switches).

**2. `:key="activeScenarioId"` remount boundary (new pattern — RESEARCH.md Pattern 1, 07-RESEARCH.md lines 162-182):**
```vue
<script setup lang="ts">
const { scenarios, activeScenarioId } = useScenarios(2026)
</script>

<template>
  <div>
    <ScenarioSwitcher v-model="activeScenarioId" :scenarios="scenarios" />

    <div :key="activeScenarioId">
      <PicksWorkspace :scenario-id="activeScenarioId" :season="2026" :week="week" />
    </div>
  </div>
</template>
```
Existing call sites to rewire under the `:key` boundary (`week/[week].vue` lines 19-20, 101):
```typescript
const picks: Ref<Record<number, number>> = usePicksStorage(2026)
const { autoFilled, markAutoFilled } = useAutoFilledGames(2026)
// ...
const { standings, rankings, slateComplete, commitOrdering } = useStandings(2026)
```
become `usePicksStorage(activeScenarioId, 2026)`, `useAutoFilledGames(activeScenarioId, 2026)`, `useStandings(activeScenarioId, 2026)` — and per RESEARCH.md Open Question 2, the planner should decide whether these calls stay inline in the page (small diff, `:key` on a wrapping `<div>`) or move into an extracted `PicksWorkspace.vue` child (cleaner, more testable, matches the diagram in RESEARCH.md). Either is consistent with this analog.

**`useGames`/`useTeams` stay outside the `:key` boundary** — they are not scenario-scoped (RESEARCH.md, architecture diagram note).

---

### `app/components/PickProgress.vue` (modified)

**Analog:** itself (lines 1-52, read in full). Add a `scenarioId: string` prop alongside the existing `season?: number` prop, and thread it into the internal composable calls:

```typescript
interface Props {
  season?: number
  scenarioId: string  // NEW — no default, required (mirrors composable signature's required-first pattern)
  games?: Game[]
}

const props = withDefaults(defineProps<Props>(), { season: 2026 })

const picks = usePicksStorage(props.scenarioId, props.season)
const { progressOverall } = usePickProgress(props.scenarioId, props.season)
```
`PickProgressWeek.vue` (not read this pass, per RESEARCH.md's Recommended Project Structure it takes the identical `props.season` shape) needs the identical addition.

---

## Shared Patterns

### `useStorage` + custom serializer for corruption recovery
**Source:** `app/composables/usePicksStorage.ts` lines 33-68, `app/composables/useManualTiebreakers.ts` lines 146-165
**Apply to:** `useScenarios.ts`'s two new `useStorage` calls (registry, active pointer)
```typescript
const store = useStorage<T>(key, defaultValue, localStorage, {
  serializer: {
    read(v: string) {
      try {
        const parsed = JSON.parse(v)
        return validateShape(parsed) // per-entry drop, not whole-payload reset, where shape is a collection
      } catch {
        return defaultValue // silent reset, no error banner (D-17)
      }
    },
    write(v: T) { return JSON.stringify(v) }
  }
})
```

### Composable signature order: required param before defaulted param
**Source:** RESEARCH.md Pitfall 2, applied identically across all five existing composables
**Apply to:** every modified composable file
```typescript
export function useX(scenarioId: string, season = 2026) { /* ... */ }
```

### `:key`-remount, never a reactive `useStorage` key, across scenario switches
**Source:** RESEARCH.md Pattern 1 / Pitfall 1 (verified defect, reproduced against installed `@vueuse/core@14.4.0`)
**Apply to:** `app/pages/week/[week].vue`'s new keyed boundary; any future component that mounts scenario-scoped composables
```vue
<div :key="activeScenarioId">
  <!-- usePicksStorage/useAutoFilledGames/useManualTiebreakers/useStandings/usePickProgress calls live here -->
</div>
```
**Never** pass `activeScenarioId` as a `computed`/reactive `key` argument into a single long-lived `useStorage()` call for object/array-valued state — this silently leaks the previous scenario's data into a new, not-yet-persisted scenario (see RESEARCH.md's reproduced test, 07-RESEARCH.md lines 265-283).

### Explicit Vue imports (no auto-import reliance) in components
**Source:** `app/components/PickProgress.vue` line 5 comment, mirrored in `StandingsTable.vue`
**Apply to:** `ScenarioSwitcher.vue`, `DeleteScenarioModal.vue`
```typescript
import { computed } from 'vue'
```
This is required for these components to mount under the plain (non-Nuxt) vitest project.

### Docblock convention for composables carrying non-obvious D-number/pitfall rationale
**Source:** `app/composables/useManualTiebreakers.ts` lines 92-142, `app/composables/useStandings.ts` lines 16-101
**Apply to:** `useScenarios.ts` — document D-01 through D-17 and RESEARCH.md's Pattern 1/2, Pitfall 1/3/5 inline above the exported function, exactly as the tiebreaker/standings composables document their own decision provenance.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `USelectMenu` markup itself (inside `ScenarioSwitcher.vue`) | UI widget usage | event-driven | No `USelectMenu` used anywhere in `app/` yet (confirmed by both CONTEXT.md D-08/D-12 and RESEARCH.md) — use RESEARCH.md's live-docs-sourced Code Example verbatim, not a codebase analog |
| `UModal` markup itself (inside `DeleteScenarioModal.vue`) | UI widget usage | event-driven | Same — no confirm-modal pattern exists anywhere in the codebase (CONTEXT.md D-12 explicitly notes a grep for `window.confirm`/`UModal` found nothing); use RESEARCH.md's Code Example verbatim |
| `tests/composables/useScenarios.test.ts` | test | CRUD | New composable, no prior scenario-registry test exists; base its shape on `tests/composables/useManualTiebreakers.test.ts`'s corruption/validation test structure (not read this pass — recommend planner/executor read it directly when writing this test file) |

## Metadata

**Analog search scope:** `app/composables/`, `app/components/`, `app/pages/week/`
**Files scanned:** 7 composables + 2 components + 1 page (all read in full this pass)
**Pattern extraction date:** 2026-08-19
