import { getUser } from '@netlify/identity'
import { protectedHandler } from '../lib/protected-handler'
import { sameOrigin, recordEvent } from '../lib/admin-core'
export default protectedHandler(async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  sameOrigin(req)
  const user = await getUser()
  if (user)
    await recordEvent(user.id, 'session.logout_requested', 'authentication')
  return Response.json({ ok: true })
})
export const config = { path: '/api/session-event' }
