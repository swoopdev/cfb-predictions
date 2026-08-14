# Roadmap: CFB Predictions

## Overview

The app is built in the order the data flows: a trustworthy, versioned 2026 dataset first (nothing else can be more than guesswork without it), then the static shell that can browse it, then the two hardest and most independent pieces of domain logic — picking/persistence and conference tiebreakers — built so the highest-risk one (tiebreakers) can proceed in parallel with everything else. Standings surface the ties tiebreakers will resolve; tiebreaker UI wires the two together into the app's actual differentiator (free, step-by-step tiebreaker reasoning). Scenarios and share links are purely additive on top of a working single-scenario app, and are the safe cuts if the milestone needs to tighten.

This roadmap adapts research/SUMMARY.md's proposed 8-phase breakdown rather than adopting it verbatim: Foundation (query layer, static-site config) is folded into the Read-Only Slate phase, since on its own it has no user-observable behavior and MVP mode calls for vertical, end-to-end slices wherever possible. The Tiebreaker Engine remains its own phase — a deliberate exception to "vertical slice," because it is pure domain logic with no UI dependency, the project's single highest-risk component, and buildable the moment Phase 1 pins down the `Game`/`Team` shape. It can run in parallel with Phases 2, 4, and 5.

Requirement count note: REQUIREMENTS.md's own "Coverage" line said 42; a direct count of `- [ ] **XXX-NN**' entries in the file totals **43**. This roadmap maps all 43 and the correction is reflected in REQUIREMENTS.md's traceability section.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

**Parallel track:** Phase 3 (Tiebreaker Engine) depends only on Phase 1 and has no UI dependency. It can be built in parallel with Phases 2, 4, and 5, then wired into the UI in Phase 6.

- [x] **Phase 1: Data Pipeline** - Committed, validated 2026 FBS teams/games dataset with vendored logos and a schedule fingerprint (completed 2026-08-13)
- [ ] **Phase 2: Foundation & Read-Only Slate** - Static Nuxt shell with a typed query layer; users can browse the season week by week, filtered by conference or team
- [x] **Phase 3: Tiebreaker Engine** *(parallel with 2, 4, 5)* - Pure-logic engine that resolves each P4 conference's championship participants (or surfaces the tie) per its published rules (completed 2026-08-14)
- [ ] **Phase 4: Picks & Persistence** - Users can pick winners for the full season; picks persist, bulk-fill, and recover from corruption
- [ ] **Phase 5: Standings Engine & UI** - Live conference standings recomputed from picks, with ties visibly flagged
- [ ] **Phase 6: Tiebreaker UI & Championships** - Championship matchups and step-by-step tiebreaker reasoning, wired into standings; manual resolution for non-computable ties
- [ ] **Phase 7: Named Scenarios** - Multiple independent, named what-if scenarios with no account required
- [ ] **Phase 8: Share Links** - Shareable URLs that encode a scenario without clobbering the visitor's own picks

## Phase Details

### Phase 1: Data Pipeline

**Goal**: A committed, versioned dataset of the 2026 FBS season (teams, games, logos, colors) exists and is trustworthy enough for every later phase to build on without re-verifying it.
**Mode:** mvp (data/infra track — not user-facing on its own; every other phase depends on it)
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):

  1. Running the fetch script once produces committed, season-namespaced `teams.json` and `games.json`, each carrying a `scheduleHash` fingerprint
  2. Every FBS team has a logo, primary color, and alternate color vendored into the repo; any team missing an asset or required field is listed in a committed coverage report, not silently blank
  3. `conferenceGame` and season-type (regular vs. conference championship) are trusted directly from CFBD data, never re-derived from comparing team conferences, so championship games can be excluded from regular-season standings computation
  4. Re-running the fetch script for a future season (e.g. 2027) requires only a season argument change, not code changes

**Plans**: 5/5 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Install cfbd/zod/tsx/vitest deps (with legitimacy checkpoint), wire up Vitest + scripts tsconfig, author test fixtures

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — TDD: computeScheduleHash (scheduleHash fingerprint, D-11/D-12)
- [x] 01-03-PLAN.md — TDD: team/game Zod validation + transform (hard-fail split, conferenceGame/seasonType passthrough)
- [x] 01-04-PLAN.md — TDD: vendorLogo + buildCoverageReport, placeholder.svg

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — fetch-data.ts orchestration, live 2026 run, human spot-check checkpoint

### Phase 2: Foundation & Read-Only Slate

**Goal**: Users can browse the full 2026 schedule week by week, filtered by conference or team, in a fully static app with no backend.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FOUND-01, FOUND-02, FOUND-03, SLATE-01, SLATE-02, SLATE-03, SLATE-04, SLATE-05
**Success Criteria** (what must be TRUE):

  1. User can page through the season week by week with next/previous controls
  2. User can filter the visible slate to a single conference (SEC, Big Ten, Big 12, ACC, or All) or a single team
  3. Every game shown displays both teams' logos and names
  4. Week and filter selections are reflected in the URL, so any view is linkable and back/forward navigation works
  5. The production build makes zero network requests for schedule/team data after initial load, with no runtime API key and no server route

**Plans**: TBD
**UI hint**: yes

### Phase 3: Tiebreaker Engine

**Goal**: Given a full set of picked game outcomes, the engine correctly determines each P4 conference's championship participants — or correctly identifies who's tied and why — per that conference's actual published rules.
**Mode:** mvp (backend/logic track — no standalone UI; verified by tests and wired into the user-visible flow in Phase 6. Buildable in parallel with Phases 2, 4, and 5 since it only needs the `Game`/`Team` shape pinned in Phase 1.)
**Depends on**: Phase 1
**Requirements**: TIE-01, TIE-02, TIE-03, TIE-04
**Success Criteria** (what must be TRUE):

  1. For a complete, unambiguous set of picks, the engine returns the correct two championship-game participants for each of SEC, Big Ten, Big 12, and ACC, matching that conference's own published procedure (including the ACC's non-percentage tie definition and unbalanced 8/9-game-schedule handling)
  2. When a step only partially separates a tied group, the engine restarts the procedure from step one for the remaining teams; when a step separates no one, it continues to the next step
  3. When a tiebreaker cannot be resolved from picks alone (a ranking-based step, or a step requiring scores), the engine reports which teams remain tied and why, rather than guessing or crashing
  4. Correctness is demonstrated by hand-verified fixtures covering 2-, 3-, 4-, and 5-way ties per conference, including a case where restarting vs. continuing the procedure produces a different champion

**Plans**: 1/8 plans executed
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Conference record derivation (deriveConferenceRecords) + frozen base ordering (computeBaseOrdering) + Big 12 FCS win count (deriveOverallWinCount)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Tiebreaker step evaluators (head-to-head, common-opponents, next-highest-placed-common-opponent w/ D-05 collective-bucket, cumulative-opponent-win-pct, total-wins)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Recursive restart/continue engine (resolveTiedGroup) + CONFERENCE_RULES data table + ACC's defineTiedTeams + resolveConferenceChampionship orchestration

**Wave 4** *(blocked on Wave 3 completion; SEC/Big Ten/Big 12/ACC plans run in parallel)*

- [x] 03-04-PLAN.md — SEC hand-verified fixture matrix + tests
- [x] 03-05-PLAN.md — Big Ten hand-verified fixture matrix + tests
- [x] 03-06-PLAN.md — Big 12 hand-verified fixture matrix + tests (incl. D-05-revised collective-bucket regression)
- [x] 03-07-PLAN.md — ACC hand-verified fixture matrix + tests (incl. mixed 8/9-game tied-team definition)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-08-PLAN.md — D-11 coverage threshold (shared/domain/tiebreakers/** at 90%) + full-suite verification

### Phase 4: Picks & Persistence

**Goal**: Users can pick a winner for every game in the season and have those picks persist across sessions, with tools to work through the whole slate efficiently.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PICK-01, PICK-02, PICK-03, PICK-04, PICK-05, PICK-06, PICK-07, PICK-08
**Success Criteria** (what must be TRUE):

  1. User can pick a winner for any game with one click, and clicking the picked winner again clears the pick
  2. Picks persist across browser sessions (close and reopen the browser — picks are still there), namespaced by season
  3. User can bulk-fill all remaining unpicked games in a week or the season with the home team without overwriting existing picks, and can clear all picks in a week or the season (season-wide clear requires confirmation)
  4. A visible progress indicator shows how many games are picked, overall and per week
  5. If stored pick data is corrupted or unreadable, the app recovers gracefully instead of crashing or silently discarding the user's picks

**Plans**: TBD
**UI hint**: yes

### Phase 5: Standings Engine & UI

**Goal**: Users can see each conference's standings recompute live from their picks, with ties clearly visible before any tiebreaker resolves them.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: STAND-01, STAND-02, STAND-03, STAND-04
**Success Criteria** (what must be TRUE):

  1. User can view standings (rank, team, conference record, overall record) for each of SEC, Big Ten, Big 12, and ACC
  2. Standings update immediately, with no perceptible delay, whenever a pick changes
  3. Conference wins, losses, and games played are shown as separate values (never collapsed to a single percentage), so an 8-game and a 9-game conference schedule remain honestly comparable
  4. Teams tied on the relevant standings criteria are visually flagged as tied, even before a tiebreaker has been applied

**Plans**: TBD
**UI hint**: yes

### Phase 6: Tiebreaker UI & Championships

**Goal**: Users can see exactly how each conference's championship matchup was determined, and resolve any tie the engine can't settle on its own.
**Mode:** mvp
**Depends on**: Phase 3, Phase 5
**Requirements**: TIE-05, TIE-06, TIE-07
**Success Criteria** (what must be TRUE):

  1. Each conference's resolved (or still-pending) championship matchup is displayed as a dedicated, prominent element above that conference's standings table
  2. User can see the step-by-step reasoning behind a resolved tiebreaker — the tied group, the step applied, each team's value at that step, and any restart events — not just the final answer
  3. When a tie can't be auto-resolved, the user selects who advances, and that selection stays valid as long as the tied group is unchanged, and is clearly invalidated (not silently misapplied) if the tied group changes

**Plans**: TBD
**UI hint**: yes

### Phase 7: Named Scenarios

**Goal**: Users can maintain multiple independent what-if scenarios side by side, with no account required.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SCEN-01, SCEN-02, SCEN-03, SCEN-04, SCEN-05
**Success Criteria** (what must be TRUE):

  1. User can create multiple named scenarios, each with its own independent set of picks, and switch between them
  2. User can rename or delete a scenario (delete requires confirmation), and duplicate an existing scenario under a new name
  3. All of the above works with no login or account

**Plans**: TBD
**UI hint**: yes

### Phase 8: Share Links

**Goal**: Users can share a scenario via a URL that opens with those exact picks applied, without ever clobbering the visitor's own picks.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: SHARE-01, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):

  1. User can generate a shareable URL that encodes a scenario's picks and any manual tiebreaker overrides
  2. Opening a share link shows a banner indicating the visitor is viewing a shared scenario, with an option to save a copy, and never silently overwrites the visitor's own existing picks
  3. If a share link's schedule fingerprint doesn't match the current dataset, the app reports how many picks applied rather than silently misapplying or dropping them
  4. Malformed or malicious share payloads (unknown game ids, oversized payloads) are rejected rather than applied

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Phase 3 may be worked in parallel with Phases 2, 4, and 5 since it has no UI dependency and depends only on Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Pipeline | 5/5 | Complete    | 2026-08-13 |
| 2. Foundation & Read-Only Slate | 0/TBD | Not started | - |
| 3. Tiebreaker Engine | 8/8 | Complete    | 2026-08-14 |
| 4. Picks & Persistence | 0/TBD | Not started | - |
| 5. Standings Engine & UI | 0/TBD | Not started | - |
| 6. Tiebreaker UI & Championships | 0/TBD | Not started | - |
| 7. Named Scenarios | 0/TBD | Not started | - |
| 8. Share Links | 0/TBD | Not started | - |
