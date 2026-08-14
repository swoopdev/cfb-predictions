---
phase: 2
slug: foundation-read-only-slate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 [VERIFIED: package.json:32, vitest.config.ts] |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['tests/**/*.test.ts']`, `passWithNoTests: true`. Already covers every new `tests/lib/*.test.ts` / `tests/composables/*.test.ts` file this phase adds — no config change needed. |
| **Quick run command** | `vitest run <test-file>` (e.g. `vitest run tests/lib/filter-games.test.ts`) |
| **Full suite command** | `pnpm test` (= `vitest run`) |
| **Estimated runtime** | ~5-10s for the full pure-function vitest suite; `pnpm build` (used as the automated verify for two tasks) adds ~20-40s for a 15-route static Nuxt generate |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command (see Per-Task Verification Map) — mostly single-file `vitest run`, two tasks use `pnpm build`/`pnpm typecheck`
- **After every plan wave:** Run `pnpm test` (full vitest suite) + `pnpm build` (static-output check, per Pitfall 1/Open Question 1)
- **Before `/gsd-verify-work`:** Full suite must be green, `pnpm build` must succeed and produce all 15 week routes under `.output/public/week/`
- **Max feedback latency:** 60 seconds (accommodates the slowest per-task automated command, `pnpm build`)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FOUND-02, SLATE-04, SLATE-05 | T-02-01 | `Number(route.params.week)` coercion prevents a string/number mismatch from silently matching zero games instead of crashing | unit (composable) | `vitest run tests/composables/fetch-schedule.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-01-02 | 01 | 1 | SLATE-04 | — | Grouping keys off `homeId` only (always resolvable, 0 missing) — never the possibly-unresolvable `awayId`, so no crash on an FCS opponent | unit | `vitest run tests/lib/group-games.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-01-03 | 01 | 1 | FOUND-02 | T-02-02 | `determineLoadState` renders a controlled full-page error state instead of an unhandled promise rejection / `undefined.filter()` crash | unit | `vitest run tests/lib/load-state.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-02-01 | 02 | 2 | FOUND-01 | T-02-05 (accept) | No `server/` dir, Nitro API route, or runtime env-var read added anywhere — structurally enforced by the diff itself | build | `pnpm build` | N/A (config-only change, `nuxt.config.ts`) | ⬜ pending |
| 02-02-02 | 02 | 2 | FOUND-03, SLATE-05 | T-02-04 | Explicit `ls .output/public/week` build-output check catches a missing-prerender-route regression before deploy; `public/_redirects` is the second-layer backstop for anything the prerender step misses | build + manual-check | `pnpm build && ls .output/public/week` | ❌ (`public/_redirects` authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-03-01 | 03 | 2 | SLATE-02, SLATE-03 | T-02-06, T-02-07 | `sanitizeConfParam`/`sanitizeTeamParam` reject any `?conf=`/`?team=` value not present in the known conference list / loaded team-id set (with an `Number.isSafeInteger` guard before any lookup) and fall back to unfiltered rather than crash or render a broken partial state | unit | `vitest run tests/lib/filter-games.test.ts tests/lib/sanitize-params.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-03-02 | 03 | 2 | SLATE-02, SLATE-03 | T-02-08 (accept) | No `v-html` used anywhere in `ConferenceFilter.vue`/`TeamFilter.vue`/`week/[week].vue` — Vue's default `{{ }}` interpolation auto-escapes, and values are pre-constrained by Task 1's sanitize functions before ever reaching a template binding | typecheck | `pnpm typecheck` | N/A (component wiring, `app/components/{ConferenceFilter,TeamFilter}.vue`) | ⬜ pending |
| 02-03-03 | 03 | 2 | SLATE-05 | — | `buildConfQuery`/`buildTeamQuery` always null out the other filter key by construction (D-03) — not by convention/discipline at each call site | unit | `vitest run tests/lib/filter-query.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-04-01 | 04 | 3 | SLATE-01 | T-02-09 | `isWeekBoundary`/`buildWeekQuery` keep navigation within the fixed `WEEKS` (1-15) array by construction — no array-index access on an out-of-range week, so an out-of-range direct URL renders the same harmless empty state as week 14 rather than erroring | unit | `vitest run tests/lib/week-nav.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-04-02 | 04 | 3 | SLATE-01, SLATE-05 | — | `determineEmptyStateVariant` checks the PRE-filter `rawWeekGames` list (not the post-filter list) to distinguish an inherently empty week (14) from a filter-caused empty result (Pitfall 4) — prevents the two states from being collapsed into one misleading message | unit | `vitest run tests/lib/empty-state.test.ts` | ❌ (authored by this task — not a Wave 0 gap) | ⬜ pending |
| 02-04-03 | 04 | 3 | SLATE-01, SLATE-02, SLATE-03, SLATE-04, SLATE-05, FOUND-01, FOUND-02, FOUND-03 | T-02-09, T-02-10 | Full end-to-end UAT confirms boundary disabling, week-empty/filter-empty distinction, filter mutual exclusivity, URL round-trip, deep-link (fresh-tab, non-client-routed) resolution, and FOUND-03's zero-additional-network-requests guarantee via a real browser Network tab | manual (`checkpoint:human-verify`, gate="blocking") | `MISSING — end-to-end production-build UAT requiring a real browser's Network tab and fresh-tab deep-link behavior, neither observable from an automated test in this repo's current tooling; component-mount/E2E testing was explicitly deferred per RESEARCH.md's Wave 0 Gaps decision` | N/A (verification-only task, no files modified) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*File Exists notation: "❌ (authored by this task — not a Wave 0 gap)" marks a test/config file that does not exist in the repo yet but is created within the same task that references it (TDD-style or up-front test authorship per the task's own `<action>`) — this is normal task execution, not a scaffolding gap requiring pre-Wave-0 creation.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. `vitest.config.ts` (node-environment project, `include: ['tests/**/*.test.ts']`) is already installed and configured — it auto-discovers every new `tests/lib/*.test.ts`/`tests/composables/*.test.ts` file these plans add, with zero config changes needed.

RESEARCH.md's "Wave 0 Gaps" section flagged one open scope decision: whether to install `@nuxt/test-utils`/`@vue/test-utils`/`happy-dom` for true component-mount tests, or defer to manual UAT for SLATE-04/05's visual/routing requirements. The four PLAN.md files resolve this explicitly: no task in any of the four plans installs those packages; SLATE-04 (card rendering, FCS-opponent fallback) is covered by pure-function/source-assertion checks plus a manual dev-server confirmation in 02-01's Task 1 `<done>`, and SLATE-01/02/03/05 + FOUND-01/02/03's remaining visual/network/routing concerns are covered by 02-04's Task 3 `checkpoint:human-verify`. This is a resolved scope decision, not an open gap.

- [x] `tests/composables/fetch-schedule.test.ts`, `tests/lib/group-games.test.ts`, `tests/lib/load-state.test.ts`, `tests/lib/filter-games.test.ts`, `tests/lib/sanitize-params.test.ts`, `tests/lib/filter-query.test.ts`, `tests/lib/week-nav.test.ts`, `tests/lib/empty-state.test.ts` — each authored within its own task per the Per-Task Verification Map; no separate scaffolding wave required.
- [x] Component-mount test infra (`@nuxt/test-utils`/`@vue/test-utils`/`happy-dom`) — explicitly deferred to manual UAT (02-04 Task 3) rather than installed; documented scope decision, not a gap.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Full end-to-end read-only slate walkthrough: week nav boundary disabling, week-14 empty state vs. filter-caused empty state, conference/team filter mutual exclusivity, deep-link (fresh-tab) + browser back/forward, FOUND-03 zero-additional-network-requests | SLATE-01, SLATE-02, SLATE-03, SLATE-05, FOUND-03 | Requires a real browser's DevTools Network tab and a genuinely fresh (non-client-routed) tab navigation — neither is observable from an automated test in this repo's current tooling; component-mount/E2E testing was explicitly deferred per RESEARCH.md's Wave 0 Gaps decision | 02-04-PLAN.md Task 3 `<how-to-verify>` steps 1-8: `pnpm build && pnpm preview`; page Next/Prev through weeks 1→15 (confirm week 14's empty state and boundary disabling); use the week-picker to jump to 14; select a conference filter then a team filter (confirm mutual exclusion); find a team's bye week (confirm "No games match this filter" vs. week-14's "No games this week"); open DevTools Network tab and confirm exactly 2 requests to `/data/2026/*.json` on load and 0 more while paging/filtering; open a brand-new tab at `/week/7?conf=SEC` (confirm no 404, correct filtered state); use native Back/Forward (confirm state restores correctly) |
| Visual confirmation that every game card shows both teams' logos/names, with FCS-opponent games rendering name-only + placeholder shield and no broken images | SLATE-04 | Visual/rendering correctness across 888 games (48 FCS-opponent games on week 1 alone) is a rendering concern not asserted by this phase's pure-function unit tests (no `@vue/test-utils`/`happy-dom` component-mount infra installed — see Wave 0 Requirements) | 02-01-PLAN.md Task 1 `<done>`: `pnpm dev`, navigate to `/week/1`, confirm real teams show logo + name and the 48 FCS-opponent games show name-only text + placeholder shield with no console errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 10 of 11 tasks carry a real automated command (`vitest run`, `pnpm build`, `pnpm typecheck`); the 1 exception (02-04-03) is a `checkpoint:human-verify` task whose `<automated>` field is explicitly `MISSING` with a documented, non-automatable rationale (real-browser Network tab + fresh-tab deep-link), matching the Nyquist Rule's allowance for checkpoint tasks.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — across the full phase task order (02-01-01 → 02-04-03), only the single final task (02-04-03) lacks an automated command; no run of 3 consecutive tasks is manual-only.
- [x] Wave 0 covers all MISSING references — the only `MISSING` automated command (02-04-03) is an intentionally non-automatable E2E/UAT checkpoint, not a scaffolding gap; no Wave 0 test-creation task is required to close it (see Wave 0 Requirements).
- [x] No watch-mode flags — every automated command uses `vitest run` (not `vitest`/`vitest watch`), `pnpm build`, or `pnpm typecheck`; none invoke a watcher.
- [x] Feedback latency < 60s — the slowest per-task automated command (`pnpm build`, used by 02-02-01 and within 02-02-02) completes well under 60s for a static 15-route Nuxt generate; all `vitest run <single-file>` commands complete in a few seconds.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-13
