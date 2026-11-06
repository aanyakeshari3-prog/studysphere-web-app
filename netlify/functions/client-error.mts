import { getUser } from '@netlify/identity'
import {
  requireActive,
  rateLimit,
  sameOrigin,
  HttpError,
  errorResponse,
} from '../lib/admin-core'
import { measure } from '../lib/monitoring'
export default async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    sameOrigin(req)
    const user = await getUser()
    if (!user) throw new HttpError(401, 'Please sign in.')
    await requireActive(user)
    await rateLimit(`client-error:${user.id}`, true)
    const raw = await req.text()
    if (raw.length > 200) throw new HttpError(413, 'Request too large.')
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'Invalid report.')
    }
    if (
      !['exception', 'unhandled-rejection', 'render-error'].includes(body.kind)
    )
      throw new HttpError(400, 'Invalid category.')
    // Client-reported, unverified counts. Never accept messages, paths, stack traces or event contents.
    await measure({
      userId: user.id,
      category: 'frontend',
      feature: body.kind,
      status: 'failure',
      code: 'client_reported',
    })
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return errorResponse(e)
  }
}
export const config = { path: '/api/client-error' }
