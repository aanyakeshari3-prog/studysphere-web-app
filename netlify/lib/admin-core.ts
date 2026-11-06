import { getDatabase } from '@netlify/database'
import type { User } from '@netlify/identity'

export const pool = () => getDatabase().pool
export const ownerId = () => process.env.STUDYSPHERE_OWNER_USER_ID?.trim() || ''
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export function ownerRole(id: string, role: string) {
  return ownerId() && id === ownerId()
    ? 'owner'
    : role === 'admin'
      ? 'admin'
      : 'student'
}
export function canManage(
  actor: { id: string; role: string },
  target: { id: string; role: string },
  action: string,
) {
  if (target.id === ownerId() || actor.id === target.id) return false
  if (actor.role === 'owner') return true
  return (
    actor.role === 'admin' &&
    target.role === 'student' &&
    ['suspend', 'reactivate'].includes(action)
  )
}
export function sameOrigin(req: Request) {
  if (
    req.headers.get('origin') !== new URL(req.url).origin ||
    req.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new HttpError(403, 'Same-origin request required.')
}
export function dateRange(params: URLSearchParams, now = new Date()) {
  const preset = params.get('range') || '30'
  const end = new Date(now)
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() + 1)
  const start = new Date(end)
  if (preset === 'custom') {
    const a = params.get('from') || '',
      b = params.get('to') || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b))
      throw new HttpError(400, 'Choose valid start and end dates.')
    start.setTime(Date.parse(a + 'T00:00:00Z'))
    end.setTime(Date.parse(b + 'T00:00:00Z') + 86400000)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
      throw new HttpError(400, 'Invalid calendar date.')
    if (
      start.toISOString().slice(0, 10) !== a ||
      new Date(end.getTime() - 86400000).toISOString().slice(0, 10) !== b
    )
      throw new HttpError(400, 'Invalid calendar date.')
  } else {
    if (!['1', '7', '30', '90'].includes(preset))
      throw new HttpError(400, 'Invalid date range.')
    start.setUTCDate(start.getUTCDate() - Number(preset))
  }
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end ||
    end.getTime() - start.getTime() > 366 * 86400000
  )
    throw new HttpError(400, 'Select a range of 1–366 days.')
  return { start: start.toISOString(), end: end.toISOString() }
}
export function pageNumber(params: URLSearchParams) {
  const page = Number(params.get('page') || 1)
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw new HttpError(400, 'Invalid page.')
  return page
}
export async function syncAccount(
  user: Pick<
    User,
    'id' | 'email' | 'name' | 'confirmedAt' | 'createdAt' | 'lastSignInAt'
  >,
) {
  await pool().query(
    `INSERT INTO admin_accounts(id,email,name,verified_at,registered_at,last_login)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=COALESCE(NULLIF(excluded.name,''),admin_accounts.name),
    verified_at=excluded.verified_at, registered_at=COALESCE(excluded.registered_at,admin_accounts.registered_at),
    last_login=COALESCE(excluded.last_login,admin_accounts.last_login)`,
    [
      user.id,
      user.email || '',
      (user.name || '').slice(0, 100),
      user.confirmedAt || null,
      user.createdAt || null,
      user.lastSignInAt || null,
    ],
  )
}
export async function requireActive(user: Pick<User, 'id' | 'roles'>) {
  // The database status is checked on every API call, including sessions issued before suspension.
  const result = await pool().query(
    'SELECT id,role,status FROM admin_accounts WHERE id=$1',
    [user.id],
  )
  const account = result.rows[0]
  if (account && account.status !== 'active')
    throw new HttpError(403, 'This account is suspended or pending deletion.')
  return { id: user.id, role: ownerRole(user.id, account?.role || 'student') }
}
export async function rateLimit(id: string, mutation = false) {
  const bucket = Math.floor(Date.now() / 60000)
  const key = `${id}:${mutation ? 'write' : 'read'}:${bucket}`
  const { rows } = await pool().query(
    `INSERT INTO admin_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '2 minutes')
    ON CONFLICT(key) DO UPDATE SET count=admin_rate_limits.count+1 RETURNING count`,
    [key],
  )
  if (rows[0].count > (mutation ? 20 : 120))
    throw new HttpError(429, 'Too many requests. Please wait one minute.')
}
export async function recordEvent(
  userId: string | null,
  type: string,
  feature: string,
  status = 'success',
  metadata: Record<string, number | boolean> = {},
  correlationId?: string,
) {
  // Callers supply fixed event names and numeric/boolean metadata only; never accept client event payloads.
  await pool().query(
    `INSERT INTO activity_events(id,user_id,type,feature,status,metadata,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      crypto.randomUUID(),
      userId,
      type,
      feature,
      status,
      JSON.stringify(metadata),
      correlationId || null,
    ],
  )
  if (userId && status === 'success' && type !== 'password.reset.requested')
    await pool().query(
      'UPDATE admin_accounts SET last_active=now() WHERE id=$1',
      [userId],
    )
}
export function errorResponse(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : 'Administration is temporarily unavailable. Please retry.',
    },
    {
      status: error instanceof HttpError ? error.status : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}
