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
    const user = await getUser()
    if (!user) return errorResponse(new HttpError(401, 'Please sign in.'))
    let client
    try {
      client = await pool().connect()
    } catch (error) {
      return errorResponse(error)
    }
    try {
      // A per-user session lock drains in-flight operations before account deletion.
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [
        `account:${user.id}`,
      ])
      await requireActive(user)
      await syncAccount(user)
      return await handler(req)
    } catch (error) {
      return errorResponse(error)
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
