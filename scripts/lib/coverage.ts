import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export interface VendorLogoOptions {
  fetchImpl?: typeof fetch
  writeFileImpl?: (path: string, data: Buffer) => Promise<void>
  existsImpl?: (path: string) => boolean
  force?: boolean
}

export type VendorLogoResult
  = | { status: 'ok', path: string }
    | { status: 'missing' }
    | { status: 'download-failed' }

/**
 * Downloads a team's logo into `public/logos/{teamId}.png`, verifying actual
 * download success rather than just array-emptiness (D-05).
 *
 * The target filename is derived exclusively from the numeric `teamId`,
 * never from a school/mascot string, closing path traversal by construction
 * (T-01-03). Any URL not starting with `https:` is rejected before any
 * fetch attempt, as SSRF-adjacent defense-in-depth (T-01-01) even though
 * CFBD is a trusted first-party source in this design.
 *
 * Never throws — all network/filesystem errors resolve to
 * `{ status: 'download-failed' }`.
 */
export async function vendorLogo(teamId: number, logoUrl: string | null | undefined, opts?: VendorLogoOptions): Promise<VendorLogoResult> {
  if (!logoUrl) return { status: 'missing' }

  const fetchImpl = opts?.fetchImpl ?? fetch
  const writeFileImpl = opts?.writeFileImpl ?? writeFile
  const existsImpl = opts?.existsImpl ?? existsSync

  const targetPath = `public/logos/${teamId}.png`

  if (!opts?.force && existsImpl(targetPath)) {
    return { status: 'ok', path: `/logos/${teamId}.png` }
  }

  if (!logoUrl.startsWith('https:')) {
    return { status: 'download-failed' }
  }

  try {
    const res = await fetchImpl(logoUrl)
    if (!res.ok) return { status: 'download-failed' }
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFileImpl(targetPath, buffer)
    return { status: 'ok', path: `/logos/${teamId}.png` }
  } catch {
    return { status: 'download-failed' }
  }
}

export interface CoverageEntryInput {
  id: number
  school: string
  requiredFieldsOk: boolean
  missingFields: string[]
  logoStatus: 'ok' | 'missing' | 'download-failed'
}

export interface CoverageReport {
  season: number
  generatedAt: string
  teams: Array<{
    id: number
    school: string
    requiredFields: 'pass' | 'fail'
    missingFields: string[]
    logo: 'pass' | 'missing' | 'download-failed'
  }>
  summary: {
    totalTeams: number
    requiredFieldFailures: number
    logosVendored: number
    logosMissing: number
  }
}

/**
 * Builds the D-08 JSON coverage report from per-team validation/vendoring
 * outcomes. Never reads environment variables (secret hygiene, T-01-02) —
 * the report is written verbatim to `public/data/{season}/coverage.json`.
 */
export function buildCoverageReport(season: number, entries: CoverageEntryInput[]): CoverageReport {
  const teams = entries.map((entry) => {
    return {
      id: entry.id,
      school: entry.school,
      requiredFields: entry.requiredFieldsOk ? 'pass' as const : 'fail' as const,
      missingFields: entry.missingFields,
      logo: entry.logoStatus === 'ok' ? 'pass' as const : entry.logoStatus
    }
  })

  const summary = entries.reduce(
    (acc, entry) => {
      acc.totalTeams += 1
      if (!entry.requiredFieldsOk) acc.requiredFieldFailures += 1
      if (entry.logoStatus === 'ok') acc.logosVendored += 1
      else acc.logosMissing += 1
      return acc
    },
    { totalTeams: 0, requiredFieldFailures: 0, logosVendored: 0, logosMissing: 0 }
  )

  return {
    season,
    generatedAt: new Date().toISOString(),
    teams,
    summary
  }
}
