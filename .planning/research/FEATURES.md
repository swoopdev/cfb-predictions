# Feature Research

**Domain:** College football season predictor / "pick every game" scenario tool
**Researched:** 2026-08-12
**Confidence:** HIGH for the reference product's feature set (derived by direct inspection of playoffpredictors.com v2's shipped JS bundles), MEDIUM for adjacent products and community expectations (cross-checked across two or more independent sources)

## How This Was Researched

`v2.playoffpredictors.com` blocks scraping (HTTP 403) and is a client-rendered Angular SPA, so the marketing copy that search engines index says almost nothing about the actual UI. Instead the shipped application bundles were downloaded and mined for Angular template instructions, component selectors, enum definitions, and persistence code. Everything in the "Observed" column below is a literal string, class name, `data-testid`, or enum value read out of production code — not inference.

The single most important finding is that **the canonical reference product does not currently solve the problem this project is scoped around.** Its own marketing states the CFB Mega Picker "is in a very early alpha stage and is currently implemented with NFL Tiebreakers." Correct P4 conference tiebreakers are the open space.

The second most important finding: playoffpredictors' homepage sells on exactly this axis — *"We actually read the rulebook. Most playoff tools guess. We don't."* — while its **step-by-step tiebreaker explanations are a paid subscriber feature** ($2/month), and CBS-style editorial coverage says only that teams "would advance based on tie-breaking rules" without naming the step. Tiebreaker *reasoning*, shown inline and free, is the clearest differentiator available.

## Observed Interaction Patterns

### 1. The core picking interaction

**Observed (playoffpredictors v2, `app-mobile-football-game-channel`):** a game is an `<article class="mobile-football-game-card">` containing a meta line (`Game {n}` + status, defaulting to `"Pregame"`) and a `mobile-football-matchup` row of **three `<button>` elements**: `mobile-football-pick-away`, an optional `mobile-football-tie-pick`, and `mobile-football-pick-home`. Each team button contains a logo `<img>` and a `<span>` with the team abbreviation. **Picked state is an `active` CSS class applied to the winning team's button** — bound to `selectionType === SelectionType.awayWin` / `homeWin`. One click on the team = pick that team.

The pick toggle logic is explicit in the bundle: clicking the team that is *already* the winner resets `selectionType` to `none`; clicking the other team switches the winner. So it is **click-to-pick, click-again-to-unpick**, not a separate clear control.

The underlying enum is `none=0, homeWin=1, awayWin=2, tie=3, noContest=4`.

**Recommendation:** a **row** (not a card) with two pressable team targets, away above/left of home, each showing logo + name + record. Rows pack ~14 games per week into one screen; cards do not. Use `aria-pressed` on each team target, and communicate picked state with more than color (team-color fill *plus* a check or weight change) since PROJECT.md already flags team-color contrast risk. Drop `tie` and `noContest` entirely — FBS football has no ties, and carrying dead enum values invites bugs in the standings math.

**Bulk picking observed:** week panels expose `Clear Week` (icon `delete_sweep`) and `Complete Week` (icon `check_circle`), plus a `Randomize` / `Randomize Unscored` action and a global `Reset all`. Adjacent mature simulators go further with named **scenario presets** ("Vegas favorites", "home teams", "chalk", "chaos") that, crucially, "fill every game you haven't picked, and your own picks stay locked while they do."

### 2. Standings presentation

**Observed:** the reference product's standings are strikingly minimal. `app-mobile-football-standings` renders groups (heading `Conference` or `Division`) of rows that are `<button>`s containing only **team abbreviation + record string** (`W-L`, or `W-L-T` when ties exist), sorted by `conferenceRank`. Clicking a row selects the team and populates a `Selected Team` panel whose entire content is a `<dl>` of **Conference / Division / Record**, with the empty state "Tap a team in standings to inspect it here."

A desktop standings mini-table in the homepage hero shows four columns: **`AFC#` (rank), `Team`, `Rec`, `Div`** — i.e. rank, team, overall record, group record. Elsewhere in the app: `Conf`, `Conf. Games`, `Opp conf`, `Record`, `Conference standings`, `Conference seeding`. Adjacent simulators show "team logo/name, wins-losses record, and division record in parentheses (e.g. `0-0 (0-0)`)".

Notably: a `streak` column appears in **none** of the products examined. Streak is a live-results artifact; in a pure pick tool it is derivable but carries almost no decision value. Head-to-head is likewise **not** a standings column anywhere — it only ever surfaces inside tiebreaker explanation.

**Projected champion surfacing (observed):** rank cells are color-coded with a legend — *"Green rank = in the playoffs. Hover a rank for the tiebreaker reason."* There is no separate "your champion is X" element; the qualification state is encoded into the rank cell.

**Recommendation:** columns `#`, `Team`, `Conf` (W-L, the primary sort key), `Overall` (W-L). Add a **dedicated championship-game matchup card above each conference table** — "SEC Championship: #1 Georgia vs #2 Texas" — because in a divisionless P4 the top-two-by-conference-win-pct outcome *is* the product's answer, and burying it in row shading makes users hunt for it. Mark the two qualifying rows, and make the marker the click target for the tiebreaker explanation.

### 3. Tiebreaker UX — this is the differentiator

**Observed, three tiers of how existing products handle it:**

| Product | What it shows | Cost |
|---|---|---|
| playoffpredictors v2 | Hover tooltip on a rank cell giving "the tiebreaker reason" | Free |
| playoffpredictors v2 | *"Full tiebreaker explanations show the step-by-step reasons tied teams are ordered... especially useful when you build unusual scenarios and want to see exactly why teams land where they do"* | **Subscriber only, $2/mo** |
| playoffpredictors v2 | A static `/tiebreakers/cfb` reference page: per-conference step tables, each step badged **Live** or **Skipped**, with official-source links per conference | Free |
| CBS Sports / SI / AOL editorial | "Arizona State and Iowa State would advance to the title game based on tie-breaking rules" — the step is never named | Free |
| ESPN Allstate Playoff Predictor | No conference tiebreakers at all; users pick only the five championship-game winners | Free |

The reference product's own framing of what a picker *can't* know is worth quoting, because it defines the honesty bar:

> "Steps marked **Live** can be computed from picked game outcomes. Steps marked **Skipped** require official scores, CFP committee rankings, APR, or proprietary rating feeds. Those skipped steps are shown so the page does not overstate what the picker can know from wins and losses alone."

This is precisely the boundary PROJECT.md already identified. The reference product's answer is to *skip* those steps. **This project's answer — surface the tie to the user and let them choose — is strictly better, and no observed product does it.**

**Verdict: yes, showing tiebreaker reasoning is the single best differentiator available.** It is unpaywalled nowhere, it is the thing the domain's own market leader charges for, and it is the thing editorial coverage conspicuously omits.

**Recommendation:** for each conference, an always-visible "How this was decided" disclosure that renders the resolution as an ordered narrative: the tied group and their identical conference records → the step applied → each team's value at that step → who separated → and, critically, **an explicit "restarting with the remaining N teams" event**, because the Big 12 procedure removes superior/inferior teams and returns survivors to the start of the procedure. Rendering the restart is what proves the implementation is right; it is also the exact place PROJECT.md predicts implementations get it wrong.

### 4. Scenario management

**Observed (playoffpredictors v2 `Saved Scenarios`):** a Material table of scenarios with columns **Name** (inline-editable, `edit` icon, with save/cancel), **Description**, **Created On**, and row actions. Rows are **drag-reorderable** via `cdkDrag` with a `drag_indicator` handle, confirmed by the toast "Scenario reordered". Other toasts: "Scenario has been saved", "Scenario has been deleted". Deletion goes through a confirm dialog: *"Are you sure you want to delete this scenario? This cannot be undone."* / "Yes, delete" / "Cancel".

**Saving requires an account.** The empty state is a button reading *"Log in to view/save scenarios"*, and elsewhere *"Sign in to save scenarios."*

Opening a scenario calls `window.open(url, '_BLANK')` — **there is no side-by-side comparison feature.** Comparing scenarios means opening browser tabs.

**Observed share encoding — the most reusable finding in this document:**

```js
this.urlStore.setSerializationArrayItem(game.gameScheduleNum, game.selectionType, true);
const saveString = LZ.compress(this.urlStore.gameSerializationArray().join(""));
window.localStorage.setItem(key, saveString);
```

Picks are a **positional array indexed by game number, one small integer per game, joined into a string, then LZ-compressed**. That one `saveString` is used identically for localStorage, for the `?L=` URL parameter, and for server persistence. The array is initialised `new Array(total).fill(0)`.

Restore URLs look like `https://v2.playoffpredictors.com/football/cfb/{leagueGuid}?L={saveString}&seed1={teamId}&seed2={teamId}...`. Note that **manual CFP seed assignments ride as separate query parameters, not inside the picks blob** — a second channel bolted on beside the picks array.

Adjacent simulators describe the share contract plainly: *"generates a link that encodes every pick you've made; anyone who opens it sees your season exactly as you built it."*

**Recommendation:** the same positional-digit + compress approach is right here — ~800 games at one digit each is a highly repetitive string that LZ compresses to a very short token, and it needs no backend. Two improvements over the reference product: (a) scenarios save to localStorage with **no login**, which removes the reference product's single biggest friction point; (b) an opened share link shows a banner — *"You're viewing a shared scenario"* with **"Save a copy"** — rather than silently overwriting the visitor's own picks. Silent overwrite is the obvious failure mode of a URL-driven pick state and no observed product handles it.

### 5. Onboarding and the empty state

**Observed:** the reference product initialises every game to `0` (`none`). **It starts completely empty — defaulting all picks is not the standard.** It does ship a `pp-schedule-progress` component, indicating pick progress is surfaced.

Adjacent simulators fill the gap differently and better: presets *"fill every game you haven't picked, and your own picks stay locked while they do"*, and *"Auto-fill and Simulate Season exist to fill gaps. If an automatic pick looks wrong for the story you want to test, change it manually."*

**Recommendation:** start empty, but never show the user a bare 800-game void.

- Open on **Week 1**, not on a full-season list. Week-first navigation (already a PROJECT.md decision) is itself the primary anti-overwhelm mechanism — 14 conference games is a comprehensible unit of work.
- Show a persistent progress affordance (`n of 812 games picked`) and per-week completion state so the season reads as a checklist rather than a wall.
- Offer **"Pick home team for the rest of this week"** and **"Pick home team for all remaining games"**. Home-team default is the only auto-fill available without adding a ratings data source, which PROJECT.md's constraints exclude — and it is honest, since it makes no claim to predictive authority.
- Do **not** silently pre-fill on first load. A pre-filled season the user did not author reads as the app's prediction, not theirs, and it destroys the "n picked" signal that makes progress legible.

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click pick a winner per game | The entire product. Observed as a single button press on the team, with click-again-to-unpick | LOW | Row with two pressable team targets; `aria-pressed`; state shown by fill + icon, not color alone |
| Week-first navigation with a week selector | Every observed product; chips with an `active` state, plus prev/next arrows in adjacent sims | LOW | Already a PROJECT.md decision. Week chips + `‹ ›` |
| Picks persist across sessions | Users build a season over multiple sittings; losing 800 picks is unforgivable | LOW | localStorage, season-namespaced key |
| Standings recompute instantly from picks | The stated Core Value; observed as immediate update in every product | MEDIUM | Derived/computed state, not stored |
| Conference standings with `#`, Team, Conf record, Overall record | The universal column set across all observed products | LOW | Conf W-L is the primary sort key |
| Automatic tiebreaker resolution to a champion | The reason to use a tool instead of a spreadsheet | **HIGH** | The hard part. Multi-team ties with restart semantics per conference |
| Projected championship game matchup per conference | The product's answer; observed encoded into rank color in the reference product | LOW | Given standings, this is a read of the top two |
| Filter the slate by conference | Observed as `app-mobile-football-cfb-scope` — a "CFB View / Scope" chip row | LOW | Note the reference product's caveat: scope filters *games*, standings stay league-wide |
| Filter/inspect by team | Observed: standings rows are buttons opening a Selected Team panel | LOW | Team view = filter over the one slate, per PROJECT.md |
| Team logos and identity on every pick target | Every observed product; picks are visually scanned by logo, not read | LOW | Already planned via CFBD `cfb-web` |
| Clear/reset picks | Observed: `Clear Week`, `Reset all`, `↻ Reset picks` | LOW | Needs a confirm for the global reset |
| Bulk-fill remaining games | Observed at week level (`Complete Week`) and season level (presets) | MEDIUM | Must fill only *unpicked* games and leave user picks locked — see dependency notes |
| Pick progress indicator | Observed as `pp-schedule-progress`; the antidote to 800 empty rows | LOW | `n of N picked`, per-week completeness |
| Mobile-usable layout | The reference product ships a dedicated mobile shell with its own components | MEDIUM | Rows + chips scale down; wide tables do not |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Correct P4 conference tiebreakers** | The market leader's CFB picker is explicitly "early alpha... implemented with NFL Tiebreakers." Simply being right is the differentiator | **HIGH** | Needs hand-verified fixture tests per conference, especially multi-team + restart |
| **Free, inline, step-by-step tiebreaker reasoning** | playoffpredictors paywalls this at $2/mo; CBS-style coverage omits the step entirely; nobody shows it free and inline | MEDIUM | Depends on the tiebreaker engine returning a reason trace, not just an order |
| **Rendering the "restart with remaining teams" event** | This is the step implementations get wrong. Showing it is proof of correctness and is genuinely novel | LOW *(given the trace)* | Pure presentation once the engine emits structured steps |
| **User resolution at non-computable steps** | The reference product *skips* steps needing CFP rankings/APR/ratings. Handing the choice to the user is strictly more useful and more honest | MEDIUM | Already a PROJECT.md decision. Must persist the choice and carry it in the share link |
| **Named scenarios with no account required** | The reference product gates saved scenarios behind login — its single largest friction point | LOW | localStorage; name, created date, duplicate, delete |
| **Share link that never clobbers the visitor's picks** | No observed product handles the collision between an incoming `?L=` and existing local picks | LOW | Banner + "Save a copy" on open |
| **A public per-conference tiebreaker rules page with sources** | The reference product does exactly this and it is good; matching it builds trust cheaply and earns search traffic | LOW | Static content page citing official conference rules |
| Honest labeling of what the tool cannot know | Direct precedent: "shown so the page does not overstate what the picker can know from wins and losses alone" | LOW | Copy work; large trust payoff |
| Scenario duplicate ("fork this scenario") | The natural workflow — "same season but Alabama loses in week 9" — and unobserved as a first-class action | LOW | Copy the picks blob under a new name |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Score prediction per game | Feels more "real"; NFL tiebreakers genuinely need points | CFB conference tiebreakers never use points. It multiplies input cost per game by ~4 for zero effect on the output. Already Out of Scope in PROJECT.md | Winners only |
| Tie / "no contest" outcomes | Present in the reference product's enum (`tie=3`, `noContest=4`) so it looks standard | Those exist for NFL/soccer. FBS has no ties. Carrying them adds dead branches through every standings and tiebreaker path | Two-state pick; delete the enum values |
| Predictive auto-pick from power ratings | "Just fill it in for me sensibly" | Requires a ratings source PROJECT.md excludes, and a wrong-looking auto-pick makes the app look broken rather than empty. Adjacent tools that do this need a whole "chaos slider" to manage the resulting expectations | Home-team fill + randomize; both are honest and need no new data |
| Side-by-side scenario diff view | Natural once multiple scenarios exist | The market leader doesn't have it — it opens scenarios in new tabs. A full pick-level diff across 800 games is a large surface for little insight | Browser tabs for v1; later, a compact "champion per conference, per scenario" summary row |
| User accounts and server sync | Enables cross-device and is what the reference product does | Adds a backend to a deliberately static app, and login is the reference product's biggest friction point. Already Out of Scope | localStorage + share links |
| Live/auto-filled real results in v1 | Obviously desirable mid-season | Forces a server route holding the CFBD key or a scheduled rebuild before the core picking flow is proven. Already Out of Scope — **but see structural accommodations, this one must not be architecturally excluded** | Ship static; reserve the pick-provenance field now |
| G5 standings and championships in v1 | The games are already in the dataset | Each G5 conference has its own published procedure with its own edge cases; the reference product itself flags Mountain West as not source-verifiable. Multiplies the highest-risk surface | G5 games pickable (they affect P4 overall records); P4 standings only |
| Leaderboards / compete mode / pick'em pools | The reference product ships `Compete` vs `Explore` modes, a Leaderboard, and a "Weekly Lock" | A completely different product (social competition against locked real results) requiring accounts, a backend, and live results. Nothing in v1 supports it | Out of scope; not even v2 |
| 12-team CFP bracket in v1 | The most exciting part, and the reference product leads with it | Depends entirely on conference champions being correct. Building it on an unproven standings engine guarantees rework. Already Out of Scope | v2, on top of a validated foundation |

## Feature Dependencies

```
Pick a winner (one click)
    └──requires──> Schedule + team data (games.json / teams.json)
    └──requires──> Pick storage keyed by stable game id

Conference standings
    └──requires──> Pick a winner
    └──requires──> Conference membership on each team

Tiebreaker resolution ──> Championship game matchup
    └──requires──> Conference standings
    └──requires──> Per-conference, per-season ruleset definition

Tiebreaker reasoning UI (differentiator)
    └──requires──> Tiebreaker engine emitting a STRUCTURED TRACE
                       (not just a sorted array)

Manual resolution at non-computable steps
    └──requires──> Tiebreaker trace (to know a step was reached)
    └──requires──> An override store separate from the picks array

Share link
    └──requires──> Deterministic pick serialization
    └──requires──> Stable game ordering/index
    └──requires──> Override channel (for manual tiebreaker choices)

Named scenarios
    └──requires──> The same serialization as the share link

Bulk fill ("pick home team for remaining")
    └──requires──> PICK PROVENANCE per game (user vs auto)

Live results (v2) ──conflicts──> Bulk fill, unless provenance exists
12-team CFP bracket (v2)
    └──requires──> Correct conference champions
    └──requires──> Conference championship games being pickable
```

### Dependency Notes

- **Tiebreaker reasoning UI requires a structured trace, not a sort.** This is the highest-leverage design decision in the project. If the tiebreaker engine is written to return an ordered array of teams, the differentiator is unbuildable without rewriting it. Write it to return an ordered array *plus* a list of applied steps — each with the tied group, the rule id, per-team values, who separated, and whether the procedure restarted. The UI, the manual-resolution prompt, and the test fixtures all read that one structure.
- **Bulk fill requires pick provenance.** Both independently-examined product families need it: playoffpredictors stores an `updateReason` per game (`Cleared=-1, Randomized=0, UserPick=1, ScheduleLoad=2, ScoreUpdate=3`), and adjacent simulators promise "your own picks stay locked" while presets fill the rest. A pick stored as a bare winner id cannot support "fill only what I haven't decided." Store `{ winner, source }` from day one — it is one extra field now and a data migration later.
- **Share link requires stable game ordering.** Positional encoding is the right call for size, but it means a re-run of the fetch script that reorders `games.json` silently corrupts every previously saved scenario and every shared link. Commit an explicit stable index (sorted by game id) and embed a short schedule fingerprint + format version in the payload so a mismatch can be detected and reported rather than silently mis-decoded.
- **Manual tiebreaker choices need their own channel in the payload.** The reference product bolted CFP seeds on as `&seed1=...&seed12=...` beside the picks blob rather than inside it — evidence that a single positional array cannot carry override state. Design the payload as a versioned envelope with `picks` and `overrides` from the start.
- **Championship matchup depends on the ruleset being season-scoped.** The ACC rewrote its tiebreakers after a five-way tie sent an eight-win Duke to the title game. Rulesets change between seasons, so they belong with the season data, not hard-coded in the engine.
- **Conference championship games must themselves be pickable.** They are the input the v2 bracket consumes. Even in v1 they complete the season narrative and produce the final overall records.

## MVP Definition

### Launch With (v1)

- [ ] **Week-first slate with one-click picking** — the product; nothing else matters without it
- [ ] **Pick persistence in localStorage, season-namespaced** — an 800-game investment cannot evaporate on refresh
- [ ] **Pick provenance field (`user` / `auto`) on every pick** — costs nothing now, unlocks bulk fill and blocks a v2 rewrite
- [ ] **Conference standings (`#`, Team, Conf, Overall) for SEC / B1G / Big 12 / ACC** — the visible consequence of picking
- [ ] **Tiebreaker engine returning an ordered result plus a structured step trace** — the Core Value, and the substrate for the differentiator
- [ ] **Championship game matchup surfaced per conference** — the product's answer, stated plainly
- [ ] **Inline "how this was decided" tiebreaker explanation, including restart events** — the differentiator, free and default
- [ ] **Manual selection when a tie reaches a non-computable step** — the honest answer where the market leader skips
- [ ] **Conference and team filters over the one slate** — how the season is actually consumed
- [ ] **Named scenarios in localStorage: create, switch, rename, duplicate, delete** — no login
- [ ] **Share link (versioned envelope: picks + overrides, compressed)** with a "you're viewing a shared scenario / save a copy" banner
- [ ] **Pick progress indicator + week completion state** — the empty-state antidote
- [ ] **Bulk fill: home team / randomize, for a week and for all remaining** — fills only unpicked games
- [ ] **Reset week / reset all, with confirmation on the destructive one**
- [ ] **Static per-conference tiebreaker rules page citing official sources** — cheap trust, matches the market leader

### Add After Validation (v1.x)

- [ ] **Clinched / eliminated indicators** — trigger: users start asking "is this already decided?". Adjacent products show these "only when mathematically guaranteed," which for a 12+ team divisionless conference is a real combinatorial cost. Defer until the tiebreaker engine is trusted
- [ ] **Head-to-head badge in standings between adjacent teams** — trigger: users report confusion about ordering that the tiebreaker panel already explains but doesn't foreshadow
- [ ] **Cross-scenario champion summary** ("SEC champ in each of my 4 scenarios") — trigger: users maintaining 3+ scenarios. Far cheaper than a full diff
- [ ] **G5 standings and championships** — trigger: demand. The data is already fetched; the cost is per-conference rule research
- [ ] **Team season view** (a single team's 12 games as one pickable list) — trigger: "I only care about my team"
- [ ] **Shareable image / OG card of a scenario's champions** — trigger: share links get used at all

### Future Consideration (v2+)

- [ ] **12-team CFP bracket and seeding** — defer: entirely dependent on conference champions being correct. Structural note below
- [ ] **Live / auto-filled real results** — defer: forces a backend. Structural note below
- [ ] **Week-Aware Mode** (recompute standings as of an earlier week) — the reference product charges for this; it needs a week-scoped standings computation the v1 engine should be able to accept as a parameter, but no UI in v1
- [ ] **Accounts / cross-device sync** — defer: contradicts the static-deploy constraint; share links cover most of the need
- [ ] **Compete mode / leaderboards / pools** — a different product entirely

### Structural Accommodations Required Now (to avoid a v2 rewrite)

These are the only places where deferred scope must still touch v1 design:

| v2 feature | What v1 must do | Cost if skipped |
|---|---|---|
| Live results | Store pick **provenance** (`user` / `auto` / `result`), and treat a `result` pick as locked/non-editable in the type model even though nothing produces one yet | Every pick record migrates; bulk fill and result-locking both rewritten |
| Live results | Keep the TanStack Query key factory and call sites uniform (already a PROJECT.md decision) so the JSON source can become an `/api/` route | Call-site churn across every component |
| CFP bracket | Make **conference championship games pickable game records** in the same store as regular-season games | The bracket's inputs live in a second, inconsistent place |
| CFP bracket | Payload envelope with a separate `overrides` channel (used by manual tiebreaker choices in v1, by CFP seeds in v2) | Share format breaks; the reference product's `&seedN=` bolt-on is what this avoids |
| CFP bracket | Standings engine exposes the **ordered list + reasons as data**, consumed by the UI — not computed inside a component | Seeding logic can't reuse conference results |
| Any future season | Tiebreaker rulesets are **data keyed by (season, conference)**, not code | The ACC already changed its rules; every rule change becomes an engine edit |
| Any future season | Stable game index + schedule fingerprint + format version inside every saved/shared payload | Re-running the fetch script silently corrupts saved scenarios and shared links |

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| One-click picking, week-first | HIGH | LOW | P1 |
| Pick persistence (localStorage) | HIGH | LOW | P1 |
| Pick provenance field | LOW *(today)* | LOW | P1 |
| Conference standings | HIGH | MEDIUM | P1 |
| Tiebreaker engine + structured trace | HIGH | HIGH | P1 |
| Championship matchup per conference | HIGH | LOW | P1 |
| Inline tiebreaker reasoning | HIGH | MEDIUM | P1 |
| Manual resolution at non-computable steps | MEDIUM | MEDIUM | P1 |
| Conference / team filters | MEDIUM | LOW | P1 |
| Named scenarios, no login | HIGH | LOW | P1 |
| Share link (versioned envelope) | HIGH | MEDIUM | P1 |
| Progress indicator + week completion | MEDIUM | LOW | P1 |
| Bulk fill (home team / randomize) | MEDIUM | LOW | P1 |
| Reset week / reset all | MEDIUM | LOW | P1 |
| Static tiebreaker rules page | MEDIUM | LOW | P2 |
| "Save a copy" on shared-link open | MEDIUM | LOW | P2 |
| Scenario duplicate | MEDIUM | LOW | P2 |
| Clinched / eliminated indicators | MEDIUM | HIGH | P3 |
| Head-to-head badge in standings | LOW | MEDIUM | P3 |
| Cross-scenario champion summary | MEDIUM | MEDIUM | P3 |
| G5 standings | LOW | HIGH | P3 |
| Side-by-side scenario diff | LOW | HIGH | P3 |

## Competitor Feature Analysis

| Feature | playoffpredictors.com v2 (reference) | CBS / SI editorial | ESPN Allstate Predictor | NFL-side simulators (nflschedulesimulator, sticktothemodel) | Our Approach |
|---------|--------------------------------------|--------------------|--------------------------|------------------------------------------------------------|--------------|
| Pick every game | Yes — `Game N` card, away/tie/home buttons, `active` class on winner | No | No — five championship games only | Yes — click team in a matchup row | Row with two pressable team targets, click-again-to-unpick, no tie state |
| Week navigation | Chip row with `active` state; `Clear Week` / `Complete Week` | N/A | N/A | `‹ ›` plus `Week 1…Week 18` | Week chips + prev/next; per-week bulk fill and clear |
| Standings columns | rank / Team / Rec / Div; mobile shows abbrev + record only | Prose | N/A | team / record / group record in parens | `#` / Team / Conf / Overall |
| Champion surfaced | Rank color-coding, "Green rank = in the playoffs" | Prose ("can clinch with a win") | Probability for one contender | Bracket panel | Explicit championship-game matchup card per conference |
| CFB tiebreaker correctness | **"Very early alpha... implemented with NFL Tiebreakers"** | Human-authored, correct but not interactive | N/A | NFL rules (correct for NFL) | Correct published P4 procedures, with restart semantics, fixture-tested |
| Tiebreaker reasoning | Hover tooltip free; **step-by-step is $2/mo**; static Live/Skipped rules page | "advance based on tie-breaking rules" — step never named | N/A | FAQ page only, never inline | Inline, free, default-visible, including restart events |
| Non-computable steps | Marked **Skipped**; not resolved | Cites "final CFP Rankings" | N/A | N/A | Surface the tie; user chooses; choice persists and shares |
| Saved scenarios | Yes — **requires login**; name, description, created date, drag-reorder, delete confirm | N/A | N/A | Presets, reset | localStorage, no login; name, duplicate, switch, delete |
| Compare scenarios | Open in new tab only | N/A | "switch up your picks and try again" | N/A | Tabs for v1; champion summary later |
| Share | `?L={LZ-compressed positional digits}`, plus `&seedN=` for manual seeds | N/A | N/A | "generates a link that encodes every pick you've made" | Versioned envelope (picks + overrides), compressed; "save a copy" banner on open |
| Default pick state | **Empty** — `new Array(total).fill(0)` | N/A | N/A | Empty, with presets to fill unpicked games | Empty, opening on Week 1, with progress + optional home-team fill |
| Business model | Ads + $2/mo subscription unlocking tiebreaker explanations and Week-Aware Mode | Ad-supported editorial | Sponsored | Ad-supported | None — everything free |

## Sources

Primary (direct inspection of shipped production code — HIGH confidence):

- `https://v2.playoffpredictors.com/` — Angular bundles `main-VQB5OZFB.js` and 29 route chunks, mined for component templates, selectors, `data-testid`s, enums (`selectionType`, `updateReason`), the scenario persistence service, and share-URL construction. Key components: `app-mobile-football-game-channel`, `app-mobile-football-standings`, `app-mobile-football-week-picker`, `app-mobile-football-cfb-scope`, `app-mobile-football-selected-team`, `app-cfb-tiebreakers`, `pp-week-panel`, `pp-schedule-progress`
- `https://v2.playoffpredictors.com/football/cfb` — CFB Mega Picker (page shell; content client-rendered)
- `https://playoffpredictors.com/CFBFootball/Playoffs`, `/CFBFootball/SEC`, `/CFBFootball/MAC`, `/home/cfb` — routing and share-URL patterns

Secondary (MEDIUM confidence — cross-checked across two or more independent sources):

- https://www.profootballnetwork.com/college-football-playoff-predictor — PFN CFB Playoff Predictor: Games panel, Simulate, Reset, Standings → Playoff
- https://www.cbssports.com/college-football/news/college-football-conference-championship-games-whos-clinched-updated-tiebreaker-scenarios-before-week-14/ — editorial scenario presentation; tiebreaker steps unnamed
- https://www.cbssports.com/college-football/news/acc-new-tiebreaker-rules-disaster-scenario/ — ACC tiebreaker rewrite after a five-way tie
- https://www.si.com/college-football/how-acc-fixing-tiebreakers-chaotic-season-eight-win-duke-capturing-football-title — same, with outcome detail
- https://big12ology.com/tiebreaker/how.html — Big 12 multi-team restart semantics
- https://www.espn.com/espn/feature/story/_/page/cfbplayoffpredictor/cfb-playoff-predictor — ESPN Allstate Playoff Predictor scope
- https://www.nflschedulesimulator.com/ and https://www.nflschedulesimulator.com/how-to — presets filling unpicked games with user picks locked; clinch/elimination only when mathematically guaranteed
- https://sticktothemodel.com/playoff-machine — week selector, standings columns, presets (Chalk/Chaos), Reset picks, share-link contract

## Gaps and Open Questions

- **The reference product's desktop CFB standings columns could not be confirmed directly.** Only the mobile shell's standings component and the homepage's NFL hero mini-table were fully recoverable from the bundles. The recommended column set is inferred from those two plus adjacent products; it is low-risk but not verbatim-verified.
- **No first-hand user complaints about tiebreaker correctness were found.** The "correctness is the differentiator" claim rests on the reference product's own alpha/NFL-tiebreaker disclosure and its own marketing positioning, not on observed user churn. Strong evidence, but indirect.
- **Clinched/elimination computation cost is unestimated.** Adjacent products advertise it as "mathematically guaranteed," which implies exhaustive or constraint-based search over remaining games — potentially expensive for a 16-team divisionless conference. Deferred to v1.x partly for this reason; if it is promoted, it warrants its own research pass.
- **G5 tiebreaker procedures are not uniformly published.** The reference product explicitly flags Mountain West as not source-verifiable ("I found only official top-two championship-format pages, not a public full tiebreaker sequence"). This corroborates keeping G5 standings out of v1.

---
*Feature research for: college football season predictor / pick-every-game scenario tool*
*Researched: 2026-08-12*
