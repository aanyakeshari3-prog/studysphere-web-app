import { observe } from '../lib/monitoring'
import { z } from 'zod'
import { admin, getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import {
  pool,
  ownerId,
  ownerRole,
  syncAccount,
  requireActive,
  rateLimit,
  sameOrigin,
  dateRange,
  pageNumber,
  canManage,
  HttpError,
  errorResponse,
} from '../lib/admin-core'

const handler = async (req: Request) => {
  let auditContext: { id: string; action: string; target?: string } | null =
    null
  try {
    const identity = await getUser()
    if (!identity) throw new HttpError(401, 'Please sign in.')
    const actor = await requireActive(identity)
    if (!['owner', 'admin'].includes(actor.role))
      throw new HttpError(403, 'Administrator access required.')
    await rateLimit(actor.id, req.method !== 'GET')
    const db = pool(),
      params = new URL(req.url).searchParams
    const view = params.get('view') || 'overview'
    const reply = (value: unknown) =>
      Response.json(value, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    if (req.method === 'GET') {
      if (view === 'me')
        return reply({
          ...actor,
          name: identity.name || 'Administrator',
          email: identity.email || '',
        })
      if (view === 'overview' || view === 'analytics') {
        const { start, end } = dateRange(params)
        const [accounts, activity, days, features, recent, state] =
          await Promise.all([
            db.query(
              `SELECT count(*)::int AS total_users,
            count(*) FILTER(WHERE status='suspended')::int AS suspended,
            count(*) FILTER(WHERE verified_at IS NULL)::int AS unverified,
            count(*) FILTER(WHERE registered_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS registrations_today,
            count(*) FILTER(WHERE registered_at>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS registrations_week,
            count(*) FILTER(WHERE registered_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS registrations_month,
            count(*) FILTER(WHERE registered_at >= $1 AND registered_at < $2)::int AS new_users
            FROM admin_accounts WHERE status<>'deleted'`,
              [start, end],
            ),
            db.query(
              `SELECT count(*)::int AS total_activities,
            count(*) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS activities_today,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS dau,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at>=now()-interval '7 days')::int AS wau,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at>=now()-interval '30 days')::int AS mau,
            count(*) FILTER(WHERE created_at >= $1 AND created_at < $2)::int AS range_events,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at >= $1 AND created_at < $2)::int AS unique_users,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at >= $1 AND created_at < $2 AND user_id IN (SELECT id FROM admin_accounts WHERE registered_at < $1))::int AS returning_users,
            count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success' AND created_at >= $1 AND created_at < $2 AND user_id IN (SELECT id FROM admin_accounts WHERE registered_at >= $1 AND registered_at < $2))::int AS new_active_users
            FROM activity_events`,
              [start, end],
            ),
            db.query(
              `WITH dates AS (SELECT generate_series($1::timestamptz, $2::timestamptz-interval '1 day',interval '1 day') AS day),
            e AS (SELECT (created_at AT TIME ZONE 'UTC')::date AS day,count(*)::int AS events,count(DISTINCT user_id) FILTER(WHERE feature<>'account' AND type<>'password.reset.requested' AND status='success')::int AS active FROM activity_events WHERE created_at >= $1 AND created_at < $2 GROUP BY 1),
            u AS (SELECT (registered_at AT TIME ZONE 'UTC')::date AS day,count(*)::int AS registrations FROM admin_accounts WHERE registered_at >= $1 AND registered_at < $2 AND status<>'deleted' GROUP BY 1)
            SELECT to_char(d.day AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,coalesce(e.events,0) AS events,coalesce(e.active,0) AS active,coalesce(u.registrations,0) AS registrations
            FROM dates d LEFT JOIN e ON e.day=(d.day AT TIME ZONE 'UTC')::date LEFT JOIN u ON u.day=(d.day AT TIME ZONE 'UTC')::date ORDER BY d.day`,
              [start, end],
            ),
            db.query(
              `SELECT feature,count(*)::int AS events,count(DISTINCT user_id)::int AS users FROM activity_events WHERE created_at >= $1 AND created_at < $2 AND status='success' GROUP BY feature ORDER BY events DESC`,
              [start, end],
            ),
            db.query(
              `SELECT e.*,a.name,a.email FROM activity_events e LEFT JOIN admin_accounts a ON a.id=e.user_id WHERE e.created_at >= $1 AND e.created_at < $2 ORDER BY e.created_at DESC LIMIT 12`,
              [start, end],
            ),
            db.query("SELECT value FROM admin_state WHERE key='identity_sync'"),
          ])
        return reply({
          stats: { ...accounts.rows[0], ...activity.rows[0] },
          days: days.rows,
          features: features.rows,
          recent: recent.rows,
          sync: state.rows[0]?.value || null,
          start,
          end,
        })
      }
      const page = pageNumber(params),
        limit = 25,
        offset = (page - 1) * limit
      const search = (params.get('q') || '').trim()
      if (search.length > 150) throw new HttpError(400, 'Search is too long.')
      if (view === 'users') {
        const filter = params.get('filter') || 'all',
          sort = params.get('sort') || 'newest'
        const filters: Record<string, string> = {
          all: 'TRUE',
          active: "status='active'",
          suspended: "status='suspended'",
          unverified: 'verified_at IS NULL',
          recent: "registered_at>=now()-interval '7 days'",
          admin: "(role='admin' OR id=$2)",
          student: "(role='student' AND id<>$2)",
        }
        const sorts: Record<string, string> = {
          newest: 'registered_at DESC NULLS LAST',
          oldest: 'registered_at ASC NULLS LAST',
          name: 'name ASC',
          email: 'email ASC',
          active: 'last_active DESC NULLS LAST',
        }
        if (!filters[filter] || !sorts[sort])
          throw new HttpError(400, 'Invalid user filter or sort.')
        const values = [`%${search}%`, ownerId()]
        const where = `status<>'deleted' AND $2::text IS NOT NULL AND (name ILIKE $1 OR email ILIKE $1 OR id ILIKE $1) AND ${filters[filter]}`
        // Fixed allowlists above are the only interpolated SQL fragments.
        const [rows, total] = await Promise.all([
          db.query(
            `SELECT * FROM admin_accounts WHERE ${where} ORDER BY ${sorts[sort]},id LIMIT $3 OFFSET $4`,
            [...values, limit, offset],
          ),
          db.query(
            `SELECT count(*)::int AS total FROM admin_accounts WHERE ${where}`,
            values,
          ),
        ])
        return reply({
          rows: rows.rows.map((u: { id: string; role: string }) => ({
            ...u,
            role: ownerRole(u.id, u.role),
          })),
          total: total.rows[0].total,
          page,
        })
      }
      if (view === 'user') {
        const id = params.get('id') || ''
        if (!id || id.length > 150) throw new HttpError(400, 'Invalid user.')
        const [user, features, events] = await Promise.all([
          db.query(
            "SELECT * FROM admin_accounts WHERE id=$1 AND status<>'deleted'",
            [id],
          ),
          db.query(
            'SELECT feature,count(*)::int AS events FROM activity_events WHERE user_id=$1 GROUP BY feature ORDER BY events DESC',
            [id],
          ),
          db.query(
            "SELECT * FROM activity_events WHERE user_id=$1 AND feature='authentication' ORDER BY created_at DESC LIMIT 25",
            [id],
          ),
        ])
        if (!user.rows[0]) throw new HttpError(404, 'Account not found.')
        return reply({
          user: { ...user.rows[0], role: ownerRole(id, user.rows[0].role) },
          features: features.rows,
          security: events.rows,
        })
      }
      if (view === 'events' || view === 'audit') {
        const { start, end } = dateRange(params),
          feature = params.get('feature') || '',
          type = params.get('type') || '',
          status = params.get('status') || '',
          target = params.get('user') || ''
        if ([feature, type, status, target].some((v) => v.length > 150))
          throw new HttpError(400, 'Invalid event filter.')
        const audit = view === 'audit'
        const table = audit ? 'admin_audit' : 'activity_events',
          userCol = audit ? 'admin_id' : 'user_id',
          statusCol = audit ? 'result' : 'status',
          typeCol = audit ? 'action' : 'type'
        const values = [
          start,
          end,
          `%${search}%`,
          type,
          status,
          target,
          ...(audit ? [] : [feature]),
        ]
        const where = `e.created_at >= $1 AND e.created_at < $2 AND (coalesce(a.name,'') ILIKE $3 OR coalesce(a.email,'') ILIKE $3 OR coalesce(e.${userCol},'') ILIKE $3) AND ($4='' OR e.${typeCol}=$4) AND ($5='' OR e.${statusCol}=$5) AND ($6='' OR e.${userCol}=$6) ${audit ? '' : "AND ($7='' OR e.feature=$7)"}`
        const join = `FROM ${table} e LEFT JOIN admin_accounts a ON a.id=e.${userCol}`
        const [rows, total] = await Promise.all([
          db.query(
            `SELECT e.*,a.name,a.email ${join} WHERE ${where} ORDER BY e.created_at DESC,e.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
            [...values, limit, offset],
          ),
          db.query(
            `SELECT count(*)::int AS total ${join} WHERE ${where}`,
            values,
          ),
        ])
        return reply({ rows: rows.rows, total: total.rows[0].total, page })
      }
      throw new HttpError(404, 'Unknown administration view.')
    }
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    sameOrigin(req)
    const raw = await req.text()
    if (raw.length > 2000) throw new HttpError(413, 'Request too large.')
    let body: {
      action?: string
      id?: string
      confirmation?: string
      role?: string
      page?: number
    }
    try {
      const parsed = z
        .object({
          action: z.enum([
            'sync',
            'visit',
            'suspend',
            'reactivate',
            'role',
            'delete',
          ]),
          id: z.string().min(1).max(150).optional(),
          confirmation: z.string().max(150).optional(),
          role: z.enum(['student', 'admin']).optional(),
          page: z.number().int().min(1).max(100000).optional(),
        })
        .strict()
        .safeParse(JSON.parse(raw))
      if (!parsed.success)
        throw new HttpError(400, 'Invalid administration request.')
      body = parsed.data
    } catch {
      throw new HttpError(400, 'Invalid request.')
    }
    const { action, id, confirmation } = body
    if (action && action !== 'visit')
      auditContext = { id: actor.id, action, target: id }
    if (action === 'sync') {
      if (actor.role !== 'owner')
        throw new HttpError(403, 'Only the Owner can synchronize accounts.')
      const cursor = await db.query(
        "SELECT value FROM admin_state WHERE key='identity_sync'",
      )
      const page = Number(cursor.rows[0]?.value?.nextPage || 1)
      if (!Number.isInteger(page) || page < 1 || page > 100000)
        throw new HttpError(400, 'Invalid sync page.')
      // Bounded Identity pages; never load the entire account directory into one response.
      const users = await admin.listUsers({ page, perPage: 100 })
      for (const user of users) await syncAccount(user)
      await db.query(
        `INSERT INTO admin_state(key,value) VALUES('identity_sync',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [
          JSON.stringify({
            completedAt:
              users.length < 100
                ? new Date().toISOString()
                : cursor.rows[0]?.value?.completedAt || null,
            nextPage: users.length === 100 ? page + 1 : 1,
          }),
        ],
      )
      await db.query(
        `INSERT INTO admin_audit(id,admin_id,action,result,metadata) VALUES($1,$2,'accounts.synchronized','success',$3)`,
        [
          crypto.randomUUID(),
          actor.id,
          JSON.stringify({ page, count: users.length }),
        ],
      )
      return reply({
        nextPage: users.length === 100 ? page + 1 : null,
        count: users.length,
      })
    }
    if (action === 'visit') {
      const key = `admin-login:${actor.id}:${identity.lastSignInAt || 'session'}`
      const inserted = await db.query(
        'INSERT INTO admin_state(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING key',
        [key, JSON.stringify({ at: new Date().toISOString() })],
      )
      if (inserted.rows.length)
        await db.query(
          "INSERT INTO admin_audit(id,admin_id,action,result) VALUES($1,$2,'admin.login','success')",
          [crypto.randomUUID(), actor.id],
        )
      return reply({ ok: true })
    }
    if (
      !id ||
      id.length > 150 ||
      !['suspend', 'reactivate', 'role', 'delete'].includes(action || '')
    )
      throw new HttpError(400, 'Invalid account action.')
    if (confirmation !== id)
      throw new HttpError(400, 'Confirm the target user ID.')
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      // Serialize all privileged mutations and recheck roles to close concurrent demotion races.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('studysphere-admin-mutations'))",
      )
      const fresh = await client.query(
        'SELECT role,status FROM admin_accounts WHERE id=$1 FOR UPDATE',
        [actor.id],
      )
      const currentRole = ownerRole(actor.id, fresh.rows[0]?.role || 'student')
      if (fresh.rows[0] && fresh.rows[0].status !== 'active')
        throw new HttpError(403, 'Account unavailable.')
      const target = await client.query(
        "SELECT * FROM admin_accounts WHERE id=$1 AND status<>'deleted' FOR UPDATE",
        [id],
      )
      const row = target.rows[0]
      if (!row) throw new HttpError(404, 'Account not found.')
      if (!canManage({ ...actor, role: currentRole }, row, action!))
        throw new HttpError(403, 'This account action is not permitted.')
      if (row.status === 'deleting' && action !== 'delete')
        throw new HttpError(
          409,
          'Deletion is in progress. Retry deletion to finish cleanup.',
        )
      if (action === 'role') {
        if (!['admin', 'student'].includes(body.role || ''))
          throw new HttpError(
            400,
            'Only Admin and Student roles can be assigned.',
          )
        await client.query('UPDATE admin_accounts SET role=$2 WHERE id=$1', [
          id,
          body.role,
        ])
      } else
        await client.query('UPDATE admin_accounts SET status=$2 WHERE id=$1', [
          id,
          action === 'suspend'
            ? 'suspended'
            : action === 'delete'
              ? 'deleting'
              : 'active',
        ])
      await client.query(
        `INSERT INTO admin_audit(id,admin_id,action,target_id,result,metadata) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          crypto.randomUUID(),
          actor.id,
          `account.${action}`,
          id,
          action === 'delete' ? 'pending' : 'success',
          JSON.stringify(
            action === 'role'
              ? { from: row.role, to: body.role }
              : { from: row.status },
          ),
        ],
      )
      if (action === 'suspend' || action === 'reactivate')
        await client.query(
          'INSERT INTO activity_events(id,user_id,type,feature,status) VALUES($1,$2,$3,$4,$5)',
          [
            crypto.randomUUID(),
            id,
            `account.${action === 'suspend' ? 'suspended' : 'reactivated'}`,
            'account',
            'success',
          ],
        )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    if (action === 'delete') {
      try {
        // Deny all existing sessions first. Cleanup is idempotent; a failed step leaves status=deleting.
        const drain = await db.connect()
        await drain.query('SELECT pg_advisory_lock(hashtext($1))', [
          `account:${id}`,
        ])
        try {
          const store = getStore({
            name: 'study-documents',
            consistency: 'strong',
          })
          for await (const page of store.list({
            prefix: `${id}/`,
            paginate: true,
          }))
            for (const blob of page.blobs) await store.delete(blob.key)
          try {
            await admin.deleteUser(id)
          } catch (error) {
            if (!(
              error instanceof Error &&
              'status' in error &&
              error.status === 404
            ))
              throw error
          }
          const cleanup = await db.connect()
          try {
            await cleanup.query('BEGIN')
            await cleanup.query('DELETE FROM documents WHERE user_id=$1', [id])
            await cleanup.query('DELETE FROM workspaces WHERE user_id=$1', [id])
            await cleanup.query('DELETE FROM monitor_events WHERE user_id=$1', [
              id,
            ])
            await cleanup.query(
              'DELETE FROM activity_events WHERE user_id=$1',
              [id],
            )
            await cleanup.query(
              "UPDATE admin_accounts SET email='',name='',role='student',status='deleted',verified_at=NULL,registered_at=NULL,last_login=NULL,last_active=NULL WHERE id=$1",
              [id],
            )
            await cleanup.query(
              "INSERT INTO admin_audit(id,admin_id,action,target_id,result) VALUES($1,$2,'account.delete.completed',$3,'success')",
              [crypto.randomUUID(), actor.id, id],
            )
            await cleanup.query('COMMIT')
          } catch (error) {
            await cleanup.query('ROLLBACK')
            throw error
          } finally {
            cleanup.release()
          }
        } finally {
          await drain.query('SELECT pg_advisory_unlock(hashtext($1))', [
            `account:${id}`,
          ])
          drain.release()
        }
      } catch {
        await db.query(
          "INSERT INTO admin_audit(id,admin_id,action,target_id,result) VALUES($1,$2,'account.delete.cleanup',$3,'failure')",
          [crypto.randomUUID(), actor.id, id],
        )
        throw new HttpError(
          503,
          'Account is blocked. Cleanup is incomplete; retry deletion to finish.',
        )
      }
    }
    return reply({ ok: true })
  } catch (error) {
    if (auditContext)
      await pool()
        .query(
          'INSERT INTO admin_audit(id,admin_id,action,target_id,result,metadata) VALUES($1,$2,$3,$4,$5,$6)',
          [
            crypto.randomUUID(),
            auditContext.id,
            `request.${auditContext.action}`,
            auditContext.target || null,
            'failure',
            JSON.stringify({
              httpStatus: error instanceof HttpError ? error.status : 503,
            }),
          ],
        )
        .catch(() => {})
    return errorResponse(error)
  }
}
export const config = { path: '/api/admin' }

export default observe('admin', handler)
