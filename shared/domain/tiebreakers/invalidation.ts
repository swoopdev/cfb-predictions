import type { ConferenceId, ConferenceRanking, RankGroup, StepOutcome, TeamId } from './types'

/**
 * One conference's stored manual decisions: hash -> the ordered team ids the
 * user committed for that group. Designing this as a flat, string-keyed map
 * (rather than nesting a richer object) keeps the eventual share-link work
 * cheap -- not this phase's requirement, but nothing here should be hostile
 * to it.
 */
export type ManualDecisions = Readonly<Record<string, readonly TeamId[]>>

/**
 * The whole stored object: `Partial` because most conferences never need an
 * entry (SEC/Big Ten/Big 12 measure 0.01-0.19 manual decisions per season).
 */
export type ConferenceDecisions = Partial<Record<ConferenceId, ManualDecisions>>

/**
 * Encodes one team's `StepValue` at the terminal step, switching exhaustively
 * on the `kind` discriminant and emitting the discriminant plus every field
 * of that variant. Encoding the discriminant is not optional: a value whose
 * `kind` changed but whose numeric field happened to coincide (e.g. a
 * `record` with `winPct: 1` vs. a `headToHead` result that later got
 * re-encoded as `1`) must not hash equal.
 *
 * A team absent from the terminal step's values (an empty trace, or a step
 * whose `values` array does not name this id) gets its own distinct marker
 * (`none`) rather than being skipped -- skipping would let two structurally
 * different groups of the same size collapse onto the same key.
 */
function encodeTerminalValue(id: TeamId, terminalStep: StepOutcome | undefined): string {
  const value = terminalStep?.values.find(v => v.teamId === id)?.value
  if (!value) return `${id}:none`

  switch (value.kind) {
    case 'record':
      return `${id}:record:${value.wins}:${value.losses}:${value.winPct.toFixed(6)}`
    case 'headToHead':
      return `${id}:h2h:${value.result}`
    case 'indeterminate':
      return `${id}:indet`
  }
}

/**
 * Builds the D-08 canonical string: a version prefix, the tied group's
 * membership (sorted numerically -- `Set`/array iteration order is not
 * stable input and must not leak into the key), the terminal step id, and
 * one encoded value per sorted id.
 *
 * The terminal step is the last `StepOutcome` of the last `TiebreakerCycle`
 * in the group's own trace. A group with an empty trace (no cycle ever ran)
 * produces a key rather than throwing -- every sorted id encodes as `:none`
 * and the step id falls back to the literal `'none'`.
 *
 * **Version-prefixed by design.** If the trace shape or the step list ever
 * changes, bumping the `v1` prefix invalidates every stored decision at
 * once, which is the correct and safe behaviour rather than a migration --
 * nobody has to reason about whether an old entry is still semantically
 * valid under a new shape.
 */
function canonicalDecisionKey(group: RankGroup): string {
  const terminalCycle = group.trace.at(-1)
  const terminalStep = terminalCycle?.steps.at(-1)
  const ids = [...group.teams].sort((a, b) => a - b)
  const values = ids.map(id => encodeTerminalValue(id, terminalStep))

  return `v1|${ids.join(',')}|${terminalStep?.step ?? 'none'}|${values.join('|')}`
}

/**
 * D-08's invalidation key: a synchronous fingerprint of (tied group
 * membership, terminal step, each team's value at that step). FNV-1a over
 * `canonicalDecisionKey`'s output, 32-bit offset basis and prime, using
 * `Math.imul` and an unsigned right shift after each multiply -- roughly
 * twenty lines, no dependency, and critically **synchronous**.
 *
 * Do NOT reach for the platform crypto digest (`crypto.subtle.digest`): it
 * returns a `Promise`, and this function is called from a `computed()`
 * (`useManualTiebreakers`'s application predicate). A `Promise` return there
 * yields a fresh object identity on every recompute, so every stored
 * decision appears invalidated on every render -- or a `.then()` handler
 * that writes back into a ref creates an infinite render loop. The failure
 * mode is silent: no type error, no console message, just decisions that
 * never stick.
 *
 * **This is change detection, not a security boundary.** The key does not
 * resist forgery -- it only detects drift in the three inputs it hashes.
 * There is no ASVS requirement satisfied by strengthening this into a
 * cryptographic hash, and doing so would only reintroduce the async trap
 * above. Say so here explicitly so nobody later "upgrades" it.
 */
export function decisionHash(group: RankGroup): string {
  const s = canonicalDecisionKey(group)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * Structural set equality: same size, same members, order irrelevant.
 * Rejects a stored ordering that contains a duplicate id even when its
 * length happens to match -- Pitfall 8's guard against a hand-edited
 * storage entry naming a phantom team or duplicating one across two ranks.
 */
function isTeamSetEqual(a: readonly TeamId[], b: readonly TeamId[]): boolean {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== a.length || setB.size !== b.length) return false
  if (setA.size !== setB.size) return false
  for (const id of setA) {
    if (!setB.has(id)) return false
  }
  return true
}

/**
 * Applies stored manual decisions to a conference's ranking, producing a new
 * `ConferenceRanking`. Never mutates its input `ranking` or any group in it
 * -- every returned group, changed or not, is either the original object
 * (untouched groups) or a freshly built one (split groups).
 *
 * **Gate 1 -- D-07 slate completeness.** When `slateComplete` is `false`,
 * returns the input ranking completely unchanged, whatever is stored. This
 * single early return is what makes suspension (06-UI-SPEC.md §0.1/§9) work:
 * a decision stays in storage but is never read while its conference is
 * incomplete.
 *
 * **Gate 2 -- D-08 hash match, checked per unresolved group.** For every
 * group whose `resolvedBy` is `'unresolved'`, this function computes
 * `decisionHash(group)` and looks it up in `decisions`. The stored ordering
 * is applied ONLY when its id set is exactly equal (both directions, not
 * containment -- see `isTeamSetEqual`) to the live group's `teams`. A
 * superset, a subset, or a same-length substitution all fail the match and
 * leave the group unresolved, exactly as if nothing were stored -- non-
 * application is a lookup miss, not a comparison someone could forget to
 * make.
 *
 * On a match, the group is replaced by one single-team group per stored id,
 * in the stored (user-committed) order, each carrying:
 * - `resolvedBy: 'manual'`
 * - the ORIGINAL group's `contestedWith` (criterion 6: a hand-chosen rank
 *   must render as tiebreaker-separated, not record-earned -- losing this
 *   would make a manual decision look like it was never contested)
 * - the ORIGINAL group's `trace` (what the procedure exhausted before the
 *   user was asked -- TIE-05's reasoning surface needs it)
 * - the ORIGINAL group's `terminalReason` (why the procedure stopped)
 * - `manualOrdering` set to the full committed ordering
 *
 * Groups that are not `'unresolved'` (`'sole-candidate'`, `'tiebreaker'`,
 * already `'manual'`) are returned untouched -- only an irreducible group
 * can ever have a decision applied to it.
 */
export function applyManualOrdering(
  ranking: ConferenceRanking,
  decisions: ManualDecisions,
  slateComplete: boolean
): ConferenceRanking {
  if (!slateComplete) return ranking

  const groups: RankGroup[] = []

  for (const group of ranking.groups) {
    if (group.resolvedBy !== 'unresolved') {
      groups.push(group)
      continue
    }

    const hash = decisionHash(group)
    const stored = decisions[hash]

    if (stored && isTeamSetEqual(stored, group.teams)) {
      for (const id of stored) {
        groups.push({
          teams: [id],
          resolvedBy: 'manual',
          contestedWith: group.contestedWith,
          trace: group.trace,
          terminalReason: group.terminalReason,
          manualOrdering: stored
        })
      }
      continue
    }

    groups.push(group)
  }

  return { conference: ranking.conference, groups }
}
