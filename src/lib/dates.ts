import type { Weekday } from './types'

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Monday-based weekday index for a date. */
export function weekdayIndex(date: Date = new Date()): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(d, -weekdayIndex(d))
}

/** Whole days from today until the given date key (negative = past). */
export function daysUntil(key: string): number {
  const today = fromDateKey(toDateKey())
  const target = fromDateKey(key)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function formatDueLabel(key: string): string {
  const diff = daysUntil(key)
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff === -1) return 'Overdue by 1 day'
  if (diff < 0) return `Overdue by ${-diff} days`
  if (diff < 7) return `Due ${fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long' })}`
  return `Due ${formatShortDate(key)}`
}

export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatLongDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
