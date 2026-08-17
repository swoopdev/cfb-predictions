# Roadmap: CFB Predictions

## Overview

The app is built in the order the data flows: a trustworthy, versioned 2026 dataset first (nothing else can be more than guesswork without it), then the static shell that can browse it, then picking/persistence (user interactions), then conference standings with tiebreaker-aware rankings (reusing the Phase 3 tiebreaker engine), then the tiebreaker reasoning UI that shows step-by-step how rankings and championships were determined. Scenarios and share links are purely additive on top of a working single-scenario app, and are the safe cuts if the milestone needs to tighten.

This roadmap adapts research/SUMMARY.md's proposed 8-phase breakdown rather than adopting it verbatim: Foundation (query layer, static-site config) is folded into the Read-Only Slate phase, since on its own it has no user-observable behavior and MVP mode calls for vertical, end-to-end slices wherever possible. The Tiebreaker Engine remains its own phase — a deliberate exception to "vertical slice," because it is pure domain logic with no UI dependency, the project's single highest-risk component, and buildable the moment Phase 1 pins down the `Game`/`Team` shape. It can run in parallel with Phases 2, 4, and 5.

Requirement count note: REQUIREMENTS.md's own "Coverage" line said 42; a direct count of `- [ ] **XXX-NN**' entries in the file totals **43**. This roadmap maps all 43 and the correction is reflected in REQUIREMENTS.md's traceability section.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

**Parallel track:** Phase 3 (Tiebreaker Engine) depends only on Phase 1 and has no UI dependency. It can be built in parallel with Phases 2 and 4, then wired into standings ranking in Phase 5 and championship reasoning in Phase 6.

- [x] **Phase 1: Data Pipeline** - Committed, validated 2026 FBS teams/games dataset with vendored logos and a schedule fingerprint (completed 2026-08-13)
- [ ] **Phase 2: Foundation & Read-Only Slate** - Static Nuxt shell with a typed query layer; users can browse the season week by week, filtered by conference or team
- [x] **Phase 3: Tiebreaker Engine** *(parallel with 2, 4, 5)* - Pure-logic engine that resolves each P4 conference's championship participants (or surfaces the tie) per its published rules (completed 2026-08-14)
- [ ] **Phase 4: Picks & Persistence** - Users can pick winners for the full season; picks persist, bulk-fill, and recover from corruption
- [ ] **Phase 5: Standings Engine & UI** - Live conference standings recomputed from picks, with ties visibly flagged (executed 2026-08-14; awaiting UAT — 05-VERIFICATION.md is `human_needed`, 4 items pending in 05-UAT.md)
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

**Plans**: 4/4 plans executed
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: query layer (useTeams/useGames), shared types, GameCard, /week/[week] page with conference grouping + loading/error states

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Static build config: ssr:false, prerendered week routes, Cloudflare SPA fallback
- [x] 02-03-PLAN.md — Conference + team filters with URL round-trip and input sanitization

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — Week nav (Prev/Next/picker), distinct empty states, full-slate UAT checkpoint

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

**Plans**: 4/4 plans
Plans:
**Wave 0**

- [ ] 04-01-PLAN.md — Install @vueuse/nuxt, author usePicksStorage + useAutoFilledGames composables with corruption recovery and test fixtures
- [ ] 04-02-PLAN.md — Extend GameCard.vue with click-to-pick interaction, visual feedback (border + checkmark), keyboard/accessibility support

**Wave 1** *(blocked on Wave 0 completion)*

- [ ] 04-03-PLAN.md — Create progress badge components (global + per-week), integrate into week page layout, author usePickProgress composable
- [ ] 04-04-PLAN.md — Implement bulk fill/clear operations, confirmation modal for Clear Season, integrate buttons into week page, manual UAT verification

**UI hint**: yes

### Phase 4.1: Picks & Persistence — UI Polish (INSERTED)

**Goal**: Refine Phase 4 UI for clarity and UX — progress bars instead of badges, white backgrounds for picked cards, improved button positioning, and better game grouping for conference-specific views.
**Mode:** mvp (UI polish only, no logic changes)
**Depends on**: Phase 4
**Requirements**: PICK-01 through PICK-08 (same, no new requirements)
**Success Criteria** (what must be TRUE):

  1. Progress indicators are horizontal progress bars with label centered in the bar, showing clear visual fill
  2. All picked game cards have a white background to distinguish them from unpicked cards
  3. Fill/Clear buttons are positioned below week headings (not inline), with season buttons above the game grid
  4. When filtering to a specific conference, all games involving that conference appear in a single section (not split by opponent conference), including out-of-conference games

**Plans**: 1/1 plan created
Plans:
**Wave 1**

- [ ] 04-01-POLISH-PLAN.md — Refactor progress components to horizontal bars, add white background to picked cards, reposition bulk operation buttons, update game grouping for conference filters

**UI hint**: yes

### Phase 5: Standings Engine & UI

**Goal**: Users can see each conference's standings recomputed live from their picks, with tiebreaker procedures applied to resolve computable ties and manual resolution needed for non-computable ties.
**Mode:** mvp
**Depends on**: Phase 3 (tiebreaker engine), Phase 4 (picks)
**Requirements**: STAND-01, STAND-02, STAND-03, STAND-04
**Success Criteria** (what must be TRUE):

  1. User can view standings (rank, team, conference record, overall record) for each of SEC, Big Ten, Big 12, and ACC, with final rankings reflecting tiebreaker resolution
  2. Standings update immediately, with no perceptible delay, whenever a pick changes
  3. Conference wins, losses, and games played are shown as separate values (never collapsed to a single percentage), so an 8-game and a 9-game conference schedule remain honestly comparable
  4. Teams with identical records are ranked by applying tiebreaker procedures (using Phase 3's engine); unresolved ties (steps requiring manual input or ranking data) are visually flagged as requiring manual resolution

**Plans**: 3/3 plans complete
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Core standings computation (computeStandings) and SEC display with reactive updates from picks

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Multi-conference display, conference filter integration, responsive sidebar collapse, and visual polish

**Wave 3** *(gap closure from 05-REVIEW.md; blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — CR-01 blocker: unify the standings tie definition with the tiebreaker engine's resolved seed order, plus the WR-02 duplicate winPct, the WR-07 regression-test gap, and the WR-01/WR-03 silent failures

**UI hint**: yes

### Phase 6: Tiebreaker UI & Championships

**Goal**: Users can see exactly how each conference's championship matchup was determined, see a fully ranked 1..N conference table wherever the tiebreaker procedure can determine an order, and resolve any tie the engine can't settle on its own.
**Mode:** mvp
**Depends on**: Phase 3, Phase 5
**Requirements**: TIE-05, TIE-06, TIE-07, TIE-08
**Success Criteria** (what must be TRUE):

  1. Each conference's resolved (or still-pending) championship matchup is displayed as a dedicated, prominent element above that conference's standings table
  2. User can see the step-by-step reasoning behind a resolved tiebreaker — the tied group, the step applied, each team's value at that step, and any restart events — not just the final answer
  3. When a tie can't be auto-resolved, the user selects who advances, and that selection stays valid as long as the tied group is unchanged, and is clearly invalidated (not silently misapplied) if the tied group changes
  4. Conference standings show distinct ranks 1..N wherever the tiebreaker procedure can determine an order, rather than teams sharing a rank number
  5. Teams that remain genuinely unresolvable share a rank and are visually marked as tied, and the user is prompted to resolve them manually only once that conference's slate is fully picked
  6. Teams separated only by a tiebreaker (not by record) are visually distinguishable from teams separated by record, so a rank gap is never mistaken for a record gap

**Supersedes Phase 5 decisions** (added 2026-08-14): D-04 (teams tied on record share a rank number) and D-05 (no tie badge; matching rank + matching W-L deemed sufficient) are both REVERSED here. Phase 5 verification found D-05's rationale falsified on ~1% of tables — ACC teams share a rank with *different* records, e.g. `1 Boston College 6-2` above `1 Duke 7-2`. The code this changes is `computeStandings`' rank grouping, currently a union-find over the equivalence closure of "same seed group" and "identical conference W-L".

**Engine work required**: `ChampionshipResult` (shared/domain/tiebreakers/types.ts) exposes only `seed1` and `seed2` — nothing resolves below seed 2. Full 1..N needs the commit-and-restart loop extended past two slots; the `alreadyCommitted` mechanism already exists, so this is an extension rather than a rewrite. Fix the two logged engine bugs as part of this work rather than building on them: the ACC infinite-recursion guard trip (`engine.ts:137`, 12 of 1,200 conference resolutions ≈ 4% of ACC resolutions) and the seed1/seed2 self-contradiction (7 of 649 resolved conferences, caused by an unseparated multi-team bucket being emitted in raw team-id order). Both detailed in `.planning/phases/05-standings-engine-ui/deferred-items.md`.

**Measured constraints** (carry into planning — these bound what is achievable): over 200 generated seasons of the committed 2026 slate, at seeds 1-2 only, 82.9% of seed slots resolve when fully picked and 73.0% at weeks 1-7; nearly every failure is `ranking-step` (270/271 fully-picked, 421/430 partial). `ranking-step` and `needs-scores` are PERMANENTLY uncomputable in this app — there is no rankings data in a static build, and users pick winners rather than scores — so those ties are resolvable only by a human choosing. There are ~4.3 shared-rank groups per conference table (3,433 groups over 800 tables, ~11,391 teams), all of which the engine never evaluates today. Ties resolve *less* earlier in a season, so mid-season tables will show many shared ranks and converge toward clean 1..N as the slate fills — "1..N everywhere" is an end-of-season experience. **The "at most 1-2 manual decisions per conference per season" target is PLAUSIBLE BUT UNVALIDATED**: extrapolating 17% unresolvable across ~4.3 groups gives ~0.7 per conference, but that 17% was measured only at seeds 1-2, where separation is easiest. Planning MUST measure the real figure at N seeds before committing to the UX, because the design's ergonomics depend on it.

**Measurement obligation: DISCHARGED** (2026-08-15, in `06-RESEARCH.md` §The Measurement). The N-seed figure was measured against the committed slate over 200 generated seasons with both engine repairs applied. Answer: the 1-2 target holds for the SEC (0.10), Big Ten (0.19) and Big 12 (0.01) and fails for the ACC by roughly 4x (3.84 per fully-picked season, p90 5, 0% of seasons needing zero) — structural, because the ACC's amended policy has exactly one computable step. The measurement also exposed a **third** engine defect (the dropped lost-to-all elimination in `evaluateHeadToHead`) and quantified the seed1/seed2 root cause at **19.2% of contested slots** resolving by raw team id. All three defects are planned. Interaction model B (order the whole group in one interaction) is adopted, halving the ACC figure from 9.23. The ACC number was escalated to the user, who reaffirmed D-17's no-call-out design and superseded D-09 with preserve-and-suspend (`06-UI-SPEC.md` §0.1).

**Plans**: 7 plans across 5 waves
- [ ] 06-01-PLAN.md — wave 1 — engine defect repairs: delete the false ACC recursion guard, execute the dropped lost-to-all elimination, extract the shared generated-season harness
- [ ] 06-02-PLAN.md — wave 2 — the N-seed commit-and-restart loop, `RankGroup`/`ConferenceRanking`, and the unseparated-top-bucket repair that removes the seed1/seed2 contradiction
- [ ] 06-03-PLAN.md — wave 3 — `computeStandings` ranks from the engine's partition (union-find deleted), `StandingsResult` tightened (WR-06), `useStandings` composable extracted (IN-02)
- [ ] 06-06-PLAN.md — wave 3 — `TiebreakerReasoning.vue`: step-by-step reasoning, decisive step first, and the model-B ordering terminus
- [ ] 06-04-PLAN.md — wave 4 — `ChampionshipCard.vue` above every conference table, read from `championshipFor`
- [ ] 06-05-PLAN.md — wave 4 — manual-resolution lifecycle: the D-07 completion predicate, the D-08 invalidation key, and the preserve-and-suspend storage composable
- [ ] 06-07-PLAN.md — wave 5 — integration: three-state rank cell markers, reasoning mounted per group, manual decisions wired end to end, and the pre-Phase-5 coverage gate closed

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
| 2. Foundation & Read-Only Slate | 4/4 | Complete    | 2026-08-13 |
| 3. Tiebreaker Engine | 8/8 | Complete    | 2026-08-14 |
| 4. Picks & Persistence | 4/4 | Complete    | 2026-08-15 |
| 4.1. Picks & Persistence — UI Polish | 0/1 | Planned (INSERTED) | - |
| 5. Standings Engine & UI | 3/3 | Complete   | 2026-08-14 |
| 6. Tiebreaker UI & Championships | 0/TBD | Not started | - |
| 7. Named Scenarios | 0/TBD | Not started | - |
| 8. Share Links | 0/TBD | Not started | - |
