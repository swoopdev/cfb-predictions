# Phase 1: Data Pipeline - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 11 (from RESEARCH.md's Recommended Project Structure)
**Analogs found:** 0 exact / 11 total — this repo has zero application code beyond the stock Nuxt scaffold. No controllers, services, scripts, or tests exist to pattern-match against. This document instead captures the repo's established **configuration conventions** that every new file in this phase must conform to, since those are the only real constraints available.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `scripts/fetch-data.ts` | utility (CLI entrypoint) | request-response (API fetch) + file-I/O (write JSON/PNGs) | none | no analog |
| `scripts/lib/schemas.ts` | model (validation schemas) | transform | none | no analog |
| `scripts/lib/coverage.ts` | utility (pure function) | transform | none | no analog |
| `scripts/lib/schedule-hash.ts` | utility (pure function) | transform | none | no analog |
| `public/data/{season}/teams.json` | config/data (generated output) | file-I/O | none (repo has no `public/data/`) | no analog |
| `public/data/{season}/games.json` | config/data (generated output) | file-I/O | none | no analog |
| `public/data/{season}/coverage.json` | config/data (generated output) | file-I/O | none | no analog |
| `public/logos/{teamId}.png` | static asset | file-I/O | none | no analog |
| `public/logos/placeholder.svg` | static asset | file-I/O | none | no analog |
| `tests/schedule-hash.test.ts` | test | transform | none (no `tests/` dir, no vitest installed) | no analog |
| `tests/schemas.test.ts`, `tests/coverage.test.ts` | test | transform | none | no analog |
| `tests/fixtures/*.json` | test fixture | file-I/O | none | no analog |

**Repo inventory confirming "no analog" (searched exhaustively):**
- `app/` contains only the stock scaffold: `app.config.ts`, `app.vue`, `assets/css/main.css`, `components/AppLogo.vue`, `components/TemplateMenu.vue`, `pages/index.vue` — no composables, no services, no data-fetching code, no `server/` directory.
- No `scripts/`, `tests/`, `public/data/`, or `public/logos/` directories exist yet.
- No `vitest.config.ts`, no test framework installed (`vitest` absent from `package.json`).
- No existing `.env`/`.env.example` file (only referenced in `.gitignore`).

## Established Conventions (from repo config — binding on new files)

### `package.json` (root)
```json
{
  "type": "module",
  "packageManager": "pnpm@11.20.0"
}
```
- **Module format: ESM.** `"type": "module"` at the root means `scripts/fetch-data.ts` and all `scripts/lib/*.ts` files must use `import`/`export` syntax (never `require`), consistent with everything RESEARCH.md's code examples already show.
- **Package manager: pnpm.** Any new script command added to `package.json` (e.g. `"fetch-data": "tsx scripts/fetch-data.ts"`) should be invoked via `pnpm run fetch-data` / `pnpm fetch-data`.
- Current `devDependencies` block (lines 21-26) is the insertion point for `cfbd`, `zod`, `tsx`, `vitest`, `@vitest/coverage-v8` per RESEARCH.md's install command.

### `tsconfig.json` (root)
```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```
- This is a **Nuxt-generated project-references root** — it does not itself declare `strict`, `target`, etc.; those live in the `.nuxt/tsconfig.*.json` files Nuxt generates at `postinstall` (via `nuxt prepare`), which are not hand-edited.
- **Implication for this phase:** `scripts/**` and `tests/**` are outside Nuxt's `app/` source root and are NOT covered by any of the four referenced tsconfigs. A new file (e.g. `tsconfig.scripts.json` or `tsconfig.node.json` at the repo root, NOT to be confused with `.nuxt/tsconfig.node.json`) may be needed if `nuxt typecheck` should cover the scripts — however, since `tsx` runs `.ts` files directly via esbuild (no separate `tsc` typecheck step at runtime), a dedicated tsconfig is not strictly required for `tsx scripts/fetch-data.ts` to execute. Recommend the planner add `scripts/**`/`tests/**` to a lightweight standalone `tsconfig.json` `include` only if type-safety enforcement in CI is desired — this is a planning decision, not dictated by any existing pattern (none exists).
- **TypeScript version constraint:** stay on `typescript@^6.0.3` (already pinned) — CLAUDE.md explicitly forbids TS 7.x because `@nuxt/ui@4.10.0`'s peer range is `^5.6.3 || ^6.0.0`. Do not let `tsx`/`vitest` pull TS 7 transitively.

### `eslint.config.mjs` (root)
```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
)
```
- Flat ESLint config (`eslint.config.mjs`), built on `@nuxt/eslint`'s generated config. By default `@nuxt/eslint`'s generated config globs cover the whole repo (not just `app/`), so `scripts/**` and `tests/**` will be linted under the same ruleset unless explicitly excluded.
- **Stylistic rules set in `nuxt.config.ts`** (see below) apply repo-wide: `commaDangle: 'never'`, `braceStyle: '1tbs'`. New `.ts` files in `scripts/` and `tests/` must follow these — no trailing commas, 1TBS brace style (opening brace on same line).
- Run `pnpm lint` (already defined in `package.json`) to verify new files conform before considering a task done.

### `nuxt.config.ts` (root)
```typescript
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  routeRules: { '/': { prerender: true } },
  compatibilityDate: '2026-06-30',
  eslint: {
    config: {
      stylistic: { commaDangle: 'never', braceStyle: '1tbs' }
    }
  }
})
```
- Confirms the `commaDangle`/`braceStyle` stylistic rules above are project-wide, not app-only.
- No `srcDir` override — Nuxt 4's default `app/` source directory convention is in effect (confirms `app/` as the SFC/composable home; irrelevant to this phase's `scripts/`/`public/`/`tests/` output but useful context for later phases that will build `useTeams`/`useGames` composables under `app/composables/`).

### `.gitignore` (root)
```
.output
.data
.nuxt
.nitro
.cache
dist
node_modules
logs
*.log
.DS_Store
.fleet
.idea
.env
.env.*
!.env.example
```
- **`.env` is already gitignored** (with `.env.*` also ignored and `!.env.example` explicitly un-ignored) — confirms D-02's requirement is already satisfied by repo config; no `.gitignore` edit needed for the API key itself.
- **Nothing in `.gitignore` currently excludes `public/data/` or `public/logos/`** — these are meant to be committed per the phase goal ("committed, versioned dataset"), so no gitignore change is needed there either, consistent with CONTEXT.md's decisions.
- If the planner wants a `.env.example` file (good practice for D-02, documenting `CFBD_API_KEY=` as a placeholder), it is explicitly exempted from the ignore rule already (`!.env.example`).

## Shared Patterns

### Module format
**Source:** `package.json` (`"type": "module"`)
**Apply to:** All new files — `scripts/fetch-data.ts`, `scripts/lib/*.ts`, `tests/*.ts`, and any `vitest.config.ts` added. Use ESM `import`/`export`, never CommonJS `require`/`module.exports`.

### Stylistic lint rules
**Source:** `nuxt.config.ts` lines 20-27, enforced via `eslint.config.mjs` → `.nuxt/eslint.config.mjs` (generated by `@nuxt/eslint`)
**Apply to:** All new `.ts` files in `scripts/` and `tests/`.
- No trailing commas (`commaDangle: 'never'`) — matches RESEARCH.md's own code examples, which already omit trailing commas.
- 1TBS brace style (`braceStyle: '1tbs'`) — opening brace stays on the same line as the statement.
- Verify with `pnpm lint` before considering any task in this phase complete.

### TypeScript version pin
**Source:** `package.json` devDependencies (`typescript: ^6.0.3`), cross-referenced with `.claude/CLAUDE.md`'s Version Compatibility table
**Apply to:** Any `pnpm add -D` in this phase. Adding `tsx`, `vitest`, `@vitest/coverage-v8`, `cfbd`, `zod` must not bump `typescript` to 7.x as a transitive resolution — check `pnpm-lock.yaml` after install.

### Secret hygiene
**Source:** `.gitignore` (`.env`/`.env.*` already ignored)
**Apply to:** `scripts/fetch-data.ts` — read `CFBD_API_KEY` via `process.loadEnvFile('.env')` per D-02/RESEARCH.md's Code Examples; never log the raw key value in console output or write it into `coverage.json`.

## No Analog Found

All 11 files in this phase's scope have no existing analog — this is a greenfield addition to a stock Nuxt scaffold.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/fetch-data.ts` | utility (CLI) | request-response + file-I/O | No `scripts/` directory exists; no prior CLI/build-time script in this repo |
| `scripts/lib/schemas.ts` | model | transform | No zod usage anywhere in repo yet (zod only present as a transitive/optional peer of `@nuxt/ui`, not directly imported anywhere) |
| `scripts/lib/coverage.ts` | utility | transform | No equivalent reporting/aggregation logic exists |
| `scripts/lib/schedule-hash.ts` | utility | transform | No hashing logic exists anywhere in repo |
| `public/data/{season}/*.json` | config/data | file-I/O | No `public/data/` directory exists |
| `public/logos/*` | static asset | file-I/O | No `public/logos/` directory exists |
| `tests/**` | test | — | No test framework installed, no `tests/` directory, no `vitest.config.ts` |

**Recommendation for planner:** Since no in-repo analog exists, the planner should lean entirely on RESEARCH.md's "Code Examples" section (auth setup, scheduleHash computation, Zod schema with required-vs-nullable split, logo download with success verification) as the primary pattern source for this phase, constrained by the conventions captured above (ESM, no trailing commas, 1TBS braces, TS 6.x pin, `.env` already gitignored).

## Metadata

**Analog search scope:** Entire repo root (`app/`, root config files) — confirmed via `Glob` that `scripts/`, `tests/`, `public/data/`, `public/logos/` do not exist, and `app/**/*` contains only the 6 stock scaffold files.
**Files scanned:** `package.json`, `tsconfig.json`, `eslint.config.mjs`, `nuxt.config.ts`, `.gitignore`, full `app/` tree (6 files)
**Pattern extraction date:** 2026-08-12
</content>
</invoke>
