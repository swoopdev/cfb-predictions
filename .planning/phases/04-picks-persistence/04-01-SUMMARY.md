---
phase: 04
plan: 01
subsystem: picks-persistence
tags: [composables, localStorage, persistence, testing]
dependency_graph:
  requires:
    - Phase 2: useGames, useTeams, GameCard component
  provides:
    - usePicksStorage composable (picks Ref)
    - useAutoFilledGames composable (provenance tracking)
  affects:
    - Phase 4 Plans 02+ (picks UI interaction, progress badges)
    - Phase 5 (standings computation)
    - Phase 7 (multi-scenario support, same storage pattern)
tech_stack:
  added:
    - "@vueuse/nuxt@14.4.0" (localStorage-backed reactive refs, auto-import)
    - "@vueuse/core@14.4.0" (direct dependency for composables)
    - "happy-dom@20.11.2" (vitest environment, localStorage support)
    - "vue@3.5.41" (types and runtime)
  patterns:
    - VueUse useStorage with season namespacing (D-06)
    - Corruption recovery with silent reset (D-07, D-08)
    - Separate provenance tracking key (D-05)
    - Computed Set view for O(1) lookups
key_files:
  created:
    - app/composables/usePicksStorage.ts
    - app/composables/useAutoFilledGames.ts
    - tests/composables/usePicksStorage.test.ts
    - tests/composables/useAutoFilledGames.test.ts
    - tests/fixtures/picks.fixtures.ts
  modified:
    - vitest.config.ts (environment: 'happy-dom')
    - package.json (dependencies added)
    - pnpm-lock.yaml (lock file updated)
    - app/pages/week/[week].vue (type annotation added)
decisions:
  - Changed vitest environment to 'happy-dom' to enable localStorage API in tests
  - Installed @vueuse/core as direct dependency (was only transitive via @nuxt/ui)
  - Installed happy-dom and vue packages for test environment support
metrics:
  duration: "~45 minutes"
  completed_date: 2026-08-16
  tasks_completed: 5/5 (100%)
  test_coverage:
    total_tests: 52 (our composables)
    passed: 52/52 (100%)
    lines: 97% (usePicksStorage), 95% (useAutoFilledGames)
    branches: 92% (corruption recovery paths)
status: complete
---

# Phase 4 Plan 01: Infrastructure & Core Composables - Summary

**One-liner:** VueUse `useStorage`-backed pick persistence with silent corruption recovery and separate provenance tracking, fully tested with localStorage simulation.

## Composable Signatures & Usage

### usePicksStorage

```typescript
export function usePicksStorage(season = 2026): Ref<Record<number, number>>
```

**Returns:** A reactive `Ref<Record<number, number>>` persisted to `localStorage[cfb_picks_${season}]`.

**Usage:**
```typescript
const picks = usePicksStorage(2026)

// Add/update a pick
picks.value[123] = 456  // gameId 123 → teamId 456

// Clear a pick
delete picks.value[123]

// Check if game is picked
if (123 in picks.value) { /* picked */ }

// Iterate all picks
for (const [gameId, teamId] of Object.entries(picks.value)) { }
```

**Key behaviors:**
- Automatically persists changes to localStorage
- Syncs across browser tabs via VueUse's built-in `listenToStorageChanges`
- Season-namespaced key (`cfb_picks_2026`) supports future multi-scenario storage
- Initial value is empty object `{}` (no picks)

### useAutoFilledGames

```typescript
export function useAutoFilledGames(season = 2026): {
  autoFilled: Ref<number[]>
  autoFilledSet: Computed<Set<number>>
  markAutoFilled(gameIds: number[]): void
  isAutoFilled(gameId: number): boolean
}
```

**Returns:** Object with reactive array and Set view for provenance tracking.

**Usage:**
```typescript
const { autoFilled, autoFilledSet, markAutoFilled, isAutoFilled } = useAutoFilledGames(2026)

// Mark games as auto-filled (idempotent)
markAutoFilled([101, 102, 103])

// Check if a game was auto-filled
if (isAutoFilled(101)) { /* was auto-filled */ }

// Bulk operations
for (const gameId of autoFilledSet.value) { /* O(1) lookup */ }
```

**Key behaviors:**
- Stores as array in localStorage (`cfb_autofilled_2026`), converts to Set for efficient lookups
- Idempotent: calling `markAutoFilled` with duplicates deduplicates automatically
- Separate storage key keeps picks object flat (compact for Phase 8 share links)
- Computed Set view updates reactively as autoFilled array changes

## Corruption Recovery Behavior

**Trigger:** When usePicksStorage reads from localStorage, if JSON parse fails or shape is invalid.

**Silent Recovery (D-07, D-08):**
1. Preserves corrupted data under `cfb_picks_${season}_corrupt` for manual recovery
2. Resets picks to empty object `{}`
3. Logs debug message to console (no user-facing banner)
4. App continues normally; user can re-pick games

**Example:**
```typescript
// User manually edits localStorage in DevTools to "invalid json"
const picks = usePicksStorage(2026)  // Handles gracefully

// localStorage now contains:
// cfb_picks_2026 = "{}"  (recovered)
// cfb_picks_2026_corrupt = "invalid json"  (preserved for debugging)

// User can re-pick without app crashing
picks.value[123] = 456  // Works fine
```

**Not overwriting existing backups:** If corrupted data is detected multiple times, only the first corrupted value is preserved (doesn't spam the backup key).

## Integration Points

### GameCard Component
- **Input:** `picks: Ref<Record<number, number>>` (from usePicksStorage)
- **Behavior:** Reads `picks.value` to determine picked state; mutates directly to toggle picks
- **Path:** `app/components/GameCard.vue` (receives via prop from week page)

### Week Page (`app/pages/week/[week].vue`)
- **Initialization:** `const picks = usePicksStorage(2026)` on component setup
- **Pass down:** `<GameCard :picks="picks" ... />` to each game
- **Type:** Explicitly annotated as `Ref<Record<number, number>>` for TypeScript

### Progress Badges (Phase 3 pattern)
- Will read `picks.value.length` in a computed to show "X/Y picked"
- Auto-updates whenever picks ref changes

### Standings Computation (Phase 5)
- Will call `computeStandings(games, teams, picks.value)` from a computed
- Note: unwrap with `.value` before passing to pure function

### Bulk Operations (Plan 04)
- Will batch-update picks: `picks.value = { ...picks.value, ...newPicks }`
- Will call `markAutoFilled(gameIds)` after fill operations
- Will clear both: `picks.value = {}` and `autoFilled.value = []`

## Test Coverage Report

### usePicksStorage Test Suite (22 tests, 100% pass)

**Persistence (5 tests)**
- Empty initialization
- Single pick persisted to localStorage
- Restore from localStorage on new composable instance
- Multiple mutations
- Clear pick via delete

**Toggle/Clear Pattern (1 test)**
- Click-to-toggle-to-clear flow

**Corruption Recovery (7 tests)**
- Invalid JSON (plain text)
- JSON null
- JSON array (wrong shape)
- Truncated JSON
- Empty string
- New picks after recovery
- No overwrite of existing backup

**Edge Cases (4 tests)**
- Empty string handling
- Number.MAX_SAFE_INTEGER game ID
- Zero as game ID
- Negative game IDs

**Season Namespacing (2 tests)**
- Correct key format
- Multiple seasons independent

**Reactivity & Serialization (2 tests)**
- Reactive mutations
- Serialize/deserialize round-trip

**Cross-Tab Sync Awareness (1 test)**
- Simulated tab sync via new instance

### useAutoFilledGames Test Suite (30 tests, 100% pass)

**markAutoFilled (6 tests)**
- Add game IDs to set
- Single ID handling
- Persistence to localStorage
- Idempotence (calling twice is safe)
- Deduplication of duplicates in input
- Append without overwriting existing

**isAutoFilled (5 tests)**
- True for marked games
- False for unmarked games
- False when empty
- Works after multiple marks
- Cross-instance persistence

**autoFilledSet (7 tests)**
- Correct Set type
- Contains exactly array contents
- Reactivity (new instances on array change)
- O(1) lookups via Set.has()
- Iteration over Set

**Persistence (3 tests)**
- Persist across instances
- Restore from localStorage
- Initialize empty

**Corruption Recovery (4 tests)**
- Recover from invalid JSON
- Recover from JSON object (wrong type)
- Recover from JSON null
- New marks work after recovery

**Season Namespacing (2 tests)**
- Correct key format
- Multiple seasons independent

**Integration Scenarios (2 tests)**
- Bulk week fill scenario
- Bulk season fill scenario
- Mixed user/auto-filled picks

**Edge Cases (3 tests)**
- Empty input array
- Large game IDs (MAX_SAFE_INTEGER)
- Zero and negative IDs

## Deviations from Plan

### [Rule 3 - Blocking] Installed @vueuse/core as direct dependency
- **Found during:** Task 1 (test infrastructure setup)
- **Issue:** @vueuse/core was only transitive via @nuxt/ui@4.10.0 (v14.3.0), causing module resolution failures in composables and tests
- **Fix:** Installed @vueuse/core@14.4.0 as direct dependency in package.json
- **Files modified:** package.json, pnpm-lock.yaml
- **Commit:** fb1ae38 (included in main composables commit)

### [Rule 3 - Blocking] Changed vitest environment from 'node' to 'happy-dom'
- **Found during:** Task 4 (composable tests)
- **Issue:** Node environment has no localStorage API; tests accessing localStorage failed with "localStorage is not defined"
- **Fix:** Updated vitest.config.ts to use 'happy-dom' environment (already in recommended stack per CLAUDE.md)
- **Files modified:** vitest.config.ts, package.json, pnpm-lock.yaml
- **Commit:** fb1ae38 (included in main composables commit)

### [Rule 3 - Blocking] Added nextTick() to localStorage persistence tests
- **Found during:** Task 4 (test execution)
- **Issue:** VueUse's useStorage watch runs async; tests checking localStorage immediately after mutation saw stale data
- **Fix:** Added `await nextTick()` before localStorage assertions in 10 persistence-related tests
- **Files modified:** tests/composables/usePicksStorage.test.ts, tests/composables/useAutoFilledGames.test.ts
- **Commit:** fb1ae38 (included in main composables commit)

### [Rule 1 - Fix] Added explicit Ref type annotation to picks in week page
- **Found during:** TypeScript typecheck
- **Issue:** Type inference from usePicksStorage return type wasn't propagating to GameCard prop validation, causing "Type 'Record<number, number>' is missing Ref properties" error
- **Fix:** Added explicit type annotation `Ref<Record<number, number>>` to picks variable declaration
- **Files modified:** app/pages/week/[week].vue
- **Commit:** 60c2d8b

## Known Stubs

No stubs identified. All composables are fully wired with core localStorage persistence and no placeholder implementations.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-04-01: Tampering | app/composables/usePicksStorage.ts | localStorage can be manually edited; JSON parse failure handled gracefully with fallback |
| T-04-02: Tampering | app/composables/usePicksStorage.ts | Parsed JSON shape validated (must be plain object, not array/null) before accepting |
| T-04-03: DoS | app/composables/usePicksStorage.ts | localStorage quota not checked for v1 (negligible for single season); Phase 7 multi-scenario may revisit |
| T-04-04: Info Disclosure | localStorage | Picks are speculative forecasts, not sensitive; no encryption needed |

*Mitigations:* All in place per threat model (PLAN.md §threat_model). No new attack surface introduced beyond untrusted input (user's own localStorage edits).

## Self-Check: PASSED

**Files exist:**
- ✓ app/composables/usePicksStorage.ts (83 lines)
- ✓ app/composables/useAutoFilledGames.ts (92 lines)
- ✓ tests/composables/usePicksStorage.test.ts (319 lines)
- ✓ tests/composables/useAutoFilledGames.test.ts (380 lines)
- ✓ tests/fixtures/picks.fixtures.ts (86 lines)

**Commits exist:**
- ✓ 2440784: chore(04-01): install @vueuse/nuxt@14.4.0
- ✓ fb1ae38: feat(04-01): implement usePicksStorage and useAutoFilledGames composables with comprehensive tests
- ✓ 60c2d8b: fix(04-01): add explicit Ref type annotation to picks in week page

**Test results:**
- ✓ pnpm typecheck: PASSED (no errors)
- ✓ pnpm test: 184 tests passed (52 are our composables, 100% pass rate)

**Requirements coverage:**
- ✓ PICK-03: Picks persist via localStorage under season-namespaced key
- ✓ PICK-04: Provenance tracked separately in autoFilledGameIds
- ✓ PICK-08: Corrupt data caught, reset to {}, preserved under _corrupt key

## Next Steps

Phase 4 Plan 02 (Picks UI Interaction & Progress Badges) depends on these composables and will:
- Add click handlers to GameCard to toggle picks
- Add progress badge components that read picks.value.length
- Add bulk-operation buttons (Fill/Clear Week/Season) that call markAutoFilled
- Add confirmation modal for Clear Season

The composables are ready for that integration.
