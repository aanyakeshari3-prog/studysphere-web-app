import { pool } from './admin-core'
import { createHash } from 'node:crypto'
export const environment = () =>
  (typeof Netlify === 'undefined' ? undefined : Netlify.env.get('CONTEXT')) ||
  'development'
export type Measurement = {
  userId?: string
  category: 'ai' | 'storage' | 'api' | 'frontend' | 'health'
  feature: string
  provider?: string
  model?: string
  status: string
  httpStatus?: number
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  bytes?: number
  fileType?: string
  code?: string
}
export async function issue(
  kind: 'error' | 'notification',
  category: string,
  feature: string,
  severity: string,
  message: string,
  httpStatus?: number,
) {
  const env = environment()
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([kind, category, feature, httpStatus, env, message]))
    .digest('hex')
  await pool().query(
    `INSERT INTO monitor_issues(id,fingerprint,kind,category,feature,severity,message,http_status,environment)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(fingerprint) DO UPDATE SET
    occurrences=monitor_issues.occurrences+1,last_seen=now(),
    read_at=CASE WHEN monitor_issues.resolved_at IS NOT NULL THEN NULL ELSE monitor_issues.read_at END,resolved_at=NULL`,
    [
      crypto.randomUUID(),
      fingerprint,
      kind,
      category,
      feature,
      severity,
      message,
      httpStatus ?? null,
      env,
    ],
  )
}
export async function measure(m: Measurement) {
  // Never pass exception messages or arbitrary client metadata to this function.
  try {
    await pool().query(
      `INSERT INTO monitor_events(id,user_id,category,feature,provider,model,status,http_status,duration_ms,input_tokens,output_tokens,cached_tokens,bytes,file_type,code,environment)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        crypto.randomUUID(),
        m.userId ?? null,
        m.category,
        m.feature,
        m.provider ?? null,
        m.model ?? null,
        m.status,
        m.httpStatus ?? null,
        m.durationMs == null ? null : Math.max(0, Math.round(m.durationMs)),
        m.inputTokens ?? null,
        m.outputTokens ?? null,
        m.cachedTokens ?? null,
        m.bytes ?? null,
        m.fileType ?? null,
        m.code ?? null,
        environment(),
      ],
    )
    if (m.status === 'failure')
      await issue(
        'error',
        m.category,
        m.feature,
        m.httpStatus && m.httpStatus < 500 ? 'low' : 'high',
        `${m.feature}: operation failed (${m.code || m.httpStatus || 'unavailable'}).`,
        m.httpStatus,
      )
  } catch {
    // Telemetry must never change the outcome of the student's operation.
  }
}
export const defaults = {
  failedLogins: 10,
  authorizationFailures: 20,
  apiErrors: 20,
  uploadFailures: 5,
  aiFailures: 5,
  aiDailyRequests: 500,
  requestVolume: 1000,
  adminActions: 50,
  slowMs: 2000,
  storageQuotaBytes: 0,
  storageWarningPercent: 80,
  pricing: [] as {
    provider: string
    model: string
    input: number
    output: number
    cached: number
  }[],
}
export async function settings() {
  const { rows } = await pool().query(
    "SELECT value FROM admin_state WHERE key='monitor_settings'",
  )
  return { ...defaults, ...rows[0]?.value } as typeof defaults
}
export async function evaluateAlerts() {
  const config = await settings()
  const { rows } = await pool().query(`SELECT
    (SELECT count(*) FROM activity_events WHERE type='login.failed' AND created_at>now()-interval '15 minutes')::int AS logins,
    count(*) FILTER(WHERE category='api' AND http_status=403)::int AS authz,
    count(*) FILTER(WHERE category='api' AND http_status>=500)::int AS errors,
    count(*) FILTER(WHERE category='storage' AND feature='upload' AND status='failure')::int AS uploads,
    count(*) FILTER(WHERE category='ai' AND status='failure')::int AS ai,
    count(*) FILTER(WHERE category='api')::int AS volume,
    (SELECT count(*) FROM admin_audit WHERE created_at>now()-interval '15 minutes' AND action NOT IN ('admin.login','monitor.issue.read'))::int AS admins,
    (SELECT count(*) FROM monitor_events WHERE category='ai' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS daily_ai,
    (SELECT coalesce(sum(size),0) FROM documents)::float8 AS bytes
    FROM monitor_events WHERE created_at>now()-interval '15 minutes'`)
  const r = rows[0]
  if (!r) return
  const rules: [boolean, string, string, string][] = [
    [
      r.logins >= config.failedLogins,
      'security',
      'authentication',
      'Repeated failed login attempts in 15 minutes; review before drawing conclusions.',
    ],
    [
      r.authz >= config.authorizationFailures,
      'security',
      'authorization',
      'Repeated authorization failures in 15 minutes.',
    ],
    [
      r.errors >= config.apiErrors,
      'performance',
      'api',
      'API server failures exceeded the 15-minute threshold.',
    ],
    [
      r.uploads >= config.uploadFailures,
      'storage',
      'upload',
      'Upload failures exceeded the 15-minute threshold.',
    ],
    [
      r.ai >= config.aiFailures,
      'ai',
      'provider',
      'AI failures exceeded the 15-minute threshold.',
    ],
    [
      r.daily_ai >= config.aiDailyRequests,
      'ai',
      'usage',
      'Daily AI requests exceeded the configured threshold.',
    ],
    [
      r.volume >= config.requestVolume,
      'security',
      'request-volume',
      'Request volume exceeded the 15-minute threshold; review activity.',
    ],
    [
      r.admins >= config.adminActions,
      'security',
      'administration',
      'Administrative actions exceeded the 15-minute threshold; review audit logs.',
    ],
    [
      config.storageQuotaBytes > 0 &&
        (r.bytes / config.storageQuotaBytes) * 100 >=
          config.storageWarningPercent,
      'storage',
      'quota',
      'Stored document bytes approached the configured planning quota.',
    ],
  ]
  for (const [trigger, category, feature, message] of rules)
    if (trigger) {
      // One notification per condition. Increment at most once per hour, never per dashboard read.
      const recent = await pool().query(
        `SELECT id FROM monitor_issues WHERE kind='notification' AND category=$1 AND feature=$2 AND last_seen>now()-interval '1 hour'`,
        [category, feature],
      )
      if (!recent.rows.length)
        await issue('notification', category, feature, 'high', message)
    }
}

// Wrap APIs which have their own authorization lifecycle (login and administration).
export function observe<Args extends unknown[]>(
  feature: 'auth-access' | 'admin',
  handler: (req: Request, ...args: Args) => Promise<Response>,
) {
  return async (req: Request, ...args: Args) => {
    const started = performance.now()
    const response = await handler(req, ...args)
    await measure({
      category: 'api',
      feature,
      status: response.ok ? 'success' : 'failure',
      httpStatus: response.status,
      durationMs: performance.now() - started,
    })
    return response
  }
}
