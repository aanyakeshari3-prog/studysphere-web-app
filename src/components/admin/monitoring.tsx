import { useEffect, useState } from 'react'
import {
  Activity,
  Download,
  ShieldCheck,
  Check,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Panel, Empty, Badge, Select, pretty, date, num } from './admin-ui'
import { toast } from 'sonner'
export const monitoringSections = [
  { id: 'ai', label: 'AI monitoring' },
  { id: 'storage', label: 'Storage monitoring' },
  { id: 'security', label: 'Security center' },
  { id: 'performance', label: 'Performance monitoring' },
  { id: 'errors', label: 'Error monitoring' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings', label: 'Admin settings' },
] as const
export type MonitoringSection = (typeof monitoringSections)[number]['id']
type Row = Record<string, string | number | null>
type Settings = {
  failedLogins: number
  authorizationFailures: number
  apiErrors: number
  uploadFailures: number
  aiFailures: number
  aiDailyRequests: number
  requestVolume: number
  adminActions: number
  slowMs: number
  storageQuotaBytes: number
  storageWarningPercent: number
  pricing: {
    provider: string
    model: string
    input: number
    output: number
    cached: number
  }[]
}
type Report = {
  rows: Row[]
  stats: Row
  days: Row[]
  months: Row[]
  groups: Row[]
  users: Row[]
  pricingNote: string
  slowMs: number
  health?: Row[]
  slowest?: Row[]
  storage?: {
    files: number
    bytes: number
    average_bytes: number
    uploaded_today: number
    uploaded_month: number
    quota: number | null
    consumers: Row[]
    types: Row[]
    monthly: Row[]
    history: Row[]
  }
}
const money = (v: unknown) =>
  v == null ? 'Unavailable' : '$' + Number(v).toFixed(6)
const bytes = (v: unknown) =>
  v == null
    ? 'Unavailable'
    : Number(v) < 1024
      ? `${v} B`
      : Number(v) < 1048576
        ? `${(Number(v) / 1024).toFixed(1)} KB`
        : `${(Number(v) / 1048576).toFixed(2)} MB`
function format(key: string, value: unknown) {
  if (value == null) return 'Unavailable'
  if (key.includes('cost')) return money(value)
  if (key.includes('bytes')) return bytes(value)
  if (
    key.endsWith('_at') ||
    [
      'created_at',
      'last_request',
      'last_upload',
      'last_seen',
      'read_at',
      'resolved_at',
    ].includes(key)
  )
    return date(String(value))
  if (key.endsWith('_ms')) return `${Number(value).toLocaleString()} ms`
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}
function DataTable({
  rows,
  columns,
  onRow,
}: {
  rows: Row[]
  columns: [string, string][]
  onRow?: (row: Row) => void
}) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b bg-muted/30 text-muted-foreground">
          <tr>
            {columns.map(([key, label]) => (
              <th key={key} className="whitespace-nowrap px-4 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={String(row.id || i)} className="hover:bg-muted/30">
              {columns.map(([key], j) => (
                <td key={key} className="max-w-64 break-words px-4 py-3">
                  {j === 0 && onRow ? (
                    <button
                      className="text-left font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => onRow(row)}
                    >
                      {format(key, row[key])}
                    </button>
                  ) : ['status', 'severity'].includes(key) ? (
                    <Badge value={String(row[key])} />
                  ) : (
                    format(key, row[key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No observed records match these filters." />
  )
}
function Trend({
  title,
  rows,
  field,
  label,
}: {
  title: string
  rows: Row[]
  field: string
  label: string
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[field] || 0)))
  return (
    <Panel title={title} description={label}>
      {rows.length ? (
        <div className="p-5">
          <div
            className="flex h-32 items-end gap-1 border-b"
            aria-label={title}
          >
            {rows.map((r, i) => (
              <div className="flex h-full min-w-0 flex-1 items-end" key={i}>
                <button
                  className="w-full rounded-t bg-primary/60 hover:bg-primary focus-visible:outline-2 focus-visible:outline-primary"
                  style={{
                    height: `${Math.max(2, (Number(r[field] || 0) / max) * 100)}%`,
                  }}
                  aria-label={`${r.date || r.month || r.type}: ${format(field, r[field])}`}
                  title={`${r.date || r.month || r.type}: ${format(field, r[field])}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
            <span>
              {String(rows[0].date || rows[0].month || 'Distribution')}
            </span>
            <span>{String(rows.at(-1)?.date || rows.at(-1)?.month || '')}</span>
          </div>
        </div>
      ) : (
        <Empty text="Charts populate as operations are recorded." />
      )}
    </Panel>
  )
}
export function Monitoring({
  section,
  refresh,
}: {
  section: MonitoringSection
  refresh: number
}) {
  const [report, setReport] = useState<Report | null>(null),
    [config, setConfig] = useState<Settings | null>(null)
  const [range, setRange] = useState('30'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    q: '',
    severity: '',
    status: '',
    category: '',
    feature: '',
    provider: '',
    user: '',
    sort: 'newest',
  })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<Row | null>(null)
  const params = new URLSearchParams({
    view: section,
    range,
    from,
    to,
    page: String(page),
    ...filters,
  }).toString()
  useEffect(() => {
    const abort = new AbortController()
    Promise.resolve().then(() => {
      if (!abort.signal.aborted) {
        setLoading(true)
        setError('')
      }
    })
    void api<Report & { settings: Settings }>(`/api/monitoring?${params}`, {
      signal: abort.signal,
    })
      .then((d) => {
        if (section === 'settings') setConfig(d.settings)
        else setReport(d)
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [params, section, refresh, revision])
  function filter(key: keyof typeof filters, value: string) {
    setFilters((v) => ({ ...v, [key]: value }))
    setPage(1)
  }
  async function action(action: string, id?: string) {
    setBusy(true)
    try {
      await api('/api/monitoring', {
        method: 'POST',
        body: JSON.stringify(
          action === 'settings' ? { action, value: config } : { action, id },
        ),
      })
      setRevision((r) => r + 1)
      setDetail(null)
      toast.success('Monitoring updated.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function download() {
    setBusy(true)
    try {
      const res = await fetch(`/api/monitoring?${params}&export=csv`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Export unavailable.')
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'studysphere-summary.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const isIssue = section === 'errors' || section === 'notifications'
  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-2xl border bg-primary/5 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-foreground">
            Owner operational intelligence
          </p>
          <p className="mt-1">
            Safe metadata only · UTC · 90-day retention. Monitoring begins at
            deployment; earlier operations have no timing or token history.
            Missing measurements are unavailable.
          </p>
        </div>
      </div>
      {section !== 'settings' && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Monitoring date range"
            value={range}
            onChange={(v) => {
              setRange(v)
              setPage(1)
            }}
            options={[
              ['1', 'Today'],
              ['7', 'Last 7 days'],
              ['30', 'Last 30 days'],
              ['90', 'Last 90 days'],
              ['custom', 'Custom range'],
            ]}
          />
          {range === 'custom' && (
            <>
              <Input
                type="date"
                aria-label="Monitoring start date"
                className="w-40"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPage(1)
                }}
              />
              <Input
                type="date"
                aria-label="Monitoring end date"
                className="w-40"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(1)
                }}
              />
            </>
          )}
          <Input
            className="w-52"
            aria-label="Search monitoring"
            placeholder="Search user, feature or error"
            value={filters.q}
            onChange={(e) => filter('q', e.target.value)}
          />
          <Input
            className="w-40"
            aria-label="Filter user ID"
            placeholder="User ID"
            value={filters.user}
            onChange={(e) => filter('user', e.target.value)}
          />
          <Input
            className="w-36"
            aria-label="Filter feature"
            placeholder="Exact feature"
            value={filters.feature}
            onChange={(e) => filter('feature', e.target.value)}
          />
          <Select
            label="Filter status"
            value={filters.status}
            onChange={(v) => filter('status', v)}
            options={[
              ['', 'All statuses'],
              ...(isIssue
                ? ['unresolved', 'resolved']
                : ['success', 'failure', 'unknown']
              ).map((v) => [v, pretty(v)] as [string, string]),
            ]}
          />
          <Select
            label="Filter severity"
            value={filters.severity}
            onChange={(v) => filter('severity', v)}
            options={[
              ['', 'All severities'],
              ...['informational', 'low', 'medium', 'high', 'critical'].map(
                (v) => [v, pretty(v)] as [string, string],
              ),
            ]}
          />
          <Select
            label="Filter category"
            value={filters.category}
            onChange={(v) => filter('category', v)}
            options={[
              ['', 'All categories'],
              ...[
                'ai',
                'storage',
                'api',
                'frontend',
                'health',
                'authentication',
                'account',
                'administration',
                'authorization',
              ].map((v) => [v, pretty(v)] as [string, string]),
            ]}
          />
          {section === 'ai' && (
            <Select
              label="Filter provider"
              value={filters.provider}
              onChange={(v) => filter('provider', v)}
              options={[
                ['', 'All providers'],
                ['openai', 'OpenAI'],
              ]}
            />
          )}
          <Select
            label="Sort monitoring"
            value={filters.sort}
            onChange={(v) => filter('sort', v)}
            options={[
              ['newest', 'Newest first'],
              ['oldest', 'Oldest first'],
              ['duration', 'Slowest first'],
              ['name', 'Users: name A–Z'],
              ['tokens', 'Users: most tokens'],
              ['cost', 'Users: highest estimated cost'],
            ]}
          />
          {!isIssue && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || loading}
              onClick={() => void download()}
            >
              <Download className="mr-2 size-3" />
              Export summary
            </Button>
          )}
        </div>
      )}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-5 text-sm"
        >
          {error}
          <Button variant="ghost" onClick={() => setRevision((r) => r + 1)}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-36 rounded-xl" key={i} />
          ))}
        </div>
      ) : section === 'settings' && config ? (
        <Panel
          title="Alert policy & cost estimates"
          description="Persistent owner settings. Alerts run every 15 minutes on published deploys; repeated conditions are grouped."
        >
          <form
            className="space-y-6 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              void action('settings')
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(config)
                .filter(([k]) => k !== 'pricing')
                .map(([key, value]) => (
                  <label key={key} className="text-xs text-muted-foreground">
                    {pretty(key.replace(/([A-Z])/g, ' $1'))}
                    <Input
                      className="mt-2"
                      type="number"
                      min={key === 'storageQuotaBytes' ? 0 : 1}
                      required
                      value={Number(value)}
                      onChange={(e) =>
                        setConfig({ ...config, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Login, authorization, API, upload, request volume and
              administrative action thresholds apply to 15-minute windows. AI
              daily requests use UTC days. Storage quota is an optional planning
              limit in bytes (0 disables it), not a provider-reported allowance.
            </p>
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">OpenAI · gpt-4.1-mini</h3>
              <p className="text-xs text-muted-foreground">
                Optional USD rates per million tokens. Enter your verified
                effective pricing. Empty pricing means cost is unavailable.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.pricing.length > 0}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pricing: e.target.checked
                        ? [
                            {
                              provider: 'openai',
                              model: 'gpt-4.1-mini',
                              input: 0,
                              output: 0,
                              cached: 0,
                            },
                          ]
                        : [],
                    })
                  }
                />
                Configure model pricing
              </label>
              {config.pricing[0] && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {(['input', 'output', 'cached'] as const).map((key) => (
                    <label className="text-xs" key={key}>
                      {pretty(key)} USD / million
                      <Input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.000001"
                        required
                        value={config.pricing[0][key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            pricing: [
                              {
                                ...config.pricing[0],
                                [key]: Number(e.target.value),
                              },
                            ],
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button disabled={busy}>
              {busy ? 'Saving…' : 'Save monitoring settings'}
            </Button>
          </form>
        </Panel>
      ) : (
        report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(section === 'ai'
                ? [
                    ['Requests in period', num(Number(report.stats.total))],
                    [
                      'Successful / failed',
                      `${num(Number(report.stats.successful))} / ${num(Number(report.stats.failed))}`,
                    ],
                    [
                      'Today / week / month',
                      `${report.stats.today} / ${report.stats.this_week} / ${report.stats.this_month}`,
                    ],
                    [
                      'Average AI duration',
                      format('average_ms', report.stats.average_ms),
                    ],
                    [
                      'Input / output tokens',
                      `${format('tokens', report.stats.input_tokens)} / ${format('tokens', report.stats.output_tokens)}`,
                    ],
                    [
                      'Total known tokens',
                      report.stats.input_tokens == null ||
                      report.stats.output_tokens == null
                        ? 'Unavailable'
                        : num(
                            Number(report.stats.input_tokens) +
                              Number(report.stats.output_tokens),
                          ),
                    ],
                    [
                      'Estimated cost · USD',
                      money(report.stats.estimated_cost),
                    ],
                    [
                      'Priced / metered requests',
                      `${report.stats.priced_requests} / ${report.stats.metered_requests}`,
                    ],
                  ]
                : section === 'storage' && report.storage
                  ? [
                      ['Stored bytes · current', bytes(report.storage.bytes)],
                      ['Current files', num(report.storage.files)],
                      [
                        'Recorded uploads today / month',
                        `${report.storage.uploaded_today} / ${report.storage.uploaded_month}`,
                      ],
                      [
                        'Average current file size',
                        bytes(report.storage.average_bytes),
                      ],
                      [
                        'Failed operations in period',
                        num(Number(report.stats.failed)),
                      ],
                      [
                        'Configured planning quota',
                        report.storage.quota
                          ? bytes(report.storage.quota)
                          : 'Not configured',
                      ],
                      [
                        'Planning quota used',
                        report.storage.quota
                          ? `${((report.storage.bytes / report.storage.quota) * 100).toFixed(1)}%`
                          : 'Unavailable',
                      ],
                      ['Upload/delete events', num(Number(report.stats.total))],
                    ]
                  : isIssue
                    ? [
                        ['Grouped records', String(report.stats.total)],
                        ['Unresolved', String(report.stats.unresolved)],
                        ['Unread', String(report.stats.unread)],
                        ['Recorded today', String(report.stats.today)],
                      ]
                    : [
                        [
                          'Observed operations',
                          num(Number(report.stats.total)),
                        ],
                        ['Failed operations', num(Number(report.stats.failed))],
                        [
                          'Average duration',
                          format('average_ms', report.stats.average_ms),
                        ],
                        [
                          'Slow operations',
                          `${report.stats.slow} (> ${report.slowMs} ms)`,
                        ],
                        ...(section === 'performance'
                          ? [
                              [
                                'Frontend reports',
                                String(report.stats.frontend_errors),
                              ],
                              [
                                'Backend failures',
                                String(report.stats.backend_errors),
                              ],
                            ]
                          : []),
                      ]
              ).map(([label, value]) => (
                <div
                  className="rounded-2xl border bg-card px-5 py-5"
                  key={label}
                >
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-3 break-words text-xl font-bold tracking-tight tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            {section === 'ai' && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {report.pricingNote} Counts reflect selected dates and filters,
                including the today/week/month cards. Tokens cover only requests
                with provider usage metadata.
              </p>
            )}
            {section === 'security' && (
              <div className="rounded-xl border p-4 text-xs leading-relaxed text-muted-foreground">
                Security events reuse verified server login, registration,
                verification, recovery request and admin audit records. Failed
                login counts cover this application's sign-in endpoint. Session
                expiration, completed resets and provider-wide failed logins are
                unavailable from current hooks. Suspicious-volume alerts are
                review signals, not findings of malicious activity. Suspend or
                reactivate accounts in{' '}
                <a className="text-primary underline" href="/admin/users">
                  User management
                </a>
                ; all APIs enforce suspension. Provider session revocation is
                unavailable in the current integration.
              </div>
            )}
            {section === 'performance' && (
              <Panel
                title="Service observations"
                description="Scheduled probes every 15 minutes on published deploys. Observations older than 30 minutes are stale. A successful probe is scoped to the operation described."
              >
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    'authentication',
                    'database',
                    'storage',
                    'ai-provider',
                    'backend-functions',
                    'application',
                  ].map((service) => {
                    const r = report.health?.find((h) => h.feature === service)
                    const stale =
                      !r ||
                      Date.now() - Date.parse(String(r.created_at)) > 1800000
                    return (
                      <div key={service} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {pretty(service)}
                          </span>
                          <Badge value={stale ? 'unknown' : String(r.status)} />
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {r ? date(String(r.created_at)) : 'No probe recorded'}
                          {stale && r ? ' · Stale' : ''}
                        </p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {
                            {
                              authentication: 'Identity settings read',
                              database: 'SELECT 1 query',
                              storage: 'Blobs list probe',
                              'ai-provider':
                                'Latest real AI request in 15 minutes',
                              'backend-functions':
                                'Scheduled function execution',
                              application: 'HTTP request to application root',
                            }[service]
                          }
                        </p>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )}
            <div className="grid gap-5 xl:grid-cols-2">
              <Trend
                title={
                  section === 'storage'
                    ? 'Daily successful upload bytes'
                    : 'Daily operation volume'
                }
                rows={report.days}
                field={section === 'storage' ? 'bytes' : 'events'}
                label="Observed activity in selected period · UTC"
              />
              <Trend
                title={
                  section === 'ai'
                    ? 'Daily estimated AI cost'
                    : section === 'storage'
                      ? 'Daily upload and deletion events'
                      : 'Daily failures'
                }
                rows={report.days}
                field={
                  section === 'ai'
                    ? 'estimated_cost'
                    : section === 'storage'
                      ? 'events'
                      : 'failed'
                }
                label={
                  section === 'ai'
                    ? 'Current configured pricing · USD'
                    : 'Observed activity · UTC'
                }
              />
            </div>
            {section === 'ai' && (
              <>
                <Trend
                  title="Monthly AI usage"
                  rows={report.months}
                  field="events"
                  label="Recorded requests by month · UTC"
                />
                <Trend
                  title="Monthly estimated AI cost"
                  rows={report.months}
                  field="estimated_cost"
                  label="Current configured pricing · USD"
                />
                <Panel
                  title="Per-user AI usage"
                  description="25 users per page. User sorting, search and date filters apply."
                >
                  <DataTable
                    rows={report.users}
                    columns={[
                      ['user_id', 'User ID'],
                      ['name', 'Name'],
                      ['requests', 'Requests'],
                      ['successful', 'Successful'],
                      ['failed', 'Failed'],
                      ['tokens', 'Known tokens'],
                      ['estimated_cost', 'Estimated USD'],
                      ['last_request', 'Last request'],
                    ]}
                  />
                </Panel>
                <Panel
                  title="Actual AI actions & models"
                  description="Only observed action names appear. No prompts or responses are stored."
                >
                  <DataTable
                    rows={report.groups}
                    columns={[
                      ['feature', 'Action'],
                      ['provider', 'Provider'],
                      ['model', 'Model'],
                      ['events', 'Requests'],
                      ['failed', 'Failed'],
                      ['average_ms', 'Average'],
                      ['tokens', 'Known tokens'],
                      ['estimated_cost', 'Estimated USD'],
                    ]}
                  />
                </Panel>
              </>
            )}
            {section === 'storage' && report.storage && (
              <>
                <Panel
                  title="Recorded monthly storage change"
                  description="Successful upload bytes minus deletion bytes observed since monitoring began. Account cleanup and pre-monitoring history are excluded."
                >
                  <DataTable
                    rows={report.months}
                    columns={[
                      ['month', 'Month'],
                      ['net_bytes', 'Observed net change'],
                    ]}
                  />
                </Panel>
                <div className="grid gap-5 xl:grid-cols-2">
                  <Trend
                    title="Observed storage consumption"
                    rows={report.storage.history}
                    field="bytes"
                    label="Last daily inventory sample · current document bytes · starts on published deployment"
                  />
                  <Trend
                    title="Current file type distribution"
                    rows={report.storage.types}
                    field="bytes"
                    label="Current document metadata · bytes per MIME type"
                  />
                </div>
                <Panel
                  title="Current storage consumers"
                  description="25 users per page, ranked by current stored bytes; user search applies. Current snapshot, independent of date filters."
                >
                  <DataTable
                    rows={report.storage.consumers}
                    columns={[
                      ['user_id', 'User ID'],
                      ['name', 'Name'],
                      ['files', 'Files'],
                      ['bytes', 'Stored bytes'],
                      ['last_upload', 'Last upload'],
                    ]}
                  />
                </Panel>
                <Panel
                  title="File types"
                  description="No filenames, content, or download links."
                >
                  <DataTable
                    rows={report.storage.types}
                    columns={[
                      ['type', 'MIME type'],
                      ['files', 'Files'],
                      ['bytes', 'Stored bytes'],
                    ]}
                  />
                </Panel>
                <p className="text-xs text-muted-foreground">
                  Provider quota and object-level billing are unavailable.
                  Inventory counts include currently retained files; daily
                  operation charts include new uploads and deletions recorded
                  after monitoring began. Monthly retained bytes are not
                  historical net storage growth.
                </p>
              </>
            )}
            {section === 'performance' && (
              <>
                <Trend
                  title="Average response duration"
                  rows={report.days}
                  field="average_ms"
                  label="Milliseconds, measured server handler duration including authorization and database access"
                />
                <Panel
                  title="Slowest endpoints"
                  description="Actual server handler measurements. Failure percentage includes HTTP 4xx and 5xx. Database query-level timings are not instrumented."
                >
                  <DataTable
                    rows={report.slowest || []}
                    columns={[
                      ['feature', 'Endpoint'],
                      ['requests', 'Requests'],
                      ['average_ms', 'Average'],
                      ['max_ms', 'Maximum'],
                      ['failure_percent', 'Failed %'],
                    ]}
                  />
                </Panel>
              </>
            )}
            <Panel
              title={isIssue ? 'Grouped records' : 'Operational events'}
              description={
                isIssue
                  ? 'Open a record for safe details and resolution controls. Counts group repeated events by category, feature, status and environment.'
                  : '25 records per page · All filters apply'
              }
            >
              <DataTable
                rows={report.rows}
                onRow={setDetail}
                columns={
                  isIssue
                    ? [
                        ['code', 'Safe message'],
                        ['category', 'Category'],
                        ['severity', 'Severity'],
                        ['occurrences', 'Occurrences'],
                        ['created_at', 'Last seen'],
                        ['status', 'Resolution'],
                      ]
                    : [
                        ['feature', 'Feature / event'],
                        ['user_id', 'User ID'],
                        ['status', 'Result'],
                        ['duration_ms', 'Duration'],
                        ['http_status', 'HTTP'],
                        ['created_at', 'Timestamp'],
                        ...(section === 'security'
                          ? [['resolution', 'Resolution'] as [string, string]]
                          : []),
                      ]
                }
              />
              <div className="flex items-center justify-between border-t p-4">
                <span className="text-xs text-muted-foreground">
                  Page {page} · {report.stats.total} matching events
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      report.rows.length < 25 &&
                      report.users.length < 25 &&
                      (report.storage?.consumers.length || 0) < 25
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </Panel>
          </>
        )
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Operational record</DialogTitle>
            <DialogDescription>
              Safe technical metadata. Frontend reports are client-reported and
              do not prove a backend incident.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              <dl className="grid grid-cols-2 gap-4 text-xs">
                {Object.entries(detail)
                  .filter(([, v]) => v != null)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{pretty(key)}</dt>
                      <dd className="mt-1 break-all">{format(key, value)}</dd>
                    </div>
                  ))}
              </dl>
              {section === 'security' && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      detail.resolution === 'resolved'
                        ? 'reopen_security'
                        : 'resolve_security',
                      String(detail.id),
                    )
                  }
                >
                  {detail.resolution === 'resolved'
                    ? 'Reopen security event'
                    : 'Resolve security event'}
                </Button>
              )}
              {isIssue && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void action('read', String(detail.id))}
                  >
                    <Bell className="mr-2 size-4" />
                    Mark read
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(
                        detail.status === 'resolved' ? 'reopen' : 'resolve',
                        String(detail.id),
                      )
                    }
                  >
                    <Check className="mr-2 size-4" />
                    {detail.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Activity className="size-3" />
        Notifications are evaluated every 15 minutes; resolution actions are
        audited. No email delivery is configured.
      </p>
    </div>
  )
}
