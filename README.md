# CFB Predictions

Pick the winner of every FBS game on the 2026 college football schedule and watch conference standings and championship-game matchups recompute live — including each power conference's own published tiebreaker procedure.

**The core idea:** pick a game, and every downstream consequence — records, conference standings, tiebreakers, championship matchups — updates correctly and instantly. If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters.

## What it does

- **Pick every game** on the schedule, week by week, filterable by conference or team
- **Conference standings recompute live** as picks change, including each Power 4 conference's real tiebreaker procedure (head-to-head, common-opponent records, CFP-style ranking steps) — not a simplified approximation
- **Conference championship matchups** resolve automatically once a conference's slate is fully picked
- **Once a game finishes**, the pick locks to the actual result and the final score displays in place of the win-probability badge — an against-the-spread cover is shown too, on whichever side actually covered
- **Multiple named scenarios** can be kept side by side in the same browser, each with its own picks
- **Share a scenario** via a link — the recipient sees a live preview of those picks before deciding whether to save a copy
- Nothing leaves the browser: no account, no server, no backend at all

## Tech stack

| | |
|---|---|
| Framework | [Nuxt 4](https://nuxt.com) (SPA mode — `ssr: false`, static `nuxt generate`) |
| UI | [Nuxt UI 4](https://ui.nuxt.com) + Tailwind CSS 4 |
| Data fetching | [TanStack Query](https://tanstack.com/query) (`@tanstack/vue-query`) |
| Persistence | `localStorage` via VueUse's `useStorage` — picks are client state, not server state |
| Language | TypeScript |
| Schedule/team data | [CollegeFootballData (CFBD)](https://collegefootballdata.com/) API, fetched at build/commit time — never called from the browser |
| Testing | Vitest |

There is no backend, no database, and no runtime API key — the whole app is static files, and the schedule/rankings/odds data is plain JSON committed to the repo.

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server needs the committed data in `public/data/2026/` to already exist (see [Data pipeline](#data-pipeline) below) — it's checked into the repo, so a fresh clone works out of the box without any API key.

## Data pipeline

The app never talks to CFBD directly. Two scripts fetch from CFBD and commit plain JSON to `public/data/2026/`, which the app then reads like any other static asset:

| Script | Cadence | What it writes |
|---|---|---|
| `pnpm fetch-data 2026` | One-time per season | `teams.json`, `games.json`, `venues.json`, `talent.json`, `coverage.json` |
| `pnpm fetch-weekly-data 2026` | Daily (automated) | `rankings.json`, `win-probabilities.json`, `betting-lines.json`, `media.json`, `team-ratings.json` — plus `games.json` again, so final scores and completion status refresh as the season is played |

Both require a `CFBD_API_KEY` in a local `.env` file:

```
CFBD_API_KEY=your_key_here
```

Get a free key at [collegefootballdata.com](https://collegefootballdata.com/). `fetch-weekly-data` runs automatically every morning via [`.github/workflows/daily-data.yml`](.github/workflows/daily-data.yml), which commits the refreshed JSON straight to the repo — that's what keeps live scores, rankings, and odds current without anyone running a script by hand. At ~12 CFBD calls per run, daily cadence costs ~360 calls/month, well under the free tier's 1,000/month limit ([details](https://collegefootballdata.com/api-tiers)).

## Architecture notes

- **`shared/domain/`** holds every piece of standings and tiebreaker logic as pure, framework-free TypeScript — one implementation, imported by every UI component and test that needs it (`shared/domain/standings`, `shared/domain/tiebreakers`). This is deliberate: the tiebreaker math is the one thing in this app that has to be exactly right, so it lives somewhere it can be tested in complete isolation from Vue.
- **`shared/types/`** is the committed-JSON contract — every `public/data/2026/*.json` shape has a matching type here.
- **`scripts/lib/schemas.ts`** validates (via Zod) and transforms CFBD's raw API responses into those committed shapes. A fetch script hard-fails before writing anything if the response doesn't validate — bad data never gets silently committed.
- Picks are namespaced per scenario in `localStorage`; standings are a pure function of `(games, teams, picks)`, recomputed on every pick rather than incrementally maintained.

## Scripts

```bash
pnpm dev # start the dev server
pnpm build # production build (static output)
pnpm preview # preview the production build locally
pnpm test # run the test suite (Vitest)
pnpm lint # eslint
pnpm typecheck # nuxt typecheck (app + composables)
pnpm typecheck:scripts # typecheck the fetch scripts separately (their own tsconfig)
```

## Deployment

Static output (`pnpm build` → `.output/public`) — no server, no runtime environment variables. `CFBD_API_KEY` is only ever used locally or by the weekly GitHub Action, never shipped to the client. Cloudflare Pages is the intended target (best free tier for a pure static asset bundle at this size), though no deploy is wired up in this repo yet.
