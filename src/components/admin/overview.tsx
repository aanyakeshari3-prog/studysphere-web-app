import { Activity, ArrowUpRight, CircleHelp } from 'lucide-react'
import type { AdminOverview, AdminEvent } from '@/lib/admin-types'
import { features, pretty, date, num, Panel, Chart, Empty } from './admin-ui'
export function Overview({
  overview,
  section,
  setEvent,
}: {
  overview: AdminOverview
  section: string
  setEvent: (event: AdminEvent) => void
}) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <CircleHelp className="size-4 shrink-0" />
        <p>
          {overview.sync?.completedAt
            ? `Identity directory last synchronized ${date(overview.sync.completedAt)}.`
            : 'Account directory has not completed its initial sync. Totals cover indexed accounts only; the Owner can sync existing Identity accounts.'}{' '}
          Activity reports cover retained server events from instrumentation
          onward. Refreshes are excluded. Summary DAU is today; WAU and MAU use
          rolling 7 and 30 days. Registration week starts Monday.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['total_users', 'Registered users', 'Indexed Identity accounts'],
          ['dau', 'Active today', 'Unique users · UTC today'],
          ['range_events', 'Recorded activities', 'Events in selected range'],
          ['new_users', 'New registrations', 'Accounts in selected range'],
        ].map(([key, label, hint]) => (
          <div key={key} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              {label}
              <ArrowUpRight className="size-4 text-primary" />
            </div>
            <p className="my-4 text-3xl font-semibold tracking-tight">
              {num(overview.stats[key])}
            </p>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Chart
          title={
            section === 'analytics'
              ? 'Activities per day'
              : 'Daily active users'
          }
          days={overview.days}
          field={section === 'analytics' ? 'events' : 'active'}
        />
        <Chart
          title="Registration growth"
          days={overview.days}
          field="registrations"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Feature engagement"
          description="Successful events and distinct users · selected period"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  {['Feature', 'Events', 'Unique users', 'Adoption¹'].map(
                    (h) => (
                      <th key={h} className="px-5 py-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {features.map((f) => {
                  const v = overview.features.find((v) => v.feature === f)
                  return (
                    <tr key={f} className="border-t">
                      <td className="px-5 py-3 text-xs font-medium">
                        {pretty(f)}
                      </td>
                      <td className="px-5 py-3">{num(v?.events)}</td>
                      <td className="px-5 py-3">{num(v?.users)}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {overview.stats.total_users
                          ? `${(((v?.users || 0) / overview.stats.total_users) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-4 text-[10px] text-muted-foreground">
            ¹ Distinct feature users / indexed accounts. Flashcards are tracked
            per card; no separate deck entity exists. Uninstrumented features
            display zero recorded usage.
          </p>
        </Panel>
        <div className="space-y-5">
          <Panel
            title="New & returning"
            description="Unique active users in the selected range"
          >
            <div className="space-y-5 p-5">
              {[
                ['new_active_users', 'New active users'],
                ['returning_users', 'Returning users'],
                ['unique_users', 'All active users'],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className="flex justify-between border-b pb-3 text-sm"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <strong>{num(overview.stats[key])}</strong>
                </div>
              ))}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Returning users registered before the selected range. Users with
                unknown registration dates appear only in the total.
              </p>
            </div>
          </Panel>
          <Panel title="Account health">
            <dl className="space-y-4 p-5 text-sm">
              {[
                ['suspended', 'Suspended accounts'],
                ['unverified', 'Unverified accounts'],
              ].map(([k, l]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="font-semibold">{num(overview.stats[k])}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
      <Panel
        title="Engagement summary"
        description="Fixed windows · successful activity defines an active user"
      >
        <dl className="grid gap-5 p-5 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['wau', 'Active · 7 days'],
            ['mau', 'Active · 30 days'],
            ['registrations_today', 'Registrations today'],
            ['registrations_week', 'Registrations this week'],
            ['registrations_month', 'Registrations this month'],
            ['total_activities', 'All retained events'],
            ['activities_today', 'Events today'],
          ].map(([k, l]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className="mt-2 text-xl font-semibold">
                {num(overview.stats[k])}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel
        title="Recent activity"
        description="Latest retained events in the selected period"
      >
        {overview.recent.length ? (
          <div className="divide-y">
            {overview.recent.map((e) => (
              <button
                key={e.id}
                onClick={() => setEvent(e)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {pretty(e.type || '')}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.name || e.email || e.user_id || 'Unattributed account'}
                  </span>
                </span>
                <time className="text-xs text-muted-foreground">
                  {date(e.created_at)}
                </time>
              </button>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  )
}
