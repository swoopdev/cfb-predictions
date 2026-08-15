---
phase: 05-standings-engine-ui
verified: 2026-08-14T20:35:00Z
status: human_needed
score: 11/13 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: null
deferred:
  - truth: "Unresolved ties (steps requiring manual input or ranking data) are visually flagged as requiring manual resolution (ROADMAP Phase 5 SC4, second clause)"
    addressed_in: "Phase 6"
    evidence: "ROADMAP Phase 6 goal: 'Championship matchups and step-by-step tiebreaker reasoning, wired into standings; manual resolution for non-computable ties'. Requirements TIE-04/TIE-05/TIE-07 are mapped to Phase 6. Locked decision 05-CONTEXT.md D-10 explicitly descopes the pending-resolution state from Phase 5."
behavior_unverified_items:
  - truth: "Standings recompute immediately, with no perceptible delay, whenever a pick changes (STAND-02 / ROADMAP SC2)"
    test: "Load /week/5, note a conference's standings rows, click a team on a conference GameCard to pick it, then click the already-picked team to clear it."
    expected: "The picked team's Conf Record W increments and the opponent's L increments in the same frame; rank numbers re-order with no visible lag, no spinner, and no stale row. Clearing reverts both."
    why_human: "This is a reactive state transition (picks ref mutation -> two computeds -> sidebar re-render). The only page-level integration test file, tests/pages/week.test.ts, is 100% describe.skip (all 18 skipped tests in the suite), so no executing test exercises the pick->standings chain. The pure computation half IS measured (median 0.88ms, p95 2.69ms over 240 generated seasons of the full 888-game slate), but presence of a fast pure function plus a correctly-shaped computed does not prove the DOM updates."
  - truth: "Sidebar text and table contrast hold up in both light and dark themes (05-02 must_have; CLAUDE.md design constraint)"
    test: "Open the week view at desktop width in light mode, then dark mode. Sample the rank number, team name, Overall Record cell, Conf Record cell, and the column headers against the sidebar surface with a contrast checker."
    expected: "Every foreground/background pair meets WCAG AA (4.5:1 for the <=12px header and record text, 3:1 for large text)."
    why_human: "Explicitly and honestly declared unmeasured by 05-02-SUMMARY.md: Nuxt UI injects the --ui-color-neutral-* ramp at runtime rather than into entry.css, so a static numeric audit was attempted and abandoned. Every color is a semantic token (verified by grep -- no hard-coded colors in either component), but per-pair ratios cannot be derived without a live browser."
human_verification:
  - test: "Pick and clear a conference game on /week/5 and watch the standings sidebar."
    expected: "Conf Record and rank update in the same frame, both directions, with no perceptible delay."
    why_human: "Reactive chain untested -- tests/pages/week.test.ts is entirely describe.skip. See behavior_unverified_items."
  - test: "Measure per-pair contrast ratios in the standings sidebar in light and dark themes."
    expected: "All pairs meet WCAG AA."
    why_human: "Nuxt UI injects the neutral ramp at runtime; static audit not feasible. Known open item."
  - test: "Load the week view at 375px and at 1200px viewport width."
    expected: "At 375px the sidebar is collapsed behind a 'Show standings' toggle that expands/collapses it; at 1200px it is a pinned, independently scrollable right panel. No team name is clipped at either width (longest P4 name: 'Mississippi State')."
    why_human: "Unit tests assert the aria-expanded/hidden class contract and the absence of truncate/nowrap on the team cell, but actual layout, wrapping and reachability at real viewport widths are visual."
  - test: "In an ACC standings table where two teams share rank 1 with DIFFERENT conference records (e.g. '1 Boston College 6-2' directly above '1 Duke 7-2'), judge whether a user reads the two rows as tied."
    expected: "The shared rank number reads as a tie without further explanation."
    why_human: "Decision D-05 declined a tie badge/icon on the stated rationale that 'the matching rank number + matching W-L values are sufficient'. On the committed 2026 slate the W-L values do NOT always match inside a shared rank: measured 12 of 1200 conference tables (1%, all ACC) display a strictly worse conference record above a better one at the same rank number. This is CORRECT behaviour -- it is the ACC's own published alternate-schedule-length tie definition (TIE-02) doing exactly what it should -- but it falsifies half of D-05's stated rationale, and only a human can judge whether the rank number alone still reads as a tie."
---

# Phase 5: Standings Engine & UI Verification Report

**Phase Goal:** Users can see each conference's standings recomputed live from their picks, with tiebreaker procedures applied to resolve computable ties and manual resolution needed for non-computable ties.
**Verified:** 2026-08-14T20:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)

**Verification stance:** every claim below was checked against the codebase, not against SUMMARY.md. The CR-01 invariant, the D-04 rank invariant, the STAND-02 timing, and the WR-03 logging were each re-derived with independently written probes using a different PRNG and different seeds from the project's own regression test.

## Goal Achievement

### Observable Truths

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Standings display rank, team, overall record (W-L), conf record (W-L) for SEC, Big Ten, Big 12, ACC | SC1 / STAND-01 | ✓ VERIFIED | `computeStandings` returns all four P4 keys derived from `CONFERENCE_RULES` (`computeStandings.ts:18`, `:412`); `StandingsTable.vue:60-119` renders exactly the four columns in D-08/D-09 order; `StandingsSidebar.vue:54-56` renders all four stacked. Independently confirmed over 240 generated seasons: every conference table populated, all 4 keys always present. |
| 2 | Final rankings reflect tiebreaker resolution — the engine's champion is row 0 and a resolved seed order is never inverted | SC1 / 05-03 | ✓ VERIFIED | **Independently re-derived.** 240 generated seasons (120 fully-picked + 120 weeks 1-7), 780 conferences with a resolved seed 1: `championMismatch: 0`, `inversion: 0`, `missingRow: 0`. Mechanism is structural, not incidental: all of `seed1.order` shares group 0, the closure keeps it in one component, that component's key `(0,0)` is the global minimum (`computeStandings.ts:324-339`). |
| 3 | Standings recompute immediately, no perceptible delay, when any pick changes | SC2 / STAND-02 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wiring present and correct: `[week].vue:103-113` are two plain `computed`s over `picks.value` with no debounce and no watcher; `usePicksStorage` returns a deep `Ref`; `GameCard.vue:62,65` mutates it. Computation **measured** by me at median **0.88ms**, p95 2.69ms, max 15.08ms for `resolveAllConferences` + `computeStandings` over the full 888-game slate — well inside one 16.7ms frame. But no executing test exercises the pick→DOM transition: `tests/pages/week.test.ts` is 100% `describe.skip`. Routed to human verification. |
| 4 | Conference W/L tracked separately from overall W/L, never collapsed to a win percentage | SC3 / STAND-03 | ✓ VERIFIED | Two independent talliers: `overallRecords` over the whole slate (`computeStandings.ts:408`) and `confRecords` over `conferenceGamesFor(...)` (`:416`). `StandingsTeam` carries two distinct `{wins, losses}` pairs (`shared/types/standings.ts:44-47`); `gamesPlayed` is kept explicit upstream in `ConferenceRecord` (`records.ts:14`). The UI renders `W-L` strings only — **no percentage is displayed anywhere** (`StandingsTable.vue:114-119`). 05-03's deletion of the duplicate local `winPct` confirmed: `grep winPct shared/domain/standings/` returns exactly one hit, a *read* of `ConferenceRecord.winPct` (`:428`). |
| 5 | Teams tied on the relevant criteria share one rank number; the tiebreaker orders within a shared rank, never splits it | SC4 / STAND-04 / D-04 / D-11 | ✓ VERIFIED | Rank grouping is the equivalence **closure** of "shares a resolved seed group" ∪ "identical conference W-L", built with union-find (`computeStandings.ts:185-237`) rather than a comparator. **Independently re-derived** over 240 seasons / 960 conference tables: 0 cases of two identical-record teams carrying different ranks; 0 standard-competition-ranking anomalies (I re-checked that rank == 1 + index of the group's first row and that the next group skips by group size); 0 `isTied` inconsistencies. |
| 6 | Standings and the tiebreaker engine derive conference win percentage from exactly one implementation | 05-03 | ✓ VERIFIED | Zero `winPct` *definitions* in `shared/domain/standings/`. The only definition reachable from standings is `winPctSafe` in `tiebreakers/records.ts:28`, whose value is read straight off the same `ConferenceRecord` that `computeBaseOrdering` buckets on. |
| 7 | The test suite fails if standings order ever contradicts a resolved seed order — synthetic AND committed 2026 slate | 05-03 | ✓ VERIFIED | `standings-tiebreaker-agreement.test.ts` — 3 synthetic fixtures + 200 generated seasons of `public/data/2026`, checking ordering, champion-at-row-0, missing rows, and D-04. **Not a tautology** (see "Is the CR-01 regression test real?" below). |
| 8 | Sidebar shows all four conferences when no filter is active; exactly the filtered one when `?conf=` is set | 05-02 / D-02 | ✓ VERIFIED | `StandingsSidebar.vue:49-56`, with the query value validated against the derived P4 allowlist before use. Covered by 6 executing tests (`StandingsSidebar.test.ts:44-125`), including the "shows the filtered conference's own rows, not another conference's" case. |
| 9 | Sidebar collapses on mobile via a toggle and expands again | 05-02 / D-01 | ✓ VERIFIED | `StandingsSidebar.vue:89-117`: `aria-expanded`/`aria-controls` toggle flipping `hidden`/`block`, with `lg:block` making it unconditional on desktop. Four executing tests assert the collapsed default, the click transition, desktop unconditionality, and that the chevron is `aria-hidden`. Visual behaviour at real viewport widths routed to human verification. |
| 10 | Sidebar text and table contrast hold up in both light and dark themes | 05-02 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Every foreground/background is a Nuxt UI semantic token — no hard-coded color in either component (confirmed by grep). The one plainly risky pair (10px `text-dimmed` headers) was fixed to 12px `text-muted`. But **no numeric ratio was ever measured**, and 05-02-SUMMARY.md says so explicitly. Routed to human verification. |
| 11 | The sidebar shows no conference tables while the schedule is loading or has failed to load | 05-03 (WR-01) | ✓ VERIFIED | `[week].vue:321-331`: `StandingsSidebar` is gated on `v-if="loadState === 'ready'"`; loading renders a width-matched `USkeleton`; the error branch renders nothing. Declarative render condition, verifiable by reading. |
| 12 | A tiebreaker engine invariant violation is logged with the conference name and the error, not silently swallowed | 05-03 (WR-03) | ✓ VERIFIED | `resolveTiebreakers.ts:74-82` — per-conference `catch` emitting `console.warn` with the conference name and the error object, never the picks/storage key/share code. **Observed firing:** my 240-season run captured **8** such warnings (the known ACC recursion-guard trips), each carrying the conference name and the guard's message. The project's own tests only assert the *absence* of noise on happy paths; the positive case is confirmed here empirically. |
| 13 | Picks flow correctly into records: picking A over B in a conference game gives A a conf W and B a conf L | 05-01 | ✓ VERIFIED | `computeStandings.test.ts:90-154` (winner credit, loser charge, uninvolved untouched, away-team case, `conferenceGame` flag honoured over membership, P4-vs-G5 and P4-vs-FCS overall-only). All executing and passing. |

**Score:** 11/13 truths verified (2 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | ROADMAP SC4, second clause: "unresolved ties (steps requiring manual input or ranking data) are visually flagged as requiring manual resolution" | Phase 6 | ROADMAP Phase 6 goal: "Championship matchups and step-by-step tiebreaker reasoning, wired into standings; **manual resolution for non-computable ties**". TIE-04/05/07 are mapped to Phase 6 in REQUIREMENTS.md. Locked decision **D-10** descopes it from Phase 5 verbatim: "Phase 5 does not display a 'pending resolution' or 'needs user input' state for unresolved ties. Those are Phase 6's concern." Confirmed in code: a `needsUserInput` seed contributes no group (`computeStandings.ts:125`) and falls back silently to record ordering. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/domain/standings/computeStandings.ts` | Pure standings engine, all P4 | ✓ VERIFIED | 466 lines. Zero Vue/Nuxt imports. Purity + determinism asserted by executing tests. |
| `shared/domain/standings/resolveTiebreakers.ts` | Per-conference engine orchestration | ✓ VERIFIED | 86 lines. Framework-free; per-conference failure isolation with logging. |
| `shared/domain/standings/index.ts` | Single public entry point (DRY) | ✓ VERIFIED | 20 lines. Both consumers (`[week].vue`, tests) import from here. |
| `shared/types/standings.ts` | `ConferenceRecord`, `StandingsTeam`, `StandingsResult` | ✓ VERIFIED | 71 lines; all three exported and used. |
| `app/components/StandingsTable.vue` | Single-conference table | ✓ VERIFIED | 124 lines; imported by `StandingsSidebar.vue:10`; 5 executing tests. |
| `app/components/StandingsSidebar.vue` | Filter-aware multi-conference panel | ✓ VERIFIED | 140 lines; mounted at `[week].vue:321`; 13 executing tests. |
| `app/pages/week/[week].vue` | Sidebar + reactive computed integration | ✓ VERIFIED | Both computeds present (`:103-113`), sidebar wired with `loadState` gate and the `conf` filter. |
| `tests/domain/standings/computeStandings.test.ts` | Engine unit tests | ✓ VERIFIED | 429 lines, 43 executing tests. |
| `tests/domain/standings/standings-tiebreaker-agreement.test.ts` | CR-01 regression gate | ✓ VERIFIED | 433 lines; synthetic + 200 real-slate seasons. |
| `tests/domain/standings/resolveTiebreakers.test.ts` | WR-03 diagnostic quiet-path | ✓ VERIFIED | 50 lines, 3 tests. |
| `tests/fixtures/standings.fixtures.ts` | Fixtures incl. the three 05-03 hazards | ✓ VERIFIED | 401 lines; A/B/C fixtures all consumed. |
| `tests/components/StandingsTable.test.ts` / `StandingsSidebar.test.ts` | Component render tests | ✓ VERIFIED | 99 / 197 lines, all executing. |
| `app/app.css` | Declared in 05-02 `must_haves.artifacts` as "sidebar responsive layout styles" | ⚠️ SUPERSEDED — file does not exist | Responsive behaviour ships as Tailwind `lg:` variants inside the components instead. Documented as a deliberate decision in 05-02-SUMMARY.md and STATE.md ("app/app.css was never created... and is not in nuxt.config's css array"). The **truth** it supported (responsive sidebar) is delivered and tested. See Warning W-01 for the suggested override. |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `[week].vue` | `usePicksStorage()` | `picks: Ref<Record<number,number>>` read inside both computeds (`:21`, `:106`, `:112`) | ✓ WIRED |
| `[week].vue` | `useTeams()` / `useGames()` | `:17-18`, consumed as computed inputs | ✓ WIRED |
| `[week].vue` | `resolveAllConferences()` | `:106` | ✓ WIRED |
| `[week].vue` | `computeStandings()` | `:112`, result passed to sidebar `:323` | ✓ WIRED |
| `[week].vue` `loadState` | `StandingsSidebar` | `v-if="loadState === 'ready'"` (`:322`) | ✓ WIRED |
| `?conf=` filter | `StandingsSidebar` | `:active-conference="conf"` (`:324`) → validated allowlist (`StandingsSidebar.vue:49-52`) | ✓ WIRED |
| `StandingsSidebar` | `StandingsTable` | relative import `:10`, rendered per visible conference `:132-135` | ✓ WIRED |
| `computeStandings` | `ChampionshipResult.seed1.order` / `seed2.order` | `resolvedSeedGroups()` (`:114-138`) — the ONLY tie definition the standings layer consumes | ✓ WIRED |
| `computeStandings` | `ConferenceRecord.winPct` | `:428` — read, not re-derived | ✓ WIRED |
| `resolveAllConferences` | `resolveConferenceChampionship` (Phase 3) | `:66-73` per conference, try/catch isolated | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StandingsTable.vue` | `standings` prop | `StandingsSidebar` → `standings[conference]` | Yes — real rows on the committed slate | ✓ FLOWING |
| `StandingsSidebar.vue` | `standings` prop | `[week].vue` `standings` computed | Yes — not `{}`, not hardcoded; gated behind `loadState === 'ready'` so `{}` never reaches it | ✓ FLOWING |
| `[week].vue` `standings` | `computeStandings(...)` | `useGames()`/`useTeams()` (`public/data/2026/*.json`, 888 games / 138 teams) + `usePicksStorage` (localStorage) | Yes — verified by executing the real pipeline over the committed JSON | ✓ FLOWING |
| `[week].vue` `resolvedTiebreakers` | `resolveAllConferences(...)` | Phase 3 engine over the same inputs | Yes — 780/960 conference resolutions produced a resolved seed 1 in my run | ✓ FLOWING |

No hollow props found: `computeStandings` is never called with a hardcoded empty games/teams array at any call site, and the `{}` sentinel is unreachable by the sidebar because of the `loadState` gate.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite | `pnpm test` | 33 files passed, 1 skipped; **385 passed / 18 skipped / 0 failed** | ✓ PASS |
| Standings subset | `pnpm exec vitest run tests/domain/standings tests/components/Standings*.test.ts` | 5 files, **81 passed** | ✓ PASS |
| Lint | `pnpm lint` | exit 0 | ✓ PASS |
| Typecheck | `pnpm typecheck` | exit 0 | ✓ PASS |
| CR-01 invariant, independent probe | custom `tsx` script, own PRNG, 240 seasons | `championMismatch: 0`, `inversion: 0`, `missingRow: 0` across 780 resolved seed-1 conferences | ✓ PASS |
| D-04 + rank numbering + `isTied`, independent probe | same script | 0 identical-record rank splits, 0 competition-ranking anomalies, 0 `isTied` inconsistencies across 960 tables | ✓ PASS |
| STAND-02 timing, independent probe | same script | median **0.88ms**, p95 2.69ms, max 15.08ms per full recompute | ✓ PASS |
| WR-03 logging fires on a real violation | same script, `console.warn` intercepted | 8 warnings emitted, each with conference name + error | ✓ PASS |
| Record-inversion display audit | custom `tsx` script, 300 seasons | 12/1200 tables show a worse record above a better one — **all inside a shared rank number** (`inversionsWithDifferentRank: 0`) | ✓ PASS (see W-05) |
| Pick → DOM update | — | Requires a running browser and a state mutation | ? SKIP → human verification |
| Contrast ratios | — | Requires a live browser (runtime-injected token ramp) | ? SKIP → human verification |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repo and no PLAN/SUMMARY declares a probe. **Step 7c: SKIPPED (no probes declared or conventional).** The equivalent runnable evidence is the Behavioral Spot-Checks table above, all executed in this verifier's own process.

### Is the CR-01 regression test real, or a tautology?

**It is real.** Verified by reading the pre-fix implementation out of git rather than trusting the plan:

- `git show a6870f6:shared/domain/standings/computeStandings.ts` sorts rows by `winPct` → `wins` → `losses` **first**, and only consults `tiebreakerPositions` after all three compare equal (old `:176-190`). It also carried its own local `winPct(wins, losses)` (old `:212`) — the WR-02 duplicate, now deleted.
- Fixture A resolves ACC seed 1 to `[Boston College (.667), Miami (.750)]`. Under the old percentage-first sort Miami takes row 0, so `it('puts the engine-resolved champion in the top standings row')` **fails**.
- Fixture B has Alabama 2-0 and Georgia 3-0, both 1.000, with the engine placing Alabama first. Under the old sort the `wins` tiebreak puts Georgia first, so `expect(standings.SEC![0]!.id).toBe(ALABAMA)` **fails**.
- Every expected order in the file is read off the engine's own runtime output; nothing is hard-coded from a hand-run of the implementation. The real-slate property test additionally generates 200 seasons and asserts an empty violation list.
- The one test in the file that the plan itself admits would pass either way (`keeps a dropped team on the same rank as the placed team it ties`) is labelled as such in its own docblock rather than presented as a RED gate — an honest disclosure, not a hidden tautology.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| **STAND-01** | 05-01, 05-02, 05-03 | Standings display rank, team, conf record (W-L), overall record (W-L) for SEC, Big Ten, Big 12, ACC | ✓ SATISFIED | Truths 1, 2, 8. All four conferences render all four columns; rankings reflect the engine's resolution. |
| **STAND-02** | 05-01, 05-02, 05-03 | Standings recompute immediately on any pick change, no perceptible delay | ? NEEDS HUMAN | Truth 3. No-debounce computed chain present and correct; recompute measured at 0.88ms median. End-to-end DOM update unexercised — the only page-level test file is fully skipped. |
| **STAND-03** | 05-01, 05-03 | Conference win/loss/games-played tracked as separate values, never collapsed to a win percentage | ✓ SATISFIED | Truths 4, 6. Two independent record tallies; `gamesPlayed` explicit in `ConferenceRecord`; no percentage rendered anywhere; the duplicate local `winPct` deleted in 05-03. |
| **STAND-04** | 05-01, 05-02, 05-03 | Teams tied on the relevant standings criteria are visually indicated as tied, before any tiebreaker is applied | ✓ SATISFIED | Truth 5. The rank number is the tie signal (D-04/D-05/D-06), and it is keyed on the **pre-tiebreaker** tied pool: `seed1.order` is the sequence `defineTiedTeams` produced, so the tiebreaker orders teams *within* a shared rank and never splits it. Independently confirmed at 0 violations over 960 conference tables. |

**Orphaned requirements:** none. REQUIREMENTS.md maps exactly STAND-01..04 to Phase 5, and all four appear in PLAN frontmatter (`requirements:` blocks of 05-01/02/03). REQUIREMENTS.md already marks all four `[x] Complete` in both the checklist and the traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` / "not yet implemented" across all 13 phase files | — | **None found.** Debt-marker gate passes clean. |
| `computeStandings.ts` | 444 | `isTied: false` initial placeholder | ℹ️ Info | Not a stub — overwritten at `:457` before the row is returned. Confirmed by the executing `isTied` assertions and by my own 960-table consistency check. |
| `[week].vue` | 109-113 | `return {}` in `standings` computed | ℹ️ Info | Not a stub — it is the not-yet-loaded sentinel, and the `loadState === 'ready'` gate (`:322`) makes it unreachable by the sidebar. |
| `resolveTiebreakers.ts` | 74-82 | `catch` that continues | ℹ️ Info | Not a swallow — this is the WR-03 fix; it logs conference + error and degrades to record ordering per conference. Observed firing 8 times in my run. |

### Warnings

| # | Finding | Severity |
|---|---------|----------|
| **W-01** | `app/app.css`, declared in 05-02's `must_haves.artifacts`, does not exist. Superseded by in-component Tailwind `lg:` variants. The decision is recorded in 05-02-SUMMARY.md and STATE.md, and the truth it backed is delivered and unit-tested. | ⚠️ Artifact deviation — override recommended (below) |
| **W-02** | The **WCAG contrast UAT item is under-recorded.** It appears only in the prose of 05-02-SUMMARY.md (line 152). It is **not** in `deferred-items.md` and **not** in STATE.md's Blockers/Concerns — unlike every other open item from this phase, all of which are in both. It is the one open item at risk of being lost at milestone close. | ⚠️ Recording gap |
| **W-03** | The Phase 5 → Phase 6 deferral of ROADMAP SC4's second clause (visual flag for unresolved ties) is not recorded in `deferred-items.md` either. It is inferable from D-10 in 05-CONTEXT.md and from Phase 6's roadmap goal, but a reader of the phase's deferral ledger would not find it. | ⚠️ Recording gap |
| **W-04** | `tests/pages/week.test.ts` is 100% `describe.skip` (all 18 of the suite's skipped tests). The page is where Phase 5's standings integration actually lives, so the phase ships **zero executing page-level tests**. The skip predates Phase 5 (Phase 4 authored it) and its stated rationale — "integration testing is better done via E2E" — is defensible, but there is no E2E harness in the repo, so the intent is unfulfilled. This is the direct cause of Truth 3 being behavior-unverified. | ⚠️ Test-coverage gap |
| **W-05** | D-05 declined a tie badge on the rationale that "matching rank number **+ matching W-L values**" are the indication. Measured: **12 of 1200 conference tables (1%, all ACC)** put a strictly worse conference record above a better one at the **same rank number** (e.g. `1 Boston College 6-2` above `1 Duke 7-2`). This is correct behaviour — the ACC's own non-percentage tie definition (TIE-02) — and `inversionsWithDifferentRank` is **0**, so no user ever sees identical records on different ranks. But half of D-05's stated rationale does not hold on the shipped data. Surfaced for the human checkpoint, not as a defect. | ⚠️ Design assumption partially falsified |
| **W-06** | WR-04's "dead output" half remains open. `StandingsTeam.isTied` is still read by no component — 05-03 closed WR-04 by rewriting the docblock rather than by deleting or redefining the field. This is defensible (D-05/D-06 forbid a visual tie indicator, and Phase 6 is the intended consumer, for which the post-CR-01 semantics are now correct), but the field is unconsumed as shipped. | ℹ️ Info |
| **W-07** | `computeStandings` does not filter on `seasonType`. Inert today — all 888 committed games are `seasonType: "regular"`, confirmed directly. If a future fetch ever adds conference-championship games, they would be counted into conference records, violating DATA-07. No guard exists in the standings layer. | ℹ️ Info — latent, out of Phase 5's current scope |

### Known Open Items — Recording Accuracy Check

Confirmed accurately recorded (not re-reported as new gaps):

| Item | deferred-items.md | STATE.md | Verdict |
|------|-------------------|----------|---------|
| Engine contradicts itself between seed 1 and seed 2 (7/649) | ✓ (lines 6-43) | ✓ Blockers/Concerns | Accurately recorded, with owner (Phase 3/6), measurement, consequence, and both candidate repairs. Pinned by a test. |
| ACC trips the infinite-recursion guard (12/1200, ~4% of ACC) | ✓ (lines 45-76) | ✓ Blockers/Concerns | Accurately recorded. **Independently reproduced** — 8 warnings in my own 240-season run. |
| `shared/domain/tiebreakers/**` at 87.87% vs a 90% branch threshold | ✓ (lines 78-92) | — | Accurately recorded, including that this phase *improved* it (80% → 87.87%) and that no gate the project runs includes `--coverage`. |
| WR-06 and IN-02 deferred with written rationale | ✓ (lines 94-99) | — | Accurately recorded, with carry-to target (Phase 6). |
| Per-pair WCAG contrast ratios unverified | ✗ **absent** | ✗ **absent** | **Only in 05-02-SUMMARY.md prose.** See W-02. |

### Gaps Summary

**No blockers.** No must-have truth is FAILED, no artifact is missing-or-stub in a way that breaks a truth, no key link is unwired, and no debt marker is present.

The single most load-bearing claim of this phase — that the standings table can no longer name a different conference champion than the tiebreaker engine resolved — was re-derived from scratch with an independently written probe using a different PRNG and different seeds from the project's own regression test. Across **240 generated seasons / 780 resolved conference championships**, the resolved champion was row 0 every time, no resolved seed order was ever inverted, and no two identical-record teams ever carried different rank numbers. The CR-01 fix holds, and the regression test guarding it is genuine rather than tautological (proven against the pre-fix code at `a6870f6`).

What remains is not missing implementation but **unexercised runtime behaviour**, in exactly two places:

1. **STAND-02's user-facing half.** The pure recompute is fast and measured; the pick→DOM reactive chain has no executing test because the phase's only page-level test file is entirely skipped. The code is present, correctly shaped, and idiomatic — but presence is not behaviour.
2. **Cross-theme contrast.** Declared unmeasured by the phase itself, for a legitimate technical reason.

Both route to the end-of-phase human checkpoint. Alongside them, three recording gaps (W-02, W-03) and one partially-falsified design assumption (W-05) are surfaced so they are decided rather than absorbed.

### Suggested Override (W-01)

`app/app.css` will never exist — the responsive approach changed deliberately during 05-02. To accept it rather than re-verify it every time, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "app/app.css — Sidebar responsive layout styles (width, media queries, toggle styling)"
    reason: "Responsive behaviour ships as Tailwind `lg:` variants inside StandingsSidebar.vue instead of a stylesheet; app/app.css is not in nuxt.config's css array and creating it would add an unloaded file. Decision recorded in 05-02-SUMMARY.md and STATE.md; the responsive truth it backed is delivered and covered by four executing tests."
    accepted_by: "tdhancock"
    accepted_at: "2026-08-14T20:35:00Z"
```

---

*Verified: 2026-08-14T20:35:00Z*
*Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance*
