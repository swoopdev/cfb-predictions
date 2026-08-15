---
phase: 05-standings-engine-ui
reviewed: 2026-08-14T21:02:18Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/components/StandingsSidebar.vue
  - app/components/StandingsTable.vue
  - app/pages/week/[week].vue
  - shared/domain/standings/computeStandings.ts
  - shared/domain/standings/index.ts
  - shared/domain/standings/resolveTiebreakers.ts
  - shared/types/standings.ts
  - tests/components/StandingsSidebar.test.ts
  - tests/components/StandingsTable.test.ts
  - tests/domain/standings/computeStandings.test.ts
  - tests/fixtures/standings.fixtures.ts
findings:
  critical: 1
  warning: 7
  info: 2
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-14T21:02:18Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The untrusted-input boundary and the throw-isolation both hold up. `toOutcomes` iterates
`games` rather than the picks object and compares winner ids with `!==` against
`homeId`/`awayId`, so a hand-edited `localStorage` entry carrying a string, `null`, a float,
or a non-participant id is dropped rather than propagated — I confirmed
`resolveConferenceChampionship`'s throw is unreachable through this path, and
`resolveAllConferences`'s per-conference `try` isolates the recursion guards. No injection,
`v-html`, `eval`, secret, or path-traversal surface exists in the phase. The DRY constraint
is honoured for W-L tallying (`deriveConferenceRecords` is reused, not reimplemented), and
the components genuinely avoid Nuxt auto-imports — no new auto-import reliance was
introduced.

The domain layer has one real correctness defect, and it is squarely in the area the project
says matters more than anything else. **`computeStandings` and the Phase 3 tiebreaker engine
use two different definitions of "tied," so the standings the user sees can contradict the
conference champion the engine resolved.** I reproduced this against the committed 2026
slate: in 12 of 1200 fully-picked conference resolutions the sidebar's `#1` row is *not*
the team `resolveAllConferences` named as the champion, and the contradiction is far easier
to hit mid-season with partial picks. The existing test suite cannot catch it because no
test ever compares a standings row against a resolved seed.

The remaining findings are a visible loading-state regression in the sidebar, a silent
`catch {}` over the engine's diagnostic throws, a duplicated `winPct` that is the proximate
mechanism behind the critical finding, and a `StandingsTeam.isTied` field that no consumer
reads and whose semantics will mislead Phase 6.

## Critical Issues

### CR-01: Standings rank grouping and the tiebreaker engine disagree on what "tied" means — the sidebar can name a different conference champion than the engine

**File:** `shared/domain/standings/computeStandings.ts:176-197`, `shared/domain/standings/computeStandings.ts:77-93`, `shared/domain/standings/computeStandings.ts:226-243`

**Issue:**

`computeStandings` groups teams into a shared rank by **identical W-L** (`assignRanks`, line
231-234), and only consults the resolved tiebreaker order *after* `wins` and `losses` have
both compared equal (lines 184-191). The Phase 3 engine groups tied teams by **win
percentage** (`computeBaseOrdering` → `defineBucketTiedTeams`) and, for the ACC, by
**matching wins _or_ matching losses across different conference schedule lengths**
(`defineAccTiedTeams`, whose own docblock states "a team at 7-1 (.875, 8 games) and a team
at 7-2 (.778, 9 games) are **tied**").

These are not the same set. Any two teams the engine ties but whose W-L differ never reach
the `positions.get(...)` comparison, so `resolvedTiebreakers` is silently discarded for
exactly the teams it was computed for. `tiebreakerPositions` is dead weight on those paths.

Reproduced against `public/data/2026/games.json` + `teams.json`:

*Fully-picked season (deterministic PRNG, 300 seasons × 4 conferences):*

```
seed 18 ACC: engine champion Florida State is NOT the top standings row
  display top6: #1 Virginia 8-1 | #2 Florida State 7-1 | #3 Louisville 6-3 | ...
  engine seed1 order: Florida State > Virginia

seed 10 ACC: engine champion Georgia Tech is NOT the top standings row
  display top6: #1 Wake Forest 7-2 | #2 Georgia Tech 6-2 | ...
  engine seed1 order: Georgia Tech > Wake Forest

conferences where the resolved champion is not the top standings row: 12 / 1200
```

The ACC is not an edge case here: `defineAccTiedTeams` documents that Boston College,
Clemson, Florida State, Georgia Tech, and North Carolina play 8 conference games in 2026
while the other 12 play 9, so mixed schedule lengths are *guaranteed* this season.

*Partial picks — the app's normal operating mode — hits it in every conference, because
unequal games-played produces equal win percentages constantly:*

```
weeks 1-7 picked, SEC:
  engine baseOrdering top bucket: [ LSU 4-0 , Oklahoma 3-0 , Tennessee 4-0 ]
  engine seed1 order: LSU > Oklahoma > Tennessee
  engine seed2 order: Oklahoma > Tennessee
  display:           #1 LSU 4-0 | #1 Tennessee 4-0 | #3 Oklahoma 3-0 | #4 Georgia 3-2

60% picked, Big 12:
  engine seed1 order: Iowa State > Arizona State
  display:            #1 Arizona State 5-0 | #2 Iowa State 4-0
```

In the SEC case the sidebar shows Oklahoma at rank 3 while the engine has it as the #2 seed —
i.e. the team that would play in the championship game is displayed third, behind a team the
engine ranked below it.

**Fix:**

Unify the two tie definitions rather than maintaining a second one in the standings layer.
Two viable shapes:

*(a) Preferred — consume the engine's grouping.* Have `computeStandings` accept (or derive
from `deriveConferenceRecords`) the same bucket definition the engine used, and group ranks
on that:

```ts
// records already carries the authoritative winPct — stop recomputing it (see WR-02)
const conf = confRecords.get(team.id)
// ...
rows.sort((a, b) => {
  // 1. engine order first for every team the engine placed
  const posA = positions.get(a.id) ?? Number.POSITIVE_INFINITY
  const posB = positions.get(b.id) ?? Number.POSITIVE_INFINITY
  if (posA !== posB) return posA - posB
  // 2. then win percentage / record for everyone the engine did not place
  ...
})
```

and make `assignRanks` group on the engine's bucket membership (win pct for SEC/Big Ten/
Big 12, `defineAccTiedTeams` output for the ACC) instead of raw W-L equality.

*(b) Minimum viable — preserve D-04's W-L rank numbers but stop the contradiction.* Promote
`positions` to the primary sort key (ahead of win pct/wins/losses) for any team present in
`positions`, so the resolved champion is always the top row and the resolved seed order is
never inverted, then assign rank numbers over the resulting order.

Either way, add the regression assertion that is currently missing (see WR-07):

```ts
for (const [conf, res] of Object.entries(resolved)) {
  if (res.seed1.status !== 'resolved') continue
  expect(standings[conf]![0]!.id).toBe(res.seed1.order[0])
}
```

If the intent really is that standings rank and championship seeding are allowed to
disagree, that needs to be an explicit, documented decision with UI that explains it —
right now the code comments (D-11/D-12: "Phase 5 consuming Phase 6's resolved ranking")
claim the opposite of what the code does.

## Warnings

### WR-01: The standings sidebar renders four "No teams to show" tables during the loading and error states

**File:** `app/pages/week/[week].vue:109-113`, `app/pages/week/[week].vue:311-314`

**Issue:** `standings` returns `{}` whenever `games`/`teams` have not resolved
(line 111), and `<StandingsSidebar>` is mounted *outside* the
`loadState === 'loading' / 'error'` `v-if` chain (it sits at line 311, a sibling of the
whole branch). While the main column shows `USkeleton` placeholders, the sidebar renders
four fully-formed section headings each followed by `No teams to show for SEC.` /
`... Big Ten.` / `... Big 12.` / `... ACC.` (`StandingsTable.vue:41-46`). The same happens on
the error branch, where the page has already told the user the schedule failed to load.
`StandingsSidebar.test.ts:111-118` locks this in as intended behaviour for a missing-key
`standings` object, so it will not be caught by the suite.

**Fix:** Gate the sidebar on `loadState`, mirroring the main column:

```vue
<StandingsSidebar
  v-if="loadState === 'ready'"
  :standings="standings"
  :active-conference="conf"
/>
<div v-else-if="loadState === 'loading'" class="w-full lg:w-80 lg:shrink-0">
  <USkeleton class="h-96 w-full rounded-lg" />
</div>
```

or add a `pending`/`unavailable` prop to `StandingsSidebar` so it can distinguish
"no data yet" from "this conference is genuinely empty".

### WR-02: `winPct` is reimplemented in the standings layer while `ConferenceRecord.winPct` is already returned and discarded

**File:** `shared/domain/standings/computeStandings.ts:206-215`, consumed at `:180-182`

**Issue:** `deriveConferenceRecords` already computes and returns a NaN-safe `winPct` on
every `ConferenceRecord` (`shared/domain/tiebreakers/records.ts:96`), and that is the exact
value `computeBaseOrdering` buckets on. `computeStandings` throws it away (line 162 only
reads `wins`/`losses`) and recomputes the same quantity with a private copy whose own
docblock admits "Mirrors `winPctSafe` in the tiebreaker engine's `records.ts`". This is a
second implementation of a value PROJECT.md says must have exactly one, and it is the
mechanism by which the standings layer drifted away from the engine's ordering (CR-01).

**Fix:** Delete the private `winPct` and read the authoritative value:

```ts
const conf = confRecords.get(team.id)
// carry conf?.winPct ?? 0 onto the row (or into a local sort key map)
// and sort on it, so standings and baseOrdering can never diverge.
```

### WR-03: `resolveAllConferences` swallows engine invariant violations with a bare empty `catch {}`

**File:** `shared/domain/standings/resolveTiebreakers.ts:65-67`

**Issue:** The two throws being caught here are not routine —
`resolveTiedGroup` throws them explicitly with diagnostic text ("restart did not strictly
shrink the tied group -- infinite recursion guard tripped",
"defineTiedTeams did not strictly shrink ..."), i.e. they signal an engine bug, not bad user
input. Discarding them with no logging means the standings quietly downgrade to
alphabetical-within-tie ordering with zero signal anywhere — no console output, no returned
status, nothing in the UI. Given the project's core value statement, a silently wrong
tiebreaker resolution is the single worst failure mode this codebase has, and this is the
one place it can happen invisibly. The codebase already has precedent for a non-user-facing
diagnostic (`usePicksStorage` uses `console.debug` for corruption recovery).

**Fix:**

```ts
} catch (error) {
  // Omit this conference; standings fall back to pure record ordering.
  console.warn(`[standings] tiebreaker resolution failed for ${conference}; falling back to record order.`, error)
}
```

Consider also returning the failure alongside the results (e.g.
`{ resolved, failed: ConferenceId[] }`) so Phase 6 can surface "tiebreakers unavailable"
rather than presenting a fallback order as authoritative.

### WR-04: `StandingsTeam.isTied` is dead output and its semantics contradict the engine's tie definition

**File:** `shared/domain/standings/computeStandings.ts:240-242`, `shared/types/standings.ts:41-42`

**Issue:** `isTied` is computed on every row but read by no component —
`StandingsTable.vue` deliberately renders no tie indicator (D-05/D-06), and
`StandingsSidebar.vue` never touches it. A grep across `app/`, `shared/`, and `tests/`
finds reads only inside test assertions. Worse than merely dead: its meaning ("shares a rank
number", i.e. identical W-L) is *not* the engine's meaning of tied (see CR-01), so the
Phase 6 tiebreaker UI — the obvious future consumer, and the one the type's docblock is
written for — will get a `false` for teams the engine has flagged `needsUserInput` and a
`true` for teams the engine already separated. Two examples from the reproduction above:
Oklahoma (3-0) gets `isTied: false` while sitting in the engine's unresolved top bucket;
every team gets `isTied: true` on an unpicked slate.

**Fix:** Either delete the field and the `rankCounts` pass, or redefine it against the
engine's tied group (available from `resolvedTiebreakers[conf].seed1.tiedTeams` when the
status is `needsUserInput`, or from the shared bucket after CR-01 is fixed) and document
which question it answers.

### WR-05: `P4_CONFERENCES` is an exported mutable array built from an unchecked assertion, and the sidebar's display order silently depends on object key insertion order

**File:** `shared/domain/standings/computeStandings.ts:13`, `app/components/StandingsSidebar.vue:40`

**Issue:** Three problems in one line:

```ts
export const P4_CONFERENCES = Object.keys(CONFERENCE_RULES) as ConferenceId[]
```

1. The `as ConferenceId[]` is unchecked. If a G5 conference is ever added to
   `CONFERENCE_RULES` (a plausible v2 move), it silently becomes a `ConferenceId`, gains a
   standings table in the sidebar, and gains an entry in `StandingsResult` with no type
   error anywhere.
2. The array is mutable and module-scoped. `StandingsSidebar` calls `P4_ORDER.includes(...)`
   directly on it; any consumer that sorts or splices it corrupts both the standings
   computation and the sidebar for the whole session.
3. `StandingsSidebar.vue:38` asserts in a comment that the order "is already SEC, Big Ten,
   Big 12, ACC". That is true today only because of the literal key order in
   `shared/domain/tiebreakers/rules.ts:119-172`. Reordering that object — a change no
   reviewer would associate with the UI — silently reorders the sidebar, and only
   `StandingsSidebar.test.ts:44-48` would catch it.

**Fix:**

```ts
export const P4_CONFERENCES: readonly ConferenceId[] = Object.freeze(
  (Object.keys(CONFERENCE_RULES) as ConferenceId[])
)
```

and make the display-order dependency explicit — either add a comment in `rules.ts`
stating that its key order is load-bearing for the standings UI, or give `ConferenceRules`
an explicit `displayOrder` field.

### WR-06: `StandingsResult`'s string index signature does not express the invariant its own docblock states

**File:** `shared/types/standings.ts:51-53`

**Issue:** The type is `{ [confName: string]: StandingsTeam[] }` while the docblock directly
above it says "Every P4 conference is always present". Consequences: (a) `standings['Big12']`
(a typo) type-checks and returns `undefined`, (b) `computeStandings` returning `{}` from the
page's loading guard satisfies the type despite violating the documented invariant — which
is exactly how WR-01 slipped through, (c) `StandingsSidebar.vue:133` needs a
`?? []` defensive fallback that a precise type would make unnecessary and that currently
masks the loading-state bug.

**Fix:**

```ts
export type StandingsResult = Readonly<Record<ConferenceId, readonly StandingsTeam[]>>
```

(importing `ConferenceId` from `shared/domain/tiebreakers/types`), and model "not computed
yet" as `StandingsResult | undefined` at the page level instead of `{}`.

### WR-07: The test suite cannot detect a divergence between standings order and resolved tiebreakers

**File:** `tests/domain/standings/computeStandings.test.ts:220-235`, `:333-375`

**Issue:** The only test that feeds a resolved result into `computeStandings`
(`:220-235`) hand-builds a `ChampionshipResult` whose seed orders contain teams that already
share an identical W-L (`LSU`/`GEORGIA`, both 2-2), so it exercises only the one path that
already works. `'feeds straight back into computeStandings'` (`:348-354`) asserts rank
numbers and `result.SEC![0].school === 'Alabama'` but never compares any row against
`resolved.SEC.seed1.order`. Nothing in the suite covers:

- two teams with equal win percentage but unequal W-L (`3-0` vs `4-0`) — the partial-pick
  case that dominates real usage,
- the ACC's matching-wins-different-schedule-length tie,
- the invariant "the resolved seed-1 team is the top standings row".

The fixture set is also uniform: every SEC team in `secRoundRobinGames` plays exactly four
conference games, so unequal games-played — the precondition for CR-01 — is structurally
absent from the fixtures.

**Fix:** Add a fixture with deliberately unequal conference schedule lengths (e.g. Alabama
4-0 vs Georgia 3-0, both 1.000) and a property-style assertion:

```ts
it('never contradicts the resolved championship ordering', () => {
  const resolved = resolveAllConferences(games, allTeams, picks)
  const st = computeStandings(games, allTeams, picks, resolved)
  for (const [conf, res] of Object.entries(resolved)) {
    if (res.seed1.status !== 'resolved') continue
    const idx = new Map(st[conf]!.map((r, i) => [r.id, i]))
    const positions = res.seed1.order.map(id => idx.get(id)!)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  }
})
```

## Info

### IN-01: Orphaned decision comment in the week page documents nothing at its location

**File:** `app/pages/week/[week].vue:115-118`

**Issue:** The four-line `// D-02: which conferences the sidebar shows is
StandingsSidebar's decision...` block sits between the `standings` computed and the
unrelated `filterLabel` computed, attached to no code. The same rationale is already stated
verbatim in the template comment at lines 306-310 and in `StandingsSidebar.vue:14-21`.

**Fix:** Delete it; the template comment at the `<StandingsSidebar>` call site is the one
that earns its place.

### IN-02: `toOutcomes` is derived twice per recompute and the two page computeds duplicate the same readiness guard

**File:** `app/pages/week/[week].vue:103-113`, `shared/domain/standings/resolveTiebreakers.ts:42`, `shared/domain/standings/computeStandings.ts:132`

**Issue:** `resolveAllConferences` and `computeStandings` each independently call
`toOutcomes(games, picks)` over the full 888-game slate, and the two page-level computeds
repeat the identical `const slate = games.value?.games; if (!slate || !teams.value) return ...`
guard with two different sentinel values (`undefined` vs `{}`). Not a correctness problem
today, but it means the validated outcome map — the security-relevant artifact — has two
construction sites, and a future change to the validation rules must be applied through both
entry points to take effect.

**Fix:** Either accept an optional pre-built `outcomes` map on both functions, or expose a
single `useStandings()` composable in the app layer that derives outcomes once and returns
`{ outcomes, resolvedTiebreakers, standings }` — which also matches PROJECT.md's "consumed
through composables" wording.

---

_Reviewed: 2026-08-14T21:02:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
</content>
</invoke>
