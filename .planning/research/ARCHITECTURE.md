# Architecture Research

**Domain:** Client-side sports prediction / derived-standings web app (Nuxt 4 static SPA)
**Researched:** 2026-08-12
**Confidence:** MEDIUM (see Confidence & Verification at the end — the Nuxt/TanStack/Vue mechanics are drawn from first-party docs and direct `node_modules` inspection; the conference tiebreaker step orders are from secondary sources and need primary-source verification during the tiebreaker phase)

---

## The One Number That Drives This Architecture

Before any structural decision, establish scale. The 2026 FBS season has **~138 teams** and on the order of **~900 regular-season games involving an FBS team** (138 × 12 ÷ 2 ≈ 830, plus FCS opponents). The four P4 conferences hold ~67 teams and ~64 conference games each.

A full recompute — one pass over every game to build every team's record, then sort four conferences, then run tiebreakers — is **~1,000 iterations plus four sorts of ≤18 elements**. That is sub-millisecond in JavaScript.

**Therefore: there is no incremental invalidation in this app.** No dirty tracking, no per-conference caches keyed on which games changed, no memoized partial standings. Every pick change recomputes the entire season model from scratch. The question posed — "what stays performant when a single pick invalidates standings for a whole conference?" — has the answer: *everything invalidates, and it costs nothing.*

This is the single most important architectural decision here, because it deletes an entire category of complexity (invalidation graphs) from a codebase whose actual risk is correctness of the tiebreaker math. The real performance risks in this app are elsewhere, and they are both Vue-layer, not algorithm-layer:

1. **Deep reactivity over the static data.** Vue's reactivity proxies every property access; a deeply-reactive array of ~900 game objects is measurable overhead on every render pass that touches it. Solved with `shallowRef` / `markRaw` and never mutating the data.
2. **Rendering ~900 game cards.** Solved for free by the week-first navigation already in PROJECT.md — a week is ~60 games, which renders fine without virtualization.

Design the reactive graph for *clarity and single-implementation*, not for speed. Speed is not in contention.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  PRESENTATION  (app/pages, app/components)                            │
│  ┌───────────┐ ┌───────────┐ ┌────────────────┐ ┌─────────────────┐  │
│  │ SlateView │ │ Standings │ │ TiebreakerTrace│ │ ScenarioSwitcher│  │
│  │  (week)   │ │   Panel   │ │   (+ override) │ │                 │  │
│  └─────┬─────┘ └─────┬─────┘ └───────┬────────┘ └────────┬────────┘  │
│        │ read+write  │ read          │ read+write        │ read+write │
├────────┴─────────────┴───────────────┴───────────────────┴───────────┤
│  COMPOSABLE LAYER  (app/composables)  — Vue reactivity lives ONLY here│
│  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────────┐   │
│  │ useTeams   │ │ useGames  │ │ usePicks │ │ useStandings(conf)  │   │
│  │ useTeam(id)│ │ useWeek() │ │useScenari│ │ useTiebreakers(conf)│   │
│  │useTeamIndex│ │           │ │   os     │ │ useSeasonModel()    │   │
│  └─────┬──────┘ └─────┬─────┘ └────┬─────┘ └──────────┬──────────┘   │
├────────┼──────────────┼────────────┼──────────────────┼──────────────┤
│  DATA ACCESS         │            │  STATE           │  DERIVATION    │
│  ┌───────────────────┴──────┐ ┌───┴──────────────┐   │                │
│  │ TanStack Query (v5)      │ │ useState + local │   │                │
│  │  seasonKeys factory      │ │ Storage (picks,  │   │                │
│  │  staleTime: Infinity     │ │ scenarios,       │   │                │
│  └───────────┬──────────────┘ │ overrides)       │   │                │
│              │                └───┬──────────────┘   │                │
├──────────────┼────────────────────┼──────────────────┼────────────────┤
│  DOMAIN  (shared/)  — PURE TypeScript, ZERO Vue imports               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ indexTeams()  deriveRecords()  computeStandings()                │ │
│  │ resolveTiebreakers(rules, standings, games, overrides)           │ │
│  │ CONFERENCE_RULES (data table)   encodeScenario/decodeScenario    │ │
│  │ deriveSeason()  ← single entry point, reference-memoized         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  STATIC DATA  (app/data/*.json, public/logos/*)  — build-time output  │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────────┐  │
│  │ teams.2026.json│ │ games.2026.json│ │ public/logos/{teamId}.png│  │
│  └────────────────┘ └────────────────┘ └──────────────────────────┘  │
│         ▲ produced by scripts/fetch-season.ts + vendor-logos.ts       │
└──────────────────────────────────────────────────────────────────────┘

DEPENDENCY DIRECTION IS STRICTLY DOWNWARD.
The domain layer knows nothing about Vue, Nuxt, TanStack Query, or the DOM.
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `shared/domain/` | All season math: records, standings, tiebreakers, share codec. Deterministic, pure, exhaustively unit-tested. | Plain `.ts` modules, explicitly imported via `#shared/...` |
| `shared/types/` | `Team`, `Game`, `PickSet`, `Scenario`, `ConferenceStanding`, `TiebreakerResult` | Auto-imported by Nuxt (types only — no runtime collision risk) |
| `app/utils/queryKeys.ts` | The single query-key factory, season-parameterized | Auto-imported `seasonKeys` object |
| `app/composables/useTeams,useGames` | Wrap static JSON in TanStack Query. The swap seam for a future `/api/` route. | `useQuery` with `staleTime: Infinity` |
| `app/composables/useTeamIndex` | O(1) team lookup by id / conference | `computed` over a reference-memoized pure index |
| `app/composables/usePicks` | The **only** mutable state. Read/write picks + tiebreaker overrides for the active scenario. | `useState` + `shallowRef` + localStorage, immutable replace |
| `app/composables/useScenarios` | Named scenario CRUD, active-scenario selection, share-link import/export | `useState` + localStorage |
| `app/composables/useSeasonModel` | The one place picks + games + teams are joined into records/standings/tiebreakers | `computed` calling `deriveSeason()` |
| `app/composables/useStandings(conf)`, `useTiebreakers(conf)` | Narrow views onto `useSeasonModel()` | `computed` selectors — **no math of their own** |
| `scripts/` | CFBD fetch, logo vendoring. Run on demand, never on dev start. | Node scripts, output committed |

---

## Recommended Project Structure

```
cfb-predictions/
├── app/                              # Nuxt 4 srcDir (Vue side)
│   ├── components/
│   │   ├── slate/
│   │   │   ├── SlateWeekNav.vue      # week selector (state → route query)
│   │   │   ├── SlateFilters.vue      # conference/team filter (→ route query)
│   │   │   ├── GameList.vue          # resolves teams ONCE, renders cards
│   │   │   └── GameCard.vue          # one game, one pick interaction
│   │   ├── team/
│   │   │   ├── TeamBadge.vue         # logo + name + safe accent color
│   │   │   └── TeamColorChip.vue     # contrast-guarded color swatch
│   │   ├── standings/
│   │   │   ├── StandingsPanel.vue    # one conference table
│   │   │   ├── StandingsRow.vue
│   │   │   └── ChampionshipCard.vue  # the two CCG participants
│   │   ├── tiebreaker/
│   │   │   ├── TiebreakerTrace.vue   # renders result.trace — no rule logic
│   │   │   └── TiebreakerResolver.vue# manual ordering UI for pending ties
│   │   └── scenario/
│   │       ├── ScenarioSwitcher.vue
│   │       └── ShareDialog.vue
│   ├── composables/                  # TOP-LEVEL ONLY (Nuxt scan depth = 1)
│   │   ├── useTeams.ts               # + useTeam, useTeamIndex
│   │   ├── useGames.ts               # + useWeek, useFilteredGames
│   │   ├── usePicks.ts
│   │   ├── useScenarios.ts
│   │   ├── useSeasonModel.ts         # the derived-state spine
│   │   ├── useStandings.ts           # + useTiebreakers
│   │   └── useTeamAccent.ts          # contrast-safe team color
│   ├── utils/
│   │   ├── queryKeys.ts              # export const seasonKeys = {...}
│   │   └── storageKeys.ts            # export const storageKeys = {...}
│   ├── data/
│   │   ├── teams.2026.json           # committed, produced by fetch script
│   │   └── games.2026.json           # committed
│   ├── pages/
│   │   └── index.vue                 # the slate; filters live in ?query
│   ├── plugins/
│   │   └── vue-query.ts              # QueryClient install
│   └── app.vue
│
├── shared/                           # PURE — Nuxt FORBIDS Vue/Nitro imports here
│   ├── types/                        # auto-imported both sides
│   │   ├── team.ts
│   │   ├── game.ts
│   │   ├── picks.ts
│   │   └── standings.ts
│   └── domain/                       # NOT auto-imported — explicit #shared/domain/*
│       ├── index.ts                  # deriveSeason() — the single entry point
│       ├── teamIndex.ts
│       ├── records.ts
│       ├── standings.ts
│       ├── tiebreakers/
│       │   ├── engine.ts             # generic step-walker
│       │   ├── steps.ts              # each step as a pure function
│       │   └── rules.ts              # CONFERENCE_RULES data table
│       ├── codec.ts                  # share-link encode/decode
│       └── memo.ts                   # reference-keyed memo helper
│
├── shared/domain/__tests__/          # vitest, node env, no Nuxt runtime
│   ├── standings.test.ts
│   ├── tiebreakers.sec.test.ts
│   ├── tiebreakers.bigten.test.ts
│   ├── tiebreakers.multiway.test.ts  # the high-risk suite
│   └── codec.test.ts                 # round-trip property tests
│
├── scripts/
│   ├── fetch-season.ts               # CFBD → app/data/*.json
│   └── vendor-logos.ts               # CFBD/cfb-web → public/logos/
│
├── public/logos/{teamId}.png         # vendored, committed
└── vitest.config.ts                  # alias #shared → ./shared
```

### Structure Rationale

**`shared/` for the domain layer — and the reason is enforcement, not convention.**

This is the answer to question 3, and Nuxt 4 makes it unusually clean. Nuxt's `shared/` directory *forbids* importing Vue components, Vue composables, Nitro server APIs, and Nuxt context (`useNuxtApp`, `useRoute`). That is exactly the constraint you want on a domain layer, and here the framework enforces it rather than a code-review habit. Put the standings/tiebreaker engine in `shared/` and it *cannot* accidentally grow a `ref()`.

Compare the alternatives:

| Option | Verdict |
|--------|---------|
| `app/utils/` | Rejected. Auto-imported (good) but nothing stops a `computed()` creeping in, and it is Vue-side only. The purity guarantee is the whole point. |
| Local workspace package | Rejected for v1. `pnpm-workspace.yaml` already exists so it's cheap to *reach for*, but it adds a build step, TS project references, and a publish/link cycle to every domain edit. Correct only if the engine is later consumed by a second app. Note it as the v2 escape hatch if the CFP bracket becomes its own thing. |
| **`shared/`** | **Recommended.** Framework-enforced purity, `#shared/*` alias for explicit imports, testable with plain vitest and zero Nuxt runtime. |

**The auto-import split is deliberate — and asymmetric:**

- **`shared/types/` → auto-import ON.** Nuxt auto-imports `shared/types/` in both bundles. Types have no runtime existence and cannot collide, so ambient `Team`, `Game`, `PickSet` everywhere is a pure DX win with zero cost.
- **`shared/domain/` → auto-import OFF (by placement).** Because Nuxt only auto-scans `shared/utils/` and `shared/types/`, placing the engine in `shared/domain/` opts it out automatically. Every consumer writes `import { deriveSeason } from '#shared/domain'`. This is intentional: the PROJECT.md DRY constraint says standings logic must have *exactly one implementation*, and explicit imports make that auditable — `grep "#shared/domain/standings"` returns the complete list of callers. A magically-available `computeStandings()` is much easier to accidentally re-implement next to.

**Nuxt scan depth is 1 — plan around it.** `app/composables/useTeams.ts` and `app/composables/index.ts` are scanned; `app/composables/nested/thing.ts` is **not**. Keep composables flat at the top level (as above) rather than fighting it with `imports.dirs` globs. Components can nest freely — the component scanner walks subdirectories and prefixes names (`slate/GameCard.vue` → `<SlateGameCard>`).

---

## Architectural Patterns

### Pattern 1: Reference-Keyed Memoization in the Domain Layer

**What:** The domain layer memoizes its own expensive derivations on the *identity* of its inputs. Vue reactivity then becomes free to duplicate: ten components can each hold a `computed` that calls `deriveSeason(games, teams, picks)`, and only one of them actually computes.

**Why this matters here:** It resolves the tension between "one implementation" and "available everywhere." Without it you need singleton machinery (a Pinia store, a Nuxt plugin providing a model, a `createSharedComposable`) to stop N callers doing N× work. With it, the composables stay trivially simple and stateless, and the sharing happens in a layer that is pure and unit-testable.

**When to use:** When the derivation's inputs are immutable and replaced-not-mutated. That holds here: TanStack Query results are immutable, and picks are updated immutably (see Pattern 3).

**Trade-offs:** Module-scope cache. Safe in this app because the memo is a *pure function of its argument* — same input reference always yields the same output, so there is no cross-request data leakage even during prerender, and the cache is bounded to the last N inputs. This is categorically different from the module-scope `ref()` anti-pattern that Nuxt warns about (mutable shared state). Keep the cache size at 1–2 entries and never key it on anything user-identifying.

```ts
// shared/domain/memo.ts — pure, framework-free
export function memoize1<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  let lastArg: A | undefined
  let lastResult: R
  return (a: A) => {
    if (lastArg !== a) { lastArg = a; lastResult = fn(a) }
    return lastResult
  }
}

// shared/domain/index.ts
export interface SeasonInput {
  teams: readonly Team[]
  games: readonly Game[]
  picks: PickSet
  overrides: TiebreakerOverrides
}

export interface SeasonModel {
  teamIndex: TeamIndex
  records: ReadonlyMap<TeamId, TeamRecord>
  standings: ReadonlyMap<ConferenceId, ConferenceStanding[]>
  tiebreakers: ReadonlyMap<ConferenceId, TiebreakerResult>
  championships: ReadonlyMap<ConferenceId, [TeamId, TeamId] | null>
  pendingTies: PendingTie[]
}

// Full recompute. ~1000 iterations. Do not optimize.
export const deriveSeason = memoizeInputs((input: SeasonInput): SeasonModel => {
  const teamIndex = indexTeams(input.teams)
  const records   = deriveRecords(input.games, input.picks, teamIndex)
  const standings = computeStandings(records, teamIndex)
  const tiebreakers = new Map(
    P4_CONFERENCES.map(c => [
      c,
      resolveTiebreakers(CONFERENCE_RULES[c], standings.get(c)!, input.games, input.overrides)
    ])
  )
  /* ...derive championships + pendingTies from tiebreakers... */
})
```

### Pattern 2: The Query Layer as a Swap Seam, Not a Cache

**What:** `useTeams()` / `useGames()` wrap the committed JSON in `useQuery` purely so that every call site is identical today (JSON import) and in v2 (`/api/` route with live results). This is what PROJECT.md already reasons for; the architecture just needs to honor it.

**Configuration specifics for immutable local data:**

```ts
// app/utils/queryKeys.ts — auto-imported, season-parameterized
export const seasonKeys = {
  all: (season: number) => ['season', season] as const,
  teams: (season: number) => [...seasonKeys.all(season), 'teams'] as const,
  games: (season: number) => [...seasonKeys.all(season), 'games'] as const,
  week:  (season: number, week: number) =>
    [...seasonKeys.games(season), 'week', week] as const
} as const

// app/composables/useTeams.ts
export function useTeams(season = CURRENT_SEASON) {
  return useQuery({
    queryKey: seasonKeys.teams(season),
    queryFn: () => import('~/data/teams.2026.json').then(m => m.default as Team[]),
    staleTime: Infinity,        // data literally cannot go stale
    gcTime: Infinity,           // never evict; re-import is pointless churn
    structuralSharing: false,   // deep-diffing a never-changing 900-item array is pure waste
    retry: false
  })
}
```

Three non-obvious calls:
- **`structuralSharing: false`.** Structural sharing exists to preserve references across refetches. There are no refetches. Leaving it on buys nothing and costs a deep diff of the whole dataset on first resolution.
- **`gcTime: Infinity`.** Default 5-minute GC would drop the season data whenever no component observes it, forcing a re-import and — worse — producing a *new object identity*, which invalidates every downstream memo in Pattern 1.
- **Dynamic `import()` in the `queryFn`.** Keeps the ~200KB of JSON out of the entry chunk; Vite emits it as a hashed, separately-cached chunk. Also makes the eventual `$fetch('/api/games')` swap a one-line edit inside this one function.

**Where the key factory lives:** `app/utils/queryKeys.ts`, auto-imported as a single `seasonKeys` object. This is the one place the standard "co-locate keys with the feature" advice should be overridden — with exactly two queries in the whole app and a season parameter threading through both, one shared factory is DRYer than two co-located ones, and a single named object carries no auto-import collision risk.

**Trade-off to note:** `app/data/*.json` (bundled, typed) vs `public/*.json` (fetched, cacheable independently of code). Bundled is right for v1 — simpler, type-checked, no cache-busting strategy needed. If the JSON grows past ~500KB, move to `public/` and change the `queryFn` body. The fact that this is a one-line change *is the return on wrapping static JSON in TanStack Query at all*.

### Pattern 3: Immutable Picks in a `shallowRef`

**What:** Picks are a frozen `Record<GameId, TeamId>` held in a `shallowRef`. Every mutation replaces the whole object.

**Why:** Two payoffs at once. (a) Vue does not deep-proxy a ~900-key object on every access. (b) The object identity changes exactly once per pick, which is precisely the cache key Pattern 1 needs. Deep-reactive picks would break the memo — the reference never changes, so `deriveSeason` would return stale results.

Copying a 900-key object per pick is microseconds. Do not optimize it.

```ts
// app/composables/usePicks.ts
export function usePicks() {
  const picks = useState<PickSet>('picks', () => Object.freeze({}))
  const overrides = useState<TiebreakerOverrides>('overrides', () => Object.freeze({}))
  const ready = useState('picks:ready', () => false)   // hydration gate

  onMounted(() => {                       // localStorage does not exist during prerender
    picks.value = loadPicks() ?? picks.value
    ready.value = true
  })

  function setPick(gameId: GameId, winner: TeamId) {
    picks.value = Object.freeze({ ...picks.value, [gameId]: winner })   // NEW identity
    persist()
  }
  function clearPick(gameId: GameId) {
    const next = { ...picks.value }; delete next[gameId]
    picks.value = Object.freeze(next); persist()
  }
  return { picks: readonly(picks), overrides, ready, setPick, clearPick, setOverride }
}
```

**Hydration:** the app is prerendered but picks are client-only, so reading localStorage during setup guarantees a hydration mismatch. Gate on a single `ready` flag exposed from `usePicks()` rather than sprinkling `<ClientOnly>`. One flag, one place, and pick-derived panels render a skeleton until it flips.

### Pattern 4: `useState` over Pinia — With a Named Upgrade Trigger

**What:** Picks/scenarios live in `useState`, not a store.

**Why:** Pinia's value is organized actions, devtools timeline, and per-request SSR isolation. `useState` already gives per-request isolation. The app has one mutable entity (the active scenario) with ~6 operations, and *all derivation is already delegated to the pure domain layer* — which is the part Pinia's getters would otherwise host. A store here would be a thin wrapper adding a dependency.

**Upgrade trigger — state it in the roadmap:** adopt Pinia if scenario management grows undo/redo, cross-scenario diffing, or optimistic multi-step edits. Until then it is ceremony. Note that Pinia is **not currently installed** (verified against `node_modules`).

### Pattern 5: Conference Rules as Data, Engine as Code

**What:** Each conference's published procedure is a declarative table; one generic engine walks any table.

**Why this is the highest-leverage decision in the app.** PROJECT.md names multi-team tie handling as the top correctness risk, and the specific failure mode is real: in the Big Ten, when 3+ teams are tied and one team defeated all the others, that team is removed and the remainder **restart from the beginning of the procedure** rather than continuing down the step list. Encoded as control flow, that rule is a subtle recursion bug waiting to happen and it differs per conference. Encoded as a flag on a data table, it is explicit, diffable, and directly testable.

```ts
// shared/domain/tiebreakers/rules.ts
export interface ConferenceRules {
  id: ConferenceId
  participants: 2
  steps: TiebreakerStepId[]           // published order
  restartAfterElimination: boolean    // B1G: true — remove separated team, restart at step 0
  twoTeamSteps?: TiebreakerStepId[]   // some conferences differ for 2-way vs 3+-way ties
  manualFrom: TiebreakerStepId        // first step we cannot compute → hand to user
}

export const CONFERENCE_RULES: Record<ConferenceId, ConferenceRules> = {
  SEC: {
    id: 'SEC', participants: 2, restartAfterElimination: true,
    steps: ['head-to-head', 'common-opponents', 'record-vs-highest-placed',
            'cumulative-opponent-win-pct', 'scoring-margin', 'random-draw'],
    manualFrom: 'scoring-margin'      // no scores in v1 → user resolves
  },
  B1G: {
    id: 'B1G', participants: 2, restartAfterElimination: true,
    steps: ['head-to-head', 'common-opponents', 'record-vs-best-common',
            'cumulative-opponent-win-pct', 'analytics-ranking', 'random-draw'],
    manualFrom: 'analytics-ranking'
  }
  // B12, ACC — same shape, verify step order against published procedures
}
```

Adding the ACC and Big 12 becomes a data change. Extending to G5 in v2 becomes a data change. The engine is written once and tested once.

### Pattern 6: The Tiebreaker Engine Returns a Trace, Not an Answer

**What:** `resolveTiebreakers()` returns the final ordering **and** a step-by-step audit trail. The tiebreaker UI renders the trail; it never re-derives anything.

**Why:** This is the DRY constraint's sharpest edge. A UI that explains "Ohio State advances on head-to-head" by re-checking head-to-head is a *second implementation* of the rules — one that will drift from the first. Making the explanation an output of the engine means the UI is a dumb renderer and every explanation shown to the user is provably the reasoning that actually produced the result.

Secondary payoff: the trace is the ideal unit-test assertion target. You can assert not just "the right two teams advanced" but "they advanced at the right step for the right reason" — which is what catches a procedure that accidentally skips or reorders a step.

```ts
interface TiebreakerStepResult {
  step: TiebreakerStepId
  input: TeamId[]              // group entering this step
  output: TeamId[][]           // [[a],[b,c]] = a separated, b & c still tied
  resolved: boolean
  explanation: string          // rendered verbatim in the UI
  detail?: {                   // structured backing for rich rendering
    headToHead?: Record<string, 'W' | 'L'>
    records?: Record<TeamId, { w: number, l: number }>
  }
}
```

### Pattern 7: Filter State in the URL, Not in a Store

**What:** Week, conference filter, and team filter live in the route query (`/?week=5&conf=SEC`), read via `useRoute()`.

**Why:** PROJECT.md already decided conference and team views are *filters over one slate*, not separate screens. Route query makes that literal: back button works, filtered views are linkable, and there is zero additional shared state to manage or persist. It also keeps filter state cleanly separate from the share-link payload (which encodes picks, not viewport).

---

## Data Flow

### The Spine (question 1, answered end to end)

```
  app/data/games.2026.json ──┐
  app/data/teams.2026.json ──┤
                             ▼
                  TanStack Query  (staleTime/gcTime: Infinity)
                  stable immutable references
                             │
  localStorage ──► usePicks() shallowRef<PickSet>  (frozen, replaced on write)
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │  useSeasonModel()                          │
        │    computed(() => deriveSeason({           │  ← ONE computed
        │      teams, games, picks, overrides }))    │     ONE pure call
        └────────────────────┬───────────────────────┘
                             │  (memoized on input identity —
                             │   duplicate callers are free)
      ┌──────────────┬───────┴────────┬─────────────────┐
      ▼              ▼                ▼                 ▼
  .records      .standings       .tiebreakers      .pendingTies
      │              │                │                 │
      ▼              ▼                ▼                 ▼
 useTeamRecord  useStandings(c)  useTiebreakers(c)  TiebreakerResolver
                                        │
                                        ▼
                                 .championships
```

**Where each derivation lives — the explicit answer:**

| Derivation | Lives in | Rejected alternative and why |
|------------|----------|------------------------------|
| Team index (id → Team) | Pure `indexTeams()`, reference-memoized; surfaced by `useTeamIndex()` | **Not** TanStack `select`. `select` is memoized per *component instance* — 30 callers means 30 index builds and 30 distinct identities, which also breaks every downstream memo. |
| Per-team records | Pure `deriveRecords()` inside `deriveSeason()` | Not a `computed` per team — 138 computeds observing the same picks object is strictly worse than one pass. |
| Conference standings | Pure `computeStandings()` inside `deriveSeason()` | Not a Pinia getter — putting it in a store makes it un-unit-testable without a Pinia instance. |
| Tiebreaker resolution | Pure `resolveTiebreakers()` inside `deriveSeason()` | Not in the component. This is the code that must be exhaustively tested. |
| Championship matchups | Falls out of `resolveTiebreakers()` | — |
| **Narrowing** (this week's games, this conference's table) | Vue `computed` in composables/components | This is the *only* legitimate use of `computed` for derivation, and the only good use of TanStack `select`. |

**The rule to write into the roadmap:** *Vue `computed` is for slicing, never for computing.* If a `computed` body contains a loop over games or a `.sort()`, it belongs in `shared/domain/`.

### Write Flow

```
GameCard click ──► usePicks().setPick(gameId, teamId)
                        │
                        ├─► picks.value = frozen new object   (new identity)
                        └─► persist to localStorage (debounced ~250ms)
                                 │
                                 ▼
                    useSeasonModel() computed invalidates
                                 │
                                 ▼
                  deriveSeason() runs once (~1ms, full season)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            StandingsPanel               ChampionshipCard
            re-renders                   re-renders
```

Only **three** components write: `GameCard` (picks), `TiebreakerResolver` (overrides), `ScenarioSwitcher` (active scenario / CRUD). Everything else is read-only derived. Making that a stated invariant is cheap and prevents the classic drift where a standings row starts mutating picks.

---

## Data Model

### Core Entities

```ts
// shared/types/team.ts
export type TeamId = number          // CFBD id — also the logo filename
export type ConferenceId = string    // 'SEC' | 'Big Ten' | ... (CFBD strings)

export interface Team {
  id: TeamId
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: ConferenceId | null    // null for FCS / unaffiliated
  classification: 'fbs' | 'fcs'
  color: string                      // '#BB0000'
  altColor: string | null
  logo: string | null                // '/logos/194.png' — RESOLVED PATH, not a URL
  logoDark: string | null            // '/logos/194_dark.png'
}

// shared/types/game.ts
export type GameId = number
export interface Game {
  id: GameId
  season: number
  week: number
  seasonType: 'regular' | 'postseason'
  startDate: string                  // ISO 8601
  neutralSite: boolean
  conferenceGame: boolean            // FROM CFBD — never re-derive (see anti-patterns)
  homeId: TeamId
  awayId: TeamId
}
```

Three modeling calls worth defending:

1. **Games store only team *ids*.** Denormalizing team objects into games would roughly triple the JSON and create a second source of truth for colors/logos — the exact thing the DRY constraint forbids. Join through `useTeamIndex()`.
2. **`logo` is a resolved local path, decided at fetch time.** Components never build URLs and never handle "does this team have a logo." The fetch/vendor script writes `null` when a logo is missing and `TeamBadge` renders initials. Fallback logic exists once, at the boundary.
3. **`conferenceGame` is trusted from CFBD**, not computed from `home.conference === away.conference`. Conference affiliation in the data is current-season, and scheduling edge cases (transitioning members, non-counting crossover games) make the derived version wrong in exactly the situations that decide a championship.

### Picks and Scenarios

```ts
// shared/types/picks.ts
export type PickSet = Readonly<Record<GameId, TeamId>>   // sparse: unpicked absent

export interface Scenario {
  id: string                 // crypto.randomUUID()
  season: number
  name: string
  picks: PickSet
  overrides: TiebreakerOverrides
  createdAt: number
  updatedAt: number
}
```

**Sparse map, not a dense array.** "Unpicked" must be a first-class state (the standings panel needs to say "3 games remaining"), and a sparse map represents it with absence rather than a sentinel. It is also stable against schedule edits — a cancelled game just orphans one key.

### The Storage / Wire Split (question 4, directly)

The map-vs-bit-array question is a false dichotomy. **Use both, at different boundaries:**

| Boundary | Representation | Rationale |
|----------|----------------|-----------|
| In memory | `PickSet` map | Direct O(1) lookup by `gameId`; no positional bookkeeping |
| localStorage | `PickSet` map as JSON | Human-inspectable, robust to schedule changes, trivially migratable. ~13KB per scenario is nothing against a 5MB quota |
| **Share URL** | 2-bit positional array, base64url | Only place where size is a hard constraint |

The map does **not** fit in a URL: ~900 entries of `"401628319":251,` is ~13KB raw, and even lz-string compression lands in the 2–4KB range — over the ~2000-character budget that guarantees universal compatibility.

The bit array does fit comfortably:

```
Canonical order: games sorted by (week, id) — deterministic, derived from games.json
Encoding:        2 bits per game — 00 unpicked, 01 home wins, 10 away wins
Size:            900 games x 2 bits = 1800 bits = 225 bytes -> ~300 base64url chars
```

That leaves ~1700 characters of headroom for scenario name and tiebreaker overrides.

**The mandatory guard:** a positional encoding is only valid against the exact games list that produced it. Version the payload:

```
/s/{season}.{scheduleHash8}.{base64urlBits}.{overridesBlob}
                  ▲
       first 8 chars of a hash over the canonical ordered game-id list
```

On decode, mismatch → do not silently misapply picks; surface "this link was made for a different version of the schedule." This is the failure mode that turns a share feature into a correctness bug, and it costs eight characters to prevent.

**Recommendation: skip lz-string entirely.** The bit array is smaller, dependency-free, deterministic, and round-trip testable as a property (`decode(encode(p)) === p` over random pick sets). Reach for compression only if the overrides blob grows unexpectedly.

### Tiebreaker Overrides — Content-Addressed

```ts
export type TiebreakerStepId =
  | 'head-to-head' | 'common-opponents' | 'record-vs-highest-placed'
  | 'record-vs-best-common' | 'cumulative-opponent-win-pct'
  | 'scoring-margin' | 'analytics-ranking' | 'random-draw'

export interface TiebreakerOverride {
  conference: ConferenceId
  tiedGroup: TeamId[]        // sorted ascending — part of the identity
  step: TiebreakerStepId     // which step bottomed out
  order: TeamId[]            // the user's chosen ordering
}

export type TiebreakerOverrides = Readonly<Record<string, TiebreakerOverride>>

// KEY = `${conference}:${step}:${[...tiedGroup].sort((a,b)=>a-b).join('-')}`
```

**This is the subtle one.** The naive design keys overrides by conference (`overrides['SEC']`) or by position ("the first unresolved tie"). Both are wrong, because picks change constantly and the *set of tied teams changes with them*. An override the user made for {Ohio State, Michigan, Oregon} must never silently apply to {Ohio State, Michigan, Penn State}.

Content-addressing the key on the tie context makes stale overrides **self-invalidating**: when the tie composition changes, the key no longer matches, the engine reports the tie as pending again, and the user is asked. It also gives a genuinely pleasant emergent behavior — flip a pick away and back, and the prior choice revives automatically, because the key matches again. Keep unmatched overrides rather than pruning them; they cost nothing and this revival is the reason.

### Standings and Result Shapes

```ts
export interface TeamRecord {
  teamId: TeamId
  overallWins: number; overallLosses: number
  confWins: number;    confLosses: number
  gamesRemaining: number            // unpicked games involving this team
  beat: ReadonlySet<TeamId>         // precomputed for O(1) head-to-head lookups
  lostTo: ReadonlySet<TeamId>
}

export interface ConferenceStanding {
  teamId: TeamId
  record: TeamRecord
  confWinPct: number
  rank: number                      // post-tiebreak, 1-based
  tiedWith: readonly TeamId[]       // empty when cleanly separated
  separatedBy: TiebreakerStepId | null
  inChampionshipGame: boolean
}

export interface PendingTie {
  key: string                       // matches the override key format exactly
  conference: ConferenceId
  teams: readonly TeamId[]
  step: TiebreakerStepId
  reason: string                    // "SEC procedure reaches scoring margin; v1 has no scores"
}

export interface TiebreakerResult {
  conference: ConferenceId
  order: readonly TeamId[]          // best first
  trace: readonly TiebreakerStepResult[]
  pending: readonly PendingTie[]
  usedOverrides: readonly string[]
  championship: readonly [TeamId, TeamId] | null   // null while ties pending
}
```

`beat` / `lostTo` sets on `TeamRecord` are the one deliberate precomputation: head-to-head is the first step of every conference's procedure and gets hit repeatedly inside multi-team restarts. Building them during the single records pass costs nothing and makes the engine's inner loop O(1).

---

## Component Boundaries

| Component | Reads | Writes | Local state | Notes |
|-----------|-------|--------|-------------|-------|
| `pages/index.vue` | route query | route query | — | Composition root; owns filter → data wiring |
| `SlateWeekNav` | route query | route query | — | |
| `SlateFilters` | `useTeams`, route query | route query | dropdown open | |
| `GameList` | `useGames`, `useTeamIndex` | — | — | **Resolves teams once**, passes down as props |
| `GameCard` | props (`game`, `home`, `away`), `usePicks` | `setPick` | — | One of three writers |
| `TeamBadge` | props (`team`), `useTeamAccent` | — | — | Pure presentational; owns contrast logic |
| `StandingsPanel` | `useStandings(conf)` | — | sort/expand toggle | Zero math |
| `TiebreakerTrace` | props (`result`) | — | expanded step | Renders `trace`; no rule logic |
| `TiebreakerResolver` | `useSeasonModel().pendingTies` | `setOverride` | drag order | One of three writers |
| `ChampionshipCard` | `useStandings(conf).championship` | — | — | |
| `ScenarioSwitcher` | `useScenarios` | scenario CRUD | dialog open | One of three writers |

**The one deliberate exception to "composables everywhere":** in hot lists, resolve teams at the *list* level, not the *card* level.

`useTeam(id)` inside `GameCard` is the natural expression of the DRY goal, but 60 cards × 2 teams = 120 `useQuery` observer subscriptions per week just to read static data. Have `GameList` call `useTeamIndex()` once and pass resolved `Team` objects down as props. DRY is fully preserved — there is still exactly one index and one composable that builds it — while subscriptions stay at one. Keep `useTeam(id)` available and use it freely in non-hot contexts (page headers, standings rows, detail panels, the championship card). Worth stating explicitly in the roadmap so it does not read as an inconsistency.

---

## Build-Time Pipeline

```
  CFBD API ──(one-time, manual, needs CFBD_API_KEY)──► scripts/fetch-season.ts
                                                              │
                              validates + maps to Team[]/Game[] shapes
                                                              ▼
                                    app/data/{teams,games}.2026.json   [COMMITTED]
                                                              │
  CFBD/cfb-web ──(manual, idempotent)──► scripts/vendor-logos.ts ◄──────┘
                                                              │  (reads team ids)
                                                              ▼
                                        public/logos/{teamId}.png       [COMMITTED]
                                                              │
                                                              ▼
                                          nuxt generate (hermetic — no network)
```

**Both scripts are on-demand `package.json` scripts, not build hooks:**

```json
{
  "scripts": {
    "data:fetch":  "tsx scripts/fetch-season.ts --season 2026",
    "data:logos":  "tsx scripts/vendor-logos.ts --season 2026",
    "data:verify": "tsx scripts/verify-data.ts",
    "build": "pnpm data:verify && nuxt build"
  }
}
```

Rationale, point by point:

- **Never on dev start.** The schedule is immutable; re-fetching on every `nuxt dev` burns API quota and makes startup depend on the network for zero benefit. `postinstall` is equally wrong — it fires on every dependency change.
- **Commit both the JSON and the logos.** ~140 small PNGs is a few MB, and committing them makes the production build **hermetic**: no API key in CI, no GitHub rate limit on `raw.githubusercontent.com`, no build that fails because an upstream repo moved a file. This directly serves the "fully static, no runtime API key" constraint.
- **`data:verify` in the build, not `data:fetch`.** A cheap check — every team in `teams.json` has a logo file, every game references a known team id, no duplicate game ids — that fails the build loudly instead of shipping a broken badge. Fast, offline, no side effects.
- **Validation happens in the fetch script, at the boundary.** Map CFBD's response into the typed shapes there, with explicit field checks. This is the whole payoff of one-time fetching: schema drift fails on your machine while you're running the script, not in a user's browser six months later. Never `JSON.parse` into `any` at runtime.
- **If committing logos is later rejected**, the fallback is a `nuxt.config` `hooks: { 'build:before' }` entry guarded by an `fs.existsSync` check so warm dev restarts are no-ops. Strictly worse — it puts the network back in the build — but it works.
- **Season parameterization** is a script arg plus a `CURRENT_SEASON` constant plus the `seasonKeys` / `storageKeys` prefixes. 2027 is `pnpm data:fetch --season 2027` and one constant.

**Testing setup (not currently installed — verified against `node_modules`):** add `vitest` with `environment: 'node'` and an alias `#shared → ./shared`. The domain layer needs **no** Nuxt runtime, no `@nuxt/test-utils`, and no jsdom, so the tiebreaker suite runs in milliseconds. That speed is exactly what makes "exhaustive hand-verified multi-team tie scenarios" practical rather than aspirational — and it is the concrete return on the `shared/` layer choice.

---

## Suggested Build Order

| # | Slice | Delivers | Depends on | Notes |
|---|-------|----------|------------|-------|
| 1 | Domain types + `fetch-season.ts` | Real `teams.json` / `games.json` on disk | — | **Do first.** Every shape downstream is guesswork without real CFBD ids and field values |
| 2 | Query layer: `seasonKeys`, `useTeams`, `useGames`, `useTeamIndex` + `vendor-logos.ts` | Typed, indexed data available app-wide | 1 | Small; unblocks all UI |
| 3 | Read-only slate: `SlateWeekNav`, `SlateFilters`, `GameList`, `GameCard`, `TeamBadge` | **First visible app** — browse the whole season | 2 | No picks yet. Shakes out logo/color/contrast issues early |
| 4 | `usePicks` + localStorage + pick interaction | **First end-to-end app.** Pick games; picks persist | 3 | Genuinely shippable. Validates the core interaction before any standings math exists |
| 5 | `deriveRecords` + `computeStandings` + `StandingsPanel` | Standings update live from picks | 4, and 6a can precede | Ties displayed *as ties*, unresolved. Core value becomes visible |
| 6 | Tiebreaker engine + `CONFERENCE_RULES` + trace, then `TiebreakerTrace` / `TiebreakerResolver` / `ChampionshipCard` | Championship matchups resolve correctly | 5 for UI; **6a (the pure engine) has no UI dependency** | Highest risk, most tests. Split 6a (engine, test-first) from 6b (UI) |
| 7 | `useScenarios` — named, switchable, persisted | Multiple scenarios side by side | 4 | Additive; no restructuring |
| 8 | `codec.ts` + share URL + import | Shareable links | 7 | Additive. Needs the schedule hash from 1 |

**Ordering rationale:**

- **1 → 4 is the shortest path to a working app.** Each of those steps is visible, and step 4 is independently shippable — you can pick a full season and come back to it, with no standings at all. That is the right place to validate the interaction before committing to the hard math.
- **5 before 6** so ties are *visible* before they are *resolved*. Seeing "3 teams tied at 7-1" in the UI is what makes the tiebreaker requirements concrete and catches records-layer bugs before they get blamed on the tiebreaker engine.
- **6a is parallelizable with 3–5.** This is the concrete payoff of the isolated domain layer and worth flagging for the roadmap: the tiebreaker engine is pure functions over `Game[]` / `ConferenceStanding[]` with a vitest harness and *no UI dependency at all*. It can be built and exhaustively tested by a separate workstream the moment step 1 pins down the `Game` shape. Given it is both the highest-risk and highest-test-volume item, starting it early rather than at the end materially de-risks the milestone.
- **7 and 8 are strictly additive.** Neither reshapes anything above it, so both are safe to defer if the milestone tightens. 8 in particular depends only on the canonical game ordering established in 1.

---

## Anti-Patterns

### 1. Building shared indices with TanStack `select`

**What people do:** `useTeams({ select: teams => new Map(teams.map(t => [t.id, t])) })` and call it everywhere.
**Why it's wrong:** `select` is memoized per *component instance*, not globally. Twenty callers means twenty Map constructions and — worse — twenty distinct object identities, which breaks referential equality for every downstream `computed` and memo.
**Do this instead:** one reference-memoized pure `indexTeams()` in the domain layer, surfaced by `useTeamIndex()`. Reserve `select` for cheap per-component narrowing.

### 2. Computing standings inside a component or a `computed`

**What people do:** a `computed` in `StandingsPanel.vue` that loops games and sorts.
**Why it's wrong:** it is untestable without mounting Vue, and it will be copy-pasted the moment a second view needs standings — directly violating the stated DRY constraint.
**Do this instead:** *`computed` slices, it never computes.* Any loop over games or `.sort()` belongs in `shared/domain/`.

### 3. Deep-reactive picks

**What people do:** `const picks = ref<Record<GameId, TeamId>>({})` and `picks.value[gameId] = teamId`.
**Why it's wrong:** two failures at once. Vue deep-proxies ~900 keys, and the object identity never changes — so every reference-keyed memo downstream returns stale results. The second failure is silent and will look like "standings don't update sometimes."
**Do this instead:** `shallowRef` + frozen immutable replacement.

### 4. Re-deriving `conferenceGame`

**What people do:** `game.homeTeam.conference === game.awayTeam.conference`.
**Why it's wrong:** wrong for transitioning members and non-counting crossover games — precisely the edge cases that decide championships.
**Do this instead:** trust CFBD's `conferenceGame` flag; carry it through the fetch script unchanged.

### 5. A tiebreaker engine that returns only the answer

**What people do:** return `[teamA, teamB]`, then write UI copy explaining why.
**Why it's wrong:** the explanation becomes a second implementation of the rules and drifts from the first. It also makes tests unable to assert *why* a team advanced.
**Do this instead:** return a `trace`; the UI renders it.

### 6. Positionally-keyed tiebreaker overrides

**What people do:** `overrides['SEC']` or "the user's answer to the first pending tie."
**Why it's wrong:** the tied set changes as picks change, so a stale override silently applies to a different group of teams and corrupts the result with no error.
**Do this instead:** content-address the key on `conference:step:sortedTeamIds`.

### 7. Single-pass multi-team tie resolution

**What people do:** eliminate a team at step N and continue to step N+1 with the remainder.
**Why it's wrong:** the published procedures generally require **restarting at step 1** with the reduced group. This is the single most common way these implementations get it wrong, and PROJECT.md already flags it.
**Do this instead:** `restartAfterElimination` as an explicit flag on `ConferenceRules`, with dedicated multi-way test cases.

### 8. Building logo URLs in components

**What people do:** `:src="\`https://raw.githubusercontent.com/.../\${team.id}.png\`"` or the same template in three components.
**Why it's wrong:** fragile, rate-limited, and duplicates the missing-logo fallback.
**Do this instead:** resolve the path once in the fetch/vendor script into `Team.logo`; components read the field.

### 9. Reading localStorage during setup

**What people do:** `const picks = ref(JSON.parse(localStorage.getItem('picks') ?? '{}'))`.
**Why it's wrong:** `localStorage` does not exist during prerender → guaranteed hydration mismatch.
**Do this instead:** read in `onMounted` (or VueUse `useLocalStorage(..., { initOnMounted: true })`) and expose one `ready` flag from `usePicks()` that pick-derived UI gates on.

### 10. Reaching for a Pinia store to hold static data

**What people do:** a `useSeasonStore` holding teams, games, picks, and standings getters.
**Why it's wrong:** it re-centralizes what TanStack Query and the pure domain layer already own, and it drags standings math back into a framework construct that can't be tested standalone.
**Do this instead:** static data in Query, mutable state in `useState`, math in `shared/domain/`.

---

## Scaling Considerations

User count does not scale here — it is a static site behind a CDN. The meaningful axes are data size and stored scenarios.

| Axis | Current (2026) | Where it breaks | Response |
|------|----------------|-----------------|----------|
| Games in the model | ~900 | Nothing breaks; full recompute stays ~1ms | Do not optimize |
| Games rendered at once | ~60 (one week) | ~500+ cards on a single screen | Week-first nav already prevents this; add `v-memo` on `GameCard` before reaching for virtualization |
| Bundled JSON | ~200KB | ~500KB starts hurting the chunk | Move `app/data/` → `public/` + `$fetch`; change is confined to the two `queryFn` bodies |
| localStorage scenarios | ~13KB each | ~5MB quota → ~300 scenarios | Practically unreachable; if it matters, store the bit array instead of the map |
| Share URL | ~300 chars | ~2000 chars | Already 6x under; overrides blob is the only growth vector |
| Conferences with standings | 4 (P4) | Adding all G5 → ~11 | Data-table change only, thanks to Pattern 5 |

**First bottleneck in practice:** none of the above. It will be *tiebreaker correctness*, which is a testing-investment problem rather than an architecture problem — which is exactly why the domain layer is isolated and the trace is a first-class output.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| CFBD API | Build-time only, via `scripts/fetch-season.ts`. Key in gitignored `.env`, never in the bundle. | Validate/map at the boundary. `/games` and `/teams/fbs`. Re-run per season |
| CFBD `cfb-web` (logos) | Build-time vendoring into `public/logos/{teamId}.png`, committed | Filenames key off the same team ids — no mapping layer. Never hotlink |
| Future `/api/` results (v2) | Swap the two `queryFn` bodies. Every call site, key, and derivation is unchanged | This is the entire justification for wrapping static JSON in TanStack Query |

### Internal Boundaries

| Boundary | Communication | Enforcement |
|----------|---------------|-------------|
| Components → composables | Function call; composables return refs/computeds | Convention. Only 3 components may write |
| Composables → domain | Plain function call with **unwrapped** values (`toValue` / `.value` at the call site) | The domain signature takes plain arrays and objects — no `Ref` anywhere in `shared/` |
| Domain → anything | **None.** Zero outbound dependencies | **Framework-enforced:** Nuxt forbids Vue/Nitro/Nuxt-context imports inside `shared/` |
| Query layer → data files | Dynamic `import()` inside `queryFn` | The single swap seam for v2 |
| Domain → tests | Direct import via `#shared/domain/*` | Plain vitest, node env, no Nuxt runtime |

**How composables wrap the domain without leaking reactivity (question 3, explicitly):** the domain layer's public signatures accept only plain values. The composable unwraps at the boundary and re-wraps the result:

```ts
// app/composables/useSeasonModel.ts
export function useSeasonModel() {
  const { data: teams } = useTeams()
  const { data: games } = useGames()
  const { picks, overrides } = usePicks()

  return computed<SeasonModel | null>(() => {
    if (!teams.value || !games.value) return null
    return deriveSeason({                 // ← plain values cross the boundary
      teams: teams.value,
      games: games.value,
      picks: picks.value,
      overrides: overrides.value
    })
  })
}

// app/composables/useStandings.ts — pure slicing, zero math
export function useStandings(conference: MaybeRefOrGetter<ConferenceId>) {
  const model = useSeasonModel()
  return computed(() => model.value?.standings.get(toValue(conference)) ?? [])
}
```

Reactivity is tracked because the `computed` reads `.value` on each source; the domain function never sees a `Ref`, and `deriveSeason`'s memo means duplicate `useSeasonModel()` callers cost one property read each.

---

## Confidence & Verification

| Area | Confidence | Basis |
|------|------------|-------|
| Nuxt 4 `shared/` semantics, purity restrictions, `#shared` alias | HIGH | First-party Nuxt 4 docs; corroborated by `tsconfig.json` already referencing `.nuxt/tsconfig.shared.json` in this repo |
| Auto-import scan depth (top level only) | HIGH | First-party Nuxt 4 docs, explicit examples |
| TanStack Query v5 `select` memoization + structural sharing | MEDIUM-HIGH | First-party TanStack docs (React guide, shared core). The per-component-instance consequence in Vue is my inference from the documented memoization contract — worth a quick empirical check when building `useTeamIndex` |
| vue-query reactive options (`queryKey`, `enabled` accept `MaybeRefOrGetter`) | MEDIUM-HIGH | First-party TanStack Vue reactivity docs. Note a known typing regression on `queryOptions` + `ComputedRef` queryKey in v5.98.0–5.99.2; this repo has **5.101.4** (verified in `node_modules`) so it should be past it — verify if TS complains |
| Vue 3 `shallowRef` / computed-stability guidance | HIGH | First-party Vue performance docs, with quoted recommendations |
| Installed versions and absent dependencies | HIGH | Direct `node_modules` inspection: Nuxt 4.5.1, `@nuxt/ui` 4.10.0, `@tanstack/vue-query` 5.101.4. **Pinia, Vitest, and top-level `@vueuse/core` are NOT installed** — `@vueuse/core` 14.3.0 exists only as a transitive dep of `@nuxt/ui`, and pnpm's strict linking means it is **not importable from app code** without `pnpm add @vueuse/core` |
| localStorage/hydration patterns | MEDIUM | Nuxt/VueUse community discussions plus first-party hydration guidance; the `initOnMounted` option is well attested |
| URL length limits & bit-array sizing | MEDIUM | Web sources for browser limits; the size arithmetic is mine and is straightforward |
| **Conference tiebreaker step orders** | **LOW** | Secondary sports-media sources (CBS, SI, ESPN). Step *sequences* and the Big Ten restart-after-elimination rule were consistent across sources, but **the ACC and Big 12 procedures were not verified at all**, and none were read from a primary conference handbook |

**The one gap that must be closed before implementation:** the `CONFERENCE_RULES` tables must be built from each conference's **published procedure document**, not from this research. This document establishes the *shape* the rules take (an ordered step list plus a `restartAfterElimination` flag plus a `manualFrom` boundary) and that shape is well supported. The specific step contents are a phase-level research task with a hard requirement for primary sources, and the roadmap should flag the tiebreaker phase accordingly.

Two smaller open items:
- Confirm empirically that TanStack Query hands back a stable object reference across component mounts with `staleTime`/`gcTime: Infinity`. Pattern 1's memoization depends on it. If it does not hold, the fallback is a one-line `markRaw` + module-level capture in `useTeamIndex` — not a structural change.
- Decide whether `@vueuse/core` is worth adding as a direct dependency purely for `useLocalStorage({ initOnMounted: true })`. A ~15-line hand-rolled equivalent avoids the dependency; the library version is better tested. Either is defensible.

---
*Architecture research for: client-side sports prediction / derived-standings app (Nuxt 4 static)*
*Researched: 2026-08-12*
