# Project Research Summary

**Project:** CFB Predictions
**Domain:** Client-side college football season predictor / pick-em scenario tool (static Nuxt 4 SPA)
**Researched:** 2026-08-12
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a derived-state app, not a data app. ~138 FBS teams and ~830-900 games are static, committed JSON; the only mutable state is a sparse map of picks; everything the user cares about - records, conference standings, tiebreakers, championship matchups - is a pure function of those three inputs. All four researchers converged on the same shape: a **pure, framework-free domain layer in `shared/`** containing `deriveSeason(teams, games, picks, overrides)`, wrapped by thin Vue composables, with a full recompute on every pick (~1,000 iterations, sub-millisecond). There is no invalidation graph to build, and there should not be one.

The recommended approach is: Nuxt 4 + Nuxt UI 4 + TanStack Query v5 (already locked), `ssr: false`, static JSON fetched once from CFBD by a manual `tsx` script, logos vendored to `public/`, picks in localStorage, Vitest with a `node`-environment project for the domain layer. Stack additions are deliberately minimal - no Pinia, no lz-string, no vue-query community module. The single most important architectural decision is that the **tiebreaker engine returns a structured trace, not an answer**: the trace is simultaneously the correctness test target, the UI's only source of explanation, and the differentiator (playoffpredictors.com paywalls step-by-step tiebreaker reasoning at $2/mo, and its CFB picker is self-described as "very early alpha... implemented with NFL Tiebreakers").

The risks are concentrated and all four researchers flagged them independently. **Tiebreaker correctness** is the whole product: all four P4 procedures *restart from step 1* on partial separation rather than continuing to the next step, and all four bottom out in a proprietary SportSource Analytics rating that cannot be computed from wins and losses. The manual-selection escape hatch PROJECT.md frames as an edge case is, for the ACC, the **normal path** - head-to-head is the only computable ACC step under the July 2026 policy. Two committed PROJECT.md assumptions also need amendment: the CFBD `cfb-web` logo repo is **archived** with logos last updated 2022-09-01 (453 files, no assets for North Dakota State or Sacramento State, both joining FBS in 2026), and the SEC's step E requires scoring margin, which the "winners only" scope decision excludes - so the SEC is computable one step shallower than PROJECT.md assumes.

## Cross-Research Convergence and Contradictions

### Where all four agree (treat as settled)

- **Pure domain layer, zero Vue imports, in `shared/`.** Stack derives it from the Vitest `node`-project requirement; Architecture derives it from Nuxt's framework-enforced purity rules for `shared/`; Pitfalls derives it from testability under Pitfalls 1-6. Same conclusion, three independent routes. Nuxt only auto-scans `shared/utils/` and `shared/types/`, so placing the engine in `shared/domain/` opts it out of auto-import deliberately - explicit `#shared/domain` imports make the DRY constraint greppable.
- **Tiebreaker engine returns an ordered result plus a structured step trace.** Features (differentiator), Architecture (Pattern 6, anti-pattern 5), Pitfalls (test assertion target). Unanimous.
- **Multi-team ties restart at step 1 on partial separation; continue to the next step on no separation.** Both branches must exist. Pitfalls has verbatim primary-document quotes for Big Ten, Big 12, and ACC.
- **Conference rules as a data table, one generic engine.** Architecture Pattern 5, Features' "rulesets keyed by (season, conference), not code", Pitfalls' technical-debt note. One caveat below.
- **No Pinia, no lz-string, no `@tanstack/query-persist-client`, no storing picks in the query cache.** Unanimous.
- **`staleTime: Infinity` must be paired with `gcTime: Infinity`.** Stack, Architecture, and Pitfalls each flag that gcTime alone would evict, re-import, and produce a *new object identity* - which silently breaks reference-keyed memoization.
- **Versioned payload + schedule fingerprint in every stored and shared scenario.** Stack (`scheduleHash:u32` header), Architecture (`{season}.{scheduleHash8}.{bits}`), Features (format version + fingerprint), Pitfalls (Pitfall 10). Unanimous.

### Contradiction 1 - Picks encoding: map or bit array? RESOLVED: Architecture is right.

Stack and Pitfalls both say "positional 2-bit array"; Pitfalls specifically recommends it for localStorage too (quota argument). Features observed the reference product uses a positional array *everywhere* - and observed the consequence: it is exactly why manual CFP seeds had to bolt on outside the blob as `&seed1=...&seed12=...`.

**Resolution - use both, at different boundaries (Architecture's split); Features' observation corroborates it rather than opposing it:**

| Boundary | Representation | Why |
|---|---|---|
| In memory | `PickSet` sparse map, frozen, in `shallowRef` | O(1) lookup by `gameId`; "unpicked" is absence, not a sentinel; robust to schedule edits |
| localStorage | `PickSet` map as JSON, per-scenario key | ~13KB/scenario against a 5MB quota is a non-issue; human-inspectable; trivially migratable |
| Share URL | 2-bit positional array to base64url, in the hash | The only boundary where size is a hard constraint (~225 bytes vs ~13KB raw) |

Pitfalls' quota argument is real but does not bind here: per-scenario keys (rather than one blob rewritten on every click) keep the footprint two orders of magnitude under quota. Its `QuotaExceededError` try/catch requirement stands regardless and is non-negotiable. Stack's measured benchmark (bitpack 268 URL chars vs lz-string 2,620) settles the URL question decisively - but it is a URL benchmark, and does not argue against a map in storage.

**The deciding argument is Features':** the reference product's positional-array-everywhere choice is precisely what forced its override channel outside the blob. Do not repeat it. Positional encoding is a wire format, not a data model.

### Contradiction 2 - Where overrides live? COMPLEMENTARY, not competing.

Features says "versioned envelope with a separate overrides channel." Architecture says "content-addressed on conference:step:sortedTeamIds." These answer different questions and both are required:

- Features answers **transport/layout**: overrides are a separate *section* of the payload, never widened into the per-game pick encoding. This is the lesson from `&seedN=`, and it is what makes the v2 CFP bracket a payload addition rather than a format break.
- Architecture answers **identity**: the key within that section is content-addressed on the tie context, so a stale override self-invalidates when picks change the tied set. Pitfall 2 independently demands exactly this - keyed by (season, conference, the exact set of tied team IDs, the step reached), with stale resolutions invalidated rather than silently reapplied.

Do both: a versioned envelope with `picks` and `overrides`, where `overrides` is a record keyed by the content-addressed string. Architecture's note to *keep* unmatched overrides rather than prune them yields a nice emergent behavior - flip a pick away and back and the prior choice revives.

### Contradiction 3 - `ssr: false`: does it moot the hydration concerns? Mostly yes. Adopt it.

Stack recommends `ssr: false` outright. Architecture (Pattern 3, anti-pattern 9) and Pitfalls (Pitfall 9) both describe elaborate hydration guards - a `ready` flag, `initOnMounted`, `<ClientOnly>`. **With `ssr: false` there is no server render and no hydration pass, so that entire class of bug cannot occur.** The `ready` gate and `initOnMounted` become unnecessary. Notably, both Architecture and Pitfalls independently arrive at `ssr: false` as an acceptable escape hatch ("Consider `ssr: false` for the picking routes if the flash proves stubborn" - Pitfalls; "not a cop-out, the honest architecture" - Stack). Nobody argues against it. Every meaningful screen derives from localStorage; prerendered HTML would be replaced immediately on hydration.

**Two caveats that survive `ssr: false` and must not be dropped:**

1. Still confine localStorage access to **exactly one module**. The value there is not hydration safety - it is the versioning, migration, and quota-handling chokepoint from Pitfalls 10 and 11.
2. There is still a **loading frame** while the JSON query resolves. Render "loading schedule/picks", never an empty standings table that reads as a real answer. Pitfalls' point survives the SSR change intact.

Also: Stack's note that the starter's leftover `routeRules` prerender entry should be reviewed applies. And Pitfalls' TanStack SSR-hydration trap (TanStack/query#7338, `shouldDehydrateQuery`) becomes **moot** under `ssr: false` - the plugin reduces to a plain `VueQueryPlugin` install with no dehydrate/hydrate hooks.

### Contradiction 4 - `@vueuse/core` availability? Architecture is correct. Verified.

Stack claims `@vueuse/core@14.3.0` is "already in the lockfile" and therefore effectively free. Architecture claims pnpm's strict linking makes it **not importable from app code** without an explicit `pnpm add`.

**Verified during synthesis:** `@vueuse/core` does **not** appear at the top level of `node_modules`. It exists only under `node_modules/.pnpm/@vueuse+core@14.3.0_...` as a transitive dependency of `@nuxt/ui`. Under pnpm's default strict linking, an app-code import of `@vueuse/core` would fail to resolve.

**Practical answer:** both are partly right, and the practical outcome matches Stack's own install instructions. You *must* run `pnpm add @vueuse/nuxt` - it is not zero-action. What Stack's "free" claim correctly captures is that the *resolution* is free: pnpm dedupes onto the already-resolved 14.3.0 tree, so no new transitive graph. The same caveat applies to `zod@4.4.3` and `valibot@1.4.2` - present in the lockfile, still requiring an explicit `pnpm add -D`.

**Recommendation:** add `@vueuse/nuxt`, but note that under `ssr: false` the `initOnMounted` selling point evaporates, leaving cross-tab `storage`-event sync and serializer plumbing as the remaining value. A ~15-line hand-rolled equivalent inside the single storage module is equally defensible. **Treat as a phase-level decision, not a research conclusion.** Either way it is one module.

### Contradiction 5 (minor) - "one engine, pluggable strategies"

Architecture's Pattern 5 models per-conference variation as a step list plus flags. Pitfalls warns this is insufficient: the ACC's tied-group *definition* is structurally different, and its restart re-derives the tied set. Resolution: keep one engine, but `defineTiedTeams` must be a **conference-pluggable strategy function**, not a shared utility, and `ConferenceRules` needs more than `restartAfterElimination` - it needs a `defineTiedTeams` reference and a round-robin branch selector.

## Scope Corrections to PROJECT.md

These findings amend requirements already committed in PROJECT.md. The roadmapper must not silently carry the original wording forward.

1. **Logo vendoring needs a fallback.** `CFBD/cfb-web` is **archived** (`pushed_at` 2023-08-11); `public/logos/` last commit **2022-09-01**; **453 assets**. FBS grows to **138 teams in 2026** with **North Dakota State and Sacramento State** joining - neither has a logo, nor do Jacksonville State, Sam Houston, Kennesaw State, Delaware, or Missouri State. Since the app fetches *all* FBS games (so P4 non-conference records are right), these teams will appear on screen. **Amend to:** primary source = the CFBD `/teams` endpoint's own `logos` array (current CDN URLs, vendored at fetch time); fallback = `cfb-web`; final fallback = a build-time-generated initials-on-team-color placeholder. The fetch script fails loudly, listing team ids with no asset. Do not hotlink at runtime - already decided, and the archived status is a second, stronger reason.

2. **ACC manual selection is the NORMAL path, not an edge case.** Under the ACC policy amended **2026-07-01**, head-to-head is the **only computable step**. A two-team ACC tie where the teams did not play goes straight to the SportSource Analytics Team Success Ranking, which is uncomputable. PROJECT.md's "tied teams that bottom out at a ranking-based tiebreaker step surface for manual user selection" is correct but understates the frequency by an order of magnitude. The ACC standings view must be *designed around* manual resolution - framed as a decision point quoting the actual rule, never as an error modal.

3. **ACC "tied" is NOT equal win percentage. Any `groupBy(winPct)` is wrong.** The ACC defines Tied Teams as the best-conference-win-pct team(s) **plus** any team that played an alternate number of conference games and has the *same number of conference wins* **or** the *same number of conference losses*. A 7-1 (.875) team and a 7-2 (.778) team are tied if one played eight conference games and the other nine. Not hypothetical: in 2026 the ACC's 17 teams are on a **mixed 8/9-game schedule** - Boston College, Clemson, Florida State, Georgia Tech, and North Carolina play eight. **Data-model consequence:** standings must retain `conferenceWins`, `conferenceLosses`, and `conferenceGamesPlayed` separately and never collapse to a percentage early. Retrofitting this cascades through the data model.

4. **SEC is computable one step shallower than it appears.** SEC step E is *capped relative total scoring margin* - it needs scores, which PROJECT.md explicitly scopes out ("users pick winners, not scores"). The SEC's five-step procedure is effectively a four-step procedure (head-to-head, common opponents, common-opponent-by-finish, cumulative opponent win pct) that then hands off to the user. The SEC's `manualFrom` boundary is `scoring-margin` with reason code `needs-scores`, not `ranking-step`.

## Key Findings

### Recommended Stack

The locked core (Nuxt 4.5.1, Nuxt UI 4.10.0, `@tanstack/vue-query` 5.101.4, TypeScript 6.0.3, Tailwind 4.3.3, pnpm 11.20.0) is untouched by any recommendation. Additions are minimal; every version was read from the npm registry and cross-checked against `pnpm-lock.yaml`.

**Core technologies:**
- `@vueuse/nuxt@^14.4.0` - auto-imported `useStorage` for the single localStorage module. Dedupes onto the already-resolved `@vueuse/core@14.3.0`. *(Optional - see Contradiction 4.)*
- `vitest@^4.1.10` + `@nuxt/test-utils@^4.1.0` + `@vue/test-utils@^2.4.11` + `happy-dom@^20.11.2` - two Vitest projects: a `node` project for the domain layer (milliseconds, no Nuxt boot) and a `nuxt` project for the few component tests. **Vitest 3.x will not satisfy `@nuxt/test-utils@4.1.0`'s peer.**
- `zod@^4.4.3` (devDep) - validate CFBD responses in the fetch script. Already resolved in the lockfile as an optional peer of `@nuxt/ui`.
- `tsx@^4.23.12` - run the standalone TS fetch scripts under Node.
- `cfbd@^5.24.0` (devDep) - the official Hey-API-generated TypeScript client. Script-only, never ships. Keep the Zod parse anyway; CFBD self-describes as "limited Beta."
- `@vitest/coverage-v8@^4.1.10` - add once tiebreaker tests exist; a per-file coverage gate on the tiebreaker directory is cheap insurance.

**Critical version constraints:**
- **Stay on `typescript@^6.0.3`.** Registry latest is 7.0.2, outside `@nuxt/ui@4.10.0`'s declared peer range.
- Nuxt UI brings `@tailwindcss/vite` itself - do **not** add a separate Tailwind Vite/PostCSS plugin. Tailwind 4 is CSS-first `@theme`; there is no `tailwind.config.js`, which invalidates most tutorial content.
- Pin CI Node >= 22 (Vitest 4 needs >= 20; local is 24.12.0).

**Config decisions:** `ssr: false`; `nuxt generate` to `.output/public`; Cloudflare Pages with a `_redirects` SPA fallback and Rocket Loader + Email Obfuscation disabled. Fetch scripts are manual `package.json` scripts, never build hooks - a build hook would put `CFBD_API_KEY` into CI, contradicting the no-runtime-key constraint. **The CFBD free tier is 1,000 calls per calendar month** - cache raw responses to disk on first fetch and re-run the transform offline.

**Non-blocking divergence:** Stack recommends `public/data/2026/*.json` + `$fetch`; Architecture recommends `app/data/*.json` + dynamic `import()`. Both work at ~142KB raw (~15-25KB gzipped) and both isolate the v2 swap to two `queryFn` bodies. Take `public/` if you want the JSON cached independently of the JS chunk hash. Either way: `structuralSharing: false`, `gcTime: Infinity`, `retry: false`.

### Expected Features

The reference product (playoffpredictors.com v2) was reverse-engineered from its shipped Angular bundles - component selectors, `data-testid`s, enum values, and share-URL construction read as literal strings from production code. Two findings define the opportunity: its CFB picker is self-described as *"very early alpha... currently implemented with NFL Tiebreakers"*, and its step-by-step tiebreaker explanations are **paywalled at $2/month**. Correct P4 tiebreakers, explained free and inline, is an unoccupied position.

**Must have (table stakes):**
- One-click pick a winner per game, click-again-to-unpick - a row with two pressable team targets, `aria-pressed`, state signalled by fill *and* an icon or weight change (never color alone)
- Week-first navigation with week chips plus prev/next; picks persist across sessions
- Conference standings (`#`, Team, Conf W-L as primary sort, Overall W-L) recomputing instantly, for SEC / B1G / Big 12 / ACC
- Automatic tiebreaker resolution to a championship matchup, surfaced as a dedicated card above each conference table
- Conference and team filters over the one slate; logos on every pick target
- Clear week / reset all (confirm the destructive one); bulk fill remaining; pick progress indicator
- Named scenarios in localStorage; share link
- **Drop `tie` and `noContest` from the pick enum.** The reference product carries them for NFL/soccer; FBS has no ties, and dead enum values invite bugs through every standings path.

**Should have (differentiators):**
- **Free, inline, step-by-step tiebreaker reasoning** - the market leader's paid feature; requires the engine to emit a trace
- **Rendering the "restarting with the remaining N teams" event** - nearly free given the trace, and it is visible proof of correctness at the exact place implementations fail
- **User resolution at non-computable steps** - the reference product *skips* them; handing the choice to the user is strictly more useful and more honest
- **Named scenarios with no account** - the reference product gates saved scenarios behind login, its largest friction point
- **Share link that never clobbers the visitor's picks** - banner plus "Save a copy"; no observed product handles this collision
- Static per-conference tiebreaker rules page citing official sources; scenario duplicate ("fork this scenario")

**Structural accommodations required in v1 (cheap now, rewrite later):**
- **Pick provenance** (`user` / `auto` / `result`) on every pick. Bulk fill cannot work without it, and v2 live results need `result` picks locked. One extra field now; a data migration later.
- Conference championship games as **pickable game records in the same store** as regular-season games.
- Payload envelope with a separate `overrides` channel (manual tiebreaks in v1, CFP seeds in v2).
- Tiebreaker rulesets as data keyed by (season, conference).

**Defer (v1.x / v2+):** clinched/eliminated indicators (combinatorially expensive; warrants its own research pass if promoted); head-to-head badge in standings; cross-scenario champion summary; G5 standings; 12-team CFP bracket; live results; accounts; compete mode and leaderboards. **Explicit anti-features:** score prediction, tie outcomes, predictive auto-pick from power ratings, side-by-side scenario diff.

### Architecture Approach

Full recompute on every pick. ~1,000 iterations plus four sorts of <=18 elements is sub-millisecond, so there is **no incremental invalidation, no dirty tracking, no per-conference memo keying**. This deletes an entire category of complexity from a codebase whose actual risk is tiebreaker correctness. *(Pitfall 12 argues for per-conference memoization and incremental record updates; Architecture's scale analysis supersedes it - build the simple version. The one guard that matters is keeping the games array out of deep reactivity.)* The real performance risks are Vue-layer: deep reactivity over ~900 game objects (solved with `shallowRef`/`markRaw`) and rendering the full season at once (solved for free by week-first navigation, plus `v-memo` on game rows).

**Major components:**
1. **`shared/domain/`** - `indexTeams`, `deriveRecords`, `computeStandings`, `resolveTiebreakers`, `CONFERENCE_RULES`, `codec`, all behind one entry point `deriveSeason(input): SeasonModel`, reference-memoized on input identity. Pure TypeScript, zero Vue imports - *framework-enforced*, since Nuxt forbids Vue/Nitro/Nuxt-context imports inside `shared/`.
2. **`shared/types/`** - `Team`, `Game`, `PickSet`, `Scenario`, `TiebreakerResult`. Auto-imported; types cannot collide.
3. **Query layer** (`app/utils/queryKeys.ts` plus `useTeams`/`useGames`) - TanStack Query as a **swap seam, not a cache**. The v2 `/api/` switch is two `queryFn` bodies.
4. **`usePicks`** - the *only* mutable state. Frozen `PickSet` in a `shallowRef`, replaced immutably on every write. This is what makes the domain memo work; deep-reactive picks would silently return stale standings. Debounced persist through the one storage module.
5. **`useSeasonModel`** - one `computed` calling `deriveSeason` once. `useStandings(conf)` and `useTiebreakers(conf)` are pure slicing selectors with zero math.
6. **Presentation** - `SlateWeekNav`, `GameList`, `GameCard`, `StandingsPanel`, `TiebreakerTrace`, `TiebreakerResolver`, `ChampionshipCard`, `ScenarioSwitcher`. **Only three components write:** `GameCard` (picks), `TiebreakerResolver` (overrides), `ScenarioSwitcher` (scenario CRUD).

**Two rules worth writing into the roadmap verbatim:**
- *Vue `computed` slices; it never computes.* Any loop over games or any `.sort()` belongs in `shared/domain/`.
- Resolve teams at the **list** level, not the card level - 60 cards x 2 teams would mean 120 query observers just to read static data. `useTeam(id)` stays available for non-hot contexts.

Filter state (week, conference, team) lives in the **route query**, not a store - the back button works, filtered views are linkable, and it stays cleanly separate from the share payload.

### Critical Pitfalls

1. **Multi-team ties are not a single linear pass.** All four conferences restart the procedure from the beginning when a step *partially* separates the group, and continue to the next step when it separates *nothing*. Both branches must exist. Model it as recursion, not a fold over comparators. Assert two invariants: every recursive call receives a strictly smaller group; an eliminated team never re-enters. *Warning sign: the module exports an array of comparators and a `for` loop, with no self-calling function.*

2. **The tiebreaker is not a total function.** All four conferences terminate in a proprietary SportSource Analytics rating plus a draw. Return `Resolved(order) | NeedsUserInput(teams, reason, ruleCitation) | Impossible(reason)` **from the first commit** - never a bare `Team[]`. Reason codes: `ranking-step`, `needs-scores`, `draw`. First uncomputable step by conference: **ACC #2 (ranking)**, **SEC #5 (needs scores)**, Big Ten #6, Big 12 #6. Retrofitting the return type propagates through every consumer *and* the persistence schema.

3. **The ACC's tied group is not `groupBy(winPct)`.** Same wins *or* same losses on an alternate number of conference games qualifies. Implement `defineTiedTeams` as a conference-pluggable strategy; the ACC restart must **re-invoke** it, because the tied set is not stable across iterations.

4. **"Record vs. next highest-placed opponent" is circular unless the base ordering is frozen.** Compute the ordering once from raw conference win percentage, freeze it, and pass it in as an input. Represent it as **buckets** (`Team[][]`) so tied groups are structurally visible; when the walk reaches a tied bucket, compare against the bucket *collectively* rather than recursively resolving it - that is what makes it terminate. Only the Big 12 spells this out; adopt its treatment for the Big Ten and SEC and **record it as a documented assumption**. Separately: "no common opponents" must return an `Indeterminate` sentinel meaning *advance to the next step* - `0/0` is `NaN` and silently poisons every comparison it touches. Ban bare `wins / games` arithmetic in that module and test that no `NaN` escapes.

5. **Head-to-head in a 3+ way tie is a decision tree, not a sort.** With 16-18 team conferences playing 8-9 games, a complete round robin among tied teams is *rare* - the partial-graph case is the common one, and `sortBy(recordAgainstTiedTeams)` handles it wrongly. Needs `isRoundRobinAmong()`, `beatAllOthers()`, `lostToAllOthers()` as named predicates; the ACC can remove a team from **both ends in one step**. The head-to-head submatrix needs **three** states per cell - "did not play" is not "lost."

6. **Unbalanced schedules corrupt comparisons.** Never compare raw records; always percentage. "Cumulative conference winning percentage of all conference opponents" is **record-weighted** - sum all opponents' wins, sum all their losses, then divide. The un-weighted mean of opponent percentages is a different, wrong answer and a classic silent bug. Big 12 step (e) caps FCS wins at one per year.

7. **CFBD data violates the obvious invariants.** FCS opponents are not in `/teams/fbs` (model them as a distinct `OpponentRef` variant); `conferenceGame` must be trusted from CFBD and **never re-derived** from `home.conference === away.conference`, which is wrong for transitioning members and crossover games - exactly the cases that decide championships; conference championship games appear in the feed and, if ingested into standings, create genuine circular corruption (filter `seasonType === 'regular'`); TBD and cancelled games carry null opponent ids. Validate at build time and emit a **committed coverage report** so cross-season drift shows up in a diff.

8. **Team colors fail contrast.** CFB palettes include near-black primaries (Army, Cincinnati, Purdue) and near-white alternates that vanish in one mode or the other. Derive `accentOnLight` and `accentOnDark` **at build time** in OKLCH to clear 4.5:1 for text and 3:1 for UI, emit them as CSS custom properties into Tailwind 4's `@theme`, and commit a contrast report. Confine raw brand color to large decorative areas with no text on top. Never make color the only picked-state signal (WCAG 1.4.1 - and red-vs-red matchups exist).

## Implications for Roadmap

Architecture's build order and Pitfalls' phase mapping agree almost exactly. The one strong claim both make: **the tiebreaker engine is pure functions with no UI dependency and can be built in parallel from the moment the `Game` shape is pinned down.** Given it is simultaneously the highest-risk, highest-test-volume, and highest-recovery-cost item, starting it early rather than last materially de-risks the milestone.

### Phase 1: Data Pipeline
**Rationale:** Every downstream shape is guesswork without real CFBD ids and field values. Architecture ranks it first; Pitfalls notes the tiebreaker fixtures need real 2026 structure.
**Delivers:** `shared/types/*`; `scripts/fetch-season.ts` (CFBD, Zod validate, slim, committed JSON carrying a `scheduleHash`); `scripts/vendor-logos.ts` with the multi-source fallback chain; build-time accessible color token generation; `scripts/verify-data.ts` wired into `build`; a committed coverage report.
**Addresses:** "Fetch the 2026 schedule once, commit as static JSON"; logo vendoring (amended).
**Avoids:** Pitfalls 7 (CFBD edge cases), 8 (archived logo repo), 13 (contrast - token generation belongs here so an unvalidated color is unrenderable).
**Scope corrections applied:** logo fallback chain; retain wins/losses/gamesPlayed separately in the standings-facing shape.

### Phase 2: Foundation and Query Layer
**Rationale:** Small, unblocks all UI, and clears the four framework version traps before any feature code depends on them.
**Delivers:** `nuxt.config` with `ssr: false` (and a review of the starter's leftover `routeRules`); `app/plugins/vue-query.ts` (~15 lines, no community module); the `seasonKeys` factory; `useTeams`/`useGames`/`useTeamIndex`; the two-project Vitest config with the `#shared` alias; `_redirects`; a first deploy.
**Uses:** TanStack Query v5, Vitest 4, `@vueuse/nuxt` (decide here).
**Avoids:** Pitfall 14 - `gcTime: Infinity`, Tailwind 4 `@source` covering `app/`, CSS-first `@theme`, no `tailwind.config.js`.
**Verify:** a production build shows zero post-hydration fetches of the JSON, and Nuxt UI renders styled.

### Phase 3: Read-Only Slate
**Rationale:** First visible app. Shakes out logo, color, and contrast issues before any state or math exists.
**Delivers:** `SlateWeekNav`, `SlateFilters`, `GameList`, `GameCard` (read-only), `TeamBadge`, `useTeamAccent`. Filter state in the route query.
**Addresses:** week-first navigation; conference and team filters; logos on every game.
**Avoids:** anti-pattern 8 - logo URLs built in components. The path is resolved once at fetch time into `Team.logo`.

### Phase 3b (parallel with 3-5): Tiebreaker Engine - pure, test-first
**Rationale:** Zero UI dependency once Phase 1 pins the `Game` shape. Highest risk, highest test volume, highest recovery cost. Both Architecture and Pitfalls independently recommend pulling it forward.
**Delivers:** `shared/domain/tiebreakers/{engine,steps,rules}.ts`; the three-valued return type; `CONFERENCE_RULES` for all four P4 conferences built **from the primary policy documents** (PITFALLS.md's "Conference Tiebreaker Specification Source" section is the specification input - not the secondary summaries); per-conference `defineTiedTeams` strategies; a frozen bucketed base ordering; hand-verified fixtures for 2-, 3-, 4-, and 5-way ties per conference.
**Implements:** Architecture Patterns 5 and 6.
**Avoids:** Pitfalls 1, 2, 3, 4, 5, and 6 - every one cheap to design in and expensive to retrofit.
**Non-negotiable test cases:** a fixture where restart-vs-continue produces *different* champions; the partial-graph head-to-head case (A beat B, B beat C, A never played C) per conference; zero common opponents with no `NaN` escaping; eliminated teams never re-entering; a mixed 8/9-game ACC tie containing a *lower* win-percentage team; the SEC halting at step E rather than skipping to the draw.

### Phase 4: Picks and Persistence
**Rationale:** First end-to-end shippable app - pick a full season and come back to it, with no standings at all. Validates the core interaction before committing to the hard math. Pitfalls insists persistence lands *before* the standings UI so the UI is built against the correct contract.
**Delivers:** `usePicks` (frozen `PickSet` in a `shallowRef`); the single localStorage module with versioned, season-namespaced keys (`cfbp:v1:2026:...`); pick provenance; `QuotaExceededError` handling; a `migrate()` chain plus a legacy-fixture test; corrupt-blob preservation under a `:corrupt` key; the pick interaction on `GameCard`; the progress indicator.
**Addresses:** "pick a winner; picks persist"; pick progress; bulk fill (which needs provenance).
**Avoids:** Pitfalls 10 and 11; Architecture anti-patterns 3 and 9.

### Phase 5: Standings Engine and UI
**Rationale:** Ties must be *visible* before they are *resolved*. Seeing "3 teams tied at 7-1" makes the tiebreaker requirements concrete and catches records-layer bugs before they get blamed on the engine.
**Delivers:** `deriveRecords` (with `beat`/`lostTo` sets), `computeStandings`, `deriveSeason` plus its memo, `useSeasonModel`/`useStandings`, `StandingsPanel`. Ties displayed as ties, unresolved.
**Avoids:** Pitfalls 6 and 12; Architecture anti-patterns 1, 2, and 4.
**UX note:** ACC standings must show conference games played, since 8-vs-9 comparisons otherwise look arbitrary.

### Phase 6: Tiebreaker UI and Championships
**Rationale:** Wires the Phase 3b engine into the UI. Pure presentation, given the trace.
**Delivers:** `TiebreakerTrace` (renders `result.trace` - **zero rule logic**); `TiebreakerResolver` (manual resolution, content-addressed override keys, designed for the ACC as the normal path); `ChampionshipCard`; the static per-conference rules page with source links.
**Addresses:** the two headline differentiators - free inline reasoning including restart events, and user resolution at non-computable steps.
**Avoids:** the UX pitfall of presenting a manual prompt as an error; Architecture anti-patterns 5 and 6.

### Phase 7: Named Scenarios
**Rationale:** Strictly additive; no restructuring above it.
**Delivers:** `useScenarios` - create, switch, rename, duplicate, delete. No login.

### Phase 8: Share Links
**Rationale:** Strictly additive. Depends only on the canonical game ordering and `scheduleHash` established in Phase 1.
**Delivers:** `shared/domain/codec.ts` - a 2-bit positional array to base64url carried in the URL **hash**, never a query param (fragments never reach the server, so CDN request-line limits and access logs do not apply); the versioned envelope with its separate `overrides` channel; round-trip property tests; fingerprint mismatch surfaced as "N of M picks applied" rather than silent misapplication; a "you are viewing a shared scenario / save a copy" banner.
**Security:** the payload is attacker-controlled input - validate it against a schema before applying, reject unknown game ids, and cap decoded size.

### Phase Ordering Rationale

- **Data first**, because every type, fixture, and color token downstream is guesswork otherwise, and because the logo and contrast problems are cheapest to solve at the boundary where they originate.
- **Engine parallel with UI** is the concrete payoff of the isolated `shared/` domain layer, and the reason to insist on that layer at all.
- **Persistence before standings UI**, because the loading contract must be established before views are built against it, and because the encoding decision must be made before the first pick is ever persisted.
- **Standings before tiebreaker UI**, so ties are visible before they are resolved - this separates records bugs from engine bugs.
- **7 and 8 last**, because both are purely additive and are the safe cuts if the milestone tightens.

### Research Flags

Phases likely needing `--research-phase`:
- **Phase 3b (Tiebreaker Engine)** - the specification is *largely* captured (Big Ten, Big 12, and ACC primary PDFs were retrieved verbatim; the SEC's release text is reproduced across independent outlets). But Architecture rated its own step orders **LOW**, and Pitfalls' extract must be re-checked against the primary PDFs at implementation time, since the ACC amended its policy on 2026-07-01 and could do so again. Also unresolved: the Big Ten and SEC do not state the Big 12's collective-bucket rule for "next highest-placed common opponent" - a genuine specification gap that must be adopted as a *documented* assumption, not a silent one.
- **Phase 1 (Data Pipeline)** - the actual CFBD `/games?year=2026` payload was never fetched (no API key during research). The ~122KB figure is a computed estimate. The `/teams` `logos` array fallback needs confirming against a live response, and the 1,000-call monthly free tier means the first fetch should cache raw responses to disk.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Foundation)** - official Nuxt/TanStack/Vitest docs cover it; the traps are enumerated and specific.
- **Phase 4 (Picks and Persistence)** - well understood; the decisions are already made here.
- **Phase 7 (Scenarios)** and **Phase 8 (Share)** - the encoding is measured and settled; the codec is ~40 lines with property tests.
- **Phases 3, 5, and 6 (UI)** - feature research already reverse-engineered the reference product's interaction patterns in detail.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Every version read directly from the npm registry and cross-checked against `pnpm-lock.yaml`; peer ranges verified. The URL-encoding benchmark was measured locally and is reproducible (HIGH). Deploy-host free-tier details are web-sourced (MEDIUM). The `@vueuse/core` "already available" claim was **wrong in its practical implication** - corrected above. |
| Features | HIGH (reference product) / MEDIUM (adjacent) | Derived by mining playoffpredictors v2's shipped Angular bundles - component selectors, `data-testid`s, enum values, and the share-URL construction are literal strings from production code, not inference. Adjacent products and community expectations are cross-checked but secondary. |
| Architecture | MEDIUM-HIGH for mechanics / LOW for tiebreaker content | Nuxt 4 `shared/` semantics, auto-import scan depth, and Vue `shallowRef` guidance are first-party docs (HIGH); installed-version claims were verified by direct `node_modules` inspection and re-verified during synthesis. The document self-rates its conference tiebreaker step orders **LOW** - correctly. TanStack `select` per-instance memoization in Vue is inference from the documented contract and warrants a quick empirical check when building `useTeamIndex`. |
| Pitfalls | HIGH (ACC/B1G/B12) / MEDIUM (SEC, stack) | Three of the four conference procedures were retrieved as the **primary policy documents themselves** and extracted verbatim, then cross-checked against independent reporting. The SEC's primary PDF resisted retrieval; its text is reproduced across ESPN, 247Sports, and PFN. The archived-logo-repo finding was verified through the GitHub API. |

**Overall confidence:** MEDIUM-HIGH. The rule content - the project's stated core risk - is the best-sourced part of the research, which is the right way round.

### Gaps to Address

- **Conference rule step orders must be re-read from primary PDFs at implementation time.** PITFALLS.md's "Conference Tiebreaker Specification Source" section is the specification input; ARCHITECTURE.md's `CONFERENCE_RULES` sketch supplies the *shape* only. Where the two disagree on a step list, **Pitfalls wins** - it quotes the source documents. Handle in the Phase 3b research pass with a hard primary-source requirement.
- **The Big Ten and SEC "next highest-placed common opponent" collective-bucket rule is unstated in their own documents.** Adopt the Big 12's treatment and record it as an explicit assumption in code and in the phase decision log, so a future correction is one line rather than archaeology. Phase 3b.
- **The CFBD payload was never fetched.** Size, field presence, the `/teams` `logos` array, and the FBS/FCS boundary for the 138-team 2026 season are all unverified. Phase 1; cache raw responses on the first fetch (1,000 calls per month).
- **`@vueuse/nuxt` vs a ~15-line hand-rolled storage helper** - a genuine coin flip under `ssr: false`, since `initOnMounted` (the main reason to take the dependency) becomes unnecessary. Decide in Phase 2 or 4; either way it is one module.
- **TanStack Query reference stability across component mounts** with `staleTime`/`gcTime: Infinity` - the domain memo depends on it. If it does not hold, the fallback is a one-line `markRaw` plus module-level capture, not a structural change. Verify empirically in Phase 2.
- **Clinched/eliminated computation cost is unestimated** - likely exhaustive or constraint-based search over remaining games. Deferred to v1.x partly for this reason; warrants its own research pass if promoted.
- **G5 tiebreaker procedures are not uniformly published** (the reference product flags Mountain West as not source-verifiable). Corroborates keeping G5 standings out of v1.
- **`app/data/` + dynamic `import()` vs `public/` + `$fetch`** - Stack and Architecture differ; both isolate the change to two `queryFn` bodies, so this is a Phase 2 coin flip, not a research gap.
- **The reference product's desktop standings columns** could not be confirmed directly (only the mobile shell and the NFL hero mini-table were recoverable). The recommended column set is low-risk inference.

## Sources

### Primary (HIGH confidence)

Conference policy documents, retrieved and extracted verbatim:
- Big Ten Football Championship Game Tiebreaker (PDF, bigten.org) - restart-on-partial-separation, continue-on-no-separation, the unbalanced-schedule clause
- Big 12 Football Tiebreaker Policy (PDF, big12sports.com) - the collective-bucket rule; the FCS win cap
- ACC Football Tiebreaker Policy, as amended July 1, 2026 (PDF, theacc.com) - the Tied Teams definition; restart including redefinition
- ACC Football Tiebreaker Policy, 2023 version (PDF) - superseded, retained to show what changed
- Big Ten 2025 worked tiebreaker scenarios (bigten.org) - shows `Step #3 N/A` for no common opponents

Direct code and artifact inspection:
- `v2.playoffpredictors.com` shipped Angular bundles (`main-VQB5OZFB.js` plus 29 route chunks) - component selectors, `selectionType`/`updateReason` enums, the scenario persistence service, share-URL construction
- npm registry via `npm view` plus local `pnpm-lock.yaml` - all versions, peer ranges, engines
- Local `node` + `zlib` benchmark - the URL-encoding size table (reproducible)
- Direct `node_modules` inspection - installed versions; Pinia and Vitest absent; `@vueuse/core` present only under `.pnpm` (re-verified during synthesis)
- CFBD/cfb-web via the GitHub API - archived, `pushed_at` 2023-08-11, logos last commit 2022-09-01, 453 assets, MIT

Official docs:
- Nuxt 4 - shared/ directory, testing, deployment, hydration best practices, upgrade guide
- TanStack Query v5 - Vue SSR guide, hydration reference, issue #7338 (Nuxt SSG hydrated query cannot be reset)
- Vue performance guide; VueUse `useStorage`; Nuxt UI v4 migration guide
- CFBD API docs, access tiers, terms; CFBD/cfbd-typescript

### Secondary (MEDIUM confidence)
- SEC procedure reproduction - secsports.com announcement, ESPN, 247Sports (full release with the Appendix A worked example), Pro Football Network (multi-team restart clause verbatim), and the 2026 nine-game schedule announcement
- ACC rewrite context - ESPN, CBS Sports (the 2025 five-way tie), SI
- fbschedules.com - 2026 conference realignment
- Adjacent products - nflschedulesimulator.com, sticktothemodel.com, PFN CFP Predictor, ESPN Allstate Playoff Predictor
- Browser and CDN URL length limits; Zod / Valibot / ArkType comparison; Cloudflare Pages Nuxt static deploy and the Rocket Loader hydration issue; web.dev CompressionStream Baseline; APCA easy intro

### Tertiary (LOW confidence - needs validation)
- ARCHITECTURE.md's `CONFERENCE_RULES` step-order sketch - secondary sports media; **superseded by the primary PDFs cited in PITFALLS.md**. Use the shape, not the contents.
- TanStack `select` per-component-instance memoization consequences in Vue - inference from the documented contract; verify empirically.
- CFBD payload size (~122KB) - a computed estimate from a slim schema, not a measured response.

---
*Research completed: 2026-08-12*
*Ready for roadmap: yes*
