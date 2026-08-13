# CFB Predictions

## What This Is

A college football season predictor. Users pick the winner of every FBS game on the 2026 schedule and watch conference standings recompute live, with each power conference's published tiebreaker procedure resolving who plays in the conference championship game. Picks live entirely in the browser — users can keep multiple named scenarios side by side, come back to them later, and share one via a link.

Modeled on what [playoffpredictors.com](https://v2.playoffpredictors.com/football/cfb/) does, scoped for v1 to the regular season and conference championships rather than the Playoff bracket.

## Core Value

Pick a game, and every downstream consequence — records, conference standings, tiebreakers, championship game matchups — updates correctly and instantly.

If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters.

## Requirements

### Validated

- [x] Fetch the 2026 FBS schedule and team metadata from CFBD once, commit as static JSON — Validated in Phase 1: Data Pipeline. `pnpm fetch-data 2026` produces committed, season-namespaced `public/data/2026/teams.json` (138 teams) and `games.json` (888 games), each carrying a `scheduleHash` fingerprint. Re-running for 2027 needs only the season CLI argument — zero hardcoded `2026` in `scripts/`.
- [x] Pull team logos into `public/` at build time — Validated in Phase 1, with a correction to how this requirement was originally scoped: logos are vendored directly from CFBD's own `/teams` endpoint (`team.logos[]`, an `https:`-only-gated download with a placeholder SVG fallback), **not** from the separate `CFBD/cfb-web` GitHub repo this bullet originally assumed. One fewer data source to keep in sync; team IDs still join without a mapping layer. 138/138 logos vendored on the live 2026 run, 0 missing.

### Active

- [ ] Week-first browsing of the full slate, filterable down to a single conference or team
- [ ] Pick a winner for any game; picks persist across sessions
- [ ] Conference standings derive from picks (conference record, overall record)
- [ ] Conference championship participants resolve via each conference's published tiebreaker steps
- [ ] Tied teams that bottom out at a ranking-based tiebreaker step surface for manual user selection
- [ ] Multiple named scenarios, saved and switchable
- [ ] Encode a scenario into a shareable URL that opens with those picks applied
- [ ] Season-parameterized storage keys so 2027 picks/scenarios don't collide with 2026's (the fetch-script half of this is already validated above — this remaining bullet is specifically about `useStorage` key namespacing, which lands with Phase 4's picks/persistence work)

### Out of Scope

- **12-team CFP bracket and seeding** — deferred to v2; the regular season and conference championships are the foundation it would build on, and shipping that first keeps v1 tractable
- **Live/auto-filled game results** — deliberately deferred. Would require either a Nitro server route holding the CFBD key or a scheduled rebuild; user chose to keep v1 simple and static. Revisit once the core picking flow is proven
- **User accounts / server-side persistence** — localStorage plus share links covers the stated need with no backend
- **SportRadar as a data source** — CFBD is free, its team IDs match the logo repo, and SportRadar's terms restrict redistributing schedule data
- **Score prediction** — users pick winners, not scores. Standings only need W/L
- **G5 conference standings/championship views** — G5 *games* are pickable (they affect P4 teams' overall records), but v1's standings and tiebreaker UI covers SEC, Big Ten, Big 12, ACC. The data is present if we want to extend

## Context

**Starting point (as of initialization):** The repo was the stock Nuxt 4 + Nuxt UI 4 starter — `app/pages/index.vue`, `AppLogo.vue`, `TemplateMenu.vue`, and nothing else. `@tanstack/vue-query` v5 was already a dependency but not yet wired up.

**Current state (after Phase 1: Data Pipeline, 2026-08-13):** The data foundation exists and is committed: `scripts/fetch-data.ts` + `scripts/lib/{schedule-hash,schemas,coverage,fetch-source}.ts` orchestrate a validated, tested fetch pipeline (36 tests). `public/data/2026/{teams,games,coverage}.json` and `public/logos/*.png` are committed. The app layer (`app/`) is still untouched — Phase 2 is the first phase that builds user-facing UI against this data.

**Data:** [CollegeFootballData](https://collegefootballdata.com) API — `/games` for the schedule, `/teams/fbs` for team metadata (conference, colors, alternate colors, IDs). Free API key, one-time fetch. Logos are vendored directly from the `logos[]` URLs CFBD's own `/teams` response already includes (see Requirements/Validated above — no separate cfb-web repo needed).

**Data pipeline hardening (Phase 1 code review):** The initial fetch script only checked the CFBD SDK's `data` field and defaulted to `[]` on failure — a rotated/expired key or a rate limit would have silently overwritten the committed dataset with an empty one. Fixed before Phase 1 closed: `scripts/lib/fetch-source.ts` now gates on the SDK's `error` field, a missing-`data` case, and a suspiciously-empty response before anything is written, and per-game validation failures are now reported structurally instead of throwing an uncaught exception mid-run.

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
| CFBD over SportRadar for schedule data | Free key, no redistribution restrictions, and team IDs match the CFBD logo repo — no mapping layer needed | Confirmed, Phase 1 — 138 teams / 888 games fetched via the official `cfbd` SDK, ids join cleanly between teams/games/logos with no mapping layer |
| Static committed JSON, no runtime API calls | Schedule is immutable once released; removes the API key from the deploy entirely | Confirmed, Phase 1 — `public/data/2026/*.json` committed with a `scheduleHash` fingerprint; `CFBD_API_KEY` lives only in a gitignored `.env`, never in the deploy |
| TanStack Query even for local JSON | Uniform call sites and a query-key factory that survives the eventual switch to a live results endpoint | — Pending (Phase 2) |
| Fetch all FBS games, surface P4 | Costs nothing extra at fetch time; P4 non-conference records need G5/FCS games anyway, and extending to G5 later needs no re-fetch | Confirmed, Phase 1 — all 888 FBS games fetched, including 127 with an FCS opponent (documented, not filtered) |
| Tiebreakers auto-resolve with manual override at ranking steps | Published procedures are computable right up to the ranking-based step; guessing there would be arbitrary, so hand it to the user | — Pending (Phase 3) |
| No live results in v1 | Keeps the app fully static — the alternative forces a server route or a cron rebuild before the core picking flow is even proven | — Pending |
| Season-parameterized from day one | Cheap now (a key prefix and a script arg), a refactor later | Confirmed for the fetch script, Phase 1 — 2027 needs only a season CLI argument, zero hardcoded `2026` in `scripts/` (grep-verified). Storage-key namespacing side still pending, Phase 4 |
| Week-first navigation, filterable by conference/team | Matches how the season is actually consumed; conference and team views are filters over one slate rather than separate screens | — Pending (Phase 2) |
| Logos vendored into `public/` at build time | Hotlinking raw.githubusercontent.com in production is fragile and rate-limited | Confirmed, Phase 1 — 138/138 logos vendored as local PNGs, `https:`-only source gate, placeholder SVG fallback for any miss (none occurred on this run) |
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
*Last updated: 2026-08-13 after Phase 1: Data Pipeline*
