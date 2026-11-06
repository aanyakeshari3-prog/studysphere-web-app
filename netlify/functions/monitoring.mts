import { getUser } from '@netlify/identity'
import { z } from 'zod'
import {
  pool,
  requireActive,
  rateLimit,
  sameOrigin,
  dateRange,
  pageNumber,
  HttpError,
  errorResponse,
} from '../lib/admin-core'
import { settings } from '../lib/monitoring'
const price = z
  .object({
    provider: z.enum(['openai']),
    model: z.literal('gpt-4.1-mini'),
    input: z.number().min(0).max(1000),
    output: z.number().min(0).max(1000),
    cached: z.number().min(0).max(1000),
  })
  .strict()
const settingsSchema = z
  .object({
    failedLogins: z.number().int().min(1).max(100000),
    authorizationFailures: z.number().int().min(1).max(100000),
    apiErrors: z.number().int().min(1).max(100000),
    uploadFailures: z.number().int().min(1).max(100000),
    aiFailures: z.number().int().min(1).max(100000),
    aiDailyRequests: z.number().int().min(1).max(10000000),
    requestVolume: z.number().int().min(1).max(10000000),
    adminActions: z.number().int().min(1).max(100000),
    slowMs: z.number().int().min(100).max(120000),
    storageQuotaBytes: z.number().int().min(0).max(1e15),
    storageWarningPercent: z.number().min(1).max(100),
    pricing: z.array(price).max(1),
  })
  .strict()
export function csvCell(value: unknown) {
  let s = value == null ? '' : String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s
  return '"' + s.replaceAll('"', '""') + '"'
}
export default async (req: Request) => {
  try {
    const user = await getUser()
    if (!user) throw new HttpError(401, 'Please sign in.')
    const actor = await requireActive(user)
    if (actor.role !== 'owner')
      throw new HttpError(403, 'Owner access required.')
    await rateLimit(actor.id, req.method !== 'GET')
    const db = pool(),
      p = new URL(req.url).searchParams
    const reply = (data: unknown) =>
      Response.json(data, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    if (req.method === 'POST') {
      sameOrigin(req)
      const raw = await req.text()
      if (raw.length > 8000) throw new HttpError(413, 'Request too large.')
      let data
      try {
        data = JSON.parse(raw)
      } catch {
        throw new HttpError(400, 'Invalid request.')
      }
      const parsed = z
        .discriminatedUnion('action', [
          z
            .object({ action: z.literal('settings'), value: settingsSchema })
            .strict(),
          z
            .object({
              action: z.enum([
                'read',
                'resolve',
                'reopen',
                'resolve_security',
                'reopen_security',
              ]),
              id: z.uuid(),
            })
            .strict(),
        ])
        .safeParse(data)
      if (!parsed.success)
        throw new HttpError(400, 'Check the monitoring settings or event ID.')
      const d = parsed.data
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        // Recheck privileges inside the transaction before modifying monitoring state.
        const state = await client.query(
          'SELECT status FROM admin_accounts WHERE id=$1 FOR SHARE',
          [actor.id],
        )
        if (state.rows[0]?.status !== 'active')
          throw new HttpError(403, 'Active owner required.')
        if (d.action === 'settings')
          await client.query(
            "INSERT INTO admin_state(key,value) VALUES('monitor_settings',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [JSON.stringify(d.value)],
          )
        else if (
          d.action === 'resolve_security' ||
          d.action === 'reopen_security'
        ) {
          const found = await client.query(
            `SELECT id FROM activity_events WHERE id=$1 AND feature IN ('authentication','account') UNION ALL SELECT id FROM admin_audit WHERE id=$1 UNION ALL SELECT id FROM monitor_events WHERE id=$1 AND category='api' AND http_status IN (401,403,429)`,
            [d.id],
          )
          if (!found.rows.length)
            throw new HttpError(404, 'Security event not found.')
          await client.query(
            `INSERT INTO admin_state(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
            [
              'security-resolution:' + d.id,
              JSON.stringify({
                resolution:
                  d.action === 'resolve_security' ? 'resolved' : 'unresolved',
                at: new Date().toISOString(),
              }),
            ],
          )
        } else {
          const assignment = {
            read: 'read_at=now()',
            resolve: 'resolved_at=now(),read_at=now()',
            reopen: 'resolved_at=NULL',
          }[d.action]
          const result = await client.query(
            `UPDATE monitor_issues SET ${assignment} WHERE id=$1 RETURNING id`,
            [d.id],
          )
          if (!result.rows.length) throw new HttpError(404, 'Event not found.')
        }
        await client.query(
          `INSERT INTO admin_audit(id,admin_id,action,target_id,result) VALUES($1,$2,$3,$4,'success')`,
          [
            crypto.randomUUID(),
            actor.id,
            `monitor.${d.action === 'settings' ? 'settings' : 'issue.' + d.action}`,
            d.action === 'settings' ? null : d.id,
          ],
        )
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
      return reply({ ok: true })
    }
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.')
    const view = p.get('view') || 'ai'
    const config = await settings()
    if (view === 'settings') return reply({ settings: config })
    if (
      ![
        'ai',
        'storage',
        'security',
        'performance',
        'errors',
        'notifications',
      ].includes(view)
    )
      throw new HttpError(400, 'Unknown monitoring section.')
    const { start, end } = dateRange(p),
      page = pageNumber(p)
    const q = p.get('q') || '',
      severity = p.get('severity') || '',
      status = p.get('status') || '',
      category = p.get('category') || '',
      feature = p.get('feature') || '',
      provider = p.get('provider') || '',
      uid = p.get('user') || ''
    if (
      [q, severity, status, category, feature, provider, uid].some(
        (v) => v.length > 150,
      )
    )
      throw new HttpError(400, 'Filter too long.')
    const isIssue = view === 'errors' || view === 'notifications'
    // All SQL identifiers below are fixed by server allowlists; all user filters are bound.
    const source = isIssue
      ? `SELECT id,NULL::text AS user_id,category,feature,NULL::text AS provider,NULL::text AS model,
      CASE WHEN resolved_at IS NULL THEN 'unresolved' ELSE 'resolved' END AS status,http_status,NULL::int AS duration_ms,
      NULL::int AS input_tokens,NULL::int AS output_tokens,NULL::int AS cached_tokens,NULL::int AS bytes,NULL::text AS file_type,
      message AS code,environment,last_seen AS created_at,severity,occurrences,read_at,resolved_at FROM monitor_issues WHERE kind='${view === 'errors' ? 'error' : 'notification'}'`
      : view === 'security'
        ? `SELECT id,user_id,feature AS category,type AS feature,NULL::text AS provider,NULL::text AS model,status,NULL::int AS http_status,NULL::int AS duration_ms,NULL::int AS input_tokens,NULL::int AS output_tokens,NULL::int AS cached_tokens,NULL::int AS bytes,NULL::text AS file_type,NULL::text AS code,'server'::text AS environment,created_at,CASE WHEN status='failure' THEN 'medium' ELSE 'informational' END AS severity,1 AS occurrences,NULL::timestamptz AS read_at,NULL::timestamptz AS resolved_at FROM activity_events WHERE feature IN ('authentication','account')
      UNION ALL SELECT id,admin_id,'administration',action,NULL,NULL,result,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'server',created_at,'informational',1,NULL,NULL FROM admin_audit
      UNION ALL SELECT id,user_id,'authorization',feature,NULL,NULL,status,http_status,duration_ms,NULL,NULL,NULL,NULL,NULL,code,environment,created_at,'medium',1,NULL,NULL FROM monitor_events WHERE category='api' AND http_status IN (401,403,429)`
        : `SELECT *,CASE WHEN status='failure' THEN 'high' ELSE 'informational' END AS severity,1 AS occurrences,NULL::timestamptz AS read_at,NULL::timestamptz AS resolved_at FROM monitor_events WHERE ${view === 'performance' ? "category IN ('api','frontend','health')" : `category='${view === 'ai' ? 'ai' : 'storage'}'`}`
    const values = [
      start,
      end,
      `%${q}%`,
      severity,
      status,
      category,
      feature,
      provider,
      uid,
      JSON.stringify(config.pricing),
    ]
    const cte = `WITH source AS (${source}), filtered AS (SELECT e.*,a.name,coalesce(event_state.value->>'resolution','unresolved') AS resolution,
      CASE WHEN e.input_tokens IS NOT NULL AND e.output_tokens IS NOT NULL AND r.model IS NOT NULL
      THEN ((e.input_tokens-coalesce(e.cached_tokens,0))*r.input+coalesce(e.cached_tokens,0)*r.cached+e.output_tokens*r.output)/1000000.0 ELSE NULL END AS estimated_cost
      FROM source e LEFT JOIN admin_accounts a ON a.id=e.user_id LEFT JOIN admin_state event_state ON event_state.key='security-resolution:'||e.id
      LEFT JOIN jsonb_to_recordset($10::jsonb) AS r(provider text,model text,input numeric,output numeric,cached numeric) ON r.provider=e.provider AND r.model=e.model
      WHERE e.created_at >= $1 AND e.created_at < $2 AND (coalesce(e.user_id,'') ILIKE $3 OR coalesce(a.name,'') ILIKE $3 OR e.feature ILIKE $3 OR coalesce(e.code,'') ILIKE $3)
      AND ($4='' OR e.severity=$4) AND ($5='' OR e.status=$5) AND ($6='' OR e.category=$6) AND ($7='' OR e.feature=$7) AND ($8='' OR e.provider=$8) AND ($9='' OR e.user_id=$9))`
    const order =
      p.get('sort') === 'oldest'
        ? 'created_at ASC,id'
        : p.get('sort') === 'duration'
          ? 'duration_ms DESC NULLS LAST,id'
          : 'created_at DESC,id'
    const userOrder =
      (
        {
          name: 'name ASC NULLS LAST',
          tokens: 'tokens DESC NULLS LAST',
          cost: 'estimated_cost DESC NULLS LAST',
          oldest: 'last_request ASC',
          newest: 'requests DESC',
          duration: 'requests DESC',
        } as Record<string, string>
      )[p.get('sort') || 'newest'] || 'requests DESC'
    const [records, stats, days, groups, users, months] = await Promise.all([
      db.query(
        `${cte} SELECT * FROM filtered ORDER BY ${order} LIMIT 25 OFFSET $11`,
        [...values, (page - 1) * 25],
      ),
      db.query(
        `${cte} SELECT count(*)::int AS total,count(*) FILTER(WHERE status='success')::int AS successful,count(*) FILTER(WHERE status='failure')::int AS failed,
        count(*) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS today,
        count(*) FILTER(WHERE created_at>=date_trunc('week',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS this_week,
        count(*) FILTER(WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS this_month,
        round(avg(duration_ms))::int AS average_ms,count(*) FILTER(WHERE duration_ms>$11)::int AS slow,
        sum(input_tokens)::float8 AS input_tokens,sum(output_tokens)::float8 AS output_tokens,sum(estimated_cost)::float8 AS estimated_cost,
        count(estimated_cost)::int AS priced_requests,count(input_tokens)::int AS metered_requests,
        count(*) FILTER(WHERE category='frontend')::int AS frontend_errors,count(*) FILTER(WHERE category='api' AND http_status>=500)::int AS backend_errors,
        count(*) FILTER(WHERE resolved_at IS NULL)::int AS unresolved,count(*) FILTER(WHERE read_at IS NULL)::int AS unread
        FROM filtered`,
        [...values, config.slowMs],
      ),
      db.query(
        `${cte} SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,count(*)::int AS events,round(avg(duration_ms))::int AS average_ms,
        count(*) FILTER(WHERE status='failure')::int AS failed,sum(bytes) FILTER(WHERE feature='upload' AND status='success')::float8 AS bytes,
        sum(input_tokens+output_tokens)::float8 AS tokens,sum(estimated_cost)::float8 AS estimated_cost,
        sum(CASE WHEN status='success' AND feature='upload' THEN bytes WHEN status='success' AND feature='delete' THEN -bytes ELSE 0 END)::float8 AS net_bytes FROM filtered GROUP BY 1 ORDER BY 1`,
        values,
      ),
      db.query(
        `${cte} SELECT feature,provider,model,file_type,count(*)::int AS events,count(*) FILTER(WHERE status='failure')::int AS failed,round(avg(duration_ms))::int AS average_ms,sum(input_tokens+output_tokens)::float8 AS tokens,sum(estimated_cost)::float8 AS estimated_cost FROM filtered GROUP BY 1,2,3,4 ORDER BY events DESC LIMIT 50`,
        values,
      ),
      db.query(
        `${cte} SELECT user_id,name,count(*)::int AS requests,count(*) FILTER(WHERE status='success')::int AS successful,count(*) FILTER(WHERE status='failure')::int AS failed,sum(input_tokens+output_tokens)::float8 AS tokens,sum(estimated_cost)::float8 AS estimated_cost,max(created_at) AS last_request FROM filtered WHERE user_id IS NOT NULL GROUP BY 1,2 ORDER BY ${userOrder},user_id LIMIT 25 OFFSET $11`,
        [...values, (page - 1) * 25],
      ),
      db.query(
        `${cte} SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM') AS month,count(*)::int AS events,sum(estimated_cost)::float8 AS estimated_cost,sum(CASE WHEN status='success' AND feature='upload' THEN bytes WHEN status='success' AND feature='delete' THEN -bytes ELSE 0 END)::float8 AS net_bytes FROM filtered GROUP BY 1 ORDER BY 1`,
        values,
      ),
    ])
    const data: Record<string, unknown> = {
      rows: records.rows,
      stats: stats.rows[0],
      days: days.rows,
      months: months.rows,
      groups: groups.rows,
      users: users.rows,
      start,
      end,
      page,
      slowMs: config.slowMs,
      pricingNote:
        'USD estimate using current configured per-model rates per million tokens, including cached input. Not a provider invoice. Unpriced requests and missing token counts are excluded; changing rates recalculates historical estimates.',
    }
    if (view === 'storage') {
      const [snapshot, consumers, types, monthly, history, uploads] =
        await Promise.all([
          db.query(`SELECT count(*)::int AS files,coalesce(sum(size),0)::float8 AS bytes,round(avg(size))::int AS average_bytes,
          count(*) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS uploaded_today,
          count(*) FILTER(WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS uploaded_month FROM documents`),
          db.query(
            `SELECT d.user_id,a.name,count(*)::int AS files,sum(size)::float8 AS bytes,max(d.created_at) AS last_upload FROM documents d LEFT JOIN admin_accounts a ON a.id=d.user_id WHERE ($1='' OR d.user_id=$1) AND (coalesce(a.name,'') ILIKE $2 OR d.user_id ILIKE $2) GROUP BY 1,2 ORDER BY bytes DESC LIMIT 25 OFFSET $3`,
            [uid, `%${q}%`, (page - 1) * 25],
          ),
          db.query(
            'SELECT type,count(*)::int AS files,sum(size)::float8 AS bytes FROM documents GROUP BY type ORDER BY bytes DESC',
          ),
          db.query(
            `SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM') AS month,sum(size)::float8 AS bytes,count(*)::int AS files FROM documents WHERE created_at >= $1 AND created_at < $2 GROUP BY 1 ORDER BY 1`,
            [start, end],
          ),
          db.query(
            `SELECT DISTINCT ON ((created_at AT TIME ZONE 'UTC')::date) to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,bytes FROM monitor_events WHERE category='health' AND feature='storage-inventory' AND created_at >= $1 AND created_at < $2 ORDER BY (created_at AT TIME ZONE 'UTC')::date,created_at DESC`,
            [start, end],
          ),
          db.query(
            `SELECT count(*) FILTER(WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS today,count(*) FILTER(WHERE created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS month FROM monitor_events WHERE category='storage' AND feature='upload' AND status='success'`,
          ),
        ])
      data.storage = {
        ...snapshot.rows[0],
        uploaded_today: uploads.rows[0]?.today || 0,
        uploaded_month: uploads.rows[0]?.month || 0,
        history: history.rows,
        quota: config.storageQuotaBytes || null,
        consumers: consumers.rows,
        types: types.rows,
        monthly: monthly.rows,
      }
    }
    if (view === 'performance') {
      const [health, slowest] = await Promise.all([
        db.query(
          `SELECT DISTINCT ON(feature) feature,status,duration_ms,created_at FROM monitor_events WHERE category='health' ORDER BY feature,created_at DESC`,
        ),
        db.query(
          `SELECT feature,count(*)::int AS requests,round(avg(duration_ms))::int AS average_ms,max(duration_ms)::int AS max_ms,round(100.0*count(*) FILTER(WHERE http_status>=400)/greatest(count(*),1),2)::float8 AS failure_percent FROM monitor_events WHERE category='api' AND created_at >= $1 AND created_at < $2 GROUP BY feature ORDER BY average_ms DESC LIMIT 25`,
          [start, end],
        ),
      ])
      data.health = health.rows
      data.slowest = slowest.rows
    }
    if (p.get('export') === 'csv') {
      // Export only aggregate feature summaries; no content or unrestricted raw metadata.
      const columns = [
        'feature',
        'provider',
        'model',
        'file_type',
        'events',
        'failed',
        'average_ms',
        'tokens',
        'estimated_cost',
      ]
      await db.query(
        `INSERT INTO admin_audit(id,admin_id,action,result) VALUES($1,$2,'monitor.export','success')`,
        [crypto.randomUUID(), actor.id],
      )
      return new Response(
        [
          columns.map(csvCell).join(','),
          ...groups.rows.map((row: Record<string, unknown>) =>
            columns.map((c) => csvCell(row[c])).join(','),
          ),
        ].join('\r\n'),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition':
              'attachment; filename="studysphere-summary.csv"',
            'Cache-Control': 'private, no-store',
          },
        },
      )
    }
    return reply(data)
  } catch (error) {
    return errorResponse(error)
  }
}
export const config = { path: '/api/monitoring' }
