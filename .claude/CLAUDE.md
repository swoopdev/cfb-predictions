<!-- GSD:project-start source:PROJECT.md -->

## Project

**CFB Predictions**

A college football season predictor. Users pick the winner of every FBS game on the 2026 schedule and watch conference standings recompute live, with each power conference's published tiebreaker procedure resolving who plays in the conference championship game. Picks live entirely in the browser — users can keep multiple named scenarios side by side, come back to them later, and share one via a link.

Modeled on what [playoffpredictors.com](https://v2.playoffpredictors.com/football/cfb/) does, scoped for v1 to the regular season and conference championships rather than the Playoff bracket.

**Core Value:** Pick a game, and every downstream consequence — records, conference standings, tiebreakers, championship game matchups — updates correctly and instantly.

If the standings math or the tiebreaker resolution is wrong, nothing else about the app matters.

### Constraints

- **Tech stack**: Nuxt 4, Nuxt UI 4, TanStack Query (vue-query) v5, TypeScript, Tailwind 4 — already scaffolded and chosen by the user
- **Package manager**: pnpm — lockfile and `packageManager` field already committed
- **No backend**: fully static deploy. No runtime API key, no server routes in v1
- **Persistence**: localStorage only. Storage keys namespaced by season
- **Data licensing**: CFBD data and logos only — no SportRadar content in the repo
- **Design**: neutral shell (surfaces, typography), team color used sparingly as accents on picked winners and standings. Contrast must hold up — many team colors fail against light or dark surfaces at small sizes
- **DRY**: team lookup, standings computation, and tiebreaker logic each have exactly one implementation, consumed through composables

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## LOCKED CORE — Not Up For Debate

| Technology | Installed | Registry Latest | Status |
|------------|-----------|-----------------|--------|
| Nuxt | `^4.5.1` | 4.5.2 | LOCKED |
| Nuxt UI | `^4.10.0` | 4.10.0 | LOCKED |
| TanStack Query (vue-query) | `^5.101.4` | 5.101.4 | LOCKED |
| TypeScript | `^6.0.3` | 7.0.2 | LOCKED — **stay on 6.x**, see Version Compatibility |
| Tailwind CSS | `^4.3.3` | 4.3.3 | LOCKED (pulled in by Nuxt UI too) |
| pnpm | `11.20.0` | — | LOCKED |

## Recommended Stack

### Core Additions

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@vueuse/nuxt` | `^14.4.0` | Auto-imported `useStorage` for localStorage persistence | **`@vueuse/core@14.3.0` is already in the lockfile** as a direct dependency of `@nuxt/ui@4.10.0`. Adding the Nuxt module costs one thin wrapper (`@nuxt/kit` + `local-pkg`) and zero new transitive resolution. `useStorage` has the exact SSR escape hatch this app needs (`initOnMounted`), cross-tab sync via `listenToStorageChanges`, and a pluggable `serializer`. Confidence: **MEDIUM** (docs-verified), version **registry-verified**. |
| `vitest` | `^4.1.10` | Test runner for standings + tiebreaker logic | Required peer of `@nuxt/test-utils@4.1.0` (`vitest: ^4.0.2`). Node engine `^20 \|\| ^22 \|\| >=24`; local Node is 24.12.0. ✅ |
| `@nuxt/test-utils` | `^4.1.0` | `defineVitestProject` for the (few) component tests | Official. Only needed for the `nuxt`-environment project; pure logic tests do **not** use it. |
| `@vue/test-utils` | `^2.4.11` | Component mounting | Peer of `@nuxt/test-utils` (`^2.4.2`). |
| `happy-dom` | `^20.11.2` | DOM for component tests | Peer range `>=20.0.11`. Faster than jsdom; jsdom (`^30.0.1`, peer `>=27.4.0`) is the alternative if you hit an API gap. |
| `zod` | `^4.4.3` | Validate CFBD API responses in the fetch script | **Already resolved at 4.4.3 in the lockfile** as an optional peer of `@nuxt/ui` (UForm validation). Promoting it to a direct devDependency adds *nothing* to the dependency graph. It's dev-only (build script), so its bundle size is irrelevant — which neutralizes Valibot's only real advantage. Confidence: **MEDIUM**. |
| `tsx` | `^4.23.12` | Run the TS fetch script under Node | Zero-config esbuild-backed TS execution. Simpler than `jiti` for a standalone `scripts/*.ts` that never touches Nuxt's runtime. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cfbd` | `^5.24.0` | Official CFBD TypeScript client | Use it in the one-time fetch script. See "CFBD SDK verdict" below. |
| `@tanstack/vue-query-devtools` | `^6.1.38` | Query inspector | Optional, dev-only. Peer is `@tanstack/vue-query: ^5.101.4` — despite the v6 major, it targets vue-query v5. Marginal value when `staleTime: Infinity` and two queries total. **Skip for v1.** |
| `@vitest/coverage-v8` | `^4.1.10` | Coverage for tiebreaker logic | Add once tiebreaker tests exist. Given PROJECT.md calls tiebreakers "the real risk", a coverage gate on `shared/utils/tiebreakers*` is cheap insurance. |

### What You Explicitly Do NOT Need

| Not needed | Why |
|------------|-----|
| `pinia` + `@pinia/nuxt` + `pinia-plugin-persistedstate` | See "Persistence" below — three packages to replace one already-present composable. |
| `lz-string` | Bitpacking makes it strictly worse. See "URL encoding" — measured. |
| Any vue-query Nuxt module | `@hebilicious/vue-query-nuxt@0.3.0` and `nuxt-vue-query@0.0.10` were both **last published in 2023**. Unmaintained through two Nuxt majors. Write a ~15-line Nuxt plugin instead. |
| `valibot` / `arktype` | Zod v4 is already resolved. No marginal cost, largest ecosystem. |
| `@nuxt/content` | Suggested by generic "large JSON in Nuxt" advice, but it needs a SQL-backed runtime — incompatible with the no-backend constraint. |

## Decisions, By Question

### 1. localStorage persistence → **VueUse `useStorage`, wrapped in one composable**

- **TanStack Query owns immutable, fetched data** — `games.json`, `teams.json`. `staleTime: Infinity`, `gcTime: Infinity`. Never mutated.
- **`useStorage` owns mutable user picks.** Picks are *not* server state; they have no fetch, no staleness, no invalidation. Putting them in the query cache (via `setQueryData` + a persister) is a known anti-pattern — you'd be fighting structural sharing and cache GC for no benefit.
- **Standings/tiebreakers are `computed()` over both.** A pure function `computeStandings(games, teams, picks)` in `shared/utils/`, called from a `computed` that reads `query.data.value` and `picks.value`. That's the whole integration surface, and it keeps the DRY constraint from PROJECT.md.

### 2. URL-encoded share links → **bitpack to base64url. No library.**

| Approach | Bytes | URL chars | Under 2,000? |
|----------|-------|-----------|--------------|
| **Bitpack (2 bits/game) → base64url** | **200** | **268** | ✅ comfortably |
| deflate-raw(JSON) → base64url | 1,963 | 2,620 | ❌ |
| gzip(JSON) → base64url | 1,984 | 2,648 | ❌ |
| Raw JSON map, `encodeURIComponent` | — | 23,201 | ❌ catastrophically |
| Layer | Limit | Notes |
|-------|-------|-------|
| Chrome address bar | ~2,048 | Programmatic navigation handles ~32,767 |
| Firefox | ~65,536 | Address bar stops displaying past this |
| Safari / Opera | ~8,000 | The tightest mainstream browser |
| HTTP request line (servers/CDNs) | 8,192 bytes typical; some CDNs cap at 4,096 | **Usually the real ceiling** — exceeding it yields `414 URI Too Long` |
| Chat/SMS/social clients | Varies, often truncates or line-wraps | The realistic failure mode for a *share* link |

- **Stable index:** sort the committed games by CFBD `id` ascending. Bit position `2i` is game `i`. Since `games.json` is committed and immutable, the index is stable by construction.
- **Header bytes:** `[version:u8][season:u16][scheduleHash:u32]` before the pick bits. `scheduleHash` is a short hash of the sorted id list, written by the fetch script into `games.json`. A link generated against a re-fetched schedule then fails loudly instead of silently applying picks to the wrong games — this matters, because CFBD schedules do get corrected.
- **Manual tiebreaker overrides:** these need to ride along too (a user's manual pick at a ranking-based step is part of the scenario). Append a short TLV section after the pick bitfield rather than widening every game to 3 bits.
- **base64url:** `+`→`-`, `/`→`_`, strip `=`. Avoids percent-encoding entirely, which is what turned 14.7k JSON chars into 23.2k above.
- **Carry it in the hash, not the query:** `#s=<code>`. Fragments are never sent to the server, so CDN request-line limits don't apply at all, and it can't leak into access logs.

### 3. Static data fetching + build-time scripts

| Approach | Verdict |
|----------|---------|
| **`public/data/2026/games.json` + `$fetch`** | ✅ **Recommended.** Copied unprocessed into `.output/public`. Stays out of the JS bundle, gets its own HTTP cache entry, and slots into a TanStack Query `queryFn` with no ceremony — which is precisely the seam PROJECT.md wants preserved for the v2 `/api/` swap. |
| Direct `import games from '~/data/games.json'` | ⚠️ Works at this size but inlines the JSON into a JS chunk, forcing re-download on every deploy even when the data is unchanged. Nuxt's own performance docs warn against importing large JSON. |
| `server/assets/` | ❌ Requires a Nitro server at runtime. Unavailable on a static deploy. Non-starter. |

- ~153 bytes/game × 800 games ≈ **122 KB** `games.json`
- ~135 teams × ~150 bytes ≈ **20 KB** `teams.json`
- **~142 KB raw, ~15–25 KB gzipped over the wire.** Genuinely small. Either approach *works*; `public/` is simply better-behaved.

### 4. Schema validation → **Zod v4**

| | Bundle (tree-shaken) | Relevance here |
|---|---|---|
| Valibot 1.4.2 | ~1.37 kB | **Irrelevant** — the script runs in Node, never ships |
| Zod 4.4.3 (Mini) | ~3.94 kB | **Irrelevant** for the same reason |
| ArkType 2.2.3 | ~39.8 kB | Irrelevant; also the smallest ecosystem |

### 5. Testing → **Vitest projects; pure logic in a plain `node` project**

### 6. Static deployment → **Cloudflare Pages**

| Target | Verdict |
|--------|---------|
| **Cloudflare Pages** | ✅ **Recommended.** Best free tier for a pure static asset bundle (unlimited bandwidth, unlimited requests), excellent global edge, no cold starts, and the ~150 KB of committed JSON + ~135 logo PNGs are exactly the workload it's cheapest at. Official Nuxt deploy guide exists. |
| Netlify | ✅ Fine. Simplest DX. Free-tier bandwidth cap (100 GB/mo) is the only differentiator, and you won't hit it. |
| Vercel | ✅ Fine, but its value is SSR/ISR — none of which this app uses. You'd be paying complexity for unused features. |
| GitHub Pages | ⚠️ Works, but requires `app.baseURL: '/cfb-predictions/'` unless you use a custom domain or a `<user>.github.io` repo. That base-URL rewrite is the #1 cause of "blank page, missing assets" in Nuxt static deploys. Also no `_redirects`-style SPA fallback — you must rely on `404.html`. Choose only if you specifically want repo-adjacent hosting. |

## CFBD SDK Verdict → **Use `cfbd@^5.24.0` in the script**

- It never ships to the browser. It's a devDependency, so its weight and the auto-generated API's occasional awkwardness cost you nothing at runtime.
- Generated types over the full CFBD response mean you don't hand-write ~40 fields to discover which ones exist. You write the *slim output* types by hand and let the SDK type the input.
- Function-per-operation exports (`getGames`, `getFbsTeams`) with `client.setConfig({ headers: { Authorization: 'Bearer ...' } })` — a small, legible surface.
- Being generated from the OpenAPI spec, it's regenerated when CFBD changes, which is more reliable than remembering the endpoint shape a year later when you re-run for 2027.

## Installation

# Supporting runtime (auto-imports for useStorage)

# Dev: testing

# Dev: build-time data fetch script

# Optional, later

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| VueUse `useStorage` | Pinia + `pinia-plugin-persistedstate@4.7.1` | If v2 grows several interdependent stores (CFP bracket state, user prefs, comparison mode) and you want Pinia devtools time-travel. Revisit at the v2 boundary, not now. |
| Bitpack → base64url | `lz-string` `compressToEncodedURIComponent` | Only if the payload becomes genuinely heterogeneous text. Even then, prefer native `CompressionStream`. |
| Bitpack → base64url | Native `CompressionStream('deflate-raw')` | If v2 adds per-game scores/seeds and the packed payload crosses ~1,500 chars. Baseline-available since May 2023, no dependency. |
| `public/` + `$fetch` | Direct JSON import | If you later want compile-time constant-folding of the schedule, or the data shrinks below ~20 KB. |
| Zod v4 | Valibot 1.4.2 | Only if a schema ever needs to ship to the browser (e.g. runtime validation of a pasted share code — though a hand-written check is better there). |
| Zod v4 | ArkType 2.2.3 | If you want a type-native DSL and 3–4× faster parse. Both are irrelevant for a script that runs once a year. |
| Cloudflare Pages | Netlify | If you want the simplest possible drag-and-drop DX and don't care about bandwidth caps. |
| Cloudflare Pages | GitHub Pages | If repo-adjacent hosting is a hard preference — budget time for the `baseURL` fix. |
| `cfbd` SDK | Plain `$fetch` + Zod | If the generated client fights you. Two endpoints; not worth an afternoon. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@hebilicious/vue-query-nuxt` (0.3.0), `nuxt-vue-query` (0.0.10) | Both last published **2023**. Unmaintained across two Nuxt majors. | A ~15-line `app/plugins/vue-query.ts` calling `VueQueryPlugin` with your `QueryClient` defaults. |
| `lz-string` (1.5.0) | Last modified **2023-03-07**. And measurably worse than bitpacking here: 2,620 chars vs 268. | Bitpack to base64url. |
| `@tanstack/query-persist-client` + `createSyncStoragePersister` | Persists *fetched* data (already committed static JSON) and does nothing for picks. Wrong tool, wrong layer. | `useStorage` for picks; `staleTime: Infinity` for the schedule. |
| Storing picks via `queryClient.setQueryData` | Picks are client state, not server state. Fights structural sharing and cache GC for zero benefit. | `useStorage` ref + `computed` derivations. |
| `server/assets/` for the schedule JSON | Requires a Nitro server; incompatible with the no-backend constraint. | `public/data/<season>/`. |
| `@nuxt/content` for the schedule | Needs a SQL-backed runtime. Generic advice that doesn't survive the static constraint. | `public/` JSON. |
| **TypeScript 7.0.2** | Registry latest, but `@nuxt/ui@4.10.0` declares `typescript: ^5.6.3 \|\| ^6.0.0`. TS 7 is **outside** that peer range. | Stay on `typescript@^6.0.3` (currently installed) until Nuxt UI widens the range. |
| Hotlinking `raw.githubusercontent.com` for logos | Rate-limited, no cache headers, fragile. (Already rejected in PROJECT.md — restating so it doesn't creep back.) | Vendor into `public/logos/` via script; commit. |
| Encoding picks as query params (`?picks=...`) | Query strings hit CDN/proxy request-line limits (4–8 KB) and land in access logs. | URL fragment: `#s=<code>`. Never sent to the server. |

## Stack Patterns by Variant

- `ssr: false` + `nuxt generate`
- `useStorage` needs no `initOnMounted` guard (no server render exists)
- No Nitro, no server routes, no API key anywhere in CI
- Deploy: Cloudflare Pages, `.output/public`
- Flip to `ssr: true` + prerendering, or add a Nitro `/api/results` route
- **Now** `initOnMounted: true` on every `useStorage` call becomes mandatory
- Query-key factory (`['season', 2026, 'games']`) already absorbs the change — the `queryFn` swaps from `$fetch('/data/2026/games.json')` to `$fetch('/api/season/2026/games')` and no call site moves. This is exactly the seam PROJECT.md was protecting.
- Deployment target changes from static to Cloudflare Workers / Netlify Functions
- Add native `CompressionStream('deflate-raw')` around the packed bytes
- Still no library
- Split per conference into `shared/utils/tiebreakers/{sec,bigten,big12,acc}.ts` behind one dispatcher
- Add `@vitest/coverage-v8` with a per-file threshold on that directory

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@nuxt/ui@4.10.0` | `typescript ^5.6.3 \|\| ^6.0.0` | ⚠️ **TypeScript 7.0.2 (registry latest) is out of range.** Do not upgrade. Repo's `^6.0.3` is correct. |
| `@nuxt/ui@4.10.0` | `zod ^3.24.0 \|\| ^4.0.0` (optional peer) | Zod 4.4.3 already resolved. ✅ |
| `@nuxt/ui@4.10.0` | `@vueuse/core ^14.3.0` (direct dep) | `@vueuse/nuxt@14.4.0` dedupes cleanly. ✅ |
| `@nuxt/ui@4.10.0` | `tailwindcss ^4.0.0` | Already `^4.3.3`. Nuxt UI brings `@tailwindcss/vite` itself — **do not add a separate Tailwind Vite/PostCSS plugin.** |
| `@nuxt/test-utils@4.1.0` | `vitest ^4.0.2` | Vitest 4.1.10 ✅. **Vitest 3.x will not satisfy this peer.** |
| `@nuxt/test-utils@4.1.0` | `@vue/test-utils ^2.4.2`, `happy-dom >=20.0.11`, `jsdom >=27.4.0` | 2.4.11 / 20.11.2 / 30.0.1 ✅ |
| `vitest@4.1.10` | Node `^20 \|\| ^22 \|\| >=24` | Local Node 24.12.0 ✅. Pin CI Node ≥ 22. |
| `@vueuse/nuxt@14.4.0` | `nuxt ^3 \|\| ^4 \|\| ^5`, `vue ^3.5.0` | Nuxt 4.5.x ✅ |
| `@tanstack/vue-query-devtools@6.1.38` | `@tanstack/vue-query ^5.101.4` | Major version numbers diverge; the v6 devtools targets vue-query **v5**. Not a mismatch. |
| `cfbd@5.24.0` | Node 18+, `@hey-api/client-fetch ^0.6.0` | devDependency only. ✅ |

## Sources

- npm registry via `npm view` — versions, `dist-tags`, `peerDependencies`, `peerDependenciesMeta`, `dependencies`, `engines`, `time.modified` for all packages listed above
- Local `pnpm-lock.yaml` + `pnpm why zod`, `pnpm why valibot` — confirmed `@vueuse/core@14.3.0`, `zod@4.4.3`, `valibot@1.4.2` already resolved via `@nuxt/ui@4.10.0`
- Local `node` + `zlib` benchmark — the URL-encoding size table (reproducible)
- https://nuxt.com/docs/4.x/getting-started/testing — Vitest `projects` config, unit-vs-nuxt split — MEDIUM
- https://nuxt.com/docs/4.x/getting-started/deployment — `nuxt generate`, `.output/public`, `200.html`/`404.html` fallbacks, `_payload.json` — MEDIUM
- https://nuxt.com/docs/4.x/directory-structure/shared — `shared/utils`, `shared/types` auto-import scope, `#shared` alias — MEDIUM
- https://vueuse.org/core/useStorage/ — `initOnMounted`, `mergeDefaults`, `serializer`, `listenToStorageChanges` (VueUse 14.4.0) — MEDIUM
- https://github.com/CFBD/cfbd-typescript — official TS client, Hey API generated, auth pattern — MEDIUM
- https://web.dev/blog/compressionstreams — Compression Streams Baseline since May 2023 — MEDIUM
- Nuxt/VueUse SSR localStorage hydration patterns — https://github.com/nuxt/nuxt/discussions/25500, https://github.com/nuxt/nuxt/discussions/27793, https://nuxt.com/docs/3.x/guide/best-practices/hydration — MEDIUM
- Browser/server URL length limits — https://www.riffanalytics.ai/blog/url-length-limit, https://urlencodedecode.com/blog/url-length-limits-by-browser.html — MEDIUM
- Zod v4 / Valibot / ArkType comparison — https://www.pkgpulse.com/guides/zod-v4-vs-arktype-vs-typebox-vs-valibot-2026, https://dev.to/gabrielanhaia/zod-4-vs-valibot-vs-arktype-a-type-system-teardown-4lha — MEDIUM
- Cloudflare Pages Nuxt static deploy, Rocket Loader hydration issue — https://nuxt.com/deploy/cloudflare, https://t-salad.com/en/deploying-a-nuxt-static-site-to-cloudflare-pages-a-complete-guide/ — MEDIUM
- Actual CFBD `/games?year=2026` payload size — no API key available during research. The ~122 KB figure is a computed estimate from a slim schema, not a measured response. Verify during the fetch-script phase.
- `cfbd@5.24.0` ESM/tree-shaking story — package metadata shows only `main: dist/index.js` + `types`, no `exports` map. Irrelevant for dev-only use, but note it if it's ever pulled into the app bundle.
- Cloudflare Pages free-tier file-count and per-file size limits not re-verified for 2026.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
