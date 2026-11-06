import { measure } from './monitoring'
import { getUser } from '@netlify/identity'
import {
  pool,
  requireActive,
  syncAccount,
  errorResponse,
  HttpError,
} from './admin-core'

export function protectedHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const started = performance.now()
    const path = new URL(req.url).pathname
    const endpoint = [
      '/api/workspace',
      '/api/documents',
      '/api/study-ai',
      '/api/session-event',
    ].includes(path)
      ? path.slice(5)
      : 'protected-api'
    const report = async (response: Response, userId?: string) => {
      await measure({
        userId,
        category: 'api',
        feature: endpoint,
        status: response.ok ? 'success' : 'failure',
        httpStatus: response.status,
        durationMs: performance.now() - started,
      })
      return response
    }
    const user = await getUser()
    if (!user)
      return report(errorResponse(new HttpError(401, 'Please sign in.')))
    let client
    try {
      client = await pool().connect()
    } catch (error) {
      return report(errorResponse(error), user.id)
    }
    try {
      // A per-user session lock drains in-flight operations before account deletion.
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [
        `account:${user.id}`,
      ])
      await requireActive(user)
      await syncAccount(user)
      return report(await handler(req), user.id)
    } catch (error) {
      return report(errorResponse(error), user.id)
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          `account:${user.id}`,
        ])
      } finally {
        client.release()
      }
    }
  }
}
