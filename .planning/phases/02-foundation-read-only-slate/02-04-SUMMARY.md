---
phase: 02-foundation-read-only-slate
plan: 04
subsystem: ui
tags: [nuxt, nuxt-ui, vue-router, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-foundation-read-only-slate (plan 01)
    provides: "app/pages/week/[week].vue's rawWeekGames/teamsById computeds and groupByConference render pipeline; app/utils/schedule.ts as the extension point"
  - phase: 02-foundation-read-only-slate (plan 03)
    provides: "conf/teamId writable computeds, filterGames/filteredGames, buildConfQuery/buildTeamQuery pattern this plan's buildWeekQuery follows"
provides:
  - "app/components/WeekNav.vue — Prev/Next buttons + week-picker USelect, boundary-disabled at weeks 1/15, filter-preserving navigation via buildWeekQuery"
  - "app/utils/schedule.ts: WEEKS, isWeekBoundary, buildWeekQuery, determineEmptyStateVariant — pure, unit-tested"
  - "week-empty vs. filter-empty empty-state branching in week/[week].vue, wired through determineEmptyStateVariant"
  - "Signed-off human UAT of the complete Phase 2 read-only slate, including the FOUND-03 zero-network-requests check"
affects: [phase-03-tiebreaker-engine, phase-04-picks-persistence]

# Actuals (#2632)
actuals:
  tokens: 4542
  tasks: 3
  commits: 12

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WeekNav.vue is a dumb control (receives week, emits navigate) — the page owns router.push via buildWeekQuery, matching ConferenceFilter/TeamFilter's page-owns-navigation pattern from 02-03"
    - "week/[week].vue's emptyVariant computed delegates to determineEmptyStateVariant(schedule.ts) instead of duplicating week-empty/filter-empty branching inline"
    - "Nuxt UI USelect items as {label, value} objects with explicit value-key/label-key (not raw primitives) — required for both the closed trigger and open rows to render visible text; raw-number/raw-string items only render a checkmark on the selected row"

key-files:
  created:
    - app/components/WeekNav.vue
    - tests/lib/week-nav.test.ts
    - tests/lib/empty-state.test.ts
  modified:
    - app/utils/schedule.ts
    - app/pages/week/[week].vue
    - app/components/ConferenceFilter.vue
    - app/app.vue
    - nuxt.config.ts

key-decisions:
  - "Reversed D-15 during UAT: week 14 (zero games) is now completely removed from Prev/Next/picker navigation and the prerender route list, rather than kept in-band as a selectable empty-state week. Explicit user decision made live during the Task 3 checkpoint (round 1) — the empty week added a confusing dead stop to browsing with no compensating value. determineEmptyStateVariant('week-empty') and its distinct copy remain in the codebase as dead-but-tested code (an out-of-range/malformed week would still hit it), so T-02-09's mitigation (out-of-range week renders harmlessly rather than crashing) still holds."
  - "Converted week-picker and conference-filter dropdown items from raw primitives to {label, value} objects with explicit value-key/label-key after UAT round 1 surfaced that Nuxt UI's USelect renders only a checkmark (no visible label) for raw-primitive items"
  - "Removed the stock Nuxt UI starter-template UHeader/UFooter/USeparator chrome from app.vue during UAT round 1 — leftover scaffolding (AppLogo, TemplateMenu, GitHub links to the starter template) was never part of this app's UI-SPEC and was confusing during verification"
  - "UAT round 2 (after round 1 fixes were re-verified) surfaced two more cosmetic issues, both fixed in the same checkpoint pass: the conference filter's no-op sentinel read as a bare 'All' instead of 'All conferences', and the week-picker dropdown clipped two-digit week labels / overlapped the selected row's checkmark when a single-digit week was active — both traced to the same USelect content-panel-width-tracks-trigger-width behavior"

patterns-established:
  - "Human-verify checkpoints on this project can and do surface real UI defects (not just sign-off) — cosmetic dropdown/label bugs invisible to vitest/typecheck/lint/build were only caught by a human actually opening the dropdowns in a browser"

requirements-completed: [SLATE-01, SLATE-05, FOUND-03]

coverage:
  - id: D1
    description: "WeekNav.vue's Prev/Next buttons page through weeks 1-15 with correct boundary disabling (isWeekBoundary) and preserve the active conf/team filter across a week change via buildWeekQuery (Pitfall 6)"
    requirement: "SLATE-01"
    verification:
      - kind: unit
        ref: "tests/lib/week-nav.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "determineEmptyStateVariant distinguishes an inherently empty week from a filter-narrowed-to-empty week, rendering distinct Copywriting-Contract-exact copy for each"
    verification:
      - kind: unit
        ref: "tests/lib/empty-state.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full read-only slate works end to end in a production build: week browsing (with week 14 removed per the UAT-driven D-15 reversal), boundary nav, conference/team filters, empty states, deep-linking to a direct URL in a fresh tab, browser back/forward, and exactly two /data/2026/*.json network requests on initial load with zero further requests while paging/filtering (FOUND-03)"
    requirement: "FOUND-03"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint:human-verify — full 8-point UAT script (build+preview, week paging/boundaries, picker, filters, bye-week filter-empty, Network-tab request count, fresh-tab deep link, back/forward), two rounds of fixes applied and re-verified, user responded 'approved'"
        status: pass
    human_judgment: true
    rationale: "Real browser Network-tab request counting, fresh-tab (non-client-side-navigation) deep-link behavior, and native back/forward restoration cannot be observed by any automated test in this repo's current tooling (component-mount/E2E testing was explicitly deferred per RESEARCH.md's Wave 0 Gaps decision) — this is the exact class of check the human-verify checkpoint exists for."

duration: 45min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 4: Week Navigation and Closing UAT Summary

**Prev/Next/picker week navigation with boundary disabling, distinct week-empty/filter-empty states, and a human-verified full read-only slate — including a live UAT decision to reverse D-15 and drop the empty week 14 from navigation entirely.**

## Performance

- **Duration:** 45 min
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- `WeekNav.vue`: icon-only Previous/Next `UButton`s (44×44px tap target, explicit `aria-label`s) plus a week-picker `USelect`, wired into `week/[week].vue` via `buildWeekQuery(route.query, targetWeek)` — filter query params (`conf`/`team`) survive unchanged across a week change
- `isWeekBoundary`/`WEEKS`/`buildWeekQuery` added to `app/utils/schedule.ts`, each unit-tested; Prev disabled at week 1, Next disabled at week 15
- `determineEmptyStateVariant(rawWeekGames, filteredGames)` distinguishes "the week itself has zero games" from "a filter narrowed an otherwise non-empty week to zero," rendering the exact distinct Copywriting Contract copy for each — wired through `week/[week].vue`'s `emptyVariant` computed instead of inline branching
- Ran the full Task 3 human-verify checkpoint: the complete Phase 2 read-only slate (data layer, week browsing, conference/team filters, empty states, static build) was verified end to end in a real production build (`pnpm build && pnpm preview`), across all 8 UAT points including the FOUND-03 zero-additional-network-requests check, deep-linking to a fresh browser tab, and native back/forward — user responded "approved"
- Two rounds of UAT-driven fixes landed and were re-verified before approval: round 1 fixed conference-dropdown name truncation, invisible week-picker labels (raw-primitive `USelect` items), leftover Nuxt UI starter-template header/footer chrome, and — per an explicit live user decision — reversed D-15 by removing week 14 from Prev/Next/picker navigation and the prerender route list entirely; round 2 fixed the conference filter's bare "All" sentinel label (now "All conferences") and a week-picker width/checkmark-overlap glitch on two-digit weeks

## Task Commits

Each task was committed atomically:

1. **Task 1: WeekNav component** — `b45789f` (test, RED) → `40653af` (feat, GREEN) — no REFACTOR needed
2. **Task 2: Distinct week-empty vs. filter-empty states** — `ed8e199` (test, RED) → `380ea2f` (feat, GREEN) — no REFACTOR needed
3. **Task 3: Full read-only slate UAT (checkpoint:human-verify)** — `7d2b1e8` (docs, checkpoint progress) → UAT round 1 fixes `2303ef2`, `240bfa7`, `2c337da`, `4fd4875` → UAT round 2 fixes `7c3cd2a`, `40f1798` → approved

**Plan metadata:** (this commit) `docs(02-04): complete week navigation and closing UAT plan`

## Files Created/Modified
- `app/components/WeekNav.vue` - Prev/Next buttons + week-picker `USelect`, boundary-disabled, filter-preserving
- `app/utils/schedule.ts` - Added `WEEKS`, `isWeekBoundary`, `buildWeekQuery`, `determineEmptyStateVariant`
- `app/pages/week/[week].vue` - Wired `WeekNav`, branched template on `determineEmptyStateVariant`
- `app/components/ConferenceFilter.vue` - Widened dropdown, converted items to `{label, value}` objects, renamed "All" sentinel label to "All conferences"
- `app/app.vue` - Removed stock Nuxt UI starter `UHeader`/`UFooter`/`USeparator` chrome
- `nuxt.config.ts` - Removed `/week/14` from `nitro.prerender.routes` (D-15 reversal)
- `tests/lib/week-nav.test.ts` - `WEEKS`/`isWeekBoundary`/`buildWeekQuery` unit tests
- `tests/lib/empty-state.test.ts` - `determineEmptyStateVariant` unit tests

## Decisions Made
- **D-15 reversed live during UAT** (round 1): week 14 (the dataset's one genuinely empty week) is now fully removed from Prev/Next/picker navigation and from `nuxt.config.ts`'s prerender route list, rather than kept in-band as a selectable empty-state stop. This was an explicit user decision made during the Task 3 checkpoint, not an auto-fix — the empty week added a confusing dead stop to browsing with no offsetting value once actually experienced in the browser. `determineEmptyStateVariant`'s `'week-empty'` branch and its distinct copy remain in the codebase (unit-tested, dead-but-reachable for any out-of-range week like `/week/0` or `/week/16`), so threat mitigation T-02-09 (out-of-range week renders harmlessly instead of crashing) is unaffected.
- Converted `USelect` items in both `WeekNav` and `ConferenceFilter` from raw primitives to `{label, value}` objects with explicit `value-key`/`label-key` — Nuxt UI's `USelect` only renders a checkmark (no visible text) for raw-primitive items, which was invisible until a human opened the dropdown in a real browser.
- Removed the leftover Nuxt UI starter-template header/footer from `app.vue` (AppLogo, TemplateMenu, color-mode toggle, GitHub links to the starter repo, "Built with Nuxt UI" footer) — never part of this app's UI-SPEC, surfaced as visual noise during UAT.

## Deviations from Plan

### Auto-fixed / User-directed Issues (surfaced during Task 3 checkpoint UAT)

**1. [Rule 4 - Architectural, explicit user decision] Reversed D-15 — removed week 14 from navigation**
- **Found during:** Task 3, UAT round 1
- **Issue:** Plan's `must_haves` (per D-15) specified week 14 as a selectable week-picker option rendering the week-empty state. Live user feedback during checkpoint verification requested removing it from navigation entirely instead.
- **Fix:** Removed `14` from the week-picker's reachable set via Prev/Next sequencing and picker items, and removed `/week/14` from `nuxt.config.ts`'s prerender routes.
- **Files modified:** `nuxt.config.ts` (and the WeekNav/page wiring that determines reachable weeks)
- **Verification:** Re-ran UAT round 2 confirming week 14 is unreachable via any nav path; `determineEmptyStateVariant`'s tests still pass (function retained for out-of-range-URL safety, per T-02-09).
- **Committed in:** `2c337da`

**2. [Rule 1 - Bug] USelect items rendered no visible label**
- **Found during:** Task 3, UAT round 1
- **Issue:** Week picker and (separately) conference filter passed raw primitives as `USelect` items; only the selected row's checkmark rendered, no visible "Week N" / conference name text.
- **Fix:** Converted both to `{label, value}` object items with explicit `value-key`/`label-key`.
- **Files modified:** `app/components/WeekNav.vue`, `app/components/ConferenceFilter.vue`
- **Committed in:** `240bfa7`, `2303ef2`

**3. [Rule 2 - Missing critical / scope cleanup] Removed starter-template chrome**
- **Found during:** Task 3, UAT round 1
- **Issue:** `app.vue` still rendered the stock Nuxt UI starter's header/footer (unrelated branding, GitHub links to the template repo) — not part of this app's design.
- **Fix:** Removed `UHeader`/`UFooter`/`USeparator` from `app.vue`.
- **Files modified:** `app/app.vue`
- **Committed in:** `4fd4875`

**4. [Rule 1 - Bug] Conference filter "All" sentinel label unclear**
- **Found during:** Task 3, UAT round 2
- **Issue:** The no-filter sentinel displayed as a bare "All" in the dropdown, ambiguous next to conference names.
- **Fix:** Label changed to "All conferences" while the underlying sentinel value (`'All'`) is unchanged.
- **Files modified:** `app/components/ConferenceFilter.vue`
- **Committed in:** `7c3cd2a`

**5. [Rule 1 - Bug] Week-picker width/checkmark overlap on two-digit weeks**
- **Found during:** Task 3, UAT round 2
- **Issue:** With a single-digit week selected, the open dropdown's content panel width tracked the (narrower) trigger, clipping two-digit week labels ("Week 11"/"Week 15") and overlapping the checkmark with the label text.
- **Fix:** Fixed content-panel width independent of trigger width.
- **Files modified:** `app/components/WeekNav.vue`
- **Committed in:** `40f1798`

---

**Total deviations:** 5 (1 explicit user-directed architectural reversal, 4 auto-fixed UI bugs)
**Impact on plan:** All fixes were necessary for the checkpoint to pass a real-browser UAT; none were scope creep — all were either explicit user direction (D-15) or bugs in the plan's own deliverables (dropdown rendering, starter-template leftovers) invisible to `pnpm test`/`typecheck`/`lint`/`build`.

## Issues Encountered
None beyond the UAT-surfaced items documented above as deviations — all automated checks (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`) were passing at every fix commit.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness
- Phase 2's full read-only slate (data layer, week browsing, filters, empty states, static build) is human-verified end to end in a production build. `useTeams`/`useGames`/`filterGames`/`WEEKS`/`buildWeekQuery`/`determineEmptyStateVariant` are all stable, tested primitives future phases (Picks & Persistence, Standings) can build on top of without re-verifying the browsing layer.
- `determineEmptyStateVariant`'s `'week-empty'` branch is currently unreachable via normal navigation (week 14 removed from all nav paths) but remains live code for malformed/out-of-range URLs — worth noting for anyone auditing dead code later, since it is intentional, not leftover.
- Phase-level verification, code review, and marking Phase 2 complete in ROADMAP.md's success-criteria checklist are explicitly out of this plan's scope — left for the orchestrator's next step.

---
*Phase: 02-foundation-read-only-slate*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 8 created/modified files verified present on disk; all task/UAT commits (`b45789f`, `40653af`, `ed8e199`, `380ea2f`, `7d2b1e8`, `2303ef2`, `240bfa7`, `2c337da`, `4fd4875`, `7c3cd2a`, `40f1798`) verified present in `git log`.
