import { pool } from '../lib/admin-core'
// Fixed retention policy: 90 days of activity, 365 days of audit, no private content.
export default async () => {
  const db = pool()
  await db.query(
    "DELETE FROM activity_events WHERE created_at < now()-interval '90 days'",
  )
  await db.query(
    "DELETE FROM admin_audit WHERE created_at < now()-interval '365 days'",
  )
  await db.query(
    "DELETE FROM monitor_events WHERE created_at < now()-interval '90 days'",
  )
  await db.query(
    "DELETE FROM monitor_issues WHERE last_seen < now()-interval '90 days'",
  )
  await db.query(
    "DELETE FROM admin_state WHERE key LIKE 'security-resolution:%' AND (value->>'at')::timestamptz < now()-interval '90 days'",
  )
  await db.query('DELETE FROM admin_rate_limits WHERE expires_at < now()')
  await db.query(
    "DELETE FROM admin_state WHERE key LIKE 'admin-login:%' AND (value->>'at')::timestamptz < now()-interval '90 days'",
  )
  return new Response(null, { status: 204 })
}
export const config = { schedule: '0 3 * * *' }
