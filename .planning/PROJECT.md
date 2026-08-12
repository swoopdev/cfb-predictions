# CFB Predictions

## What This Is

A college football season predictor. Users pick the winner of every FBS game on the 2026 schedule and watch conference standings recompute live, with each power conference's published tiebreaker procedure resolving who plays in the conference championship game. Picks live entirely in the browser — users can keep multiple named scenarios side by side, come back to them later, and share one via a link.

Modeled on what [playoffpredictors.com](https://v2.playoffpredictors.com/football/cfb/) does, scoped for v1 to the regular season and conference championships rather than the Playoff bracket.

## Core Value

Pick a game, and every downstream consequence — records, conference standings, tiebreakers, championship game matchups — updates correctly and instantly.

If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Fetch the 2026 FBS schedule and team metadata from CFBD once, commit as static JSON
- [ ] Pull team logos from the CFBD `cfb-web` repo into `public/` at build time
- [ ] Week-first browsing of the full slate, filterable down to a single conference or team
- [ ] Pick a winner for any game; picks persist across sessions
- [ ] Conference standings derive from picks (conference record, overall record)
- [ ] Conference championship participants resolve via each conference's published tiebreaker steps
- [ ] Tied teams that bottom out at a ranking-based tiebreaker step surface for manual user selection
- [ ] Multiple named scenarios, saved and switchable
- [ ] Encode a scenario into a shareable URL that opens with those picks applied
- [ ] Season-parameterized data and storage keys so 2027 is a re-run of the fetch script

### Out of Scope

- **12-team CFP bracket and seeding** — deferred to v2; the regular season and conference championships are the foundation it would build on, and shipping that first keeps v1 tractable
- **Live/auto-filled game results** — deliberately deferred. Would require either a Nitro server route holding the CFBD key or a scheduled rebuild; user chose to keep v1 simple and static. Revisit once the core picking flow is proven
- **User accounts / server-side persistence** — localStorage plus share links covers the stated need with no backend
- **SportRadar as a data source** — CFBD is free, its team IDs match the logo repo, and SportRadar's terms restrict redistributing schedule data
- **Score prediction** — users pick winners, not scores. Standings only need W/L
- **G5 conference standings/championship views** — G5 *games* are pickable (they affect P4 teams' overall records), but v1's standings and tiebreaker UI covers SEC, Big Ten, Big 12, ACC. The data is present if we want to extend

## Context

**Starting point:** The repo is the stock Nuxt 4 + Nuxt UI 4 starter — `app/pages/index.vue`, `AppLogo.vue`, `TemplateMenu.vue`, and nothing else. `@tanstack/vue-query` v5 is already a dependency but not yet wired up. pnpm, TypeScript, ESLint via `@nuxt/eslint`. No app code to preserve.

**Data:** [CollegeFootballData](https://collegefootballdata.com) API — `/games` for the schedule, `/teams/fbs` for team metadata (conference, colors, alternate colors, IDs). Free API key, one-time fetch. Logos come from [CFBD/cfb-web](https://github.com/CFBD/cfb-web), whose filenames key off the same team IDs, so schedule and logo join without a mapping layer.

**Why static JSON:** The 2026 schedule doesn't meaningfully change once released, so there's no reason to hit an API at runtime. A committed fetch script produces `teams.json` and `games.json`; re-running it for a new season is a one-liner.

**Why TanStack Query over static JSON:** Wrapping bundled JSON in a query looks redundant, but a single query-key factory (`['season', 2026, 'teams']`, `['season', 2026, 'games']`) keeps every call site identical whether the data comes from a JSON import today or an `/api/` route when live results land in v2. `staleTime: Infinity` since the data can't go stale.

**Tiebreaker complexity — the real risk:** SEC and Big Ten dropped divisions; both now take the top two by conference winning percentage, with multi-team tiebreak procedures that cascade through head-to-head, record vs. common opponents, record vs. next-highest-placed teams, and finally a ranking-based step. The Big 12 and ACC each have their own published variants. Multi-team ties are where implementations get this wrong: after eliminating one team, the procedure often restarts from the top rather than continuing down the list. This deserves dedicated test cases with hand-verified scenarios.

## Constraints

- **Tech stack**: Nuxt 4, Nuxt UI 4, TanStack Query (vue-query) v5, TypeScript, Tailwind 4 — already scaffolded and chosen by the user
- **Package manager**: pnpm — lockfile and `packageManager` field already committed
- **No backend**: fully static deploy. No runtime API key, no server routes in v1
- **Persistence**: localStorage only. Storage keys namespaced by season
- **Data licensing**: CFBD data and logos only — no SportRadar content in the repo
- **Design**: neutral shell (surfaces, typography), team color used sparingly as accents on picked winners and standings. Contrast must hold up — many team colors fail against light or dark surfaces at small sizes
- **DRY**: team lookup, standings computation, and tiebreaker logic each have exactly one implementation, consumed through composables

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CFBD over SportRadar for schedule data | Free key, no redistribution restrictions, and team IDs match the CFBD logo repo — no mapping layer needed | — Pending |
| Static committed JSON, no runtime API calls | Schedule is immutable once released; removes the API key from the deploy entirely | — Pending |
| TanStack Query even for local JSON | Uniform call sites and a query-key factory that survives the eventual switch to a live results endpoint | — Pending |
| Fetch all FBS games, surface P4 | Costs nothing extra at fetch time; P4 non-conference records need G5/FCS games anyway, and extending to G5 later needs no re-fetch | — Pending |
| Tiebreakers auto-resolve with manual override at ranking steps | Published procedures are computable right up to the ranking-based step; guessing there would be arbitrary, so hand it to the user | — Pending |
| No live results in v1 | Keeps the app fully static — the alternative forces a server route or a cron rebuild before the core picking flow is even proven | — Pending |
| Season-parameterized from day one | Cheap now (a key prefix and a script arg), a refactor later | — Pending |
| Week-first navigation, filterable by conference/team | Matches how the season is actually consumed; conference and team views are filters over one slate rather than separate screens | — Pending |
| Logos vendored into `public/` at build time | Hotlinking raw.githubusercontent.com in production is fragile and rate-limited | — Pending |
| Defer 12-team CFP bracket to v2 | Depends on conference champions being correct; sequencing it after the foundation avoids rework | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-12 after initialization*
