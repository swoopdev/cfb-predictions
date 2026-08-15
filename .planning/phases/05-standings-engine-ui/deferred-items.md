# Deferred Items — Phase 05 (Standings Engine & UI)

Out-of-scope discoveries logged during execution. Not fixed here (SCOPE
BOUNDARY: only issues caused by this plan's own changes are auto-fixed).

## OPEN (found during 05-03) — The tiebreaker engine can contradict itself between seed 1 and seed 2

**Owner: Phase 3 / Phase 6, not Phase 5.** Found while making 05-03's
real-slate property test pass; it is not reachable from the standings layer.

`resolveTiedGroup` returns `[...winners, ...restResult.order]`
(`shared/domain/tiebreakers/engine.ts:159`). When a step's top bucket holds
**more than one team**, every one of them is recorded as `seeded` and their
internal order comes from `partitionByStepValue`'s `sort((a, b) => a - b)` —
a raw **team-id sort**, not a resolution. Seed 2 then re-runs the same
procedure over a smaller pool (a different common-opponent set, for instance)
and can legitimately reach the **opposite** relative order for those same two
teams.

Measured over 200 generated seasons of the committed 2026 slate (100
fully-picked, 100 weeks-1-7): **7 of 649** conferences with both seeds resolved
show this contradiction, and in **all 7** the contradicted pair sits inside a
multi-team bucket the engine never separated. Example (fully-picked PRNG seed
1, Big 12):

```
seed1 = [Oklahoma State, West Virginia, UCF]   <- WVU/UCF order is an id sort
seed2 = [UCF, West Virginia]                   <- the actually-computed answer
```

**Consequence:** no standings row order can satisfy both seeds. 05-03 follows
`seed1.order` (the sequence that also carries the champion), which is safe —
the whole disputed group shares one rank number, so a user never sees differing
ranks, and the championship matchup display (TIE-07) reads `seed1.order[0]` /
`seed2.order[0]` from the engine directly rather than from row order. Pinned by
`tests/domain/standings/standings-tiebreaker-agreement.test.ts` →
`when the engine contradicts itself between seed 1 and seed 2`, so the shape
cannot change silently.

**The real repair is engine-side:** either do not present an unseparated bucket
as an ordered sequence (return the bucket as a group), or resolve seed 1's tail
with the same per-slot procedure seed 2 uses. Both change `TiebreakerResult`'s
contract, which is why it is deferred rather than folded into a Phase 5 gap fix.

## OPEN (pre-existing, confirmed during 05-03) — `shared/domain/tiebreakers/**` misses its 90% branch-coverage threshold

`pnpm exec vitest run --coverage` reports
`Coverage for branches (87.87%) does not meet "shared/domain/tiebreakers/**"
threshold (90%)`.

**Not caused by 05-03 — improved by it.** Re-running coverage with 05-03's two
new test files excluded gives **80%**; with them it is **87.87%**. The gate was
already failing before this plan and moved ~8 points closer to passing.

Not in any of the four gates this project actually runs (`pnpm test` is
`vitest run`, with no `--coverage`), and `shared/domain/standings/**` — the
directory 05-03 touches — passes its own 85% gate comfortably at
**97.41 / 90.66 / 100 / 96.8**. Closing the remaining 2.13 points belongs with
whoever next works in `shared/domain/tiebreakers/`.

## DEFERRED BY PLAN 05-03 (recorded so they do not drop silently)

| Finding | Why deferred | Carry to |
|---|---|---|
| **WR-06** — `StandingsResult`'s loose string index signature does not express "every P4 conference is always present" | Tightening to `Readonly<Record<ConferenceId, readonly StandingsTeam[]>>` ripples into `StandingsSidebar`'s prop type, `StandingsTable`, and the page's `{}` not-computed-yet sentinel (which the new type makes illegal). 05-03's brief forbids changing the sidebar's props shape for anything CR-01 does not require. The *behaviour* WR-06 enabled is closed by 05-03's `loadState` gate. | Phase 6, where `StandingsResult` is already being extended |
| **IN-02** — `toOutcomes` is derived twice per recompute; two page computeds repeat the readiness guard with different sentinels | A refactor of two page computeds, not a correctness fix, and it would put a new app-layer seam directly in front of the code 05-03 changes. Phase 6 needs a `useStandings()` composable anyway (it must read outcomes, resolution and standings together). | Phase 6, built once with the full consumer set |

## RESOLVED (quick task `260814-f6z`, 2026-08-14) — Pre-existing test suite failures

Discovered during 05-01; repaired by quick task `260814-f6z` in four atomic
commits — `6edf735`, `1024a4f`, `b33a42c`, plus
`fix(test): assert the shipped progress-bar contract in PickProgress tests`
(the commit carrying this file).

**Result: 45 failing tests → 0. Passing went 186 → 345.** The jump well beyond
the 45 repaired is expected: seven of the files were failing at *collection*, so
their tests were never counted in the baseline at all. Skipped remains 18,
unchanged — nothing was skipped, weakened, or deleted to reach green.

### Correction to the original diagnosis

The "Likely cause" column below originally attributed **seven** files to alias
misuse ("Same alias class of bug"). **That was wrong.** Only three files had an
alias bug. The verified split across the 11 files was:

| Class | Cause | Files |
|---|---|---|
| A | Alias misuse (`~` maps to `app/`, not the repo root) | 3 |
| B | Global `happy-dom` forced onto Node-URL-API tests | 4 |
| C | `ofetch` unresolvable from the repo root | 1 |
| D | Broken `no-unused-vars` rename | 1 |
| E | Component relied on a Nuxt auto-import | 2 |

Classes A and B were both "import resolution failure"-shaped at a glance, which
is how four environment bugs got filed as alias bugs. They are unrelated: the
Class B files resolve their imports fine and fail at *runtime* on
`fileURLToPath(new URL(..., import.meta.url))`, because happy-dom's global `URL`
produces a non-`file:`-schemed URL that Node's `fileURLToPath` rejects.

### Per-file record

| Test file | Failure | Confirmed cause | Fix applied |
|---|---|---|---|
| `tests/tiebreakers-steps.test.ts` | Cannot resolve `~/shared/domain/tiebreakers/steps` | **A** — `~` maps to `app/`, so the specifier resolved to `app/shared/...` | Repointed 3 specifiers at relative `../shared/...`, matching sibling `tiebreakers-engine.test.ts` |
| `tests/composables/usePicksStorage.test.ts` | Import resolution failure | **A** — redundant `app/` segment resolved to `app/app/composables/...` | Dropped the redundant segment |
| `tests/composables/useAutoFilledGames.test.ts` | Import resolution failure | **A** — same doubled directory | Dropped the redundant segment |
| `tests/schemas.test.ts` | Import resolution failure at line 14 | **B** — not an alias bug; `TypeError: The URL must be of scheme file` | Added `@vitest-environment node` docblock |
| `tests/fetch-source.test.ts` | Import resolution failure at line 6 | **B** — same | Added `@vitest-environment node` docblock |
| `tests/lib/empty-state.test.ts` | Failure at line 38 | **B** — same | Added `@vitest-environment node` docblock |
| `tests/lib/week-nav.test.ts` | Failure at line 74 | **B** — same | Added `@vitest-environment node` docblock |
| `tests/composables/fetch-schedule.test.ts` | 2 tests failing | **C** — pnpm's isolated store keeps `ofetch` out of top-level `node_modules`, so Vite import analysis failed while transforming `fetchSchedule.ts`, before `vi.mock('ofetch')` could intercept | Added an `ofetch` entry to `resolve.alias` in `vitest.config.ts`, resolved through `nuxt`. **No dependency added** — `package.json` and `pnpm-lock.yaml` untouched |
| `tests/utils/bulkPickOperations.test.ts` | 22 tests: `ReferenceError: currentPicks is not defined` | **D** — `b2c8b96`'s autofix renamed the *declarations* to `_currentPicks` and left the *usages* alone | Stripped the underscore from all 23 declarations; removed 1 genuinely dead declaration (see below) |
| `tests/components/PickProgress.test.ts` | 10 tests failing at `PickProgress.vue:17` | **E** — `computed` used without import, relying on Nuxt auto-import | Explicit `import { computed } from 'vue'`, matching `StandingsTable.vue` |
| `tests/components/PickProgressWeek.test.ts` | 11 tests failing | **E** — same, at `PickProgressWeek.vue:18` | Same |

### Note on the one deleted declaration

In `clearSeason`'s "should return empty object" test, `currentPicks` was
genuinely unused — `clearSeason()` takes zero parameters (the adjacent test
asserts exactly that), so the value could never be read. Renaming it back would
have re-broken `pnpm lint`; keeping the underscore would have preserved a
binding that falsely implied `clearSeason` consumes picks. The dead line was
removed. No assertion, fixture value, or call argument was changed.

---

## RESOLVED (same task, fourth commit) — 2 stale assertions in the PickProgress tests

Surfaced by the Class E fix above. These two tests were **never actually running**
since 2026-08-13, so the staleness was invisible until now.

**This was a stale test, not a component defect.** The components were correct;
the assertions described a design that had already been replaced.

| Test file | Test | Status |
|---|---|---|
| `tests/components/PickProgress.test.ts` | `should use neutral text color styling` | FIXED — rewritten and renamed |
| `tests/components/PickProgressWeek.test.ts` | `should use neutral text color styling` | FIXED — rewritten and renamed |

Both assert the root `<div>` carries `text-sm` and a `text-slate-*` class:

```js
expect(classes).toContain('text-sm')
expect(classes.some(c => c.includes('text-slate') || c.includes('slate-'))).toBe(true)
```

**Root cause — a deliberate design change, not a regression.** Commit `c9be104`
("feat(phase-04-polish): implement UI polish refinements", decisions D-01–D-05)
intentionally replaced

```html
<div class="text-sm text-slate-700 dark:text-slate-300">
```

with a horizontal progress bar (`relative w-full h-6 bg-muted rounded
overflow-hidden`) whose label is a centered **white** `text-xs` span. Its own
commit message states: *"Replace PickProgress text badge with horizontal bar"*,
*"Centered label '{X}/{Y} picked' with white text"*.

That same commit added the `computed()` calls **without** the `vue` import — so
the resulting `ReferenceError` masked these two assertions from that moment on.
The tests still encode the pre-polish design.

**Resolution.** The executor stopped rather than editing these assertions
unilaterally (the task forbade assertion edits and required escalation if one
looked genuinely wrong). The analysis was verified and the user directed that the
**assertions** be updated to the shipped contract — the component stands, D-01
through D-05 are unchanged.

Both cases were rewritten to assert what the bar actually guarantees, and renamed
to `should render a progress bar track, proportional fill, and centered label`,
since the old name no longer described the check — a name that lies is its own
defect. The assertions intentionally differ between the two components, because
the components differ:

| | `PickProgress` | `PickProgressWeek` |
|---|---|---|
| Track | `bg-muted`, `overflow-hidden`, `h-6` | `bg-muted`, `overflow-hidden`, `h-5`, `shrink-0` |
| Fill | `bg-primary`, `transition-all`, `width: 5%` (5/100) | `bg-primary`, `transition-all`, `width: 50%` (5/10) |
| Label | `text-xs`, `text-white`, `5/100 picked` | `text-xs`, `text-white`, `5/10 picked` |

Coverage is **strengthened, not weakened**: the fill width and the label markup
were previously unasserted by any test, so D-03/D-05's proportional-fill
behaviour now has real coverage it never had before.
