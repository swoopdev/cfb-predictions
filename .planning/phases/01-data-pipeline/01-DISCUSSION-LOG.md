# Phase 1: Data Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 1-Data Pipeline
**Areas discussed:** Fetch script shape, Logo sourcing & fallback, Coverage report & validation failure, scheduleHash definition

---

## Fetch script shape

| Option | Description | Selected |
|--------|-------------|----------|
| scripts/fetch-data.ts + .env | tsx-run script, reads CFBD_API_KEY from gitignored .env | ✓ |
| scripts/fetch-data.ts + CLI flag | Same location, API key passed as --key flag each run | |

**User's choice:** scripts/fetch-data.ts + .env (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Required CLI arg | pnpm fetch-data 2026 — explicit every run | ✓ |
| Defaults to current year, overridable | pnpm fetch-data (defaults 2026) or --season 2027 | |

**User's choice:** Required CLI arg (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate files | public/data/2026/teams.json and games.json | ✓ |
| Single combined file | public/data/2026/season.json | |

**User's choice:** Separate files (recommended)

---

## Logo sourcing & fallback

| Option | Description | Selected |
|--------|-------------|----------|
| CFBD logos[] empty or unreachable | Flag if array empty OR download fails during vendoring | ✓ |
| Only flag if array is empty | Trust URL if present, don't verify download | |

**User's choice:** CFBD /teams logos[] empty or unreachable (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Generic team-color-agnostic icon | Single neutral SVG (helmet outline) for every missing-logo team | ✓ |
| Team-initial monogram | Generated colored circle with team initials | |

**User's choice:** Generic team-color-agnostic icon (recommended)

---

## Coverage report & validation failure

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown table | Human-readable, diffable coverage-report.md | |
| JSON | Structured pass/fail per team, coverage-report.json | ✓ |

**User's choice:** JSON

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail on required fields, soft-warn on logo | Missing core fields fail script; missing logo just warns | |
| Hard-fail on anything missing | Any missing field of any kind fails the whole run | ✓ (clarified below) |
| Never hard-fail | Always list gaps, script always exits 0 | |

**User's choice:** Hard-fail on anything missing

**Follow-up clarification:** Asked whether "hard-fail on anything missing" included logos (which would make the placeholder icon dead code since the script would never commit with a missing logo).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, logo failures hard-fail too | Placeholder exists for runtime edge cases only; script never commits with a missing logo | |
| No, only non-logo fields hard-fail | Missing conference/id/colors fails; missing logo soft-warns and uses placeholder, run still succeeds | ✓ |

**User's choice:** No, only non-logo fields hard-fail
**Notes:** This reconciles the "hard-fail on anything missing" answer with the earlier logo-placeholder decision — final rule is D-09/D-10 in CONTEXT.md.

---

## scheduleHash definition

| Option | Description | Selected |
|--------|-------------|----------|
| Sorted game IDs only | Matches bitpack share-link index design; team changes don't affect it | ✓ |
| Sorted game IDs + team IDs | Broader invalidation, also busts on team dataset changes | |

**User's choice:** Sorted game IDs only (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| SHA-256 truncated to u32, top-level field | Matches stack doc's [version:u8][season:u16][scheduleHash:u32] header | ✓ |
| Full SHA-256 hex string | Simpler, but needs truncation again at encode time anyway | |

**User's choice:** SHA-256 truncated to u32, top-level field (recommended)

---

## Claude's Discretion

- Exact JSON field names/shapes for teams.json and games.json beyond what's specified
- Exact coverage-report.json schema field names
- Placeholder SVG's specific visual design (must remain team-color-agnostic)

## Deferred Ideas

None — discussion stayed within phase scope.
