import { DashboardWorkspace } from '@/components/workspace/dashboard-workspace'
import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  ListTodo,
  MapPin,
  Plus,
  Sparkles,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import {
  addDays,
  daysUntil,
  formatLongDate,
  formatTime,
  greeting,
  startOfWeek,
  toDateKey,
  weekdayIndex,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import { SUBJECT_COLORS } from '@/lib/subjects'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/empty-state'
import { TaskItem, isOverdue } from '@/components/task-item'
import { TaskDialog } from '@/components/task-dialog'
import { PRIORITY_META } from '@/components/priority-badge'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  to,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  hint: string
  tone?: 'primary' | 'success' | 'danger' | 'violet' | 'warning'
  to: '/homework' | '/notes' | '/focus'
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/12 text-emerald-600 dark:text-success',
    danger: 'bg-destructive/10 text-destructive',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    warning: 'bg-warning/15 text-amber-600 dark:text-warning',
  }
  return (
    <Link
      to={to}
      className="group rounded-2xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transition-none sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-xl',
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-32 shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold tabular-nums">
          {value}%
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function Dashboard() {
  const {
    tasks,
    notes: allNotes,
    classes,
    focusSessions,
    prefs,
    getSubject,
    loadSampleData,
  } = useStore()
  const notes = allNotes.filter((n) => !n.deletedAt && !n.archived)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const today = toDateKey()
  const now = new Date()
  const todayIndex = weekdayIndex(now)

  const stats = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed)
    const completed = tasks.length - pending.length
    const overdue = pending.filter(isOverdue)
    const dueToday = pending.filter((t) => t.dueDate === today)
    const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
    return { pending, completed, overdue, dueToday, rate }
  }, [tasks, today])

  const priorities = useMemo(
    () =>
      stats.pending
        .filter(
          (t) =>
            t.dueDate <= today ||
            (t.priority === 'high' && daysUntil(t.dueDate) <= 2),
        )
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) ||
            PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank,
        )
        .slice(0, 5),
    [stats.pending, today],
  )

  const upcoming = useMemo(() => {
    const priorityIds = new Set(priorities.map((t) => t.id))
    return stats.pending
      .filter((t) => t.dueDate > today && !priorityIds.has(t.id))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
  }, [stats.pending, priorities, today])

  const todaysClasses = classes
    .filter((c) => c.day === todayIndex)
    .sort((a, b) => a.start.localeCompare(b.start))

  const focus = useMemo(() => {
    const todayCount = focusSessions.filter(
      (s) => toDateKey(new Date(s.completedAt)) === today,
    ).length
    const weekStart = startOfWeek()
    const week = Array.from({ length: 7 }, (_, i) => {
      const key = toDateKey(addDays(weekStart, i))
      const minutes = focusSessions
        .filter((s) => toDateKey(new Date(s.completedAt)) === key)
        .reduce((sum, s) => sum + s.minutes, 0)
      return {
        key,
        minutes,
        label: addDays(weekStart, i).toLocaleDateString(undefined, {
          weekday: 'short',
        }),
      }
    })
    const weekMinutes = week.reduce((sum, d) => sum + d.minutes, 0)
    return { todayCount, week, weekMinutes }
  }, [focusSessions, today])

  const maxMinutes = Math.max(25, ...focus.week.map((d) => d.minutes))
  const name = prefs.displayName.trim()
  const isBrandNew =
    tasks.length === 0 && notes.length === 0 && classes.length === 0

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-glow animate-fade-up sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <CalendarDays className="size-4" />
              {formatLongDate(now)}
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {greeting(now)}
              {name ? `, ${name}` : ''}! 👋
            </h1>
            <p className="mt-2 max-w-xl text-white/85">
              {stats.pending.length === 0
                ? 'You’re all caught up. Plan your next study session or add new homework.'
                : `You have ${stats.dueToday.length} assignment${stats.dueToday.length === 1 ? '' : 's'} due today${
                    stats.overdue.length
                      ? ` and ${stats.overdue.length} overdue`
                      : ''
                  }. Let’s make it a productive day.`}
            </p>
            {!name && (
              <Link
                to="/settings"
                className="mt-2 inline-block text-sm font-semibold text-white underline-offset-4 hover:underline"
              >
                Add your name in Settings →
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setTaskDialogOpen(true)}
              className="bg-white text-indigo-700 hover:bg-white/90"
            >
              <Plus /> Add homework
            </Button>
            <Button
              asChild
              variant="ghost"
              className="bg-white/15 text-white hover:bg-white/25 hover:text-white"
            >
              <Link to="/focus">
                <Timer /> Start focusing
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="bg-white/15 text-white hover:bg-white/25 hover:text-white"
            >
              <Link to="/notes">
                <BookOpenText /> New note
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {isBrandNew && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Welcome to StudySphere!</p>
              <p className="text-sm text-muted-foreground">
                Start by adding homework or your class timetable — or load
                example data to explore.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              loadSampleData()
              toast.success('Example data loaded', {
                description: 'Clear it any time from Settings.',
              })
            }}
          >
            Load example data
          </Button>
        </div>
      )}

      <DashboardWorkspace />

      {/* Stats */}
      <section
        aria-label="Statistics"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
      >
        <StatCard
          icon={ListTodo}
          label="Pending"
          value={stats.pending.length}
          hint={`${stats.dueToday.length} due today`}
          to="/homework"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          hint={`${stats.rate}% of all homework`}
          tone="success"
          to="/homework"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue.length}
          hint={stats.overdue.length ? 'Needs attention' : 'Nothing overdue 🎉'}
          tone="danger"
          to="/homework"
        />
        <StatCard
          icon={BookOpenText}
          label="Notes"
          value={notes.length}
          hint={`${new Set(notes.map((n) => n.subjectId)).size} subjects`}
          tone="violet"
          to="/notes"
        />
        <StatCard
          icon={Flame}
          label="Focus today"
          value={focus.todayCount}
          hint={`Goal: ${prefs.dailyFocusGoal} sessions`}
          tone="warning"
          to="/focus"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Today's priorities */}
          <Card className="rounded-2xl shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Target className="size-5 text-primary" /> Today’s priorities
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/homework">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorities.length ? (
                priorities.map((t) => <TaskItem key={t.id} task={t} compact />)
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="No urgent work"
                  description="Nothing is due today or overdue. Great time to get ahead!"
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card className="rounded-2xl shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <ClipboardList className="size-5 text-primary" /> Upcoming
                homework
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTaskDialogOpen(true)}
              >
                <Plus /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="divide-y">
                  {upcoming.map((t) => {
                    const subject = getSubject(t.subjectId)
                    const d = daysUntil(t.dueDate)
                    return (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span
                          className={cn(
                            'h-10 w-1 shrink-0 rounded-full',
                            SUBJECT_COLORS[subject.color].dot,
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {subject.name}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                          {d === 1 ? 'Tomorrow' : `In ${d} days`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="No upcoming homework"
                  description="Add assignments to see what’s coming up next."
                  className="py-8"
                  action={
                    <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                      <Plus /> Add homework
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Study progress */}
          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Sparkles className="size-5 text-primary" /> Study progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-5">
                <ProgressRing value={stats.rate} label="done" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Homework completion</p>
                  <p className="text-muted-foreground">
                    {stats.completed} of {tasks.length} assignments finished.
                  </p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">Daily focus goal</span>
                  <span className="tabular-nums text-muted-foreground">
                    {focus.todayCount}/{prefs.dailyFocusGoal}
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    (focus.todayCount / prefs.dailyFocusGoal) * 100,
                  )}
                />
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold">Focus this week</span>
                  <span className="tabular-nums text-muted-foreground">
                    {focus.weekMinutes} min
                  </span>
                </div>
                <div
                  className="flex h-28 items-end gap-2"
                  role="img"
                  aria-label={`Focus minutes this week: ${focus.week.map((d) => `${d.label} ${d.minutes}`).join(', ')}`}
                >
                  {focus.week.map((d) => (
                    <div
                      key={d.key}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      <div className="flex w-full flex-1 items-end">
                        <div
                          title={`${d.minutes} min`}
                          className={cn(
                            'w-full rounded-md transition-all duration-500 motion-reduce:transition-none',
                            d.minutes ? 'bg-brand' : 'bg-muted',
                            d.key === today &&
                              'ring-2 ring-primary/30 ring-offset-2 ring-offset-card',
                          )}
                          style={{
                            height: `${Math.max(6, (d.minutes / maxMinutes) * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-[11px] text-muted-foreground',
                          d.key === today && 'font-bold text-primary',
                        )}
                      >
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's classes */}
          <Card className="rounded-2xl shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <CalendarDays className="size-5 text-primary" /> Today’s classes
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/timetable">
                  Timetable <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {todaysClasses.length ? (
                <ul className="space-y-2">
                  {todaysClasses.map((c) => {
                    const subject = getSubject(c.subjectId)
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          'rounded-xl border-l-4 bg-muted/50 px-3 py-2',
                          SUBJECT_COLORS[subject.color].border,
                        )}
                      >
                        <p className="text-sm font-semibold">{subject.name}</p>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" /> {formatTime(c.start)} –{' '}
                            {formatTime(c.end)}
                          </span>
                          {c.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" /> {c.location}
                            </span>
                          )}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  No classes scheduled today.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} />
    </div>
  )
}
