# Phase 6: Tiebreaker UI & Championships - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 19 (11 new, 8 modified)
**Analogs found:** 17 / 19

> Consumed by `gsd-planner`. Every excerpt below is a real, read range from this repo —
> file path plus line numbers. Where a locked decision *forbids* copying an existing
> pattern, that is called out under **Do NOT copy** so the planner does not inherit a
> defect (Phase 5's CR-01 was exactly that class of mistake).

---

## File Classification

### Layer 1 — Pure domain / engine (`shared/domain/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/domain/tiebreakers/engine.ts` (MOD — add `resolveConferenceRanking`, repair `resolveTiedGroup`) | domain engine | transform (recursive) | itself: `resolveConferenceChampionship` :209-298 + `resolveSlot` :256-280 | exact (self-analog) |
| `shared/domain/tiebreakers/types.ts` (MOD — add `RankGroup`, `ConferenceRanking`) | model / types | — | itself: `ChampionshipResult` :138-142, `TiebreakerResult` :124-131 | exact |
| `shared/domain/tiebreakers/invalidation.ts` (NEW — D-08 hash) | utility | transform (pure) | `shared/domain/tiebreakers/steps.ts` `partitionByStepValue` :260-311 (canonical keying by `StepValue` discriminant) | role-match |
| `shared/domain/tiebreakers/steps.ts` (MOD — lost-to-all elimination, third defect) | domain step evaluator | transform | itself: `evaluateHeadToHead` :34-143 (the `beatAllOthersTeam` branch at :121-133 is the exact shape the new `lostToAll` branch mirrors) | exact |
| `shared/domain/standings/computeStandings.ts` (MOD — delete union-find) | domain | transform | itself: the constructive assembly at :448-460 survives; :80-342 is deleted | exact |
| `shared/domain/standings/slateCompletion.ts` (NEW — D-07) | domain predicate | transform (pure) | `computeStandings.ts` `conferenceGamesFor` :67-72 and `toOutcomes` :40-54 | role-match |
| `shared/domain/standings/resolveTiebreakers.ts` (MOD — return `ConferenceRanking`) | domain orchestrator | transform | itself :46-86 | exact |
| `shared/domain/standings/index.ts` (MOD — export new symbols) | barrel | — | itself (20 lines, full barrel) | exact |
| `shared/types/standings.ts` (MOD — WR-06 tighten `StandingsResult`) | model / types | — | itself :63-71 | exact |

### Layer 2 — Persisted user state (`app/composables/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/composables/useManualTiebreakers.ts` (NEW) | composable / store | CRUD over localStorage | `app/composables/useAutoFilledGames.ts` (whole file, 93 lines) — **primary**; `app/composables/usePicksStorage.ts` :29-71 — secondary (corruption-preservation) | exact |
| `app/composables/useStandings.ts` (NEW — IN-02 seam) | composable | request-response / derived | `app/composables/usePickProgress.ts` :29-59 (`computed` over query data + picks ref) | exact |

### Layer 3 — Vue components (`app/components/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/StandingsTable.vue` (MOD — markers, per-group expansion, inline prompt) | component | render + local UI state | itself (124 lines) for table markup; `StandingsSidebar.vue` :70-112 for the hand-rolled `aria-expanded` toggle | exact |
| `app/components/ChampionshipCard.vue` (NEW) | component | render (props-only) | `app/components/StandingsTable.vue` :1-27 (dumb-component + explicit-`vue`-import contract) | role-match |
| `app/components/TiebreakerReasoning.vue` (NEW) | component | render + local UI state | `app/components/StandingsSidebar.vue` :70-112 (ref + `useId` + `aria-expanded`/`aria-controls` + inline `<svg>`) | role-match |
| `app/pages/week/[week].vue` (MOD — collapse into `useStandings`) | page | orchestration | itself :98-113 (the two `computed`s being extracted) | exact |

### Layer 4 — Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/helpers/generated-seasons.ts` (NEW) | test helper | — | `tests/domain/standings/standings-tiebreaker-agreement.test.ts` :209-240 (`readJson` / `mulberry32` / `generatePicks` — move verbatim) | exact |
| `tests/domain/tiebreakers/*.test.ts` (NEW ×4) | test (pure logic) | — | `tests/domain/standings/standings-tiebreaker-agreement.test.ts` :242-330 (violation-collector property style) | exact |
| `tests/domain/standings/slateCompletion.test.ts` (NEW) | test (pure logic) | — | `tests/domain/standings/resolveTiebreakers.test.ts` (50 lines) | exact |
| `tests/composables/useManualTiebreakers.test.ts` (NEW) | test (composable) | — | `tests/composables/usePicksStorage.test.ts` :1-80 | exact |
| `tests/components/{ChampionshipCard,TiebreakerReasoning}.test.ts` (NEW) | test (component) | — | `tests/components/StandingsTable.test.ts` (99 lines) | exact |
| `tests/components/StandingsTable.test.ts` (MOD) | test (component) | — | itself — **note :60-80 asserts the behaviour D-10 reverses** | exact |

**No analog found:** 2 files —
`shared/domain/tiebreakers/invalidation.ts` (no hashing function exists anywhere in the repo)
and `app/components/ChampionshipCard.vue` (no card-shaped presentational component exists;
`GameCard.vue` is superficially similar but is Nuxt-UI-dependent and untestable — see
§Anti-Patterns). Both fall back to RESEARCH.md Patterns 4 and §5 of the UI-SPEC.

---

## Pattern Assignments

### `shared/domain/tiebreakers/engine.ts` — add `resolveConferenceRanking` (domain, transform)

**Analog:** itself — `resolveConferenceChampionship` is the function being generalized.

**Setup preamble to copy verbatim** (`engine.ts:217-248`). The new N-seed entry point needs
this identical block; do not rewrite it:

```ts
  // Validate entry boundary (T-03-02): every outcome entry must map to a valid game/team pair
  for (const [gameId, winnerId] of outcomes.entries()) {
    const game = conferenceGames.find(g => g.id === gameId)
    if (!game) continue
    if (winnerId !== game.homeId && winnerId !== game.awayId) {
      throw new Error(
        `resolveConferenceChampionship: outcomes contains a teamId that is not a participant in gameId ${gameId}`
      )
    }
  }

  const records = deriveConferenceRecords(conferenceGames, outcomes, teamIds)
  const baseOrdering = computeBaseOrdering(records)   // frozen once — never recomputed
  const rules = CONFERENCE_RULES[conference]
  if (!rules) throw new Error(`Unknown conference: ${conference}`)

  const overallWinCounts
    = conference === 'Big 12' && allSeasonGames && knownFbsTeamIds
      ? deriveOverallWinCount(allSeasonGames, outcomes, knownFbsTeamIds, 1)
      : undefined
```

**The loop body to copy** — `resolveSlot` (`engine.ts:256-280`) is *already* the N-seed loop
body. The only change is that the caller loops instead of calling it exactly twice:

```ts
  const resolveSlot = (committed: ReadonlySet<TeamId>): TiebreakerResult => {
    const pool = rules.defineTiedTeams(baseOrdering, records, committed)
    if (pool.length === 1) {
      return { status: 'resolved', order: pool, trace: [] }
    }
    return resolveTiedGroup(
      pool,
      rules.defineTiedTeams,
      (size: number) => (size === 2 ? rules.twoTeamSteps : rules.multiTeamSteps),
      baseOrdering, records, overallWinCounts, committed, rules.terminalReason
    )
  }
```

**Do NOT copy** the two-call driver at `engine.ts:283-291`:

```ts
  const seed1 = resolveSlot(new Set<TeamId>())
  const seed2 = seed1.status === 'resolved' ? resolveSlot(new Set([seed1.order[0]!])) : seed1
```

Two *independent* resolutions are the root cause of the seed1/seed2 contradiction (D-04 bug 2).
Replace with one `while (committed.size < teamIds.size)` loop per RESEARCH.md Pattern 1.

**Trace-accumulator pattern to change (Pitfall 5).** `resolveTiedGroup`'s `cycles` parameter
defaults at `engine.ts:67` and the *same array instance* is threaded through the whole
recursion and returned at :74, :108, :160, :184. That is correct *within* one slot. Pass a
fresh `cycles: []` per loop iteration so each `RankGroup.trace` is its own array.

**Guard repair (D-04 bug 1 / Pitfall 2).** Two guards exist. Delete the second only:

```ts
      // KEEP — real invariant on the partition remainder
      if (rest.length >= tiedTeams.length) {                       // engine.ts:122
        throw new Error('resolveTiedGroup: restart did not strictly shrink the tied group -- infinite recursion guard tripped')
      }
      ...
      // DELETE — false for the ACC by construction (acc.ts re-anchors, freely larger)
      if (nextTiedTeams.length >= tiedTeams.length) {               // engine.ts:136
        throw new Error('resolveTiedGroup: defineTiedTeams did not strictly shrink the tied group on restart -- infinite recursion guard tripped')
      }
```

Termination is guaranteed instead by the mechanism the docblock already states at
`engine.ts:22-36`: `alreadyCommitted` grows by ≥1 per restart and `defineTiedTeams` is
contracted to exclude every id in it (`acc.ts:51`, `acc.ts:85` show the exclusion). Add a
defensive depth cap.

**Unseparated-top-bucket repair (Pitfall 1 / 19.2%).** The defect is the merge at
`engine.ts:156-161`:

```ts
      if (restResult.status === 'resolved') {
        return { status: 'resolved', order: [...winners!, ...restResult.order], trace: restResult.trace }
      }
```

`winners` comes from `outcome.partition[0]`, which `partitionByStepValue` sorted by raw team id
(`steps.ts:296`, `steps.ts:300`, `steps.ts:307` — three separate `.sort((a, b) => a - b)`
calls). When `winners.length > 1` that order is a database-id sort. Restart the procedure on
that bucket instead of emitting it.

---

### `shared/domain/tiebreakers/types.ts` — add `RankGroup` / `ConferenceRanking` (model)

**Analog:** the discriminated-union + docblock house style, `types.ts:110-142`.

```ts
/**
 * The result of resolving both championship spots (seed 1 and seed 2) for a
 * conference. Each seed is resolved independently; if seed 1 is
 * needsUserInput, seed 2 is set to the same result (both spots blocked).
 */
export interface ChampionshipResult {
  conference: ConferenceId
  seed1: TiebreakerResult
  seed2: TiebreakerResult
}
```

Conventions to carry into the new types: every exported type carries a docblock naming the
decision id it implements (`D-01:`, `D-04:`, `D-08:`); `readonly` on every array field
(`types.ts:95-98`); `TeamId`/`GameId` aliases never widened to bare `number` (`types.ts:1-10`);
`StepValue` is a discriminated union on `kind` (`types.ts:63-66`) — the D-08 hash must switch
on that discriminant exhaustively.

`ChampionshipResult` is **deprecated by this phase** (RESEARCH §State of the Art). Replace with
a `championshipFor(ranking)` helper; do not maintain both shapes.

---

### `shared/domain/standings/slateCompletion.ts` (NEW — domain predicate, D-07)

**Analog:** `shared/domain/standings/computeStandings.ts` — two functions to reuse, not re-derive.

**The game-filter to call, never reimplement** (`computeStandings.ts:67-72`):

```ts
export function conferenceGamesFor(
  games: readonly Game[],
  teamIds: ReadonlySet<TeamId>
): readonly Game[] {
  return games.filter(g => g.conferenceGame && teamIds.has(g.homeId) && teamIds.has(g.awayId))
}
```

Its docblock (`:56-66`) states why both conditions are required: one 2026 game is
same-conference but flagged non-conference. A `homeTeam.conference === awayTeam.conference`
check would get it wrong.

**The untrusted-input discipline to mirror** (`computeStandings.ts:40-54`):

```ts
export function toOutcomes(games, picks): ReadonlyMap<GameId, TeamId> {
  const outcomes = new Map<GameId, TeamId>()
  for (const game of games) {                    // iterate GAMES, not picks — unknown ids
    const winnerId = picks[game.id]              // are structurally excluded
    if (winnerId === undefined) continue
    if (winnerId !== game.homeId && winnerId !== game.awayId) continue   // silent drop
    outcomes.set(game.id, winnerId)
  }
  return outcomes
}
```

Silent-drop-not-throw is the established disposition for corrupt client input. `useManualTiebreakers`
must follow the same rule (Pitfall 8).

---

### `shared/domain/standings/computeStandings.ts` — delete the union-find (domain, transform)

**Analog:** itself. **Keep** the constructive assembly (`computeStandings.ts:448-460`) — this is
the load-bearing property Phase 5 recorded, and it survives verbatim:

```ts
    const ordered: StandingsTeam[] = []
    for (const component of orderedComponents(rows, placements, confWinPct)) {
      // Standard competition ranking: every row in a component shares one plus
      // the index of that component's first row. Components are contiguous by
      // construction, so ranks are non-decreasing down the table.
      const rank = ordered.length + 1
      for (const row of component) {
        row.rank = rank
        row.isTied = component.length > 1
        ordered.push(row)
      }
    }
```

Substitute `ranking.groups` for `orderedComponents(...)` and the whole of :80-342 —
`SeedPlacement`, `resolvedSeedGroups`, `seedPlacements`, `recordKey`, `rankComponents`,
`compareWithinComponent`, `orderedComponents` — is deleted.

**Keep** the per-row build and the authoritative win-pct read (`computeStandings.ts:416-446`),
notably the WR-02 comment at :422-429: win percentage is read off `ConferenceRecord.winPct`,
never re-derived. And `deriveConferenceRecords` is called for *both* overall (:408) and
conference (:416) tallies — one tallier, per CLAUDE.md DRY.

**Do NOT copy** `recordKey` (`:163-165`) or the record-equality union at `:222-226` into any new
code. That relation is the "adjacent-record comparison" that Pattern 6 forbids for marker (a).

---

### `shared/domain/standings/resolveTiebreakers.ts` — per-conference isolation (domain orchestrator)

**Analog:** itself, whole file. **Keep every structural element**, changing only the return type
and the engine function called:

```ts
  for (const conference of P4_CONFERENCES) {
    const confTeamIds = new Set<TeamId>(
      teams.filter(t => t.conference === conference).map(t => t.id)
    )
    if (confTeamIds.size === 0) continue

    try {
      resolved[conference] = resolveConferenceChampionship(     // → resolveConferenceRanking
        conference, conferenceGamesFor(games, confTeamIds), outcomes,
        confTeamIds, games, knownFbsTeamIds
      )
    } catch (error) {
      // Omit this conference; standings fall back to pure record ordering.
      // Only the conference name and the error object are logged — never the
      // picks, the storage key or a share code (T-05-03-03).
      console.warn(
        `[standings] tiebreaker resolution failed for ${conference}; falling back to record order.`,
        error
      )
    }
  }
```

Three patterns are mandatory to preserve: the per-conference `try`/`catch` (one conference's bad
state can never blank the other three); the **T-05-03-03 logging rule** at :74-81 (conference
name + error object only — extend verbatim to any new `console.warn` in this phase); and the
FBS-id-set derivation at :55 for the Big 12 total-wins cap.

`ResolvedTiebreakers` (`:12`) is `Partial<Record<ConferenceId, ...>>` — deliberately partial
because of the omit-on-throw path. Keep it partial when it becomes
`Partial<Record<ConferenceId, ConferenceRanking>>`. Note WR-06 tightens the *`StandingsResult`*
type, not this one.

---

### `app/composables/useManualTiebreakers.ts` (NEW — composable, CRUD over localStorage)

**Analog:** `app/composables/useAutoFilledGames.ts` — whole file. Chosen over `usePicksStorage`
because it is the precedent for a **secondary, non-picks** store: separate season-namespaced key,
custom serializer, shape validation, and a `computed` lookup view over the raw ref. Its docblock
(:26-30) explains exactly why a second key beats widening the picks object — the same argument
applies to manual decisions and to Phase 8's share link.

**Storage pattern** (`useAutoFilledGames.ts:35-64`):

```ts
export function useAutoFilledGames(season = 2026) {
  const key = `cfb_autofilled_${season}`

  const autoFilled = useStorage<number[]>(
    key,
    [],
    localStorage,
    {
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            if (Array.isArray(parsed)) {
              return parsed as number[]
            }
            throw new Error('Invalid autoFilled shape: expected array')
          } catch {
            // Corruption is less critical for provenance (just bookkeeping).
            // Silently reset to empty array and continue.
            return []
          }
        },
        write(v: number[]) { return JSON.stringify(v) }
      }
    }
  )

  const autoFilledSet = computed(() => new Set(autoFilled.value))
  ...
  return { autoFilled, autoFilledSet, markAutoFilled, isAutoFilled }
}
```

Conventions to carry: `import { useStorage } from '@vueuse/core'` + `import { computed } from 'vue'`
(explicit, not the Nuxt module auto-import); `season = 2026` default param; key literal built
as `cfb_<thing>_${season}`; validate-then-throw-into-`catch` inside `serializer.read`; return an
object of named refs/computeds/functions, never a bare ref, when there is more than one member.

**Do NOT copy** `usePicksStorage`'s `_corrupt`-key preservation (`usePicksStorage.ts:39-62`):

```ts
            // D-07: Preserve corrupted data under _corrupt key
            const alreadyStored = localStorage.getItem(corruptKey)
            if (!alreadyStored) { localStorage.setItem(corruptKey, v) }
            console.debug(`Picks data corrupted and recovered. Original preserved at '${corruptKey}'.`)
            return {}
```

That is PICK-08's contract for *picks* specifically. Manual decisions are hash-keyed,
ephemeral-by-design and re-promptable, so `useAutoFilledGames`' plain silent reset is the
correct disposition (RESEARCH Pitfall 8 says decide explicitly — this is the decision).

**No analog for the D-08 read-side gates.** UI-SPEC §9.2 requires two independent gates
(slate-complete AND hash-match-with-set-equality) and delete-on-read for a mismatch. Nothing in
the repo does this; build it from RESEARCH Pattern 4. The nearest discipline is `toOutcomes`'
silent drop, quoted above. Storage shape: `{ [conference]: { [hash]: orderedTeamIds } }` — flat,
no `suspended` flag, no timestamp (UI-SPEC §9.2 — suspension needs no new field).

---

### `app/composables/useStandings.ts` (NEW — composable, IN-02 seam)

**Analog:** `app/composables/usePickProgress.ts:29-59` — the established shape for
"`computed` over TanStack Query data + the picks ref".

```ts
export function usePickProgress(season = 2026) {
  const picks = usePicksStorage(season)
  const { data: gamesData } = useGames(season)

  const progressOverall = computed<PickProgress>(() => {
    const games = gamesData.value?.games ?? []
    ...
  })

  function progressForWeek(weekNum: number) { return computed<PickProgress>(() => { ... }) }

  return { progressOverall, progressForWeek }
}
```

**The code being extracted** — `app/pages/week/[week].vue:98-113`, move verbatim then
de-duplicate the readiness guard:

```ts
// D-13/STAND-02: standings are a plain `computed` over (games, teams, picks)
// — no watcher, no debounce. Vue invalidates it the instant `picks` mutates,
// so a pick and its standings consequence land in the same render.
const resolvedTiebreakers = computed(() => {
  const slate = games.value?.games
  if (!slate || !teams.value) return undefined
  return resolveAllConferences(slate, teams.value, picks.value)
})

const standings = computed<StandingsResult>(() => {
  const slate = games.value?.games
  if (!slate || !teams.value) return {}     // ← WR-06 makes `{}` illegal; return undefined
  return computeStandings(slate, teams.value, picks.value, resolvedTiebreakers.value)
})
```

Two divergent guards collapse into one `ready` computed, and the `{}` sentinel at :111 becomes
`undefined`. Keep the plain-`computed`, no-watcher, no-debounce rule (comment at :98-102 —
measured 0.88 ms, and RESEARCH measured N-seed at 0.45 ms).

**Query-layer convention** (`app/composables/useGames.ts:12-19`) — the composable must consume
`useGames()`/`useTeams()`, never `$fetch` directly:

```ts
export function useGames(season = 2026) {
  return useQuery({
    queryKey: queryKeys.games(season),
    queryFn: () => fetchGamesEnvelope(season),
    staleTime: Infinity,
    gcTime: Infinity
  })
}
```

---

### `app/components/StandingsTable.vue` (MOD — markers, expansion, inline prompt)

**Analog:** itself. This is the center of gravity for the phase's UI work.

**Import + dumb-component contract to preserve** (`StandingsTable.vue:1-27`):

```vue
<script setup lang="ts">
// `useId` is imported explicitly from 'vue' rather than taken from Nuxt's
// auto-import, so this component mounts in a plain vitest run (the project's
// vitest config registers no Nuxt auto-import plugin — see GameCard.test.ts's
// note on why its component was left untestable).
import { useId } from 'vue'
import type { StandingsTeam } from '#shared/types/standings'

defineProps<{
  standings: StandingsTeam[]
  conferenceName: string
}>()

const headingId = useId()
</script>
```

This constraint is verified: `vitest.config.ts` registers only `plugins: [vue()]` with aliases
for `~/`, `#shared/`, `#app/`. Add `ranking: ConferenceRanking | undefined` as one new prop
(UI-SPEC §5.1) and keep the component otherwise dumb.

**Row/cell markup to extend, not replace** (`StandingsTable.vue:90-121`):

```vue
      <tbody class="divide-y divide-default">
        <tr
          v-for="team in standings"
          :key="team.id"
          class="hover:bg-elevated/60 transition-colors"
        >
          <td class="py-1.5 pr-2 text-left tabular-nums font-medium text-default">
            {{ team.rank }}
          </td>
          <th scope="row" class="py-1.5 pr-2 text-left font-normal text-highlighted">
            {{ team.school }}
          </th>
          <td class="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap text-muted">
            {{ team.overallRecord.wins }}-{{ team.overallRecord.losses }}
          </td>
          <td class="py-1.5 text-right tabular-nums whitespace-nowrap text-default">
            {{ team.confRecord.wins }}-{{ team.confRecord.losses }}
          </td>
        </tr>
      </tbody>
```

Established conventions visible here and required for new rows: `py-1.5` vertical rhythm
(UI-SPEC §2's one documented exception); `tabular-nums` on every numeric cell; `<th scope="row">`
for the team name; semantic Nuxt UI utility classes only (`text-muted`, `text-highlighted`,
`bg-elevated`, `divide-default`) — **zero raw palette classes anywhere in this file**;
`<caption class="sr-only">` for the table's accessible description (:52-54).

**Do NOT copy** the D-05/D-06 comment block at `:96-100` and `:9-20`:

```vue
 * Ties need no badge, icon, or tooltip (D-05/D-06) — matching rank numbers
 * next to matching W-L values are the indication.
```

D-10 reverses this. The comment and the rationale both go.

---

### `app/components/TiebreakerReasoning.vue` (NEW) and the rank-chip disclosure

**Analog:** `app/components/StandingsSidebar.vue:70-112` — the only hand-rolled
expand/collapse in the repo, built this way *specifically* to stay mountable in the plain
vitest project.

```vue
<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { StandingsResult } from '#shared/types/standings'
import { P4_CONFERENCES } from '#shared/domain/standings'
import StandingsTable from './StandingsTable.vue'      // relative, not auto-import
...
// Ephemeral, per-session sidebar visibility on narrow viewports (D-01).
// Deliberately not persisted: it is a viewing preference for the current
// scroll position, not part of the user's scenario.
const expanded = ref(false)
const panelId = useId()
</script>
```

```vue
    <button
      type="button"
      class="lg:hidden mb-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-default bg-elevated ring ring-accented hover:bg-accented transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :aria-expanded="expanded"
      :aria-controls="panelId"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Hide standings' : 'Show standings' }}
      <!-- Decorative: the button's own text already says which way it goes,
           so the chevron is hidden from assistive tech. -->
      <svg
        class="size-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75"
        stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </button>
```

Everything the phase's interactive controls need is here and is directly reusable:
`<button type="button">` + `:aria-expanded` + `:aria-controls="useId()"`; text-label toggling
rather than an icon-only control (UI-SPEC §12.2 requires the same); the exact
`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` ring that
UI-SPEC §4 names as the *only* permitted accent use; and the inline `<svg stroke="currentColor"
aria-hidden="true">` precedent replacing `UIcon`.

Also reusable: the "ephemeral, deliberately not persisted" comment pattern at :70-72 — the
expansion state of a reasoning group is exactly the same class of state and should carry the
same justification.

---

### `app/components/ChampionshipCard.vue` (NEW — no direct analog)

**Nearest analog:** `StandingsTable.vue:1-27` for the dumb-props + explicit-import contract
(quoted above). Surface/spacing comes from `StandingsSidebar.vue:116`, the repo's only
elevated-panel class string:

```vue
      class="lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto overscroll-contain rounded-lg bg-default ring ring-default p-3 sm:p-4"
```

UI-SPEC §5.1 specifies `bg-elevated ring ring-accented rounded-lg p-3 mb-4` — the same
`rounded-lg` + `ring ring-*` + `bg-*` composition one surface level up. Eyebrow typography is
already established at `StandingsTable.vue:34-39`:

```vue
    <h3
      :id="headingId"
      class="text-xs font-semibold uppercase tracking-wide text-toned mb-2"
    >
```

---

### Test files

**Pure-logic property test analog:** `tests/domain/standings/standings-tiebreaker-agreement.test.ts:242-330`
— the house style is a `violationsFor(label, picks): string[]` collector that accumulates
richly-formatted failure strings across all conferences, asserted once with
`expect(violations).toEqual([])`. Copy that shape for `n-seed-ranking.test.ts` and
`trace-isolation.test.ts`.

**Harness helpers to MOVE, not re-write** (`standings-tiebreaker-agreement.test.ts:209-240`):

```ts
function readJson<T>(relativePath: string): T {
  const url = new URL(relativePath, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as T
}

/**
 * mulberry32 — a self-contained deterministic PRNG. Written inline rather than
 * pulled from a package so this plan installs nothing (threat T-05-03-SC).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generatePicks(games, random, throughWeek?): Record<number, number> {
  const picks: Record<number, number> = {}
  for (const game of games) {
    if (throughWeek !== undefined && game.week > throughWeek) continue
    picks[game.id] = random() < 0.5 ? game.homeId : game.awayId
  }
  return picks
}
```

Slate loading convention: `readJson<{ games: Game[] }>('../../../public/data/2026/games.json')`
at module scope inside `describe` (:243-244). Relative-path depth changes when the helper moves
to `tests/helpers/`.

**Component test analog:** `tests/components/StandingsTable.test.ts` — full file, 99 lines.

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsTable from '~/components/StandingsTable.vue'
import type { StandingsTeam } from '../../shared/types/standings'

function row(overrides: Partial<StandingsTeam> = {}): StandingsTeam {
  return {
    id: 1, school: 'Alabama', conference: 'SEC',
    overallRecord: { wins: 9, losses: 2 },
    confRecord: { wins: 6, losses: 2 },
    rank: 1, isTied: false,
    ...overrides
  }
}
```

Conventions: `mount()` from `@vue/test-utils` with plain `props`, no global stubs and no Nuxt
plugins; a local `row(overrides)`/fixture-factory helper; assertions via
`wrapper.findAll('tbody tr').map(...)` on rendered text; component imported through the `~/`
alias while shared types use a relative path.

**Do NOT copy** the assertion at `:60-80` — it asserts the behaviour D-10 reverses:

```ts
  it('shows tied teams with matching rank numbers and no badge or icon (D-05/D-06)', () => {
    ...
    expect(wrapper.find('.badge').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('tied')
```

Rewriting this is a deliberate planned task. The inverted `expect(...svg...).toBe(false)` shape
is however exactly the right template for D-11's grep-style assertion (UI-SPEC §6):
`expect(markerHtml).not.toMatch(/:style|team\.color|bg-(red|blue|orange)-/)`.

**Composable test analog:** `tests/composables/usePicksStorage.test.ts:19-46` —
`localStorage.clear()` in both `beforeEach` and `afterEach`, `vi.clearAllMocks()`, `await nextTick()`
before reading `localStorage.getItem`, and a module-scope `STORAGE_KEY` constant mirroring the
composable's key literal.

**⚠️ Directory-convention conflict the planner must resolve.** RESEARCH.md prescribes
`tests/domain/tiebreakers/*.test.ts`, but **no such directory exists** — every existing
tiebreaker test is flat at `tests/tiebreakers-{acc,engine,steps,records,rules,sec,bigten,big12,baseOrdering}.test.ts`,
while standings tests *are* nested at `tests/domain/standings/`. `vitest.config.ts` uses
`include: ['tests/**/*.test.ts']` so either works. Pick one explicitly; the nested form matches
the newer (Phase 5) convention and RESEARCH's file list.

---

## Shared Patterns

### DRY single-implementation registry — call these, never re-derive

**Apply to:** every new domain file and every new composable. This is CLAUDE.md's hardest
constraint in this codebase and Phase 5's largest defect (CR-01) was violating it.

| Concern | The one implementation | Location |
|---|---|---|
| W-L tallying (conference AND overall) | `deriveConferenceRecords` | `shared/domain/tiebreakers/records.ts`; called at `computeStandings.ts:408` and `:416`, `engine.ts:232` |
| "Which games are this conference's" | `conferenceGamesFor` | `computeStandings.ts:67-72` |
| Untrusted pick validation | `toOutcomes` | `computeStandings.ts:40-54` |
| Which conferences are P4, in order | `P4_CONFERENCES` (frozen, `readonly`) | `computeStandings.ts:18-20` |
| Authoritative conference win pct | `ConferenceRecord.winPct` | read at `computeStandings.ts:427-429` |
| Frozen base ordering | `computeBaseOrdering`, computed once | `engine.ts:235` |
| Whether two teams are "tied" | `RankGroup.teams.length` / `contestedWith.length` — **the engine's OUTPUT** | `computeStandings.ts:85-113` docblock |
| Deterministic season generation | the existing `mulberry32` | `standings-tiebreaker-agreement.test.ts:218` |

### Barrel-export discipline

**Source:** `shared/domain/standings/index.ts` (whole file)
**Apply to:** `slateCompletion.ts`, `invalidation.ts`, and the new engine/type exports.

```ts
/**
 * The single public entry point into the standings domain (PROJECT.md's DRY
 * constraint: standings computation has exactly one implementation). Phase 5's
 * UI and Phase 6's tiebreaker UI both import from here, never from the
 * individual modules.
 *
 * `shared/domain/` is NOT part of Nuxt 4's auto-import scope (only
 * `shared/utils` and `shared/types` are), so callers import explicitly:
 * `import { computeStandings } from '#shared/domain/standings'`.
 */
export { computeStandings, conferenceGamesFor, toOutcomes, P4_CONFERENCES } from './computeStandings'
export { resolveAllConferences } from './resolveTiebreakers'
export type { ResolvedTiebreakers } from './resolveTiebreakers'
```

Note `shared/domain/tiebreakers/` has **no** `index.ts` — consumers import module paths directly
(`resolveTiebreakers.ts:2-3`). Adding one for the new `invalidation.ts` + `ConferenceRanking`
types would be consistent with the standings precedent; state the choice.

### Vitest-compatibility contract for every new component

**Source:** `StandingsTable.vue:1-6`, `StandingsSidebar.vue:1-10`, `vitest.config.ts:22`
(`plugins: [vue()]` — no Nuxt module)
**Apply to:** `ChampionshipCard.vue`, `TiebreakerReasoning.vue`, `StandingsTable.vue`

- `import { computed, ref, useId } from 'vue'` explicitly
- sibling components imported relatively: `import StandingsTable from './StandingsTable.vue'`
- shared types via the `#shared/` alias: `import type { StandingsTeam } from '#shared/types/standings'`
- zero `U*` Nuxt UI components; icons as inline `<svg stroke="currentColor" aria-hidden="true">`
- semantic Nuxt UI utility classes are CSS and ARE required — never raw palette (`bg-slate-200`)

### Diagnostic logging rule (T-05-03-03 / WR-03)

**Source:** `resolveTiebreakers.ts:74-81`
**Apply to:** every new `console.warn` / `console.debug` in this phase.

Log the conference name and the error object only — never picks, storage keys, or share codes.
`usePicksStorage.ts:56-58`'s `console.debug` is the precedent for a non-user-facing diagnostic.

### Docblock convention

**Source:** every file read. **Apply to:** all new files.

Every exported function and type carries a docblock that (a) states what it does, (b) cites the
decision id or requirement id it implements (`D-07:`, `WR-02:`, `T-05-03-02:`, `TIE-06:`), and
(c) where a design was contested, records *why the rejected alternative is wrong*. Examples:
`computeStandings.ts:85-113` (why the engine's output is the only tie definition),
`computeStandings.ts:269-286` (why constructive assembly, not a comparator),
`useAutoFilledGames.ts:26-30` (why a separate storage key). New files that skip this will read
as foreign in this codebase.

---

## Anti-Patterns Found In-Repo — do not copy these

| Source | Why it must not be copied here |
|---|---|
| `app/components/GameCard.vue` (223 lines) | Superficially the closest "card" analog, but it uses Nuxt UI components and Nuxt auto-imports and is therefore **untestable in the plain vitest project** (`tests/components/GameCard.test.ts` documents this). `ChampionshipCard.vue` must follow `StandingsTable.vue` instead. |
| `app/utils/teamContrast.ts` (175 lines) + GameCard's team-color accents | The repo's team-color/contrast machinery. **D-11 forbids team color in either marker** and UI-SPEC §6 makes a grep for `:style` / `team.color` inside marker markup an assertion. Do not reach for this file. |
| `computeStandings.ts:162-165, 214-237` (`recordKey`, record-equality union) | Deriving a tie relation from W-L. Forbidden for marker (a) (Pattern 6) and wrong for the ACC by construction. |
| `engine.ts:283-291` (two independent `resolveSlot` calls) | Root cause of the seed1/seed2 contradiction. |
| `engine.ts:136-140` (the `defineTiedTeams` size guard) | Rejects legal ACC behaviour; trips 44/100 fully-picked ACC seasons at N seeds. |
| `steps.ts:81, 99` (`_lostToAllOthersTeam`, assigned and never read) | The third engine defect. The underscore prefix is a silenced unused-variable warning, not a design. |
| `week/[week].vue:111` (`return {}` sentinel) | WR-06's tightened `StandingsResult` makes it illegal; the composable holds `undefined`. |
| `tests/components/StandingsTable.test.ts:60-80` | Asserts D-05/D-06, which D-10 reverses. |
| `standings-tiebreaker-agreement.test.ts` clause (iii) | Asserts "identical conference W-L ⇒ same rank", which D-01 makes false by design. |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shared/domain/tiebreakers/invalidation.ts` | utility | transform | No hashing/fingerprinting function exists anywhere in the repo. Use RESEARCH.md Pattern 4's FNV-1a verbatim. Nearest stylistic analog is `steps.ts:260-311`'s canonical bucket-keying over the `StepValue` discriminant. **Must be synchronous** — `crypto.subtle` is async and unusable from `computed()` (Pitfall 4). |
| `app/components/ChampionshipCard.vue` | component | render | No presentational card component exists that satisfies the plain-vitest constraint. Compose from `StandingsTable.vue`'s import contract + `StandingsSidebar.vue:116`'s panel class composition + UI-SPEC §5. |
| *(partial)* the D-08 two-gate read path in `useManualTiebreakers.ts` | composable | CRUD | The storage mechanics have an exact analog (`useAutoFilledGames.ts`); the gate-1/gate-2 + delete-on-read logic does not. Build from RESEARCH Pattern 4 and UI-SPEC §9.2, mirroring `toOutcomes`' silent-drop discipline. |

---

## Metadata

**Analog search scope:** `shared/domain/{tiebreakers,standings}/`, `shared/types/`,
`app/{components,composables,pages,utils,plugins}/`, `tests/**`, `vitest.config.ts`

**Files read this session (14):** `engine.ts`, `types.ts`, `acc.ts`, `steps.ts` (:30-180, :280-320),
`rules.ts` (:1-60), `computeStandings.ts`, `resolveTiebreakers.ts`, `standings/index.ts`,
`shared/types/standings.ts`, `StandingsTable.vue`, `StandingsSidebar.vue`, `week/[week].vue`,
`usePicksStorage.ts`, `useAutoFilledGames.ts`, `usePickProgress.ts`, `useGames.ts`,
`vitest.config.ts`, `tests/components/StandingsTable.test.ts`,
`tests/domain/standings/standings-tiebreaker-agreement.test.ts` (:195-324),
`tests/composables/usePicksStorage.test.ts` (:1-80)

**Pattern extraction date:** 2026-08-17
