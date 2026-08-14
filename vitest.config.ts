import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '#shared': resolve(__dirname, './shared'),
      '#app': resolve(__dirname, './app')
    }
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
