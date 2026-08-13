# Phase 2: Foundation & Read-Only Slate - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A fully static Nuxt app where users browse the full 2026 FBS schedule week by week, filterable to a single conference or a single team. Read-only — no picks yet (Phase 4), no standings (Phase 5). Includes the foundational typed query layer (`useTeams`, `useGames` composables over TanStack Query) that later phases build on. Zero runtime API calls, zero server routes.

</domain>

<decisions>
## Implementation Decisions

### Filters (conference & team)
- **D-01:** Conference filter dropdown lists all 11 conferences present in the dataset (SEC, Big Ten, Big 12, ACC, American Athletic, Conference USA, FBS Independents, Mid-American, Mountain West, Pac-12, Sun Belt) plus "All" — not just the 4 conferences that get standings later. The full slate is P4 + G5 + independents, and G5 games affect P4 teams' overall records, so hiding them from the filter would misrepresent the browse experience.
- **D-02:** Team filter is a searchable combobox (type-ahead) across all 138 teams, not a plain dropdown or conference-grouped list.
- **D-03:** Conference filter and team filter are mutually exclusive — picking a team clears any conference filter and vice versa. A team's games aren't confined to one conference (cross-conference/G5 opponents), so combining doesn't cleanly compose.
- **D-04:** G5/independent games render with identical card styling to P4 games — no visual de-emphasis. Standings scope (P4-only) is a Phase 5 concern, not a Phase 2 display concern.

### Game card layout
- **D-05:** Games display as a responsive card grid, not a list/table. Cards must be built using **Nuxt UI's Card component** (`UCard` or similar) rather than a custom-built card — explicit user requirement, not just a recommendation.
- **D-06:** 127 of 888 games have an FCS/non-FBS opponent not present in `teams.json` (no logo/color/id join available). These render name-only (the raw team name string from `games.json`) with the same placeholder shield SVG fallback pattern already established in Phase 1's logo vendoring (`vendorLogo`/coverage report) — not hidden or filtered out. This preserves DATA-06/07's raw-passthrough principle.
- **D-07:** Games within a week are grouped by conference, with conference headers, sorted alphabetically. No kickoff-time data exists in the dataset to sort by otherwise.
- **D-08:** Each card shows a neutral-site badge (when `neutralSite: true`) and a conference-game badge (when `conferenceGame: true`), in addition to team names/logos.

### URL structure (SLATE-05)
- **D-09:** Week is a path segment: `/week/{n}` (e.g. `/week/3`). Week is the primary navigation axis (SLATE-01), so it's a route, not a filter.
- **D-10:** Conference and team filters are query params on the week route: `/week/3?conf=SEC` or `/week/3?team=2628`. Both remain fully bookmarkable/shareable/back-forward-compatible.
- **D-11:** Team filter URL param is the CFBD numeric team id (e.g. `?team=2628`), matching `teams.json`'s `id` field directly — no slug generation/lookup layer needed. This is the same id used to join `games.json` ↔ `teams.json` ↔ logo files.

### Week navigation & default
- **D-12:** Default landing week is **week 1**. The dataset has no "week 0" — CFBD numbers the earliest slate of games (99 games) as week 1. This was confirmed with the user: their intent ("start when the first games are played") maps directly onto week 1 since no earlier week exists in the data.
- **D-13:** Navigation controls: Prev/Next buttons plus a week picker dropdown for direct jumps.
- **D-14:** Boundary behavior: Prev is disabled at week 1, Next is disabled at week 15 (the last week present in the data).
- **D-15:** **Week 14 has zero games** (the dataset's weeks are 1–13, then jumps to 15 — confirmed by direct inspection of `games.json`). Per user decision, navigation is **strict numeric sequence** — clicking Next from week 13 lands on week 14, which renders an empty state ("No games this week"), rather than skipping straight to 15. The week picker dropdown should still list 14 as a selectable option (with the same empty state on selection).
- **D-16:** No postseason/championship placeholder in Phase 2. All 888 fetched games are `seasonType: "regular"` (confirmed in Phase 1); conference championship games don't exist as schedule rows and will be constructed from computed standings in Phase 5/6, not sourced from this data. Phase 2 covers exactly weeks 1–15 as fetched.

### Claude's Discretion
None — every gray area presented was explicitly decided by the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data shape (Phase 1 outputs, consumed directly by this phase)
- `public/data/2026/teams.json` — 138 FBS teams: `{id, school, mascot, abbreviation, conference, classification, color, alternateColor, logo}`. `id` is the CFBD team id, `logo` is a vendored local path (`/logos/{id}.png`).
- `public/data/2026/games.json` — `{season, scheduleHash, games: [...]}`; 888 games: `{id, week, seasonType, homeId, homeTeam, awayId, awayTeam, conferenceGame, neutralSite}`. Weeks present: 1–13, 15 (no 14). All `seasonType === "regular"`. 127 games have an `awayId` not present in `teams.json` (FCS opponent).
- `public/data/2026/coverage.json` — Phase 1's build-time logo/field coverage report (0 missing logos on the committed 2026 run).
- `public/logos/{teamId}.png` and `public/logos/placeholder.svg` — vendored team logos with placeholder fallback pattern; Phase 2's FCS-opponent rendering (D-06) should reuse this exact fallback approach.

### Project-level constraints
- `.planning/PROJECT.md` — Constraints section: no backend, localStorage-only persistence (not relevant until Phase 4), team color used sparingly as accents, DRY requirement for team lookup/standings/tiebreaker logic (single implementation each, via composables).
- `.planning/REQUIREMENTS.md` — FOUND-01/02/03 and SLATE-01 through 05 are this phase's requirement set.
- `.claude/CLAUDE.md` — Technology Stack section: confirms TanStack Query v5 (`staleTime: Infinity`, `gcTime: Infinity` for this immutable static data), query-key factory pattern (`['season', 2026, 'teams']` / `['season', 2026, 'games']`), and the `public/` + `$fetch` approach (not direct JSON import) for the query layer this phase builds.

No other external specs/ADRs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nothing yet in `app/` beyond the stock Nuxt 4 + Nuxt UI 4 starter (`app/pages/index.vue`, `app/components/AppLogo.vue`, `app/components/TemplateMenu.vue`, `app/app.config.ts`). `@tanstack/vue-query` is an installed dependency but not yet wired up (no plugin, no query-key factory, no composables exist).
- `nuxt.config.ts` currently has `routeRules: { '/': { prerender: true } }` and no `ssr: false` — per CLAUDE.md's "static, no-SSR" variant guidance, this phase likely needs to add `ssr: false` (or confirm prerendering covers the `/week/[n]` routes) since there's no backend/API route in v1.

### Established Patterns
- Phase 1 established a placeholder-fallback pattern for missing assets (`vendorLogo`'s placeholder SVG) — Phase 2's FCS-opponent-team rendering (D-06) should follow the same fallback philosophy, not invent a new one.
- Zod validation and `scheduleHash` fingerprinting already exist server-side (fetch script) — Phase 2 consumes the committed JSON as-is; it does not need to re-validate on the client.

### Integration Points
- New composables (`useTeams`, `useGames`) will be the sole read path into `public/data/2026/*.json` for this phase and every phase after it (DRY constraint from PROJECT.md). Standings/tiebreaker computations in later phases will layer on top of these same composables' data, not fetch independently.
- New dynamic route `app/pages/week/[week].vue` (or equivalent) is the first real page this phase introduces; `app/pages/index.vue` likely becomes a redirect to `/week/1` or is replaced entirely.

</code_context>

<specifics>
## Specific Ideas

- User was explicit that game cards must use Nuxt UI's built-in Card component, not a custom-built card from scratch (D-05).
- User corrected the assistant's initial understanding of "week 0" — confirmed there is no week 0 in the actual dataset, and that week 1 (99 games) is the true start of the season as fetched.
- User chose strict numeric week sequencing (including the empty week 14) over silently skipping the gap — prioritizing predictable, honest navigation over a seamless-looking flow.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Foundation & Read-Only Slate*
*Context gathered: 2026-08-13*
