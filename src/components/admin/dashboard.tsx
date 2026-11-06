import {
  Monitoring,
  monitoringSections,
  type MonitoringSection,
} from './monitoring'
import { useNavigate } from '@tanstack/react-router'
import {
  features,
  pretty,
  date,
  num,
  Panel,
  Empty,
  Badge,
  Select,
} from './admin-ui'
import { Overview } from './overview'
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AdminUser, AdminEvent, AdminOverview } from '@/lib/admin-types'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/logo'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

type Section =
  MonitoringSection | 'overview' | 'users' | 'events' | 'analytics' | 'audit'
const sections: { id: Section; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User management', icon: Users },
  { id: 'events', label: 'Activity logs', icon: Activity },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ...monitoringSections
    .filter((s) => !['notifications', 'settings'].includes(s.id))
    .map((s) => ({ ...s, icon: Activity })),
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit logs', icon: ShieldCheck },
  { id: 'settings', label: 'Admin settings', icon: ShieldCheck },
]
const sectionPaths = {
  overview: '/admin',
  users: '/admin/users',
  events: '/admin/activity',
  analytics: '/admin/analytics',
  audit: '/admin/audit',
} as const
export function AdminDashboard({
  initialSection = 'overview',
  initialUserId,
  initialUserFilter,
}: {
  initialSection?: Section
  initialUserId?: string
  initialUserFilter?: string
} = {}) {
  const routeNavigate = useNavigate()
  const { signOut } = useAuth(),
    { prefs, updatePrefs } = useStore()
  const [me, setMe] = useState<{
    id: string
    role: string
    name: string
    email: string
  } | null>(null)
  const [accessError, setAccessError] = useState(''),
    [section, setSection] = useState<Section>(() => {
      const selected =
        typeof window === 'undefined'
          ? null
          : new URLSearchParams(window.location.search).get('section')
      return monitoringSections.some((s) => s.id === selected)
        ? (selected as MonitoringSection)
        : initialSection
    }),
    [mobile, setMobile] = useState(false)
  const [range, setRange] = useState('30'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('')
  const [q, setQ] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [sort, setSort] = useState('newest'),
    [feature, setFeature] = useState(''),
    [status, setStatus] = useState(''),
    [type, setType] = useState(''),
    [userFilter, setUserFilter] = useState(initialUserFilter || '')
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null),
    [rows, setRows] = useState<(AdminUser | AdminEvent)[]>([]),
    [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<{
      user: AdminUser
      features: { feature: string; events: number }[]
      security: AdminEvent[]
    } | null>(null),
    [detailLoading, setDetailLoading] = useState(!!initialUserId)
  const [event, setEvent] = useState<AdminEvent | null>(null),
    [action, setAction] = useState<{
      user: AdminUser
      action: string
      role?: string
    } | null>(null),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [syncing, setSyncing] = useState(false)
  const [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    void api<typeof me>('/api/admin?view=me', { signal: abort.signal })
      .then((m) => {
        setMe(m)
        void api('/api/admin', {
          method: 'POST',
          body: JSON.stringify({ action: 'visit' }),
        }).catch(() => {})
      })
      .catch((e) => {
        if (!abort.signal.aborted) setAccessError(e.message)
      })
    return () => abort.abort()
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])
  useEffect(() => {
    if (!me || monitoringSections.some((s) => s.id === section)) return
    const abort = new AbortController(),
      params = new URLSearchParams({
        view: section,
        range,
        from,
        to,
        q: query,
        filter,
        sort,
        feature,
        status,
        type,
        user: userFilter,
        page: String(page),
      })
    // Synchronize loading state with the asynchronous request lifecycle.
    Promise.resolve().then(() => {
      if (!abort.signal.aborted) {
        setLoading(true)
        setError('')
      }
    })
    void api<
      AdminOverview & { rows: (AdminUser | AdminEvent)[]; total: number }
    >(`/api/admin?${params}`, { signal: abort.signal })
      .then((data) => {
        if (section === 'overview' || section === 'analytics') setOverview(data)
        else {
          setRows(data.rows)
          setTotal(data.total)
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [
    me,
    section,
    range,
    from,
    to,
    query,
    filter,
    sort,
    feature,
    status,
    type,
    userFilter,
    page,
    refresh,
  ])
  useEffect(() => {
    if (!me || !initialUserId) return
    const abort = new AbortController()
    void api<{
      user: AdminUser
      features: { feature: string; events: number }[]
      security: AdminEvent[]
    }>(`/api/admin?view=user&id=${encodeURIComponent(initialUserId)}`, {
      signal: abort.signal,
    })
      .then(setDetail)
      .catch((e) => {
        if (!abort.signal.aborted) toast.error(e.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setDetailLoading(false)
      })
    return () => abort.abort()
  }, [me, initialUserId])
  function navigate(next: Section) {
    if (monitoringSections.some((s) => s.id === next)) {
      window.location.assign('/admin?section=' + next)
      return
    }
    void routeNavigate({ to: sectionPaths[next as keyof typeof sectionPaths] })
    setSection(next)
    setPage(1)
    setQ('')
    setFilter('all')
    setType('')
    setStatus('')
    setFeature('')
    setUserFilter('')
    setMobile(false)
    setDetail(null)
  }
  function loadUser(user: AdminUser) {
    void routeNavigate({
      to: '/admin/users/$userId',
      params: { userId: user.id },
    })
  }
  async function manage() {
    if (!action) return
    setBusy(true)
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: action.action,
          id: action.user.id,
          confirmation,
          role: action.role,
        }),
      })
      toast.success('Account updated.')
      setAction(null)
      setDetail(null)
      setRefresh((v) => v + 1)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function sync() {
    setSyncing(true)
    let page = 1
    try {
      while (page) {
        const data = await api<{ nextPage: number | null }>('/api/admin', {
          method: 'POST',
          body: JSON.stringify({ action: 'sync', page }),
        })
        page = data.nextPage || 0
      }
      toast.success('Identity directory synchronized.')
      setRefresh((v) => v + 1)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }
  if (accessError)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8">
          <ShieldCheck className="mb-5 size-10 text-primary" />
          <h1 className="text-2xl font-bold">Administration access</h1>
          <p role="alert" className="my-4 text-sm text-muted-foreground">
            {accessError}
          </p>
          <p className="mb-6 text-xs text-muted-foreground">
            Access requires a server-authorized Admin role or the explicitly
            configured Owner account.
          </p>
          <a href="/" className="text-sm font-semibold text-primary">
            Return to StudySphere
          </a>
        </div>
      </main>
    )
  if (!me)
    return (
      <div className="space-y-5 p-10">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  const current = sections.find((s) => s.id === section)!
  const canAct = (u: AdminUser) =>
    u.role !== 'owner' &&
    u.id !== me.id &&
    (me.role === 'owner' || u.role === 'student')
  const nav = (
    <>
      <a href="/" className="mb-8 block px-3">
        <Logo />
      </a>
      <p className="mb-3 px-3 text-[10px] font-bold tracking-[.2em] text-muted-foreground">
        CONTROL CENTER
      </p>
      <nav aria-label="Administration" className="space-y-1">
        {sections
          .filter(
            (s) =>
              me.role === 'owner' ||
              !monitoringSections.some((m) => m.id === s.id),
          )
          .map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(s.id)}
              aria-current={section === s.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${section === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <s.icon className="size-4" />
              {s.label}
              {section === s.id && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
      </nav>
      <div className="mt-auto rounded-xl border bg-background/60 p-4">
        <ShieldCheck className="mb-2 size-5 text-primary" />
        <p className="text-xs font-semibold">Private by design</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Usage metadata only. Student content stays private.
        </p>
      </div>
      <a
        className="mt-5 flex items-center gap-2 px-3 text-xs text-muted-foreground"
        href="/"
      >
        <ArrowLeft className="size-3" /> Back to study space
      </a>
    </>
  )
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r bg-card p-5 lg:flex">
        {nav}
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 flex bg-background/70 lg:hidden">
          <aside className="flex h-full w-72 flex-col overflow-y-auto border-r bg-card p-5">
            <Button
              variant="ghost"
              size="icon"
              className="mb-4 self-end"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            >
              <X />
            </Button>
            {nav}
          </aside>
          <button
            aria-label="Close navigation backdrop"
            className="flex-1"
            onClick={() => setMobile(false)}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center gap-3 border-b bg-card px-5 sm:px-8">
          <Button
            className="lg:hidden"
            variant="ghost"
            size="icon"
            aria-label="Open administration navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </Button>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <button onClick={() => navigate('overview')}>Admin</button>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{current.label}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Badge value={me.role} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() =>
                updatePrefs({
                  theme: prefs.theme === 'dark' ? 'light' : 'dark',
                })
              }
            >
              {prefs.theme === 'dark' ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() =>
                  me.role === 'owner'
                    ? navigate('notifications')
                    : setNotifications(!notifications)
                }
              >
                <Bell className="size-4" />
              </Button>
              {notifications && (
                <div className="absolute right-0 z-20 w-72 rounded-xl border bg-card p-4 text-xs shadow-lg">
                  <p className="font-semibold">System notices</p>
                  <p className="mt-2 text-muted-foreground">
                    Activity retention: 90 days. Audit retention: 365 days. All
                    report dates use UTC.
                  </p>
                </div>
              )}
            </div>
            <div className="relative">
              <Button
                variant="outline"
                className="max-w-40 truncate rounded-full"
                aria-label="Profile menu"
                aria-expanded={profile}
                onClick={() => setProfile(!profile)}
              >
                {me.name}
              </Button>
              {profile && (
                <div className="absolute right-0 z-20 w-64 rounded-xl border bg-card p-4 shadow-lg">
                  <p className="break-all text-xs text-muted-foreground">
                    {me.email}
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-2 w-full justify-start"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-[.2em] text-primary">
                STUDYSPHERE / ADMINISTRATION
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                {current.label}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {section === 'overview'
                  ? 'A clear view of your learning community.'
                  : section === 'users'
                    ? 'Manage accounts with care and confidence.'
                    : section === 'analytics'
                      ? 'Understand engagement through recorded actions.'
                      : section === 'audit'
                        ? 'A separate record of privileged operations.'
                        : 'Explore the actions behind the numbers.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefresh((v) => v + 1)}
                disabled={
                  loading && !monitoringSections.some((s) => s.id === section)
                }
              >
                <RefreshCw
                  className={`mr-2 size-3.5 ${loading && !monitoringSections.some((s) => s.id === section) ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              {me.role === 'owner' && (
                <Button
                  size="sm"
                  onClick={() => void sync()}
                  disabled={syncing}
                >
                  {syncing ? 'Synchronizing…' : 'Sync accounts'}
                </Button>
              )}
            </div>
          </div>
          {monitoringSections.some((s) => s.id === section) ? (
            me.role === 'owner' ? (
              <Monitoring
                key={section}
                section={section as MonitoringSection}
                refresh={refresh}
              />
            ) : (
              <p role="alert">Owner access required.</p>
            )
          ) : (
            <>
              {section !== 'users' && (
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    label="Report date range"
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
                        aria-label="Start date"
                        className="w-40"
                        type="date"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value)
                          setPage(1)
                        }}
                      />
                      <span className="text-xs">to</span>
                      <Input
                        aria-label="End date"
                        className="w-40"
                        type="date"
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value)
                          setPage(1)
                        }}
                      />
                    </>
                  )}
                  <span className="text-xs text-muted-foreground">
                    UTC · Metadata only
                  </span>
                </div>
              )}
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"
                >
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRefresh((v) => v + 1)}
                  >
                    Retry
                  </Button>
                </div>
              ) : loading ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-36 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <>
                  {(section === 'overview' || section === 'analytics') &&
                    overview && (
                      <Overview
                        overview={overview}
                        section={section}
                        setEvent={setEvent}
                      />
                    )}
                  {['users', 'events', 'audit'].includes(section) && (
                    <Panel
                      title={current.label}
                      description={`${num(total)} matching records · 25 per page`}
                    >
                      <div className="flex flex-wrap gap-3 border-b p-4">
                        <div className="relative min-w-48 flex-1">
                          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
                          <Input
                            aria-label="Search users"
                            className="pl-9"
                            placeholder="Search name, email, or user ID"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                          />
                        </div>
                        {section === 'users' ? (
                          <>
                            <Select
                              label="Account filter"
                              value={filter}
                              onChange={(v) => {
                                setFilter(v)
                                setPage(1)
                              }}
                              options={[
                                'all',
                                'active',
                                'suspended',
                                'unverified',
                                'recent',
                                'admin',
                                'student',
                              ].map((v) => [
                                v,
                                v === 'recent'
                                  ? 'Registered in last 7 days'
                                  : pretty(v),
                              ])}
                            />
                            <Select
                              label="Sort accounts"
                              value={sort}
                              onChange={(v) => {
                                setSort(v)
                                setPage(1)
                              }}
                              options={[
                                ['newest', 'Newest registrations'],
                                ['oldest', 'Oldest registrations'],
                                ['name', 'Name A–Z'],
                                ['email', 'Email A–Z'],
                                ['active', 'Last active'],
                              ]}
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              aria-label="Exact event type"
                              className="w-48"
                              placeholder="Exact type, e.g. note.created"
                              value={type}
                              onChange={(e) => {
                                setType(e.target.value)
                                setPage(1)
                              }}
                            />
                            {section === 'events' && (
                              <Select
                                label="Feature filter"
                                value={feature}
                                onChange={(v) => {
                                  setFeature(v)
                                  setPage(1)
                                }}
                                options={[
                                  ['', 'All features'],
                                  ...features.map(
                                    (f) => [f, pretty(f)] as [string, string],
                                  ),
                                ]}
                              />
                            )}
                            <Select
                              label="Event result"
                              value={status}
                              onChange={(v) => {
                                setStatus(v)
                                setPage(1)
                              }}
                              options={[
                                ['', 'All results'],
                                ['success', 'Success'],
                                ['failure', 'Failure'],
                                ...(section === 'audit'
                                  ? [['pending', 'Pending'] as [string, string]]
                                  : []),
                              ]}
                            />
                            {userFilter && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setUserFilter('')
                                  void routeNavigate({
                                    to: '/admin/activity',
                                    search: { user: undefined },
                                  })
                                  setPage(1)
                                }}
                              >
                                Clear selected user
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      {!rows.length ? (
                        <Empty text="No records match these filters." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full whitespace-nowrap text-left text-xs">
                            <thead className="bg-muted/30 text-muted-foreground">
                              <tr>
                                {(section === 'users'
                                  ? [
                                      'Account / User ID',
                                      'Email',
                                      'Registered',
                                      'Last active',
                                      'Status',
                                      'Verified',
                                      'Role',
                                      'Actions',
                                    ]
                                  : [
                                      'User',
                                      'Activity',
                                      'Feature / category',
                                      'Date & time',
                                      'Result',
                                      'Details',
                                    ]
                                ).map((h) => (
                                  <th key={h} className="px-4 py-3 font-medium">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section === 'users'
                                ? (rows as AdminUser[]).map((u) => (
                                    <tr
                                      key={u.id}
                                      className="border-t hover:bg-muted/20"
                                    >
                                      <td className="px-4 py-4">
                                        <button
                                          onClick={() => void loadUser(u)}
                                          className="text-left font-semibold text-primary hover:underline"
                                        >
                                          {u.name || 'Unnamed account'}
                                        </button>
                                        <p
                                          className="mt-1 max-w-48 truncate font-mono text-[10px] text-muted-foreground"
                                          title={u.id}
                                        >
                                          {u.id}
                                        </p>
                                      </td>
                                      <td className="px-4 py-4">
                                        {u.email || '—'}
                                      </td>
                                      <td className="px-4 py-4 text-muted-foreground">
                                        {date(u.registered_at)}
                                      </td>
                                      <td className="px-4 py-4 text-muted-foreground">
                                        {date(u.last_active)}
                                      </td>
                                      <td className="px-4 py-4">
                                        <Badge value={u.status} />
                                      </td>
                                      <td className="px-4 py-4">
                                        {u.verified_at
                                          ? 'Verified'
                                          : 'Unverified'}
                                      </td>
                                      <td className="px-4 py-4">
                                        <Badge value={u.role} />
                                      </td>
                                      <td className="px-4 py-4">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => void loadUser(u)}
                                        >
                                          View account
                                        </Button>
                                      </td>
                                    </tr>
                                  ))
                                : (rows as AdminEvent[]).map((e) => (
                                    <tr
                                      key={e.id}
                                      className="border-t hover:bg-muted/20"
                                    >
                                      <td
                                        className="max-w-52 truncate px-4 py-4"
                                        title={e.user_id || e.admin_id}
                                      >
                                        {e.name ||
                                          e.email ||
                                          e.user_id ||
                                          e.admin_id ||
                                          'Unattributed account'}
                                      </td>
                                      <td className="px-4 py-4 font-medium">
                                        {pretty(e.type || e.action || '')}
                                      </td>
                                      <td className="px-4 py-4 text-muted-foreground">
                                        {pretty(e.feature || 'Administration')}
                                      </td>
                                      <td className="px-4 py-4 text-muted-foreground">
                                        {date(e.created_at)}
                                      </td>
                                      <td className="px-4 py-4">
                                        <Badge
                                          value={e.status || e.result || ''}
                                        />
                                      </td>
                                      <td className="px-4 py-4">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEvent(e)}
                                        >
                                          Details
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
                        <span>
                          Page {page} of {Math.max(1, Math.ceil(total / 25))}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            <ChevronLeft className="mr-1 size-4" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page * 25 >= total}
                            onClick={() => setPage((p) => p + 1)}
                          >
                            Next
                            <ChevronRight className="ml-1 size-4" />
                          </Button>
                        </div>
                      </div>
                    </Panel>
                  )}
                </>
              )}
              <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-[11px] text-muted-foreground">
                <span>
                  StudySphere administration · Access verified on the server
                </span>
                <span>Activity: 90 days · Audit: 365 days</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <Dialog
        open={!!detail || detailLoading}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null)
            setDetailLoading(false)
            void routeNavigate({ to: '/admin/users' })
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.user.name || 'Account details'}</DialogTitle>
            <DialogDescription>
              Account metadata and recorded usage. Private student content is
              excluded.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-64" />
          ) : (
            detail && (
              <>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  {[
                    ['User ID', detail.user.id],
                    ['Email', detail.user.email],
                    ['Role', pretty(detail.user.role)],
                    ['Status', pretty(detail.user.status)],
                    ['Registered', date(detail.user.registered_at)],
                    ['Last login', date(detail.user.last_login)],
                    ['Last active', date(detail.user.last_active)],
                    ['Email verified', date(detail.user.verified_at)],
                    [
                      'Total retained events',
                      num(detail.features.reduce((n, f) => n + f.events, 0)),
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="mt-1 break-all font-medium">{v || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.features.map((f) => (
                    <span
                      key={f.feature}
                      className="rounded-lg bg-muted px-3 py-2 text-xs"
                    >
                      {pretty(f.feature)}: {num(f.events)}
                    </span>
                  ))}
                </div>
                <h3 className="mt-4 text-sm font-semibold">
                  Recent security events
                </h3>
                {detail.security.length ? (
                  <ul className="divide-y">
                    {detail.security.map((e) => (
                      <li
                        key={e.id}
                        className="flex justify-between gap-3 py-2 text-xs"
                      >
                        <span>{pretty(e.type || '')}</span>
                        <span className="text-muted-foreground">
                          {date(e.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No retained security events.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = detail.user.id
                      void routeNavigate({
                        to: '/admin/activity',
                        search: { user: id },
                      })
                    }}
                  >
                    View activity
                  </Button>
                  {canAct(detail.user) && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAction({
                            user: detail.user,
                            action:
                              detail.user.status === 'suspended'
                                ? 'reactivate'
                                : 'suspend',
                          })
                          setConfirmation('')
                        }}
                        disabled={detail.user.status === 'deleting'}
                      >
                        {detail.user.status === 'suspended'
                          ? 'Reactivate'
                          : 'Suspend'}
                      </Button>
                      {me.role === 'owner' && (
                        <>
                          <Button
                            variant="outline"
                            disabled={detail.user.status === 'deleting'}
                            onClick={() => {
                              setAction({
                                user: detail.user,
                                action: 'role',
                                role:
                                  detail.user.role === 'admin'
                                    ? 'student'
                                    : 'admin',
                              })
                              setConfirmation('')
                            }}
                          >
                            Make{' '}
                            {detail.user.role === 'admin' ? 'Student' : 'Admin'}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setAction({
                                user: detail.user,
                                action: 'delete',
                              })
                              setConfirmation('')
                            }}
                          >
                            {detail.user.status === 'deleting'
                              ? 'Retry deletion'
                              : 'Delete account'}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.action === 'role'
                ? `Change role to ${action.role}`
                : `${pretty(action?.action || '')} account`}
            </DialogTitle>
            <DialogDescription>
              {action?.action === 'delete'
                ? 'Permanently removes the Identity account, workspace, uploaded files, and personal activity history. Security audit records retain IDs for up to 365 days. This cannot be undone. If cleanup fails the account stays blocked and deletion can be retried.'
                : action?.action === 'role'
                  ? 'This changes access to privileged administration operations. The Owner role cannot be assigned here.'
                  : 'Suspension blocks all server APIs and future logins. Reactivation restores access; it does not change existing data.'}
            </DialogDescription>
          </DialogHeader>
          <label className="text-xs text-muted-foreground">
            Type this user ID to confirm:{' '}
            <span className="block break-all py-2 font-mono text-foreground">
              {action?.user.id}
            </span>
            <Input
              autoComplete="off"
              aria-label="Confirm target user ID"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={action?.action === 'delete' ? 'destructive' : 'default'}
              disabled={busy || confirmation !== action?.user.id}
              onClick={() => void manage()}
            >
              {busy ? 'Applying…' : 'Confirm action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!event}
        onOpenChange={(open) => {
          if (!open) setEvent(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pretty(event?.type || event?.action || 'Event details')}
            </DialogTitle>
            <DialogDescription>
              Safe metadata recorded by the server.
            </DialogDescription>
          </DialogHeader>
          {event && (
            <dl className="space-y-3 text-xs">
              {[
                ['Event ID', event.id],
                [
                  'User / administrator',
                  event.user_id || event.admin_id || 'Unattributed account',
                ],
                ['Target', event.target_id || '—'],
                ['Timestamp', date(event.created_at)],
                ['Category', pretty(event.feature || 'Administration')],
                ['Result', event.status || event.result],
                ['Correlation ID', event.correlation_id || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="mt-1 break-all font-mono">{v}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">Metadata</dt>
                <dd>
                  <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}
