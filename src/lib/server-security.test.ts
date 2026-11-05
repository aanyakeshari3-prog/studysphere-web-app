// @vitest-environment node
import { PgDialect } from 'drizzle-orm/pg-core'
import { vi, it, expect, beforeEach } from 'vitest'
const { user, query, insert, update, mockDb, aiCreate } = vi.hoisted(() => {
  const query = vi.fn()
  const insert = vi.fn()
  const update = vi.fn()
  return {
    user: vi.fn(),
    query,
    insert,
    update,
    aiCreate: vi.fn(),
    mockDb: {
      select: () => ({ from: () => ({ where: query }) }),
      insert: () => ({ values: () => ({ onConflictDoNothing: insert }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: update }) }) }),
    },
  }
})
vi.mock('@netlify/identity', () => ({ getUser: user }))
vi.mock('../../db/index', () => ({ database: () => mockDb }))
vi.mock('openai', () => {
  class APIError extends Error {
    status = 429
  }
  return {
    default: class {
      static APIError = APIError
      chat = { completions: { create: aiCreate } }
    },
  }
})
import workspace from '../../netlify/functions/workspace.mts'
import documents from '../../netlify/functions/documents.mts'
import ai from '../../netlify/functions/study-ai.mts'
beforeEach(() => {
  vi.clearAllMocks()
  user.mockResolvedValue(null)
})
it('rejects anonymous reads, uploads, saves and AI requests before accessing storage', async () => {
  for (const handler of [workspace, documents, ai]) {
    const response = await handler(
      new Request('https://study.test/api/test', {
        method: 'POST',
        body: '{}',
      }),
    )
    expect(response.status).toBe(401)
  }
  expect(query).not.toHaveBeenCalled()
  expect(insert).not.toHaveBeenCalled()
  expect(aiCreate).not.toHaveBeenCalled()
})
it('scopes database reads to the authenticated account and disables caching', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  query.mockResolvedValue([])
  const response = await workspace(
    new Request('https://study.test/api/workspace?userId=someone-else'),
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  // SQL condition is generated using the verified account, never the URL's claimed owner.
  const condition = query.mock.calls[0][0]
  expect(
    JSON.stringify(new PgDialect().sqlToQuery(condition).params),
  ).toContain('student-one')
  expect(
    JSON.stringify(new PgDialect().sqlToQuery(condition).params),
  ).not.toContain('someone-else')
})
it('rejects stale revision writes instead of overwriting a newer workspace', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  update.mockResolvedValue([])
  const data = {
    tasks: [],
    notes: [],
    subjects: [],
    classes: [],
    focusSessions: [],
    notebooks: [],
    cards: [],
    activities: [],
    prefs: {
      displayName: '',
      theme: 'light',
      sidebarCollapsed: false,
      dailyFocusGoal: 4,
    },
  }
  const response = await workspace(
    new Request('https://study.test/api/workspace', {
      method: 'PUT',
      body: JSON.stringify({ data, revision: 3 }),
    }),
  )
  expect(response.status).toBe(409)
})
it('rejects cross-origin mutations', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  for (const handler of [workspace, documents, ai]) {
    const response = await handler(
      new Request('https://study.test/api/test', {
        method: handler === workspace ? 'PUT' : 'POST',
        headers: { origin: 'https://other.test' },
        body: '{}',
      }),
    )
    expect(response.status).toBe(403)
  }
})
it('reports AI failure without returning fake study content', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  aiCreate.mockRejectedValue(new Error('Unavailable'))
  const response = await ai(
    new Request('https://study.test/api/study-ai', {
      method: 'POST',
      body: JSON.stringify({
        action: 'Summarize',
        content: 'Mitosis produces two cells.',
      }),
    }),
  )
  expect(response.status).toBe(503)
  expect(await response.json()).toHaveProperty('error')
})
it('passes actual source text to the AI provider', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  aiCreate.mockResolvedValue({
    choices: [
      { message: { content: 'Two genetically identical cells result.' } },
    ],
  })
  const response = await ai(
    new Request('https://study.test/api/study-ai', {
      method: 'POST',
      body: JSON.stringify({
        action: 'Summarize',
        content: 'Mitosis produces two genetically identical daughter cells.',
      }),
    }),
  )
  expect(response.status).toBe(200)
  expect(aiCreate.mock.calls[0][0].messages[1].content).toContain(
    'Mitosis produces two genetically identical daughter cells.',
  )
})

it('does not disclose another account document even with a supplied document ID', async () => {
  user.mockResolvedValue({ id: 'student-one' })
  query.mockResolvedValue([])
  const response = await documents(
    new Request('https://study.test/api/documents?id=other-private-file'),
  )
  expect(response.status).toBe(404)
  const params = new PgDialect().sqlToQuery(query.mock.calls[0][0]).params
  expect(params).toContain('student-one')
  expect(params).toContain('other-private-file')
})
