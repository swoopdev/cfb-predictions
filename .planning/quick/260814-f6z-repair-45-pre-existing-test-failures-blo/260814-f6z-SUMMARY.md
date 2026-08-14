---
phase: quick-260814-f6z
plan: 01
subsystem: test-harness
status: complete
verification_gate: PASSING — all four gates green
tags: [testing, vitest, tooling, repair]
requires: []
provides: [green-ish-test-suite, corrected-failure-attribution]
affects: [vitest.config.ts, tests/, app/components/PickProgress*.vue]
tech-stack:
  added: []          # deliberately none — see "ofetch: alias, not dependency"
  patterns: [per-file @vitest-environment docblock, explicit vue imports in components]
key-files:
  created: []
  modified:
    - vitest.config.ts
    - tests/tiebreakers-steps.test.ts
    - tests/composables/useAutoFilledGames.test.ts
    - tests/composables/usePicksStorage.test.ts
    - tests/lib/week-nav.test.ts
    - tests/lib/empty-state.test.ts
    - tests/schemas.test.ts
    - tests/fetch-source.test.ts
    - tests/utils/bulkPickOperations.test.ts
    - app/components/PickProgress.vue
    - app/components/PickProgressWeek.vue
    - tests/components/PickProgress.test.ts
    - tests/components/PickProgressWeek.test.ts
    - .planning/phases/05-standings-engine-ui/deferred-items.md
decisions:
  - Used a vitest resolve.alias for ofetch instead of a devDependency (user override); package.json and pnpm-lock.yaml untouched
  - Converted the alias map to array+regex form so the ofetch entry matches exactly and cannot capture ofetch/node
  - Deleted one genuinely dead currentPicks declaration rather than re-underscoring it
  - Escalated 2 stale design assertions instead of editing them; user approved updating the tests, not reverting the component
metrics:
  duration: ~20 min
  completed: 2026-08-14
---

# Quick Task 260814-f6z: Repair 45 Pre-existing Test Failures Summary

Repaired six distinct root causes behind the 11 failing test files. **45 failing
tests → 0.** The sixth cause (stale assertions) was invisible until the fifth was
fixed, and was resolved by user decision after escalation.

## Verification gate: PASSING

| Gate | Result |
|---|---|
| `pnpm test` | **PASS — 0 failed** |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |

### Actual test counts

| | Baseline | Final |
|---|---|---|
| Test files | 11 failed / 19 passed / 1 skipped (31) | **0 failed / 30 passed / 1 skipped (31)** |
| Tests | 45 failed / 186 passed / 18 skipped (249) | **0 failed / 345 passed / 18 skipped (363)** |

Passing rose 186 → **345**, comfortably past the >231 target. The surplus is
expected: seven files were failing at *collection*, so their tests never appeared
in the 249 baseline total at all (249 → 363 collected). **Skipped stayed at 18** —
nothing was skipped, weakened, deleted, or glob-excluded to move the number.
Verified: `git diff 9ba8366..HEAD -- tests/` adds no `.skip`/`.todo`/`.only`.

## Corrected cause breakdown (for the Phase 5 verification record)

`deferred-items.md` attributed **seven** files to alias misuse. That was wrong —
only **three** had an alias bug. Verified split:

| Class | Cause | Files | Failing tests |
|---|---|---|---|
| A | Alias misuse (`~` → `app/`, not repo root) | 3 | 0 (collection failure) |
| B | Global happy-dom forced onto Node-URL-API tests | 4 | 0 (collection failure) |
| C | `ofetch` unresolvable from repo root | 1 | 2 |
| D | Broken `no-unused-vars` rename | 1 | 22 |
| E | Component relied on a Nuxt auto-import | 2 | 21 |
| F | Stale assertions describing a superseded design | 2 | 0 (masked by E) |

Classes A and B both *look* like "import resolution failure", which is how four
environment bugs got misfiled as alias bugs. They are unrelated — the Class B
files resolve imports fine and fail at runtime on
`fileURLToPath(new URL(..., import.meta.url))`, because happy-dom's global `URL`
yields a non-`file:`-schemed URL that Node rejects.

## ofetch: alias, not dependency

Per the binding user override, Class C was fixed with a `resolve.alias` entry
rather than `pnpm add -D ofetch@1.5.1`. **`package.json` and `pnpm-lock.yaml` are
untouched** (verified: `git diff --name-only 9ba8366..HEAD -- package.json pnpm-lock.yaml` is empty).

The alias resolves `ofetch` *through* `nuxt` via `createRequire`, rather than
hardcoding a `.pnpm` store path:

```ts
const ofetchEntry = resolve(
  dirname(require.resolve('ofetch/package.json', {
    paths: [dirname(require.resolve('nuxt/package.json'))]
  })),
  'dist/index.mjs'
)
```

This matters because the store holds **two** ofetch copies (`1.5.1` and
`2.0.0-alpha.3`); resolving through `nuxt` deterministically selects `1.5.1` —
the copy the app already uses at runtime — instead of whichever a glob found first.

I converted the alias map from object to array+regex form so `/^ofetch$/` matches
exactly. Vite's alias matcher (`@rollup/plugin-alias`) treats a *string* key as
`id === key || id.startsWith(key + '/')`, so a plain `'ofetch'` key would also have
captured `ofetch/node` and rewritten it to `.../dist/index.mjs/node`. Nothing
imports `ofetch/node` today, but the regex removes the trap. I confirmed no bare
`~`/`#shared`/`#app` imports exist, so the regex form is behaviour-equivalent for
the pre-existing aliases.

## Deviations from Plan

### 1. [Rule 1 — Bug] One `currentPicks` declaration was genuinely dead

- **Found during:** Task 2
- **Issue:** After stripping the underscore from all 23 declarations, `pnpm lint`
  flagged exactly one — the `clearSeason` "should return empty object" test — as
  assigned but never used.
- **Investigation:** `clearSeason(): Record<number, number>` takes **zero
  parameters**, and the adjacent test explicitly asserts "should not take input
  (pure function)". The value could never be read. It was dead before the autofix.
- **Fix:** Removed the dead line. The plan anticipated only a "missed usage" case;
  this was not that. Renaming it back would have re-broken lint, and keeping the
  underscore would have preserved a binding falsely implying `clearSeason`
  consumes picks. No assertion, fixture value, or call argument touched.
- **Commit:** `1024a4f`

### 2. [Constraint 2 — escalated, then resolved by user decision] Two stale assertions

The plan predicted all 21 Class E tests would pass once `computed` was imported.
19 did. Two did not, for a reason the plan did not anticipate — **Class F**.

`should use neutral text color styling` in both component test files asserted the
root `<div>` carries `text-sm` and a `text-slate-*` class. **Those assertions were
stale, not the component.** Commit `c9be104` ("feat(phase-04-polish)", D-01–D-05)
deliberately replaced

```html
<div class="text-sm text-slate-700 dark:text-slate-300">
```

with a horizontal progress bar whose label is a centered **white** `text-xs` span.
Its message says so outright: *"Replace PickProgress text badge with horizontal
bar"*, *"Centered label '{X}/{Y} picked' with white text"*.

That **same commit** added `computed()` without the `vue` import, so the resulting
`ReferenceError` masked these two assertions from the moment the design changed.
They had not run since 2026-08-13.

Per constraint 2 I did not edit them; I stopped and reported. The analysis was
verified and **the user directed that the assertions be updated to the shipped
contract, with the component left alone** — D-01–D-05 stand. Implemented in the
fourth commit.

The assertions deliberately **differ between the two components**, because the
components differ:

| | `PickProgress` | `PickProgressWeek` |
|---|---|---|
| Track | `bg-muted`, `overflow-hidden`, `h-6` | `bg-muted`, `overflow-hidden`, `h-5`, `shrink-0` |
| Fill | `bg-primary`, `transition-all`, `width: 5%` (5/100) | `bg-primary`, `transition-all`, `width: 50%` (5/10) |
| Label | `text-xs`, `text-white`, `5/100 picked` | `text-xs`, `text-white`, `5/10 picked` |

Both were renamed to `should render a progress bar track, proportional fill, and
centered label` — the old name no longer described the check, and a name that lies
is its own defect.

**Coverage is strengthened, not weakened.** The fill width and the label markup
were previously unasserted by any test, so D-03/D-05's proportional-fill behaviour
now has real coverage it never had before. The width assertion is non-vacuous:
`expect(undefined).toContain(...)` would throw, so the inline style is genuinely
present.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | `6edf735` | Classes A+B+C — seven non-loading files resolve and run |
| 2 | `1024a4f` | Class D — restore pick-map declarations |
| 3 | `b33a42c` | Class E — explicit `computed` imports |
| 4 | `1b4ccdc` | Class F — assert the shipped progress-bar contract |

`.planning/phases/05-standings-engine-ui/deferred-items.md` **was committed with
the fourth code commit** (the constraint allowed either that or leaving it staged).
It carries the corrected attribution, the per-file fix record, and the Class F
item moved from OPEN to RESOLVED, noting it was a stale test rather than a
component defect.

## Scope containment

`git diff --name-only 9ba8366..HEAD` over the five SCOPE-LOCKed paths returns
**empty**. Plan 05-01's standings work was not touched. Branch is still
`gsd/phase-05-standings-engine-ui`. No worktree, stash, or branch commands run;
no `eslint --fix` run against `bulkPickOperations.test.ts`.

## Self-Check: PASSED

- All 13 modified files verified present on disk
- All 4 commit hashes verified present in `git log`
- `package.json` / `pnpm-lock.yaml` verified unmodified (`git diff --name-only 9ba8366..HEAD` over both is empty)
- SCOPE-LOCK diff verified empty
- No `.skip` / `.todo` / `.only` added anywhere under `tests/`
- All four gates re-run and green after the final commit
