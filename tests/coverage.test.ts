import { describe, it, expect, vi } from 'vitest'
import { vendorLogo, buildCoverageReport } from '../scripts/lib/coverage'

describe('vendorLogo', () => {
  it('resolves to missing for an absent logo URL without calling fetchImpl', async () => {
    const fetchImpl = vi.fn()
    const result = await vendorLogo(1, undefined, { fetchImpl })
    expect(result).toEqual({ status: 'missing' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('resolves to missing for an empty-string logo URL', async () => {
    const fetchImpl = vi.fn()
    const result = await vendorLogo(1, '', { fetchImpl })
    expect(result).toEqual({ status: 'missing' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('resolves to ok and writes the file exactly once on a successful download', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4)
    })
    const writeFileImpl = vi.fn().mockResolvedValue(undefined)
    const existsImpl = vi.fn(() => false)
    const result = await vendorLogo(1, 'https://cdn.example.com/1.png', { fetchImpl, writeFileImpl, existsImpl })
    expect(result).toEqual({ status: 'ok', path: '/logos/1.png' })
    expect(writeFileImpl).toHaveBeenCalledTimes(1)
    expect(writeFileImpl.mock.calls[0][0]).toContain('1.png')
  })

  it('resolves to download-failed when the fetch response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    const existsImpl = vi.fn(() => false)
    const result = await vendorLogo(1, 'https://cdn.example.com/1.png', { fetchImpl, existsImpl })
    expect(result).toEqual({ status: 'download-failed' })
  })

  it('resolves to download-failed when fetchImpl rejects, never throwing itself', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network error'))
    const existsImpl = vi.fn(() => false)
    await expect(vendorLogo(1, 'https://cdn.example.com/1.png', { fetchImpl, existsImpl })).resolves.toEqual({ status: 'download-failed' })
  })

  it('rejects non-https URLs before attempting any fetch (SSRF-adjacent defense-in-depth)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
    const existsImpl = vi.fn(() => false)
    const result = await vendorLogo(1, 'http://insecure.example.com/1.png', { fetchImpl, existsImpl })
    expect(result).toEqual({ status: 'download-failed' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('skips re-download when the file already exists on disk', async () => {
    const fetchImpl = vi.fn()
    const writeFileImpl = vi.fn()
    const existsImpl = vi.fn(() => true)
    const result = await vendorLogo(1, 'https://cdn.example.com/1.png', { fetchImpl, writeFileImpl, existsImpl })
    expect(result).toEqual({ status: 'ok', path: '/logos/1.png' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(writeFileImpl).not.toHaveBeenCalled()
  })

  it('bypasses the skip-if-exists check when force is true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4)
    })
    const writeFileImpl = vi.fn().mockResolvedValue(undefined)
    const existsImpl = vi.fn(() => true)
    const result = await vendorLogo(1, 'https://cdn.example.com/1.png', { fetchImpl, writeFileImpl, existsImpl, force: true })
    expect(result).toEqual({ status: 'ok', path: '/logos/1.png' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('buildCoverageReport', () => {
  it('produces accurate per-team pass/fail entries and summary counts', () => {
    const report = buildCoverageReport(2026, [
      { id: 1, school: 'Ohio State', requiredFieldsOk: true, missingFields: [], logoStatus: 'ok' },
      { id: 2, school: 'Missing Conference U', requiredFieldsOk: false, missingFields: ['conference'], logoStatus: 'missing' }
    ])
    expect(report.season).toBe(2026)
    expect(report.teams).toEqual([
      { id: 1, school: 'Ohio State', requiredFields: 'pass', missingFields: [], logo: 'pass' },
      { id: 2, school: 'Missing Conference U', requiredFields: 'fail', missingFields: ['conference'], logo: 'missing' }
    ])
    expect(report.summary).toEqual({
      totalTeams: 2,
      requiredFieldFailures: 1,
      logosVendored: 1,
      logosMissing: 1
    })
  })

  it('never leaks CFBD_API_KEY into the serialized report', () => {
    process.env.CFBD_API_KEY = 'super-secret-test-value'
    try {
      const report = buildCoverageReport(2026, [
        { id: 1, school: 'Ohio State', requiredFieldsOk: true, missingFields: [], logoStatus: 'ok' }
      ])
      expect(JSON.stringify(report)).not.toContain('CFBD_API_KEY')
    } finally {
      delete process.env.CFBD_API_KEY
    }
  })
})
