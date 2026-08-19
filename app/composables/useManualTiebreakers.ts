import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import type { ConferenceId, ConferenceRanking, RankGroup, TeamId } from '#shared/domain/tiebreakers/types'
import { decisionHash } from '#shared/domain/tiebreakers/invalidation'
import type { ConferenceDecisions, ManualDecisions } from '#shared/domain/tiebreakers/invalidation'

const P4_CONFERENCE_NAMES = new Set<string>(['SEC', 'Big Ten', 'Big 12', 'ACC'])

/**
 * T-06-02 (DoS): a stored conference holding more than this many hash
 * entries is dropped WHOLESALE on read -- this is not the measured usage
 * shape (the ACC's own worst case is ~3.85 decisions/season), it is a
 * ceiling against a hand-edited or maliciously enormous payload.
 */
const MAX_ENTRIES_PER_CONFERENCE = 32

/**
 * T-06-01/T-06-02: 20 exceeds the largest P4 conference (18, the Big Ten),
 * so a legitimate group can never hit this cap -- only a hand-edited entry
 * can, and it is dropped, not truncated.
 */
const MAX_IDS_PER_ENTRY = 20

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

function isValidOrderedIds(value: unknown): value is TeamId[] {
  if (!Array.isArray(value)) return false
  if (value.length > MAX_IDS_PER_ENTRY) return false
  if (!value.every(id => Number.isInteger(id))) return false
  return new Set(value).size === value.length
}

/**
 * Validates an untrusted parsed JSON payload against T-06-01/T-06-02's
 * shape: an object keyed by known P4 conference names, each value an object
 * of at most `MAX_ENTRIES_PER_CONFERENCE` hash-keyed entries, each entry's
 * value an array of at most `MAX_IDS_PER_ENTRY` distinct integer team ids.
 *
 * A violating CONFERENCE (unknown key, non-object value, or too many
 * entries) is dropped in full. A violating ENTRY inside an otherwise-valid
 * conference is dropped alone -- a corrupt decision costs that one decision,
 * not the conference or the page, mirroring `toOutcomes`' silent-drop
 * discipline.
 */
function validateConferenceDecisions(payload: unknown): ConferenceDecisions {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {}
  }

  const result: Record<string, ManualDecisions> = {}

  for (const [conference, entries] of Object.entries(payload as Record<string, unknown>)) {
    if (!P4_CONFERENCE_NAMES.has(conference)) continue
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) continue

    const entryPairs = Object.entries(entries as Record<string, unknown>)
    if (entryPairs.length > MAX_ENTRIES_PER_CONFERENCE) continue // drop the whole conference

    const validEntries: Record<string, readonly TeamId[]> = {}
    for (const [hash, ids] of entryPairs) {
      if (isValidOrderedIds(ids)) {
        validEntries[hash] = ids
      }
      // else: drop this one entry silently; the rest of the conference survives
    }

    result[conference] = validEntries
  }

  return result as ConferenceDecisions
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
export function useManualTiebreakers(season = 2026) {
  const key = `cfb_manual_tiebreakers_${season}`

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

    decisions.value = {
      ...decisions.value,
      [conference]: { ...conferenceDecisions, [hash]: orderedTeamIds }
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
