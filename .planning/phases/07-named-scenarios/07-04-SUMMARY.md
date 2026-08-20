---
phase: 07-named-scenarios
plan: 04
subsystem: scenario-ui-components
tags: [nuxt-ui, USelectMenu, UModal, components, vue-test-utils]
dependencies:
  requires:
    - shared/types/scenarios.ts (ScenarioMeta) — Plan 07-01
  provides:
    - app/components/ScenarioSwitcher.vue
    - app/components/DeleteScenarioModal.vue
    - tests/helpers/nuxtUiStubs.ts (UButton/UIcon/USelectMenu/UModal test stand-ins)
  affects:
    - app/pages/week/[week].vue (Plan 07-05, mounts both components and wires their emits to useScenarios()'s CRUD functions)
tech-stack:
  added: []
  patterns:
    - "First-ever use of Nuxt UI 4's USelectMenu and UModal in this codebase"
    - "Test-only Vue component stubs (tests/helpers/nuxtUiStubs.ts) reproducing only the prop/slot/event contract needed, since the real Nuxt UI components import Nuxt build-time virtual modules unavailable under this project's plain (non-Nuxt) vitest project"
key-files:
  created:
    - app/components/ScenarioSwitcher.vue
    - app/components/DeleteScenarioModal.vue
    - tests/components/ScenarioSwitcher.test.ts
    - tests/components/DeleteScenarioModal.test.ts
    - tests/helpers/nuxtUiStubs.ts
  modified: []
decisions:
  - "Real Nuxt UI 4 components (USelectMenu, UModal, UButton, UIcon) cannot be mounted under this repo's plain vitest project — their source imports Nuxt build-time virtual modules (#build/ui/*) and useAppConfig from #imports, neither of which exist outside Nuxt's own Vite pipeline. Added tests/helpers/nuxtUiStubs.ts, lightweight defineComponent stand-ins reproducing only the prop/slot/event contract ScenarioSwitcher.vue/DeleteScenarioModal.vue rely on, wired in via @vue/test-utils's global.stubs option — proves each component's OWN event wiring, not Nuxt UI's internal behavior"
  - "editingId/editValue rename state uses a single ref pair (not per-row state) since only one row can be in edit state at a time — matches the plan's described interaction exactly"
metrics:
  duration: "50 min"
  completed: 2026-08-19
status: complete
---

# Phase 7 Plan 4: ScenarioSwitcher.vue and DeleteScenarioModal.vue Summary

Built the two components SCEN-02/03/04 need — a `USelectMenu`-based scenario switcher with inline per-row rename/duplicate/delete affordances and a pinned "+ New Scenario" row, and a `UModal`-based delete confirmation — both pure props-in/events-out with no storage or composable knowledge of their own, and both the first use of these two Nuxt UI 4 components anywhere in this codebase.

## What Was Built

- **`app/components/ScenarioSwitcher.vue`** — `USelectMenu` bound to `scenarios`/`modelValue` props, emitting `update:modelValue` on row selection. Per-row `item-trailing` slot renders three `UButton`s (pencil/copy/trash), each carrying `@click.stop` so a row action never also fires the menu's own item-selection. Rename is an inline text input swapped in for the row's label via a single `editingId`/`editValue` ref pair; Enter or blur commits `rename(id, name)`, Escape cancels without emitting. The trash button is `:disabled="props.scenarios.length <= 1"` with a `title="At least one scenario is required"` when disabled (D-14). A pinned `UButton` ("+ New Scenario") sits as a sibling to the `USelectMenu`, emitting `create` with no payload.
- **`app/components/DeleteScenarioModal.vue`** — `UModal` with `:title="`Delete &quot;${props.scenarioName}&quot;?`"` (HTML-entity-escaped so the Vue template compiler decodes it to literal double quotes around the interpolated name — verified by exact-string test). Body copy matches 07-UI-SPEC.md's Copywriting Contract verbatim. `#footer="{ close }"` renders Cancel (`@click="close"`, no `confirm` emit) and "Delete scenario" (`@click="() => { emit('confirm'); close() }"`, emits both `confirm` and `update:open(false)`).
- **`tests/helpers/nuxtUiStubs.ts`** — new shared test infrastructure (see Deviations below). `UButtonStub`/`UIconStub`/`USelectMenuStub`/`UModalStub`, each a small `defineComponent` reproducing only the prop/slot/event surface these two components use: `UButtonStub` forwards `$attrs` (including `onClick` with any `.stop` modifier baked in by Vue's compiler) onto a native `<button>`; `USelectMenuStub` renders `items` as `role="option"` rows, calling `item-label`/`item-trailing` scoped slots with `{ item }` and firing `update:modelValue` on row click; `UModalStub` renders `body`/`footer` scoped slots (with a `close` callback) only when `open` is true.
- **`tests/components/ScenarioSwitcher.test.ts`** — 11 tests covering every behavior in the plan: render, select, rename (pencil→input→Enter/blur/Escape), duplicate, delete, the D-14 disabled/enabled trash states, create, and an explicit assertion that rename/duplicate/delete clicks never also emit `update:modelValue` (the `@click.stop` regression case RESEARCH.md flagged by name).
- **`tests/components/DeleteScenarioModal.test.ts`** — 6 tests covering exact title/body copy, name interpolation, `open: false` rendering nothing, Cancel-never-confirms, Delete-emits-both, and never-emits-confirm-without-an-explicit-click (mount/setProps/unmount sequence).

## Task-by-Task

1. **ScenarioSwitcher.vue** — RED `0972077`, GREEN `3c637f0`
2. **DeleteScenarioModal.vue** — RED `74ddb92`, GREEN `4aca300`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Real Nuxt UI 4 components cannot mount under this project's vitest config**
- **Found during:** Task 1, writing `tests/components/ScenarioSwitcher.test.ts`
- **Issue:** The plan's action text says to create the test file using `@vue/test-utils`'s `mount()` "no composable to mock." Inspecting the installed `@nuxt/ui@4.10.0` package source directly (`node_modules/@nuxt/ui/dist/runtime/components/{Button,SelectMenu,Modal}.vue`) showed every one of them imports a Nuxt build-time virtual module (`#build/ui/button`, `#build/ui/select-menu`, `#build/ui/modal`) and calls `useAppConfig()` from `#imports` — both only exist when compiled through Nuxt's own Vite pipeline. This project's `vitest.config.ts` registers only `@vitejs/plugin-vue` (no Nuxt), so importing the real components throws at module-resolution time. No in-repo precedent exists either: `GameCard.vue`/`WeekNav.vue`/`TemplateMenu.vue` already use `UIcon`/`UButton`, but none of their test files (`GameCard.test.ts` explicitly, `WeekNav.vue`/`TemplateMenu.vue` have no test files at all) ever call `mount()` on them — the plan's own note that "there is no existing in-repo analog for either component" undersold the gap; there is no analog for mounting *any* Nuxt UI component in this repo, not just these two.
- **Fix:** Added `tests/helpers/nuxtUiStubs.ts`, lightweight `defineComponent` stand-ins for `UButton`/`UIcon`/`USelectMenu`/`UModal` reproducing only the prop/slot/event contract this phase's two components rely on (verified against RESEARCH.md's Code Examples and the real components' `.vue.d.ts` slot signatures), wired into both test files via `@vue/test-utils`'s `global: { stubs: nuxtUiTestStubs } }`. This is standard `@vue/test-utils` practice for testing a component's own integration logic against a third-party library's public contract without depending on that library's internal implementation. The stubs prove `ScenarioSwitcher.vue`/`DeleteScenarioModal.vue`'s own event wiring (emits, `@click.stop` propagation-stopping, `:disabled`/`:aria-label` bindings, scoped-slot item passing) — not Nuxt UI's own internals, which are that library's already-tested responsibility.
- **Files modified:** `tests/helpers/nuxtUiStubs.ts` (new), `tests/components/ScenarioSwitcher.test.ts`, `tests/components/DeleteScenarioModal.test.ts`
- **Commit:** `0972077` (introduced alongside the RED test commit)

**2. [Rule 1 - Bug] ESLint `@stylistic/quote-props` inconsistent quoting on `defineEmits` type literals**
- **Found during:** Task 1 and Task 2, pre-commit lint pass
- **Issue:** `defineEmits<{ 'update:modelValue': [...]; rename: [...]; ... }>()` mixed quoted (`'update:modelValue'`, required because of the colon) and unquoted (`rename`, `duplicate`, etc.) property keys, tripping the project's `@stylistic/quote-props` rule (consistent-quoting-once-any-key-needs-quotes). Also several `vue/max-attributes-per-line` warnings on multi-attribute single-line `UButton` tags in `DeleteScenarioModal.vue`.
- **Fix:** Ran `npx eslint --fix` on all five new files; quoted every emit key consistently and reformatted the two footer `UButton`s onto multiple lines. Re-ran `npx eslint` (exit 0) and the full component test suite (still 17/17 passing) after the fix to confirm no behavior changed.
- **Files modified:** `app/components/ScenarioSwitcher.vue`, `app/components/DeleteScenarioModal.vue`
- **Commit:** included in `3c637f0` and `4aca300` (fixed before either GREEN commit was made)

## Verification Results

- `npx vitest run tests/components/ScenarioSwitcher.test.ts tests/components/DeleteScenarioModal.test.ts` — **17 passed, 0 failed**
- `npx vitest run` (full suite) — **567 passed, 0 failed** across 47 files
- `npx eslint app/components/ScenarioSwitcher.vue app/components/DeleteScenarioModal.vue tests/components/ScenarioSwitcher.test.ts tests/components/DeleteScenarioModal.test.ts tests/helpers/nuxtUiStubs.ts` — exit 0, no errors or warnings
- `git diff --stat package.json pnpm-lock.yaml` — empty (no packages installed, per the plan's threat model `T-07-SC`)
- `pnpm typecheck` — fails with the same 5 pre-existing errors documented in `07-01-SUMMARY.md`, all in `app/pages/week/[week].vue` (out of this plan's scope; owned by Plan 07-05). Confirmed via a diff-free re-run before and after this plan's changes that the error set is byte-identical — this plan introduces zero new typecheck errors. `ScenarioSwitcher.vue` and `DeleteScenarioModal.vue` themselves typecheck cleanly (no errors reported against either file).
- **TDD gate compliance:** both tasks show a `test(...)` commit (RED) followed by a `feat(...)` commit (GREEN) in git log, per the plan-level TDD requirement. RED was verified empirically, not just by commit ordering: the two component files were temporarily moved aside (`mv ... .vue.bak`), `npx vitest run` was re-run and confirmed both suites failed with "Failed to resolve import," then the files were restored and the suite re-run to confirm GREEN, before any commit was made.

## Known Stubs

None — both components are fully wired to their declared props/emits with no placeholder data paths. (`tests/helpers/nuxtUiStubs.ts` is test-only infrastructure, not a production stub — it never ships in `app/`.)

## Threat Flags

None. `T-07-06` (user-supplied scenario names rendered via `{{ item.name }}` / template-literal `:title`/`:aria-label` bindings, no `v-html`/`innerHTML`/string concatenation anywhere) and `T-07-07` (`@click.stop` on every row-action button, `confirm` only ever emitted from an explicit button click) are both satisfied exactly as the plan's threat model specified — verified directly by the test suite's `@click.stop`/never-emits-without-explicit-click assertions, not just by code inspection. `T-07-SC` (zero packages installed) confirmed by the empty `package.json`/`pnpm-lock.yaml` diff above.

## Self-Check: PASSED

- FOUND: app/components/ScenarioSwitcher.vue
- FOUND: app/components/DeleteScenarioModal.vue
- FOUND: tests/components/ScenarioSwitcher.test.ts
- FOUND: tests/components/DeleteScenarioModal.test.ts
- FOUND: tests/helpers/nuxtUiStubs.ts
- FOUND commit: 0972077
- FOUND commit: 3c637f0
- FOUND commit: 74ddb92
- FOUND commit: 4aca300
