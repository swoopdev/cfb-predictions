# Phase 7: Named Scenarios - Research

**Researched:** 2026-08-19
**Domain:** Client-side multi-instance state management (VueUse `useStorage` scoping) + Nuxt UI 4 `USelectMenu`/`UModal`
**Confidence:** HIGH on the VueUse `useStorage` findings (verified directly against the installed package source and reproduced empirically in this repo's own vitest environment); MEDIUM on the Nuxt UI 4 component APIs (official docs fetched, not cross-checked against the installed package's own `.d.ts`); MEDIUM on the composable-refactor architecture (my own synthesis, grounded in the verified findings and the existing codebase's own patterns).

## Summary

The single most important fact this research surfaces is a **verified, reproduced defect in VueUse's `useStorage` reactive-key feature** that directly threatens the "safely refactor without breaking things" half of this phase's brief: if the five composables are converted to accept a scenario id by making the storage `key` argument a `computed`/reactive ref and swapping it in place, switching between two scenarios that are both new/empty **leaks the previous scenario's picks into the new one**, both in memory and in `localStorage`. This is not a hypothetical — it was reproduced against the exact installed version (`@vueuse/core@14.4.0`) with a real vitest test in this repo. The safe pattern is the opposite of what the reactive-key feature invites: construct a **brand-new `useStorage()` call per scenario id** (never reuse one instance across a key change) so each gets its own unshared default object. The cleanest way to force that in Vue's component model is a `:key="activeScenarioId"` remount boundary around the picks-dependent subtree of `week/[week].vue`, not a manually memoized cache.

The second finding is a concrete signature design for the five composables. `season` currently defaults to `2026` and is the only axis; adding `scenarioId` as a *second* parameter after a defaulted one is a TypeScript ergonomics trap (a caller who wants the `season` default can no longer omit it). The research recommends **swapping the argument order** — `scenarioId` required and first, `season = 2026` second — which the compiler then enforces at every call site (a missing scenario id becomes a build error, not a runtime bug), and keeps `season`'s default useful in the still-single-season v1 app.

Third, Nuxt UI 4's `USelectMenu` and `UModal` both have the exact slot surface `07-CONTEXT.md`/`07-UI-SPEC.md` assume: `item-trailing` for the inline rename/duplicate/delete icon buttons per row, and `UModal`'s `#footer="{ close }"` scoped slot for the delete-confirmation's confirm/cancel buttons.

**Primary recommendation:** Build one new composable, `useScenarios(season)`, owning the registry (`cfb_scenarios_2026`), the active-scenario pointer (`cfb_active_scenario_2026`), migration (D-03), and all CRUD actions (D-10 through D-16) via **raw `localStorage` reads/writes for the other-scenario per-kind keys** (duplicate/delete must touch scenarios that are not necessarily mounted). Reorder the five existing composables to `(scenarioId, season = 2026)` and thread `activeScenarioId` down from `week/[week].vue` through a `:key`-remounted child boundary — never through a reactive `useStorage` key.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scenario registry (list, active pointer) | Browser / Client | — | Pure localStorage state, no server exists; `useScenarios()` composable |
| Scenario switcher UI (`USelectMenu`) | Browser / Client | — | Renders in `week/[week].vue`'s existing header controls, per D-07 |
| Delete confirmation (`UModal`) | Browser / Client | — | Client-only confirmation dialog, no network round-trip |
| Per-scenario picks/autofill/tiebreaker storage | Browser / Client | — | Existing `useStorage`-backed composables, extended with a scenario axis |
| Migration of legacy `cfb_picks_2026` | Browser / Client | — | One-time read-and-copy on first load, entirely in-browser |
| Standings/tiebreaker computation | Browser / Client | — | Pure `computed()` derivation already scoped to the browser tier (Phase 5/6); unaffected by this phase except for reading scenario-scoped picks |

No API/backend, CDN, or database tier exists in this app (`FOUND-01`) — every capability in this phase lives entirely client-side.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCEN-01 | User can create multiple named prediction scenarios, each with its own independent set of picks | `useScenarios().createScenario()` + per-scenario-id-suffixed storage keys (D-02); verified `useStorage` isolation pattern (Pitfall 1) prevents cross-scenario leakage |
| SCEN-02 | User can switch between saved scenarios | `USelectMenu` v-model bound to `activeScenarioId` (D-08/D-09) + `:key` remount pattern (Pattern 1) for instant, correct re-scoping |
| SCEN-03 | User can rename or delete a saved scenario, with confirmation required for delete | `USelectMenu` `item-trailing` slot for inline rename input + `UModal` confirm/cancel footer slot (Code Examples) |
| SCEN-04 | User can duplicate an existing scenario under a new name | `useScenarios().duplicateScenario()` — raw `localStorage` copy across all three per-scenario key kinds (Pattern 2), since the source scenario may not be mounted |
| SCEN-05 | No account or login is required to create or save scenarios | Entire feature is `localStorage`-only, consistent with `FOUND-01`/PROJECT.md's no-backend constraint; nothing in this research introduces a server dependency |
</phase_requirements>

## Standard Stack

### Core

No new packages this phase. Everything needed is already a direct or transitive dependency:

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vueuse/core` | `14.4.0` [VERIFIED: package.json + npm registry] | `useStorage` — same wrapper every other persisted composable in this app already uses | Established pattern (D-17/CLAUDE.md); no alternative under consideration |
| `@nuxt/ui` | `4.10.0` [VERIFIED: package.json + npm registry] | `USelectMenu` (switcher), `UModal` (delete confirm) | First-party, already in the locked stack; `07-UI-SPEC.md` Registry Safety confirms no new registry gate applies |
| `crypto.randomUUID()` (Web Platform API) | Baseline widely available since 2022 (Chrome 92+, Firefox 95+, Safari 15.4+) [CITED: developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID] | Scenario `id` generation (D-01, Claude's Discretion item 1) | Zero-dependency, native, requires a secure context (HTTPS or `localhost`) — satisfied by both dev (`localhost`) and Cloudflare Pages prod (HTTPS) |

### Supporting

None. `UIcon name="lucide:*"` icons (`lucide:layers`, `lucide:plus`, `lucide:pencil`, `lucide:copy`, `lucide:trash-2`) are already available via `@iconify-json/lucide`, already a direct dependency.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.randomUUID()` | `uuid` npm package | Adds a dependency for something the platform already provides natively; no v1 justification |
| `crypto.randomUUID()` | timestamp-based id (`Date.now().toString(36)`) | Also viable per CONTEXT.md's Claude's Discretion — collision risk is near-zero for a single-user local app either way; `crypto.randomUUID()` is the more idiomatic, self-documenting choice and costs nothing |
| `:key`-remount for scenario switching | Manually memoized `Map<scenarioId, ref>` cache | Viable fallback (see Pitfall 1) but requires calling side-effecting composables (`useStorage`, which registers a `storage` event listener) from inside a `computed` getter or an imperative cache-population function — more code, more surface for the exact bug this research found, for no benefit at this app's scale |

**Installation:** none required.

**Version verification:** confirmed via `npm view @vueuse/core version` → `14.4.0`, `npm view @nuxt/ui version` → `4.10.0`, matching the exact versions already pinned in `package.json` and resolved in `pnpm-lock.yaml`. No upgrade needed for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new packages — every capability is built from already-installed, already-audited dependencies (`@vueuse/core`, `@nuxt/ui`) plus a native Web Platform API (`crypto.randomUUID`). No `npm install` step exists in this phase's plan.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  week/[week].vue  (page, unkeyed top-level scope)        │
                    │                                                          │
                    │  const { scenarios, activeScenarioId,                   │
                    │          createScenario, renameScenario,                │
                    │          duplicateScenario, deleteScenario }             │
                    │        = useScenarios(2026)   ◄── runs migration (D-03) │
                    │                                     + corruption/empty  │
                    │                                     recovery (D-05/D-17)│
                    │                                     ONCE, synchronously │
                    │                                     before first render │
                    │                                                          │
                    │  ┌───────────────────────────────────────────────────┐  │
                    │  │  Header controls (unkeyed — must survive switch)  │  │
                    │  │  <ScenarioSwitcher                                │  │
                    │  │    v-model="activeScenarioId"                     │  │
                    │  │    :scenarios="scenarios"                         │  │
                    │  │    @rename="renameScenario"                       │  │
                    │  │    @duplicate="duplicateScenario"                 │  │
                    │  │    @delete="deleteScenario" />  ── USelectMenu    │  │
                    │  │  <DeleteScenarioModal /> ── UModal, opened by the │  │
                    │  │  switcher's per-row delete icon                   │  │
                    │  └───────────────────────────────────────────────────┘  │
                    │                                                          │
                    │  ┌───────────────────────────────────────────────────┐  │
                    │  │  :key="activeScenarioId"  ◄── forces full teardown │  │
                    │  │  and re-setup of everything below on switch        │  │
                    │  │  (Pattern 1) — NOT a reactive useStorage key       │  │
                    │  │                                                    │  │
                    │  │  usePicksStorage(activeScenarioId, 2026)          │  │
                    │  │  useAutoFilledGames(activeScenarioId, 2026)       │  │
                    │  │  useManualTiebreakers(activeScenarioId, 2026)     │  │
                    │  │       (each: fresh useStorage() instance,         │  │
                    │  │        fresh unshared {} / [] default)            │  │
                    │  │                ↓                                  │  │
                    │  │  useStandings(activeScenarioId, 2026)             │  │
                    │  │  usePickProgress(activeScenarioId, 2026)          │  │
                    │  │                ↓                                  │  │
                    │  │  GameCard[] / PickProgress / StandingsSidebar     │  │
                    │  └───────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  localStorage (season-namespaced, scenario-suffixed)     │
                    │  cfb_scenarios_2026            (registry array)          │
                    │  cfb_active_scenario_2026      (active id string)        │
                    │  cfb_picks_2026                (LEGACY — read-only,      │
                    │                                  migration source only)  │
                    │  cfb_picks_2026_{id}                                     │
                    │  cfb_autofilled_2026_{id}                                │
                    │  cfb_manual_tiebreakers_2026_{id}                        │
                    └─────────────────────────────────────────────────────────┘
```

`useGames(2026)` / `useTeams(2026)` (TanStack Query, `staleTime: Infinity`) stay **outside** the `:key` boundary entirely — the schedule and team list are not scenario-scoped, and keeping them at the page's unkeyed top level means a scenario switch never re-fetches or re-derives them (they're already cache-instant regardless, but this avoids re-running `teamsById`'s `Map` construction needlessly on every switch).

### Recommended Project Structure

```
app/
├── composables/
│   ├── useScenarios.ts          # NEW — registry, active pointer, CRUD, migration
│   ├── usePicksStorage.ts       # MODIFIED — (scenarioId, season = 2026)
│   ├── useAutoFilledGames.ts    # MODIFIED — (scenarioId, season = 2026)
│   ├── useManualTiebreakers.ts  # MODIFIED — (scenarioId, season = 2026)
│   ├── usePickProgress.ts       # MODIFIED — (scenarioId, season = 2026), threads to usePicksStorage
│   └── useStandings.ts          # MODIFIED — (scenarioId, season = 2026), threads to usePicksStorage + useManualTiebreakers
├── components/
│   ├── ScenarioSwitcher.vue     # NEW — wraps USelectMenu, item-trailing icon actions
│   ├── DeleteScenarioModal.vue  # NEW — wraps UModal, confirm/cancel footer
│   ├── PickProgress.vue         # MODIFIED — new scenarioId prop, passed to usePicksStorage/usePickProgress
│   └── PickProgressWeek.vue     # MODIFIED — same
└── pages/week/[week].vue        # MODIFIED — calls useScenarios(), renders switcher unkeyed,
                                  #            wraps the picks-dependent subtree in a :key="activeScenarioId" boundary
```

### Pattern 1: Force-remount on scenario switch, never a reactive `useStorage` key

**What:** Bind Vue's special `key` attribute to `activeScenarioId` on the element/component that roots the picks-dependent subtree. When `key` changes, Vue tears the old subtree down completely and mounts a fresh one — every composable inside it re-runs from scratch, including `usePicksStorage`/`useAutoFilledGames`/`useManualTiebreakers`/`useStandings`/`usePickProgress`.

**When to use:** Any time the picks-dependent UI needs to re-scope to a different scenario. This is the *only* safe way to swap which `useStorage()` instance backs `picks`/`autoFilled`/`decisions` — see Pitfall 1 for why passing a reactive key into a single long-lived `useStorage()` call is unsafe for object/array-valued state.

**Example:**
```vue
<!-- app/pages/week/[week].vue -->
<script setup lang="ts">
const { scenarios, activeScenarioId } = useScenarios(2026)
</script>

<template>
  <div>
    <!-- Unkeyed: must stay mounted to let the user switch scenarios at all -->
    <ScenarioSwitcher v-model="activeScenarioId" :scenarios="scenarios" />

    <!-- Keyed: fully remounts (fresh composable calls, fresh useStorage
         instances) every time activeScenarioId changes -->
    <div :key="activeScenarioId">
      <PicksWorkspace :scenario-id="activeScenarioId" :season="2026" :week="week" />
    </div>
  </div>
</template>
```
`PicksWorkspace` (or inlined directly in the page below the `:key` div — a wrapper component is not strictly required, `:key` works on any element/component) is where `usePicksStorage(activeScenarioId, 2026)` etc. get called. [CITED: vuejs.org guide, "the `key` special attribute", forced re-creation semantics — standard, long-documented Vue 3 behavior]

### Pattern 2: Duplicate/delete operate on raw `localStorage`, not live composable refs

**What:** `duplicateScenario(sourceId, newName)` and `deleteScenario(id)` act on a scenario that is very likely **not** the one currently mounted under the `:key` boundary (Pattern 1) — there is no live `useStorage()` ref for it to mutate through. Both operations read/write the three per-scenario `localStorage` keys directly by their computed string names.

**When to use:** Any scenario-registry mutation that targets an arbitrary scenario id, as opposed to mutating the currently-active scenario's own data.

**Example:**
```typescript
// Inside useScenarios.ts
function duplicateScenario(sourceId: string, season: number): ScenarioMeta {
  const newId = crypto.randomUUID()
  const kinds = ['picks', 'autofilled', 'manual_tiebreakers'] as const
  for (const kind of kinds) {
    const sourceKey = `cfb_${kind}_${season}_${sourceId}`
    const targetKey = `cfb_${kind}_${season}_${newId}`
    const raw = localStorage.getItem(sourceKey)
    if (raw !== null) localStorage.setItem(targetKey, raw)
    // if raw is null, the source scenario simply has no data for this kind
    // yet (e.g. a brand-new scenario never persisted past its writeDefaults
    // pass) — nothing to copy, the fresh useStorage() call for newId will
    // apply its own {} / [] default on first mount, which is correct.
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
    activeScenarioId.value = registry.value[0]!.id // D-16: immediate fallback, no extra prompt
  }
}
```
Note the `${kind}` string list is duplicated by hand here rather than imported from each composable, because each composable's key-prefix (`cfb_picks_`, `cfb_autofilled_`, `cfb_manual_tiebreakers_`) is presently a private literal inside its own file — see Pitfall 3 for the recommendation to export these as named constants so `useScenarios.ts` and the five composables can share one source of truth instead of three independently-typed string literals risking drift.

### Anti-Patterns to Avoid

- **Reactive/computed `key` passed into a single `useStorage()` call for object or array state:** Confirmed to leak data across scenario switches (Pitfall 1). Only safe for primitive (string/number/boolean) storage where VueUse's default serializer can't alias a shared mutable reference — e.g. `activeScenarioId` itself is fine as a plain (non-switching) `useStorage<string>` because its own key never changes at runtime.
- **Calling `useStorage()` (or any side-effecting composable) from inside a `computed()` getter:** Even as a defensive workaround to Pitfall 1 (e.g. a lazily-populated Map cache), this violates Vue's purity contract for computed getters and risks re-registering `storage` event listeners on every re-evaluation. If a Map-cache approach is ever chosen over the `:key` pattern, populate it from a `watch(..., { immediate: true })`, never from inside the computed getter itself.
- **Duplicating a scenario by mounting `usePicksStorage(sourceId)` just to read it, then writing through `usePicksStorage(newId)`:** Works, but leaves a stray, permanently-mounted `useStorage()` instance (and its `storage` event listener) for a scenario that may never again be displayed in this session. Raw `localStorage.getItem`/`setItem` (Pattern 2) is simpler, has no listener lifecycle to reason about, and is the more obviously correct tool for a one-shot administrative copy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown-with-inline-actions UI | A custom `<div>`-based dropdown with manual focus trapping/keyboard nav | `USelectMenu` with `item-trailing` slot | Already ships accessible focus/keyboard handling (Nuxt UI wraps Reka UI primitives); hand-rolling a dropdown here would duplicate a11y work Nuxt UI has already solved |
| Confirmation dialog | A custom modal/backdrop component | `UModal` | Same reasoning — focus trap, escape-to-dismiss (`dismissible`), scroll lock all included |
| Unique id generation | A hand-rolled counter or `Math.random()`-based id | `crypto.randomUUID()` | Native, zero-dependency, collision-safe; no reason to hand-roll |

**Key insight:** every piece of new UI this phase needs (dropdown-with-row-actions, confirm dialog) is already covered by components the locked stack ships — the actual engineering risk in this phase is entirely in the storage-scoping refactor (Pitfall 1), not the UI layer.

## Runtime State Inventory

> Included because this phase is partly a migration phase (D-03: existing `cfb_picks_2026` data must be preserved and wrapped into a first scenario).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage['cfb_picks_2026']` — the pre-Phase-7 flat picks object, written by every user who has used the app before this ships. `localStorage['cfb_autofilled_2026']` and (if Phase 6 shipped ahead of this) `localStorage['cfb_manual_tiebreakers_2026']` — same pre-scenario shape. | **Data migration** (D-03): on first load with no `cfb_scenarios_2026` registry present, copy all three legacy keys' raw values into freshly-suffixed scenario keys (`cfb_picks_2026_{newId}`, `cfb_autofilled_2026_{newId}`, `cfb_manual_tiebreakers_2026_{newId}`) for one auto-created "My Scenario", then write the registry and active pointer. **The legacy keys are never deleted** (D-03 verbatim) — they simply stop being read by anything after migration runs once. |
| Live service config | None — this app has no external services with config living outside git. | None — verified by re-reading PROJECT.md/CLAUDE.md's "No backend" constraint; nothing to check here. |
| OS-registered state | None — a static SPA has no OS-level task/service registrations. | None. |
| Secrets/env vars | None touched by this phase. No env var or secret name changes. | None. |
| Build artifacts | None — this phase adds no build-time scripts or generated artifacts; it's pure `app/` runtime code. | None. |

**Migration idempotency:** the migration must be gated on "`cfb_scenarios_2026` does not yet exist" (not "`cfb_picks_2026` exists"), so it runs exactly once per browser profile — a second load after migration has already run must NOT re-wrap the (now-stale, never-updated-again) legacy key into a second scenario.

## Common Pitfalls

### Pitfall 1: VueUse `useStorage`'s reactive key silently leaks object/array state across keys

**What goes wrong:** Passing a `computed`/ref `key` into a single, long-lived `useStorage(key, {}, ...)` call and then switching that key to a *new, not-yet-persisted* target reads back the *previous* target's mutated data instead of the fresh default.

**Why it happens:** `useStorage`'s internal implementation computes `rawInit = toValue(defaults)` **once**, at the time `useStorage()` is called — not once per key. When the key switches to a location with no existing entry in `localStorage`, its `read()` path returns this same `rawInit` object reference as the new `data.value`. Because Vue's `ref()` wraps object/array values via a reactive `Proxy` over the *same underlying object*, any mutation made to `data.value` while under the old key (e.g. `picks.value[123] = 456`) mutates `rawInit` itself in place. The next key switch to another empty target reads that same, now-polluted `rawInit` back out.

**How to avoid:** Never pass a reactive/computed key into one `useStorage()` call across a scenario switch when the stored value is an object or array. Instead construct a fresh `useStorage()` call per scenario (Pattern 1's `:key` remount is the idiomatic Vue mechanism to force that).

**Warning signs:** A newly-created scenario shows another scenario's picks immediately after being created (before the user has picked anything in it). In tests: creating a second `useStorage` instance against a *reactive* key and asserting on the new key's `localStorage` entry after a switch.

**Verified reproduction** [VERIFIED: `@vueuse/core@14.4.0` source inspection (`node_modules/.pnpm/@vueuse+core@14.4.0.../dist/index.js`) + a throwaway vitest test run in this repo's own `happy-dom` environment, both performed and observed directly during this research session]:
```typescript
const scenarioId = ref('A')
const key = computed(() => `cfb_picks_2026_${scenarioId.value}`)
const picks = useStorage<Record<number, number>>(key, {}, localStorage, { mergeDefaults: true })

picks.value[123] = 456
await nextTick()
// localStorage['cfb_picks_2026_A'] === '{"123":456}'  -- correct so far

scenarioId.value = 'B'   // B has never been written to localStorage
await nextTick()

// OBSERVED (should be {} / null):
// picks.value                        === { 123: 456 }
// localStorage['cfb_picks_2026_B']   === '{"123":456}'
// localStorage['cfb_picks_2026_A']   === '{"123":456}'  (unchanged, at least not corrupted)
```
The second, fresh-instance-per-key version of the same test (`const picksFor = (id) => useStorage(\`cfb_picks_2026_${id}\`, {}, localStorage, {...})`, called twice with two different ids) produced the correct, isolated result: `picksFor('B').value === {}`.

### Pitfall 2: `season = 2026` default breaks if `scenarioId` is appended as a second parameter

**What goes wrong:** TypeScript technically allows a parameter with a default value to be followed by a required parameter (`function f(a = 2026, b: string)`), but it defeats the purpose of the default — every caller must now pass both arguments positionally anyway, since there's no way to say "use `a`'s default, but give me `b`" without explicitly passing `undefined` for `a`.

**Why it happens:** Positional parameters with defaults only become truly optional for callers when every parameter after them is also optional/has a default.

**How to avoid:** Put the new required parameter (`scenarioId`) **before** the defaulted one: `usePicksStorage(scenarioId: string, season = 2026)`. This preserves `season`'s usefulness (`usePicksStorage(activeScenarioId)` in the app's only real season, 2026) and makes the compiler flag every call site that forgot to thread a scenario id through — turning "did I miss a call site" into a build error rather than a runtime data-isolation bug.

**Warning signs:** A refactor that keeps `season` first "to minimize the diff" but then has to pass `2026` explicitly everywhere anyway — a sign the parameter order should have been swapped instead.

### Pitfall 3: The three per-scenario key prefixes (`cfb_picks_`, `cfb_autofilled_`, `cfb_manual_tiebreakers_`) are private literals today

**What goes wrong:** `useScenarios.ts`'s `duplicateScenario`/`deleteScenario` (Pattern 2) need to construct the exact same key strings the three storage composables use internally. Today those prefixes are inline string literals inside each composable file (`` `cfb_picks_${season}` ``, etc.), not exported constants — a typo or future rename in one place silently desyncs from the other.

**Why it happens:** The pre-Phase-7 composables never needed another module to know their key format; Phase 7 introduces the first cross-module consumer of that format (registry-level duplicate/delete).

**How to avoid:** Export a small named constant or key-builder function from each of the three composables (or a shared `shared/utils/scenarioKeys.ts`), e.g. `export const PICKS_KEY_PREFIX = 'cfb_picks_'`, and have both the composable itself and `useScenarios.ts` build the final key from the same constant.

**Warning signs:** `duplicateScenario` "silently does nothing" for one of the three kinds — the tell-tale sign is a hand-typed prefix in `useScenarios.ts` that doesn't exactly match the corresponding composable's own literal.

### Pitfall 4: Existing tests call these composables with only a `season` argument — 113 call sites across 5 files

**What goes wrong:** `usePicksStorage`, `useAutoFilledGames`, `useManualTiebreakers`, `usePickProgress`, and `useStandings` are called with a single positional `season` argument in `tests/composables/usePicksStorage.test.ts` (27 calls), `useAutoFilledGames.test.ts` (32), `useManualTiebreakers.test.ts` (22), `usePickProgress.test.ts` (20), and `useStandings.test.ts` (12) — 113 call sites total [VERIFIED: `grep -c` against this repo's own `tests/` directory during this research session]. `tests/components/PickProgress.test.ts` and `PickProgressWeek.test.ts` also exercise the **real, unmocked** `usePicksStorage` indirectly through component mount (only `usePickProgress` is mocked in those two files).

**Why it happens:** These tests predate the scenario axis entirely.

**How to avoid:** This is not avoidable — it's an expected, correct consequence of Pitfall 2's signature change, and the required scenarioId parameter (no default) means the compiler will flag every one of the 113+ call sites that needs updating. Budget explicit plan tasks for updating all 7 test files' call sites (mechanical: prepend a `SCENARIO_ID` test constant to each call) plus adding a `scenarioId` prop (with a sensible test default) to `PickProgress.vue`/`PickProgressWeek.vue` and their two test files.

**Warning signs:** A "small" refactor PR that only touches the five composable files and `week/[week].vue` but doesn't touch `tests/` — the type checker (`vue-tsc`) will fail loudly on the 113 stale call sites, so this is self-catching, but should be planned for rather than discovered mid-execution.

### Pitfall 5: Migration (D-03) must run before *any* composable reads the registry, but must run exactly once

**What goes wrong:** If `useScenarios()`'s migration-and-recovery logic (D-03 legacy wrap, D-05 dangling-pointer fallback, D-14 empty-registry auto-create, D-17 corrupt-JSON reset) is expressed as a `watch`/`onMounted` side effect rather than synchronous setup-time logic, the very first render could show an empty/default scenario for one frame before the migrated one appears — or worse, `usePicksStorage`/`useStandings` inside the `:key` boundary could read `activeScenarioId` before it's been resolved to a real, migrated value.

**Why it happens:** VueUse's `useStorage` itself already runs its own `read()` synchronously at call time (not deferred to `onMounted`, since this app is `ssr: false` — no `initOnMounted` guard needed, consistent with the existing four composables). But the *migration* logic sits a layer above raw `useStorage` and is new code this phase writes — it's easy to accidentally defer it.

**How to avoid:** Perform migration/recovery synchronously in `useScenarios()`'s own function body (not inside a `watch` or `onMounted`), mirroring how the existing four composables' corruption recovery already runs synchronously inside their `serializer.read()` callbacks — i.e., resolve the final `registry`/`activeScenarioId` values *before* `useScenarios()` returns, so the very first render already sees the fully-migrated, guaranteed-non-empty state.

**Warning signs:** A flash of "My Scenario" briefly showing zero picks before a returning user's real (migrated) picks appear; a manual UAT check should specifically load the app with pre-existing `cfb_picks_2026` data and confirm zero flicker.

## Code Examples

### Nuxt UI 4 `USelectMenu` with per-row inline actions

```vue
<!-- app/components/ScenarioSwitcher.vue -->
<!-- Source: https://ui.nuxt.com/components/select-menu (fetched this session) -->
<script setup lang="ts">
interface ScenarioMeta { id: string, name: string, createdAt: string }
const props = defineProps<{ scenarios: ScenarioMeta[], modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [id: string]
  rename: [id: string, name: string]
  duplicate: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <USelectMenu
    :items="props.scenarios"
    :model-value="props.modelValue"
    value-key="id"
    label-key="name"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <template #leading>
      <UIcon name="lucide:layers" />
    </template>

    <template #item-label="{ item }">
      {{ item.name }}
    </template>

    <template #item-trailing="{ item }">
      <UButton icon="lucide:pencil" size="xs" color="neutral" variant="ghost" :aria-label="`Rename ${item.name}`" @click.stop="emit('rename', item.id, item.name)" />
      <UButton icon="lucide:copy" size="xs" color="neutral" variant="ghost" :aria-label="`Duplicate ${item.name}`" @click.stop="emit('duplicate', item.id)" />
      <UButton
        icon="lucide:trash-2" size="xs" color="error" variant="ghost"
        :aria-label="`Delete ${item.name}`"
        :disabled="props.scenarios.length <= 1"
        :title="props.scenarios.length <= 1 ? 'At least one scenario is required' : undefined"
        @click.stop="emit('delete', item.id)"
      />
    </template>
  </USelectMenu>
</template>
```
`@click.stop` on the row-action buttons is required — without it, clicking an icon inside an `item` row also triggers `USelectMenu`'s own item-selection behavior, switching to that scenario as a side effect of clicking "delete."

### Nuxt UI 4 `UModal` delete confirmation

```vue
<!-- app/components/DeleteScenarioModal.vue -->
<!-- Source: https://ui.nuxt.com/components/modal (fetched this session) -->
<script setup lang="ts">
const props = defineProps<{ open: boolean, scenarioName: string }>()
const emit = defineEmits<{ 'update:open': [boolean], confirm: [] }>()
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

### Composable signature swap (all five composables follow this shape)

```typescript
// app/composables/usePicksStorage.ts — BEFORE
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single season-only key (`cfb_picks_2026`) | Season + scenario compound key (`cfb_picks_2026_{scenarioId}`) | This phase | Every composable call site and every existing test call site changes signature (Pitfall 4) |
| Implicit single "current" pick set | Explicit scenario registry with an active pointer | This phase | Introduces the first `localStorage`-registry pattern in the app; the four future SCEN-06/07 (v2) features and Phase 8's share-link "save a copy" flow build directly on this registry |

**Deprecated/outdated:** none — this is additive, not a replacement of an existing pattern that was itself deprecated.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nuxt UI 4's `USelectMenu`/`UModal` prop/slot/event surface as documented on `ui.nuxt.com` exactly matches the installed `4.10.0` package (not cross-checked against the installed package's own `.d.ts`/source this session) | Code Examples, Standard Stack | Low — Nuxt UI docs are versioned per-release and the site was fetched live; worst case a prop/slot name is slightly off and TypeScript/the dev server catches it immediately during implementation |
| A2 | `crypto.randomUUID()` is available in this project's target browsers without a polyfill | Standard Stack | Very low — Baseline-widely-available since 2022, and this app already assumes a modern evergreen browser (no IE11/legacy support claimed anywhere in PROJECT.md/CLAUDE.md) |
| A3 | The `:key`-remount pattern (Pattern 1) is performant enough at this app's scale (≤ ~40 `GameCard`s per week after filtering) to run on every scenario switch with no perceptible delay, satisfying D-09's "instant" requirement | Architecture Patterns Pattern 1 | Low — not measured this session (no running dev server available), but Phase 5 measured a full standings recompute at ~7ms and remounting ~40 lightweight components is a well-trodden, cheap Vue operation; if it were ever to matter, the fallback (memoized Map cache seeded via `watch(..., {immediate:true})`, see Anti-Patterns) is documented as an escape hatch |

## Open Questions

1. **Should `useScenarios()` own the picks/autofill/manual-tiebreaker key-prefix constants outright, or should each of the three composables export their own and `useScenarios.ts` import them?**
   - What we know: Pitfall 3 identifies the duplication risk either way.
   - What's unclear: whether the planner prefers a new shared `shared/utils/scenarioKeys.ts` file (cleanest, one new file) vs. three small named exports added to the existing composable files (smaller diff, no new file).
   - Recommendation: either is fine functionally; the planner should pick based on this phase's existing file-count discipline. A shared file is slightly preferred since `useScenarios.ts` needs all three prefixes at once for duplicate/delete, and importing three separate composable files just for a string constant each pulls in more than needed.

2. **Where exactly should the `:key="activeScenarioId"` boundary sit — a new wrapper component, or directly on a `<div>` inside `week/[week].vue`?**
   - What we know: Pattern 1 works on any element or component; `week/[week].vue` is already a large single-file page (see current file, ~325 lines).
   - What's unclear: whether the planner wants to extract a `PicksWorkspace.vue`/similar component for the keyed subtree (cleaner separation, easier to test in isolation) or keep everything inline in the page with the `:key` on a wrapping `<div>` (smaller diff).
   - Recommendation: given `week/[week].vue`'s existing size and that `tests/pages/week.test.ts` was already deleted for being untestable stub coverage (per STATE.md's Phase 5 note), extracting a keyed child component is likely worth it for testability, but this is a planning-level structural call, not a research-level one.

## Environment Availability

Not applicable — this phase adds no new external tool, service, or runtime dependency. `pnpm`, `node`, `vitest` are already verified available from prior phases; no new dev-machine dependency is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` [VERIFIED: package.json], `happy-dom` `20.11.2` environment |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/composables/usePicksStorage.test.ts tests/composables/useAutoFilledGames.test.ts tests/composables/useManualTiebreakers.test.ts` (fast, targets the changed composables) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCEN-01 | Creating a scenario produces isolated, independent picks storage | unit | `npx vitest run tests/composables/useScenarios.test.ts` | ❌ Wave 0 — new file |
| SCEN-01 | Existing 5 composables correctly scope by `(scenarioId, season)` | unit | `npx vitest run tests/composables/usePicksStorage.test.ts` (+4 sibling files) | ✅ exists, needs signature updates (Pitfall 4) |
| SCEN-02 | Switching `activeScenarioId` re-scopes picks/standings with no cross-contamination | unit | `npx vitest run tests/composables/useScenarios.test.ts` — assert two scenarios' `localStorage` keys stay independent across switches (regression test directly targeting Pitfall 1) | ❌ Wave 0 — new file |
| SCEN-03 | Rename updates registry entry; delete removes the three per-scenario keys and falls back (D-16) | unit | `npx vitest run tests/composables/useScenarios.test.ts` | ❌ Wave 0 — new file |
| SCEN-03 | Delete confirmation UI requires an explicit confirm click | component | `npx vitest run tests/components/DeleteScenarioModal.test.ts` | ❌ Wave 0 — new file |
| SCEN-04 | Duplicate copies picks + autofill + manual-tiebreaker data for a non-active source scenario | unit | `npx vitest run tests/composables/useScenarios.test.ts` — exercise `duplicateScenario` against a source id that is NOT the currently "active" one (Pattern 2 regression) | ❌ Wave 0 — new file |
| SCEN-05 | No network/auth call anywhere in the scenario flow | manual-only | N/A — negative assertion, covered implicitly by `FOUND-03`'s existing "zero network fetches" check | ✅ existing coverage generalizes |
| Migration (D-03) | Legacy `cfb_picks_2026` wraps into a first scenario exactly once, legacy key untouched | unit | `npx vitest run tests/composables/useScenarios.test.ts` — seed `localStorage['cfb_picks_2026']`, construct `useScenarios()`, assert registry + new suffixed key + legacy key all correct | ❌ Wave 0 — new file |

### Sampling Rate

- **Per task commit:** the quick-run command above (targets only the touched composable test files)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/composables/useScenarios.test.ts` — covers SCEN-01 through SCEN-04, migration (D-03), corruption recovery (D-17), dangling-pointer fallback (D-05), delete guard (D-14), delete fallback (D-16). This is the highest-value new test file this phase needs — it should include the Pitfall 1 regression explicitly (create two scenarios, pick in one, switch to the other, assert no leakage) since that is the one concrete, verified defect this research found.
- [ ] `tests/components/ScenarioSwitcher.test.ts` — covers the `USelectMenu` wrapper's row-action event wiring (rename/duplicate/delete emit the right id)
- [ ] `tests/components/DeleteScenarioModal.test.ts` — covers the `UModal` wrapper's confirm/cancel behavior
- [ ] Existing 7 test files (`usePicksStorage.test.ts`, `useAutoFilledGames.test.ts`, `useManualTiebreakers.test.ts`, `usePickProgress.test.ts`, `useStandings.test.ts`, `PickProgress.test.ts`, `PickProgressWeek.test.ts`) need every call site updated for the new `(scenarioId, season)` signature (Pitfall 4) — not a gap in coverage, but a mechanical update required before the suite compiles/passes again.
- [ ] Framework install: none — Vitest is already fully configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | App has no accounts (SCEN-05, `FOUND-01`) |
| V3 Session Management | No | No server sessions exist |
| V4 Access Control | No | Single-user, single-browser-profile local data; no cross-user boundary to enforce |
| V5 Input Validation | Yes | The scenario registry (`cfb_scenarios_2026`) is untrusted input the moment it's read back from `localStorage` — a hand-edited or corrupted entry must not crash the app or inject a phantom/duplicate scenario id. Follow `useManualTiebreakers.ts`'s existing `validateConferenceDecisions`-style shape-validation pattern: on read, verify the parsed value is an array, each entry has `id`/`name`/`createdAt` of the expected primitive types, and drop malformed entries individually rather than discarding the whole registry (D-17's "silent reset" is the *fallback* only when the top-level shape itself is unrecoverable, e.g. not an array at all) |
| V6 Cryptography | No | `crypto.randomUUID()` is used for id generation, not for any security-sensitive secret; no key management involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited/corrupted `cfb_scenarios_2026` JSON (a user or a browser extension directly editing `localStorage` via devtools) causes a crash or an unrecoverable app state | Tampering | Shape-validate on read (V5 above), silent reset to a fresh single-scenario default on unrecoverable corruption — exact precedent already established three times in this codebase (`usePicksStorage`, `useAutoFilledGames`, `useManualTiebreakers`) |
| A dangling `cfb_active_scenario_2026` pointer (references a scenario id no longer in the registry, e.g. after a manual `localStorage` edit deletes an entry but not the pointer) | Tampering | D-05: fall back to the first registry entry, or auto-create a default scenario if the registry itself is empty — already a locked decision, not new guidance |
| Scenario id collision (two scenarios ending up with the same `id` through a corrupted/hand-edited registry) causing one scenario's data to silently overwrite another's on next write | Tampering | `crypto.randomUUID()`'s collision probability is cryptographically negligible for legitimate creation; the shape-validator (V5) should additionally de-duplicate by `id` on read (keep first occurrence, drop later duplicates) as a defense-in-depth measure against a hand-edited registry with a repeated id |

This phase's threat surface is narrow: there is no network input, no server, and no cross-user boundary. The only "untrusted input" is the user's own browser storage, which the codebase already has a strong, established pattern for treating defensively.

## Sources

### Primary (HIGH confidence)
- `@vueuse/core@14.4.0` installed package source, `node_modules/.pnpm/@vueuse+core@14.4.0.../dist/index.js` — `useStorage` implementation read directly, confirming `rawInit = toValue(defaults)` is computed once and reused across reactive key changes
- Reproduced empirical test, run via this repo's own `npx vitest run` against its configured `happy-dom` environment, confirming the leak (Pitfall 1) and confirming the fresh-instance-per-key fix works correctly
- This repo's own `app/composables/*.ts` and `tests/composables/*.test.ts` — read directly for exact current signatures, storage key formats, and test call-site counts (`grep -c`)
- `npm view @vueuse/core version` / `npm view @nuxt/ui version` — confirmed installed versions match `package.json`

### Secondary (MEDIUM confidence)
- https://ui.nuxt.com/components/select-menu — `USelectMenu` props/slots/events, fetched live this session
- https://ui.nuxt.com/components/modal — `UModal` props/slots/events, fetched live this session
- https://vueuse.org/core/useStorage/ — confirms the reactive-key feature is documented as a feature with no warning about the object-default sharing behavior found in Pitfall 1

### Tertiary (LOW confidence)
- https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID — `crypto.randomUUID()` Baseline availability, WebSearch-sourced summary, not independently cross-checked against caniuse.com directly this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions confirmed against both `package.json` and the npm registry directly
- Architecture (Pattern 1/2, composable signature design): MEDIUM — grounded in a verified defect (Pitfall 1) and well-established Vue semantics (`:key` remount), but the overall composable/component split (Open Question 2) is a synthesis, not itself independently verified against a working implementation
- Pitfalls: HIGH for Pitfall 1 (reproduced empirically against the exact installed dependency version) and Pitfall 4 (exact grep-counted call sites in this repo); MEDIUM for Pitfalls 2/3/5 (sound reasoning from TypeScript/Vue semantics and this codebase's existing patterns, not independently tool-verified)

**Research date:** 2026-08-19
**Valid until:** 30 days (stable dependency versions; the one time-sensitive fact — `crypto.randomUUID()` browser support — is long-stable and not expected to regress)
