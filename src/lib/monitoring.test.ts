// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}))
vi.mock('@netlify/identity', () => ({ getUser: mocks.user }))
vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    pool: {
      query: mocks.query,
      connect: async () => ({
        query: mocks.clientQuery,
        release: mocks.release,
      }),
    },
  }),
}))
import monitoring, { csvCell } from '../../netlify/functions/monitoring.mts'
import { measure } from '../../netlify/lib/monitoring'
const req = (query = '', body?: unknown) =>
  new Request(
    'https://study.test/api/monitoring?' + query,
    body
      ? {
          method: 'POST',
          headers: { origin: 'https://study.test' },
          body: JSON.stringify(body),
        }
      : undefined,
  )
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STUDYSPHERE_OWNER_USER_ID', 'owner')
  mocks.user.mockResolvedValue({ id: 'owner' })
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('admin_rate_limits')
      ? [{ count: 1 }]
      : sql.includes('SELECT id,role,status')
        ? [{ id: 'owner', role: 'student', status: 'active' }]
        : [],
  }))
})
it('rejects anonymous callers and non-owner administrators', async () => {
  mocks.user.mockResolvedValue(null)
  expect((await monitoring(req())).status).toBe(401)
  expect(mocks.query).not.toHaveBeenCalled()
  mocks.user.mockResolvedValue({ id: 'operator', roles: ['owner'] })
  mocks.query.mockResolvedValue({
    rows: [{ role: 'admin', status: 'active' }],
  })
  expect((await monitoring(req())).status).toBe(403)
})
it('binds report filters and never queries document content in storage reports', async () => {
  const res = await monitoring(req('view=storage&q=%27secret&user=student'))
  expect(res.status).toBe(200)
  const calls = mocks.query.mock.calls
  expect(
    calls.some(
      ([sql, args]) =>
        sql.includes('WITH source') && args.includes("%'secret%"),
    ),
  ).toBe(true)
  expect(calls.map(([sql]) => sql).join(' ')).not.toMatch(
    /extracted_text|download|SELECT d\.\*/,
  )
})
it('requires same origin and validates thresholds before writing', async () => {
  expect(
    (
      await monitoring(
        new Request('https://study.test/api/monitoring', {
          method: 'POST',
          body: '{}',
        }),
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await monitoring(
        req('', { action: 'settings', value: { failedLogins: 0 } }),
      )
    ).status,
  ).toBe(400)
})
it('records provider usage without secrets and preserves unknown token counts', async () => {
  await measure({
    category: 'ai',
    feature: 'Summarize',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    status: 'success',
    durationMs: 42,
  })
  const [sql, args] = mocks.query.mock.calls[0]
  expect(sql).toContain('INSERT INTO monitor_events')
  expect(args.slice(9, 12)).toEqual([null, null, null])
  expect(JSON.stringify(args)).not.toMatch(/prompt|response|credential/)
})
it('telemetry failure cannot break the student operation', async () => {
  mocks.query.mockRejectedValue(new Error('private database details'))
  await expect(
    measure({ category: 'api', feature: 'workspace', status: 'failure' }),
  ).resolves.toBeUndefined()
  const res = await monitoring(req())
  expect(JSON.stringify(await res.json())).not.toContain('private database')
})
it('neutralizes CSV spreadsheet formulas and quotes delimiters', () => {
  for (const value of ['=HYPERLINK("x")', ' +1', '-2', '@SUM(A1)', '\tformula'])
    expect(csvCell(value)).toMatch(/^"'/)
  expect(csvCell('a,"b')).toBe('"a,""b"')
})
it('updates grouped issue resolution and its audit trail atomically', async () => {
  mocks.clientQuery.mockImplementation(async (sql: string) => ({
    rows: sql.includes('SELECT status')
      ? [{ status: 'active' }]
      : sql.includes('RETURNING id')
        ? [{ id: 'c03778b2-7aa4-4271-9947-528df999502d' }]
        : [],
  }))
  const res = await monitoring(
    req('', { action: 'resolve', id: 'c03778b2-7aa4-4271-9947-528df999502d' }),
  )
  expect(res.status).toBe(200)
  expect(
    mocks.clientQuery.mock.calls.some(([sql]) =>
      sql.includes('UPDATE monitor_issues SET resolved_at=now()'),
    ),
  ).toBe(true)
  expect(
    mocks.clientQuery.mock.calls.some(
      ([sql, args]) =>
        sql.includes('INSERT INTO admin_audit') &&
        args.includes('monitor.issue.resolve'),
    ),
  ).toBe(true)
  expect(mocks.clientQuery).toHaveBeenCalledWith('COMMIT')
  expect(mocks.release).toHaveBeenCalled()
})
it('rolls back monitoring changes when an owner was suspended during the request', async () => {
  mocks.clientQuery.mockResolvedValue({ rows: [{ status: 'suspended' }] })
  expect(
    (
      await monitoring(
        req('', {
          action: 'resolve',
          id: 'c03778b2-7aa4-4271-9947-528df999502d',
        }),
      )
    ).status,
  ).toBe(403)
  expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK')
  expect(
    mocks.clientQuery.mock.calls.some(([sql]) => sql.startsWith('UPDATE')),
  ).toBe(false)
})
