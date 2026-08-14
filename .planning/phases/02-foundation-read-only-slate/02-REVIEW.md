---
phase: 02-foundation-read-only-slate
reviewed: 2026-08-13T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - app/app.vue
  - app/components/ConferenceFilter.vue
  - app/components/GameCard.vue
  - app/components/TeamFilter.vue
  - app/components/WeekNav.vue
  - app/composables/useGames.ts
  - app/composables/useTeams.ts
  - app/pages/index.vue
  - app/pages/week/[week].vue
  - app/plugins/vue-query.ts
  - app/utils/fetchSchedule.ts
  - app/utils/queryKeys.ts
  - app/utils/schedule.ts
  - nuxt.config.ts
  - shared/types/schedule.ts
  - tests/composables/fetch-schedule.test.ts
  - tests/lib/empty-state.test.ts
  - tests/lib/filter-games.test.ts
  - tests/lib/filter-query.test.ts
  - tests/lib/group-games.test.ts
  - tests/lib/load-state.test.ts
  - tests/lib/sanitize-params.test.ts
  - tests/lib/week-nav.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-13
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The data layer (`fetchSchedule.ts`, `queryKeys.ts`, `useGames`/`useTeams`), filtering/sanitization logic (`schedule.ts`), and week-navigation math are well-tested and correct. I verified the FCS-opponent fallback claim against the actual committed data: `public/data/2026/games.json` has 0 games with an unresolvable `homeId` and 127 with an unresolvable `awayId`, matching the code's comments and `GameCard.vue`'s asymmetric fallback (away gets a placeholder object + shield, home does not). `sanitizeConfParam`/`sanitizeTeamParam` are correctly allowlist-based (exact string match against `KNOWN_CONFERENCES`, `Number.isSafeInteger` + map-membership for team id) — no injection path from the `?conf=`/`?team=` query params, and duplicate-param arrays (`?team=5&team=5`) fail safe to `undefined` rather than crashing. `public/_redirects` (`/* /index.html 200`) confirms the SPA fallback needed for the non-prerendered `/week/14` deep link works.

Two real issues found: `app/app.vue` still ships the unmodified Nuxt UI starter template's title/meta/OG tags (wrong site name, wrong description, image hotlinked to `ui.nuxt.com`), and `WeekNav.vue`'s week-picker dropdown has no entry for week 14, so a direct `/week/14` deep link renders a picker with no item selected even though Prev/Next both work correctly from that state.

## Warnings

### WR-01: `app.vue` still ships the Nuxt UI starter template's title, description, and OG image

**File:** `app/app.vue:14-24`
**Issue:** The page `<title>`, meta description, `og:title`/`og:description`, and `ogImage` are all unmodified starter-template boilerplate:
```js
const title = 'Nuxt Starter Template'
const description = 'A production-ready starter template powered by Nuxt UI. Build beautiful, accessible, and performant applications in minutes, not hours.'
...
ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
```
This is the app shell used on every route, so every prerendered page (`/`, `/week/1`...`/week/15`) ships with a browser tab titled "Nuxt Starter Template", a description that has nothing to do with CFB Predictions, and a social preview image hotlinked from `ui.nuxt.com` (a domain this project doesn't control and has no reason to depend on).
**Fix:**
```js
const title = 'CFB Predictions'
const description = 'Pick the winner of every FBS game on the 2026 schedule and watch conference standings and championship matchups update live.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
```
Drop `ogImage` until a real project-owned social card image exists, rather than pointing at Nuxt UI's marketing asset.

### WR-02: `WeekNav` picker has no item for week 14, desyncing on a direct `/week/14` deep link

**File:** `app/components/WeekNav.vue:27,31-34` (item list) and `app/utils/schedule.ts:112` (`WEEKS`)
**Issue:** `WEEKS` intentionally excludes `14` (0 games that week, per `02-CONTEXT.md` D-15), and `weekItems` is built directly from `WEEKS`, so the `USelect` has no `{ label: 'Week 14', value: 14 }` entry. `week/[week].vue` still resolves `/week/14` directly (confirmed via `public/_redirects`' SPA fallback and `nuxt.config.ts` not prerendering it, but the dynamic route still matches client-side), and passes `week={{ 14 }}` into `WeekNav`. The `picked` computed's getter (`WeekNav.vue:32`) returns `14`, which doesn't match any `value` in `weekItems`, so `USelect` has no way to display a selected label — it will render as if nothing is selected (or show a stale/blank trigger), even though the page behind it correctly shows the "No games this week" empty state and Prev/Next both work (`getAdjacentWeek(14, 'prev')` → 13, `getAdjacentWeek(14, 'next')` → 15, both tested).
**Fix:** Either synthesize a transient `{ label: 'Week 14', value: 14 }` entry when `props.week === 14` so the dropdown has something to bind to:
```ts
const weekItems = computed(() => {
  const items = WEEKS.map(w => ({ label: `Week ${w}`, value: w }))
  if (!WEEKS.includes(props.week)) {
    items.push({ label: `Week ${props.week}`, value: props.week })
    items.sort((a, b) => a.value - b.value)
  }
  return items
})
```
or explicitly redirect `/week/14` to `/week/13` (or `/week/15`) at the route level so the picker never has to represent an unreachable week at all — the latter is more consistent with `WEEKS` already treating 14 as fully unnavigable.

## Info

### IN-01: `GameCard`'s home-team fallback silently renders nothing if the "always resolves" assumption is ever violated

**File:** `app/components/GameCard.vue:11,39,46`
**Issue:** `home` has no fallback object the way `away` does (`GameCard.vue:16-19`) — it relies entirely on the comment/assumption that `homeId` always resolves. I verified this holds for the current committed data (0/888 games have an unresolvable `homeId`), so this isn't a live bug, but if a future data refresh (`scripts/` re-fetch) ever produces a game with an unresolvable `homeId`, `home` becomes `undefined` and the template silently renders `<img src="undefined">` and an empty team name with no placeholder shield — a worse failure mode than the away side, which degrades gracefully.
**Fix:** For defense-in-depth, consider giving `home` the same placeholder fallback as `away` (reusing `props.game.homeTeam` + `/logos/placeholder.svg`), even though it's expected to be dead code today.

### IN-02: `KNOWN_CONFERENCES` and page filter logic are imported from a `.vue` component file

**File:** `app/pages/week/[week].vue:4`, `app/components/ConferenceFilter.vue:2-36`
**Issue:** `week/[week].vue` imports `KNOWN_CONFERENCES` from `ConferenceFilter.vue`'s non-`setup` `<script>` block. This works (Vue SFCs can export named bindings from a plain `<script>` block), and the in-file comments explain the DRY rationale clearly, but it couples page-level sanitization logic to a specific UI component's file — a future change to `ConferenceFilter.vue` (e.g. splitting it, renaming it, or moving it) silently breaks an import that has nothing to do with rendering.
**Fix:** Not urgent, but consider moving `CONFERENCE_ITEMS`/`KNOWN_CONFERENCES` into `app/utils/schedule.ts` (or a new `app/utils/conferences.ts`) alongside the other single-source-of-truth filtering constants, and have `ConferenceFilter.vue` import from there instead of the reverse.

---

_Reviewed: 2026-08-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
