---
phase: 08
slug: share-links
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.10` [VERIFIED: package.json], `happy-dom` `20.11.2` environment (single project) |
| **Config file** | `vitest.config.ts` (project root) — add a coverage threshold for `shared/domain/shareLink.ts` alongside the existing `tiebreakers/**` (90%) and `standings/**` (85%) entries, since this file is this phase's untrusted-input boundary (ASVS V5) |
| **Quick run command** | `npx vitest run tests/domain/shareLink.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/domain/shareLink.test.ts` (plus any touched composable/component test files)
- **After every plan wave:** `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SHARE-01 | — | `encodeShareLink` round-trips picks + manual decisions through `decodeShareLink` unchanged when schedules match | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-01 | — | Generating a share link for a non-active scenario reads that scenario's raw `localStorage` (Pattern 2), not the mounted one | unit | `npx vitest run tests/composables/useShareGeneration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-02 | T-08-DoS | Opening a share link writes zero new/changed `localStorage` keys until `saveCopy()` is called | unit | `npx vitest run tests/composables/useSharedPreview.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-03 | T-08-Tamper | A payload with a game count larger than the current schedule reports correct N of M and applies only in-bounds picks (the header `gameCount` fix this research identified) | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-03 | — | A payload with a matching `scheduleHash` always yields `appliedCount === totalCount` | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-04 | T-08-DoS | A fragment longer than `MAX_FRAGMENT_CHARS` is rejected before any `atob`/JSON work | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-04 | T-08-Tamper | An out-of-bounds bit position ("unknown game id") is dropped per-pick, not rejecting the whole payload | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-04 | T-08-Tamper | A structurally invalid TLV section drops overrides only, keeps the picks bitfield | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SHARE-04 | T-08-Tamper | A non-base64url string, or a byte sequence shorter than the header, yields `status: 'malformed'` — never throws | unit | `npx vitest run tests/domain/shareLink.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task ID/Plan/Wave columns are filled in by the planner once PLAN.md files exist — pre-populated from RESEARCH.md's Phase Requirements → Test Map and Known Threat Patterns.*

---

## Wave 0 Requirements

- [ ] `tests/domain/shareLink.test.ts` — the highest-value new file this phase needs; must include the header-boundary/`gameCount` regression explicitly, since it is the one concrete design gap this research found in CLAUDE.md's originally locked header layout
- [ ] `tests/composables/useSharedPreview.test.ts` — covers the zero-writes-until-save contract (SHARE-02) and the `route.hash`/`useGames()` timing gate
- [ ] `tests/components/SharedScenarioBanner.test.ts` — covers the three copy/color variants (default/mismatch/malformed) wiring correctly to `useSharedPreview()`'s output
- [ ] `tests/components/ShareLinkModal.test.ts` — covers Copy Link button behavior (Clipboard API + manual-select fallback)
- [ ] Add `shared/domain/shareLink.ts` to `vitest.config.ts`'s `coverage.thresholds`, matching the existing `tiebreakers/**`/`standings/**` precedent
- [ ] Framework install: none — Vitest already fully configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copy Link button actually copies the URL to the OS clipboard in a real browser | SHARE-01 | Clipboard API behavior is not exercised by happy-dom | Click Copy Link in `pnpm dev`, paste into another field, confirm the URL matches |
| Opening a real generated share link in a fresh browser profile shows the correct banner and preview | SHARE-02, SHARE-03 | End-to-end URL-fragment-to-render behavior needs a live browser | Generate a link, open it in an incognito/second profile, confirm banner + preview + Save a copy flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
