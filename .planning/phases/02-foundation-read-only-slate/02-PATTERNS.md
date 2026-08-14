# Phase 2: Foundation & Read-Only Slate - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 13
**Analogs found:** 6 / 13 (rest have no in-repo analog — this is the first phase writing `app/` code beyond the stock starter; RESEARCH.md's Code Examples section is the primary source for those)

## Context

`app/` currently contains only the unmodified Nuxt UI starter template (`app/pages/index.vue`, `app/components/AppLogo.vue`, `app/components/TemplateMenu.vue`, `app/app.vue`, `app/app.config.ts`). There are no composables, plugins, utils, or non-starter pages/components yet — this phase creates that layer from scratch. Because of this, most new files have **no direct in-app analog**; the closest real patterns to copy live in `scripts/lib/*.ts` (TS style: named exports, explicit interfaces, JSDoc explaining *why*, dependency-injection via optional-opts for testability) and in `tests/*.test.ts` (Vitest style: `describe`/`it`, `vi.fn()` mocks, `.toEqual` on whole objects). RESEARCH.md's `Code Examples` section (already vetted against the installed `@nuxt/ui@4.10.0` and `@tanstack/vue-query@5.101.4` APIs) is treated as the primary source of the actual implementation shape for Vue-specific files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `app/plugins/vue-query.ts` | provider | request-response (cache init) | none in-repo | no-analog (use RESEARCH.md Pattern 1 / official vue-query Nuxt plugin shape) |
| `app/utils/queryKeys.ts` | utility | transform | none in-repo | no-analog (use RESEARCH.md Pattern 1) |
| `app/composables/useTeams.ts` | hook | CRUD (read-only fetch+cache) | `scripts/lib/coverage.ts` (style only: named export, explicit return type, DI-friendly) | role-match (partial — style only, not domain) |
| `app/composables/useGames.ts` | hook | CRUD (read-only fetch+cache) | `scripts/lib/coverage.ts` (style only) + `app/composables/useTeams.ts` (structural twin) | role-match (partial — style only) |
| `shared/types/schedule.ts` | model | transform | `scripts/lib/schemas.ts` (interface style: `TeamOutput`, `GameOutput`) | exact (field-shape precedent, different layer per RESEARCH.md Pattern 2) |
| `app/pages/index.vue` (replaced) | route | request-response | `app/pages/index.vue` (current starter stub, to be entirely replaced) | exact (file being replaced — structure not reusable) |
| `app/pages/week/[week].vue` | route | request-response | none in-repo | no-analog (use RESEARCH.md Pattern 3) |
| `app/components/GameCard.vue` | component | request-response | `app/components/AppLogo.vue` / `TemplateMenu.vue` (SFC conventions: `<script setup lang="ts">`, Nuxt UI component composition) | role-match (SFC conventions only, not domain logic) |
| `app/components/ConferenceFilter.vue` | component | request-response | `app/components/TemplateMenu.vue` (closest: `UDropdownMenu`/select-style component with items array) | role-match |
| `app/components/TeamFilter.vue` | component | request-response | `app/components/TemplateMenu.vue` (menu/selection component precedent) | role-match |
| `app/components/WeekNav.vue` | component | request-response | none in-repo | no-analog (use RESEARCH.md Pattern 3 nav handlers) |
| `nuxt.config.ts` (modified) | config | — | `nuxt.config.ts` (existing file, add `ssr: false`, `nitro.prerender.routes`) | exact (self) |
| `public/_redirects` (new) | config | — | none in-repo | no-analog (Cloudflare Pages SPA fallback, static text file) |
| `tests/lib/filter-games.test.ts`, `tests/lib/group-games.test.ts` | test | transform | `tests/coverage.test.ts` (Vitest style: `describe`/`it`, `.toEqual` whole-object assertions, no mocking needed for pure functions) | exact (test style) |
| `tests/composables/useTeams.test.ts`, `tests/composables/useGames.test.ts` | test | CRUD | `tests/coverage.test.ts` (`vi.fn()` DI-mock pattern for async I/O) | role-match |

## Pattern Assignments

### `app/utils/queryKeys.ts` (utility, transform)

**No in-repo analog.** Use RESEARCH.md Pattern 1 verbatim — a single factory object:

```typescript
export const queryKeys = {
  teams: (season: number) => ['season', season, 'teams'] as const,
  games: (season: number) => ['season', season, 'games'] as const
}
```

**Style precedent** (naming/export convention) from `scripts/lib/coverage.ts` lines 1-9: named exports only (no default export), explicit param types, no `any`.

---

### `app/composables/useTeams.ts` / `app/composables/useGames.ts` (hook, CRUD read-only)

**No in-repo composable analog** — this is the first composable in the project. Structural shape comes from RESEARCH.md Pattern 1:

```typescript
import { useQuery } from '@tanstack/vue-query'
import type { Team } from '#shared/types/schedule'
import { queryKeys } from '~/utils/queryKeys'

export function useTeams(season = 2026) {
  return useQuery({
    queryKey: queryKeys.teams(season),
    queryFn: async () => {
      const res = await $fetch<{ season: number, teams: Team[] }>(`/data/${season}/teams.json`)
      return res.teams
    },
    staleTime: Infinity,
    gcTime: Infinity
  })
}
```

`useGames` mirrors this, unwrapping `.games` and preserving the full envelope (`{ season, scheduleHash, games }`) per RESEARCH.md's Pattern 1 note — Phase 8 share-links need `scheduleHash` later, so don't discard it when structuring the return.

**Style precedent** from `scripts/lib/coverage.ts` (DI pattern via optional-opts, e.g. lines 6-9 `VendorLogoOptions { fetchImpl?, ... }`): if composables need to be unit-testable without a live `$fetch`, follow the same "accept an injectable implementation, default to the real one" shape used there — though for a pure `useQuery` wrapper this is more likely satisfied by mocking `$fetch` directly in tests rather than a custom DI param, since `$fetch` is a Nuxt global, not a locally-passed function like `coverage.ts`'s `fetchImpl`.

**Critical correctness note (from RESEARCH.md Pitfall 2):** both `teams.json` and `games.json` are wrapped envelopes (`{ season, teams: [...] }` / `{ season, scheduleHash, games: [...] }`), not bare arrays — the composable's `queryFn` must destructure `.teams`/`.games` explicitly or `.length`/`.filter` calls downstream will silently break.

---

### `shared/types/schedule.ts` (model, transform)

**Analog:** `scripts/lib/schemas.ts` lines 33-42 (`TeamOutput`) and 101-111 (`GameOutput`) — **field-shape precedent only, not a shared type to import.** RESEARCH.md Pattern 2 explicitly warns against importing `scripts/lib/schemas.ts`'s types into `app/` (different TS program via `tsconfig.scripts.json`, and `TeamOutput` lacks the `logo` field bolted on post-transform). Re-declare independently in `shared/types/schedule.ts`:

```typescript
// scripts/lib/schemas.ts:33-42 (interface style precedent — DO NOT import)
export interface TeamOutput {
  id: number
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string
  classification: string | null
  color: string
  alternateColor: string
}
```

New file mirrors this style (explicit interface, same field names/nullability) but adds `logo: string` for `Team`, and independently declares `Game` matching `GameOutput` (lines 101-111) plus the `#shared/types/schedule` auto-import path per Nuxt 4's `shared/` convention (confirmed live via `.nuxt/tsconfig.shared.json`).

---

### `app/pages/week/[week].vue` (route, request-response)

**No in-repo analog** (current `app/pages/index.vue` is the stock marketing-page starter, being fully replaced — see RESEARCH.md Pattern 3 for the full shape). Key excerpt from RESEARCH.md Pattern 3:

```typescript
const week = computed(() => Number(route.params.week))
const conf = computed(() => route.query.conf as string | undefined)
const teamId = computed(() => route.query.team ? Number(route.query.team) : undefined)

function setConf(value: string | undefined) {
  router.push({ query: { conf: value, team: undefined } }) // D-03: mutually exclusive
}
function goToWeek(n: number) {
  router.push({ params: { week: n }, query: route.query }) // preserve filters (Pitfall 6)
}
```

**Layout precedent** from `app/app.vue` lines 27-54: `<UApp>` wraps `<UHeader>`/`<UMain><NuxtPage /></UMain>`/`<UFooter>` — the new page renders inside the existing `<UMain>` slot; no change needed to `app.vue` itself beyond what's already there.

---

### `app/components/GameCard.vue` (component, request-response)

**No domain analog** — use RESEARCH.md's fully-worked Code Example (FCS-opponent-safe rendering, D-06/D-08):

```vue
<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'
const props = defineProps<{ game: Game, teamsById: Map<number, Team> }>()
const home = computed(() => props.teamsById.get(props.game.homeId))
const away = computed(() => props.teamsById.get(props.game.awayId) ?? {
  school: props.game.awayTeam,
  logo: '/logos/placeholder.svg'
})
</script>
```

**SFC convention precedent** from `app/components/AppLogo.vue` / `app/components/TemplateMenu.vue`: `<script setup>` (TemplateMenu has no script block but uses inline `v-slot`/prop objects for Nuxt UI components — `GameCard` should follow `<script setup lang="ts">` with typed `defineProps`, matching the RESEARCH example, not TemplateMenu's inline-object style since GameCard needs computed derivation).

**Reuse:** `public/logos/placeholder.svg` (Phase 1 asset, already vendored) is the exact fallback path — do not create a new placeholder asset (D-06).

---

### `app/components/ConferenceFilter.vue` / `app/components/TeamFilter.vue` (component, request-response)

**Analog:** `app/components/TemplateMenu.vue` lines 2-49 — closest existing precedent for a Nuxt UI selection/menu component driven by an `items` array:

```vue
<UDropdownMenu
  v-slot="{ open }"
  :modal="false"
  :items="[{ label: 'Starter', to: '...', checked: true, type: 'checkbox' }, ...]"
  :content="{ align: 'start' }"
>
```

This confirms the project's convention of passing a declarative `items` array of label/value objects into a Nuxt UI menu component — same shape `UInputMenu`/`USelect` expect. For `TeamFilter.vue`, use RESEARCH.md's worked example instead (more precise for the combobox requirement, D-02):

```vue
<UInputMenu
  v-model="teamId"
  :items="teams ?? []"
  value-key="id"
  label-key="school"
  placeholder="Search teams…"
>
  <template #empty>No teams found</template>
</UInputMenu>
```

`ConferenceFilter.vue` follows the same `items`-array convention as `TemplateMenu.vue` but with `USelect`/`USelectMenu` (not a combobox) — items are the 11 conference names + "All" (D-01), no search needed.

---

### `nuxt.config.ts` (config, modified in place)

**Analog:** self — current file already has `routeRules: { '/': { prerender: true } }`. Add (per RESEARCH.md Pitfall 1 / Open Question 1):

```typescript
export default defineNuxtConfig({
  ssr: false,
  nitro: {
    prerender: {
      routes: ['/week/1', '/week/2', /* ... */ '/week/15']
    }
  },
  routeRules: {
    '/': { prerender: true }
  },
  // ...unchanged: modules, devtools, css, compatibilityDate, eslint
})
```

Verify via `pnpm build && ls .output/public/week/` (RESEARCH.md's explicit verification step) — do not assume the config alone is sufficient without checking build output.

---

### `tests/lib/filter-games.test.ts`, `tests/lib/group-games.test.ts` (test, transform)

**Analog:** `tests/coverage.test.ts` lines 76-93 (`buildCoverageReport` describe block) — pure-function test pattern with no mocking, whole-object `.toEqual` assertions:

```typescript
describe('buildCoverageReport', () => {
  it('produces accurate per-team pass/fail entries and summary counts', () => {
    const report = buildCoverageReport(2026, [
      { id: 1, school: 'Ohio State', requiredFieldsOk: true, missingFields: [], logoStatus: 'ok' },
      { id: 2, school: 'Missing Conference U', requiredFieldsOk: false, missingFields: ['conference'], logoStatus: 'missing' }
    ])
    expect(report.teams).toEqual([...])
  })
})
```

New tests for `filterGames(games, { conf, team })` and `groupByConference(games, teamsById)` (extracted pure functions, per RESEARCH.md's Test Map) should follow this exact shape: `describe` per function, `it` per behavior/edge case (mutual exclusivity D-03, alphabetical sort D-07, FCS-opponent games D-06), asserting on whole returned arrays/objects rather than individual fields.

**Config precedent:** `vitest.config.ts` (lines 1-9) already covers `tests/**/*.test.ts` in a `node` environment with `passWithNoTests: true` — no changes needed to run these new pure-logic tests; only the composable tests (`tests/composables/*.test.ts`) may need the Wave-0 decision noted in RESEARCH.md about `@vue/test-utils`/`happy-dom`.

---

### `tests/composables/useTeams.test.ts`, `tests/composables/useGames.test.ts` (test, CRUD)

**Analog:** `tests/coverage.test.ts` lines 4-17 — `vi.fn()` injected in place of a real I/O call, asserting on resolved shape without a real network/filesystem hit:

```typescript
it('resolves to missing for an absent logo URL without calling fetchImpl', async () => {
  const fetchImpl = vi.fn()
  const result = await vendorLogo(1, undefined, { fetchImpl })
  expect(result).toEqual({ status: 'missing' })
  expect(fetchImpl).not.toHaveBeenCalled()
})
```

For composable tests, mock global `$fetch` (or use `vi.stubGlobal('$fetch', ...)`) to return the fixture envelope shape and assert the composable's resolved `data` is the unwrapped array of the correct length (138 teams / 888 games) — directly testing RESEARCH.md's Pitfall 2 regression risk. This is a **Wave 0 gap**: needs a minimal Vue/QueryClient harness (not full `@nuxt/test-utils`) since none exists yet in this repo.

## Shared Patterns

### TypeScript style (project-wide convention)
**Source:** `scripts/lib/coverage.ts`, `scripts/lib/schemas.ts`
**Apply to:** All new `.ts` files (composables, utils, plugins)
- Named exports only, no default exports for logic files
- Explicit return-type interfaces declared above the function, not inferred
- JSDoc comments explaining *why* a design choice was made (not just what), referencing decision IDs (e.g. `D-06`, `Pitfall 2`) — matches this project's existing JSDoc style (`coverage.ts` lines 16-28, 44-48)
- Never throw from data-fetching/transform code paths where a typed failure result is possible; this phase's composables are simpler (no custom error unions needed — `useQuery`'s own `error`/`isError` state suffices) but the "never silently swallow, always make failure visible in the return type" ethos from `coverage.ts` should carry over to any pure filter/group helper functions that could receive malformed `conf`/`team` query params (RESEARCH.md Security Domain V5: invalid params fall back to unfiltered "All", not a crash).

### Vitest test style
**Source:** `tests/coverage.test.ts`
**Apply to:** All new test files
- `describe(functionName)` blocks, `it('should...')` behavior-described test names
- `.toEqual()` on whole return objects/arrays rather than field-by-field assertions
- `vi.fn()` for injected dependencies; `vi.fn().mockResolvedValue(...)` / `mockRejectedValue(...)` for async mocks

### Nuxt UI component composition
**Source:** `app/components/TemplateMenu.vue`, `app/app.vue`
**Apply to:** `GameCard.vue`, `ConferenceFilter.vue`, `TeamFilter.vue`, `WeekNav.vue`
- Prefer passing declarative `items`/prop arrays into Nuxt UI primitives (`UDropdownMenu`, `UInputMenu`, `UCard`, `UBadge`) over custom markup — matches D-05's explicit `UCard` requirement and the project's existing reliance on Nuxt UI components rather than hand-rolled equivalents
- `<script setup lang="ts">` for any component needing typed props/computed derivation (per RESEARCH.md's GameCard/TeamFilter examples); inline-only templates (no script block) acceptable only for purely static/declarative components like the current `TemplateMenu.vue`

### Query-key factory + immutable-data fetch (no existing analog — RESEARCH.md Pattern 1)
**Source:** RESEARCH.md `Pattern 1`
**Apply to:** `useTeams.ts`, `useGames.ts`, `queryKeys.ts`
- `staleTime: Infinity`, `gcTime: Infinity` for both queries (data never changes within a session — FOUND-03)
- Always destructure the JSON envelope (`.teams` / `.games`), never assume a bare array (Pitfall 2)

## No Analog Found

Files with no close match in the codebase — planner should rely on RESEARCH.md's Code Examples / Pattern sections instead:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/plugins/vue-query.ts` | provider | request-response | First plugin in the project; no `app/plugins/` directory exists yet. Use RESEARCH.md Pattern 1 / official TanStack Vue Query Nuxt registration example. |
| `app/utils/queryKeys.ts` | utility | transform | First `app/utils/` file. Use RESEARCH.md Pattern 1 verbatim (trivial 4-line factory). |
| `app/pages/week/[week].vue` | route | request-response | First dynamic route; `app/pages/index.vue` is a static marketing stub with no filtering/data-binding precedent. Use RESEARCH.md Pattern 3. |
| `app/components/WeekNav.vue` | component | request-response | No existing nav/pagination component. Use RESEARCH.md Pattern 3's `goToWeek` handler + Nuxt UI `UButton`/`USelect` for the week picker, respecting Pitfall 6 (query-param preservation) and D-14 (boundary disabling). |
| `public/_redirects` | config | — | Cloudflare Pages SPA-fallback text file (`/* /index.html 200`), no code pattern to extract — copy verbatim from Cloudflare's documented format per RESEARCH.md Pitfall 1. |

## Metadata

**Analog search scope:** `app/`, `scripts/lib/`, `tests/`, `shared/`, `nuxt.config.ts`, `vitest.config.ts`, `node_modules/@nuxt/ui/dist/runtime/components/*.d.ts` (referenced via RESEARCH.md's prior verification, not re-read this pass)
**Files scanned:** 13 (all files under `app/`, `scripts/`, `tests/` plus root configs)
**Pattern extraction date:** 2026-08-13
