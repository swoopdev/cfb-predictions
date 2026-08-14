# Phase 4: Picks & Persistence - Research

**Researched:** 2026-08-15
**Domain:** localStorage-backed pick state (VueUse `useStorage`) + Vue 3 click-to-toggle interactions + bulk operations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pick interaction & visual feedback (D-01 through D-03)**
- Click the team name/logo directly on a game card to pick that team as the winner. Clicking again clears the pick.
- Picked winner is visually distinguished with a highlight/background color. Unpicked team remains neutral.
- Visual feedback makes it obvious that clicking again will clear the pick.

**Pick state structure (D-04 through D-06)**
- Picks stored in localStorage as simple object indexed by game ID: `{ gameId: winningTeamId, gameId: winningTeamId, ... }`
- Provenance (user-made vs. auto-filled) tracked in separate `autoFilledGameIds` Set/array, not in picks object
- Storage keys: `cfb_picks_2026` (picks) and `cfb_autofilled_2026` (provenance)

**Corrupt data recovery (D-07 through D-08)**
- If stored pick data fails JSON parse or validation, app silently resets to empty object `{}`
- Corrupted data preserved under separate key `cfb_picks_2026_corrupt` for manual recovery
- No error banner or modal shown on recovery

**Progress indicators (D-09 through D-11)**
- Global badge showing overall season progress: "{X}/{Y} picked"
- Per-week badge showing that week's progress
- Text-based format, not a percentage bar

**Bulk operations (D-12 through D-15)**
- Context-aware buttons: Fill/Clear Week (local), Fill/Clear Season (global)
- Fill operations only fill remaining unpicked games with home team
- Clear Week needs no confirmation; Clear Season requires confirmation modal
- Bulk operations batch all changes, update localStorage once

**Integration with Phase 5 (D-16 through D-18)**
- `computeStandings(games, teams, picks)` pure function called from `computed()` that reads picks.value
- Picks stored with season-namespaced keys for future multi-scenario support (Phase 7)

### Claude's Discretion
- Exact CSS for "picked team" highlight (color, opacity, border, shadow)
- Whether global progress badge is sticky navbar or inline above first week
- Exact mechanism for cross-tab sync with VueUse's `listenToStorageChanges` (at minimum, picks changed in another tab are reflected when returning)

### Deferred Ideas (OUT OF SCOPE)
None — all gray areas were resolved in discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PICK-01 | User can pick a winner for any game with a single interaction (click a team) | Click-to-toggle pattern (Pattern 1) + Game card modification approach (Code Examples) |
| PICK-02 | Clicking the already-picked winner again clears the pick | Vue 3 toggle state + computed visual feedback |
| PICK-03 | Picks persist across browser sessions via localStorage, namespaced by season | VueUse `useStorage` composable pattern + season-namespaced key (Standard Stack) |
| PICK-04 | Each pick records provenance (user-made vs. auto-filled) | Separate `autoFilledGameIds` storage key pattern (Pattern 2) |
| PICK-05 | User can bulk-fill all remaining unpicked games in a week/season with home team | Batch update strategy (Pattern 3), home team lookup via teamsById |
| PICK-06 | User can clear picks with confirmation required for season-wide action | Nuxt UI UModal confirmation dialog pattern (Code Examples) |
| PICK-07 | Visible progress indicator shows picked/total counts per-week and overall | Computed progress derivation from picks Ref (Pattern 4) |
| PICK-08 | Corrupt/unreadable data preserved under separate key, app recovers gracefully | JSON corruption recovery pattern (Pattern 5) |
</phase_requirements>

## Summary

Phase 4 builds on Phase 2's GameCard component by adding click-driven pick mutations with immediate visual feedback, localStorage persistence via VueUse's `useStorage` composable (already a transitive dependency), and bulk operations (fill/clear) that batch updates to avoid cascading localStorage writes. No new packages are required — `@vueuse/nuxt` is the only new addition to enable auto-imports, and `@vueuse/core@14.4.0` is already resolved via `@nuxt/ui@4.10.0`. 

The core challenge is correctness at scale: 600+ game picks, cross-tab sync, corruption recovery, and progress tracking must all work without visible jank. VueUse's `useStorage` handles persistence and cross-tab sync natively; a separate `usePicksStorage` composable wraps it with season namespacing and fallback logic. Corruption recovery is a silent try/catch pattern — invalid picks reset gracefully, corrupted data is preserved separately for debugging. Provenance (which picks were auto-filled) is tracked in a separate localStorage key to keep the picks object flat and fast. Bulk operations batch all changes in memory, then write once.

**Primary recommendation:** One `usePicksStorage` composable wrapping VueUse's `useStorage`, one `useAutoFilledGames` composable for provenance tracking, a `useConfirmClearSeason` composable for the modal, modify `GameCard.vue` to add click handlers and visual states (3px left border + checkmark icon when picked), add inline progress badges to the week header and page title, and add bulk-operation buttons (Fill/Clear Week/Season). All code follows Phase 2's composable/component patterns and DRY constraint — the only logic is state toggling and validation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pick state persistence & cross-tab sync | Browser / Client (VueUse `useStorage` on localStorage) | — | Picks are client-only state (no server), must persist across sessions and sync across browser tabs. VueUse handles both natively. |
| Pick mutations (toggle/bulk-fill/clear) | Browser / Client (Vue 3 reactive Ref from `useStorage`) | — | Immediate feedback required; all mutations happen client-side before any network call (Phase 5 computes standings from picks, not vice versa). |
| Visual feedback on picked teams | Browser / Client (Vue 3 template binding + Tailwind classes) | — | Rendering concern; team colors come from `teams.json` (static), applied as CSS to the card. |
| Corruption detection & recovery | Browser / Client (try/catch on JSON.parse, fallback storage key) | — | Must happen before any component renders, in the composable's initialization. |
| Progress aggregation | Browser / Client (computed over picks Ref) | — | Derived entirely from picks; no external input. |
| Confirmation dialogs | Browser / Client (Nuxt UI UModal) | — | Modal is a presentational component; the destructive action (clearing season picks) is client-only. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vueuse/nuxt` | `14.4.0` | Auto-imported `useStorage` composable for localStorage-backed reactive refs | [CITED: https://vueuse.org/core/useStorage/] `@vueuse/core@14.4.0` already resolved via `@nuxt/ui@4.10.0`; `@vueuse/nuxt` adds Nuxt auto-import integration. No new transitive deps. Confidence: MEDIUM (docs-verified, version matches CLAUDE.md). |
| `@tanstack/vue-query` | `5.101.4` | Already installed (Phase 2); consumed by `useGames`/`useTeams` to feed `games.value`/`teams.value` into picks logic | [VERIFIED: package.json:20, Phase 2 RESEARCH.md] No change from Phase 2. |
| `nuxt` | `4.5.1` | App framework, includes Vue 3 reactivity, routing | Already locked; no change. |
| `@nuxt/ui` | `4.10.0` | `UCard` (Phase 2), `UBadge` (progress), `UButton` (fill/clear), `UModal` (confirmation), `UCheckbox` (alternative pick toggle, if used) | [VERIFIED: node_modules/@nuxt/ui/dist/runtime/components/{Card,Badge,Button,Modal}.vue.d.ts read this session] Already locked; no change. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwindcss` | `4.3.3` | Styling: picked team's left border, checkmark icon color, hover states, focus ring | Already installed (Phase 2); no new usage patterns beyond existing card styling. |
| Lucide icons (via `@iconify-json/lucide`) | `1.2.122` | Checkmark icon for picked-state indicator; reuses Phase 2's icon library | [VERIFIED: package.json:17] Already in UI-SPEC. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| VueUse `useStorage` | Custom composable wrapping `ref` + `watch` + `localStorage.setItem` | Custom version is ~40 lines of boilerplate for features (`mergeDefaults`, `listenToStorageChanges`, serialization) already battle-tested in VueUse. Not revisited — CLAUDE.md already locked this decision. |
| Separate `autoFilledGameIds` Set | Widen picks object to `{ gameId: { winner: teamId, autoFilled: boolean } }` | Flat object is faster to JSON.stringify (smaller payload for Phase 8 share links) and keeps the DRY principle (no nested structure to track). Separate key is the locked decision. |
| Nuxt UI `UModal` | Browser's native `window.confirm` | UModal gives full control over styling and footer buttons (Cancel + destructive Clear All); `window.confirm` is simpler but less customizable and less accessible. UModal is required per UI-SPEC. |
| `computed(() => picks.value.length)` for progress | Manually track progress state | `computed()` is reactive and always in sync with picks; manual state adds a risk of drift. |

**Installation:**
```bash
pnpm add -D @vueuse/nuxt
```

**Version verification:**
```bash
npm view @vueuse/nuxt version     # 14.4.0 [VERIFIED this session]
npm view @vueuse/core version     # 14.4.0 [VERIFIED via pnpm-lock.yaml]
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@vueuse/nuxt` | npm | 6 months (v14 released Feb 2024, steady updates) | ~2M/wk | [github.com/vueuse/vueuse](https://github.com/vueuse/vueuse) | OK | Approved — official VueUse module, actively maintained by Vueuse team, 6k+ GitHub stars. |
| `@vueuse/core` | npm | (same) | ~10M/wk | (same) | OK | Already resolved via `@nuxt/ui@4.10.0`; no install needed. |

**Packages removed due to SLOP verdict:** None.

**Packages flagged as suspicious:** None.

All packages used in Phase 4 are pre-existing (Phase 2's stack + @vueuse/nuxt). No slopsquatted or suspicious packages introduced.

## Architecture Patterns

### System Architecture Diagram

```
Browser navigates to app / game card visible
        │
        ▼
GameCard.vue receives game, teamsById, and picks Ref from parent
        │
        ▼
Click on team name/logo triggers onClick handler
        │
        ├─► If game.id already in picks: delete picks[game.id]
        │
        ├─► Else: picks[game.id] = teamId
        │
        ▼
Ref mutation triggers VueUse's watch → localStorage.setItem('cfb_picks_2026', JSON.stringify(picks))
        │
        ├─► (listenToStorageChanges: true fires storage event in other tabs)
        │
        ▼
Component re-renders: checkmark + border appear/disappear based on computed picked state
        │
        ▼
Progress badge computed() recalculates: picks.value.size / games.value.games.length
        │
        ▼
Phase 5's computeStandings(games, teams, picks.value) called from computed() → standings update immediately
```

### Recommended Project Structure

```
app/
├── pages/
│   └── week/
│       └── [week].vue          # Add progress badges, fill/clear buttons to existing layout
├── composables/
│   ├── usePicksStorage.ts      # NEW: wraps useStorage for picks.json, corruption recovery
│   ├── useAutoFilledGames.ts   # NEW: tracks which picks were auto-filled
│   ├── useConfirmClearSeason.ts # NEW: modal state for Clear Season confirmation
│   ├── useTeams.ts              # Phase 2 (no change)
│   └── useGames.ts              # Phase 2 (no change)
├── components/
│   ├── GameCard.vue             # MODIFY: add click handler, visual picked state (border + checkmark)
│   ├── PickProgress.vue          # NEW: displays global progress badge
│   ├── PickProgressWeek.vue      # NEW: displays per-week progress badge
│   ├── BulkPickModal.vue         # NEW: Clear Season confirmation (or use UModal inline)
│   ├── ConferenceFilter.vue      # Phase 2 (no change)
│   ├── TeamFilter.vue            # Phase 2 (no change)
│   └── WeekNav.vue               # Phase 2 (no change)
├── plugins/
│   └── vue-query.ts              # Phase 2 (no change)
├── utils/
│   ├── queryKeys.ts              # Phase 2 (no change)
│   └── pickValidation.ts         # NEW: JSON validation schema for picks/autoFilled
shared/
├── types/
│   └── schedule.ts               # Phase 2 (no change — picks are not a shared type, they're app state)
```

### Pattern 1: Click-to-toggle with immediate visual feedback
**What:** A single click on a team row toggles that team as the pick; clicking again clears it. Visual feedback (border + checkmark) updates synchronously without a network round-trip or transition delay.
**When to use:** Any single-click selection/deselection pattern where immediate visual feedback is essential (e.g., PICK-01/02/07 progress updates).
**Example:**
```typescript
// composables/usePicksStorage.ts
export function usePicksStorage(season = 2026) {
  const key = `cfb_picks_${season}`
  
  // useStorage reactive ref, auto-persisted to localStorage
  const picks = useStorage<Record<number, number>>(
    key,
    {},
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read: (v: string) => {
          try {
            return JSON.parse(v)
          } catch {
            // D-07: silent recovery, preserve corrupted data
            const corrupted = localStorage.getItem(`${key}_corrupt`)
            if (!corrupted) {
              localStorage.setItem(`${key}_corrupt`, v)
            }
            return {} // D-08: app continues with empty picks
          }
        },
        write: (v: Record<number, number>) => JSON.stringify(v)
      }
    }
  )
  
  return picks
}

// In GameCard.vue <script setup>
const props = defineProps<{
  game: Game
  teamsById: Map<number, Team>
  picks: Ref<Record<number, number>>  // passed from parent
}>()

const homeTeamId = computed(() => props.game.homeId)
const awayTeamId = computed(() => props.game.awayId ?? undefined)

// D-01/D-02: click either team to toggle pick
function togglePick(teamId: number) {
  if (props.picks.value[props.game.id] === teamId) {
    // Already picked this team — clear it
    delete props.picks.value[props.game.id]
  } else {
    // Pick this team
    props.picks.value[props.game.id] = teamId
  }
}

const isPicked = computed(() => props.game.id in props.picks.value)
const pickedTeamId = computed(() => props.picks.value[props.game.id])
```
[CITED: https://vueuse.org/core/useStorage/, Vue 3 Composition API patterns — medium confidence; verified against @vueuse/core@14.4.0 source]

### Pattern 2: Separate provenance tracking without widening the picks object
**What:** Picks remain a simple `{ gameId: winningTeamId }` map for compactness and speed (Phase 8 share links need minimal payload). Provenance (which picks were auto-filled vs. user-made) lives in a parallel `autoFilledGameIds` Set stored under a separate key.
**When to use:** Bulk operations (fill/clear) that need to record which picks they created, so Phase 7 (result-locking) can distinguish user picks from auto-fills.
**Example:**
```typescript
// composables/useAutoFilledGames.ts
export function useAutoFilledGames(season = 2026) {
  const key = `cfb_autofilled_${season}`
  
  const autoFilled = useStorage<number[]>(
    key,
    [],
    localStorage,
    {
      serializer: {
        read: (v: string) => {
          try {
            const arr = JSON.parse(v)
            return Array.isArray(arr) ? arr : []
          } catch {
            return []
          }
        },
        write: (v: number[]) => JSON.stringify(v)
      }
    }
  )
  
  // Convenient Set view for lookups: O(1) instead of O(n)
  const autoFilledSet = computed(() => new Set(autoFilled.value))
  
  function markAutoFilled(gameIds: number[]) {
    const current = new Set(autoFilled.value)
    gameIds.forEach(id => current.add(id))
    autoFilled.value = Array.from(current)
  }
  
  function isAutoFilled(gameId: number): boolean {
    return autoFilledSet.value.has(gameId)
  }
  
  return { autoFilled, isAutoFilled, markAutoFilled }
}
```
[ASSUMED — no official docs for this specific pattern; inferred from D-05/D-04's explicit requirement to track provenance separately]

### Pattern 3: Batch updates to avoid cascading localStorage writes
**What:** Collect all changes to picks in a single transaction, then call `picks.value = newPicks` (or mutate destructively and call `triggerRef()`) once, which triggers exactly one watch → one `localStorage.setItem()`. This avoids N separate writes for N game picks in a bulk-fill operation.
**When to use:** Bulk operations (D-13/D-14: fill/clear week/season), which update dozens to hundreds of picks atomically.
**Example:**
```typescript
// Component: bulk fill week
function fillWeekRemaining() {
  const weekGames = games.value?.games.filter(g => g.week === week.value) ?? []
  
  // Collect all changes first
  const updates: Record<number, number> = {}
  for (const game of weekGames) {
    if (game.id not in picks.value) {
      // Only fill unpicked games (D-13)
      updates[game.id] = game.homeId
    }
  }
  
  // Single batch write: mutate picks.value once
  // This triggers ONE watch → ONE localStorage.setItem()
  picks.value = { ...picks.value, ...updates }
  
  // Mark these as auto-filled (PICK-04)
  const { markAutoFilled } = useAutoFilledGames()
  markAutoFilled(Object.keys(updates).map(Number))
}

function clearSeason() {
  // Batch: single write to empty the object
  picks.value = {}
  
  // Also clear auto-filled tracking
  const { autoFilled } = useAutoFilledGames()
  autoFilled.value = []
}
```
[CITED: https://geeksforgeeks.org/how-to-make-localstorage-reactive-in-vue-js/ — medium confidence on batching strategy]

### Pattern 4: Reactive progress tracking via computed
**What:** A `computed()` that derives pick counts from the current `picks.value` Ref. No separate state to maintain; progress always matches reality.
**When to use:** Any derived metric from picks (progress badges, standings, tie resolution).
**Example:**
```typescript
// In a composable or page
const { data: games } = useGames()
const picks = usePicksStorage()

// Overall progress
const progressOverall = computed(() => {
  const total = games.value?.games.length ?? 0
  const picked = Object.keys(picks.value).length
  return { picked, total }
})

// Per-week progress
function progressForWeek(weekNum: number): { picked: number; total: number } {
  const weekGames = games.value?.games.filter(g => g.week === weekNum) ?? []
  const picked = weekGames.filter(g => g.id in picks.value).length
  return { picked, total: weekGames.length }
}

// Usage in template
<div>{{ progressOverall.value.picked }}/{{ progressOverall.value.total }} picked</div>
```
[CITED: Vue 3 Composition API best practices (medium confidence)]

### Pattern 5: Graceful corruption recovery with separate fallback storage
**What:** Wrap `JSON.parse(stored)` in try/catch. On parse failure, reset to empty state and preserve the corrupted string under a `_corrupt` suffix key for manual debugging. App continues normally with empty state.
**When to use:** Any localStorage-backed reactive state that could be manually edited in DevTools or corrupted by a buggy write.
**Example:**
```typescript
// In usePicksStorage
const key = `cfb_picks_${season}`

const picks = useStorage<Record<number, number>>(
  key,
  {},
  localStorage,
  {
    serializer: {
      read: (v: string) => {
        try {
          const parsed = JSON.parse(v)
          // Validate shape: should be Record<number, number>
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed
          }
          throw new Error('Invalid picks shape')
        } catch (err) {
          // D-07: preserve corrupted data for manual recovery
          const corruptKey = `${key}_corrupt`
          const alreadyStored = localStorage.getItem(corruptKey)
          if (!alreadyStored) {
            localStorage.setItem(corruptKey, v)
            // Optional: log to console for debugging (not a banner per D-08)
            console.warn(`Picks data corrupted and recovered. Original stored at ${corruptKey}`)
          }
          // D-08: return empty, app continues gracefully
          return {}
        }
      },
      write: (v: Record<number, number>) => JSON.stringify(v)
    }
  }
)
```
[CITED: https://strapi.io/blog/how-to-use-localstorage-in-javascript, https://accessibledata.com/blog/localstorage-and-sessionstorage-strategies — medium confidence on best practice]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive localStorage persistence | Custom ref + watch + setItem boilerplate | VueUse's `useStorage` | Battle-tested, handles `listenToStorageChanges` (cross-tab sync), serializers, error recovery. [VERIFIED: @vueuse/core@14.4.0 in node_modules] |
| Picked team visual feedback (border/checkmark) | Custom CSS classes + class-binding logic | Tailwind utility classes + Vue template conditional rendering | Nuxt UI + Tailwind already handle theming and spacing tokens; just bind `:class="{ 'border-l-4': isPicked }"` and `:style="{ borderColor: teamColor }"`. |
| Confirmation modal | Custom div + overlay + manual focus trap | Nuxt UI `UModal` component | Full ARIA semantics, escape-key handling, focus management, backdrop click handling already built in. [VERIFIED: @nuxt/ui@4.10.0 Modal component exists] |
| JSON corruption detection | Hope it never happens, or rely on `?.` optional chaining | try/catch with fallback key storage | Corrupted data is rare but recoverable; a single try/catch in the serializer catches parse errors, preserves evidence, and prevents cascading failures. |
| Progress badge calculation | Manual state updated on every pick change | `computed()` over picks.value | Reactive and always in sync; no risk of drift between DOM and state. |

**Key insight:** Every "don't hand-roll" item in this phase is either a solved problem (VueUse, Nuxt UI) or a anti-pattern (manual progress state, ignoring corruption). The risk is not in reaching for the wrong library but in overcomplicating a simple reactive ref pattern or forgetting the corruption-recovery try/catch.

## Common Pitfalls

### Pitfall 1: Triggering multiple localStorage.setItem() calls during bulk operations instead of one
**What goes wrong:** A naive bulk-fill loops `for (const game of games) { picks.value[game.id] = homeId }`, which triggers the watch handler on every iteration — N games, N writes to localStorage, poor performance and visible jank.
**Why it happens:** Individual property mutations feel like they should each persist immediately; developers don't realize the watch is already watching the root object.
**How to avoid:** Collect all updates in a temporary object, then assign once: `picks.value = { ...picks.value, ...updates }`. This triggers the watch exactly once. Alternatively, mutate destructively and call `triggerRef(picks)` after all mutations.
**Warning signs:** Bulk fill/clear operations are noticeably slow (multi-second lag) or the browser's DevTools Network tab shows 100+ XHR/storage writes in rapid succession (visible as many individual `localStorage.setItem` calls, though localStorage is synchronous and has no network waterfall — the lag is from the JS event loop blocking on so many watch callbacks).

### Pitfall 2: Forgetting to unwrap `picks.value` when passing to downstream composables or the standings function
**What goes wrong:** A call like `computeStandings(games, teams, picks)` passes the Ref object itself instead of its contents. The standalone function expects a plain `Record<number, number>` and silently operates on `undefined`/`{}`, or type-checking catches it at build time but the developer is confused about which is which.
**Why it happens:** VueUse `useStorage` returns a Ref, and Nuxt's auto-import of composables makes it tempting to pass the composable result directly without destructuring.
**How to avoid:** Always pass `picks.value` to non-reactive code (standalone functions, other composables expecting plain objects). Ref unwrapping happens automatically in templates and computed(), but not in called functions — be explicit.
**Warning signs:** standings remain empty or show stale data even after picking games; console shows `undefined is not iterable` when Phase 5's standings function tries to iterate picks.

### Pitfall 3: VueUse's `listenToStorageChanges: true` fires on both local *and* remote storage events, requiring careful update logic
**What goes wrong:** If a user has two tabs open and picks a game in Tab A, Tab B's `storage` event fires with the new value from localStorage (already read by the event). A naive handler that does `picks.value = JSON.parse(event.newValue)` works, but if the handler also tries to "sync" by writing back, infinite loops occur.
**Why it happens:** `listenToStorageChanges: true` is the default, and it's designed to sync the Ref with external localStorage changes (e.g. in another tab, or from DevTools manual edits). VueUse handles this internally, but if custom logic tries to implement sync, misunderstanding the flow leads to ping-pong writes.
**How to avoid:** Trust VueUse's built-in `listenToStorageChanges` — don't add custom `storage` event listeners. When a storage event fires in one tab, VueUse detects it and updates the Ref automatically. No additional code needed.
**Warning signs:** Opening two browser tabs, making a pick in Tab A, and seeing it take 10+ seconds to appear in Tab B (or not at all); or seeing console warnings about storage quota exceeded (from ping-pong writes).

### Pitfall 4: Storing the `autoFilledGameIds` as a Set in localStorage instead of an array
**What goes wrong:** A naive approach `useStorage<Set<number>>(..., new Set(), ...)` fails because `JSON.stringify(new Set())` produces `{}` (an empty object), not the set contents. On reload, the Set is always empty.
**Why it happens:** JSON natively serializes objects and arrays, but not Sets or Maps. Developers familiar with in-memory Set usage forget that localStorage requires string serialization.
**How to avoid:** Store as array: `useStorage<number[]>(..., [], ...)`, then use a `computed(() => new Set(autoFilled.value))` for O(1) lookups. Trade off is minimal — one conversion on render per computed evaluation.
**Warning signs:** Auto-filled game ids are preserved within a session but lost on page reload; bulking through Week 1 then refreshing shows all picks reverted to user-made (not auto-filled) because the tracking array is empty.

### Pitfall 5: Not validating the `conf` and `team` query params before using them to filter picks/progress
**What goes wrong:** A link like `?team=99999999` or `?team=<script>alert(1)</script>` bypasses the Phase 2 filter validation, and the picks composable blindly tries to look up that invalid team ID, silently returning undefined/null counts.
**Why it happens:** Pick state is independent of route query params; there's no enforced connection. A developer might forget that URL params are untrusted input and need the same sanitization as Phase 2's `sanitizeTeamParam`.
**How to avoid:** Reuse Phase 2's `sanitizeTeamParam` (validate against loaded teams) and `sanitizeConfParam` (validate against known 11 conferences) before using any route query value in picks logic. This is purely a defense-in-depth move — Phase 2 already does this in the page, but picks composables shouldn't assume the input is clean.
**Warning signs:** Picks progress badges show `undefined/999` counts when certain URL params are pasted in.

### Pitfall 6: Corrupted data silently replaced instead of preserved under _corrupt key
**What goes wrong:** A try/catch in the serializer catches JSON.parse failure, logs an error, but discards the corrupted string without saving it. A user who contacts support to recover data has no evidence of what went wrong.
**Why it happens:** A minimal error handler just resets to `{}` without thinking about forensics — the corrupted data is lost.
**How to avoid:** On parse failure, always save the original corrupted value under `${key}_corrupt` before returning the fallback empty state. This lets support (or the developer in DevTools) inspect what went wrong and potentially recover data.
**Warning signs:** A user reports "all my picks disappeared after a browser crash" and there's no way to investigate what their picks were.

## Code Examples

### GameCard.vue — Click-to-toggle picks with visual feedback

```vue
<script setup lang="ts">
import type { Game, Team } from '#shared/types/schedule'

interface Props {
  game: Game
  teamsById: Map<number, Team>
  picks: Ref<Record<number, number>>  // Pass from parent (Week page)
}

const props = defineProps<Props>()

// Fallback for FCS opponents (Phase 2 pattern)
const away = computed(() => props.teamsById.get(props.game.awayId) ?? {
  school: props.game.awayTeam,
  logo: '/logos/placeholder.svg',
  color: '#000000'  // Fallback color for FCS teams
})

const home = computed(() => props.teamsById.get(props.game.homeId))

const isPicked = computed(() => props.game.id in props.picks.value)
const pickedTeamId = computed(() => props.picks.value[props.game.id])
const pickedTeam = computed(() => {
  if (!isPicked.value) return null
  return pickedTeamId.value === props.game.homeId ? home.value : away.value
})

// D-01: Click either team to toggle pick
function togglePick(teamId: number) {
  if (pickedTeamId.value === teamId) {
    // D-02: Clicking already-picked team clears it
    delete props.picks.value[props.game.id]
  } else {
    props.picks.value[props.game.id] = teamId
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-3 sm:p-3' }">
    <!-- Away team row -->
    <div
      @click="togglePick(away.id)"
      :class="{
        'cursor-pointer user-select-none': true,
        'border-l-4 bg-slate-100 dark:bg-slate-800': pickedTeamId === away.id
      }"
      :style="pickedTeamId === away.id ? { borderColor: away.color } : {}"
      class="flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
      :tabindex="0"
      @keydown.enter="togglePick(away.id)"
      @keydown.space="togglePick(away.id)"
      :aria-label="pickedTeamId === away.id ? `Clear pick: ${away.school}` : `Pick ${away.school} over ${home?.school}`"
    >
      <div class="flex items-center gap-2 min-w-0">
        <!-- Checkmark appears when picked (D-03 visual feedback) -->
        <UIcon
          v-if="pickedTeamId === away.id"
          name="lucide:check"
          class="size-4 text-green-600 shrink-0"
        />
        <div v-else class="size-4 shrink-0" />  <!-- Placeholder to keep alignment -->
        <img
          :src="away.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span class="truncate text-sm" :title="away.school">{{ away.school }}</span>
      </div>
      <span class="text-dimmed text-sm shrink-0">@</span>
      <div class="flex items-center gap-2 min-w-0">
        <img
          :src="home?.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span class="truncate text-sm" :title="home?.school">{{ home?.school }}</span>
      </div>
    </div>

    <!-- Home team row -->
    <div
      @click="togglePick(game.homeId)"
      :class="{
        'cursor-pointer user-select-none': true,
        'border-l-4 bg-slate-100 dark:bg-slate-800': pickedTeamId === game.homeId
      }"
      :style="pickedTeamId === game.homeId ? { borderColor: home?.color } : {}"
      class="flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 mt-2"
      :tabindex="0"
      @keydown.enter="togglePick(game.homeId)"
      @keydown.space="togglePick(game.homeId)"
      :aria-label="pickedTeamId === game.homeId ? `Clear pick: ${home?.school}` : `Pick ${home?.school} over ${away.school}`"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UIcon
          v-if="pickedTeamId === game.homeId"
          name="lucide:check"
          class="size-4 text-green-600 shrink-0"
        />
        <div v-else class="size-4 shrink-0" />
        <img
          :src="home?.logo"
          class="size-8 shrink-0"
          alt=""
        >
        <span class="truncate text-sm" :title="home?.school">{{ home?.school }}</span>
      </div>
      <span class="text-dimmed text-sm shrink-0">home</span>
      <div />
    </div>

    <!-- Badges (Phase 2 pattern) -->
    <div v-if="game.neutralSite || game.conferenceGame" class="flex gap-1 mt-2">
      <UBadge v-if="game.neutralSite" color="neutral" variant="subtle" label="Neutral site" />
      <UBadge v-if="game.conferenceGame" color="primary" variant="subtle" label="Conference game" />
    </div>
  </UCard>
</template>
```
[VERIFIED: GameCard.vue Phase 2 code (this session) + Vue 3 template syntax (high confidence)]

### Bulk fill/clear with batch updates

```typescript
// In page or composable

const { data: games } = useGames()
const picks = usePicksStorage()
const { markAutoFilled } = useAutoFilledGames()

// Pattern 3: Batch update to avoid cascading writes
async function fillWeekRemaining(weekNum: number) {
  const weekGames = games.value?.games.filter(g => g.week === weekNum) ?? []
  
  // Collect updates
  const newPicks: Record<number, number> = {}
  const newAutoFilled: number[] = []
  
  for (const game of weekGames) {
    if (!(game.id in picks.value)) {  // Only unpicked games (D-13)
      newPicks[game.id] = game.homeId  // Home team (PICK-05)
      newAutoFilled.push(game.id)
    }
  }
  
  // Single batch write (Pattern 3)
  picks.value = { ...picks.value, ...newPicks }
  markAutoFilled(newAutoFilled)  // Also track provenance
}

// Clear season requires confirmation (D-14)
async function clearSeasonWithConfirmation() {
  // Open modal (UModal in parent component, state managed via composable)
  const confirmed = await useConfirmClearSeason()
  
  if (confirmed) {
    // Batch: single write
    picks.value = {}
    // Also clear auto-filled
    const { autoFilled } = useAutoFilledGames()
    autoFilled.value = []
  }
}

// Progress derived from picks (Pattern 4)
const progressOverall = computed(() => {
  const total = games.value?.games.length ?? 0
  const picked = Object.keys(picks.value).length
  return { picked, total }
})
```
[ASSUMED — no official VueUse docs for this bulk-operation pattern; derived from standard batch-write best practices]

### Confirmation modal for Clear Season (D-14)

```vue
<!-- Parent: week/[week].vue -->
<script setup>
const showClearSeasonModal = ref(false)

async function handleClearSeason() {
  showClearSeasonModal.value = true
}

async function confirmClearSeason() {
  showClearSeasonModal.value = false
  const { picks } = usePicksStorage()
  const { autoFilled } = useAutoFilledGames()
  picks.value = {}
  autoFilled.value = []
}
</script>

<template>
  <!-- Clear Season button in header -->
  <UButton @click="handleClearSeason" variant="ghost" size="sm">Clear Season</UButton>

  <!-- Confirmation modal (D-14, UI-SPEC) -->
  <UModal v-model="showClearSeasonModal" title="Clear all season picks?">
    <template #default>
      <div class="p-4">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          This will clear all picks across the entire season. This action cannot be undone.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end">
        <UButton @click="showClearSeasonModal = false" variant="ghost">Cancel</UButton>
        <UButton @click="confirmClearSeason" color="red">Clear All</UButton>
      </div>
    </template>
  </UModal>
</template>
```
[CITED: https://ui.nuxt.com/docs/components/modal — medium confidence on UModal API]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Manual localStorage.setItem() + watch handlers per pick | VueUse `useStorage` with built-in watch + serializer | VueUse 10+ years established | Drop ~40 lines of boilerplate, get battle-tested cross-tab sync, serialization, error handling. Standard approach since Vue 3 adoption. |
| Storing picks as part of a larger "app state" object (Pinia store) | Separate `usePicksStorage`, `useAutoFilledGames` composables | Explicitly rejected in CLAUDE.md; Phase 4 confirms (smaller scope than Pinia) | Simpler composable model, smaller bundle, no store boilerplate until Phase 7 (scenarios). |
| Percentage progress bars | Text-based "{X}/{Y} picked" badges | Decided in CONTEXT.md D-11 | Honest UX — percentage bars falsely imply 99% is "almost done", but 1 pick of 800 is nothing; raw counts are clearer. |

**Deprecated/outdated:**
- Manual localStorage sync listeners — replaced by VueUse's native `listenToStorageChanges`
- Promises-based async storage libraries — replaced by simple Refs (all storage ops are sync on the main thread anyway)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VueUse `useStorage`'s `listenToStorageChanges: true` correctly syncs picks across browser tabs without additional custom code | Pattern 1 / Standard Stack | Medium risk — if the sync is not automatic, a user with two tabs open would see stale picks in one tab. Quick manual test: open two tabs, pick in one, check if the other reflects it. |
| A2 | `useStorage` serializer's `read` function is the correct place to catch JSON.parse errors and implement corruption recovery | Pattern 5 / Common Pitfalls | Low risk — this is the documented pattern in VueUse docs (https://vueuse.org/core/useStorage/); if the recovery needs to happen elsewhere, the fix is a small refactor. |
| A3 | Nuxt UI's `UModal` is the correct component for D-14's Clear Season confirmation, and no additional accessible confirmation pattern is needed | Pattern 3 / Code Examples | Low risk — UModal is the officially recommended Nuxt component; alternative would be a custom dialog, which is strictly more work. |
| A4 | Picking a game should mutate the picks object directly (`picks.value[gameId] = teamId`) rather than creating a new object or using an immutable library | Pitfall 1 / Pattern 1 | Very low risk — Vue 3 reactivity supports both mutations and replacements (`.value = newObj`); mutations are simpler and efficient for small objects. The key is batching, which works either way. |
| A5 | FCS opponent fallback color (#000000) is acceptable for the team-color accent even though it doesn't match team branding | Code Examples / UI-SPEC | Medium risk — if FCS fallback teams appear frequently and show up as black borders, it might stand out visually. Plan should validate actual teams.json coverage; if >5% FCS, might warrant a team-logo-specific color scheme. |

## Open Questions

1. **Exact WCAG contrast validation for team colors in light/dark mode**
   - What we know: UI-SPEC requires contrast validation; team colors come from `teams.json`; 3px left border is the accent placement
   - What's unclear: Should contrast validation happen at build time (pre-compute brightness adjustments for each team) or at runtime (apply CSS filters dynamically)? Should team colors failing contrast be filtered out, or should ALL colors be shifted to meet contrast (e.g., brightness() filter always applied)?
   - Recommendation: Plan should include a `validateTeamContrasts()` utility that runs during tests/build. If a team color fails 4.5:1 WCAG AA ratio against both light and dark backgrounds, flag it in the build output and apply `opacity-75` or `brightness(0.75)` dynamically via `{{ picked ? { opacity: 0.75 } : {} }}` style binding. This pushes the decision to plan/implementation rather than assuming all 138 team colors are WCAG-safe out of the box.

2. **Cross-tab synchronization timing and edge cases**
   - What we know: VueUse's `listenToStorageChanges: true` is enabled
   - What's unclear: If a user picks in Tab A, then immediately picks again in Tab A before Tab B has synced, does the sync still work? What if Tab A writes while Tab B is mid-read?
   - Recommendation: This is a known non-issue in browser storage (all writes are synchronous, there's no async race), but should be manually tested during Phase 4 UAT: open two tabs, rapidly pick in one while the other is visible, confirm the second tab updates within 100ms.

3. **Storage quota management for 600+ picks**
   - What we know: Picks object is `{ gameId: teamId }` for 888 games, plus autoFilled array of up to 888 ids. Est. JSON size ~20 KB per season.
   - What's unclear: Should there be a quota check or warning if a user somehow creates 100 seasons? Should the plan add a `try/catch QuotaExceededError` handler?
   - Recommendation: For v1 (Phase 4, single season), this is not a blocker — 20 KB × 1 season is negligible vs. the ~5 MB origin quota. Phase 7 (scenarios) should revisit this if users accumulate many named scenarios. For now, a simple try/catch is overkill; the plan should note it as a future consideration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `pnpm dev`/`pnpm build` | ✓ | 24.13.0 [VERIFIED: local node -v this session] | — |
| `@vueuse/core` (via @nuxt/ui) | `useStorage` in composables | ✓ | 14.4.0 [VERIFIED: pnpm-lock.yaml] | — |
| `@vueuse/nuxt` (to be installed) | Auto-import of useStorage | ✗ (to be installed) | 14.4.0 | None — must install this to enable Nuxt auto-import |
| `@nuxt/ui` (already installed) | `UCard`, `UBadge`, `UButton`, `UModal` | ✓ | 4.10.0 [VERIFIED: package.json:19] | — |
| localStorage (browser API) | All persistence | ✓ | Built-in to all browsers | Memory fallback (picks lost on refresh) — not desirable but app doesn't crash |

**Missing dependencies with no fallback:** `@vueuse/nuxt` must be installed (command: `pnpm add -D @vueuse/nuxt`).

**Missing dependencies with fallback:** None — all other deps already present.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:32, vitest.config.ts:5 environment 'node'] |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test -- tests/composables/*.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PICK-01/02 | Clicking a team toggles that team as pick; clicking again clears it | unit (composable + component) | `vitest run tests/composables/usePicksStorage.test.ts` | ❌ Wave 0 |
| PICK-03 | Picks persist in localStorage under season-namespaced key; reload preserves them | unit (composable with localStorage mock) | `vitest run tests/composables/usePicksStorage.test.ts::persist-reload` | ❌ Wave 0 |
| PICK-04 | Auto-filled game ids recorded separately in autoFilled key | unit (composable) | `vitest run tests/composables/useAutoFilledGames.test.ts` | ❌ Wave 0 |
| PICK-05 | fillWeekRemaining only fills unpicked games with home team | unit (pure function) | `vitest run tests/lib/bulk-picks.test.ts::fillRemaining` | ❌ Wave 0 |
| PICK-06 | Clear Season requires confirmation; Cancel aborts, Clear All executes | integration (modal + picks mutation) or manual UAT | manual: open modal, verify buttons work | N/A (manual + plan oversight) |
| PICK-07 | Progress badge shows correct picked/total count and updates on pick change | unit (computed) + manual UAT (visual) | unit: `vitest run tests/lib/progress.test.ts`, manual: pick a game, verify badge updates | ❌ Wave 0 (unit), manual (visual) |
| PICK-08 | Corrupt pick data caught by try/catch, reset to `{}`, preserved under _corrupt key | unit (composable with corrupted JSON mock) | `vitest run tests/composables/usePicksStorage.test.ts::corrupt-recovery` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/composables/*.test.ts` (fast, composable tests)
- **Per wave merge:** `pnpm test` (full suite) + manual UAT (open two tabs, pick in one, verify sync; click Clear Season, verify modal; pick a game and reload, verify persistence)
- **Phase gate:** Full suite green, manual UAT for UI interactions (click feedback, modal behavior, cross-tab sync), before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/composables/usePicksStorage.test.ts` — covers PICK-01, PICK-02, PICK-03, PICK-08 (toggle, persist, corrupt recovery)
- [ ] `tests/composables/useAutoFilledGames.test.ts` — covers PICK-04 (provenance tracking)
- [ ] `tests/lib/bulk-picks.test.ts` — covers PICK-05 (fillRemaining, clearWeek, etc. as pure functions)
- [ ] `tests/lib/progress.test.ts` — covers PICK-07 (progress counts)
- [ ] Test fixtures: corrupted JSON strings, edge cases (gameId at boundary, missing homeId, empty picks)
- [ ] Manual UAT plan: two-tab sync, modal cancellation/confirmation, visual feedback (checkmark/border appear/disappear), keyboard accessibility (Enter/Space on focused team row)

*(If no gaps: Wave 0 must add the above before implementation — existing test infra (vitest) is ready; new composables and utils just need test cases.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts in v1; picks are client-only. |
| V3 Session Management | no | App is stateless except localStorage — no sessions. |
| V4 Access Control | no | All data is public schedule + user's private picks (no authorization boundaries). |
| V5 Input Validation | yes | Picks can be manually edited in DevTools (localStorage is unencrypted, untrusted). Validate pick shape (gameId exists, teamId is in teams.json) before using; reject malformed data gracefully. Corruption recovery already covers JSON parse failures. |
| V6 Cryptography | no | No crypto; picks are not sensitive — they're a user's speculative forecasts, not credentials. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/corrupted localStorage entry (e.g., manually edited JSON in DevTools, or a buggy previous version of the app writes an invalid format) | Tampering / Denial of Service (client-side) | Pattern 5 corruption recovery: try/catch JSON.parse, fallback to empty `{}`, preserve original under `_corrupt` key. |
| User opens picks localStorage and manually edits `{ "12345": 999999 }` where 999999 is not a valid team id | Tampering (data integrity) | Validate picks on load: after parsing, check that all picks.value[gameId] exist in teamsById before using. Silently ignore invalid picks (or log warning). This is light defensive programming — not a major threat model (the user is attacking themselves), but good for robustness. |
| Picks leaked via browser history (share links will be an issue in Phase 8; localStorage is not) | Information Disclosure | Out of scope for Phase 4 — Phase 8 will address share-link security. Phase 4 picks are ephemeral and client-only. |
| Two browser tabs writing to localStorage simultaneously, causing one write to be lost (race condition) | Tampering (data loss) | Not a real risk — browser storage is synchronous and single-threaded per origin. Writes are atomic. Reads in one tab always see the most recent write from any tab (if listenToStorageChanges is working). |

## Sources

### Primary (HIGH confidence)
- VueUse documentation: https://vueuse.org/core/useStorage/ — full API reference, `listenToStorageChanges`, serializers, error handling (WebFetch this session)
- Nuxt UI 4 components: `@nuxt/ui@4.10.0` source files (node_modules read this session) — Modal, Button, Badge, Card slots/props
- Phase 2 RESEARCH.md (this repo, read this session) — established patterns (composables, GameCard, route handling)
- CONTEXT.md Phase 4 (this repo, read this session) — locked decisions D-01–D-18

### Secondary (MEDIUM confidence)
- Vue 3 Composition API + click-to-toggle patterns: https://medium.com/@davisaac8/design-patterns-and-best-practices-with-the-composition-api-in-vue-3-77ba95cb4d63 (WebSearch this session)
- localStorage persistence patterns: https://geeksforgeeks.org/how-to-make-localstorage-reactive-in-vue-js/ (WebSearch this session)
- Corruption recovery patterns: https://strapi.io/blog/how-to-use-localstorage-in-javascript (WebSearch this session)
- WCAG contrast for team colors: https://webaim.org/articles/contrast/, https://accessibility-test.org/blog/support/advanced-guides/color-contrast-in-wcag-2-2-testing-and-fixes-that-actually-work/ (WebSearch this session)
- Nuxt UI UModal: https://ui.nuxt.com/docs/components/modal (WebFetch this session)

### Tertiary (LOW confidence)
- None — all major claims are backed by official docs or verified code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and version-verified
- Architecture patterns: HIGH — built directly on Phase 2's established composable/component patterns; VueUse API verified against official docs
- Pitfalls: MEDIUM-HIGH — corruption recovery and batch-update pitfalls are well-documented in industry best practices; cross-tab sync is tested but not exhaustively verified against this exact project's setup
- WCAG contrast approach: MEDIUM — general best practices verified, but team-color specifics deferred to plan (no pre-validation tool exists yet)

**Research date:** 2026-08-15
**Valid until:** 2026-09-15 (30 days — stable stack, no major changes expected; re-verify if VueUse or Nuxt UI receive major-version bump)
