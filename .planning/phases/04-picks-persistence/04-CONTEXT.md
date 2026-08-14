# Phase 4: Picks & Persistence - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can pick a winner for every game in the season and have those picks persist across sessions (localStorage, namespaced by season). Bulk operations (fill/clear) work at week or season scope. Picks carry provenance (user vs. auto-filled) for future result-locking. Corrupt data is preserved and recoverable. No standings display yet (Phase 5); no multi-scenario support (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Pick interaction & visual feedback
- **D-01:** Click the team name/logo directly on a game card to pick that team as the winner. Clicking the already-picked winner again clears the pick (PICK-02).
- **D-02:** The picked winner is visually distinguished with a highlight or background color distinct from unpicked teams. The unpicked team remains neutral/de-emphasized.
- **D-03:** The visual feedback should make it obvious that clicking again will clear the pick (e.g., the highlight/color is only on the picked team, inviting a second click to remove it).

### Pick state structure in localStorage
- **D-04:** Picks are stored in localStorage as a simple object indexed by game ID: `{ gameId: winningTeamId, gameId: winningTeamId, ... }`. This is compact, JSON-serializable, and supports direct lookups.
- **D-05:** Provenance (user-made vs. auto-filled, PICK-04) is **not** stored in the picks object itself. Instead, a separate `autoFilledGameIds` Set (or array) tracks which picks were auto-filled during bulk operations. This keeps the pick object flat and fast to serialize, while preserving the distinction for Phase 7 (result-locking).
- **D-06:** Picks are stored under the key `cfb_picks_2026` (season-namespaced per PICK-03). The `autoFilledGameIds` are stored under `cfb_autofilled_2026`.

### Corrupt data recovery
- **D-07:** If the stored pick data fails to parse or validate, the app silently resets picks to an empty object `{}` and shows an empty pick slate. The corrupted data is **preserved** under a separate key `cfb_picks_2026_corrupt` for manual recovery if the user contacts support or wants to investigate.
- **D-08:** No banner or modal is shown on recovery. The slate simply appears empty, and the user can re-pick. The assumption is that localStorage corruption is rare enough that a silent reset is less disruptive than a warning banner for every session.

### Progress indicator placement & format
- **D-09:** A global badge (e.g., "45/100") appears at the top of the page, showing overall season progress.
- **D-10:** A per-week badge appears next to each week's heading, showing that week's progress (e.g., "8/10" for week 1).
- **D-11:** Format is text-based (`X/Y picked`), not a percentage or progress bar. This keeps the UI minimal and avoids claiming precision (e.g., a percentage bar suggests finality, but picks can change at any time).

### Bulk operations (fill & clear)
- **D-12:** Context-aware buttons: Each week section has a "Fill Week" and "Clear Week" button. A global "Fill Season" and "Clear Season" button appears at the top.
- **D-13:** "Fill Week" / "Fill Season" only fills **remaining** unpicked games with the home team (per PICK-05). Existing picks are never overwritten.
- **D-14:** "Clear Week" does not require confirmation. "Clear Season" **requires** a confirmation modal (per PICK-06). The modal explicitly states "This will clear all picks across the entire season" to avoid accidental mass deletion.
- **D-15:** Bulk operations (fill/clear) mutate the picks object in batches, then update localStorage once per operation, rather than one pick at a time. This avoids cascading reactivity and multiple localStorage writes.

### Integration with Phase 5 & beyond
- **D-16:** The `computeStandings(games, teams, picks)` pure function (sketched in CLAUDE.md) is called from a `computed()` that reads `useStorage`'s `picks.value` and the query data. Standings recompute whenever either input changes.
- **D-17:** Phase 5 will import the frozen base ordering from Phase 3's tiebreaker engine to flag tied teams in standings (per Phase 3's D-08/D-09, nested cycles with per-cycle tied-team lists). Phase 4 doesn't compute standings yet; it just provides the picks.
- **D-18:** Picks are stored under a season-namespaced key, so future phases (Phase 7: Named Scenarios) can maintain multiple independent pick sets via separate storage keys (`cfb_picks_scenario_"scenario-name"`, etc.). The pattern is already baked into Phase 4 with the `2026` suffix.

### Claude's Discretion
- Exact CSS for the "picked team" highlight (color, opacity, border, shadow, etc.) — left to planning/implementation informed by Nuxt UI's color palette and existing Phase 2 card styling.
- Whether the global progress badge is rendered at the very top (sticky navbar) or just above the first week section — left to planning based on scroll behavior and UX feedback from Phase 2's week navigation.
- The exact mechanism for cross-tab synchronization using VueUse's `listenToStorageChanges` — left to implementation; at a minimum, picks changed in another tab should be reflected when the user returns to this tab.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints & decisions
- `.planning/PROJECT.md` — Core value, DRY constraint (team lookup, standings, tiebreaker logic each have one implementation), localStorage-only persistence, team color used sparingly as accents.
- `.planning/REQUIREMENTS.md` §Picks & Persistence (PICK) — PICK-01 through PICK-08 are this phase's locked requirements.
- `.claude/CLAUDE.md` — Technology stack: VueUse `useStorage` for localStorage, pick state as Ref, `computed()` for standings derivation, no Pinia, no multi-store patterns until Phase 7.
- `.planning/phases/03-tiebreaker-engine/03-CONTEXT.md` — Phase 3's decisions on frozen base ordering (D-08) and per-cycle tied-team lists (D-09), which Phase 5 will use to flag ties in standings.

### Phase 2 dependencies (data & interaction patterns)
- `.planning/phases/02-foundation-read-only-slate/02-CONTEXT.md` — Phase 2's decisions on game card layout (D-05: Nuxt UI Card component), conference/team filters, URL structure, week navigation. Phase 4 adds click interaction to these same cards.
- `public/data/2026/games.json` — 888 games with `id`, `week`, `homeId`, `awayId` fields. Picks are keyed by `id`.
- `public/data/2026/teams.json` — 138 teams with `id` fields. The home team is looked up via `homeId` for auto-fill (PICK-05).

### Testing & Validation
- Testing strategy: Unit tests for the pick composable (toggling, persistence, provenance tracking), integration tests for bulk fill/clear operations, and E2E tests for the full flow (pick → persist → reload → picks still there). Fixtures: empty picks, partial picks, all-picked, corrupt data recovery.
- Vitest is already configured (Phase 1). Use the same test structure as Phase 3's tiebreaker tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- VueUse `useStorage` is already installed (as a transitive dependency of `@nuxt/ui`), but `@vueuse/nuxt` is not yet added. Planning should add it per CLAUDE.md's recommended stack.
- TanStack Query composables (`useTeams`, `useGames`) are defined in Phase 2 and will be the source of truth for games/teams data. Phase 4 layers picks on top via a separate `usePicksStorage` composable.
- Game card layout from Phase 2 (`GameCard` component) — Phase 4 adds click handlers to this component to toggle picks.

### Established Patterns
- Phase 2 established the query-key factory pattern (`['season', 2026, 'games']`). Phase 4 should follow the same pattern for the storage key naming: use a season suffix (`2026`) to support future multi-season or multi-scenario branches.
- Phase 3 established the pure-function, zero-Vue-dependency pattern for domain logic in `shared/domain/`. Phase 4's `computeStandings` should follow the same structure.

### Integration Points
- Phase 5 (Standings Engine & UI) depends on Phase 4's picks to compute standings. The integration point is the `computeStandings(games, teams, picks)` function, which Phase 5's components will call.
- Phase 7 (Named Scenarios) depends on Phase 4's localStorage pattern to support multiple independent pick sets. The season-namespaced key (`cfb_picks_2026`) makes this pattern extensible.

</code_context>

<specifics>
## Specific Ideas

- User was explicit on the interaction model: click the team card directly to pick, not a separate button (D-01/D-02).
- User chose context-aware buttons (fill/clear per week, plus global controls) — this spreads the controls closer to their respective scopes, reducing cognitive load (D-12).
- User wants silent recovery from corruption with a separate backup key, not a warning banner — prioritizing smooth UX over discoverability of edge cases (D-07/D-08).
- Global + per-week progress badges, not a progress bar — keeps the UI minimal and honest (D-09/D-10).

</specifics>

<deferred>
## Deferred Ideas

None — all gray areas were resolved in discussion.

</deferred>

---

*Phase: 4-Picks & Persistence*
*Context gathered: 2026-08-14*
