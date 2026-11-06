import { useState } from 'react'
import { Activity } from 'lucide-react'
import type { AdminOverview } from '@/lib/admin-types'
export const features = [
  'notes',
  'documents',
  'ai',
  'flashcards',
  'tasks',
  'search',
  'study-tools',
  'authentication',
  'settings',
  'account',
]
export const pretty = (s: string) =>
  s.replace(/[._-]/g, ' ').replace(/^./, (c) => c.toUpperCase())
export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString() : 'Not recorded'
export const num = (v: number | undefined) => (v ?? 0).toLocaleString()
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="h-10 max-w-full rounded-xl border bg-card px-3 text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
export function Empty({
  text = 'No records in this view.',
}: {
  text?: string
}) {
  return (
    <div className="grid min-h-44 place-content-center gap-3 p-8 text-center text-sm text-muted-foreground">
      <Activity className="mx-auto size-7 opacity-40" />
      <p>{text}</p>
    </div>
  )
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${['success', 'active', 'owner'].includes(value) ? 'bg-success/10 text-success' : ['failure', 'suspended', 'deleting'].includes(value) ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}
    >
      {pretty(value)}
    </span>
  )
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}
export function Chart({
  title,
  days,
  field,
}: {
  title: string
  days: AdminOverview['days']
  field: 'active' | 'events' | 'registrations'
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d[field])),
    total = days.reduce((s, d) => s + d[field], 0)
  return (
    <Panel
      title={title}
      description={
        field === 'registrations'
          ? 'Accounts created each day · UTC'
          : field === 'active'
            ? 'Distinct users with successful recorded actions · UTC'
            : 'Recorded event rows each day · UTC'
      }
    >
      {total === 0 ? (
        <Empty text="No recorded data for this period." />
      ) : (
        <div className="p-5">
          <div className="mb-4 flex min-h-6 justify-between text-xs text-muted-foreground">
            <span>
              {selected === null
                ? 'Hover or focus a day for details'
                : `${days[selected]?.date}: ${num(days[selected]?.[field])}`}
            </span>
            <span>Peak {num(max)}</span>
          </div>
          <div
            className="flex h-40 items-end gap-px border-b"
            role="group"
            aria-label={title}
          >
            {days.map((d, i) => (
              <button
                key={d.date}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={() => setSelected(i)}
                className="group flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={`${d.date}: ${d[field]}`}
                title={`${d.date}: ${d[field]}`}
              >
                <span
                  className={`block w-full max-w-7 rounded-t-sm transition-colors ${selected === i ? 'bg-primary' : 'bg-primary/55 group-hover:bg-primary'}`}
                  style={{ height: `${Math.max(2, (d[field] / max) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
            <span>{days[0]?.date}</span>
            <span>{days.at(-1)?.date}</span>
          </div>
        </div>
      )}
    </Panel>
  )
}
