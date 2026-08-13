# Phase 1: Data Pipeline - Research

**Researched:** 2026-08-12
**Domain:** One-time/re-runnable build-time data fetch script (CFBD API → committed static JSON + vendored logos)
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fetch script shape**
- D-01: Script lives at `scripts/fetch-data.ts`, run via `tsx`
- D-02: CFBD API key is read from a gitignored `.env` (`CFBD_API_KEY`), not passed as a CLI flag
- D-03: Season is a required CLI argument, no default — e.g. `pnpm fetch-data 2026`. Re-running for 2027 is `pnpm fetch-data 2027`, no code changes
- D-04: Output is two separate files — `public/data/{season}/teams.json` and `public/data/{season}/games.json` — matching the stack doc's separate `['season', N, 'teams']` / `['season', N, 'games']` query-key factory

**Logo sourcing & fallback**
- D-05: A team is "missing a logo" if CFBD `/teams` `logos[]` is empty OR the image fails to download during vendoring (not just an empty-array check — actual download success is verified)
- D-06: Missing-logo teams are listed in the coverage report and rendered with a generic, team-color-agnostic placeholder icon (e.g. a helmet-outline SVG) — not a generated color/initial monogram
- D-07: A missing logo does NOT hard-fail the fetch script — see D-09/D-10 below. The placeholder exists specifically so a run can still succeed and commit when a logo is unavailable

**Coverage report & validation failure**
- D-08: Coverage report format is JSON (not markdown), committed alongside the datasets — structured per-team pass/fail across required fields
- D-09: Missing required non-logo fields (conference, CFBD id, primary color, alternate color) hard-fail the script — nothing is committed if any team is missing one of these
- D-10: Missing logo alone does NOT hard-fail — it's a soft-warn: listed in the coverage report, placeholder icon used, script still exits 0 and commits

**scheduleHash definition**
- D-11: Hash input is the sorted CFBD game-id list only (not team ids) — the hash's purpose is specifically to detect drift in the share-link bitpack index (stable game-id ordering), and team roster/conference changes are orthogonal to that index
- D-12: Algorithm is SHA-256, truncated to a u32, stored as a top-level `scheduleHash` field (hex) in `games.json` — matches the stack doc's share-link header format `[version:u8][season:u16][scheduleHash:u32]`

### Claude's Discretion
- Exact JSON field names/shapes for `teams.json` and `games.json` beyond what's specified (e.g. exact key casing, nested vs. flat color fields) — left to research/planning
- Exact coverage-report JSON schema (field names) beyond "structured pass/fail per team, listing which required fields are missing"
- Placeholder SVG's specific visual design (helmet outline vs. other neutral shield icon) — left to implementation, just must be genuinely team-agnostic (no color that could be mistaken for a real team's palette)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Committed, season-namespaced `teams.json` for all 2026 FBS teams (conference, colors, logo, CFBD id), produced by a one-time fetch script | `getFbsTeams` function + `Team` type confirmed (Standard Stack, Code Examples); recommended `teams.json` shape below |
| DATA-02 | Committed, season-namespaced `games.json` for all 2026 FBS games (teams, week, conference-game flag, neutral-site flag, championship-game flag), produced by the same script | `getGames` function + `Game` type confirmed; recommended `games.json` shape below |
| DATA-03 | Every dataset carries a `scheduleHash` fingerprint | SHA-256→u32 truncation pattern verified via live Node execution (Code Examples) |
| DATA-04 | Team logos vendored into the repo at build time (not hotlinked), sourced from CFBD's own `/teams` logo URLs, with placeholder fallback | Logo CDN pattern + `logos[]` shape researched (Common Pitfalls, Code Examples); native `fetch` for downloads (Don't Hand-Roll) |
| DATA-05 | Build-time validation fails loudly and lists any team missing a logo/color/required field; produces committed coverage report | Zod v4 `safeParse`/error-formatting pattern researched (Code Examples); D-08/D-09/D-10 give exact fail/warn split |
| DATA-06 | `conferenceGame` trusted directly from CFBD, never re-derived | `conferenceGame: boolean` confirmed as a required, non-null field on the `Game` type — pass through verbatim, never recompute (Anti-Patterns) |
| DATA-07 | Non-regular-season games (conference championships) excluded from regular-season standings computation | `seasonType` confirmed as a required, non-null enum field including `'postseason'`; conference championships use `seasonType='postseason'` (Open Questions — not confirmed against a live authenticated response this session) |
</phase_requirements>

## Summary

This phase is a standalone Node/TypeScript build script, not application code — it never ships to the browser. The `cfbd` npm SDK (`^5.24.0`, confirmed current on the npm registry) wraps the CFBD REST API with two functions this phase needs: `getFbsTeams({ query: { year } })` and `getGames({ query: { year, classification: 'fbs' } })`. **The function is `getFbsTeams`, not `getTeamsFbs`** — this is a real naming trap the stack doc doesn't spell out, confirmed directly from the SDK's generated source (`src/sdk.gen.ts` on the `CFBD/cfbd-typescript` GitHub repo, which is the same source npm's published `5.24.0` build compiles from — its `package.json` version field matches npm's `dist-tags.latest` exactly).

Every field on the raw `Team` and `Game` types is nullable except a handful of required ones. Critically, `conferenceGame`, `seasonType`, and `neutralSite` on `Game` are **required, non-nullable** fields — confirmed identically from both the SDK's `types.gen.ts` and the live OpenAPI spec at `api-docs.json`, which agree verbatim. This directly satisfies DATA-06 (`conferenceGame` is a trustworthy boolean straight off the wire, never derived) and gives DATA-07 its mechanism: CFBD's `seasonType` enum is `'regular' | 'postseason' | 'both' | 'allstar' | 'spring_regular' | 'spring_postseason'`, and community documentation (not a live authenticated call — no API key was available this session) indicates conference championship games carry `seasonType='postseason'`. **This specific claim is unverified against a live response and is the single highest-priority thing to confirm at Wave 0 of implementation** — see Open Questions.

Logo vendoring is simpler than it might look: the `logos` field on `Team` is `Array<string> | null` — CFBD returns full, ready-to-fetch URLs (observed pattern: ESPN's CDN, `a.espncdn.com/i/teamlogos/ncaa/500/{id}.png` and a `500-dark/` variant), so the fetch script never constructs a URL itself, it just downloads whatever is in the array (or nothing, if the array is empty/null, triggering the D-05/D-06 placeholder path). No `dotenv` package is needed — this repo's pinned Node (`24.12.0`) has native `process.loadEnvFile()` and `--env-file`, verified by running it locally. No retry/CLI-parsing/HTTP libraries are needed either: two API calls total (well under CFBD's free-tier 1,000 calls/month) plus ~135 logo downloads, one required positional CLI arg, and native `fetch` for both the SDK's underlying HTTP client and logo downloads.

**Primary recommendation:** Build `scripts/fetch-data.ts` around `cfbd`'s generated `getFbsTeams`/`getGames` functions, validate every record with a Zod v4 schema (hard-fail via `process.exit(1)` with a `flattenError`-formatted message on missing core fields per D-09, soft-warn into the coverage report for missing logos per D-10), vendor logos with native `fetch` keyed by CFBD's numeric `team.id` (not school name — avoids path-unsafe filenames), and compute `scheduleHash` as `sha256(sortedGameIds.join(',')).slice(0, 8)` per D-11/D-12. Treat the `seasonType==='postseason'` assumption for conference championships as an explicit Wave-0 checkpoint against a real API response before trusting it in the shipped script.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch teams/games from CFBD | Build-time script (Node/tsx, dev-only) | — | Runs once per season, holds the API key; never runs in the browser or in a server tier (no backend exists in this project) |
| Validate & transform raw API response | Build-time script | — | Zod validation and shape transformation happen before anything is written to disk; downstream tiers only ever see the already-validated slim JSON |
| Vendor/download logo images | Build-time script | CDN/Static (final resting place) | Script performs the download once; the resulting files are served as static assets by whatever static host Phase 8+ deploys to (Cloudflare Pages per CLAUDE.md) |
| Serve `teams.json` / `games.json` / logos to the app | CDN / Static | Browser (fetch via TanStack Query) | Files live under `public/`, get copied verbatim into `.output/public` at `nuxt generate` time — no processing tier in between |
| Coverage report | Build-time script | — | Generated and committed alongside the datasets; consumed by humans/CI, not by the running app |

## Project Constraints (from CLAUDE.md)

These directives from `./.claude/CLAUDE.md` are binding for this phase's implementation:

- Use `cfbd@^5.24.0` as a **devDependency** — the SDK never ships to the browser
- Use `zod@^4.4.3` for validating the CFBD API response before transforming it into the slim output — already resolved in the lockfile as a peer of `@nuxt/ui`, promoting to direct devDependency costs nothing
- Use `tsx@^4.23.12` to run `scripts/fetch-data.ts` — zero-config esbuild-backed TS execution, simpler than `jiti` for a standalone script
- Output goes to `public/data/{season}/teams.json` and `public/data/{season}/games.json` (not `server/assets/`, not direct JS import) — required by the no-backend, static-deploy constraint (FOUND-01) and matches the `['season', N, 'teams']`/`['season', N, 'games']` query-key factory Phase 2 will build
- Logos must be vendored into the repo (`public/logos/`), never hotlinked from `raw.githubusercontent.com` or any live CDN at runtime
- `scheduleHash` must match the share-link header format `[version:u8][season:u16][scheduleHash:u32]` — SHA-256, truncated to u32, stored as hex
- No SportRadar data anywhere in the repo — CFBD only
- pnpm is the package manager; `packageManager` field is already pinned to `11.20.0`
- Stay on `typescript@^6.0.3` — do not let `tsx`/`vitest`/anything else pull TypeScript 7.x transitively, it's outside `@nuxt/ui@4.10.0`'s peer range

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cfbd` | `^5.24.0` | Official CFBD TypeScript client, generated from the CFBD OpenAPI spec | Function-per-operation (`getFbsTeams`, `getGames`), typed responses, saves hand-writing ~30 raw field names. `[VERIFIED: npm registry]` — `npm view cfbd version` → `5.24.0`, matches `dist-tags.latest`, published 2026-08-12 |
| `zod` | `^4.4.3` | Validate CFBD API responses before transforming into slim output; drives D-09's hard-fail behavior | Already resolved in the lockfile as an optional peer of `@nuxt/ui`; adding as a direct devDependency adds nothing new to the graph. `[VERIFIED: npm registry]` — `npm view zod version` → `4.4.3` |
| `tsx` | `^4.23.12` | Run `scripts/fetch-data.ts` under Node without a separate build step | Zero-config esbuild-backed execution; matches D-01. `[VERIFIED: npm registry]` — `npm view tsx version` → `4.23.12`, 82M weekly downloads, package created 2015 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.10` | Test runner for the pure-logic pieces of the fetch script (hash computation, schema validation, coverage report generation) | Add in Wave 0 per Validation Architecture below — no test infra exists yet in this repo. `[VERIFIED: npm registry]` |
| `@vitest/coverage-v8` | `^4.1.10` | Coverage reporting for the validation/hash logic | Optional but cheap; add alongside `vitest` if a coverage gate is wanted. `[VERIFIED: npm registry]` |

**No `dotenv` needed** — Node 24.12.0 (this repo's local/engine version) has native `process.loadEnvFile()` and `--env-file`, confirmed by running `node -e "console.log(typeof process.loadEnvFile)"` → `"function"` on this machine. `[VERIFIED: local Node execution]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cfbd` SDK | Plain `fetch` + hand-written Zod schema against the raw REST endpoints | Only worth it if the generated client's types fight you — two endpoints is not worth an afternoon (CLAUDE.md's own verdict) |
| Native `process.loadEnvFile()` | `dotenv` package | Only needed if the script must also run under a Node version without native `.env` support; this repo pins Node via `engines`/CI to 22+/24, so native support is available |
| Hand-rolled positional-arg parsing (`process.argv[2]`) | `commander`/`yargs` | One required positional argument (season) has no flags/subcommands to justify a CLI-parsing dependency |

**Installation:**
```bash
pnpm add -D cfbd zod tsx vitest @vitest/coverage-v8
```

**Version verification:** All four core/supporting packages confirmed via `npm view <pkg> version` against the live npm registry on 2026-08-12 (see Package Legitimacy Audit below for full signals). `zod` and `tsx` are already referenced at these exact versions in `./.claude/CLAUDE.md`'s existing stack research — this research re-confirms they are still current, not stale.

## Package Legitimacy Audit

| Package | Registry | Age | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-------------------|--------------|---------|-------------|
| `cfbd` | npm | Created 2024-08-22 (~2 yrs); latest version published 2026-08-12 | 1,316 | `github.com/CFBD/cfbd-typescript` | `[SUS]` (heuristic: "too-new" on latest-version publish date) | Approved with checkpoint — see note below |
| `zod` | npm | Long-established; latest version published 2026-05-04 | 254,388,559 | `github.com/colinhacks/zod` | `[OK]` | Approved |
| `tsx` | npm | Created 2015-08-20 (~10 yrs); latest version published 2026-08-10 | 82,007,387 | `github.com/privatenumber/tsx` | `[SUS]` (heuristic: "too-new" on latest-version publish date) | Approved with checkpoint — see note below |
| `vitest` | npm | Long-established; latest version published 2026-07-06 | 89,744,366 | `github.com/vitest-dev/vitest` | `[OK]` | Approved |
| `@vitest/coverage-v8` | npm | Long-established; latest version published 2026-07-06 | 34,009,446 | `github.com/vitest-dev/vitest` | `[OK]` | Approved |

**Packages removed due to `[SLOP]` verdict:** none

**Packages flagged as suspicious `[SUS]`:** `cfbd`, `tsx` — both flagged purely by the legitimacy checker's "too-new" heuristic, which reads the **latest published version's** timestamp, not the package's actual creation date. `npm view <pkg> time.created` shows `cfbd` was first published 2024-08-22 and `tsx` was first published 2015-08-20 — both are established packages with active release cadences (an auto-generated API SDK that ships a new version whenever CFBD's OpenAPI spec changes, and a 10-year-old, 82M-weekly-download dev tool respectively). This reads as a false positive of the "too-new" signal rather than a genuine slopsquatting risk, but per protocol the planner must still insert a `checkpoint:human-verify` task before either package is installed, so a human confirms `github.com/CFBD/cfbd-typescript` and `github.com/privatenumber/tsx` are the intended repos before `pnpm add` runs.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  scripts/fetch-data.ts   (tsx, dev-only, run manually: pnpm fetch-data 2026)  │
│                                                                       │
│  1. process.loadEnvFile('.env')  → CFBD_API_KEY                     │
│  2. process.argv[2]              → season (required, no default)    │
│  3. client.setConfig({ headers: { Authorization: `Bearer ${key}` }})│
│         │                                                            │
│         ▼                                                            │
│  4. getFbsTeams({ query: { year: season } })  ──► raw Team[]        │
│  5. getGames({ query: { year: season, classification: 'fbs' } })    │
│                                                    ──► raw Game[]     │
│         │                                                            │
│         ▼                                                            │
│  6. Zod validate + transform each record                            │
│         │                                                            │
│         ├─► missing conference/id/color/alternateColor?             │
│         │      └─► HARD FAIL (D-09): print zod errors, exit 1,      │
│         │           nothing written                                 │
│         │                                                            │
│         ▼ (all teams pass required-field check)                     │
│  7. For each team: download logos[0] (and [1] if present)           │
│         │                                                            │
│         ├─► logos[] empty OR download fails                         │
│         │      └─► SOFT WARN (D-10): use placeholder path,          │
│         │           record in coverage report, continue             │
│         │                                                            │
│         ▼                                                            │
│  8. Compute scheduleHash = sha256(sorted game ids).slice(0,8)        │
│         │                                                            │
│         ▼                                                            │
│  9. Write public/data/{season}/teams.json                           │
│     Write public/data/{season}/games.json  (includes scheduleHash)  │
│     Write public/data/{season}/coverage.json                        │
│     Write public/logos/{teamId}.png (vendored, one-time)            │
│         │                                                            │
│         ▼                                                            │
│  10. exit 0 (even with soft-warns present)                          │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼  (committed to git; consumed starting Phase 2)
┌─────────────────────────────────────────────────────────────────────┐
│  Static hosting (Cloudflare Pages, .output/public/)                 │
│  public/data/{season}/teams.json  ──► useTeams() (TanStack Query)   │
│  public/data/{season}/games.json  ──► useGames() (TanStack Query)   │
│  public/logos/{teamId}.png        ──► <img> in slate/standings UI   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
scripts/
├── fetch-data.ts           # entrypoint: orchestrates fetch → validate → download → write
├── lib/
│   ├── schemas.ts          # zod schemas: RawTeamSchema, RawGameSchema, output TeamSchema/GameSchema
│   ├── coverage.ts         # buildCoverageReport(teams) — pure function, easy to unit test
│   └── schedule-hash.ts    # computeScheduleHash(gameIds) — pure function, easy to unit test
public/
├── data/
│   └── {season}/
│       ├── teams.json
│       ├── games.json
│       └── coverage.json
└── logos/
    ├── placeholder.svg     # D-06 generic helmet-outline icon, hand-authored once
    └── {teamId}.png        # vendored per-team logos, NOT season-namespaced (school logos don't change per-season)
tests/
├── schedule-hash.test.ts
├── schemas.test.ts
├── coverage.test.ts
└── fixtures/
    ├── cfbd-teams-sample.json   # hand-authored fixture matching verified Team type shape
    └── cfbd-games-sample.json   # hand-authored fixture matching verified Game type shape
```

**Why logos are not season-namespaced:** `public/data/{season}/` holds the schedule/roster snapshot for that specific season (D-04 requirement), but a school's logo doesn't change year to year in any way this app cares about. Keying logo files by CFBD's stable numeric `team.id` under a single `public/logos/` directory avoids re-downloading and re-committing ~135 unchanged PNGs every season re-run.

### Pattern 1: Hard-fail vs. soft-warn validation split
**What:** Two separate validation passes over the same team record — one for D-09's required fields (conference, id, color, alternateColor), one for D-05/D-10's logo presence.
**When to use:** Any time a dataset has some fields that make the whole record unusable (must hard-fail) and others that have an acceptable degraded fallback (must soft-warn).
**Example:**
```typescript
// scripts/lib/schemas.ts
import { z } from 'zod'

// Required-field schema — failing this hard-fails the whole script (D-09)
const RequiredTeamFieldsSchema = z.object({
  id: z.number(),
  school: z.string(),
  conference: z.string(),        // CFBD returns string | null — reject null here
  color: z.string(),
  alternateColor: z.string()
})

export function validateRequiredFields(rawTeams: unknown[]) {
  const failures: { team: unknown, error: z.ZodError }[] = []
  for (const raw of rawTeams) {
    const result = RequiredTeamFieldsSchema.safeParse(raw)
    if (!result.success) failures.push({ team: raw, error: result.error })
  }
  return failures
}
```

### Pattern 2: Logo download with actual-success verification (D-05)
**What:** "Missing logo" is defined by download outcome, not just array-emptiness.
**When to use:** Whenever a required-looking field is actually a URL that could 404/timeout independently of whether the API returned it.
**Example:**
```typescript
// scripts/fetch-data.ts (excerpt)
async function vendorLogo(teamId: number, logoUrl: string | undefined): Promise<
  { status: 'ok', path: string } | { status: 'missing' | 'download-failed' }
> {
  if (!logoUrl) return { status: 'missing' }
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return { status: 'download-failed' }
    const buf = Buffer.from(await res.arrayBuffer())
    const path = `public/logos/${teamId}.png`
    await writeFile(path, buf)
    return { status: 'ok', path: `/logos/${teamId}.png` }
  } catch {
    return { status: 'download-failed' }
  }
}
```

### Anti-Patterns to Avoid
- **Re-deriving `conferenceGame` by comparing `homeConference`/`awayConference`:** DATA-06 explicitly forbids this. CFBD's `conferenceGame` boolean is authoritative because it accounts for cases a naive comparison misses (e.g., a team's conference at game time vs. its current listed conference after realignment). Pass the raw value straight through the Zod schema unchanged.
- **Filtering "regular season" by absence of a bowl/CFP-sounding `notes` string:** Use `seasonType === 'regular'` directly (once confirmed live — see Open Questions), not string-matching on free-text fields.
- **Constructing logo URLs from a team ID and a guessed CDN pattern:** Always use the URL(s) CFBD actually returns in `logos[]`. The ESPN CDN pattern observed during research is informational only — do not hand-build it as a fallback if `logos[]` is empty; that's exactly the case D-06's placeholder exists for.
- **Building a naive "conference matches → conference game" heuristic anywhere downstream (Phase 5+ standings):** the trustworthy `conferenceGame` flag from this phase's `games.json` should be the only source of truth propagated forward.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API response shape validation | Manual `if (typeof x.conference !== 'string') throw ...` chains | `zod` `.safeParse()` + `.transform()` | Composable, gives structured errors for D-09's hard-fail messaging via `z.flattenError()`/`z.prettifyError()`, and the output `.transform()` produces the slim shape in one pass |
| `.env` file loading | `dotenv` package | `process.loadEnvFile('.env')` (native, Node 20.6+/22+) | Verified present and functional on this repo's Node 24.12.0; zero added dependency |
| SHA-256 hashing | Hand-rolled hash function | Node's built-in `node:crypto` `createHash('sha256')` | Verified correct truncation-to-u32 pattern via live execution (see Code Examples) |
| Logo image downloads | `node-fetch`/`axios` | Native `fetch` (global since Node 18) | Zero dependency; already used for the SDK's own HTTP calls under the hood |
| CLI argument parsing | `commander`/`yargs` | `process.argv[2]` directly | Exactly one required positional argument, no flags/subcommands — a parsing library is unjustified overhead here |

**Key insight:** This phase's entire dependency surface should be the three packages CLAUDE.md already named (`cfbd`, `zod`, `tsx`) plus a test runner. Every other "helper" (env loading, hashing, HTTP fetch, arg parsing) is already covered by Node's own standard library on this project's pinned Node version — resist the urge to add anything else.

## Common Pitfalls

### Pitfall 1: Calling a function named `getTeamsFbs` (it doesn't exist)
**What goes wrong:** The intuitive/AI-suggested name mirrors the URL path (`/teams/fbs`) as `getTeamsFbs`, but the actual generated export is `getFbsTeams`.
**Why it happens:** The SDK's code generator names functions from the OpenAPI `operationId`, not literally from the URL path segments.
**How to avoid:** Import and call `getFbsTeams` exactly as confirmed from `src/sdk.gen.ts` in this research. Double-check with `grep -r "export const get" node_modules/cfbd/dist` after installing, before writing the call site.
**Warning signs:** A TypeScript "no exported member" error at the import line.

### Pitfall 2: Trusting `classification: 'fbs'` on `getGames` to mean "both teams are FBS"
**What goes wrong:** It's unconfirmed this session whether the `classification` query param on `/games` filters to games where *both* teams match, or *at least one* team matches (which would let FBS-vs-FCS games through with an FCS opponent needing separate handling).
**Why it happens:** No live API key was available to make an authenticated call and inspect actual filtered results.
**How to avoid:** At Wave 0 of implementation, run the script once against the real API and manually inspect whether any returned game has a non-FBS `homeClassification`/`awayClassification`. If so, add an explicit post-filter.
**Warning signs:** `games.json` containing a team `id` that doesn't appear in `teams.json` (an FCS opponent CFBD didn't include in the FBS teams list).

### Pitfall 3: Sorting game IDs as strings, not numbers, before hashing
**What goes wrong:** `["401628355", "401628301"].sort()` sorts lexicographically, not numerically, silently producing a different (wrong) order than `[401628355, 401628301].sort((a,b) => a - b)` — and the scheduleHash's entire purpose (detecting bitpack-index drift) depends on this order being the *same* stable order the share-link encoder uses.
**Why it happens:** JS's default `Array.prototype.sort()` is lexicographic; CFBD game IDs are large numbers that don't sort correctly as strings.
**How to avoid:** Always sort with an explicit numeric comparator: `gameIds.sort((a, b) => a - b)` before joining for the hash input, and use the exact same sort for the share-link bitpack index in later phases.
**Warning signs:** A share link phase (Phase 8) that produces subtly wrong game-index mappings despite the hash matching.

### Pitfall 4: Treating every `Team`/`Game` field as non-nullable because TypeScript's generated types don't always show `| null`
**What goes wrong:** Most fields on `Team` (`mascot`, `abbreviation`, `conference`, `division`, `classification`, `color`, `alternateColor`) and several on `Game` are typed `string | null` / `number | null` in the actual generated SDK — treating them as guaranteed strings will produce a runtime crash or a silent `undefined` leak into `teams.json`.
**Why it happens:** Nullable unions are easy to skim past when reading a large generated type file.
**How to avoid:** Let the Zod schema be the single source of truth for nullability — write `z.string().nullable()` (or `.min(1)` + reject `null` for the D-09 required-field set) matching the confirmed shapes in this research, not hand-typed assumptions.
**Warning signs:** `TypeError: Cannot read properties of null` during the transform step, or a committed `teams.json` containing literal `"null"` strings.

### Pitfall 5: Re-downloading and re-committing all ~135 logos on every re-run
**What goes wrong:** Running `pnpm fetch-data 2027` a year from now re-downloads every logo even though school logos rarely change, bloating the git history with binary diffs.
**Why it happens:** No skip-if-exists check before downloading.
**How to avoid:** Before downloading, check whether `public/logos/{teamId}.png` already exists on disk; skip the download (but still record it as `status: 'ok'` in the coverage report) unless a `--force` flag is passed. This is a reasonable v1 optimization, not a hard requirement — flag it as a nice-to-have for the planner.
**Warning signs:** Every yearly re-run producing a multi-megabyte diff of unchanged PNGs.

## Code Examples

### Auth setup and fetching (verified from `CFBD/cfbd-typescript` source, cross-checked against live `api-docs.json`)
```typescript
// scripts/fetch-data.ts
import { client, getFbsTeams, getGames } from 'cfbd'

process.loadEnvFile('.env') // native Node 20.6+/22+, no dotenv needed

const apiKey = process.env.CFBD_API_KEY
if (!apiKey) {
  console.error('CFBD_API_KEY not set in .env')
  process.exit(1)
}

client.setConfig({
  headers: { Authorization: `Bearer ${apiKey}` }
})

const season = Number(process.argv[2])
if (!Number.isInteger(season)) {
  console.error('Usage: pnpm fetch-data <season>')
  process.exit(1)
}

const { data: rawTeams } = await getFbsTeams({ query: { year: season } })
const { data: rawGames } = await getGames({ query: { year: season, classification: 'fbs' } })
```

### scheduleHash computation (VERIFIED by running on this project's Node 24.12.0)
```typescript
// scripts/lib/schedule-hash.ts
import { createHash } from 'node:crypto'

export function computeScheduleHash(gameIds: number[]): string {
  const sorted = [...gameIds].sort((a, b) => a - b) // numeric sort, per D-11
  const input = sorted.join(',')
  return createHash('sha256').update(input).digest('hex').slice(0, 8) // u32, per D-12
}
```
Verified output for `[401628355, 401628301, 401628288]` → sorted → hashed → `"ffe3f098"` (8 hex chars = 4 bytes = u32), confirmed via direct `node -e` execution in this environment.

### Zod schema with required-vs-nullable split (D-09/D-10)
```typescript
// scripts/lib/schemas.ts
import { z } from 'zod'

export const RawTeamSchema = z.object({
  id: z.number(),
  school: z.string(),
  mascot: z.string().nullable(),
  abbreviation: z.string().nullable(),
  conference: z.string().nullable(),
  classification: z.string().nullable(),
  color: z.string().nullable(),
  alternateColor: z.string().nullable(),
  logos: z.array(z.string()).nullable()
})

// Narrower schema for the D-09 hard-fail check — same shape, non-null on required fields
export const RequiredTeamFieldsSchema = RawTeamSchema.extend({
  conference: z.string(),
  color: z.string(),
  alternateColor: z.string()
})

export function reportRequiredFieldFailures(raw: unknown[]) {
  return raw
    .map(t => ({ raw: t, result: RequiredTeamFieldsSchema.safeParse(t) }))
    .filter(({ result }) => !result.success)
    .map(({ raw, result }) => ({
      teamId: (raw as { id?: number }).id,
      errors: z.flattenError(result.error!).fieldErrors
    }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| CFBD API v1 (`/api/*` paths) | CFBD API v2 (`api.collegefootballdata.com`, TSOA/Express/Postgres-backed) | v2 reached general availability per CFBD's own blog | The `cfbd` npm SDK targets v2; no reason to reference any v1 endpoint docs |
| `dotenv` for `.env` loading | Native `process.loadEnvFile()` / `--env-file` | Node 20.6 (`--env-file`), Node 21.7/22 (`process.loadEnvFile`) | Removes a dependency this project doesn't need, given its pinned Node 24.x |

**Deprecated/outdated:**
- Legacy Swagger UI for CFBD docs: the CFBD repo notes a newer Zudoku-based docs site is now preferred, though the legacy Swagger UI reportedly remains available during a transition — don't be surprised if bookmarked old doc URLs redirect or 404.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Conference championship games carry `seasonType === 'postseason'` (combined with `conferenceGame === true`) | Summary, Anti-Patterns, Code Examples, DATA-07 support | If wrong, `games.json` would still carry the correct raw `seasonType`/`conferenceGame` values (those fields are confirmed authoritative regardless), but any *filtering logic* written in this phase's script or documented for Phase 5 based on this assumption would need correcting. Low risk to this phase's actual output (which just passes the field through); higher risk if the planner writes downstream filtering logic assuming this without re-verifying |
| A2 | `getGames({ query: { classification: 'fbs' } })` filters such that every returned game is safe to treat as "FBS schedule" without a post-filter | Common Pitfalls #2 | If the filter is looser than expected (e.g., includes FBS-vs-FCS games), `games.json` could reference a team `id` absent from `teams.json`, breaking any downstream join. Recommend a Wave-0 checkpoint task to verify against a real response |
| A3 | CFBD team logos are consistently served from `a.espncdn.com/i/teamlogos/ncaa/500/{id}.png` (and a `-dark` variant) | Summary, Common Pitfalls, Recommended Project Structure | Low risk — this pattern is informational context only; the actual implementation must always use whatever URL(s) `logos[]` contains verbatim, never construct URLs itself. If the pattern is wrong, it changes nothing about the implementation |
| A4 | CFBD's generated client (`client.setConfig`) does not require an explicit `baseUrl` — it defaults from the OpenAPI spec's server URL | Code Examples | If wrong, all API calls fail with a connection error immediately at Wave 0 smoke-test — cheap to detect and fix (add `baseUrl: 'https://api.collegefootballdata.com'` to `setConfig`) |
| A5 | CFBD free-tier rate limit (1,000 calls/month) and no documented pagination on `/teams`/`/games` — sourced from web search, not the official docs page directly | Standard Stack, Don't Hand-Roll | Low risk regardless — this phase makes exactly 2 API calls total, so even a much stricter limit wouldn't be hit |

**If this table is empty:** N/A — see entries above. All are flagged specifically because no `CFBD_API_KEY` was available in this environment to make a live, authenticated call and settle them definitively.

## Open Questions

1. **Does `seasonType === 'postseason'` reliably identify conference championship games (vs. bowl games, CFP games, etc.), and is `conferenceGame === true` the correct additional filter to isolate just the championship game from other postseason conference matchups?**
   - What we know: `seasonType` and `conferenceGame` are both confirmed required, non-nullable fields on the `Game` type, sourced identically from two independent official sources (SDK source + live OpenAPI spec)
   - What's unclear: Whether `seasonType='postseason'` is *only* applied to bowl/CFP/championship games, or whether conference championship games might actually carry `seasonType='regular'` with some other distinguishing marker (e.g., a specific `week` number, or text in `notes`)
   - Recommendation: First implementation task (or a checkpoint before the fetch script is considered "done") should run the script against the real 2026 season data and manually inspect 2-3 known conference championship games (e.g. search returned games for `week` values in the mid-to-high teens with `conferenceGame: true`) to confirm the actual `seasonType` value CFBD assigns them. DATA-07's exclusion logic in Phase 5 depends on getting this right, and this phase is where the ground truth should be established and documented (e.g. as a comment in `schemas.ts` or the coverage report)

2. **Does the `getGames` `classification: 'fbs'` filter admit FBS-vs-FCS games (where one team isn't in `teams.json`)?**
   - What we know: The query param exists and accepts `DivisionClassification` (`'fbs'|'fcs'|'ii'|'iii'`)
   - What's unclear: Whether it filters "both teams" or "either team" — unconfirmed without a live call
   - Recommendation: Wave-0 checkpoint task — after the first real fetch, verify every game's `homeId`/`awayId` appears in the corresponding `teams.json`; if not, decide whether to keep the FCS opponent as an "external" team stub or exclude the game (recommend: keep the game since these results still affect FBS conference members' overall records referenced in standings display, but this needs a product decision, not just a technical one — flag for the planner to raise if it surfaces)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Running `tsx`, native `fetch`, native `.env` loading | ✓ | 24.12.0 | — |
| pnpm | Package management, running `pnpm fetch-data` | ✓ | 11.20.0 | — |
| `CFBD_API_KEY` (in `.env`) | Actually executing the fetch script against the live API | ✗ (not present in this research environment) | — | None — this is a genuine execution-time requirement per D-02; the user must obtain a free CFBD API key and create `.env` before the script can be run for real. Does not block planning or writing the script itself |
| Network access to `api.collegefootballdata.com` and the logo CDN | Fetch script execution | Not tested this session (no key to test with) | — | None — required at execution time |
| git | Committing output per phase goal | ✓ | (repo already initialized) | — |

**Missing dependencies with no fallback:**
- `CFBD_API_KEY` — must be obtained and placed in `.env` before the fetch script can be run for real. This is expected/by-design per D-02, not a research gap; the planner should include an explicit human task ("obtain a free CFBD API key from collegefootballdata.com and place it in `.env`") before the script can be executed end-to-end.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (not yet installed — see Wave 0 Gaps) |
| Config file | none yet — needs `vitest.config.ts` with a plain `node`-environment project scoped to `scripts/**` and `tests/**` |
| Quick run command | `pnpm vitest run tests/schedule-hash.test.ts tests/schemas.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DATA-01 | Transformed team record matches the documented `teams.json` shape given a valid raw fixture | unit | `pnpm vitest run tests/schemas.test.ts -t "team transform"` | ❌ Wave 0 |
| DATA-02 | Transformed game record matches the documented `games.json` shape given a valid raw fixture | unit | `pnpm vitest run tests/schemas.test.ts -t "game transform"` | ❌ Wave 0 |
| DATA-03 | `computeScheduleHash` is deterministic, correctly numeric-sorts input, and produces exactly 8 hex chars (u32) | unit | `pnpm vitest run tests/schedule-hash.test.ts` | ❌ Wave 0 |
| DATA-04 | `vendorLogo` correctly classifies empty-array, download-failure, and success cases (mocked `fetch`) | unit | `pnpm vitest run tests/coverage.test.ts -t "vendorLogo"` | ❌ Wave 0 |
| DATA-05 | A fixture team missing `conference` causes `reportRequiredFieldFailures` to flag it; the script's main path exits non-zero on any such failure | unit + manual-only (process.exit behavior) | `pnpm vitest run tests/schemas.test.ts -t "required field failures"` | ❌ Wave 0 |
| DATA-06 | Transform never overwrites/recomputes `conferenceGame` — output value equals raw input value across a range of fixture inputs | unit | `pnpm vitest run tests/schemas.test.ts -t "conferenceGame passthrough"` | ❌ Wave 0 |
| DATA-07 | `games.json` output includes the raw `seasonType` value verbatim (no filtering/mutation at this phase — exclusion is Phase 5's job) | unit | `pnpm vitest run tests/schemas.test.ts -t "seasonType passthrough"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/schedule-hash.test.ts tests/schemas.test.ts`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`; additionally, the fetch script must be run at least once end-to-end against the real API (human-provided key) and the resulting `teams.json`/`games.json`/`coverage.json` manually spot-checked before this phase is considered complete — no fixture-only test suite substitutes for that, since DATA-01/02's actual success criterion is "the real dataset is committed"

### Wave 0 Gaps
- [ ] `pnpm add -D vitest @vitest/coverage-v8` — no test framework installed yet
- [ ] `vitest.config.ts` — single `node`-environment project covering `scripts/**`/`tests/**` (no `@nuxt/test-utils` needed this phase — pure Node logic only)
- [ ] `tests/fixtures/cfbd-teams-sample.json`, `tests/fixtures/cfbd-games-sample.json` — hand-authored fixtures matching the verified `Team`/`Game` type shapes in this research (no live API key was available to capture real recorded payloads)
- [ ] `tests/schedule-hash.test.ts`, `tests/schemas.test.ts`, `tests/coverage.test.ts` — new test files, none exist yet

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | This is a dev-only script with no end-user auth surface |
| V3 Session Management | No | N/A — no sessions |
| V4 Access Control | No | N/A — no multi-user access model |
| V5 Input Validation | Yes | Zod v4 `safeParse`/`.transform()` against every CFBD API response before it is trusted or written to disk |
| V6 Cryptography | Partial | SHA-256 truncation here is a **fingerprint**, not a security control (no confidentiality/integrity guarantee is claimed) — use Node's `node:crypto`, never hand-roll a hash function, but this is not treated as a cryptographic secret-protection requirement |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| `CFBD_API_KEY` committed to git or logged in error output | Information Disclosure | `.env` is already gitignored (confirmed); never `console.log`/interpolate the raw key into any error message or the committed coverage report |
| Malicious/compromised API response feeding an unexpected internal/file URL into the logo downloader (SSRF-adjacent, build-time) | Tampering / SSRF | Before downloading, validate each `logos[]` URL uses `https:` scheme and a reasonable expected host allowlist (e.g., known CDN domains observed in this research) as defense-in-depth, even though CFBD's API is a trusted first-party source in this design |
| Path traversal via a crafted school name or logo filename | Tampering | Vendored logo filenames are derived from CFBD's numeric `team.id`, never from `school`/`mascot` strings — this is already the recommended pattern in Recommended Project Structure and closes this class of issue by construction |
| Supply-chain risk from newly-flagged devDependencies (`cfbd`, `tsx`) | Tampering | Addressed via the Package Legitimacy Audit above — both flagged `[SUS]` by the "too-new" heuristic but confirmed as long-established, high-download packages from their canonical GitHub orgs; planner must still add a `checkpoint:human-verify` before install per protocol |

## Sources

### Primary (HIGH confidence)
- `npm view cfbd version` / `npm view zod version` / `npm view tsx version` / `npm view vitest version` — direct npm registry queries, 2026-08-12
- `node -e "..."` direct execution on this project's pinned Node 24.12.0 — verified `process.loadEnvFile` exists and verified the SHA-256→u32 truncation code sample produces correct output
- `gsd-tools query package-legitimacy check` — legitimacy signals for `cfbd`, `zod`, `tsx`, `vitest`, `@vitest/coverage-v8`

### Secondary (MEDIUM confidence)
- `raw.githubusercontent.com/CFBD/cfbd-typescript/main/src/sdk.gen.ts`, `src/types.gen.ts`, `package.json` — read directly via WebFetch; `package.json` version (`5.24.0`) matches npm's `dist-tags.latest` exactly, giving confidence these source reads reflect the currently-published package
- `api.collegefootballdata.com/api-docs.json` (live OpenAPI spec) — cross-checked the `Team`/`Game` schema and `SeasonType` enum against the SDK source read above; both agree verbatim on all fields checked

### Tertiary (LOW confidence — flagged in Assumptions Log)
- WebSearch results on: conference championship games' `seasonType` value, CFBD rate limits, and the ESPN CDN logo URL pattern — none of these were confirmed against an authenticated live API response (no `CFBD_API_KEY` available this session)
- All `research-store put` entries this session were tagged `LOW` confidence by the `classify-confidence` seam (generic `webfetch`/`websearch` provider, not a specialized MCP fetcher) — the tool-assigned tier is respected in this document's tagging even where the underlying source (e.g. the official GitHub org's own generated source file) would otherwise read as more authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all four package versions independently confirmed against the live npm registry, matches CLAUDE.md's existing research exactly
- Architecture (SDK function names, type shapes, field nullability): MEDIUM — cross-verified across two independent official sources (SDK source + live OpenAPI spec) that agree verbatim, but the automated confidence classifier caps generic webfetch reads at LOW; treated as MEDIUM in this document's judgment given the cross-source agreement, with residual risk called out explicitly in Assumptions Log
- Pitfalls: MEDIUM — grounded in the same verified type shapes; the two most consequential pitfalls (seasonType semantics, classification filter behavior) are explicitly flagged as unconfirmed and routed to Open Questions / Wave 0 checkpoints rather than asserted as fact
- Security/Validation architecture: MEDIUM — standard, well-established patterns (Zod validation, Vitest unit tests, secret hygiene) applied to a low-attack-surface build script; no novel threat modeling was needed

**Research date:** 2026-08-12
**Valid until:** 2026-09-11 (30 days — CFBD's API is generally stable, but this phase specifically flags unverified assumptions that should be re-checked against a live authenticated call at implementation time regardless of this date)
