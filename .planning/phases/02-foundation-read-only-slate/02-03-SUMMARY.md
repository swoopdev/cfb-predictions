---
phase: 02-foundation-read-only-slate
plan: 03
subsystem: ui
tags: [nuxt, nuxt-ui, vue-router, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-foundation-read-only-slate (plan 01)
    provides: "app/pages/week/[week].vue's rawWeekGames/teamsById computeds and groupByConference render pipeline; app/utils/schedule.ts as the extension point"
  - phase: 02-foundation-read-only-slate (plan 02)
    provides: "ssr:false + nitro.prerender.routes static build config this plan's filters build query-string state on top of"
provides:
  - "app/utils/schedule.ts: filterGames, sanitizeConfParam, sanitizeTeamParam, buildConfQuery, buildTeamQuery — pure, unit-tested filter/sanitize/query-builder functions"
  - "app/components/ConferenceFilter.vue — USelect over D-01's fixed 12-item conference list, exports KNOWN_CONFERENCES"
  - "app/components/TeamFilter.vue — UInputMenu searchable combobox over all teams (D-02)"
  - "week/[week].vue conf/team query-param filtering, mutually exclusive (D-03), with distinct week-empty vs filter-empty states"
affects: [02-04-week-nav, phase-04-picks-persistence (shareable URL pattern)]

# Actuals (#2632)
actuals:
  tokens: 4000
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Writable computed wrapping a sanitize-from-route.query getter and a router.push-via-buildXQuery setter — lets filter components bind with plain v-model while the URL stays the single source of truth"
    - "Non-<script setup> module-scope <script lang=\"ts\"> block inside an SFC to export named constants (KNOWN_CONFERENCES) alongside <script setup>'s component logic — <script setup> alone cannot contain non-type ES module exports"
    - "Security Domain V5 fail-safe-to-unfiltered: sanitize functions return undefined (not throw) for any value outside a known-good allowlist, verified by dedicated unit tests"

key-files:
  created:
    - app/components/ConferenceFilter.vue
    - app/components/TeamFilter.vue
    - tests/lib/filter-games.test.ts
    - tests/lib/sanitize-params.test.ts
    - tests/lib/filter-query.test.ts
  modified:
    - app/utils/schedule.ts
    - app/pages/week/[week].vue

key-decisions:
  - "Implemented Task 3's buildConfQuery/buildTeamQuery (pure functions) before Task 2's component wiring, in dependency order, rather than stubbing them per the plan's fallback instruction — both tasks are in this one plan and stubbing would have been throwaway work"
  - "conf/teamId page-level computeds are writable (get: sanitize from route.query, set: call setConf/setTeam) so ConferenceFilter/TeamFilter can bind with plain v-model while setConf/setTeam still exist as named functions that visibly call buildConfQuery/buildTeamQuery (satisfies Task 3's source-assertion acceptance criteria)"
  - "KNOWN_CONFERENCES and the full CONFERENCE_ITEMS ('All' + 11 conferences) live in ConferenceFilter.vue's plain <script> block (not <script setup>, which cannot hold non-type exports) — CONFERENCE_ITEMS is the literal source of truth; KNOWN_CONFERENCES is CONFERENCE_ITEMS.slice(1), avoiding duplicating the 11-conference list"

patterns-established:
  - "Filter-empty vs week-empty state is computed from two separate lengths (rawWeekGames.length vs filteredGames.length), not one 'is grid empty' boolean — required by RESEARCH.md Pitfall 4 and this plan's must_haves"

requirements-completed: [SLATE-02, SLATE-03, SLATE-05]

coverage:
  - id: D1
    description: "filterGames narrows by team (home OR away) or conference (home OR away, so cross-conference games appear under both conferences), with team winning when both are set defensively"
    requirement: "SLATE-02"
    verification:
      - kind: unit
        ref: "tests/lib/filter-games.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "sanitizeConfParam/sanitizeTeamParam reject any URL query value not in the known-good allowlist, falling back to unfiltered (undefined) rather than crashing (Security Domain V5, T-02-06/T-02-07)"
    verification:
      - kind: unit
        ref: "tests/lib/sanitize-params.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildConfQuery/buildTeamQuery enforce D-03 mutual exclusivity (each nulls the other's query key) while preserving unrelated query keys (Pitfall 6)"
    verification:
      - kind: unit
        ref: "tests/lib/filter-query.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConferenceFilter.vue (USelect, D-01's fixed literal ordering) and TeamFilter.vue (UInputMenu combobox, D-02, 'No teams found' empty slot) render side-by-side above the game grid in week/[week].vue, wired to conf/teamId via v-model, with setConf/setTeam routing through buildConfQuery/buildTeamQuery; the week-empty vs filter-empty states render distinct Copywriting-Contract-exact copy"
    requirement: "SLATE-03"
    verification:
      - kind: unit
        ref: "pnpm typecheck (zero errors); grep-verified both filterGames(...) and groupByConference(...) call sites present in week/[week].vue"
        status: pass
      - kind: manual_procedural
        ref: "pnpm build: all 16 routes prerender clean; pnpm dev smoke test: curl 200 on /week/1, /week/1?conf=SEC, /week/1?conf=%3Cscript%3E, /week/1?team=99999999 with no dev-server errors logged"
        status: pass
    human_judgment: true
    rationale: "Full visual confirmation that the ConferenceFilter dropdown and TeamFilter combobox render correctly, that selecting one visibly clears the other, and that the URL round-trips through browser back/forward requires a human in a real browser — chromium-cli was not available in this execution environment, so this was verified via typecheck/build/curl smoke test rather than a screenshot."
  - id: D5
    description: "Filter selections (week, conf, team) are reflected in and restorable from the URL query string, each mutually exclusive, malformed values falling back gracefully — completing SLATE-05 (started in 02-01, build-config half in 02-02)"
    requirement: "SLATE-05"
    verification:
      - kind: unit
        ref: "tests/lib/filter-query.test.ts (buildConfQuery/buildTeamQuery mutual exclusivity + key preservation)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 3: Conference and Team Filters Summary

**Pure, unit-tested `filterGames`/`sanitizeConfParam`/`sanitizeTeamParam`/`buildConfQuery`/`buildTeamQuery` in `app/utils/schedule.ts`, plus `ConferenceFilter.vue` (USelect) and `TeamFilter.vue` (UInputMenu combobox) wired into `/week/[week].vue` with strict mutual exclusivity and distinct empty-state copy.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3
- **Files modified:** 7 (2 created components, 3 created tests, 2 modified)

## Accomplishments
- `filterGames(games, { conf, team }, teamsById)` matches either side of a game (home OR away) for both `team` and `conf` filters — a cross-conference/G5 fixture correctly appears under both conferences' filtered views, and `team` wins defensively when both filters are somehow set
- `sanitizeConfParam`/`sanitizeTeamParam` implement Security Domain V5's mitigation for T-02-06/T-02-07: any `?conf=`/`?team=` value not in the known-good allowlist (11 real conferences / loaded team ids, guarded by `Number.isSafeInteger`) falls back to `undefined` (unfiltered) instead of crashing or rendering a broken partial state
- `buildConfQuery`/`buildTeamQuery` enforce D-03's mutual exclusivity (selecting one always nulls the other in the returned query object) while re-spreading every other current query key, closing RESEARCH.md Pitfall 6 (Vue Router's `router.push({ query })` replaces rather than merges)
- `ConferenceFilter.vue` (USelect, D-01's exact 12-item literal order: All, SEC, Big Ten, Big 12, ACC, then 7 alphabetical) and `TeamFilter.vue` (UInputMenu combobox, D-02, `value-key="id"`/`label-key="school"`, "No teams found" empty slot) render side-by-side above the game grid in `week/[week].vue`
- `week/[week].vue` now distinguishes "week has zero games" (e.g. week 14) from "filter narrowed an otherwise non-empty week to zero games" (e.g. a team's bye week) with the exact distinct Copywriting Contract heading/body for each (RESEARCH.md Pitfall 4)

## Task Commits

Each task was committed atomically:

1. **Task 1: filterGames + query-param sanitization** — `d5d2ae1` (test, RED) → `f2b41b3` (feat, GREEN) — no REFACTOR needed
2. **Task 3 (pure functions, implemented before Task 2 per dependency order): buildConfQuery/buildTeamQuery** — `28eab72` (test, RED) → `46b9c4e` (feat, GREEN) — no REFACTOR needed
3. **Task 2 + Task 3 (page wiring): ConferenceFilter/TeamFilter components, wired into week page with setConf/setTeam** — `d6e1172` (feat)

## Files Created/Modified
- `app/utils/schedule.ts` - Added `filterGames`, `sanitizeConfParam`, `sanitizeTeamParam`, `buildConfQuery`, `buildTeamQuery`
- `app/components/ConferenceFilter.vue` - USelect over D-01's fixed conference list, exports `KNOWN_CONFERENCES`/`CONFERENCE_ITEMS`
- `app/components/TeamFilter.vue` - UInputMenu searchable combobox (D-02)
- `app/pages/week/[week].vue` - `conf`/`teamId` writable computeds (sanitize on get, `setConf`/`setTeam` on set), `filteredGames`/`emptyVariant`/`filterLabel` computeds, filter row + distinct empty-state branches in the template
- `tests/lib/filter-games.test.ts`, `tests/lib/sanitize-params.test.ts`, `tests/lib/filter-query.test.ts` - pure-function unit tests

## Decisions Made
- Implemented Task 3's `buildConfQuery`/`buildTeamQuery` before Task 2's component wiring (not stubbed) since both tasks land in this one plan and the dependency only runs one direction — avoided writing throwaway stub code the plan explicitly offered as a fallback.
- Made `conf`/`teamId` writable `computed`s in `week/[week].vue` (get: sanitize from `route.query`; set: call `setConf`/`setTeam`) so the filter components can bind with plain `v-model`, while `setConf`/`setTeam` still exist as named functions calling `buildConfQuery`/`buildTeamQuery` directly — satisfies Task 3's source-assertion acceptance criteria without hand-rolling a partial query object anywhere.
- `KNOWN_CONFERENCES`/`CONFERENCE_ITEMS` live in `ConferenceFilter.vue`'s plain `<script lang="ts">` block, not `<script setup>` — Vue's SFC compiler rejects non-type named exports from `<script setup>` (confirmed against the installed `@vue/compiler-sfc@3.5.40`), so a second, non-setup `<script>` block is the correct place for a named export consumed by `week/[week].vue`.
- Implemented the week-empty vs filter-empty empty-state distinction (must_haves truth, RESEARCH.md Pitfall 4) even though no task's `<action>` spelled out the exact computed logic — required to satisfy the plan's stated `must_haves.truths`.

## Deviations from Plan

None — plan executed exactly as written; the only adjustments were sequencing (Task 3's pure functions before Task 2's wiring, per the plan's own stated fallback) and implementation choices (writable computeds, non-setup `<script>` export) within the plan's specified contracts, not scope changes.

## Issues Encountered

`chromium-cli` was not available in this execution environment, so the plan's manual browser verification step ("selecting a conference clears any active team filter... pasting `?conf=SEC`/`?team=<validId>` directly into the URL bar") was verified via `pnpm build` (all 16 routes prerender cleanly), `pnpm typecheck`/`pnpm lint` (zero errors), the full `vitest` suite (61/61 passing), and a `pnpm dev` + `curl` smoke test confirming 200 responses and no server-log errors for `/week/1`, `/week/1?conf=SEC`, `/week/1?conf=%3Cscript%3E`, and `/week/1?team=99999999` — not a screenshot-verified browser session.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness
- `filterGames`/`sanitizeConfParam`/`sanitizeTeamParam`/`buildConfQuery`/`buildTeamQuery` are exported from `app/utils/schedule.ts` for 02-04 (week navigation) to extend with `buildWeekQuery`/`WEEKS`/`isWeekBoundary` per 02-01's Artifacts note — the same "re-spread `route.query`, never an inline partial object" pattern applies to week-nav's Prev/Next handlers (RESEARCH.md Pitfall 6 is not week-nav-specific).
- SLATE-05 (linkable/shareable URLs) is now functionally complete for conf/team filters; 02-04 adds the week segment's Prev/Next navigation on top of the same URL-as-source-of-truth pattern.
- A future browser-automation pass (chromium-cli or equivalent) would strengthen this plan's UAT beyond the curl/build/typecheck evidence gathered here — flagged for whoever runs `/gsd-verify-work` on this phase.

---
*Phase: 02-foundation-read-only-slate*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 5 task commits (`d5d2ae1`, `f2b41b3`, `28eab72`, `46b9c4e`, `d6e1172`) verified present in `git log`.
