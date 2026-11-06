import { getSettings } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { pool } from '../lib/admin-core'
import { measure, issue, evaluateAlerts } from '../lib/monitoring'
export default async (_req: Request, context: Context) => {
  const check = async (feature: string, run: () => Promise<unknown>) => {
    const started = performance.now()
    let status = 'success'
    try {
      await run()
    } catch {
      status = 'failure'
    }
    await measure({
      category: 'health',
      feature,
      status,
      durationMs: performance.now() - started,
    })
    if (status === 'failure')
      await issue(
        'notification',
        'health',
        feature,
        'high',
        `${feature}: scheduled service probe failed.`,
      ).catch(() => {})
  }
  await Promise.allSettled([
    check('database', async () => {
      await pool().query('SELECT 1')
    }),
    check('authentication', async () => {
      await getSettings()
    }),
    check('storage', async () => {
      await getStore('study-documents').list({ prefix: '__health_probe__' })
    }),
    check('application', async () => {
      const res = await fetch(new URL('/', context.site.url), {
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      })
      if (!res.ok) throw new Error('Probe failed')
      await res.body?.cancel()
    }),
  ])
  // The AI provider is assessed from real operations, without generating billable probe requests.
  const { rows } = await pool().query(
    "SELECT status,duration_ms FROM monitor_events WHERE category='ai' AND created_at>now()-interval '15 minutes' ORDER BY created_at DESC LIMIT 1",
  )
  await measure({
    category: 'health',
    feature: 'ai-provider',
    status: rows[0]?.status || 'unknown',
    durationMs: rows[0]?.duration_ms,
  })
  await measure({
    category: 'health',
    feature: 'backend-functions',
    status: 'success',
  })
  const inventory = await pool().query(
    'SELECT coalesce(sum(size),0)::float8 AS bytes FROM documents',
  )
  await measure({
    category: 'health',
    feature: 'storage-inventory',
    status: 'success',
    bytes: Number(inventory.rows[0].bytes),
  })
  await evaluateAlerts()
  return new Response(null, { status: 204 })
}
export const config = { schedule: '*/15 * * * *' }
