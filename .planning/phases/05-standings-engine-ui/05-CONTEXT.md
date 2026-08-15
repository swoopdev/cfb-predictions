# Phase 5: Standings Engine & UI - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users view each conference's (SEC, Big Ten, Big 12, ACC) standings recomputed live from their picks, with tiebreaker procedures applied to resolve computable ties and manual resolution for non-computable ties. Standings display rank, team name, overall record (W-L), and conference record (W-L) for every team in each conference. Teams with identical records show the same rank. Standings update immediately when any pick changes, with no perceptible delay. Scope: P4 conferences only (G5 games affect P4 overall records but G5 teams themselves do not appear in standings). Phase 6 provides the UI for manually resolving ties that cannot be computed; Phase 5 consumes the resolved tiebreaker result from Phase 6 to rank teams.

</domain>

<decisions>
## Implementation Decisions

### Standings view layout & placement

- **D-01:** Standings are embedded in the week view (same page as the games slate) as a **right sidebar panel**, not a separate `/standings` route. Both games and standings are visible simultaneously on desktop; sidebar collapses to a toggle on mobile (details of mobile collapse left to planning/implementation).

- **D-02:** When user has a conference filter active (Phase 2's existing conference filter), the standings sidebar displays only that conference's standings. When no filter is active (or the filter is "All"), all 4 conferences' standings are displayed in the sidebar, stacked vertically (scrollable if needed).

- **D-03:** Each conference's standings are displayed as a traditional HTML **table** (not card-based), with columns: rank | team | overall record | conference record. Compact, scannable, familiar sports format.

### Tied teams visual indication

- **D-04:** Teams with identical conference records show the **same rank number**. For example, if 3 teams are tied at 6-2 conference record, all three show rank "2"; the next team appears as rank "5" (not "3"), following standard sports ranking convention.

- **D-05:** **No badge, icon, or visual indicator** is needed to show that teams are tied. The matching rank number + matching W-L values are sufficient visual indication that the teams are tied.

- **D-06:** **No tooltip or explanation text** on ties. Users see matching rank and matching records; they will understand the tie without additional prose.

### Conference & overall record display

- **D-07:** Each team's records are displayed in **two combined columns** showing W-L format (not four separate columns for W, L). Format: "6-2" for a 6-win, 2-loss record.

- **D-08:** Column headers: **"Overall Record" | "Conf Record"** — in that order (overall first, conference second). Headers must make the distinction crystal clear that these are two separate measurement axes.

- **D-09:** Overall Record appears first in the column order (before Conf Record), even though conference record is the primary tiebreaker sort criterion. This emphasizes total season success as the first thing readers see.

### Unresolved ties & tiebreaker handoff to Phase 6

- **D-10:** Phase 5 assumes all ties shown in standings are **already resolved** — either auto-resolved by Phase 3's engine or manually resolved by Phase 6. Phase 5 does not display a "pending resolution" or "needs user input" state for unresolved ties. Those are Phase 6's concern.

- **D-11:** **Phase 6 computes the final tiebreaker result** (including manual overrides for non-computable ties) and **provides that resolved ranking to Phase 5**. Phase 5 does not call Phase 3's engine directly; it consumes Phase 6's resolved-result output and uses it to rank the standings table.

- **D-12:** When Phase 6's manual tiebreaker resolution is updated, the flow is: Phase 6 updates internal state → Phase 5 watches that state → Phase 5 re-ranks the standings table based on the updated resolved result from Phase 6.

### Standings computation & reactivity

- **D-13:** Standings are computed via a reactive `computed()` property that watches two inputs: (1) the picks from `usePicksStorage()`, and (2) the resolved tiebreaker result from Phase 6. Whenever either input changes, standings are recomputed immediately with no debounce.

- **D-14:** A shared `computeStandings(games, teams, picks, resolvedTiebreaker)` pure function (in `shared/domain/standings/`) computes conference records and applies the resolved tiebreaker ranking. Consumed by Phase 5's reactive computed property and available to Phase 6 as well (DRY constraint per PROJECT.md).

### Claude's Discretion

- Exact CSS styling for the sidebar (width, border, shadow, etc.) — left to planning/implementation informed by Nuxt UI's design tokens.
- Mobile sidebar collapse mechanism (hamburger menu, slide-out drawer, etc.) — left to planning.
- Performance optimization of standings computation for 4 conferences × ~35 teams each — left to planning (e.g., memoization, per-conference caching).
- Accessibility (ARIA labels, keyboard navigation of the sidebar) — left to implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints & decisions
- `.planning/PROJECT.md` — Core value, DRY constraint (team lookup, standings, tiebreaker logic each have one implementation, consumed through composables), localStorage-only persistence.
- `.planning/REQUIREMENTS.md` §Standings (STAND) — STAND-01 through STAND-04 are this phase's locked requirements.
- `.claude/CLAUDE.md` — Technology stack: Nuxt 4, Nuxt UI 4, TanStack Query v5, VueUse `useStorage`, reactive `computed()` for derivations.

### Phase dependencies (data, picks, tiebreaker)
- `.planning/phases/03-tiebreaker-engine/03-CONTEXT.md` — Phase 3's output: tiebreaker engine (`resolveConferenceChampionship`), frozen base ordering for flagging ties, nested cycle trace. Phase 5 consumes the resolved tiebreaker result via Phase 6.
- `.planning/phases/04-picks-persistence/04-CONTEXT.md` — Phase 4's output: picks stored under `cfb_picks_2026`, available via `usePicksStorage` composable. Standings recompute whenever picks change.
- `.planning/phases/02-foundation-read-only-slate/02-CONTEXT.md` — Phase 2's week view at `/week/[week]`, conference/team filters as query params, existing GameCard component. Phase 5 embeds standings sidebar into this same page.

### Data shape (consumed from Phase 1)
- `public/data/2026/teams.json` — 138 teams: `{id, school, conference, ...}`. P4 conferences are SEC, Big Ten, Big 12, ACC.
- `public/data/2026/games.json` — 888 games: `{id, week, homeId, awayId, conferenceGame, ...}`. All games have `homeId` and `awayId` (138 FBS teams); 127 games have an `awayId` not in teams.json (FCS opponent).

### Integration with Phase 6
- Phase 6 (Tiebreaker UI & Championships) provides the UI for manual tiebreaker resolution and computes the final resolved ranking. Phase 5 consumes Phase 6's resolved-result output (D-11/D-12). Championship matchup display (TIE-07) is Phase 6's responsibility, not Phase 5's.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePicksStorage()` composable (Phase 4) — returns `picks.value` (Ref<Record<gameId, teamId>>). Phase 5 watches this to trigger standings recomputation.
- TanStack Query composables (`useTeams`, `useGames`) — already provide typed access to static datasets. Phase 5 uses these as inputs to standings computation.
- Phase 2's week page (`app/pages/week/[week].vue`) — already has conference/team filter logic. Phase 5 embeds standings sidebar into this existing page.
- GameCard component (Phase 2) — used in the week view. Phase 5 does not modify it.

### Established Patterns
- Pure, framework-free domain logic in `shared/domain/` — Phase 3 established this for tiebreakers. Phase 5 follows the same pattern: `shared/domain/standings/computeStandings()` is a pure function, zero Vue imports, consumed by a reactive `computed()` in the component layer.
- Reactive `computed()` for derivations (Phase 4) — picks stored in `usePicksStorage()`, standings derived from picks via `computed()`. Same pattern.
- Query-key factory pattern (Phase 2) — for consistency, if standings are ever moved to TanStack Query (v2), the pattern is already established.

### Integration Points
- Phase 5's reactive computed watches `usePicksStorage()` and Phase 6's resolved tiebreaker state. When either changes, standings recompute immediately.
- Phase 6 depends on Phase 5's computed standings to understand the current state before offering manual tie resolution.

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose embedded sidebar over a separate `/standings` route — standings are tightly coupled to the week view, not a separate concern.
- User wants overall record shown first (even though conference record is the primary tiebreaker criterion) — reflects how casual viewers think about the season.
- User rejected badge/icons for tied teams — the matching rank and records are self-explanatory.
- User chose to scope Phase 5 narrowly: assume tiebreakers are resolved (by Phase 3 or Phase 6), don't show pending states. Phase 6 handles resolution, Phase 5 shows the result.

</specifics>

<deferred>
## Deferred Ideas

None — all gray areas were resolved in discussion.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 5-Standings Engine & UI*
*Context gathered: 2026-08-15*
