---
phase: 02-foundation-read-only-slate
plan: 02
subsystem: infra
tags: [nuxt, nitro, ssr, static-deploy, cloudflare-pages]

# Dependency graph
requires:
  - phase: 02-foundation-read-only-slate (plan 01)
    provides: "app/pages/week/[week].vue — the dynamic route this plan's prerender config targets"
provides:
  - "nuxt.config.ts with ssr:false + nitro.prerender.routes listing all 15 week paths — the app is now a pure static SPA build"
  - "public/_redirects — Cloudflare Pages SPA-fallback rewrite as a backstop for any URL the prerender step didn't explicitly generate"
affects: [02-03-filters, 02-04-week-nav, deploy]

# Actuals (#2632)
actuals:
  tokens: 233
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit nitro.prerender.routes list (not reliance on crawlLinks) for every static-host-reachable dynamic route, verified against actual .output/public build artifacts rather than pnpm dev behavior"

key-files:
  created:
    - public/_redirects
  modified:
    - nuxt.config.ts

key-decisions: []

patterns-established:
  - "Static-build verification checks .output/public build artifacts directly (ls .output/public/week) rather than trusting pnpm dev's client-side router, which masks prerender gaps"

requirements-completed: [FOUND-01, FOUND-03, SLATE-05]

coverage:
  - id: D1
    description: "ssr:false configured at the top level of nuxt.config.ts (CLAUDE.md's locked v1 rendering mode), with no server/ directory or runtime env var read anywhere in the app"
    requirement: "FOUND-01"
    verification:
      - kind: manual_procedural
        ref: "pnpm build exits 0; `[ -d server ]` confirms no server/ directory exists in the repo root after build"
        status: pass
    human_judgment: false
  - id: D2
    description: "nitro.prerender.routes lists all 15 week paths explicitly (/week/1 through /week/15, including empty week 14); pnpm build's Nitro prerenderer log confirms 16 routes prerendered (/ plus all 15 weeks) and .output/public/week/ contains a subdirectory for each of weeks 1-15"
    requirement: "FOUND-03"
    verification:
      - kind: manual_procedural
        ref: "pnpm build && ls .output/public/week — output includes 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"
        status: pass
    human_judgment: false
  - id: D3
    description: "public/_redirects provides the Cloudflare Pages SPA-fallback rewrite (/* /index.html 200), copied verbatim into .output/public/_redirects by the build, as a second layer of defense for SLATE-05's linkable-URL requirement on any route the explicit prerender list doesn't cover"
    requirement: "SLATE-05"
    verification:
      - kind: manual_procedural
        ref: "cat public/_redirects confirms single-line exact content; cat .output/public/_redirects after pnpm build confirms it is copied into the build output unchanged"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-13
status: complete
---

# Phase 2 Plan 2: Static SPA Build Configuration Summary

**`ssr:false` + explicit `nitro.prerender.routes` for all 15 week paths, plus a Cloudflare Pages `_redirects` SPA-fallback backstop — verified against actual `.output/public` build artifacts, not just `pnpm dev` behavior.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `nuxt.config.ts` now declares `ssr: false` at the top level (CLAUDE.md's locked v1 rendering mode) and an explicit `nitro.prerender.routes` array listing all 15 `/week/N` paths individually, including week 14 (zero games, D-15) — this is what makes a fresh browser tab opened directly at any `/week/N` URL resolve on a static host instead of 404ing, closing RESEARCH.md Pitfall 1 / Open Question 1
- `public/_redirects` added with the exact Cloudflare Pages SPA-fallback rewrite (`/* /index.html 200`), confirmed copied verbatim into `.output/public/_redirects` by the production build
- Verified against real build artifacts, not `pnpm dev`: `pnpm build` exits 0, Nitro's prerenderer log shows "Prerendering 16 routes" (`/` plus all 15 weeks) and "Prerendered 16 routes", and `ls .output/public/week` lists directories `1` through `15` with no gaps
- Confirmed no `server/` directory exists anywhere in the repo after the build — the app remains fully static with zero runtime backend surface (FOUND-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure static SPA build (ssr:false, prerender routes)** — `c80f755` (feat)
2. **Task 2: Cloudflare SPA fallback + build-output verification** — `84dec91` (feat)

## Files Created/Modified
- `nuxt.config.ts` - Added `ssr: false` and `nitro.prerender.routes` (all 15 `/week/N` paths); `routeRules`, `modules`, `devtools`, `css`, `compatibilityDate`, `eslint` left unchanged
- `public/_redirects` - New Cloudflare Pages SPA-fallback rewrite, single line: `/* /index.html 200`

## Decisions Made
None — plan executed exactly as written; both tasks matched the RESEARCH.md/PATTERNS.md-recommended shape with no deviation needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The build's `node-server` Nitro preset output (`.output/server/`) alongside the prerendered `.output/public/` is Nuxt's standard SPA-fallback server artifact for `ssr:false` builds — it serves the same empty-shell `spa-template` for any route not in the prerender list and is not a custom API/backend surface; it introduces no `server/` directory in the source repo and no runtime env var read, so it does not violate FOUND-01's no-backend constraint.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness
- The app now builds as a fully static SPA deployable to Cloudflare Pages: all 15 week routes prerender with real static output, and the `_redirects` fallback covers anything the prerender list doesn't (future query-param combinations added by 02-03's `conf`/`team` filters).
- `nitro.prerender.routes`'s hardcoded 15-week list must stay in sync with `app/pages/week/[week].vue`'s valid week range if that range ever changes (currently fixed 1-15 per D-16, 2026 season only, per this plan's `key_links`) — a note for whichever future plan revisits season-parameterization.
- SLATE-05 ("linkable" URLs) is now fully covered at the build-config layer; 02-03/02-04's `conf`/`team`/week-nav query-param work builds on top of routes that are now confirmed to resolve on a real static host.

---
*Phase: 02-foundation-read-only-slate*
*Completed: 2026-08-13*

## Self-Check: PASSED

nuxt.config.ts confirmed to contain `ssr: false` and the 15-entry `nitro.prerender.routes` array (read back after edit); public/_redirects confirmed present with exact single-line content (`cat -A`); both task commits (`c80f755`, `84dec91`) verified present in `git log`; `.output/public/week/` confirmed to contain all 15 week directories via `ls`; `.output/public/_redirects` confirmed present with matching content; no `server/` directory found in repo root.
