import { defineConfig } from 'vitest/config'
import { dirname, resolve } from 'path'
import { createRequire } from 'node:module'
import vue from '@vitejs/plugin-vue'

const require = createRequire(__filename)

// `ofetch` is a transitive dependency of `nuxt`, not a direct one, so pnpm's isolated
// store keeps it out of the top-level `node_modules`. Vite's import analysis therefore
// fails while transforming `app/utils/fetchSchedule.ts` -- before `vi.mock('ofetch')`
// ever gets a chance to intercept. Resolving it through `nuxt` points the alias at the
// exact copy the app already uses at runtime (1.5.1) without adding a direct dependency.
const ofetchEntry = resolve(
  dirname(require.resolve('ofetch/package.json', {
    paths: [dirname(require.resolve('nuxt/package.json'))]
  })),
  'dist/index.mjs'
)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^~\//, replacement: resolve(__dirname, './app') + '/' },
      { find: /^#shared\//, replacement: resolve(__dirname, './shared') + '/' },
      { find: /^#app\//, replacement: resolve(__dirname, './app') + '/' },
      { find: /^ofetch$/, replacement: ofetchEntry }
    ]
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    // D-11: Per-directory coverage threshold for tiebreaker logic (shared/domain/tiebreakers/**).
    // Branches are the metric most critical here -- the restart-vs-continue split (Pitfall 1)
    // and the indeterminate-vs-record distinction (Pitfall 4) are both literal branches
    // that a fixture gap would leave silently untested.
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts'],
      exclude: ['shared/**/*.d.ts'],
      thresholds: {
        // Global thresholds intentionally left unset/low until more of the app exists --
        // this phase's gate is scoped ONLY to the tiebreaker directory, per D-11.
        'shared/domain/tiebreakers/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // Phase 8: shareLink.ts is this phase's own untrusted-input boundary
        // (ASVS V5, T-08-01..T-08-04) -- the FIRST genuinely externally-supplied
        // input this app has ever parsed. Same 90% floor as the tiebreaker
        // directory above, for the same reason.
        'shared/domain/shareLink.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // Phase 5 (05-01 <verification>): the standings engine is the other
        // half of "if the math is wrong, nothing else matters" — same
        // rationale as the tiebreaker gate above, set at the plan's stated
        // 85% floor.
        'shared/domain/standings/**': {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85
        }
      }
    }
  }
})
