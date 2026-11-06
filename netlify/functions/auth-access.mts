import { observe } from '../lib/monitoring'
import { login, requestPasswordRecovery } from '@netlify/identity'
import type { Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  pool,
  rateLimit,
  sameOrigin,
  recordEvent,
  HttpError,
  errorResponse,
} from '../lib/admin-core'

// Use the same Identity provider. Its server SDK sets secure session cookies;
// credentials are used only for the provider call and are never logged or returned.
const handler = async (req: Request, context: Context) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    sameOrigin(req)
    await rateLimit(
      `auth:${createHash('sha256')
        .update(context.ip || 'unknown')
        .digest('hex')}`,
      true,
    )
    const raw = await req.text()
    if (raw.length > 4000) throw new HttpError(413, 'Request too large.')
    let input: unknown
    try {
      input = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'Invalid account request.')
    }
    const parsed = z
      .discriminatedUnion('action', [
        z
          .object({
            action: z.literal('login'),
            email: z.email().max(254),
            password: z.string().min(1).max(1024),
          })
          .strict(),
        z
          .object({ action: z.literal('recover'), email: z.email().max(254) })
          .strict(),
      ])
      .safeParse(input)
    if (!parsed.success)
      throw new HttpError(400, 'Enter a valid email and password.')
    const data = parsed.data
    const match = await pool().query(
      "SELECT id,status FROM admin_accounts WHERE lower(email)=lower($1) AND status<>'deleted' LIMIT 1",
      [data.email],
    )
    if (data.action === 'recover') {
      await requestPasswordRecovery(data.email)
      await recordEvent(
        match.rows[0]?.id || null,
        'password.reset.requested',
        'authentication',
      )
      return Response.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    try {
      // Do not disclose suspension or account existence before authenticating.
      if (match.rows[0] && match.rows[0].status !== 'active')
        throw new HttpError(401, 'Unable to sign in.')
      const user = await login(data.email, data.password)
      if (match.rows[0] && match.rows[0].status !== 'active')
        throw new HttpError(403, 'Sign-in is unavailable for this account.')
      // No user object or authentication material is sent in the response body.
      if (!user) throw new HttpError(401, 'Unable to sign in.')
      return Response.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch {
      await recordEvent(
        match.rows[0]?.id || null,
        'login.failed',
        'authentication',
        'failure',
      )
      throw new HttpError(
        401,
        'Unable to sign in. Check your credentials or contact the account owner.',
      )
    }
  } catch (error) {
    return errorResponse(error)
  }
}
export const config = { path: '/api/auth-access' }

export default observe('auth-access', handler)
