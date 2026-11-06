// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  store: vi.fn(),
}))
vi.mock('@netlify/identity', () => ({
  getUser: mocks.user,
  admin: { listUsers: mocks.list, deleteUser: mocks.remove },
}))
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
vi.mock('@netlify/blobs', () => ({ getStore: mocks.store }))
import admin from '../../netlify/functions/admin.mts'
import {
  ownerRole,
  canManage,
  dateRange,
  requireActive,
  recordEvent,
} from '../../netlify/lib/admin-core'
import { protectedHandler } from '../../netlify/lib/protected-handler'
import { workspaceEvents } from '../../netlify/lib/workspace-events'
const request = (view = 'me', body?: unknown) =>
  new Request(
    `https://study.test/api/admin?view=${view}`,
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
  vi.stubEnv('STUDYSPHERE_OWNER_USER_ID', 'configured-owner')
  mocks.user.mockResolvedValue(null)
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('admin_rate_limits') ? [{ count: 1 }] : [],
  }))
  mocks.clientQuery.mockResolvedValue({ rows: [] })
})
describe('server authorization', () => {
  it('rejects anonymous requests before reading accounts or reports, retaining safe failure telemetry', async () => {
    expect((await admin(request())).status).toBe(401)
    expect(
      mocks.query.mock.calls.every(([sql]) =>
        sql.startsWith('INSERT INTO monitor_'),
      ),
    ).toBe(true)
  })
  it('ignores claimed roles and query user IDs from students', async () => {
    mocks.user.mockResolvedValue({
      id: 'student',
      userMetadata: { role: 'owner' },
    })
    expect(
      (await admin(request('me&role=owner&userId=configured-owner'))).status,
    ).toBe(403)
  })
  it('grants Owner only to configured ID, never the first account or frontend metadata', () => {
    expect(ownerRole('first', 'owner')).toBe('student')
    expect(ownerRole('configured-owner', 'student')).toBe('owner')
    vi.stubEnv('STUDYSPHERE_OWNER_USER_ID', '')
    expect(ownerRole('configured-owner', 'owner')).toBe('student')
  })
  it('allows the configured owner and server-stored admin', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    expect((await (await admin(request())).json()).role).toBe('owner')
    mocks.user.mockResolvedValue({ id: 'operator' })
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT id,role,status')
        ? [{ id: 'operator', role: 'admin', status: 'active' }]
        : [{ count: 1 }],
    }))
    expect((await (await admin(request())).json()).role).toBe('admin')
  })
  it('checks suspension even for a previously issued owner session', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.query.mockResolvedValue({ rows: [{ status: 'suspended' }] })
    expect((await admin(request())).status).toBe(403)
  })
  it('prevents self escalation, owner modifications and admin-to-admin changes', () => {
    const operator = { id: 'operator', role: 'admin' }
    for (const action of ['suspend', 'reactivate', 'role', 'delete']) {
      expect(
        canManage(
          operator,
          { id: 'configured-owner', role: 'student' },
          action,
        ),
      ).toBe(false)
      expect(canManage(operator, operator, action)).toBe(false)
    }
    expect(
      canManage(operator, { id: 'student', role: 'student' }, 'role'),
    ).toBe(false)
    expect(
      canManage(operator, { id: 'student', role: 'student' }, 'delete'),
    ).toBe(false)
    expect(
      canManage(operator, { id: 'student', role: 'student' }, 'suspend'),
    ).toBe(true)
  })
  it('rejects role escalation through the real API and rolls back', async () => {
    mocks.user.mockResolvedValue({ id: 'operator' })
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT id,role,status')
        ? [{ id: 'operator', role: 'admin', status: 'active' }]
        : [{ count: 1 }],
    }))
    mocks.clientQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT role,status')
        ? [{ role: 'admin', status: 'active' }]
        : sql.includes('SELECT * FROM admin_accounts')
          ? [{ id: 'target', role: 'student', status: 'active' }]
          : [],
    }))
    expect(
      (
        await admin(
          request('users', {
            action: 'role',
            id: 'target',
            confirmation: 'target',
            role: 'admin',
          }),
        )
      ).status,
    ).toBe(403)
    expect(mocks.clientQuery).toHaveBeenCalledWith('ROLLBACK')
    expect(
      mocks.clientQuery.mock.calls.some(([s]) => s.startsWith('UPDATE')),
    ).toBe(false)
  })
  it('requires same-origin and explicit target confirmation for destructive actions', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    expect(
      (
        await admin(
          new Request('https://study.test/api/admin', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(403)
    expect(
      (await admin(request('users', { action: 'delete', id: 'target' })))
        .status,
    ).toBe(400)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('rate limits before accessing administration data', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('admin_rate_limits') ? [{ count: 121 }] : [],
    }))
    expect((await admin(request())).status).toBe(429)
  })
  it('blocks suspended accounts before existing APIs execute', async () => {
    mocks.user.mockResolvedValue({ id: 'student' })
    mocks.query.mockResolvedValue({
      rows: [{ id: 'student', status: 'suspended', role: 'student' }],
    })
    const handler = vi.fn()
    expect((await protectedHandler(handler)(request())).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalled()
  })
  it('does not trust browser roles for protected database access', async () => {
    mocks.query.mockResolvedValue({
      rows: [{ role: 'student', status: 'active' }],
    })
    expect(
      (await requireActive({ id: 'student', roles: ['owner'] })).role,
    ).toBe('student')
  })
})
describe('queries, privacy and analytics', () => {
  it('uses bound search parameters, pagination and fixed sort allowlists', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('admin_rate_limits')
        ? [{ count: 1 }]
        : sql.includes('count(*)')
          ? [{ total: 0 }]
          : [],
    }))
    expect(
      (await admin(request('users&q=%27%3BDROP%20TABLE%20users&page=2')))
        .status,
    ).toBe(200)
    const call = mocks.query.mock.calls.find(([sql]) =>
      sql.includes('LIMIT $3 OFFSET $4'),
    )!
    expect(call[0]).not.toContain('DROP TABLE')
    expect(call[1]).toEqual([
      "%';DROP TABLE users%",
      'configured-owner',
      25,
      25,
    ])
    expect((await admin(request('users&sort=role;DELETE'))).status).toBe(400)
    expect((await admin(request('users&page=-1'))).status).toBe(400)
  })
  it('validates calendar dates and UTC inclusive ranges', () => {
    expect(
      dateRange(
        new URLSearchParams('range=1'),
        new Date('2026-11-06T23:30:00Z'),
      ),
    ).toEqual({
      start: '2026-11-06T00:00:00.000Z',
      end: '2026-11-07T00:00:00.000Z',
    })
    expect(
      dateRange(
        new URLSearchParams('range=custom&from=2026-11-01&to=2026-11-06'),
      ).end,
    ).toBe('2026-11-07T00:00:00.000Z')
    for (const query of [
      'range=custom&from=2026-02-30&to=2026-03-02',
      'range=custom&from=2026-11-07&to=2026-11-06',
      'range=999',
      'range=custom',
    ])
      expect(() => dateRange(new URLSearchParams(query))).toThrow()
  })
  it('derives only safe counts from saved snapshots; ignores supplied activity arrays', () => {
    const before = {
      notes: [{ id: 'note', content: 'private' }],
      tasks: [],
      cards: [],
      prefs: {},
      activities: [],
    }
    const after = {
      ...before,
      notes: [{ id: 'note', content: 'new private content' }],
      tasks: [{ id: 'task', title: 'private homework' }],
      activities: [{ type: 'user.logged_in', token: 'secret' }],
    }
    expect(workspaceEvents(before, after)).toEqual([
      { type: 'note.updated', feature: 'notes', count: 1 },
      { type: 'task.created', feature: 'tasks', count: 1 },
    ])
    expect(workspaceEvents(after, after)).toEqual([])
    expect(JSON.stringify(workspaceEvents(before, after))).not.toMatch(
      /private|token|secret/,
    )
  })
  it('logs initial import as one baseline rather than fabricated history', () => {
    expect(workspaceEvents(null, { notes: [{ id: 'old' }] })).toEqual([
      { type: 'workspace.initialized', feature: 'study-tools', count: 1 },
    ])
  })
  it('writes event timestamp on the server and safe metadata as bound JSON', async () => {
    await recordEvent('student', 'task.created', 'tasks', 'success', {
      count: 3,
    })
    const [sql, values] = mocks.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO activity_events')
    expect(sql).not.toContain('created_at')
    expect(JSON.parse(values[5])).toEqual({ count: 3 })
    expect(values[1]).toBe('student')
  })
  it('gracefully handles database failures without disclosing database errors', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.query.mockRejectedValue(new Error('private connection detail'))
    const response = await admin(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      'private connection',
    )
  })
})

describe('account mutation persistence', () => {
  it.each([
    ['suspend', 'suspended'],
    ['reactivate', 'active'],
  ])('commits %s with an audit trail', async (action, status) => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.clientQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT * FROM admin_accounts')
        ? [{ id: 'target', role: 'student', status: 'active' }]
        : [],
    }))
    expect(
      (
        await admin(
          request('users', { action, id: 'target', confirmation: 'target' }),
        )
      ).status,
    ).toBe(200)
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      'UPDATE admin_accounts SET status=$2 WHERE id=$1',
      ['target', status],
    )
    expect(
      mocks.clientQuery.mock.calls.some(
        ([sql, values]) =>
          sql.includes('INSERT INTO admin_audit') &&
          values.includes(`account.${action}`),
      ),
    ).toBe(true)
    expect(mocks.clientQuery).toHaveBeenCalledWith('COMMIT')
  })
  it('deletes provider account, storage prefix, workspace and personal events; retains safe audit', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.clientQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT * FROM admin_accounts')
        ? [{ id: 'target', role: 'student', status: 'active' }]
        : [],
    }))
    const removeBlob = vi.fn()
    mocks.store.mockReturnValue({
      delete: removeBlob,
      list: async function* () {
        yield { blobs: [{ key: 'target/file' }] }
      },
    })
    expect(
      (
        await admin(
          request('users', {
            action: 'delete',
            id: 'target',
            confirmation: 'target',
          }),
        )
      ).status,
    ).toBe(200)
    expect(removeBlob).toHaveBeenCalledWith('target/file')
    expect(mocks.remove).toHaveBeenCalledWith('target')
    for (const table of ['documents', 'workspaces', 'activity_events'])
      expect(mocks.clientQuery).toHaveBeenCalledWith(
        `DELETE FROM ${table} WHERE user_id=$1`,
        ['target'],
      )
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        sql.includes("status='deleted'"),
      ),
    ).toBe(true)
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        sql.includes('DELETE FROM admin_audit'),
      ),
    ).toBe(false)
  })
  it('keeps a failed deletion blocked and reports a retryable cleanup error', async () => {
    mocks.user.mockResolvedValue({ id: 'configured-owner' })
    mocks.clientQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT * FROM admin_accounts')
        ? [{ id: 'target', role: 'student', status: 'active' }]
        : [],
    }))
    mocks.store.mockImplementation(() => {
      throw new Error('storage failure')
    })
    const response = await admin(
      request('users', {
        action: 'delete',
        id: 'target',
        confirmation: 'target',
      }),
    )
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('retry deletion')
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      'UPDATE admin_accounts SET status=$2 WHERE id=$1',
      ['target', 'deleting'],
    )
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
