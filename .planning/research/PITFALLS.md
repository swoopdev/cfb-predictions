# Pitfalls Research

**Domain:** College football season prediction / schedule-picker web app (static Nuxt 4 SPA, CFBD data, localStorage picks)
**Researched:** 2026-08-12
**Confidence:** HIGH for conference tiebreaker rules (primary policy documents retrieved verbatim for Big Ten, Big 12, ACC); MEDIUM for SEC (official release text reproduced by multiple independent outlets, primary PDF not directly retrievable); MEDIUM for stack/platform pitfalls (web sources, cross-checked).

> **Confidence tiering note.** The `classify-confidence` seam rates the `webfetch`/`websearch` providers LOW/MEDIUM generically. Three of the four conference procedures below were retrieved as the *primary policy documents themselves* (conference-published PDFs, extracted verbatim) and cross-checked against independent reporting. Those are recorded as HIGH on the strength of the artifact, not the transport. The SEC is explicitly MEDIUM because its primary PDF resisted retrieval.

---

## The One-Paragraph Version

The single largest risk in this project is not the tiebreaker *algorithm* — it is the assumption that a tiebreaker algorithm can produce an answer at all. Across all four power conferences the published procedures bottom out in an external computer rating (SportSource Analytics) that cannot be computed from win/loss picks. In the **ACC's July 2026 policy, head-to-head is the only computable step at all** — a two-team ACC tie where the teams did not play each other goes straight to a ranking the app cannot evaluate. In the **SEC**, the step before the draw is a *scoring-margin* metric, and this app deliberately does not collect scores, so the SEC effectively bottoms out one step earlier than it appears to. The manual-selection escape hatch in PROJECT.md is therefore not an edge case to bolt on at the end; it is a primary code path that must be designed in from the first tiebreaker commit, and the UI must make "the real rules stop here" legible rather than looking like a bug.

---

## Critical Pitfalls

### Pitfall 1: Treating multi-team tie procedures as a single linear pass

**What goes wrong:**
The natural implementation is a list of comparator functions applied in order to a group of tied teams: try step 1, if it doesn't separate them try step 2, and so on. This is wrong for every one of the four conferences. All four specify that when a step *partially* separates the group — one team advances or one team is eliminated — the **remaining teams return to the beginning of the procedure**, not to the next step. A linear pass produces a different (wrong) champion in exactly the messy scenarios users care about.

Concretely, the four conferences say:

- **Big Ten** (official PDF, verbatim): *"if a tiebreaker step produces standings with a clear No. 1 team by itself among the tied teams, that team is selected for the championship game and the remaining teams still in contention **revert to the beginning of the applicable tiebreaker procedures**"* — and, separately, *"If a tiebreaker step produces results with one team being eliminated from proceeding to the next step in the tiebreaker process, the team that is eliminated shall not be pulled back into the tiebreaker for any future step(s)."*
- **Big 12** (official PDF, verbatim): *"After one team has an advantage and is 'seeded', all remaining teams in the multiple-team tiebreaker will **repeat the tie-breaking procedure**. If at any point the multiple-team tie is reduced to two teams, the two-team tie-breaking procedure will be applied."*
- **SEC** (official release, reproduced): *"If, after any step in the following procedure, one or two teams are either superior or inferior to the others, they are removed from the tiebreaking procedure, and the remaining teams either go to the two-team tiebreaker or **return to the start of the three-team tiebreaking procedure**."*
- **ACC** (official PDF, verbatim): every multi-team step is suffixed *"if necessary, the tiebreaker will restart, **including the definition of tied teams**"* — the ACC restarts harder than anyone, re-deriving *which teams are even in the tie*.

There is a crucial counterpart rule that a naive "always restart" implementation also gets wrong. The Big Ten states: *"If all teams involved in the tie are tied after any step, all teams will continue to the next step in the tiebreaker procedures."* So the rule is **restart on partial separation, continue on no separation**. Both branches must exist.

**Why it happens:**
Blog summaries and TV graphics present tiebreakers as a flat numbered list ("Step 1, Step 2, Step 3…"), because that is how a two-team tie behaves. The restart semantics only live in the primary policy documents. A developer who reads three secondary sources will never encounter them.

**How to avoid:**
Model the procedure as a recursive function, not a fold over comparators:

```
resolve(group, procedure):
  for step in procedure:
    partition = step.apply(group)          # -> ordered buckets
    if partition separates nothing: continue      # all still tied -> next step
    if partition yields a single top team:
        seed(top); return resolve(rest, procedureFor(rest.size))   # RESTART
    if partition yields a single bottom team:
        eliminate(bottom); return resolve(rest, procedureFor(rest.size))  # RESTART
    if partition yields 2 teams on top:  return twoTeamProcedure(those two)
    ...
```
Two invariants worth asserting in code: (a) every recursive call receives a strictly smaller group, so the recursion terminates; (b) an eliminated team is never re-added.

**Warning signs:**
- The tiebreaker module exports an array of comparator functions and a `for` loop over it.
- There is no recursion and no function that calls itself with a reduced team set.
- Test fixtures only cover two-team ties.
- A four-way tie produces the same answer whether you restart or continue (this means your fixture is too easy — build one where the two differ and pin it).

**Phase to address:**
Tiebreaker engine phase. This should be the phase's defining design constraint, decided before any code is written.

---

### Pitfall 2: Assuming the tiebreaker always terminates in a computable answer

**What goes wrong:**
The app is built as if picks → standings → champions is a total function. It is not. All four conferences terminate in a **SportSource Analytics** rating plus a **random draw / coin toss**, neither of which is derivable from a set of picked winners. Worse, the depth at which this bites varies enormously by conference, and the ACC is catastrophic for the naive assumption:

| Conference | Computable steps before an uncomputable one | Practical consequence |
|---|---|---|
| **ACC (2026 policy)** | **Head-to-head only** | Any tie not settled by head-to-head is uncomputable. This is the *common* case, not the rare one. |
| **SEC** | H2H, common opponents, common-opponent-by-finish, cumulative opponent win pct | Step E is *capped relative scoring margin* — needs scores, which this app does not collect. Effectively uncomputable at step E. |
| **Big Ten** | H2H, common opponents, common-opponent-by-finish, cumulative opponent win pct | Step 6 is the ranking. Deepest computable path of the four. |
| **Big 12** | H2H, common opponents, next-highest-placed common opponent, opponent SoS, total wins in a 12-game season | Step f is the ranking. Also deep, and step (e) *total wins* is computable from picks. |

The SEC case deserves emphasis because it silently collides with a stated project decision. PROJECT.md scopes out score prediction: *"users pick winners, not scores. Standings only need W/L."* That is true for records and for four of the five SEC steps — but SEC step E is *capped relative total scoring margin* (a cap of 42 points scored on offense and 48 allowed on defense, each game's offensive and defensive margin clamped to ±100%, averaged across conference games). Without scores, the SEC's five-step procedure is really a four-step procedure that then hands off to the user.

**Why it happens:**
The "manual override at the ranking step" decision in PROJECT.md frames the escape hatch as a rare terminal case. Under the ACC's 2026 policy it is the *first* thing that happens after head-to-head, so a design that treats manual selection as a rarely-seen modal will feel broken in the ACC.

**How to avoid:**
- Make the tiebreaker's return type explicitly three-valued from day one: `Resolved(order)` | `NeedsUserInput(tiedTeams, reason, ruleCitation)` | `Impossible(reason)`. Do not return a bare array of teams.
- Carry a machine-readable *reason* on `NeedsUserInput` (`"ranking-step"`, `"needs-scores"`, `"draw"`) so the UI can explain *why* it is asking, quoting the actual rule.
- Persist the user's manual resolutions **into the scenario** alongside picks, keyed by (season, conference, the exact set of tied team IDs, the step reached). If a later pick change alters the tied set, the stale resolution must be invalidated rather than silently reapplied.
- Design the ACC standings view assuming manual resolution is the normal path.

**Warning signs:**
- `resolveTiebreaker()` returns `Team[]`.
- The UI has no affordance for "we can't compute this" other than an error state.
- Manual resolutions are stored in component state and vanish on navigation.
- Changing an unrelated game silently keeps a manual resolution that no longer applies.

**Phase to address:**
Tiebreaker engine phase (return type + reason codes); scenario persistence phase (storing and invalidating manual resolutions); standings UI phase (making the handoff legible).

---

### Pitfall 3: Deriving the ACC's tied group by grouping on win percentage

**What goes wrong:**
Every other conference defines the tie as "teams with equal conference winning percentage." The ACC's July 2026 policy **does not**. Verbatim:

> *"The Top Two Teams shall be the two ACC teams with the highest percentage of Conference wins during all regular-season Conference competition **and/or team(s) which played an alternate number of Conference games and have either the same number of Conference wins or the same number of Conference losses** as the team(s) with the highest percentage of Conference wins."*

and, as an explicit procedure:

> *"1. Defining Tied Teams: a. Step 1: Identify the team or teams with the best Conference win percentage; plus, b. Step 2: Any team or teams which played an alternate number of Conference games and have either the same number of Conference wins or the same number of Conference losses as the team(s) identified in Step 1. c. No other teams may be defined as Tied Teams."*

A team at 7-1 (.875) and a team at 7-2 (.778) are **tied** under this rule if one played eight conference games and the other nine, because they have the same number of conference wins. A `groupBy(winPct)` implementation will never put them in the same group and will produce the wrong ACC championship participants.

This is not hypothetical for 2026: the ACC moves to a nine-game conference schedule but **Boston College, Clemson, Florida State, Georgia Tech and North Carolina play eight**, because of previously scheduled Power 4 non-conference games. Mixed 8/9 schedules are guaranteed in the ACC in 2026.

Two further ACC subtleties in the same clause:
- *"In the event of a tie involving teams which played an alternate number of Conference games, all ties will be broken starting with the highest win percentage, working downward."*
- Every multi-team step restarts *"including the definition of tied teams"* — so after removing a team, you must **re-run the Tied Teams definition**, which can pull in a *different* set of teams than the previous iteration. The tied group is not a stable set across iterations.

**Why it happens:**
Standings tables are universally sorted by win percentage, so "tied" and "equal win percentage" feel synonymous. The ACC deliberately broke that equivalence to stop penalising eight-game teams.

**How to avoid:**
- Implement `defineTiedTeams(conference, standings)` as a **conference-pluggable strategy**, not a shared utility. The ACC's implementation is genuinely different from the other three.
- Make the ACC restart re-invoke `defineTiedTeams`, not reuse the previous group.
- Build a fixture with a mixed 8/9-game ACC season where a lower-win-percentage team must be included in the tie, and assert it appears.
- Store, per team, both `conferenceWins`, `conferenceLosses`, and `conferenceGamesPlayed` — do not collapse to a percentage early.

**Warning signs:**
- A single shared `getTiedGroups(standings)` used by all four conferences.
- The standings type exposes only `winPct`.
- No ACC test case where teams have different win percentages.

**Phase to address:**
Standings engine phase (data shape must retain wins/losses/games separately); tiebreaker engine phase (per-conference tied-group strategy).

---

### Pitfall 4: The circular dependency in "record vs. next highest-placed opponent"

**What goes wrong:**
Three of the four conferences include a step of the form "record against common opponents *in their order of finish in the standings*, proceeding down." But the order of finish is exactly what the tiebreaker is trying to determine. Implemented naively this either infinitely recurses or quietly uses a half-computed ordering, producing results that change depending on evaluation order.

The Big 12 is the only conference that spells out the resolution, and it is the model to follow for all of them (official PDF, verbatim):

> *"Win percentage against the next highest placed common opponent in the standings **(based on the record in all games played within the Conference)**, proceeding through the standings. **When arriving at another group of tied teams while comparing records, use each team's win percentage against the collective tied teams as a group (prior to that group's own tie-breaking procedure) rather than the performance against individual tied teams.**"*

Two rules fall out of that sentence:
1. The ordering used for "placed" is the **raw conference record ordering**, computed *before* any tiebreakers are applied. It is not the final resolved standings.
2. When the walk down the standings reaches a bucket of teams that are themselves tied, you do **not** recursively resolve that bucket. You treat the bucket as one composite opponent and compare each tied team's win percentage against the bucket as a whole.

Rule 2 is what makes the whole thing terminate. Without it, resolving a tie for first requires resolving the tie for fourth, which may require resolving the tie for first.

The Big Ten and SEC phrase this step less precisely ("order of finish within the conference standings", "highest placed common opponent … proceeding through the standings"). Their published documents do not contradict the Big 12's treatment, but they also do not state it. This is a genuine specification gap.

There is a second, separate trap in this step: the word **common**. The comparison is only over opponents *common to all tied teams*. With 16–18 team conferences playing 8–9 conference games, three tied teams may have very few common opponents, or none. The Big Ten's own published 2025 scenario sheet shows `Tiebreaker Step #3   N/A` for exactly this reason. "No common opponents" must mean *fall through to the next step*, not *everyone scores 0.000 and stays tied* — those are different outcomes when a later step would have separated them, and an empty-set win percentage of `0/0` is `NaN` in JavaScript, which silently poisons every comparison it touches.

**Why it happens:**
The step reads like a simple lookup until you try to write it. The circularity is invisible in two-team examples where the "standings" are just everyone else.

**How to avoid:**
- Compute a **base ordering** once, from raw conference win percentage only, and freeze it. Pass it into the tiebreaker as an input. Never recompute it mid-procedure.
- Represent the base ordering as an array of *buckets* (`Team[][]`), not a flat array, so tied groups are structurally visible and can be compared collectively.
- Make "no common opponents" and "no games against this bucket" return an explicit `Indeterminate` sentinel that means *advance to the next step*, never a number.
- Ban bare `wins / games` arithmetic in this module; use a helper that returns `Indeterminate` for a zero denominator. Add a test that asserts no `NaN` ever escapes the module.
- Where the SEC/Big Ten wording is silent, adopt the Big 12's collective-bucket treatment and **record it as an explicit documented assumption** in the code and in the phase's decision log, so a future correction is a one-line change rather than an archaeology exercise.

**Warning signs:**
- The standings ordering is a `computed` that the tiebreaker also feeds into (a reactive cycle — Vue will warn, or worse, won't).
- Any `NaN` in a rendered standings table.
- Sorting results that change when you change the iteration order of the teams array.
- A test suite with no "tied teams share zero common opponents" case.

**Phase to address:**
Tiebreaker engine phase. The frozen base-ordering decision should be made in the same commit as the tiebreaker's function signature.

---

### Pitfall 5: Applying head-to-head when it does not apply

**What goes wrong:**
In a 3+ way tie, "head-to-head" is only meaningful under specific conditions, and each conference states them differently. Implementations that just compute each tied team's record in games against the other tied teams and sort will produce answers the conference would not.

The conferences split into two shapes:

*Big Ten and Big 12* (near-identical wording, both from official PDFs):
> *"(a) If all teams involved in the tie did not play each other, but one team defeated all other teams involved in the tie, the team that defeated all other teams in the tie is removed from the tiebreaker, and the remaining teams revert to the beginning of the applicable tiebreaker process. (b) If all teams involved in the tie did not play each other and no team defeated all other teams involved in the tie, move to the next step in tiebreaker."*

Note what (a) says: the team that beat everyone is **"removed from the tiebreaker"** — in a first-place tie that means *seeded into the championship game*, and the rest start over. It does not mean "sorted to the top of a list."

*ACC 2026* branches on the same condition but with different consequences:
> *"i. If all the Tied Teams are common opponents: 1. The Tied Team with the best record among the Tied Teams…"*
> *"ii. If all the Tied Teams are not common opponents: 1. The Tied Team which defeated each of the other Tied Teams is placed into the Championship Game and removed from the tie. The tied team which lost to each of the other Tied Teams is removed from the tie…"*

So the ACC needs an explicit "did every tied team play every other tied team?" predicate to choose which branch of the procedure to run at all. And in the non-round-robin branch it can remove a team from **both ends** in a single step — the team that beat everyone advances, *and* the team that lost to everyone is eliminated.

The *SEC* uses the same round-robin/not-round-robin split: with a complete round robin among tied teams, sole possession of the best record advances (and if three or more tie for best record they restart among themselves while the others are eliminated); without one, only the beat-everyone / lost-to-everyone cases act.

With 16–18 teams playing 8–9 conference games, **a complete round robin among 3+ tied teams is rare**. The overwhelmingly common case is the partial-graph case, which is precisely the case a naive `sortBy(recordAgainstTiedTeams)` handles wrongly.

**Why it happens:**
Two-team head-to-head is trivially obvious, so developers generalise it to N teams by analogy rather than by reading the rule.

**How to avoid:**
- Write head-to-head as an explicit decision tree with a named predicate `isRoundRobinAmong(tiedTeams)`, not as a sort.
- Implement `beatAllOthers(team, group)` and `lostToAllOthers(team, group)` as first-class predicates, and handle the ACC case where both fire in the same step.
- Distinguish "did not play" from "played and lost" everywhere — a missing game is not a loss. This means the head-to-head submatrix needs three states per cell, not two.
- Test the specific shape: A beat B, B beat C, C did not play A. Every conference has a defined answer here and it is *not* "sort by record."

**Warning signs:**
- Head-to-head is one line: `teams.sort((a,b) => h2hRecord(b) - h2hRecord(a))`.
- No predicate named for round-robin-ness.
- The head-to-head matrix is a boolean 2D array.

**Phase to address:**
Tiebreaker engine phase.

---

### Pitfall 6: Unbalanced conference schedules silently corrupting comparisons

**What goes wrong:**
With 16–18 team conferences playing 8–9 conference games, conference records are not directly comparable, and several tiebreaker steps aggregate over "all conference opponents" — a set whose *size differs between the teams being compared*. Summing rather than averaging, or comparing raw records rather than percentages, biases the result toward whoever played more games.

Both conferences that anticipated this say so explicitly:

- **Big Ten** (official PDF, at both the two-team and multi-team versions of the opponent-strength step): *"In the event of an unbalanced schedule (i.e., less than nine conference games are played), the records of the … tied teams will be compared based on the best cumulative conference winning percentage of all conference opponents, **regardless of how many conference opponents each team played**. If winning percentage is equal for all conference opponents, move to next step in tiebreaker."*
- **ACC** handles it at the *definition* stage instead (see Pitfall 3), by admitting same-wins-or-same-losses teams into the tie.
- **SEC** guidance likewise uses winning percentage rather than record when a team has played fewer than nine conference games.
- **Big 12** step (e) — *total number of wins in a 12-game season* — carries its own normalisation: *"Only one win against a team from the NCAA Football Championship Subdivision or lower division will be counted annually,"* and games exempt under NCAA Bylaw 17.10.5.2.1 are excluded. A team with two FCS wins gets credit for one.

For 2026 specifically: the SEC moves to nine conference games (balanced across 16 teams), the Big Ten plays nine (18 teams), the Big 12 plays nine (16 teams), and **the ACC is mixed — five schools play eight, twelve play nine**. So the unbalanced-schedule path is not dead code; it is the ACC's default in 2026.

**Why it happens:**
Divisional-era college football had balanced-enough schedules that record comparison worked. The mental model persists.

**How to avoid:**
- Never compare raw win/loss records across teams anywhere in the tiebreaker. Always percentage.
- "Cumulative conference winning percentage of all conference opponents" means: collect each of a team's conference opponents, take each opponent's conference record, sum wins and sum losses across those opponents, then divide — a **record-weighted** aggregate. Verify against a hand-computed fixture; the alternative (mean of opponents' individual percentages) gives different answers and is a classic silent bug.
- Implement the Big 12's FCS-win cap in the "total wins" step; do not use the naive overall win count.
- Add a fixture with an 8-game ACC team and a 9-game ACC team tied under the ACC definition, hand-verified end to end.

**Warning signs:**
- Any comparison of the form `a.confWins > b.confWins` outside a step that explicitly calls for win counts.
- `opponents.map(o => o.winPct).reduce(avg)` — the un-weighted mean.
- Overall win totals used without the FCS cap in the Big 12.

**Phase to address:**
Standings engine phase (correct aggregate helpers); tiebreaker engine phase (using them).

---

### Pitfall 7: CFBD data assumptions that break on the real 2026 file

**What goes wrong:**
The schedule JSON contains rows that violate the app's implicit invariants, and each one crashes or corrupts a different part of the pipeline:

| Data reality | What breaks |
|---|---|
| **FCS opponents** appear as `homeTeam`/`awayTeam` with an id that is not in `/teams/fbs` | Team lookup returns `undefined`; overall-record computation for the FBS side silently drops the game or throws. In 2026 the FBS grows to **138** teams (North Dakota State and Sacramento State move up), so the FBS/FCS boundary itself shifted this year. |
| **`conferenceGame` is false for non-conference games between two same-conference teams** and, critically, is *not* a substitute for "both teams are in conference X" | Conference standings include games they shouldn't, or exclude games they should. Always filter on the flag *and* verify both teams' conference. |
| **`neutralSite: true`** games have a `homeTeam` that is not actually at home | Home/away UI is misleading; more importantly, conference championship games are neutral-site and must not be counted into regular-season conference records. |
| **Conference championship games** appear in the feed (`seasonType` / week beyond the regular season) | If ingested as regular-season games they feed back into the standings that determined the championship participants — a genuine circular corruption. Filter to `seasonType === 'regular'` for standings. |
| **Games with TBD opponents / `startTimeTBD`** and postponed or cancelled games | Null opponent ids; a "pick a winner" UI with one side undefined. |
| **2026 realignment** | The FBS churn this year is unusually large: the Pac-12 is rebuilt to eight (Boise State, Colorado State, Fresno State, Oregon State, San Diego State, Texas State, Utah State, Washington State), the Mountain West loses five and adds Northern Illinois, UTEP and North Dakota State, Louisiana Tech goes to the Sun Belt, Sacramento State replaces NIU in the MAC. The P4 lineups are unchanged, but any hard-coded conference membership or cached team list from a prior season is wrong. |
| **The logo repo is archived** | See Pitfall 8. |

**Why it happens:**
The fetch script is written against a spot-check of a handful of rows, usually a marquee P4 matchup, which exercises none of these cases.

**How to avoid:**
- Treat the fetch script's output as **untrusted input** and validate it at build time with a schema (Zod or similar), failing the build loudly on: unknown team id, null opponent, missing conference on a P4 team, a `seasonType` other than the expected set.
- Emit a **coverage report** from the fetch script: counts by conference, count of games with a non-FBS participant, count of neutral-site games, count of postseason games, count of teams with no logo. Commit it next to the JSON so drift between seasons is visible in a diff.
- Model FCS opponents as a first-class `OpponentRef` that may be `{ kind: 'fbs', id }` or `{ kind: 'non-fbs', name }`, rather than pretending every opponent is a full team. Non-FBS opponents contribute to the FBS team's overall record and nothing else.
- Filter to regular season for all standings math; handle championship games as a separate derived concept the app *produces*, not one it *reads*.
- Make games with a TBD/unknown opponent explicitly unpickable with a visible reason, rather than rendering a broken card.

**Warning signs:**
- `teams[game.homeId].conference` anywhere without a guard.
- Conference standings whose game counts don't match the published conference schedule length (9 for SEC/B1G/B12 in 2026; 8 or 9 in the ACC).
- A team's overall record having more or fewer than 12 regular-season games.

**Phase to address:**
Data pipeline phase. The validation and coverage report should ship in the same commit as the fetch script.

---

### Pitfall 8: The CFBD logo repo is archived and four years stale

**What goes wrong:**
PROJECT.md's plan is: *"Pull team logos from the CFBD `cfb-web` repo into `public/` at build time"* on the rationale that *"its team IDs match the logo repo, and schedule and logo join without a mapping layer."* The join does work — logos live at `public/logos/{teamId}.png`. But the repository state undermines the plan:

- `CFBD/cfb-web` is **archived (read-only)**, last pushed **2023-08-11**.
- The `public/logos` directory's last commit is **2022-09-01**.
- It contains **453** logo files.

So any team that entered FBS or rebranded after September 2022 has **no logo**: Jacksonville State and Sam Houston (2023), Kennesaw State (2024), Delaware and Missouri State (2025), and — directly relevant to this season — **North Dakota State and Sacramento State (2026)**. The 2026 Pac-12/Mountain West reshuffle also means many G5 teams are displayed under stale branding. Since the app fetches *all* FBS games so that P4 non-conference records are correct, these teams will absolutely appear on screen.

**Why it happens:**
The repo looks authoritative because it is under the CFBD org and the ID join is genuinely elegant. GitHub's archived banner is easy to miss when you are browsing a subdirectory.

**How to avoid:**
- Use the CFBD `/teams` endpoint's own `logos` array as the primary source (it carries current CDN URLs) and treat `cfb-web` as a fallback, or vice versa — but *have* a fallback.
- Have the fetch script **fail loudly on missing logos**, printing the list of team ids with no asset, rather than silently emitting broken `<img>` tags.
- Ship a deterministic placeholder: team initials on the team's primary color, generated at build time. This is needed regardless, for teams whose logo licence or availability changes.
- Never hotlink at runtime — PROJECT.md already decided this, and the archived-repo status is a second, stronger reason.

**Warning signs:**
- Broken image icons for G5 teams in week views.
- 404s in the build log that don't fail the build.
- The logo count in `public/` being lower than the team count in `teams.json`.

**Phase to address:**
Data pipeline phase.

---

### Pitfall 9: Reading localStorage during SSR / prerender

**What goes wrong:**
Nuxt 4 with a static target still *prerenders* on the server. `localStorage` does not exist there. Reading picks during render produces either a crash or — worse — a server-rendered "no picks" standings table that is then replaced by the real one on the client, which Vue reports as a hydration mismatch and which users see as a visible flash of empty standings.

Because *every* derived view in this app (standings, championship matchups, records) depends on picks, this is not one component's problem; it is a whole-app architectural decision.

**Why it happens:**
`localStorage.getItem` inside a composable is the shortest path to working code in dev, and dev-mode hydration warnings are easy to dismiss.

**How to avoid:**
- Establish one rule, enforced in review: **exactly one module touches `localStorage`**, and it does so only inside `onMounted` (or behind an `import.meta.client` guard). Everything else reads a reactive store that starts empty.
- Render standings with an explicit "loading picks" state rather than an empty state, so the pre-hydration frame is honest rather than wrong.
- `useCookie` is the usual Nuxt answer for SSR-safe persistence, but it is the wrong answer here: cookies cap around 4KB and are sent on every request. Scenario data is far too large. Stay with localStorage plus a client-only boundary.
- Consider `ssr: false` for the picking routes if the flash proves stubborn — this is a fully static app with no SEO requirement on those pages.

**Warning signs:**
- `Hydration node mismatch` or `Hydration text content mismatch` in the console.
- A flash of empty/default standings on reload.
- `localStorage` referenced in more than one file.

**Phase to address:**
Persistence phase, and it must land *before* the standings UI phase so the UI is built against the correct contract.

---

### Pitfall 10: Unversioned pick storage and stale share links

**What goes wrong:**
Two related failures, both of which corrupt real user data after a deploy:

1. **Schema drift.** The pick format changes (e.g. from `{gameId: winnerId}` to `{gameId: {winner, manualTiebreaks}}`) and returning users' stored blobs no longer parse. Without a version tag there is no way to detect this, so the app either throws on load or — more insidiously — coerces the old shape into something plausible and silently loses picks.
2. **Stale share links.** A share URL encodes picks against game ids from `games.json`. If the schedule JSON is regenerated (CFBD corrects a date, a game is added, an id shifts), a link created before the regeneration decodes into picks for games that no longer exist, or worse, picks that land on *different* games. The user sees a scenario that is subtly wrong with no indication anything happened.

**Why it happens:**
Version tags feel like ceremony on day one when there is only one format. Share links are usually built late, after the schedule JSON has stopped changing in the developer's local experience.

**How to avoid:**
- Namespace and version storage keys from the first commit: `cfbp:v1:2026:scenarios`. PROJECT.md already commits to season-parameterised keys; add the schema version to the same key.
- Write a `migrate(fromVersion, data)` chain and a test that loads a committed fixture of every historical format. This is cheap while there is one format and expensive once there are three.
- Include a **schedule fingerprint** (a hash of `games.json`) in both the stored scenario and the share payload. On load, compare. If it differs, do not silently apply — show "this link was created for an earlier version of the schedule; N picks could not be matched" and apply the ones that do match by game id.
- Guard every `JSON.parse` of stored data with a schema validation, and on failure preserve the raw blob under a `:corrupt` key rather than overwriting it. Users who lose a season of picks to an exception will not come back.
- Encode share payloads compactly (an ordered bitfield or run-length scheme over game ids rather than a JSON object) — see Pitfall 11 — and version the encoding itself.

**Warning signs:**
- Storage keys without a version segment.
- Any bare `JSON.parse(localStorage.getItem(...))`.
- No fixture directory of historical storage payloads.
- Share links tested only within a single session.

**Phase to address:**
Persistence/scenarios phase (versioning, migration); sharing phase (fingerprint, partial-apply UX).

---

### Pitfall 11: localStorage quota with multiple large scenarios

**What goes wrong:**
The budget is ~5MB per origin, and — the part that is usually missed — it is measured in **UTF-16 code units, roughly two bytes per character**, so the effective budget is about half of a naive byte estimate. A season is ~800+ FBS games. A verbose per-scenario encoding (`{"gameId": 401628319, "winnerId": 333, "pickedAt": "2026-08-12T..."}`) runs to tens of KB per scenario before the scenario list, manual tiebreak resolutions, and UI preferences. Users are explicitly invited to keep *multiple named scenarios*. Add Safari's stricter behaviour and private-browsing mode (where any write can throw `QuotaExceededError` immediately) and this becomes a real failure, not a theoretical one.

The failure mode is what makes it critical: `setItem` throws, and if the write is inside a click handler with no try/catch, the pick appears to be applied in memory but is never persisted. The user loses everything on reload with no warning.

**Why it happens:**
5MB sounds enormous relative to "a few hundred picks," so nobody measures. The UTF-16 doubling is not widely known.

**How to avoid:**
- Encode picks positionally, not as objects. With a canonical game ordering committed alongside `games.json`, a pick is 2 bits (unpicked / home / away) — an entire season fits in a few hundred bytes base64'd. This solves the quota, the share-link length, and the parse cost in one decision, and it is dramatically cheaper to adopt at the start than to retrofit.
- Wrap every write in a helper that catches `DOMException` with `name === 'QuotaExceededError'` and surfaces a real, blocking error to the user. Never fail silently.
- Instrument the current storage footprint in a debug view so growth is visible during development.
- Treat IndexedDB as the documented escape hatch if scenarios grow (it offers far more headroom and survives private browsing more often), but do not build it in v1.

**Warning signs:**
- `localStorage.setItem` without try/catch.
- Per-scenario payloads over ~50KB.
- No test with 10+ saved scenarios.

**Phase to address:**
Persistence/scenarios phase — specifically the encoding decision, which should be made before the first pick is ever persisted.

---

### Pitfall 12: Recomputing every standing on every pick click

**What goes wrong:**
The core interaction is "click a pick, watch everything update." The naive implementation recomputes all conference records, all opponent-strength aggregates, and all tiebreaker resolutions for all four conferences on every single click. Tiebreaker resolution is the expensive part: it is recursive, it aggregates over every team's full opponent list, and Pitfall 4's step walks the standings. Doing that for four conferences on every click, inside a synchronous event handler, produces exactly the input lag that makes a picking app feel broken — and it is worst late in the season, when ties are most common and the tiebreaker recursion runs deepest.

Compounding it: `~800 games` in a deeply reactive array means Vue's proxy machinery is tracking every property of every game object, and a week-first list rendering hundreds of rows re-renders far more than the one card that changed.

**Why it happens:**
It is genuinely fast enough with 20 games in a dev fixture. It degrades non-linearly with the full slate plus a late-season tie-heavy state.

**How to avoid:**
- **Layer the derivation and memoize per layer**: picks → per-team records → per-conference standings → tiebreaker resolution. A pick in the Big 12 must not invalidate SEC standings. Key the memo by conference.
- Compute records **incrementally** where possible: flipping one pick changes exactly two teams' records. A full recompute is unnecessary.
- Store the games array in `shallowRef` (or `markRaw` the game objects). Games are immutable static data — deep reactivity over them is pure overhead. Only the pick map needs to be deeply reactive, and it should be a flat `Record<gameId, winnerId>`, not nested objects.
- Keep the tiebreaker engine **pure and framework-free**: plain functions over plain data, no refs, no computed. This makes it unit-testable (essential given Pitfalls 1–6), independently memoizable, and trivially movable into a Web Worker if it ever needs to be.
- For the week list, `v-memo` on the row keyed by `[game.id, pick]`, and virtualize only if measurement says so — a single week is ~60-80 games, which is fine; a full-season flat list is not.
- Measure with the real 2026 dataset and a late-season pick state, not a fixture.

**Warning signs:**
- Visible lag between click and standings update.
- Vue DevTools showing every conference's standings recomputing on one pick.
- The tiebreaker module importing from `vue`.
- A `computed` chain more than three deep over the games array.

**Phase to address:**
Standings engine phase (layering, purity, memo keys); browsing UI phase (rendering strategy).

---

### Pitfall 13: Team colors as UI accents failing contrast

**What goes wrong:**
PROJECT.md's design intent — *"team color used sparingly as accents on picked winners and standings"* — collides with the reality of CFB palettes. The primaries include near-black (Army, Cincinnati, Iowa's near-black secondary, Purdue), near-white/very light (several teams' alternates), and mid-luminance saturated tones that fail against *both* light and dark surfaces. Contrast failure is the single most common accessibility violation on the web, and taking an arbitrary hex from an API and painting it behind text is the canonical way to produce it.

The specific failures for this app:
- Team color as a **background** behind white or dark text at small sizes — fails 4.5:1 constantly.
- Team color as **text** on the neutral surface — near-white teams vanish in light mode, near-black teams vanish in dark mode.
- Team color as the **only** signal that a game is picked — fails WCAG 1.4.1 (use of color) regardless of ratio, and is invisible to a colorblind user distinguishing two same-hue teams.
- A colored **focus ring** derived from team color fails the 3:1 non-text requirement for teams with low-contrast primaries.
- Two opposing teams whose primaries are near-identical (plenty of red/red and blue/blue matchups) become mutually indistinguishable.

**Why it happens:**
The CFBD `/teams` payload hands you `color` and `alternateColor` as ready-to-use hex strings. It looks like a solved problem.

**How to avoid — the standard mitigation:**
Never render the raw brand color against an arbitrary surface. Instead, at **build time**, derive a per-team accessible token set and commit it alongside `teams.json`:

1. For each team, take `color` and `alternateColor`.
2. Compute contrast against both the light and dark surface tokens.
3. Produce `accentOnLight` and `accentOnDark` by adjusting lightness (in OKLCH, which keeps hue and chroma stable while moving luminance) until the pairing clears **4.5:1** for text and **3:1** for UI elements and focus rings.
4. If a team's color cannot be brought to passing without becoming unrecognisable, fall back to the neutral accent and record it in the coverage report.
5. Emit these as CSS custom properties so Tailwind 4's CSS-first `@theme` and Nuxt UI's semantic color aliases consume them natively.

Doing this at build time rather than runtime means the cost is paid once, the values are inspectable in a diff, and no color math ships to the browser.

Alongside that:
- Confine the **raw** brand color to large decorative areas only — a logo chip, a 4px bar, a large fill — where the 3:1 large-element threshold applies and where no text sits on top.
- Always pair color with a non-color signal for picked state: a checkmark, a weight change, a border, a position shift.
- Use APCA (`Lc`) as a secondary check for small text on saturated colors; WCAG 2.x ratios are known to pass combinations that read poorly at small sizes, which is exactly the regime this app lives in.

**Warning signs:**
- `style="background: {team.color}"` anywhere in a component.
- Any team's name illegible in either light or dark mode.
- Picked vs. unpicked distinguishable only by hue.
- No committed contrast report.

**Phase to address:**
Design system phase — and the token generation belongs in the data pipeline phase's build script, so it is impossible to render an unvalidated color.

---

### Pitfall 14: Nuxt 4 / TanStack Query v5 / Tailwind 4 integration traps

**What goes wrong:**
Four independent traps, each cheap to avoid up front and annoying to diagnose later:

- **TanStack Query hydration.** The SSR pattern is a plugin that creates the `QueryClient`, installs `VueQueryPlugin`, dehydrates on the server's `app:rendered` hook into the Nuxt payload, and hydrates on the client's `app:created`. Get the order wrong and queries refetch on the client, defeating the point. There is a documented v5 issue (TanStack/query#7338) where hydrated queries under a Nuxt SSG build **cannot be reset or refetched** — directly relevant since this project uses `staleTime: Infinity` on prerendered static data. v5 also removed the boolean `dehydrate` options in favour of `shouldDehydrateQuery`/`shouldDehydrateMutation`.
- **`staleTime: Infinity` ≠ cached forever.** It means the data is never *stale*, so no background refetch. It says nothing about **garbage collection**: `gcTime` (default 5 minutes) still evicts inactive queries, and a remount then re-runs the query function. For bundled JSON that is harmless-but-wasteful; the fix is to set `gcTime: Infinity` alongside `staleTime: Infinity`. Worth knowing now, because when v2 swaps the JSON import for a real `/api/` route, the same config becomes a correctness question rather than a performance one.
- **Nuxt 4 structure.** Source moves under `app/`; `shared/` is the home for code used by both client and server; and `modules/`, `public/`, `shared/` and `server/` resolve from `rootDir`, not from a custom `srcDir`. Separately, `useAsyncData`/`useFetch` calls **sharing a key now share one set of `data`/`error`/`status` refs** and dispose when the last consumer unmounts — a real behavioural change if any code mutated fetched data in place. The repo is already on the Nuxt 4 starter, so the structure is correct; the risk is copying Nuxt 3-era snippets from blog posts into it.
- **Tailwind 4 + Nuxt UI 4.** Configuration is CSS-first via `@theme` in CSS — there is no `tailwind.config.js` to reach for, which invalidates most tutorial content. Nuxt UI v4 merges `ui-pro` into `@nuxt/ui`, and the `@source` directive must be updated to match Nuxt 4's `app/` layout or class detection silently misses files (styles just don't appear, with no error). Preflight now sets buttons to `cursor: default`; border utilities need explicit colors; shadow and blur class names shifted. Nuxt UI's semantic color aliases resolve against `@theme` colors, which is the hook the per-team accessible tokens from Pitfall 13 should plug into.

**Why it happens:**
All four libraries had major versions land recently, so the majority of available tutorial content describes the previous major.

**How to avoid:**
- Wire the vue-query plugin from the official Vue SSR guide, not a blog post, and verify no client-side refetch in the network tab of a production build.
- Set `gcTime: Infinity` with `staleTime: Infinity`.
- Verify the `@source` directive covers `app/` immediately after the first Nuxt UI component renders unstyled.
- Prefer the query-key factory from PROJECT.md as the single call-site abstraction, so the v2 switch to a live endpoint touches one file.

**Warning signs:**
- Network requests for `games.json` after hydration.
- Nuxt UI components rendering unstyled or with missing utilities.
- Copied config referencing `tailwind.config.js`.
- Hydration warnings originating from query-backed components.

**Phase to address:**
Foundation/scaffolding phase.

---

## Conference Tiebreaker Specification Source

The following is the extracted, citable rule set for the tiebreaker phase. **Treat this section as the specification input**, not the secondary summaries elsewhere in this document.

### ACC — as amended July 1, 2026 (2026 season)
Source: [ACC Football Tiebreaker Policy, July 2026 (PDF)](https://theacc.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf) · announcement: [theacc.com](https://theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx)

**Top Two Teams:** the two teams with the highest percentage of conference wins, *and/or* team(s) which played an alternate number of conference games and have either the same number of conference wins or the same number of conference losses as those teams. Must be postseason-eligible. Conference games against otherwise postseason-ineligible teams still count in the standings and in the tiebreaker.

**1. Defining Tied Teams**
- a. Identify the team(s) with the best conference win percentage; **plus**
- b. Any team(s) which played an alternate number of conference games and have either the same number of conference wins **or** the same number of conference losses as the team(s) in (a).
- c. *"No other teams may be defined as Tied Teams."*

**2. Once Tied Teams identified**
- a. If the tie involves teams that played an alternate number of conference games, break ties starting with the highest win percentage, working downward.
- b. **Two-Team Tie:** i. head-to-head winner → ii. better SportSource Analytics **Team Success Ranking** → iii. Commissioner's draw.
- c. **Three (or More) Team Tie:**
  - **i. If all Tied Teams are common opponents:** 1. best record among the Tied Teams → 2. best Team Success Ranking → 3. draw. *Each step: "if necessary, the tiebreaker will restart, including the definition of tied teams."*
  - **ii. If all Tied Teams are not common opponents:** 1. the team that defeated each of the others is placed into the Championship Game and removed from the tie; the team that lost to each of the others is removed from the tie → 2. best Team Success Ranking is placed into the game and removed → 3. draw. *Each step restarts, including the definition of tied teams.*

> **Implementation consequence:** head-to-head is the *only* step this app can compute. Everything past it requires manual user selection.

### Big Ten — official tiebreaker document (2024–present, 18 teams, 9 conference games)
Source: [2024 Big Ten Football Championship Game Tiebreaker (PDF)](https://bigten.org/api/media/file/697c15d2-6e70-4ca7-820e-61bebd904a9b-2024_Big_Ten_Football_Tiebreaker_-_FINAL_10__72_.pdf) · announcement: [bigten.org](https://bigten.org/fb/article/blt6104802d94ebe1ab/) · worked 2025 scenarios: [bigten.org](https://bigten.org/fb/article/58967/)

**A. Two teams tied**
1. Tied for No. 1 → both play; head-to-head winner is first-place team. If they did not play, go to A.3.
2. Tied for No. 2 → head-to-head winner represents. If they did not play, next step.
3. Record vs. all common conference opponents.
4. Record vs. common opponents with the best conference record, proceeding through common opponents by order of finish.
5. Best cumulative conference winning percentage of all conference opponents. (a) Unbalanced schedule (<9 conference games): compare cumulative conference winning percentage of all conference opponents *regardless of how many opponents each played*; if equal, next step.
6. Highest SportSource Analytics **Team Rating Score**.
7. Random draw by the Commissioner.

**B. Three or more tied for first** — governing clauses, verbatim in substance:
- After head-to-head, if a step produces a clear No. 1 alone, that team is selected and **the remaining teams revert to the beginning of the applicable procedure** (3 tied → the other two start the two-team procedure; 4 tied → the other three start the three-team procedure).
- If a step produces two teams tied for No. 1, both are selected; they run the two-team procedure for ranking.
- If a step produces two teams tied for a position other than No. 1, the head-to-head winner represents; if they did not play, use the two-team procedure. **If three or more remain tied after any step, move to the next step with the remaining teams.**
- **An eliminated team "shall not be pulled back into the tiebreaker for any future step(s)."**
- **"If all teams involved in the tie are tied after any step, all teams will continue to the next step."**

Steps: 1. winning percentage in games among the tied teams — (a) if not all played each other but one team beat all the others, that team is removed and the remainder **revert to the beginning**; (b) if not all played each other and no team beat all others, next step. 2. winning percentage vs. all common conference opponents played by all other tied teams. 3. winning percentage vs. the next highest placed common opponent in order of finish. 4. best cumulative conference winning percentage of all conference opponents (same unbalanced-schedule clause). 5. SportSource Analytics Team Rating Score. 6. Random draw.

*The document also covers postseason-ineligible teams and a cancelled championship game — out of scope for v1 but worth noting as defined behaviour.*

### Big 12 — official tiebreaker policy (2024–present, 16 teams)
Source: [Big 12 Football Tiebreaker Policy (PDF)](https://big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf) · [policy page](https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football)

**Two-Team Tie** — if two are tied for first, both play and the head-to-head winner is the No. 1 seed; if they did not play, run the procedure. If two are tied for second, the procedure decides the No. 2 seed.
- a. Head-to-head.
- b. Win percentage vs. all common conference opponents.
- c. Win percentage vs. the next highest placed common opponent in the standings *(based on record in all conference games)*, proceeding through the standings. **"When arriving at another group of tied teams while comparing records, use each team's win percentage against the collective tied teams as a group (prior to that group's own tie-breaking procedure) rather than the performance against individual tied teams."**
- d. Combined win percentage in conference games of conference opponents (strength of conference schedule).
- e. Total number of wins in a 12-game season. **Only one win against an FCS/lower-division team counts annually**; games exempt under NCAA Bylaw 17.10.5.2.1 are excluded.
- f. Highest SportSource Analytics **Team Rating Score**.
- g. Coin toss.

**Multiple-Team Ties** — *"After one team has an advantage and is 'seeded', all remaining teams in the multiple-team tiebreaker will repeat the tie-breaking procedure. If at any point the multiple-team tie is reduced to two teams, the two-team tie-breaking procedure will be applied."*
- a. Winning percentage in games among the tied teams: 1. if not all played each other but one beat all the others, that team is removed and the remainder **revert to the beginning of the applicable process**; 2. if not all played each other and no team beat all others, next step.
- b–g mirror the two-team steps (common opponents; next highest placed common opponent with the same collective-group clause; SoS; total wins with the FCS cap; Team Rating Score; coin toss).

### SEC — divisionless procedure (2024–present; 9 conference games from 2026)
Sources: [SEC announcement](https://www.secsports.com/news/2024/08/sec-announces-football-tie-breaking-process) · [ESPN](https://www.espn.com/college-football/story/_/id/40944783/sec-reveals-tiebreaking-procedures-conference-title-game) · [247Sports (full release + Appendix A example)](https://247sports.com/college/alabama/article/sec-announces-tiebreakers-to-determine-sec-championship-game-participants-234983170/) · [Pro Football Network (multi-team restart clause verbatim)](https://www.profootballnetwork.com/cfb/sec-tiebreakers-everything-to-know/) · [nine-game schedule from 2026](https://www.secsports.com/news/2025/08/sec-to-implement-nine-game-conference-football-schedule-in-2026)

**Ordered steps (apply to both two-team and multi-team ties):**
- A. Head-to-head competition among the tied teams.
- B. Record vs. all common conference opponents among the tied teams.
- C. Record against the highest (best) placed common conference opponent in the standings, proceeding through the standings.
- D. Cumulative conference winning percentage of all conference opponents. *(Winning percentage rather than record where a team played fewer than nine conference games.)*
- E. **Capped relative total scoring margin** per SportSource Analytics vs. all conference opponents — Appendix A: for each conference game, compute the team's offensive margin relative to what the opponent normally allows and its defensive margin relative to what the opponent normally scores, sum them, and average across conference games; **cap of 42 points scored on offense and 48 points allowed on defense**; each margin clamped to a maximum of +100% and a minimum of −100%. *(Worked example from the release: "Team A scored 10 more points than Team B allowed on average (31 – 21 = 10), so divide 10 by 21 to give us an offensive margin of 47.6%.")*
- F. Random draw of the tied teams.

**Multi-team semantics (verbatim):** *"If, after any step in the following procedure, one or two teams are either superior or inferior to the others, they are removed from the tiebreaking procedure, and the remaining teams either go to the two-team tiebreaker or return to the start of the three-team tiebreaking procedure."* For a first-place tie with a complete round robin: sole possession of the best head-to-head record advances; if three or more tie for the best record they revert to the beginning of the three-or-more procedure and the others are eliminated. Without a complete round robin: a team that beat all others advances, a team that lost to all others is eliminated, otherwise proceed to the next step. If a step leaves two teams tied for first, both qualify and the two-team procedure sets home/away for the championship game.

> **Implementation consequence:** step E requires scores. This app collects winners only, so the SEC is computable through step D and then requires manual user selection. This is a direct, load-bearing interaction with the "no score prediction" scope decision.

### Cross-conference summary

| | ACC (2026) | Big Ten | Big 12 | SEC |
|---|---|---|---|---|
| Conference games 2026 | **8 or 9 (mixed)** | 9 | 9 | 9 |
| Teams | 17 | 18 | 16 | 16 |
| Tie defined by | **wins OR losses OR win pct** | win pct | win pct | win pct |
| Multi-team on partial separation | **restart, incl. redefining the tie** | restart | restart ("repeat") | restart |
| Multi-team on no separation | next step | **next step (explicit)** | next step | next step |
| Eliminated team can return | no | **no (explicit)** | no | no |
| First uncomputable step | **#2 (ranking)** | #6 (ranking) | #6 (ranking) | **#5 (needs scores)** |
| Terminal step | draw | random draw | coin toss | random draw |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Linear comparator loop for tiebreakers | Ships a working two-team tiebreaker in an hour | Wrong champions in the scenarios users actually explore; the fix is a rewrite of the module, not a patch | **Never** — this is the app's core value proposition |
| One shared tiebreaker implementation with a per-conference step list | Feels DRY; PROJECT.md asks for one implementation | The ACC's tied-group definition and restart-with-redefinition are structurally different, not just a different step list | Acceptable only if "one implementation" means one *engine* with pluggable conference strategies |
| Verbose JSON pick encoding | Trivially debuggable | Quota exhaustion with multiple scenarios; long share URLs; a painful migration once real user data exists | Only behind a versioned schema with the migration path already written |
| Deriving accessible team colors at runtime | No build step | Color math shipped to every client; failures invisible until a user hits them | Never — build time is strictly better here |
| Skipping the schedule fingerprint on share links | Ships sharing a day earlier | Silently wrong scenarios for anyone with an older link; unfalsifiable bug reports | Never — the fingerprint is a few lines |
| Deep-reactive games array | Zero setup | Reactivity overhead on every pick, hard to unwind later | Acceptable pre-measurement only if `shallowRef` is a one-line change later |
| Manual tiebreak resolutions in component state | Simple | Lost on navigation; not shareable; not part of the scenario | Only for a throwaway spike |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| CFBD `/games` | Assuming every participant resolves in `/teams/fbs` | Model non-FBS opponents as a distinct variant; validate at build time |
| CFBD `/games` | Using `conferenceGame` alone to build conference standings | Require the flag *and* both teams in the conference *and* `seasonType === 'regular'` |
| CFBD `/games` | Ingesting conference championship games into regular-season standings | Filter by season type; the app *produces* championship matchups, it does not read them |
| CFBD API | Assuming generous limits for iterative development | Free tier is **1,000 calls/calendar month**; key may be disabled on overage. Cache raw responses to disk on first fetch and re-run the transform offline |
| CFBD API | Committing the key or shipping it to the client | One-time fetch script reads from env; static build carries no key (already the PROJECT.md decision — keep it) |
| CFBD/cfb-web logos | Assuming full, current coverage because IDs join cleanly | Repo is **archived**, logos last updated **Sept 2022**, 453 files. Fail the build on missing assets; generate placeholders; prefer `/teams` `logos` URLs as primary |
| SportSource Analytics | Attempting to approximate the rating with a homegrown formula | It is proprietary and unpublished. Hand the decision to the user and say so plainly |
| TanStack Query v5 + Nuxt SSR | Blog-post plugin setups written for v4 | Follow the official Vue SSR guide; `dehydrate` on `app:rendered`, `hydrate` on `app:created`; use `shouldDehydrateQuery` not removed booleans |
| Tailwind 4 + Nuxt UI 4 | Reaching for `tailwind.config.js`; stale `@source` after the Nuxt 4 `app/` move | CSS-first `@theme`; update `@source` to `app/`; expect silent missing styles, not errors |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Full standings recompute per pick | Input lag on click; fan spins | Layer + memoize by conference; incremental record updates | Immediately at full slate; worst late-season when tiebreakers recurse |
| Tiebreaker recomputed for all four conferences on any pick | Lag proportional to tie density | Invalidate only the affected conference; a non-conference pick invalidates no standings at all | Late season, when most conferences have live ties |
| Deep reactivity over ~800 game objects | Sluggish scroll and interaction across the app | `shallowRef`/`markRaw` for static games; keep the pick map flat | ~500+ objects with nested fields |
| Rendering the full season in one list | Slow initial paint, janky scroll | Week-first navigation already scopes this to ~60–80 games; virtualize only if a full-season view is added | A flat all-games view |
| Re-rendering every card when one pick changes | Whole-list flash on click | `v-memo` keyed on `[game.id, pick]`; stable `:key` on game id | Any week view |
| Deep `computed` chains over large arrays | Hard-to-attribute recompute storms in DevTools | Keep the chain ≤3 deep; push heavy math into pure memoized functions outside the reactivity system | Grows silently as features land |
| Parsing a large JSON pick blob on every scenario switch | Delay when switching scenarios | Positional/bitfield encoding; parse once per scenario and cache | 5+ scenarios |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Trusting share-link payloads | A URL is attacker-controlled input; a malformed or hostile payload can crash the app or poison stored scenarios | Validate the decoded payload against a schema before applying; reject unknown game ids; never `eval`/dynamic-import from the payload |
| Rendering CFBD-sourced strings as HTML | Team/venue names are third-party data; `v-html` turns them into an injection vector | Never `v-html` for data-derived strings; Vue's default interpolation escapes |
| Unbounded share payload | A very long URL can be used to hang the parser | Cap decoded payload size; reject oversized input before parsing |
| Committing the CFBD API key | Key disabled or abused; free-tier quota burned | Env var in the fetch script only; the static build contains no key |
| Overwriting corrupt stored data on parse failure | Irreversible loss of a user's season of picks | Preserve the raw blob under a `:corrupt` key and surface a recovery path |
| Redistributing restricted data | Licensing exposure | PROJECT.md already excludes SportRadar; keep the fetch script pinned to CFBD and check CFBD's terms before committing derived datasets |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Presenting a manual tiebreak prompt as an error | Users think the app is broken when it is faithfully reporting that the real rules stop here | Frame it as a decision point, quote the actual rule and conference, and link the source |
| Silently reusing a stale manual tiebreak after picks change | The standings are wrong and the user cannot tell why | Invalidate resolutions whose tied set no longer matches; re-prompt |
| Showing championship participants without showing *why* | The core value ("watch it recompute correctly") is unverifiable; users assume bugs | Render the tiebreaker trace: which step separated whom, in order |
| Team color as the only picked-state signal | Colorblind users and same-hue matchups become unreadable | Always pair with a shape/weight/position cue |
| Auto-picking favorites or leaving picks blank ambiguously | Users cannot tell "not yet picked" from "picked the home team" | Three explicit states, visually distinct |
| No indication that a share link partially applied | Users see a scenario they did not create | Explicit "N of M picks applied" with a diff |
| Losing picks silently on quota exhaustion | Catastrophic — a season of work gone on reload | Blocking, actionable error on write failure |
| Standings that don't say how many conference games each team has played | ACC 8-vs-9 comparisons look arbitrary or wrong | Show conference games played in the ACC standings; explain the tied-group definition inline |

---

## "Looks Done But Isn't" Checklist

- [ ] **Tiebreaker engine:** two-team ties work — verify **3-, 4-, and 5-way** ties, and at least one case where restart-vs-continue produces different champions
- [ ] **Tiebreaker engine:** verify the head-to-head partial-graph case (A beat B, B beat C, A did not play C) for each conference separately
- [ ] **Tiebreaker engine:** verify no `NaN` escapes when tied teams share zero common opponents
- [ ] **Tiebreaker engine:** verify eliminated teams never re-enter
- [ ] **ACC specifically:** verify a tied group containing teams with *different* win percentages (8-game vs 9-game)
- [ ] **ACC specifically:** verify the restart re-derives the tied group rather than reusing it
- [ ] **SEC specifically:** verify the procedure halts at step E and requests user input rather than skipping to the draw
- [ ] **Manual resolutions:** verify they persist across reload, travel in share links, and invalidate when the tied set changes
- [ ] **Standings:** verify every P4 team's conference game count matches the published 2026 schedule (9 for SEC/B1G/B12; 8 or 9 in the ACC)
- [ ] **Standings:** verify overall records include FCS and G5 opponents
- [ ] **Data:** verify no game references an unknown team id; verify championship/postseason games are excluded from standings
- [ ] **Logos:** verify every team in `teams.json` has an asset or an intentional placeholder
- [ ] **Colors:** verify every team's accent clears 4.5:1 text / 3:1 UI in **both** light and dark mode
- [ ] **Persistence:** verify a v1-format payload still loads after a schema change
- [ ] **Persistence:** verify behaviour at quota — write 20 scenarios and confirm a real error surfaces
- [ ] **Share:** verify a link created against an older `games.json` reports the mismatch instead of applying silently
- [ ] **SSR:** verify a production build shows no hydration warnings and no post-hydration fetch of `games.json`
- [ ] **Performance:** verify pick-to-standings latency with the full 2026 slate in a late-season, tie-heavy state

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Linear tiebreaker instead of recursive | **HIGH** | Rewrite the engine; every existing test fixture's expected output must be re-derived by hand. Avoid by designing recursively first |
| ACC tied-group grouped on win percentage | MEDIUM | Add a per-conference strategy; retro-fit is contained *if* the standings type kept wins/losses/games separately — otherwise it cascades into the data model |
| Uncomputable step discovered late | **HIGH** | Changing the return type propagates through every consumer and the persistence schema. Nearly free if the three-valued return exists from commit one |
| Unversioned storage after users have data | MEDIUM | Add version detection with a heuristic sniffer for legacy blobs; some loss is unavoidable |
| Quota exhaustion in the wild | MEDIUM | Ship compact encoding plus a one-time re-encode migration; users who already hit it may have lost data |
| Stale share links | LOW | Add the fingerprint and partial-apply UX; old links degrade gracefully once shipped |
| Missing logos | LOW | Placeholder generator plus a build-time failure gate |
| Contrast failures | LOW–MEDIUM | Build-time token generation; low cost if colors were consumed via CSS variables, medium if hex strings were inlined in components |
| Performance under full slate | MEDIUM | Layer and memoize; `shallowRef` the games array. Cheap if the tiebreaker engine is already pure and framework-free |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1. Linear multi-team procedure | Tiebreaker engine | Hand-verified 3/4/5-way fixtures per conference where restart ≠ continue |
| 2. Assuming computability | Tiebreaker engine → persistence → standings UI | Three-valued return type in the signature; SEC halts at step E; ACC halts after H2H |
| 3. ACC tied-group definition | Standings engine → tiebreaker engine | Mixed 8/9-game ACC fixture where a lower win-pct team is in the tie |
| 4. Circular "next highest placed" | Tiebreaker engine | Frozen base ordering passed as input; bucket-collective comparison; no `NaN` escapes |
| 5. Head-to-head applicability | Tiebreaker engine | Partial-graph fixture per conference |
| 6. Unbalanced schedules | Standings engine | Record-weighted opponent aggregate verified by hand; Big 12 FCS-win cap |
| 7. CFBD data edge cases | Data pipeline | Build-time schema validation + committed coverage report |
| 8. Archived logo repo | Data pipeline | Build fails on missing asset; placeholder generator |
| 9. localStorage during SSR | Persistence (must precede standings UI) | Clean production build, zero hydration warnings |
| 10. Storage versioning / stale links | Persistence; sharing | Legacy-payload fixtures load; fingerprint mismatch surfaces |
| 11. Quota | Persistence | 20-scenario stress test; `QuotaExceededError` surfaces visibly |
| 12. Recompute storms | Standings engine; browsing UI | Latency measured on the real slate, late-season state |
| 13. Color contrast | Data pipeline (token generation); design system | Committed contrast report, all teams passing both modes |
| 14. Framework version traps | Foundation/scaffolding | No post-hydration data fetch; Nuxt UI renders styled |

**Suggested phase ordering implication:** the tiebreaker engine should be built as a **pure, framework-free module with hand-verified fixtures before any standings UI exists**. It is the project's stated core value, it has the highest defect cost, it is the only component whose correctness cannot be eyeballed, and Pitfalls 1–6 are all cheap to design around and expensive to retrofit. The data pipeline must precede it (fixtures need real 2026 structure); the UI should follow it.

---

## Sources

**Primary conference policy documents (retrieved and extracted verbatim):**
- Big Ten — [2024 Big Ten Football Championship Game Tiebreaker (PDF)](https://bigten.org/api/media/file/697c15d2-6e70-4ca7-820e-61bebd904a9b-2024_Big_Ten_Football_Tiebreaker_-_FINAL_10__72_.pdf)
- Big 12 — [Big 12 Football Tiebreaker Policy, 16-team, 2024–present (PDF)](https://big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf)
- ACC — [ACC Football Tiebreaker Policy, as amended July 1, 2026 (PDF)](https://theacc.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf)
- ACC — [ACC Football Tiebreaker Policy, 2023 version (PDF)](https://theacc.com/documents/2023/5/17/ACC_FOOTBALL_TIEBREAKER_POLICY.pdf) *(superseded — retained to show what changed)*

**Official conference announcements:**
- [Big Ten Announces New Football Tiebreaking Procedures](https://bigten.org/fb/article/blt6104802d94ebe1ab/)
- [2025 Big Ten Football Championship Game Tiebreakers — worked scenarios](https://bigten.org/fb/article/58967/)
- [Big 12 Football Championship Tiebreaker Policies](https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football)
- [ACC Announces New Football Championship Tiebreaker Policy (July 2026)](https://theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx)
- [SEC announces football tie-breaking process](https://www.secsports.com/news/2024/08/sec-announces-football-tie-breaking-process)
- [SEC to implement nine-game conference football schedule in 2026](https://www.secsports.com/news/2025/08/sec-to-implement-nine-game-conference-football-schedule-in-2026)

**SEC procedure reproduction (primary PDF not directly retrievable):**
- [ESPN — SEC reveals tiebreaking procedures](https://www.espn.com/college-football/story/_/id/40944783/sec-reveals-tiebreaking-procedures-conference-title-game)
- [247Sports — full release including Appendix A worked example](https://247sports.com/college/alabama/article/sec-announces-tiebreakers-to-determine-sec-championship-game-participants-234983170/)
- [Pro Football Network — multi-team restart clause verbatim](https://www.profootballnetwork.com/cfb/sec-tiebreakers-everything-to-know/)
- [DawgNation — first/second place multi-team breakdown](https://www.dawgnation.com/football/around-the-sec/sec-announces-official-football-tiebreakers-2024-season/47NHHBDET5BVDBMFHMB6QUKQ3M/)
- [ESPN — ACC implements new tiebreaker policy](https://www.espn.com/college-football/story/_/id/49366844/acc-implements-new-tiebreaker-policy-football-title-game)
- [CBS Sports — ACC new tiebreaker rules and the 2025 five-way tie](https://www.cbssports.com/college-football/news/acc-new-tiebreaker-rules-disaster-scenario/)

**Data source:**
- [CFBD API documentation](https://api.collegefootballdata.com/) · [API access tiers](https://collegefootballdata.com/api-tiers) · [Terms](https://collegefootballdata.com/terms)
- [CFBD/cfb-web](https://github.com/CFBD/cfb-web) — inspected via GitHub API: archived, `pushed_at` 2023-08-11, `public/logos/` last commit 2022-09-01, 453 assets, MIT
- [fbschedules — 2026 conference realignment](https://fbschedules.com/college-football-realignment-conference-changes-for-2026-take-effect-today/)

**Platform / stack:**
- [TanStack Query v5 — Vue SSR guide](https://tanstack.com/query/v5/docs/framework/vue/guides/ssr) · [hydration reference](https://tanstack.com/query/v5/docs/framework/vue/reference/hydration) · [migrating to v5](https://tanstack.com/query/latest/docs/framework/vue/guides/migrating-to-v5)
- [TanStack/query#7338 — Vue Query + Nuxt SSG hydrated query cannot be reset](https://github.com/TanStack/query/issues/7338) · [#6419 — Nuxt 3 SSR issues](https://github.com/TanStack/query/discussions/6419)
- [Nuxt 4 upgrade guide](https://nuxt.com/docs/4.x/getting-started/upgrade) · [Nuxt hydration best practices](https://nuxt.com/docs/4.x/guide/best-practices/hydration) · [nuxt/nuxt#25500 — hydration mismatch using localStorage](https://github.com/nuxt/nuxt/discussions/25500)
- [Nuxt UI v4 migration](https://ui.nuxt.com/docs/getting-started/migration/v4) · [Nuxt UI design system](https://ui.nuxt.com/docs/getting-started/theme/design-system)
- [Vue.js performance guide](https://vuejs.org/guide/best-practices/performance)
- [APCA — easy intro](https://git.apcacontrast.com/documentation/APCAeasyIntro.html)

---
*Pitfalls research for: college football season prediction / schedule-picker web app*
*Researched: 2026-08-12*
