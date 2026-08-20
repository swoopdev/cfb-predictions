# Phase 8: Share Links - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can generate a shareable URL that encodes one scenario's picks and manual tiebreaker overrides, using the bitpack-to-base64url encoding already locked at the project level (CLAUDE.md §2). Opening a share link never silently mutates the visitor's own picks — it shows a dismissible banner offering to save the shared picks as a new, independent scenario via Phase 7's existing `createScenario`. A schedule-fingerprint mismatch reports how many picks applied rather than silently misapplying or dropping them. Malformed or malicious payloads (unknown game ids, oversized payloads, corrupt encoding) are rejected/degraded gracefully, never crash the app.

</domain>

<decisions>
## Implementation Decisions

### Share Link Generation UX
- **D-01:** "Share" lives inside `ScenarioSwitcher.vue`'s per-row actions, alongside the existing rename/duplicate/delete icons — consistent with Phase 7's established pattern that all scenario actions live in the switcher dropdown, no new page/route.
- **D-02:** The generated link is presented in a `UModal` (reusing `DeleteScenarioModal.vue`'s established pattern) — a read-only field showing the full URL plus a "Copy Link" button.
- **D-03:** Sharing works at any pick state, including zero picks — no completeness requirement, consistent with Phase 4 D-11's "picks can change at any time" philosophy.
- **D-04:** The encoded payload is exactly: the picks bitfield, the `scheduleHash` header (already present in `games.json` per DATA-03, an 8-hex-char/u32 fingerprint), and that scenario's manual tiebreaker overrides via the TLV section CLAUDE.md specifies. The scenario's local `name`/`id` are never included — they're local identity, not portable/meaningful to a recipient.

### Opening a Share Link
- **D-05:** A dismissible banner appears at the top of `week/[week].vue`'s content area, above `PicksWorkspace` — no new route (`/shared/[code]` was considered and rejected as unnecessary duplication of the week-view UI). Wording: "You're viewing a shared scenario" with a "Save a copy" action.
- **D-06:** "Save a copy" calls the existing `createScenario` (Phase 7), pre-populated with the decoded picks/overrides; the new scenario becomes active and the banner dismisses. No bespoke import/persistence path.
- **D-07:** Opening a share link makes **zero localStorage writes** until "Save a copy" is explicitly clicked — the decoded picks render in a temporary, non-persisted preview state. This is the literal mechanism behind SHARE-02's "never silently overwrites the visitor's own existing picks."
- **D-08:** On a `scheduleHash` mismatch, the banner switches to a warning variant: "N of M picks applied — this link was created for a different schedule version" (SHARE-03's literal requirement) — the link still partially opens rather than being refused outright.

### Payload Validation (SHARE-04)
- **D-09:** Decoding and validation live in a pure function in `shared/domain/` (e.g. `shareLink.ts`) that runs before any component ever sees a candidate picks object — mirrors the established never-trust-past-parse pattern already used by `useManualTiebreakers.ts`'s `validateConferenceDecisions` and `useScenarios.ts`'s registry validator.
- **D-10:** A fixed byte/char size cap is enforced on the raw fragment payload *before* attempting to base64-decode it at all — the cheap first gate against a deliberately oversized fragment.
- **D-11:** A malformed or unparseable payload shows a "This link couldn't be read" banner and applies no partial state — same silent-recovery, no-crash precedent already established three times over in this codebase (D-07/D-08 style).
- **D-12:** An unknown game id inside an otherwise-valid payload is dropped per-pick (that one bit's game is skipped, counted against the "N of M applied" report) rather than rejecting the entire payload — the same "a corrupt entry costs that entry, not everything" precedent `useManualTiebreakers.ts` already established.

### Claude's Discretion
- Exact byte-level bit assignment within the 2-bit pick encoding (e.g., `00`=unpicked, `01`=home, `10`=away, `11`=reserved) — CLAUDE.md locks the 2-bit budget and header layout but not the specific bit values.
- Exact TLV tag/length scheme for the manual-tiebreaker-overrides section, informed by `useManualTiebreakers.ts`'s existing `ConferenceDecisions` shape (`{ [conference]: { [decisionHash]: orderedTeamIds } }`).
- Exact wording/styling of the two banners (shared-scenario banner, mismatch-warning banner) beyond the semantic content locked in D-05/D-08.
- Whether "Copy Link" uses the Clipboard API with a manual-select fallback, or another mechanism — implementation detail, no user-facing decision needed.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScenarioSwitcher.vue` (Phase 7) already has the per-row action pattern (rename/duplicate/delete icons, `@click.stop`) that "Share" extends.
- `DeleteScenarioModal.vue` (Phase 7) is the established `UModal` pattern to follow for the share-link modal.
- `useScenarios.ts`'s `createScenario` (Phase 7) is the exact mechanism "Save a copy" calls — no new persistence path needed.
- `useManualTiebreakers.ts`'s `ConferenceDecisions` shape and its `validateConferenceDecisions` per-entry-drop validator are the direct model for both the TLV overrides encoding and the payload validator's own defensive posture.
- `public/data/2026/games.json`'s `scheduleHash` (currently `"19c9e609"`, an 8-hex-char string — confirm exact numeric width when implementing the u32 header field) and its 888 games (each with a stable `id`) are the fixed index CLAUDE.md's bitpack design sorts by.

### Established Patterns
- Untrusted-input validation always lives in a pure function, never inline in a component, with per-entry (not whole-payload) drop on partial corruption — three precedents now (`usePicksStorage`, `useManualTiebreakers`, `useScenarios`).
- All scenario-related actions live in `ScenarioSwitcher.vue`'s dropdown, not a new page or always-visible button row.
- `UModal` is the established confirmation/detail-surface component (first used in Phase 7's `DeleteScenarioModal.vue`).

### Integration Points
- The share-link decode step needs the *current* dataset's `scheduleHash` (from `useGames()`) to compare against the payload's embedded header value for SHARE-03's mismatch detection.
- "Save a copy" integrates directly with Phase 7's `useScenarios()` composable — no new composable needed for scenario creation itself, only for the decode/preview step.

</code_context>

<specifics>
## Specific Ideas

All three grey-area proposal batches (generation UX, opening a link, payload validation) were accepted as recommended, with no changes requested. Recommendations were grounded in CLAUDE.md's already-locked byte-level encoding design (§2, URL-encoded share links), Phase 7's established UI/composable patterns, and the untrusted-input validation precedent set three times over in this codebase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (CLAUDE.md's own "Alternatives Considered" table already rejected `lz-string` and query-string encoding for this phase; those are not open questions, they're already-closed decisions this phase inherits.)

</deferred>

---

*Phase: 8-Share Links*
*Context gathered: 2026-08-20*
