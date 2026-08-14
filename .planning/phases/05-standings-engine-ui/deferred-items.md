# Deferred Items — Phase 05 (Standings Engine & UI)

Out-of-scope discoveries logged during execution. Not fixed here (SCOPE
BOUNDARY: only issues caused by this plan's own changes are auto-fixed).

## Pre-existing test suite failures (discovered during 05-01)

`pnpm test` on the phase branch fails **11 test files / 45 tests** that are
untouched by Phase 5. Confirmed pre-existing: `git diff --name-only HEAD~2 HEAD`
shows none of these files were modified by plan 05-01, and the failures
reproduce on the commit that preceded any Phase 5 code.

| Test file | Failure | Likely cause |
|---|---|---|
| `tests/tiebreakers-steps.test.ts` | Cannot resolve `~/shared/domain/tiebreakers/steps` | Wrong alias — `~` maps to `app/`, not the repo root. Should be `#shared/...` or a relative path. |
| `tests/schemas.test.ts` | Import resolution failure at line 14 | Same alias class of bug. |
| `tests/fetch-source.test.ts` | Import resolution failure at line 6 | Same. |
| `tests/lib/empty-state.test.ts` | Failure at line 38 | Same. |
| `tests/lib/week-nav.test.ts` | Failure at line 74 | Same. |
| `tests/composables/usePicksStorage.test.ts` | Import resolution failure | Same. |
| `tests/composables/useAutoFilledGames.test.ts` | Import resolution failure | Same. |
| `tests/composables/fetch-schedule.test.ts` | 2 tests failing | — |
| `tests/utils/bulkPickOperations.test.ts` | 22 tests: `ReferenceError: currentPicks is not defined` | A no-unused-vars autofix renamed the declarations to `_currentPicks` but left the usages as `currentPicks`. |
| `tests/components/PickProgress.test.ts` | 10 tests failing at `PickProgress.vue:17` | Component relies on Nuxt auto-imports that the plain vitest project does not register. |
| `tests/components/PickProgressWeek.test.ts` | 11 tests failing | Same as above. |

**Impact on Phase 5:** none. The three test files this plan owns
(`tests/domain/standings/computeStandings.test.ts`,
`tests/components/StandingsTable.test.ts`, plus their fixtures) all pass, and
the `shared/domain/standings/**` coverage gate passes at 98.9% statements /
86% branches / 100% lines.

**Suggested owner:** a dedicated cleanup pass (`/gsd-audit-fix` or a small
quick task). The alias failures and the `_currentPicks` rename are both
mechanical; the PickProgress mounting failures need either
`@nuxt/test-utils`' nuxt-environment project or the same explicit-import
treatment `StandingsTable.vue` uses.
