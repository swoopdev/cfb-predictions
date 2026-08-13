# Phase 2: Foundation & Read-Only Slate - Research

**Researched:** 2026-08-13
**Domain:** Nuxt 4 static SPA data layer (TanStack Query) + dynamic-route browsing UI (Nuxt UI 4)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Filters (conference & team)**
- **D-01:** Conference filter dropdown lists all 11 conferences present in the dataset (SEC, Big Ten, Big 12, ACC, American Athletic, Conference USA, FBS Independents, Mid-American, Mountain West, Pac-12, Sun Belt) plus "All" — not just the 4 conferences that get standings later. The full slate is P4 + G5 + independents, and G5 games affect P4 teams' overall records, so hiding them from the filter would misrepresent the browse experience.
- **D-02:** Team filter is a searchable combobox (type-ahead) across all 138 teams, not a plain dropdown or conference-grouped list.
- **D-03:** Conference filter and team filter are mutually exclusive — picking a team clears any conference filter and vice versa. A team's games aren't confined to one conference (cross-conference/G5 opponents), so combining doesn't cleanly compose.
- **D-04:** G5/independent games render with identical card styling to P4 games — no visual de-emphasis. Standings scope (P4-only) is a Phase 5 concern, not a Phase 2 display concern.

**Game card layout**
- **D-05:** Games display as a responsive card grid, not a list/table. Cards must be built using Nuxt UI's Card component (`UCard` or similar) rather than a custom-built card — explicit user requirement, not just a recommendation.
- **D-06:** 127 of 888 games have an FCS/non-FBS opponent not present in `teams.json` (no logo/color/id join available). These render name-only (the raw team name string from `games.json`) with the same placeholder shield SVG fallback pattern already established in Phase 1's logo vendoring (`vendorLogo`/coverage report) — not hidden or filtered out. This preserves DATA-06/07's raw-passthrough principle.
- **D-07:** Games within a week are grouped by conference, with conference headers, sorted alphabetically. No kickoff-time data exists in the dataset to sort by otherwise.
- **D-08:** Each card shows a neutral-site badge (when `neutralSite: true`) and a conference-game badge (when `conferenceGame: true`), in addition to team names/logos.

**URL structure (SLATE-05)**
- **D-09:** Week is a path segment: `/week/{n}` (e.g. `/week/3`). Week is the primary navigation axis (SLATE-01), so it's a route, not a filter.
- **D-10:** Conference and team filters are query params on the week route: `/week/3?conf=SEC` or `/week/3?team=2628`. Both remain fully bookmarkable/shareable/back-forward-compatible.
- **D-11:** Team filter URL param is the CFBD numeric team id (e.g. `?team=2628`), matching `teams.json`'s `id` field directly — no slug generation/lookup layer needed. This is the same id used to join `games.json` ↔ `teams.json` ↔ logo files.

**Week navigation & default**
- **D-12:** Default landing week is week 1. The dataset has no "week 0" — CFBD numbers the earliest slate of games (99 games) as week 1. Confirmed with the user.
- **D-13:** Navigation controls: Prev/Next buttons plus a week picker dropdown for direct jumps.
- **D-14:** Boundary behavior: Prev is disabled at week 1, Next is disabled at week 15 (the last week present in the data).
- **D-15:** Week 14 has zero games (the dataset's weeks are 1–13, then jumps to 15). Navigation is strict numeric sequence — clicking Next from week 13 lands on week 14, which renders an empty state ("No games this week"), rather than skipping straight to 15. The week picker dropdown should still list 14 as a selectable option (with the same empty state on selection).
- **D-16:** No postseason/championship placeholder in Phase 2. All 888 fetched games are `seasonType: "regular"`; conference championship games don't exist as schedule rows and will be constructed from computed standings in Phase 5/6. Phase 2 covers exactly weeks 1–15 as fetched.

### Claude's Discretion
None — every gray area presented was explicitly decided by the user.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | The app runs as a fully static site with no runtime API key and no server routes | `ssr: false` + `nuxt generate` locked pattern (Standard Stack, Common Pitfall #1); no server routes/API keys touched anywhere in this research's recommended structure |
| FOUND-02 | A single query-key factory and set of composables (`useTeams`, `useGames`) provide typed, cached access to the static datasets via TanStack Query | Pattern 1 (query-key factory + composable), Code Examples, Pitfall 2 (envelope unwrapping) |
| FOUND-03 | A production build shows zero network fetches for schedule/team data after initial load | `staleTime: Infinity`/`gcTime: Infinity` config in Pattern 1; verification step added to Validation Architecture (`pnpm build` + manual network-tab check) |
| SLATE-01 | User can browse the schedule week by week, with a control to move to the next/previous week | Pattern 3 (route as source of truth), Recommended Project Structure (`WeekNav.vue`), D-12–D-15 |
| SLATE-02 | User can filter the visible slate down to a single conference (SEC, Big Ten, Big 12, ACC) or "All" — extended by D-01 to all 11 conferences | `ConferenceFilter.vue` (USelect/USelectMenu), Don't Hand-Roll table, Security Domain V5 (validate against known conference list) |
| SLATE-03 | User can filter the visible slate down to a single team's games | Pattern "TeamFilter.vue — UInputMenu combobox" Code Example, D-02/D-11 |
| SLATE-04 | Every game in the slate displays both teams' logos and names | `GameCard.vue` Code Example, Pitfall 5 (FCS-opponent fallback) |
| SLATE-05 | Filter selections (week, conference, team) are reflected in the URL so views are linkable and back/forward navigation works | Pattern 3, Pitfall 6 (query merge), Pitfall 1 (deep-link/static-host 404 risk), Validation Architecture test map |
</phase_requirements>

## Summary

Phase 2 has no new package decisions to make — every library it needs (`@tanstack/vue-query@5.101.4`, `@nuxt/ui@4.10.0`, `nuxt@4.5.1`) is already installed and locked in `.claude/CLAUDE.md` and confirmed present in `pnpm-lock.yaml` and `package.json` in this repo. The work is entirely composition: wire a TanStack Query plugin, write two typed composables (`useTeams`, `useGames`) that are the sole read path into the two committed JSON files, build a `/week/[week]` dynamic route with `conf`/`team` query-param filters, and render games as `UCard` grids grouped by conference. `app/` currently contains nothing but the stock Nuxt UI starter template (`index.vue`, `AppLogo.vue`, `TemplateMenu.vue`) — this phase replaces `index.vue` entirely and is the first phase to write real application code.

The two hazards worth planning around up front: (1) `ssr: false` (CLAUDE.md's locked v1 rendering mode) produces an empty `<div id="__nuxt">` shell at `nuxt generate` time — direct navigation to `/week/7` on the deployed static host will 404 unless the host has an SPA-fallback rewrite or the route is explicitly prerendered, so the plan must add both a prerender-routes list and a host-level fallback; and (2) the committed JSON is wrapped (`{ season, teams: [...] }` and `{ season, scheduleHash, games: [...] }`), not bare arrays — composables must unwrap `.teams` / `.games`, not `$fetch` the array directly.

**Primary recommendation:** One `app/plugins/vue-query.ts` (client-only dehydrate/hydrate branches can be omitted since `ssr: false` means there is no server render to dehydrate from), one `app/utils/queryKeys.ts` factory, two composables (`useTeams`, `useGames`) in `app/composables/`, shared TS types in `shared/types/` (Nuxt 4's auto-imported `#shared` scope — do not redeclare the fetch-script's `scripts/lib/schemas.ts` types, which are dev-only and not on the app's TS path), and one dynamic page `app/pages/week/[week].vue` reading `route.params.week` and `route.query.conf`/`route.query.team`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schedule/team data fetch & cache | Browser / Client (TanStack Query) | CDN / Static (`public/` JSON, served as static assets) | No backend exists (FOUND-01); TanStack Query's client cache is the only "server state" layer this app has — the CDN just serves immutable files it never processes. |
| Week/filter navigation state | Browser / Client (Vue Router via Nuxt pages) | — | SLATE-05 requires state to live in the URL, which is inherently a client-router concern in an `ssr:false` SPA; there is no server to read the URL on. |
| Conference/team filtering logic | Browser / Client (computed over cached query data) | — | Pure derivation over already-fetched, already-cached arrays — no network round-trip per filter change. |
| Game card rendering (logos, badges, FCS fallback) | Browser / Client (Nuxt UI components) | — | Presentational; D-05/D-06/D-08 are all component-level concerns. |
| Static asset hosting (JSON, logos, JS bundle) | CDN / Static | — | Cloudflare Pages serves `.output/public` verbatim; no origin compute involved (FOUND-01/03). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/vue-query` | `5.101.4` [VERIFIED: package.json:20, pnpm-lock.yaml:1792] | Typed, cached fetch layer for `teams.json`/`games.json` | Already locked by CLAUDE.md and installed; `staleTime: Infinity`/`gcTime: Infinity` is the correct config for data that never changes within a session (FOUND-02/03). |
| `@nuxt/ui` | `4.10.0` [VERIFIED: node_modules/@nuxt/ui/package.json:2, node_modules/@nuxt/ui/dist/runtime/components/{Card,Badge,InputMenu,Select,SelectMenu,Skeleton}.vue.d.ts (files read this session)] | `UCard`, `UBadge`, `USelect`/`USelectMenu`, `UInputMenu`, `USkeleton` | D-05 mandates `UCard`; `UInputMenu` (confirmed present at `node_modules/@nuxt/ui/dist/runtime/components/InputMenu.vue.d.ts`) is Nuxt UI's combobox primitive and directly supports D-02's searchable team filter via `items`, `value-key`, `label-key`, and an `#empty` slot. |
| `nuxt` | `4.5.1` [VERIFIED: package.json:21] | App framework, routing, `#shared` auto-import scope | Locked; Nuxt 4's `shared/` directory (referenced by `.nuxt/tsconfig.shared.json` in the local `tsconfig.json`, confirming the feature is active in this install) is the DRY-compliant home for the `Team`/`Game` types both `useTeams`/`useGames` and later phases (standings, tiebreakers) will consume. |

### Supporting
No new supporting libraries are required for this phase. `@vueuse/nuxt` (recommended in CLAUDE.md for `useStorage`) is a **Phase 4** concern (picks persistence) — do not install it in Phase 2; nothing in FOUND/SLATE requirements touches localStorage.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query composables | Nuxt's built-in `useFetch`/`useAsyncData` | Already rejected at the project level (CLAUDE.md "What NOT to Use" — no vue-query Nuxt module) in favor of vue-query's cache-key-driven model, which composes better with the later picks/standings `computed()` layering. Not revisited here. |
| `UInputMenu` combobox | `USelectMenu` with `searchable` | `USelectMenu` in Nuxt UI 4 is the non-combobox select variant; `UInputMenu` is the dedicated combobox/autocomplete primitive (has `mode: 'combobox'`, `filterFields`, `createItem`) and is the correct component for D-02's type-ahead requirement. |

**Installation:** None required — all dependencies already present in `package.json`/`pnpm-lock.yaml`.

**Version verification:** Confirmed via local `package.json`/`pnpm-lock.yaml`/`node_modules` inspection this session (see VERIFIED tags above) rather than `npm view`, since these are already-installed, already-locked versions, not new selections.

## Package Legitimacy Audit

No new external packages are introduced by this phase. All libraries used (`@tanstack/vue-query`, `@nuxt/ui`, `nuxt`) are pre-existing dependencies from Phase 1's scaffold, already vetted at project setup. **Package Legitimacy Gate: not applicable — no `npm install` occurs in this phase's plan.**

## Architecture Patterns

### System Architecture Diagram

```
Browser navigates to /week/3?conf=SEC
        │
        ▼
Nuxt Router matches app/pages/week/[week].vue
        │
        ▼
Page calls useTeams() + useGames()  ──────►  TanStack Query cache lookup
        │                                          │
        │                                   cache MISS (first load only)
        │                                          ▼
        │                                   $fetch('/data/2026/teams.json')
        │                                   $fetch('/data/2026/games.json')
        │                                          │
        │                                   staleTime: Infinity, gcTime: Infinity
        │                                   (cached for the rest of the session —
        │                                    FOUND-03: zero further network calls)
        │                                          │
        ▼                                          ▼
route.params.week, route.query.conf/team ◄── computed(filteredGames)
        │                                          │
        └──────────────► merge: filter games.games by week, then by
                          conf OR team (mutually exclusive, D-03)
                                   │
                                   ▼
                          group filtered games by conference,
                          sort conference keys alphabetically (D-07)
                                   │
                                   ▼
                          render UCard grid per conference group;
                          FCS-opponent games render awayTeam as raw
                          string + placeholder shield (D-06)
                                   │
                                   ▼
                          Prev/Next buttons + week picker mutate
                          route.params.week via navigateTo() —
                          browser back/forward works natively (SLATE-05)
```

### Recommended Project Structure
```
app/
├── pages/
│   ├── index.vue           # redirect to /week/1 (replaces starter template page)
│   └── week/
│       └── [week].vue      # primary slate view — reads route.params.week + route.query
├── composables/
│   ├── useTeams.ts          # wraps useQuery(queryKeys.teams(season))
│   └── useGames.ts          # wraps useQuery(queryKeys.games(season))
├── components/
│   ├── GameCard.vue         # UCard-based single-game display (D-05/D-06/D-08)
│   ├── ConferenceFilter.vue # USelect/USelectMenu, conference dropdown (D-01)
│   ├── TeamFilter.vue       # UInputMenu combobox (D-02)
│   └── WeekNav.vue          # Prev/Next + week picker (D-13/D-14/D-15)
├── plugins/
│   └── vue-query.ts         # VueQueryPlugin registration, QueryClient defaults
├── utils/
│   └── queryKeys.ts         # query-key factory: ['season', 2026, 'teams'] / ['season', 2026, 'games']
shared/
├── types/
│   └── schedule.ts          # Team, Game, FilterState — single DRY source, #shared-scope
public/
├── data/2026/{teams,games,coverage}.json   # already committed (Phase 1)
└── logos/{id}.png, placeholder.svg         # already committed (Phase 1)
```

### Pattern 1: Query-key factory + immutable-data composable
**What:** A single exported factory function producing stable, hierarchical query keys, consumed by thin composables that just call `useQuery`.
**When to use:** Any read of the static `public/data/{season}/*.json` files, this phase and every phase after it.
**Example:**
```typescript
// app/utils/queryKeys.ts
export const queryKeys = {
  teams: (season: number) => ['season', season, 'teams'] as const,
  games: (season: number) => ['season', season, 'games'] as const
}

// app/composables/useTeams.ts
import { useQuery } from '@tanstack/vue-query'
import type { Team } from '#shared/types/schedule'

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
Mirror this exactly for `useGames`, unwrapping `.games` instead of `.teams`, and remembering `games.json`'s wrapper also carries `scheduleHash` (not needed by Phase 2, but Phase 8 share-links will read it from the same composable's raw query data — don't discard it when unwrapping if a later phase might want the whole envelope; simplest DRY-safe approach is to have the composable return `{ season, scheduleHash, games }` unchanged and let call sites destructure `.games`).

### Pattern 2: Nuxt 4 `shared/` directory for cross-cutting types
**What:** `shared/types/schedule.ts` exporting `Team` and `Game` interfaces matching the committed JSON shape exactly.
**When to use:** Any type consumed by more than one composable/component/page — required by PROJECT.md's DRY constraint ("team lookup... exactly one implementation").
**Example:**
```typescript
// shared/types/schedule.ts
export interface Team {
  id: number
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string
  classification: string | null
  color: string
  alternateColor: string
  logo: string
}

export interface Game {
  id: number
  week: number
  seasonType: string
  homeId: number
  homeTeam: string
  awayId: number
  awayTeam: string
  conferenceGame: boolean
  neutralSite: boolean
}
```
[VERIFIED: public/data/2026/teams.json (Team object read this session, fields: `id, school, mascot, abbreviation, conference, classification, color, alternateColor, logo`); public/data/2026/games.json (Game object read this session, fields: `id, week, seasonType, homeId, homeTeam, awayId, awayTeam, conferenceGame, neutralSite`)]. Do not import `scripts/lib/schemas.ts`'s `TeamOutput`/`GameOutput` into `app/` — that file is on `tsconfig.scripts.json`'s program only (`include: ["scripts/**/*.ts", "tests/**/*.ts"]`), not the Nuxt app's TS project, and it also lacks the `logo` field that the fetch script adds to teams *after* calling `transformTeam` (see `scripts/fetch-data.ts:51-54` — `logo` is bolted on outside the schema). Redeclaring in `shared/types/` is correct, not duplication, because the two types describe different pipeline stages (raw-fetch-script-output vs. committed-JSON-consumed-by-app).

### Pattern 3: Route as source of truth for week + filters (SLATE-05, D-09/D-10/D-11)
**What:** `week` as a required dynamic path segment; `conf`/`team` as optional query params; a single `computed` deriving filtered/grouped games from `route.params`/`route.query` plus the two composables' cached data.
**When to use:** The `week/[week].vue` page, exclusively — this is the one integration point that reads both composables and the route.
**Example:**
```vue
<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const week = computed(() => Number(route.params.week))
const conf = computed(() => route.query.conf as string | undefined)
const teamId = computed(() => route.query.team ? Number(route.query.team) : undefined)

const { data: teams } = useTeams()
const { data: games } = useGames()

function setConf(value: string | undefined) {
  router.push({ query: { conf: value, team: undefined } }) // D-03: mutually exclusive
}
function setTeam(id: number | undefined) {
  router.push({ query: { team: id, conf: undefined } })
}
function goToWeek(n: number) {
  router.push({ params: { week: n }, query: route.query }) // preserve filters across week nav
}
</script>
```
Nuxt's file-based router auto-generates `[week].vue` -> `/week/:week` and exposes it on `useRoute().params.week` as a **string**; coerce with `Number()` before comparing against `Game.week` (a `number` per the committed JSON). `router.push({ query: {...} })` merges are *not* automatic in Vue Router — passing `query: { conf: value }` alone **drops** `team` unless explicitly included/excluded, which is exactly what D-03's mutual-exclusivity requires (explicitly clearing the other key), but `goToWeek` must explicitly re-spread `route.query` or the act of changing weeks will silently clear the active filter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable team combobox | Custom `<input>` + filtered `<ul>` dropdown with manual keyboard nav | `UInputMenu` (`items`, `value-key="id"`, `label-key="school"`, `#empty` slot) | Nuxt UI 4 ships full ARIA combobox semantics (Reka UI `Combobox` primitives) and built-in filtering (`filterFields`) — D-02 is satisfied by props alone, not custom logic. |
| Game card chrome (logos, badges, layout) | Bespoke `<div>`-based card | `UCard` (explicit user requirement, D-05) | Also gets Nuxt UI's theming/dark-mode/spacing tokens for free, satisfying the UI-SPEC's spacing scale without hand-tuned CSS. |
| Loading skeleton | Custom pulse-animation `<div>`s | `USkeleton` shaped like `UCard` (per UI-SPEC's "6 `USkeleton` placeholders") | Already a themed Nuxt UI primitive; matches the design system automatically. |
| URL query-param sync | Manual `window.history.pushState` + `popstate` listener | Nuxt's file-based router + `useRoute()`/`useRouter()`/`navigateTo()` | Nuxt/Vue Router already gives back/forward-compatible, SSR-safe (moot here but still correct) URL state for free — SLATE-05 is a routing concern, not a custom-sync concern. |

**Key insight:** Every "don't hand-roll" item in this phase is already solved by a component or router feature already in the installed stack — the risk in Phase 2 isn't reaching for the wrong library, it's mis-wiring the already-correct pieces (dropping query params on navigation, forgetting to unwrap the JSON envelope, coercing route params inconsistently).

## Common Pitfalls

### Pitfall 1: `ssr: false` + `nuxt generate` produces empty-shell HTML, and direct navigation to un-prerendered dynamic routes 404s on a static host
**What goes wrong:** With `ssr: false` (CLAUDE.md's locked v1 pattern), `nuxt generate` emits `<div id="__nuxt"></div>` for every route instead of real content [CITED: https://nuxt.com/docs/4.x/getting-started/deployment — "ssr: false... will produce HTML pages with an empty div"]. Worse, dynamic segments like `/week/7` are not automatically discovered/generated unless something crawls to them or they're explicitly listed — a static host (Cloudflare Pages) serving files directly will 404 on a fresh browser tab opened at `https://.../week/7` even though client-side `<NuxtLink>` navigation to that same URL works fine.
**Why it happens:** Static hosts serve exactly the files Nitro's prerender step produced; `ssr:false` alone does not populate `.output/public/week/{1..15}/index.html` unless prerendering is configured, and even when it is, the content inside is the same empty shell (no SEO gain, but the *file* existing is what prevents the 404).
**How to avoid:** Two layers of defense, both cheap: (1) add `nitro.prerender.routes: ['/week/1','/week/2',...,'/week/15']` (or seed `routeRules: { '/': { prerender: true } }` plus rely on Nitro's `crawlLinks` default to follow real `<NuxtLink>` anchors from week to week via Prev/Next, since the week nav produces real `<a href>` elements) so each week gets a static file; (2) still add a Cloudflare Pages SPA fallback (`public/_redirects` containing `/* /index.html 200`) as a backstop for any URL not explicitly generated, including future query-param combinations. Verify by running `pnpm build && ls .output/public/week/` after implementation, not just by testing `pnpm dev`.
**Warning signs:** `pnpm dev` and client-side nav work perfectly; a deployed preview shows a 404 page only when a `/week/N` URL is opened directly (bookmarked, shared, or refreshed) — this is the exact bug FOUND-03/SLATE-05's "linkable" requirement would catch in manual QA but is easy to miss if verification only ever clicks through the app rather than pasting a deep link into a fresh tab.

### Pitfall 2: Reading `games.json`/`teams.json` as bare arrays instead of `{ season, ... }` envelopes
**What goes wrong:** `teams.json` is `{ season: 2026, teams: Team[] }` and `games.json` is `{ season: 2026, scheduleHash: string, games: Game[] }` [VERIFIED: public/data/2026/teams.json, public/data/2026/games.json (both read this session; top-level keys confirmed via `Object.keys()`: `teams.json` → `["season","teams"]`, `games.json` → `["season","scheduleHash","games"]`)]. A composable written against a bare-array assumption (`const teams = await $fetch<Team[]>(...)`) will type-check locally against a hand-written interface but throw at runtime (`teams.find is not a function`) or silently return `undefined` array methods.
**Why it happens:** Many "static JSON over `$fetch`" tutorials show bare-array examples; this project's fetch script (Phase 1) deliberately wraps every output for the `scheduleHash`/`season` fingerprinting SHARE-03 will need later, which composable authors in Phase 2 have no direct visibility into unless they open the actual committed file.
**How to avoid:** Composables must destructure `.teams` / `.games` explicitly from the fetch result; add a one-line test asserting `useTeams()` resolves an array of length 138 and `useGames()` resolves an array of length 888, so a future accidental un-wrap regresses loudly.
**Warning signs:** `.length` returns `undefined`, `.filter is not a function`, or (if `Team[]`/`Game[]` typed too loosely as `any`) the grid silently renders zero cards with no console error.

### Pitfall 3: `route.params.week` is a string; comparing it to `Game.week` (a number) without coercion silently matches nothing
**What goes wrong:** Vue Router always yields route params as strings. `games.filter(g => g.week === route.params.week)` compares `number === string` and is always `false` — the week view renders permanently empty with no error.
**Why it happens:** TypeScript won't catch this unless `Game['week']` and the comparison are both strictly typed and `strict` mode is on (it is, per `tsconfig.scripts.json`, and Nuxt's generated app tsconfig also defaults to strict) — but `route.params.week` typically resolves to `string | string[]` in Nuxt's route typing, which TS will happily compare to a `number` in a loose `==`-adjacent lint config, and even under `strict` a `Number(route.params.week) === g.week` typo (missing the `Number()` call) won't be flagged if the comparison is buried inside a `.filter()` callback with inferred types.
**How to avoid:** Coerce once, at the top of the page's `<script setup>` (`const week = computed(() => Number(route.params.week))`), and use only the coerced `computed` everywhere downstream — never re-read `route.params.week` directly in filter logic.
**Warning signs:** Empty grid on every week, including week 1 (as opposed to Pitfall 4's week-14-only emptiness), with no console error.

### Pitfall 4: Confusing "week has zero games" (D-15, week 14) with "filter narrowed to zero games" (bye week) — they need different empty-state copy
**What goes wrong:** Both states look identical structurally (empty grid) and it's tempting to route both through one `<EmptyState />` with generic copy. UI-SPEC explicitly defines two different headings/bodies ("No games this week" vs. "No games match this filter") — collapsing them to one contradicts the approved UI-SPEC and confuses users about whether clearing the filter will help.
**Why it happens:** Both are "zero results" from the same rendering code path (`filteredGames.length === 0`), so a naive implementation checks only that one condition.
**How to avoid:** Branch on *why* it's empty: if `conf`/`team` query params are unset and the raw week's games (pre-filter) are already zero-length, show the week-empty copy; if a filter is active and it's the filter that zeroed out an otherwise non-empty week, show the filter-empty copy. This requires computing "games in this week, unfiltered" and "games in this week, filtered" as two separate `computed`s, not one.
**Warning signs:** Week 14 (always empty) and a team's bye week (empty only when that team's filter is active) show the same message; UI review / plan-checker will flag this against the UI-SPEC contract.

### Pitfall 5: FCS-opponent games have no `awayId` match in `teams.json` — code that assumes every `Game.awayId` resolves to a `Team` will crash or silently mis-render
**What goes wrong:** 127 of 888 games [VERIFIED: public/data/2026/games.json + public/data/2026/teams.json, cross-referenced this session via `Set` membership check — 127 games where `awayId` is not present in `teams.teams`, e.g. game id 401864425: `{"awayId": 2698, "awayTeam": "West Georgia", ...}`, 2698 absent from `teams.json`'s 138 entries] have an away opponent that only exists as a raw string (`awayTeam`), not a joinable `Team` record. A `teamById.get(game.awayId).logo` lookup throws (`Cannot read properties of undefined`) for these 127 games; a `?.` optional-chain masks the crash but still needs D-06's explicit placeholder-shield + name-only fallback to satisfy the requirement, not just avoid the crash.
**How to avoid:** The `GameCard` component must branch per side: `homeId` is guaranteed resolvable (0 games have a missing `homeId` [VERIFIED: public/data/2026/games.json + public/data/2026/teams.json, cross-referenced this session, `homeMissing.length === 0`]), but `awayId` must always go through a lookup that can return `undefined` and fall back to `{ school: game.awayTeam, logo: '/logos/placeholder.svg' }` — reuse the exact placeholder path Phase 1 already vendored (`public/logos/placeholder.svg`, confirmed present this session), not a new asset.
**Warning signs:** Console error mentioning `awayId`/`undefined` reading `.logo` or `.school` when paging through early weeks (week 1 has the highest FCS-opponent count — 48 [VERIFIED: public/data/2026/games.json, computed this session via `.filter(g=>!teamIds.has(g.awayId))` grouped by week: `{1: 48, 2: 37, 3: 18, 4: 13, 5: 3, 7: 3, 10: 1, 12: 4}`] — so this bug is unmissable on the default landing week, not a rare edge case).

### Pitfall 6: Query-param mutation without preserving the other params clears filters on every week change
**What goes wrong:** Vue Router's `router.push({ query: {...} })` **replaces** the entire query object, it does not merge. A `goToWeek(n)` handler written as `router.push({ params: { week: n } })` with no `query` key silently drops any active `conf`/`team` filter the instant the user clicks Next/Prev.
**Why it happens:** Developers coming from simpler routing setups expect params and query to merge automatically; Vue Router requires explicit re-inclusion.
**How to avoid:** Every navigation call that changes only one URL segment (week, or one filter) must explicitly spread the other current URL state (`query: route.query` when changing week; `query: { ...route.query, team: undefined }` when setting conf, etc.).
**Warning signs:** Filter selection visibly resets to "All" every time Prev/Next is clicked — an easy miss in manual testing if the tester doesn't specifically test "filter, then page a week."

## Code Examples

### GameCard.vue — FCS-opponent-safe rendering (D-06, D-08)
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

<template>
  <UCard>
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <img :src="away.logo" class="size-8 shrink-0" alt="">
        <span class="truncate" :title="away.school">{{ away.school }}</span>
      </div>
      <span class="text-dimmed">@</span>
      <div class="flex items-center gap-2 min-w-0">
        <img :src="home?.logo" class="size-8 shrink-0" alt="">
        <span class="truncate" :title="home?.school">{{ home?.school }}</span>
      </div>
    </div>
    <div v-if="game.neutralSite || game.conferenceGame" class="flex gap-1 mt-2">
      <UBadge v-if="game.neutralSite" color="neutral" variant="subtle" label="Neutral site" />
      <UBadge v-if="game.conferenceGame" color="primary" variant="subtle" label="Conference game" />
    </div>
  </UCard>
</template>
```
Source: component structure derived from `node_modules/@nuxt/ui/dist/runtime/components/{Card,Badge}.vue.d.ts` (read this session — `CardSlots` = `header/title/description/default/footer`; `BadgeProps` = `label, color, variant, size`), combined with D-06/D-08/D-06 field names verified directly against `public/data/2026/games.json`/`teams.json` this session.

### TeamFilter.vue — UInputMenu combobox (D-02)
```vue
<script setup lang="ts">
const teamId = defineModel<number | undefined>()
const { data: teams } = useTeams()
</script>

<template>
  <UInputMenu
    v-model="teamId"
    :items="teams ?? []"
    value-key="id"
    label-key="school"
    placeholder="Search teams…"
  >
    <template #empty>No teams found</template>
  </UInputMenu>
</template>
```
Source: `node_modules/@nuxt/ui/dist/runtime/components/InputMenu.vue.d.ts` (read this session) — confirms `items`, `valueKey`, `labelKey`, `modelValue`, and an `empty` slot (`'empty'?(props: { searchTerm: string }): VNode[]`) all exist on this exact installed version, matching UI-SPEC's "No teams found" empty-state contract.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@tanstack/vue-query-nuxt` community modules (`@hebilicious/vue-query-nuxt`, `nuxt-vue-query`) | Hand-written `~15-line` Nuxt plugin calling `VueQueryPlugin` directly | Both modules last published 2023 [already documented in CLAUDE.md "What NOT to Use"] | Confirmed still correct in 2026 — no newer maintained module has superseded them; the official TanStack docs' own Nuxt example (see Code Examples/Pattern 1 above) is a hand-rolled plugin, not a module, which is the pattern this project should follow. |

**Deprecated/outdated:** Nothing else in this phase's stack has shifted since CLAUDE.md was written (2026-08-12/13) — all version numbers re-checked this session match CLAUDE.md's locked table exactly.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `nitro.prerender.routes` (or crawler-discovered links) is the correct/sufficient mechanism to make `/week/1`..`/week/15` resolve as static files under `ssr:false`, and a Cloudflare Pages `_redirects` fallback is additionally needed for defense-in-depth | Common Pitfalls #1 | If wrong, deployed deep-links to non-week-1 routes 404 in production even though `pnpm dev` and CI both pass — this is a deploy-time-only failure mode, not caught by any local verification step unless the plan explicitly runs `pnpm build` and inspects `.output/public/week/`. |
| A2 | The TanStack Query Nuxt plugin does not need the `dehydrate`/`hydrate` server-branch code (shown in the official SSR-mode example) because `ssr:false` means there is no server render to dehydrate from | Pattern 1 / Standard Stack | Low risk — if wrong, the app still functions (client always fetches fresh on first load either way with `ssr:false`); worst case is a few extra bytes of unused plugin code, not a functional bug. |
| A3 | `router.push({ query: {...} })` fully replaces (does not merge) the query object in this Nuxt/Vue Router version | Pitfall 6 | This is standard, long-stable Vue Router behavior (not version-specific to this project's `nuxt@4.5.1`), but was not independently re-verified against the exact installed `vue-router` version this session — if it has changed to auto-merge, the "explicitly re-spread `route.query`" guidance in Pattern 3/Pitfall 6 becomes unnecessary defensive code rather than a required fix. |

## Open Questions

1. **Does `nuxt generate` under `ssr:false` actually run the Nitro prerender crawler at all, or does it produce exactly one `index.html` SPA shell regardless of `routeRules`/`nitro.prerender` config?**
   - What we know: Nuxt's own docs distinguish `ssr:true`+`nuxt generate` (full per-route prerendering, real content) from `ssr:false` (empty-div shell per route) — implying per-route files ARE still produced under `ssr:false`, just with empty content, which is exactly what's needed to avoid a 404 (the *file* existing matters more than its *content* here since the SPA hydrates client-side regardless).
   - What's unclear: Whether `nitro.prerender.routes` entries under `ssr:false` are honored to produce per-path files, or whether Nitro's static preset collapses everything to one shell + `_redirects`/`200.html` fallback automatically, making the explicit routes list redundant.
   - Recommendation: The plan should include a concrete verification task — run `pnpm build` (or `nuxt generate`), then `ls .output/public/week/` — before relying on either mechanism, and treat "add a Cloudflare Pages SPA fallback" as the reliable backstop regardless of what the prerender step does.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `pnpm dev`/`pnpm build` | ✓ | 24.13.0 [VERIFIED: local `node -v` output this session] | — |
| `@tanstack/vue-query` | FOUND-02 composables | ✓ | 5.101.4 [VERIFIED: package.json:20] | — |
| `@nuxt/ui` (Card/Badge/InputMenu/Select/Skeleton) | SLATE-01–04 UI | ✓ | 4.10.0 [VERIFIED: node_modules/@nuxt/ui/package.json:2] | — |
| `@nuxt/test-utils`, `@vue/test-utils`, `happy-dom`/`jsdom` | Component-level tests (recommended by CLAUDE.md, not yet installed) | ✗ | — | See Validation Architecture — Wave 0 must add these before any `.vue`-mounting test is written; pure-logic filter/group functions can be tested today in the existing `node` vitest project without them. |

**Missing dependencies with no fallback:** None — the phase can ship without component-mount tests if time-constrained (logic tests cover the highest-risk filtering/grouping code).

**Missing dependencies with fallback:** `@nuxt/test-utils`/`@vue/test-utils`/`happy-dom` — fallback is testing filter/grouping logic as plain functions in the existing `tests/*.test.ts` node environment, deferring true component-mount tests until these packages are added (Wave 0 gap below).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:32] |
| Config file | `vitest.config.ts` [VERIFIED: file read this session — `environment: 'node'`, `include: ['tests/**/*.test.ts']`, `passWithNoTests: true`] |
| Quick run command | `pnpm test -- tests/<file>.test.ts` |
| Full suite command | `pnpm test` (= `vitest run`) |

The existing `vitest.config.ts` runs a single `node`-environment project — sufficient for pure-function tests (filter/group logic) but **not** for mounting `.vue` components (no DOM, no `@vue/test-utils`). CLAUDE.md recommends adding a `defineVitestProject`-based Nuxt/component project (`@nuxt/test-utils` + `@vue/test-utils` + `happy-dom`) for that; this phase's plan should decide whether component-mount tests are in scope or whether logic-only tests suffice for Phase 2's UAT (rendering correctness is highly visible in manual dev-server verification, unlike the standings/tiebreaker math in later phases where logic tests are load-bearing).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-02 | `useTeams`/`useGames` resolve typed arrays of length 138/888 from the correct JSON envelope | unit (composable, needs Vue reactivity — can run in `node` env with `@vue/test-utils`'s `flushPromises` or a minimal Vue app harness) | `vitest run tests/composables/useTeams.test.ts` | ❌ Wave 0 |
| SLATE-02/03 | Conference filter and team filter each narrow the game list correctly; mutual exclusivity (D-03) holds | unit (pure function extracted from the page, e.g. `filterGames(games, { conf, team })`) | `vitest run tests/lib/filter-games.test.ts` | ❌ Wave 0 |
| D-07 | Games within a week group by conference, sorted alphabetically | unit (pure function `groupByConference(games, teamsById)`) | `vitest run tests/lib/group-games.test.ts` | ❌ Wave 0 |
| D-15 | Week 14 (zero games) and a filtered bye-week (zero games post-filter) route to distinct empty states | unit (pure function determining empty-state variant) or manual UAT | `vitest run tests/lib/empty-state.test.ts` OR manual: visit `/week/14`, then `/week/1?team=<a-team-with-a-bye>` | ❌ Wave 0 (or manual-only if the logic stays inline in the page) |
| SLATE-04 | Every card shows both teams' logos and names, including FCS-opponent name-only fallback | manual UAT (visual) — component-mount test optional if `@vue/test-utils` is added | manual: page through week 1 (48 FCS games present) and confirm no broken images/crashes | N/A (manual) |
| SLATE-05 | URL reflects week/filter state; back/forward works; deep-linking a non-week-1 URL loads correctly (including after `pnpm build`) | manual UAT (browser back/forward + fresh-tab deep link) + a build-output check (`ls .output/public/week/`) | manual, plus `pnpm build && ls .output/public/week/` | N/A (manual + build check) |

### Sampling Rate
- **Per task commit:** `vitest run tests/lib/*.test.ts` (fast, pure-function tests only)
- **Per wave merge:** `pnpm test` (full suite) + `pnpm build` (verify static output, per Pitfall 1)
- **Phase gate:** Full suite green, `pnpm build` succeeds and produces per-week static files (or documented fallback), before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/filter-games.test.ts` — covers SLATE-02, SLATE-03, D-03 (mutual exclusivity)
- [ ] `tests/lib/group-games.test.ts` — covers D-07 (conference grouping/sorting)
- [ ] `tests/composables/useTeams.test.ts`, `tests/composables/useGames.test.ts` — covers FOUND-02 (envelope unwrapping, correct lengths); needs a minimal Vue/QueryClient test harness, not necessarily full `@nuxt/test-utils`
- [ ] Decide: install `@nuxt/test-utils` + `@vue/test-utils` + `happy-dom` for true component-mount tests this phase, or defer to a later UI-heavy phase and rely on manual UAT for SLATE-04/05's visual/routing requirements — **this is a scope decision the plan must make explicitly**, since CLAUDE.md recommends these packages but they are not yet installed and Phase 2 is the first phase that would use them.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts anywhere in v1 (SCEN-05); not relevant to this phase. |
| V3 Session Management | no | No sessions; app is stateless per-tab except URL state. |
| V4 Access Control | no | No authorization boundaries; all data is public schedule data. |
| V5 Input Validation | yes | `route.query.conf`/`route.query.team` are attacker/user-controllable URL input (arbitrary strings can be pasted into a share link). Validate `conf` against the known 11-conference list (or "All") and `team` against `Number.isInteger` + presence in the loaded `teams` array before using either to filter; on validation failure, fall back to unfiltered ("All") rather than crashing or rendering a broken filtered state. Vue's template interpolation auto-escapes `{{ }}` bindings, so reflected-XSS risk from rendering an invalid `conf` string directly is low but not zero if any code path ever uses `v-html` or sets a raw attribute from it — this phase should not introduce any `v-html` usage at all. |
| V6 Cryptography | no | No secrets, no crypto, no API keys reach the browser (FOUND-01) — the CFBD key lives only in the Phase-1 fetch script's `.env`, never bundled into `app/`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/out-of-range `?team=` or `?conf=` query param (e.g. `?team=99999999`, `?conf=<script>`) causing a crash, an unhandled `undefined` render, or (if ever combined with `v-html`) reflected XSS | Tampering / Denial of Service (client-side) | Validate against known-good sets (loaded `teams` id list; the fixed 11-conference + "All" list) before filtering; treat validation failure as "no filter applied," matching the resilience pattern SHARE-04 will later apply to share-link payloads — this phase is the first place that pattern needs to exist, informally, for raw URL params. |
| Direct navigation / crawler hitting a non-generated dynamic route on the static host | Information Disclosure (inverted — availability) | Covered under Common Pitfalls #1 / Open Question 1 — SPA fallback + explicit prerender routes. |

## Sources

### Primary (HIGH confidence)
- `C:/Users/hanco/Downloads/CFB/package.json`, `pnpm-lock.yaml`, `nuxt.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.scripts.json` — read this session, confirm installed versions and build config
- `C:/Users/hanco/Downloads/CFB/public/data/2026/teams.json`, `games.json`, `coverage.json` — read/queried this session, confirm exact committed data shape, counts, and FCS-opponent edge cases
- `C:/Users/hanco/Downloads/CFB/scripts/fetch-data.ts`, `scripts/lib/schemas.ts` — read this session, confirm the fetch script's output shape and where `logo` is bolted on outside the Zod schema
- `node_modules/@nuxt/ui/dist/runtime/components/{Card,Badge,InputMenu}.vue.d.ts` — read this session, confirm exact prop/slot surface of the components D-05/D-08/D-02 require, against the actually-installed 4.10.0

### Secondary (MEDIUM confidence)
- https://nuxt.com/docs/4.x/getting-started/deployment — `ssr:false` empty-shell behavior, 200.html/404.html fallback pattern (WebFetch this session)
- https://tanstack.com/query/v5/docs/framework/vue/guides/ssr — official Nuxt 3 plugin registration pattern for `@tanstack/vue-query` (WebFetch this session)
- `.claude/CLAUDE.md` — project-level locked stack decisions, already MEDIUM-confidence-sourced per its own citations

### Tertiary (LOW confidence)
- None — no unverified WebSearch-only claims were used as the basis for a Standard Stack or Architecture recommendation in this document; the two Open-Question items above are flagged rather than asserted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - every library is already installed and version-verified locally; zero new package decisions
- Architecture: HIGH - route/composable/component structure follows Nuxt 4 conventions already partially in place (`.nuxt/tsconfig.shared.json` confirms `shared/` is live) and directly implements CONTEXT.md's explicit D-01–D-16 decisions
- Pitfalls: MEDIUM-HIGH - data-shape and FCS-opponent pitfalls are VERIFIED against the actual committed files; the `ssr:false`/prerendering pitfall is CITED from official docs but not empirically reproduced against this exact repo's build output (flagged as Open Question 1)

**Research date:** 2026-08-13
**Valid until:** 2026-09-12 (30 days — stable, already-locked stack; re-verify sooner only if `@nuxt/ui` or `nuxt` receive a major-version bump before planning executes)
