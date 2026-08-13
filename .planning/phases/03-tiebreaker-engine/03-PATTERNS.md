# Phase 3: Tiebreaker Engine - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 12 (7 domain modules + 5 test/fixture groups)
**Analogs found:** 12 / 12 (all role-match; no exact analogs exist — greenfield module, confirmed by direct codebase inspection)

## Greenfield Confirmation

Direct inspection confirms RESEARCH.md's "Runtime State Inventory" claim: `shared/` does not exist yet (`ls shared` returns nothing), and Phase 2 has not been executed (no `app/` beyond Nuxt scaffolding was inspected as out of scope for this phase). The only prior code in the repo is Phase 1's `scripts/lib/*.ts` + `tests/*.test.ts` + `tests/fixtures/*.json`. These are the closest available analogs for conventions (schema/type shape, pure-function style, error/never-throw discipline, flat test-file layout, fixture-directory convention), even though none of them do multi-step recursive resolution — that logic is genuinely new to this phase.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `shared/domain/tiebreakers/types.ts` | model | transform | `scripts/lib/schemas.ts` (interfaces `TeamOutput`/`GameOutput`) | role-match (interface/type conventions) |
| `shared/domain/tiebreakers/records.ts` | utility | transform (CRUD-like aggregation) | `scripts/lib/schedule-hash.ts` (pure fn over array→derived value) | role-match |
| `shared/domain/tiebreakers/baseOrdering.ts` | utility | transform | `scripts/lib/schedule-hash.ts` | role-match |
| `shared/domain/tiebreakers/steps.ts` | utility | transform | `scripts/lib/schemas.ts` (`reportRequiredFieldFailures`/`reportGameFailures` — map-then-filter-then-report pattern) | role-match |
| `shared/domain/tiebreakers/engine.ts` | service | transform (recursive) | `scripts/lib/coverage.ts` (`vendorLogo` — discriminated-union result type, never-throw discipline) | partial-match (no recursive analog exists; result-type shape is the transferable part) |
| `shared/domain/tiebreakers/rules.ts` | config | transform | `scripts/lib/schemas.ts` (schema-as-data-table style, e.g. `RawTeamSchema`/`RequiredTeamFieldsSchema` pair) | partial-match |
| `shared/domain/tiebreakers/acc.ts` | utility | transform | `shared/domain/tiebreakers/rules.ts` (sibling, same phase) | new-pattern (no prior analog; genuinely new algorithm per RESEARCH.md) |
| `vitest.config.ts` (edit) | config | — | `vitest.config.ts` (existing, being extended) | exact (same file) |
| `tests/fixtures/tiebreakers/{sec,bigten,big12,acc}.fixtures.ts` | test-fixture | transform | `tests/fixtures/cfbd-teams-sample.json`, `tests/fixtures/cfbd-games-sample.json` | role-match (fixture convention differs: prior fixtures are `.json` data files; this phase's are `.ts` per RESEARCH.md's own module-structure recommendation — flagged below) |
| `tests/tiebreakers-{sec,bigten,big12,acc}.test.ts` | test | transform | `tests/schemas.test.ts` | exact (flat `tests/*.test.ts`, fixture-import, `describe`/`it` structure) |
| `tests/tiebreakers-engine.test.ts` | test | transform | `tests/schedule-hash.test.ts` | exact (pure-function invariant testing: determinism, edge cases, format assertions) |

## Pattern Assignments

### `shared/domain/tiebreakers/types.ts` (model, transform)

**Analog:** `scripts/lib/schemas.ts`

**Interface style** (lines 33-42, `scripts/lib/schemas.ts`):
```typescript
export interface TeamOutput {
  id: number
  school: string
  mascot: string | null
  abbreviation: string | null
  conference: string
  classification: string | null
  color: string
  alternateColor: string
}
```
Copy this convention: plain exported `interface`, no class, explicit nullability on every field that can be null, no optional (`?`) fields except where RESEARCH.md's own `Team.logo?` sketch calls for it. Apply the same discipline to `StepOutcome`, `TiebreakerCycle`, `TerminalReason`, `TiebreakerResult` (discriminated union), and `ChampionshipResult` as specified in RESEARCH.md's "Full type surface" section — these are already fully specified there; this analog is for *house style* (doc comments above every exported type explaining the "why," e.g. lines 3-7, 20-26, 44-48, 83-87, 113-123, 144-149 all follow a "one JSDoc block per export, explaining the decision it encodes" pattern).

---

### `shared/domain/tiebreakers/records.ts` / `baseOrdering.ts` (utility, transform)

**Analog:** `scripts/lib/schedule-hash.ts`

**Full pure-function pattern** (`scripts/lib/schedule-hash.ts`, entire 17-line file):
```typescript
import { createHash } from 'node:crypto'

/**
 * Fingerprints a season's game-id list for share-link/bitpack drift detection (D-11/D-12).
 *
 * Sorts the ids numerically (never the default lexicographic sort — see
 * RESEARCH.md Pitfall 3), joins them with a comma, and returns the first 8
 * hex characters (u32) of the SHA-256 digest of that string.
 */
export function computeScheduleHash(gameIds: number[]): string {
  const sorted = [...gameIds].sort((a, b) => a - b)
  const input = sorted.join(',')
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}
```
Copy: single named export, no default export, top-of-file doc comment citing the *decision* the function encodes (not just what it does — note the explicit "never the default lexicographic sort" warning), zero I/O, zero framework imports. `deriveConferenceRecords`/`computeBaseOrdering` should follow this exact shape: one function, one clear input→output, a doc comment citing which RESEARCH.md pitfall/decision it defends against (e.g. cite Pitfall 4's circularity trap in `computeBaseOrdering`'s doc comment, cite the NaN-guard in `deriveConferenceRecords`'s).

---

### `shared/domain/tiebreakers/steps.ts` (utility, transform)

**Analog:** `scripts/lib/schemas.ts` — `reportRequiredFieldFailures`/`reportGameFailures`

**Map-then-filter-then-shape pattern** (lines 73-81 and 151-159, `scripts/lib/schemas.ts`):
```typescript
export function reportRequiredFieldFailures(rawTeams: unknown[]): RequiredFieldFailure[] {
  return rawTeams
    .map(raw => ({ raw, result: RequiredTeamFieldsSchema.safeParse(raw) }))
    .filter(({ result }) => !result.success)
    .map(({ raw, result }) => ({
      teamId: (raw as { id?: number }).id,
      errors: z.flattenError(result.error!).fieldErrors
    }))
}
```
This is the closest existing example of "iterate every item, never throw, return a report array" — the same discipline RESEARCH.md's NaN-guard section demands (`StepValue` must never construct a bare `wins/games` division; route through a helper returning `{ kind: 'indeterminate' }` on a zero denominator, analogous to how `reportRequiredFieldFailures` never throws on a bad record but reports it). Each `evaluateStep(stepId, ...)` function in `steps.ts` should mirror this "never throw, always return a structured result describing what happened" shape — directly matching `StepOutcome`'s `values`/`partition`/`separated` fields as specified in RESEARCH.md.

---

### `shared/domain/tiebreakers/engine.ts` (service, transform/recursive)

**Analog:** `scripts/lib/coverage.ts` — `vendorLogo`

**Discriminated-union result + never-throw pattern** (lines 11-14, 26-54, `scripts/lib/coverage.ts`):
```typescript
export type VendorLogoResult
  = | { status: 'ok', path: string }
    | { status: 'missing' }
    | { status: 'download-failed' }

/**
 * ...
 * Never throws — all network/filesystem errors resolve to
 * `{ status: 'download-failed' }`.
 */
export async function vendorLogo(teamId: number, logoUrl: string | null | undefined, opts?: VendorLogoOptions): Promise<VendorLogoResult> {
  if (!logoUrl) return { status: 'missing' }
  // ...
  try {
    // ...
  } catch {
    return { status: 'download-failed' }
  }
}
```
This is the project's one existing example of a **discriminated-union return type with an explicit "never throws" doc-comment guarantee** — exactly the pattern `TiebreakerResult` (`'resolved' | 'needsUserInput'`) needs. `resolveTiedGroup`/`resolveConferenceChampionship` should carry the same explicit "never throws under normal operation; dev-mode assertions guard the two recursion invariants" doc comment, matching this file's `vendorLogo` doc-comment style (lines 16-28). Note `vendorLogo` also demonstrates the project's dependency-injection-for-testability convention (`opts?: VendorLogoOptions` with `fetchImpl`/`writeFileImpl`/`existsImpl` defaults) — not directly needed by a pure recursive function with no I/O, but worth preserving as the project's general "make side effects injectable" convention if `engine.ts` ever needs a dev-mode assertion hook.

---

### `shared/domain/tiebreakers/rules.ts` (config, transform)

**Analog:** `scripts/lib/schemas.ts` — `RawTeamSchema`/`RequiredTeamFieldsSchema` pairing

**Schema-as-data pattern** (lines 8-18, 27-31):
```typescript
export const RawTeamSchema = z.object({ /* ... */ })

/**
 * Narrower schema for D-09's hard-fail check — same shape as `RawTeamSchema`,
 * but `conference`/`color`/`alternateColor` are required non-null.
 */
export const RequiredTeamFieldsSchema = RawTeamSchema.extend({ /* ... */ })
```
Only the *documentation discipline* transfers here (no zod involved in `rules.ts`): each `CONFERENCE_RULES[conf]` entry should carry the same "why is this shaped this way" comment density as the schema pair above, especially at the exact decision points D-02/D-03/D-04/D-05 call out (SEC's missing step E, the omitted terminal ranking step, `terminalReason`, the Big 12 collective-bucket flag). This is a data-table config file, not a schema, but the "comment every field that encodes a specific real-world decision, cite the D-number" convention is what should carry over.

---

### `tests/tiebreakers-*.test.ts` (test, transform)

**Analog:** `tests/schemas.test.ts` and `tests/schedule-hash.test.ts`

**Fixture-load + describe/it pattern** (lines 1-24, `tests/schemas.test.ts`):
```typescript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  RawTeamSchema, RequiredTeamFieldsSchema, transformTeam,
  reportRequiredFieldFailures, RawGameSchema, transformGame, reportGameFailures
} from '../scripts/lib/schemas'

const fixturesDir = fileURLToPath(new URL('./fixtures/', import.meta.url))
const rawTeams = JSON.parse(readFileSync(`${fixturesDir}cfbd-teams-sample.json`, 'utf-8')) as unknown[]
```

**Pure-invariant test pattern** (entire `tests/schedule-hash.test.ts`, 32 lines):
```typescript
describe('computeScheduleHash', () => {
  it('returns the RESEARCH.md-verified hash for the known fixture ids', () => {
    expect(computeScheduleHash([401628355, 401628301, 401628288])).toBe('ffe3f098')
  })
  it('is invariant to input array order', () => { /* ... */ })
  it('is deterministic across calls with the same input in any order', () => { /* ... */ })
  it('returns a defined 8-character hex string for an empty array without throwing', () => { /* ... */ })
})
```
Both patterns should be combined for the tiebreaker suite: `tiebreakers-{sec,bigten,big12,acc}.test.ts` import from a per-conference `.ts` fixture module (not `.json`, per RESEARCH.md's own recommendation — see "No Analog Found" below) using the same relative-import + `describe`/`it` shape as `schemas.test.ts`; `tiebreakers-engine.test.ts` follows `schedule-hash.test.ts`'s "assert invariants directly" style (determinism, no-re-entry, no-NaN, edge cases like zero-common-opponents) rather than only asserting one happy-path example.

---

## Shared Patterns

### Never-throw / structured-failure discipline
**Source:** `scripts/lib/coverage.ts` (`vendorLogo`, lines 26-54) and `scripts/lib/schemas.ts` (`reportRequiredFieldFailures`/`reportGameFailures`, lines 73-81, 151-159)
**Apply to:** `steps.ts`, `engine.ts`, `records.ts` — every domain function should return a structured result/report rather than throwing on bad-but-plausible input; reserve `throw` only for genuine programmer-error boundary violations (RESEARCH.md's V5 note: throw on a `GameId`/`TeamId` that doesn't belong to `conferenceGames`, matching the "fail loudly on programmer error, never on malformed-but-parseable domain data" split already established by this codebase's schema-validation vs. transform functions).

### Doc-comment-cites-decision convention
**Source:** every exported function/type in `scripts/lib/*.ts` (e.g. `schedule-hash.ts` lines 3-12, `coverage.ts` lines 16-28, `schemas.ts` lines 3-7/20-26/44-48)
**Apply to:** all new `shared/domain/tiebreakers/*.ts` files — every exported symbol gets a doc comment that names the specific decision (D-01 through D-12) or Pitfall (1-6) it encodes, not just a restatement of the type signature. This is the single most consistent convention across the existing codebase and directly serves this phase's audit trail requirement (D-06's flagged Big 12 ambiguity needs exactly this kind of comment at `rules.ts`'s Big 12 entry).

### Flat test-file + `tests/fixtures/` subdirectory layout
**Source:** `tests/schemas.test.ts` + `tests/fixtures/cfbd-teams-sample.json`, `tests/fixtures/cfbd-games-sample.json`
**Apply to:** all 5 new test files and the 4 new fixture files — flat `tests/*.test.ts` naming (not `__tests__/` or co-located `*.spec.ts`), fixtures under a `tests/fixtures/` subdirectory. RESEARCH.md's own module-structure recommendation (`tests/fixtures/tiebreakers/*.fixtures.ts`) already matches this, with one adaptation flagged below.

### `vitest.config.ts` incremental-edit convention
**Source:** existing `vitest.config.ts` (4 lines, `defineConfig({ test: { environment: 'node', include: [...], passWithNoTests: true } })`)
**Apply to:** D-11's coverage-block addition — extend the existing `test` object in place rather than restructuring; RESEARCH.md's own Code Examples section already shows the exact diff shape (add a `coverage` sibling key to `test`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shared/domain/tiebreakers/engine.ts` (recursive core) | service | transform (recursive) | No recursive/self-calling function exists anywhere in the current codebase; `vendorLogo`'s result-type/never-throw shape is the closest available analog but the recursion + cycle-accumulator design is genuinely new. Planner should rely on RESEARCH.md's "Recursive Restart Algorithm" pseudocode directly. |
| `shared/domain/tiebreakers/acc.ts` | utility | transform | The ACC's `defineTiedTeams` algorithm (wins-or-losses cross-schedule-length matching) has no precedent anywhere in Phase 1's code — RESEARCH.md's own pseudocode (lines 250-263) is the primary source, not a codebase analog. |
| `tests/fixtures/tiebreakers/*.fixtures.ts` (format) | test-fixture | transform | Phase 1's fixtures are static `.json` files (`cfbd-teams-sample.json`, `cfbd-games-sample.json`) loaded via `readFileSync`. RESEARCH.md's module-structure recommendation for this phase specifies `.ts` fixture modules instead (to hold typed `Game[]`/outcome-map literals with inline hand-derivation comments, per D-10/D-12's "assert full trace content" requirement) — this is a deliberate, RESEARCH.md-endorsed deviation from the Phase 1 JSON-fixture convention, not an oversight. Planner should follow RESEARCH.md's `.ts` recommendation, not Phase 1's `.json` precedent. |
| `shared/domain/tiebreakers/` directory itself | — | — | `shared/` does not exist in the repo yet at all (confirmed via `ls shared` returning empty) — this phase creates the directory from nothing, consistent with RESEARCH.md's "Runtime State Inventory: Not applicable — greenfield phase" statement. |

## Metadata

**Analog search scope:** `scripts/lib/`, `tests/`, `tests/fixtures/`, repo root config files (`vitest.config.ts`, `package.json`); confirmed `shared/` and `app/` (beyond Nuxt scaffolding) do not yet contain phase-relevant code
**Files scanned:** `scripts/lib/schemas.ts`, `scripts/lib/schedule-hash.ts`, `scripts/lib/coverage.ts`, `scripts/lib/fetch-source.ts` (listed, not read — schema/hash/coverage already gave sufficient pattern coverage), `tests/schemas.test.ts`, `tests/schedule-hash.test.ts`, `tests/coverage.test.ts` (listed), `tests/fetch-source.test.ts` (listed), `vitest.config.ts`, `package.json`
**Pattern extraction date:** 2026-08-13
