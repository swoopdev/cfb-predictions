# Requirements: CFB Predictions

**Defined:** 2026-08-12
**Core Value:** Pick a game, and every downstream consequence — records, conference standings, tiebreakers, championship game matchups — updates correctly and instantly.

## v1 Requirements

### Data Pipeline (DATA)

- [x] **DATA-01**: A committed, season-namespaced JSON dataset of all 2026 FBS teams (conference, colors, logo, CFBD id) exists, produced by a one-time fetch script
- [x] **DATA-02**: A committed, season-namespaced JSON dataset of all 2026 FBS games (teams, week, conference-game flag, neutral-site flag, championship-game flag) exists, produced by the same fetch script
- [x] **DATA-03**: Every dataset carries a `scheduleHash` fingerprint so stored scenarios and share links can detect a stale schedule
- [x] **DATA-04**: Team logos are vendored into the repo at build time (not hotlinked), sourced from CFBD's own `/teams` logo URLs with a placeholder fallback for teams with no available logo
- [x] **DATA-05**: A build-time validation script fails loudly and lists any team missing a logo, color, or required field, and produces a committed coverage report
- [x] **DATA-06**: `conferenceGame` is trusted directly from CFBD data, never re-derived from comparing team conferences
- [x] **DATA-07**: Non-regular-season games (conference championships) are excluded from regular-season standings computation

### Foundation (FOUND)

- [ ] **FOUND-01**: The app runs as a fully static site with no runtime API key and no server routes
- [ ] **FOUND-02**: A single query-key factory and set of composables (`useTeams`, `useGames`) provide typed, cached access to the static datasets via TanStack Query
- [ ] **FOUND-03**: A production build shows zero network fetches for schedule/team data after initial load

### Slate & Navigation (SLATE)

- [ ] **SLATE-01**: User can browse the schedule week by week, with a control to move to the next/previous week
- [ ] **SLATE-02**: User can filter the visible slate down to a single conference (SEC, Big Ten, Big 12, ACC) or "All"
- [ ] **SLATE-03**: User can filter the visible slate down to a single team's games
- [ ] **SLATE-04**: Every game in the slate displays both teams' logos and names
- [ ] **SLATE-05**: Filter selections (week, conference, team) are reflected in the URL so views are linkable and back/forward navigation works

### Picks & Persistence (PICK)

- [ ] **PICK-01**: User can pick a winner for any game with a single interaction (click a team)
- [ ] **PICK-02**: Clicking the already-picked winner again clears the pick
- [ ] **PICK-03**: Picks persist across browser sessions via localStorage, namespaced by season
- [ ] **PICK-04**: Each pick records provenance (user-made vs. auto-filled) so bulk-fill and future result-locking can distinguish them
- [ ] **PICK-05**: User can bulk-fill all remaining unpicked games in a week (or the whole season) with the home team, without overwriting existing picks
- [ ] **PICK-06**: User can clear all picks in a week, or all picks in the season, with confirmation required for the season-wide action
- [ ] **PICK-07**: A visible progress indicator shows how many games are picked out of the total, overall and per week
- [ ] **PICK-08**: Corrupt or unreadable stored pick data is preserved under a separate key rather than silently discarded, and the app recovers gracefully

### Standings (STAND)

- [ ] **STAND-01**: Conference standings display rank, team, conference record (W-L), and overall record (W-L) for each of SEC, Big Ten, Big 12, and ACC
- [ ] **STAND-02**: Standings recompute immediately when any pick changes, with no perceptible delay
- [ ] **STAND-03**: Conference win/loss/games-played are tracked as separate values, never collapsed to a single win percentage, so unbalanced conference schedules remain comparable
- [ ] **STAND-04**: Teams tied on the relevant standings criteria are visually indicated as tied, before any tiebreaker is applied

### Tiebreakers (TIE)

- [x] **TIE-01**: The two conference championship game participants for each of SEC, Big Ten, Big 12, and ACC are resolved automatically wherever the published conference procedure is computable from picked game outcomes
- [x] **TIE-02**: Each conference's tiebreaker procedure is implemented per its own official published rules, including correct handling of unbalanced schedules and non-percentage tie definitions where applicable (e.g. ACC)
- [x] **TIE-03**: Multi-team ties correctly restart the tiebreaker procedure from the first step when a step only partially separates the group, and continue to the next step when a step separates no one
- [x] **TIE-04**: When a tiebreaker procedure bottoms out at a step that cannot be computed from picks alone (a ranking/rating step, or a step requiring scores), the tied teams are surfaced to the user with an explanation of why, and the user selects who advances
- [ ] **TIE-05**: The resolution UI shows the step-by-step reasoning that produced the result — the tied group, the step applied, each team's value at that step, and any restart events — not just the final answer
- [ ] **TIE-06**: A manual tiebreaker selection is tied to the specific tied group and step it resolved, so it stays valid if picks are unchanged and is invalidated (not silently misapplied) if the tied group changes
- [ ] **TIE-07**: The resolved conference championship matchup (or the pending tie) is displayed as a dedicated, prominent element above each conference's standings table

### Scenarios (SCEN)

- [ ] **SCEN-01**: User can create multiple named prediction scenarios, each with its own independent set of picks
- [ ] **SCEN-02**: User can switch between saved scenarios
- [ ] **SCEN-03**: User can rename or delete a saved scenario, with confirmation required for delete
- [ ] **SCEN-04**: User can duplicate an existing scenario under a new name
- [ ] **SCEN-05**: No account or login is required to create or save scenarios

### Sharing (SHARE)

- [ ] **SHARE-01**: User can generate a shareable URL that encodes a scenario's picks and any manual tiebreaker overrides
- [ ] **SHARE-02**: Opening a share link does not silently overwrite the visitor's own existing picks — they see a banner indicating they're viewing a shared scenario, with an option to save a copy
- [ ] **SHARE-03**: If a share link's schedule fingerprint doesn't match the current dataset, the app reports how many picks applied rather than silently misapplying or dropping them
- [ ] **SHARE-04**: Incoming share-link payloads are validated before being applied (unknown game ids rejected, size capped) since they are untrusted input

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Playoff

- **CFP-01**: 12-team CFP bracket seeding (5 highest-ranked conference champions + 7 at-large)
- **CFP-02**: User can pick winners through the CFP bracket to a national champion

### Live Results

- **LIVE-01**: Completed real-world games auto-fill with the actual result
- **LIVE-02**: Auto-filled results remain user-editable for counterfactual exploration
- **LIVE-03**: A server route or scheduled rebuild refreshes results without exposing the CFBD key to the browser

### Standings Depth

- **STAND-05**: Clinched/eliminated indicators in standings
- **STAND-06**: Head-to-head indicator column in standings
- **STAND-07**: G5 conference standings and championship resolution

### Scenario Depth

- **SCEN-06**: Cross-scenario summary comparing projected champions
- **SCEN-07**: Side-by-side scenario pick diff

## Out of Scope

| Feature | Reason |
|---------|--------|
| Score prediction per game | CFB conference tiebreakers never use points (except one SEC step, itself out of scope); multiplies input cost for no standings benefit |
| Tie / "no contest" game outcomes | FBS football has no ties; carrying the enum values invites dead-path bugs through standings and tiebreaker logic |
| Predictive auto-pick from power ratings | Requires a ratings data source not in scope; a wrong-looking auto-pick undermines trust more than an honest empty state |
| Side-by-side scenario diff view | Large surface for limited insight in v1; deferred to v2 as a lighter-weight champion summary |
| User accounts / server-side sync | Adds a backend to a deliberately static app; localStorage + share links satisfy the stated need |
| Live/auto-filled real results | Requires a server route holding the CFBD key or a scheduled rebuild; deferred until the core picking flow is proven. Pick provenance (PICK-04) is retained specifically so this can be added later without a data migration |
| G5 conference standings and championships | Each G5 conference publishes its own tiebreaker procedure with its own edge cases (e.g. Mountain West is not fully source-verifiable); G5 games remain pickable since they affect P4 overall records |
| 12-team CFP bracket | Depends entirely on conference champions being correct; building it before the standings/tiebreaker engine is proven guarantees rework |
| SportRadar as a data source | Paid/restricted redistribution terms; CFBD is free and its team IDs match the logo source |
| Leaderboards / compete mode / pick'em pools | A different product requiring accounts and live results; nothing in this scope supports it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| FOUND-01 | Phase 2 | Pending |
| FOUND-02 | Phase 2 | Pending |
| FOUND-03 | Phase 2 | Pending |
| SLATE-01 | Phase 2 | Pending |
| SLATE-02 | Phase 2 | Pending |
| SLATE-03 | Phase 2 | Pending |
| SLATE-04 | Phase 2 | Pending |
| SLATE-05 | Phase 2 | Pending |
| TIE-01 | Phase 3 | Complete |
| TIE-02 | Phase 3 | Complete |
| TIE-03 | Phase 3 | Complete |
| TIE-04 | Phase 3 | Complete |
| PICK-01 | Phase 4 | Pending |
| PICK-02 | Phase 4 | Pending |
| PICK-03 | Phase 4 | Pending |
| PICK-04 | Phase 4 | Pending |
| PICK-05 | Phase 4 | Pending |
| PICK-06 | Phase 4 | Pending |
| PICK-07 | Phase 4 | Pending |
| PICK-08 | Phase 4 | Pending |
| STAND-01 | Phase 5 | Pending |
| STAND-02 | Phase 5 | Pending |
| STAND-03 | Phase 5 | Pending |
| STAND-04 | Phase 5 | Pending |
| TIE-05 | Phase 6 | Pending |
| TIE-06 | Phase 6 | Pending |
| TIE-07 | Phase 6 | Pending |
| SCEN-01 | Phase 7 | Pending |
| SCEN-02 | Phase 7 | Pending |
| SCEN-03 | Phase 7 | Pending |
| SCEN-04 | Phase 7 | Pending |
| SCEN-05 | Phase 7 | Pending |
| SHARE-01 | Phase 8 | Pending |
| SHARE-02 | Phase 8 | Pending |
| SHARE-03 | Phase 8 | Pending |
| SHARE-04 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

**Note:** the count was corrected from a previously stated "42 total" — a direct count of `XXX-NN` requirement entries in this file totals 43. Phase 2 in the roadmap ("Foundation & Read-Only Slate") merges the FOUND and SLATE categories into one vertical slice; Phase 3 ("Tiebreaker Engine") corresponds to research/SUMMARY.md's "Phase 3b," promoted to a first-class, explicitly parallel phase.

---
*Requirements defined: 2026-08-12*
*Last updated: 2026-08-12 after roadmap creation*
