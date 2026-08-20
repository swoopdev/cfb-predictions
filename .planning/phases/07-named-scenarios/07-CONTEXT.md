# Phase 7: Named Scenarios - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create multiple named prediction scenarios, each with its own fully independent picks, auto-fill provenance, and manual tiebreaker decisions, and switch between them instantly with no perceptible delay. Users can rename or delete (with confirmation) a scenario, and duplicate an existing scenario under a new name. All of this works with no login or account — localStorage only, season-namespaced, per PROJECT.md's persistence constraint. Existing pre-Phase-7 picks (`cfb_picks_2026`) migrate automatically into a first scenario so no user data is lost.

Out of scope for this phase: encoding a scenario into a shareable URL (Phase 8's territory), and cross-scenario comparison views (SCEN-06/SCEN-07, already tracked as v2 requirements in REQUIREMENTS.md).

</domain>

<decisions>
## Implementation Decisions

### Scenario Data Model & Storage Architecture
- **D-01:** A registry key `cfb_scenarios_2026` stores an array of `{ id, name, createdAt }` scenario metadata objects. The `id` (not the name) is the durable identity — decouples identity from a renamable display label.
- **D-02:** Per-scenario data lives under existing key patterns suffixed with the scenario id: `cfb_picks_2026_{scenarioId}`, `cfb_autofilled_2026_{scenarioId}`, `cfb_manual_tiebreakers_2026_{scenarioId}`.
- **D-03:** On first load after this phase ships, if the old pre-scenario key `cfb_picks_2026` has data and no scenario registry exists yet, auto-wrap it into a first scenario (default name "My Scenario"). The legacy key is never deleted — only copied forward — consistent with the "never silently discard picks" precedent (Phase 4 D-07).
- **D-04:** Scenario scoping extends to all three pick-derived storage concerns — picks, auto-fill provenance, AND manual tiebreaker decisions — not just picks. A stale auto-fill marker or tiebreaker override carried over from a different scenario's ties would silently misapply.
- **D-05:** `cfb_active_scenario_2026` stores the currently selected scenario id. If it points to a scenario id no longer present in the registry (manual localStorage edits, corruption), fall back to the first registry entry, or auto-create a default scenario if the registry itself is empty — same silent-recovery posture as D-07/D-08 from Phase 4.
- **D-06:** The active scenario is NOT reflected in the URL this phase. That belongs to Phase 8 (Share Links); conflating it now blurs the phase boundary.

### Scenario Switcher UI & Navigation
- **D-07:** The switcher lives in the page-level header of `week/[week].vue`, next to the existing Fill Season/Clear Season controls — the established "global controls above the game grid" spot (Phase 4 D-11/D-12). No app-wide navbar/shell exists yet (`TemplateMenu.vue` is still the unmodified Nuxt starter), and building one is out of SCEN-01..05's scope.
- **D-08:** `USelectMenu` (Nuxt UI 4) powers the switcher — supports a labeled list plus room for inline per-row actions (rename/duplicate/delete), which a plain `USelect` does not.
- **D-09:** Switching scenarios is an in-place reactive swap — writes the active-scenario storage ref, and standings/progress recompute instantly via existing reactive `computed()` chains. No route change, no full page reload (PROJECT.md's Core Value: consequences "update correctly and instantly").

### Scenario Management Actions
- **D-10:** Create/rename/duplicate/delete all live inside the switcher's `USelectMenu` itself — a "+ New Scenario" row plus inline icon actions per row. No new route or dedicated management page.
- **D-11:** Default name for a new scenario is `"Scenario N"` (N = current count + 1), immediately editable inline. Names are NOT required to be unique — the `id` is the real identity (D-01); enforcing uniqueness adds validation friction the requirements don't call for.
- **D-12:** Delete requires confirmation via Nuxt UI's `UModal` (SCEN-03). **Note:** the codebase has no existing confirm-modal pattern to reuse — a grep for `window.confirm`/`UModal` found nothing, meaning Phase 4's own D-14 ("Clear Season requires a confirmation modal") was apparently never actually implemented. Phase 7 establishes this pattern fresh; retrofitting Clear Season is out of this phase's scope.
- **D-13:** Duplicate copies everything scenario-scoped — picks, auto-fill provenance, and manual tiebreaker decisions — producing a true fork, consistent with D-04's reasoning.

### Edge Cases & Limits
- **D-14:** The delete action is disabled when exactly one scenario remains — the app must always have a valid active scenario; no zero-scenario empty state is built.
- **D-15:** No hard cap on the number of scenarios for v1. REQUIREMENTS.md specifies none, and localStorage budget comfortably fits many scenarios at this data size.
- **D-16:** Deleting the currently active scenario falls back to the next remaining scenario in the registry immediately — no extra "pick a replacement" prompt on top of the delete confirmation itself.
- **D-17:** Corrupted/unparseable scenario registry JSON resets silently to a fresh default scenario, no error banner — same precedent as `usePicksStorage`'s D-07/D-08.

### Claude's Discretion
- Exact scenario `id` generation mechanism (`crypto.randomUUID()` vs. timestamp-based) — either satisfies D-01's "durable, decoupled from name" requirement.
- Whether "Scenario N" numbering reuses gaps after deletes or always increments monotonically.
- A maximum scenario count, only if the `USelectMenu` design genuinely needs one for usability — not a functional requirement.
- Exact `UModal` copy/wording for the delete confirmation (should name the scenario being deleted, per the Clear Season modal's stated intent of specificity even though that modal was never built).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePicksStorage(season)`, `useAutoFilledGames(season)`, `useManualTiebreakers(season)`, `usePickProgress(season)`, `useStandings(season)` — all five composables already take a `season` parameter and follow an identical `useStorage`-backed shape. This is directly extensible to a scenario-aware key without restructuring — the pattern already exists, just needs a second axis threaded through.
- Nuxt UI 4 ships both `USelectMenu` and `UModal`; neither is used anywhere in the app yet, but both are already available (no new dependency).

### Established Patterns
- VueUse `useStorage` wraps every piece of persisted state (picks, autofilled, manual tiebreakers) — the scenario registry and active-scenario pointer should follow the same wrapper.
- Corruption/invalid-shape recovery: a try/catch around `JSON.parse` inside the `useStorage` serializer's `read()`, silent reset to a safe default on failure, established three times already (`usePicksStorage`, `useAutoFilledGames`, `useManualTiebreakers`). The scenario registry and active-scenario pointer should follow this exact shape for their own corruption cases (D-17).
- `cfb_<thing>_<season>` key naming convention, `season = 2026` default parameter threaded through every composable — extends naturally to `cfb_<thing>_<season>_<scenarioId>`.

### Integration Points
- `app/pages/week/[week].vue` currently hardcodes `usePicksStorage(2026)`, `useAutoFilledGames(2026)`, and `useStandings(2026)` — these three call sites need a scenario id threaded through once the switcher exists.
- `PickProgress.vue` / `PickProgressWeek.vue` already take `props.season` — same extension shape applies for a scenario id.
- No existing confirm-modal or dropdown-menu component anywhere in `app/` — Phase 7 establishes both patterns fresh rather than reusing prior art.

</code_context>

<specifics>
## Specific Ideas

All four grey-area proposal batches (data model/storage, switcher UI, management actions, edge cases) were accepted as recommended, with no changes requested. Recommendations were grounded directly in Phase 4's D-18 (which explicitly anticipated scenario-scoped storage keys), the existing composable architecture's `season` parameter shape, and the corruption-recovery precedent already established three times over (D-07/D-08 pattern).

</specifics>

<deferred>
## Deferred Ideas

- Encoding the active scenario into the URL — Phase 8 (Share Links) owns URL encoding; keeping this phase's boundary clean.
- A maximum scenario count / cap — no current requirement; left as Claude's Discretion only if the switcher UI design needs one.
- A dedicated "Manage Scenarios" page/modal separate from the switcher dropdown — considered as an alternative in Area 3, not pursued; the inline-in-dropdown approach is lighter and sufficient for SCEN-01..05.
- SCEN-06 (cross-scenario champion summary) and SCEN-07 (side-by-side scenario pick diff) — already tracked as v2 requirements in REQUIREMENTS.md; reaffirmed out of scope here.

</deferred>

---

*Phase: 7-Named Scenarios*
*Context gathered: 2026-08-19*
