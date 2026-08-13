# Phase 1: Data Pipeline - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A committed, versioned dataset of the 2026 FBS season (teams, games, logos, colors) that every later phase builds on without re-verifying it. Delivered via a one-time (re-runnable) fetch script that hits CFBD, vendors logos into the repo, and produces `teams.json` + `games.json` with a `scheduleHash` fingerprint and a coverage report. No UI in this phase.

</domain>

<decisions>
## Implementation Decisions

### Fetch script shape
- **D-01:** Script lives at `scripts/fetch-data.ts`, run via `tsx` (per the stack doc's `tsx` recommendation)
- **D-02:** CFBD API key is read from a gitignored `.env` (`CFBD_API_KEY`), not passed as a CLI flag
- **D-03:** Season is a required CLI argument, no default — e.g. `pnpm fetch-data 2026`. Re-running for 2027 is `pnpm fetch-data 2027`, no code changes
- **D-04:** Output is two separate files — `public/data/{season}/teams.json` and `public/data/{season}/games.json` — matching the stack doc's separate `['season', N, 'teams']` / `['season', N, 'games']` query-key factory

### Logo sourcing & fallback
- **D-05:** A team is "missing a logo" if CFBD `/teams` `logos[]` is empty OR the image fails to download during vendoring (not just an empty-array check — actual download success is verified)
- **D-06:** Missing-logo teams are listed in the coverage report and rendered with a generic, team-color-agnostic placeholder icon (e.g. a helmet-outline SVG) — not a generated color/initial monogram
- **D-07:** A missing logo does NOT hard-fail the fetch script — see D-09/D-10 below. The placeholder exists specifically so a run can still succeed and commit when a logo is unavailable

### Coverage report & validation failure
- **D-08:** Coverage report format is JSON (not markdown), committed alongside the datasets — structured per-team pass/fail across required fields
- **D-09:** Missing required non-logo fields (conference, CFBD id, primary color, alternate color) hard-fail the script — nothing is committed if any team is missing one of these
- **D-10:** Missing logo alone does NOT hard-fail — it's a soft-warn: listed in the coverage report, placeholder icon used, script still exits 0 and commits

### scheduleHash definition
- **D-11:** Hash input is the sorted CFBD game-id list only (not team ids) — the hash's purpose is specifically to detect drift in the share-link bitpack index (stable game-id ordering), and team roster/conference changes are orthogonal to that index
- **D-12:** Algorithm is SHA-256, truncated to a u32, stored as a top-level `scheduleHash` field (hex) in `games.json` — matches the stack doc's share-link header format `[version:u8][season:u16][scheduleHash:u32]`

### Claude's Discretion
- Exact JSON field names/shapes for `teams.json` and `games.json` beyond what's specified (e.g. exact key casing, nested vs. flat color fields) — left to research/planning
- Exact coverage-report JSON schema (field names) beyond "structured pass/fail per team, listing which required fields are missing"
- Placeholder SVG's specific visual design (helmet outline vs. other neutral shield icon) — left to implementation, just must be genuinely team-agnostic (no color that could be mistaken for a real team's palette)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints & decisions
- `.planning/PROJECT.md` — Core value, v1 requirements, constraints (static-only, localStorage, CFBD/no-SportRadar, DRY), Key Decisions table
- `.planning/REQUIREMENTS.md` §Data Pipeline (DATA) — DATA-01 through DATA-07, the locked requirements for this phase
- `.claude/CLAUDE.md` — Full stack decision doc: CFBD SDK verdict, static JSON vs. import, scheduleHash/bitpack header design (`[version:u8][season:u16][scheduleHash:u32]`), zod validation approach, `public/data/{season}/` convention

### Roadmap
- `.planning/ROADMAP.md` §Phase 1: Data Pipeline — goal and success criteria for this phase

### External data sources
- CFBD API (`/games`, `/teams/fbs`) — https://collegefootballdata.com — schedule and team metadata source
- CFBD/cfb-web GitHub repo — logo source, filenames keyed by CFBD team id (referenced in PROJECT.md, not yet vendored/pinned to a specific commit — note this for research)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — repo is the stock Nuxt 4 + Nuxt UI 4 starter with no app code. This phase has no UI dependency; it's a standalone build-time script.

### Established Patterns
- No existing conventions in the repo to follow yet. `cfbd@^5.24.0`, `zod@^4.4.3`, and `tsx@^4.23.12` are the stack doc's recommended devDependencies for this script — not yet installed, must be added as part of implementation.

### Integration Points
- Output (`public/data/{season}/teams.json`, `games.json`) is consumed starting in Phase 2 via a TanStack Query composable (`useTeams`, `useGames`) — this phase only needs to produce files at that path with a stable, documented shape.

</code_context>

<specifics>
## Specific Ideas

No specific UI/visual requirements — this is a data/infra phase. Key specifics captured above: separate JSON files, JSON coverage report, u32-truncated SHA-256 scheduleHash over sorted game ids, hard-fail on missing core fields but soft-warn+placeholder on missing logos.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Data Pipeline*
*Context gathered: 2026-08-12*
