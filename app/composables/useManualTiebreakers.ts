import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import type { ConferenceId, ConferenceRanking, RankGroup, TeamId } from '#shared/domain/tiebreakers/types'
import { decisionHash, MAX_ENTRIES_PER_CONFERENCE, validateConferenceDecisions } from '#shared/domain/tiebreakers/invalidation'
import type { ConferenceDecisions, ManualDecisions } from '#shared/domain/tiebreakers/invalidation'
import { scenarioKeys } from '~/utils/scenarioKeys'

/**
 * Structural set equality: same size, same members, order irrelevant.
 * Duplicated in miniature from `invalidation.ts`'s module-private helper of
 * the same shape rather than exported and imported -- six lines, and this
 * file's precise need (comparing a STORED array against a LIVE group's
 * teams for both `commitOrdering`'s guard and `pruneStale`'s delete-on-read
 * check) is identical to what `applyManualOrdering` already does, so
 * duplicating the check here costs nothing and keeps `invalidation.ts`'s
 * export surface exactly what the plan specifies.
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
 * Manual-decision lifecycle composable (D-06/D-07/D-08/D-09, TIE-06, 06-UI-
 * SPEC.md §0.1/§9). Follows `useAutoFilledGames.ts`'s shape: explicit
 * `useStorage`/`computed` imports, a `season = 2026` default parameter, a
 * `cfb_<thing>_<season>` key, and a returned object of named refs/computeds/
 * functions.
 *
 * **Storage shape stays flat, hash-keyed, recomputed on read** (06-RESEARCH.md
 * Pattern 4): `{ [conference]: { [decisionHash]: orderedTeamIds } }`. No
 * `suspended` flag, no timestamp anywhere -- 06-UI-SPEC.md §0.1's "preserve
 * and suspend" (superseding 06-CONTEXT.md D-09's literal "discard") needs no
 * new field, because suspension IS the absence of gate 1
 * (`slateComplete[conference]`), not a stored state. A decision that
 * survived a suspension window and a decision that was continuously active
 * are structurally the SAME storage entry -- there is nothing here that
 * could tell them apart, which is the whole point.
 *
 * **Corruption disposition is a deliberate departure from `usePicksStorage`.**
 * That composable preserves corrupted JSON under a `_corrupt` suffix key
 * because picks are irreplaceable user work. Manual decisions are hash-keyed
 * and re-promptable at near-zero cost (this conference's D-17 interaction is
 * one click sequence), so on unparseable JSON or a non-object payload this
 * composable resets to an empty object SILENTLY, writing no secondary key --
 * `useAutoFilledGames`' disposition, chosen on purpose, not an oversight.
 *
 * **Untrusted-input validation (T-06-01/T-06-02, Pitfall 8, ASVS V5).** The
 * read path enforces the caps and shape documented on
 * `validateConferenceDecisions` above. Applying an unvalidated stored entry
 * could inject a phantom standings row or duplicate a team across two ranks
 * -- `applyManualOrdering`'s own set-equality gate is the second, structural
 * layer of the same defense, not a substitute for validating storage itself.
 *
 * **No logging.** The existing rule (never log picks, storage keys, or share
 * codes) leaves almost nothing useful to log about a hash-keyed team-id
 * array, so this file adds none at all.
 *
 * **Scenario scoping (Phase 7, D-02, D-04).** `scenarioId` is required and
 * comes first -- a defaulted `season` parameter after a required one would
 * defeat the default's usefulness (RESEARCH.md Pitfall 2). Every call MUST
 * construct a fresh composable instance per scenario id (never pass a
 * reactive/computed key into one long-lived `useStorage()` call for this
 * object-valued state) -- RESEARCH.md Pitfall 1 is a verified, reproduced
 * defect where doing so leaks one scenario's data into another.
 *
 * @param scenarioId Scenario id. Required, non-defaulted -- namespaces the storage key.
 * @param season Season year (default: 2026). Namespaces the storage key.
 * @returns Object with:
 *   - decisions: the raw `Ref<ConferenceDecisions>` storage, already
 *     validated on read
 *   - decisionsFor(conference): `ComputedRef<ManualDecisions>` for one
 *     conference, `{}` when nothing is stored for it
 *   - commitOrdering(conference, group, orderedTeamIds): writes one ordering,
 *     no-op when `orderedTeamIds` isn't a set-equal match for
 *     `group.teams`
 *   - pruneStale(conference, ranking, slateComplete): the delete-on-read
 *     path (06-UI-SPEC.md §9.4) -- a no-op while `slateComplete` is false
 *     (that single early return is what makes suspension retention rather
 *     than deletion), and deletes any stored entry that no longer matches a
 *     live unresolved group once the slate is complete
 */
export function useManualTiebreakers(scenarioId: string, season = 2026) {
  const key = scenarioKeys.manualTiebreakers(season, scenarioId)

  const decisions = useStorage<ConferenceDecisions>(
    key,
    {},
    localStorage,
    {
      serializer: {
        read(v: string) {
          try {
            const parsed = JSON.parse(v)
            return validateConferenceDecisions(parsed)
          } catch {
            return {}
          }
        },
        write(v: ConferenceDecisions) {
          return JSON.stringify(v)
        }
      }
    }
  )

  function decisionsFor(conference: ConferenceId) {
    return computed<ManualDecisions>(() => decisions.value[conference] ?? {})
  }

  function commitOrdering(conference: ConferenceId, group: RankGroup, orderedTeamIds: readonly TeamId[]) {
    if (!isTeamSetEqual(orderedTeamIds, group.teams)) return

    const hash = decisionHash(group)
    const conferenceDecisions = decisions.value[conference] ?? {}

    // 08-REVIEW WR-02 (iteration 2): mirror the read-side
    // MAX_ENTRIES_PER_CONFERENCE cap at write time. Overwriting an
    // already-stored hash never grows the entry count, so only a genuinely
    // NEW hash needs the cap check. When adding it would exceed the cap,
    // evict the oldest entry (first-inserted key by object enumeration
    // order) first -- this keeps the in-memory/stored shape from ever
    // legitimately drifting past what `validateConferenceDecisions` accepts
    // on the next read, which otherwise drops the WHOLE conference rather
    // than just the overflow.
    let nextConferenceDecisions: Record<string, readonly TeamId[]>
    if (hash in conferenceDecisions) {
      nextConferenceDecisions = { ...conferenceDecisions, [hash]: orderedTeamIds }
    } else {
      const keys = Object.keys(conferenceDecisions)
      const survivors = keys.length >= MAX_ENTRIES_PER_CONFERENCE ? keys.slice(1) : keys
      nextConferenceDecisions = {}
      for (const key of survivors) nextConferenceDecisions[key] = conferenceDecisions[key]!
      nextConferenceDecisions[hash] = orderedTeamIds
    }

    decisions.value = {
      ...decisions.value,
      [conference]: nextConferenceDecisions
    }
  }

  function pruneStale(conference: ConferenceId, ranking: ConferenceRanking, slateComplete: boolean) {
    if (!slateComplete) return // gate 1: suspension, not deletion -- the single most important line in the file

    const stored = decisions.value[conference]
    if (!stored) return

    const liveGroupsByHash = new Map<string, readonly TeamId[]>()
    for (const group of ranking.groups) {
      if (group.resolvedBy !== 'unresolved') continue
      liveGroupsByHash.set(decisionHash(group), group.teams)
    }

    const next: Record<string, readonly TeamId[]> = {}
    let changed = false

    for (const [hash, ids] of Object.entries(stored)) {
      const liveIds = liveGroupsByHash.get(hash)
      if (liveIds && isTeamSetEqual(ids, liveIds)) {
        next[hash] = ids
      } else {
        changed = true
      }
    }

    if (changed) {
      decisions.value = { ...decisions.value, [conference]: next }
    }
  }

  return { decisions, decisionsFor, commitOrdering, pruneStale }
}
