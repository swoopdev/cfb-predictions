---
phase: 05-standings-engine-ui
plan: 02
subsystem: standings
tags: [standings, vue-ui, responsive, accessibility, testing]
status: complete

requires:
  - computeStandings() / P4_CONFERENCES (Plan 05-01) — the four-conference standings result
  - StandingsTable.vue (Plan 05-01) — single-conference table markup
  - sanitizeConfParam / KNOWN_CONFERENCES (Phase 2) — the `?conf=` filter the sidebar reads
provides:
  - StandingsSidebar.vue — the filter-aware, collapsible standings panel
affects:
  - Phase 6 — the sidebar is where manually-resolved tiebreaker rankings will surface

tech-stack:
  added: []
  patterns:
    - Components that must be unit-testable avoid Nuxt UI components and Nuxt auto-imports entirely — explicit `import { ... } from 'vue'` and relative child-component imports
    - Responsive behaviour expressed as Tailwind `lg:` variants in the component, not as hand-written CSS in a stylesheet
    - Untrusted URL query values validated against a derived allowlist at the display boundary, degrading to the unfiltered view

key-files:
  created:
    - app/components/StandingsSidebar.vue
    - tests/components/StandingsSidebar.test.ts
  modified:
    - app/pages/week/[week].vue
    - app/components/StandingsTable.vue

decisions:
  - Sidebar owns the all-four-vs-single-conference branching; the week page passes the unfiltered result through, keeping filtering display-only
  - Display order derived from P4_CONFERENCES rather than re-listed, so "which conferences are P4, and in what order" has one definition
  - Collapse breakpoint stays `lg` (1024px), not the `md` (768px) the plan specified
  - Responsive styling lives in the component as Tailwind variants; no `app/app.css` was created
  - Hand-rolled the toggle button instead of using UButton, to keep the sidebar mountable in the plain vitest project
  - A non-P4 conference filter shows all four conferences plus one line of explanation rather than an empty panel

metrics:
  duration: ~25 min
  completed: 2026-08-14
  tasks: 2
  commits: 2
  tests_added: 20
---

# Phase 5 Plan 02: Multi-Conference Standings Sidebar Summary

A `StandingsSidebar` that renders all four P4 conferences stacked, or exactly one when the week view's conference filter is active, collapsing behind a toggle on narrow viewports — with the filter value treated as untrusted input and the rank column reworked so a shared rank is the whole tie signal.

## What Was Built

**`app/components/StandingsSidebar.vue`** — the panel that owns exactly one decision: *which* conferences to render (D-02). It does not compute, filter, or reorder standings data; `computeStandings()` still returns all four conferences and the sidebar chooses from them at display time, which is what keeps the computation pure and reusable for Phase 6.

- **No filter → all four**, in `SEC, Big Ten, Big 12, ACC` order, separated by dividers inside one independently-scrollable panel.
- **P4 filter → that conference alone.**
- **Anything else → all four.** `activeConference` arrives from the user-controlled `?conf=` query param, so it is validated against the P4 allowlist (T-05-03). The `All` sentinel, an unknown string, an empty string and a hand-edited injection-shaped value all land on the unfiltered view rather than an empty or broken panel.
- **Mobile:** collapsed by default behind a labelled toggle carrying `aria-expanded` / `aria-controls` and a decorative rotating chevron. **Desktop (`lg`+):** the toggle is gone and the panel is unconditionally visible, sticky, and capped at `calc(100vh-6rem)` with `overscroll-contain` so its scroll never chains to the page.

**`app/pages/week/[week].vue`** — the SEC-only `<aside>`, its local `showStandings` ref and the `secStandings` computed are gone, replaced by `<StandingsSidebar :standings="standings" :active-conference="conf" />`. The page no longer knows anything about which conferences are displayed.

**`app/components/StandingsTable.vue`** — visual polish, no behavioural change:

- The rank column is now `w-8`, left-aligned, tabular and at full-weight `text-default`. It carries the entire tie signal (D-05/D-06 forbid a badge, icon or tooltip), so three teams sharing a `2` have to be obvious in one downward glance — which a dimmed, right-aligned number is not. `w-8` also fits the two-digit ranks an 18-team Big Ten produces without the column reflowing.
- Column headers moved from 10px `text-dimmed` to 12px `text-muted` — the weakest contrast pair in the table, and the first thing to fail CLAUDE.md's "contrast must hold up at small sizes" in light mode.
- The conference heading moved from `text-dimmed` to `text-toned`. With four tables stacked it is a wayfinding element, not a de-emphasised label.
- Records are `whitespace-nowrap` so `10-2` never breaks across lines; team names are deliberately left with no `truncate`/`nowrap`, since the longest P4 school (`Mississippi State`, 17 chars) fits the 320px sidebar and wrapping is the correct failure mode if a narrower viewport ever forces one — a clipped team name is not.

## Key Decisions

**The sidebar owns the branching; the page owns nothing about it.** The plan already specified this ("StandingsSidebar handles the branching logic internally; week view doesn't need to know about filtering") and it is what makes the filter logic unit-testable in isolation.

**Display order is derived, not re-listed.** `P4_CONFERENCES` is `Object.keys(CONFERENCE_RULES)`, which already yields `SEC, Big Ten, Big 12, ACC` — exactly the order the plan asked for. Hard-coding that array in the sidebar would have created a second definition of P4 membership, which is the same DRY trap Plan 05-01 avoided.

**Kept `lg` (1024px) as the collapse breakpoint instead of the plan's `md` (768px).** Between 768px and 1024px a 320px sidebar leaves the game grid — whose cards have a 280px minimum — a single cramped column. The plan's `@media (max-width: 768px)` was a starting suggestion under "Claude's discretion on mobile collapse mechanism"; `lg` also matches the two-column layout breakpoint the page already uses, so the sidebar and the slate flip at the same moment.

**A non-P4 filter shows all four conferences plus one line of explanation.** Filtering to a G5 conference is legal in the Phase 2 filter but has no standings in v1. Silently showing all four would look like the app had ignored the filter, so the panel says "Standings cover the four power conferences." This does not conflict with D-06's no-explanation rule, which is scoped to tie *indication*.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `app/app.css` does not exist**

- **Found during:** Task 2
- **Issue:** The plan's `files_modified` and CSS-implementation section both target `app/app.css`. There is no such file. The project's only stylesheet is `app/assets/css/main.css`, and it contains nothing but `@import` lines and `@theme` token definitions — the codebase uses zero hand-written CSS classes.
- **Fix:** Expressed all responsive behaviour as Tailwind `lg:` variants inside `StandingsSidebar.vue` instead of creating a stylesheet with `.standings-sidebar` rules. Creating `app/app.css` would also have had no effect: it is not in `nuxt.config.ts`'s `css` array.
- **Files modified:** `app/components/StandingsSidebar.vue` (in place of `app/app.css`)
- **Commit:** 58dd42d

**2. [Rule 2 - Missing critical functionality] Hand-rolled the toggle button instead of using `UButton`**

- **Found during:** Task 1
- **Issue:** The plan suggested Nuxt UI components (`UButton`, `UCard`, `UCollapsible`) for the toggle. Any Nuxt UI component makes the host component unmountable in this project's plain vitest setup, which registers no Nuxt auto-import plugin — the reason `GameCard` has no render tests at all. The sidebar's branching logic is both the plan's headline must-have *and* its registered threat (T-05-03); leaving it verifiable only by manual browser inspection was not acceptable.
- **Fix:** The toggle is a plain `<button>` styled with the same Nuxt UI semantic tokens `UButton`'s `variant="subtle" color="neutral"` resolves to, and the `UCard` wrapper became a `rounded-lg bg-default ring ring-default` div matching Nuxt UI's own card recipe. `StandingsTable` is imported relatively rather than via component auto-import. Result: 20 automated tests instead of a manual checklist.
- **Files modified:** `app/components/StandingsSidebar.vue`, `tests/components/StandingsSidebar.test.ts`
- **Commits:** 945b180, 58dd42d

**3. [Rule 2 - Missing critical functionality] Empty-panel case for non-P4 conference filters**

- **Found during:** Task 1
- **Issue:** The plan's threat mitigation covers "unknown values", but the Phase 2 filter offers 11 conferences of which only 4 have standings. Filtering to `Mountain West` is a legal, non-malicious action that the plan's spec leaves rendering all four P4 standings with no acknowledgement of the filter.
- **Fix:** The same allowlist fallback applies, plus one dimmed line of copy in that specific case. Asserted in both directions (present for `Mountain West`, absent for `ACC` and for no filter).
- **Files modified:** `app/components/StandingsSidebar.vue`
- **Commit:** 945b180

### Scope Notes

- Task 2's plan text asked to "verify" tie indication rather than change it. Verification found the rank column dimmed and at the same weight as everything else, which undercuts the D-05/D-06 premise that matching ranks alone communicate a tie. Treated as in-scope polish for the task that owns tie indication.

## Verification

| Check | Result |
| --- | --- |
| `pnpm test` | **365 passed / 18 skipped / 0 failed** (31 files passed, 1 skipped) — baseline was 345/18/0, so +20 and no regression |
| `tests/components/StandingsSidebar.test.ts` | 20 passed |
| `pnpm lint` | Passes |
| `pnpm typecheck` | Passes |
| `pnpm build` | Exit 0, build complete |
| No hard-coded colours in either component | Clean (grep for hex, `rgb(`, and literal Tailwind palette classes) |
| Every new utility resolves to a real emitted rule | Verified against the built `entry.*.css`: `hover:bg-elevated/60`, `focus-visible:outline-primary`, `focus-visible:outline-offset-2`, `lg:overflow-y-auto`, `lg:max-h-[calc(100vh-6rem)]`, `lg:hidden`, `lg:block`, `lg:sticky`, `whitespace-nowrap`, `overscroll-contain`, `rotate-180`, `divide-default`, `first:pt-0`, `last:pb-0`, `ring-accented`, `w-8`, `text-muted` — all present, all backed by `--ui-*` variables |

**All four conferences, in order:** asserted on the rendered `h3` sequence equalling `['SEC','Big Ten','Big 12','ACC']`.

**Single conference when filtered:** asserted per-conference via `it.each` over all four, plus a positive/negative row check (filtering to Big Ten shows `Ohio State`, not `Alabama`).

**Untrusted filter value (T-05-03):** asserted for the `All` sentinel, an unknown conference name, an empty string and `<script>alert(1)</script>` — all four fall back to the full four-conference view.

**Missing conference keys:** asserted that a `standings` object containing only `SEC` still renders all four sections, with `ACC` showing its empty state rather than throwing.

**Collapse contract:** asserted that the panel starts `hidden` with `aria-expanded="false"`, that clicking flips both the attribute and the class and the label text, that clicking again restores the collapsed state, and that the toggle is `lg:hidden` while the panel is `lg:block` — which together mean a collapsed state cannot survive past the breakpoint and strand a desktop user with no standings and no visible way to reveal them.

**No clipping:** asserted that no team-name cell carries `truncate` or `whitespace-nowrap`.

## Known Stubs

None. Every rendered value is wired to the real `computeStandings()` result.

## Threat Flags

None. No network endpoint, auth path, file access or schema change was introduced. The plan's registered boundary (`conference filter → standings display`, T-05-03) is mitigated by the P4 allowlist check with four dedicated tests; T-05-04 was accepted by the plan and is unchanged.

## For the Next Phase

- Phase 6 surfaces manual tiebreaker resolution in this sidebar. `StandingsSidebar` takes a `StandingsResult` and nothing else, so a manually-resolved ranking flows in with no signature change — the manual resolution belongs in the `resolvedTiebreakers` argument to `computeStandings()` in `week/[week].vue`, exactly as Plan 05-01 noted.
- Any new component that needs render tests must avoid Nuxt UI components and Nuxt auto-imports. `StandingsSidebar` and `StandingsTable` are the two worked examples; `GameCard` is the counter-example that has no tests because of it.
- The `isTied` flag on each row remains populated and unused. Matching rank numbers now carry the signal more strongly than they did in 05-01, so Phase 6 should think twice before adding a badge on top.

## Deferred / Unverified

**Numeric contrast ratios were not measured in a live browser.** Every foreground and background in both components is a Nuxt UI semantic token (`text-highlighted`, `text-default`, `text-muted`, `text-toned`, `text-dimmed`, `bg-default`, `bg-elevated`, `ring-default`, `ring-accented`), so both themes are driven by the design system's own token swap and no colour is hard-coded — verified by grep and by confirming each utility emits a rule bound to a `--ui-*` variable. A static numeric audit was attempted and abandoned: Nuxt UI injects the `--ui-color-neutral-*` ramp at runtime rather than into `entry.css`, so deriving ratios would have meant reimplementing its palette generation. The 10px-dimmed header pair, which was the one plainly risky combination, was fixed. **Per-pair WCAG ratios in light and dark mode remain a UAT item.**

**Live browser E2E was not run.** Both tasks' `<verify>` blocks specified `npm run dev` plus manual viewport and dark-mode inspection, which is not executable in this environment. The behavioural half is covered by the 20 automated tests above; what remains genuinely manual is the visual judgement — how the four stacked tables feel at 320px, and whether the sidebar's 320px desktop width reads as balanced against the slate.

## Self-Check: PASSED

All 4 claimed files exist on disk (`app/components/StandingsSidebar.vue`, `app/components/StandingsTable.vue`, `tests/components/StandingsSidebar.test.ts`, `app/pages/week/[week].vue`); both claimed commits (`945b180`, `58dd42d`) exist in git history.
