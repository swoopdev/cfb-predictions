---
phase: 07-named-scenarios
reviewed: 2026-08-19T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - app/components/DeleteScenarioModal.vue
  - app/components/PickProgress.vue
  - app/components/PickProgressWeek.vue
  - app/components/PicksWorkspace.vue
  - app/components/ScenarioSwitcher.vue
  - app/composables/useAutoFilledGames.ts
  - app/composables/useManualTiebreakers.ts
  - app/composables/usePickProgress.ts
  - app/composables/usePicksStorage.ts
  - app/composables/useScenarios.ts
  - app/composables/useStandings.ts
  - app/pages/week/[week].vue
  - app/utils/scenarioKeys.ts
  - shared/types/scenarios.ts
  - tests/components/DeleteScenarioModal.test.ts
  - tests/components/PickProgress.test.ts
  - tests/components/PickProgressWeek.test.ts
  - tests/components/ScenarioSwitcher.test.ts
  - tests/composables/useAutoFilledGames.test.ts
  - tests/composables/useManualTiebreakers.test.ts
  - tests/composables/usePickProgress.test.ts
  - tests/composables/usePicksStorage.test.ts
  - tests/composables/useScenarios.test.ts
  - tests/composables/useStandings.test.ts
  - tests/helpers/nuxtUiStubs.ts
  - tests/lib/empty-state.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 07: Code Review Report (Re-Review)

**Reviewed:** 2026-08-19
**Depth:** standard
**Files Reviewed:** 24 (source + test)
**Status:** issues_found

## Summary

This is a re-review after six prior fix commits (CR-01, WR-01 through WR-04 across two rounds). All six previously-reported issues were verified fixed by reading the current code and, where the fix was non-obvious, by reproducing the previous defect and its resolution directly (e.g. confirmed `useStorage`'s HTML-entity handling in `DeleteScenarioModal.vue`'s title interpolation is correct — Vue's SFC template compiler decodes `&quot;` before the JS expression is evaluated, so no literal `&quot;` reaches the DOM — and confirmed the corrupt-key `null`-check fix in `usePicksStorage.ts` is applied correctly).

One new defect was found and reproduced with a throwaway test: `useScenarios.ts`'s `createScenario` default-naming scheme (`Scenario ${registry.value.length + 1}`) can silently produce two scenarios sharing the exact same auto-generated name after a delete-then-create cycle, because it derives the number from the registry's *current* length rather than a value that only ever increases. This does not corrupt data (identity is still the UUID `id`, never the `name`), but it directly undermines the feature's own purpose — a switcher meant to disambiguate scenarios by name can render two rows with an identical label, with no way for the user to tell them apart except by clicking into each one.

The remaining findings are minor (Info-level): a UX papercut around losing in-progress inline-rename input when switching rows/scenarios mid-edit, a missing `aria-label` on the rename `<input>` itself, a cosmetic redundant "+" in the New Scenario button, and a brittle source-grounding test pattern.

Storage validation (`useScenarios.ts`'s `validateRegistry`, `usePicksStorage.ts`'s per-entry validation, `useManualTiebreakers.ts`'s cap/shape enforcement) is thorough and defends against hand-edited/malicious localStorage content consistently across all three composables. The scenario-scoping mechanism (`scenarioKeys.ts` as the single key-building surface, fresh `useStorage()` instances per scenario id via the `:key="activeScenarioId"` remount boundary) is correctly and consistently applied everywhere it's used.

## Warnings

### WR-01: `createScenario`'s default name can collide with an existing scenario's name after a delete-then-create cycle

**File:** `app/composables/useScenarios.ts:137-153`

**Issue:** The default name is computed as `` `Scenario ${registry.value.length + 1}` `` — derived from the registry's length *at the moment of the call*, not from a value that only ever increases. Deleting a scenario shrinks the registry, so a subsequent `createScenario()` call can reuse a number that's already taken by a surviving scenario.

Reproduced directly:
```
Scenario 1 (initial default)
createScenario() -> "Scenario 2"   // registry.length was 1
deleteScenario(id of "Scenario 1") // registry now: ["Scenario 2"], length 1
createScenario() -> "Scenario 2"   // registry.length is 1 again -> COLLISION
```
Two entries named "Scenario 2" now coexist in the registry and both render in `ScenarioSwitcher.vue`'s dropdown with an identical label — the user has no way to tell them apart short of opening each one. This is not a data-loss or correctness bug (each entry's `id` is still the durable, unique identity used for storage keys and routing), but it directly undermines the feature: named scenarios exist so users can distinguish "what-if" sets by name, and this defeats that for exactly the delete-then-recreate workflow the switcher's own trash-icon affordance encourages.

**Fix:** Derive the number from a value that can't shrink — e.g. track the highest `N` ever used (could be recovered from parsing existing `Scenario \d+` names on read, or a small persisted counter), or check for a name collision and increment past it:
```typescript
function nextDefaultName(): string {
  const used = new Set(
    registry.value
      .map(s => /^Scenario (\d+)$/.exec(s.name)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number)
  )
  let n = registry.value.length + 1
  while (used.has(n)) n++
  return `Scenario ${n}`
}
```

## Info

### IN-01: Inline rename `<input>` has no `aria-label`

**File:** `app/components/ScenarioSwitcher.vue:100-109`

**Issue:** Every icon-only trigger button (`Rename ${item.name}`, `Duplicate ${item.name}`, `Delete ${item.name}`) has an explicit `aria-label`, but the rename `<input>` that trigger opens has none — a screen reader announces it as an unlabeled text input inside the option row, giving no indication it's renaming that specific scenario.

**Fix:** Add `:aria-label="`Rename ${item.name}`"` (or similar) to the `<input>` itself.

### IN-02: Switching rows/scenarios mid-rename silently discards the in-progress edit, and can leave a stray open input for a no-longer-active scenario

**File:** `app/components/ScenarioSwitcher.vue:48-51, 86-144`

**Issue:** `editingId` is a single ref, so starting a rename on a different row (pencil click) or selecting a different scenario in the dropdown while a rename is mid-edit simply drops the first row back to `v-if="editingId === item.id"` → `false`, discarding whatever the user had typed with no confirmation and no commit. Because `ScenarioSwitcher.vue` lives outside `PicksWorkspace.vue`'s `:key="activeScenarioId"` remount boundary, selecting a different scenario from the dropdown while another row's rename input is open does not reset that input's edit state either — the open `<input>` for the previously-active (now not-selected) row remains rendered.

**Fix:** On `update:modelValue` (row selection) and on `startRename` for a different id, either auto-commit the pending edit (mirroring the existing blur-commits behavior) or explicitly `cancelRename()` first, so there is never an orphaned open input or a silently-discarded edit.

### IN-03: "+ New Scenario" button pairs a `lucide:plus` icon with a label that itself starts with "+"

**File:** `app/components/ScenarioSwitcher.vue:146-152`

**Issue:** `icon="lucide:plus"` and `label="+ New Scenario"` together render two plus signs (the icon glyph and the literal "+" character) for the same affordance.

**Fix:** Drop the leading `+` from the label (`label="New Scenario"`) since the icon already conveys "add."

### IN-04: `PicksWorkspace.vue` empty-state copy tests assert on raw source text rather than rendered behavior

**File:** `tests/lib/empty-state.test.ts:41-58`

**Issue:** The `'PicksWorkspace.vue' empty-state copy` describe block reads `PicksWorkspace.vue` off disk with `readFileSync` and asserts the raw source `.toContain(...)` two literal strings. This proves the strings exist somewhere in the file, not that they render in the correct branch/condition — a future edit that moved "No games this week" into the wrong `v-else-if` branch, or duplicated it as a code comment, would still pass. The `determineEmptyStateVariant` unit tests directly above it are the real behavioral coverage; this second block adds source-grounding without adding assurance about wiring.

**Fix:** Replace with (or supplement via) a `@vue/test-utils` mount of `PicksWorkspace.vue` asserting the correct copy renders for `emptyVariant: 'week-empty'` / `'filter-empty'` respectively, consistent with how `ScenarioSwitcher.test.ts`/`DeleteScenarioModal.test.ts` verify rendered output rather than source text.

---

_Reviewed: 2026-08-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
