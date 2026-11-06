// @vitest-environment node
import { beforeEach, it, expect, vi } from 'vitest'
import type { Context } from '@netlify/functions'
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  recover: vi.fn(),
  query: vi.fn(),
}))
vi.mock('@netlify/identity', () => ({
  login: mocks.login,
  requestPasswordRecovery: mocks.recover,
}))
vi.mock('@netlify/database', () => ({
  getDatabase: () => ({ pool: { query: mocks.query } }),
}))
import auth from '../../netlify/functions/auth-access.mts'
const context = { ip: '192.0.2.5' } as Context
const request = (data: unknown) =>
  new Request('https://study.test/api/auth-access', {
    method: 'POST',
    headers: { origin: 'https://study.test' },
    body: JSON.stringify(data),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('admin_rate_limits')
      ? [{ count: 1 }]
      : sql.includes('SELECT id,status')
        ? [{ id: 'student', status: 'active' }]
        : [],
  }))
})
it('logs failed credentials without storing the password, attempted email or provider error', async () => {
  mocks.login.mockRejectedValue(new Error('provider private error'))
  const response = await auth(
    request({
      action: 'login',
      email: 'student@example.test',
      password: 'private-password',
    }),
    context,
  )
  expect(response.status).toBe(401)
  expect(
    mocks.query.mock.calls.find(([s]) =>
      s.includes('INSERT INTO activity_events'),
    )?.[1],
  ).toContain('login.failed')
  expect(JSON.stringify(mocks.query.mock.calls)).not.toContain(
    'private-password',
  )
  expect(JSON.stringify(await response.json())).not.toContain(
    'provider private error',
  )
})
it('never returns provider credentials or raw user objects after successful login', async () => {
  mocks.login.mockResolvedValue({
    id: 'student',
    token: 'private-provider-token',
  })
  const response = await auth(
    request({
      action: 'login',
      email: 'student@example.test',
      password: 'private-password',
    }),
    context,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
})
it('rejects suspended accounts before minting a new session', async () => {
  mocks.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('admin_rate_limits')
      ? [{ count: 1 }]
      : sql.includes('SELECT id,status')
        ? [{ id: 'student', status: 'suspended' }]
        : [],
  }))
  expect(
    (
      await auth(
        request({
          action: 'login',
          email: 'student@example.test',
          password: 'private-password',
        }),
        context,
      )
    ).status,
  ).toBe(401)
  expect(mocks.login).not.toHaveBeenCalled()
})
it('records password recovery requests without claiming reset completion', async () => {
  expect(
    (
      await auth(
        request({ action: 'recover', email: 'student@example.test' }),
        context,
      )
    ).status,
  ).toBe(200)
  expect(mocks.recover).toHaveBeenCalledWith('student@example.test')
  expect(
    mocks.query.mock.calls.find(([s]) =>
      s.includes('INSERT INTO activity_events'),
    )?.[1],
  ).toContain('password.reset.requested')
})
it('requires same-origin and rate-limits unauthenticated requests by trusted context IP', async () => {
  expect(
    (
      await auth(
        new Request('https://study.test/api/auth-access', {
          method: 'POST',
          body: '{}',
        }),
        context,
      )
    ).status,
  ).toBe(403)
  mocks.query.mockResolvedValue({ rows: [{ count: 21 }] })
  expect(
    (
      await auth(
        request({ action: 'recover', email: 'student@example.test' }),
        context,
      )
    ).status,
  ).toBe(429)
  expect(mocks.recover).not.toHaveBeenCalled()
  expect(JSON.stringify(mocks.query.mock.calls)).not.toContain(context.ip)
})
