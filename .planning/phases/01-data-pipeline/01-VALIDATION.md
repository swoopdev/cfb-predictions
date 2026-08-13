---
phase: 01
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 |
| **Config file** | none yet — Wave 0 installs `vitest.config.ts` (plain `node`-environment project scoped to `scripts/**`/`tests/**`) |
| **Quick run command** | `pnpm vitest run tests/schedule-hash.test.ts tests/schemas.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/schedule-hash.test.ts tests/schemas.test.ts`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green, AND the fetch script must be run at least once end-to-end against the real API (human-provided key) with the resulting `teams.json`/`games.json`/`coverage.json` manually spot-checked — no fixture-only suite substitutes for this, since DATA-01/DATA-02's real success criterion is "the real dataset is committed"
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-0X | 01 | 0/1 | DATA-01 | — | Transformed team record matches documented `teams.json` shape given a valid raw fixture | unit | `pnpm vitest run tests/schemas.test.ts -t "team transform"` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-02 | — | Transformed game record matches documented `games.json` shape given a valid raw fixture | unit | `pnpm vitest run tests/schemas.test.ts -t "game transform"` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-03 | — | `computeScheduleHash` is deterministic, numerically sorts input, produces exactly 8 hex chars (u32) | unit | `pnpm vitest run tests/schedule-hash.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-04 | T-01-01 (SSRF-adjacent logo URL) | `vendorLogo` correctly classifies empty-array, download-failure, and success cases (mocked `fetch`) | unit | `pnpm vitest run tests/coverage.test.ts -t "vendorLogo"` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-05 | T-01-02 (secret hygiene) | A fixture team missing `conference` causes `reportRequiredFieldFailures` to flag it; script's main path exits non-zero on any such failure | unit + manual (process.exit behavior) | `pnpm vitest run tests/schemas.test.ts -t "required field failures"` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-06 | — | Transform never overwrites/recomputes `conferenceGame` — output equals raw input across fixture inputs | unit | `pnpm vitest run tests/schemas.test.ts -t "conferenceGame passthrough"` | ❌ W0 | ⬜ pending |
| 01-01-0X | 01 | 0/1 | DATA-07 | — | `games.json` output includes raw `seasonType` verbatim (no filtering/mutation this phase) | unit | `pnpm vitest run tests/schemas.test.ts -t "seasonType passthrough"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm add -D vitest @vitest/coverage-v8` — no test framework installed yet in this repo
- [ ] `vitest.config.ts` — single `node`-environment project covering `scripts/**`/`tests/**` (no `@nuxt/test-utils` needed this phase — pure Node logic only)
- [ ] `tests/fixtures/cfbd-teams-sample.json`, `tests/fixtures/cfbd-games-sample.json` — hand-authored fixtures matching the verified `Team`/`Game` type shapes (no live API key was available to capture real recorded payloads during research)
- [ ] `tests/schedule-hash.test.ts`, `tests/schemas.test.ts`, `tests/coverage.test.ts` — new test files, none exist yet
- [ ] Confirm against a real, authenticated API response: (a) whether conference championship games carry `seasonType === 'postseason'` (Open Question #1), (b) whether `getGames({ classification: 'fbs' })` admits FBS-vs-FCS games (Open Question #2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end fetch script run against the live CFBD API produces a correct, committed dataset | DATA-01, DATA-02, DATA-03, DATA-04 | Requires a real `CFBD_API_KEY` and live network access; no fixture substitute proves the real 2026 dataset is trustworthy | Obtain a free CFBD API key, place it in `.env`, run `pnpm fetch-data 2026`, and manually spot-check the committed `teams.json`, `games.json`, and `coverage.json` for plausibility (team count ~135, game count in the expected range, no unexpected nulls) |
| Conference championship games carry the expected `seasonType`/`conferenceGame` combination | DATA-07 | Depends on live API data only obtainable at execution time (Open Question #1) | After the live fetch, manually inspect 2-3 known conference championship games in `games.json` and confirm their `seasonType`/`conferenceGame` values match the filtering logic documented for Phase 5 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
