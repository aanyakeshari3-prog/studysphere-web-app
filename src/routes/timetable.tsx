import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, Clock, MapPin, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ClassSession, Weekday } from '@/lib/types'
import { useStore } from '@/lib/store'
import { WEEKDAYS, formatTime, timeToMinutes, weekdayIndex } from '@/lib/dates'
import { SUBJECT_COLORS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ClassDialog } from '@/components/class-dialog'
import { SubjectsDialog } from '@/components/subjects-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'

export const Route = createFileRoute('/timetable')({
  head: () => ({ meta: [{ title: 'Timetable — StudySphere' }] }),
  component: TimetablePage,
})

function useNowMinutes() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return { minutes: now.getHours() * 60 + now.getMinutes(), today: weekdayIndex(now) }
}

function ClassCard({
  session,
  isNow,
  onEdit,
  onDelete,
}: {
  session: ClassSession
  isNow: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { getSubject } = useStore()
  const subject = getSubject(session.subjectId)
  const colors = SUBJECT_COLORS[subject.color]
  return (
    <div
      className={cn(
        'group relative rounded-xl border-l-4 p-3 transition-shadow hover:shadow-soft',
        colors.border,
        colors.soft,
        isNow && 'ring-2 ring-primary',
      )}
    >
      {isNow && (
        <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
          Now
        </span>
      )}
      <p className="pr-1 text-sm font-bold break-words text-foreground">{subject.name}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        {formatTime(session.start)} – {formatTime(session.end)}
      </p>
      {session.location && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{session.location}</span>
        </p>
      )}
      <div className="mt-2 flex gap-1 lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label={`Edit ${subject.name} class`}>
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${subject.name} class`}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function TimetablePage() {
  const { classes, deleteClass, getSubject } = useStore()
  const { minutes, today } = useNowMinutes()
  const [selectedDay, setSelectedDay] = useState<Weekday>(today)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDay, setDialogDay] = useState<Weekday>(today)
  const [editing, setEditing] = useState<ClassSession | null>(null)
  const [deleting, setDeleting] = useState<ClassSession | null>(null)
  const [subjectsOpen, setSubjectsOpen] = useState(false)

  const byDay = useMemo(() => {
    const days = WEEKDAYS.map(() => [] as ClassSession[])
    classes.forEach((c) => days[c.day].push(c))
    days.forEach((d) => d.sort((a, b) => a.start.localeCompare(b.start)))
    return days
  }, [classes])

  const isNow = (c: ClassSession) =>
    c.day === today && timeToMinutes(c.start) <= minutes && minutes < timeToMinutes(c.end)

  const openNew = (day: Weekday) => {
    setEditing(null)
    setDialogDay(day)
    setDialogOpen(true)
  }

  const card = (c: ClassSession) => (
    <ClassCard
      key={c.id}
      session={c}
      isNow={isNow(c)}
      onEdit={() => {
        setEditing(c)
        setDialogOpen(true)
      }}
      onDelete={() => setDeleting(c)}
    />
  )

  const weeklyHours = classes.reduce((sum, c) => sum + timeToMinutes(c.end) - timeToMinutes(c.start), 0) / 60

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Weekly Timetable"
        description={
          classes.length
            ? `${classes.length} classes · ${weeklyHours.toFixed(1)} hours per week`
            : 'Plan your weekly classes, times and rooms.'
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setSubjectsOpen(true)}>
              <Palette /> Manage subjects
            </Button>
            <Button onClick={() => openNew(selectedDay)}>
              <Plus /> Add class
            </Button>
          </>
        }
      />

      {classes.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Your timetable is empty"
          description="Add your classes to see your week at a glance. Today’s column is highlighted automatically."
          className="mb-6"
          action={
            <>
              <Button onClick={() => openNew(today)}>
                <Plus /> Add your first class
              </Button>
              <Button variant="outline" onClick={() => setSubjectsOpen(true)}>
                <Palette /> Manage subjects
              </Button>
            </>
          }
        />
      )}

      {/* Mobile & tablet: one day at a time */}
      <div className="lg:hidden">
        <div className="mb-4 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Choose a day">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              role="tab"
              aria-selected={selectedDay === i}
              onClick={() => setSelectedDay(i as Weekday)}
              className={cn(
                'relative flex flex-col items-center rounded-xl border py-2 text-xs font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selectedDay === i ? 'border-transparent bg-primary text-primary-foreground shadow-glow' : 'bg-card',
                i === today && selectedDay !== i && 'border-primary text-primary',
              )}
            >
              {d.slice(0, 3)}
              <span className={cn('mt-1 size-1.5 rounded-full', byDay[i].length ? 'bg-current' : 'bg-transparent')} />
            </button>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {WEEKDAYS[selectedDay]}
              {selectedDay === today && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Today</span>
              )}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => openNew(selectedDay)}>
              <Plus /> Add
            </Button>
          </div>
          {byDay[selectedDay].length ? (
            <div className="space-y-3">{byDay[selectedDay].map(card)}</div>
          ) : (
            <p className="rounded-xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">
              No classes on {WEEKDAYS[selectedDay]}.
            </p>
          )}
        </div>
      </div>

      {/* Desktop: full week grid */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-7">
        {WEEKDAYS.map((d, i) => {
          const isToday = i === today
          return (
            <section
              key={d}
              aria-label={d}
              className={cn(
                'flex min-h-80 flex-col rounded-2xl border bg-card p-3 shadow-soft',
                isToday && 'border-primary/60 bg-primary/[0.04] ring-2 ring-primary/20',
              )}
            >
              <header className="mb-3 flex items-center justify-between gap-1">
                <h2 className={cn('text-sm font-bold', isToday && 'text-primary')}>{d.slice(0, 3)}</h2>
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
                    Today
                  </span>
                )}
              </header>
              <div className="flex flex-1 flex-col gap-2.5">{byDay[i].map(card)}</div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full border border-dashed text-muted-foreground"
                onClick={() => openNew(i as Weekday)}
                aria-label={`Add class on ${d}`}
              >
                <Plus /> Add
              </Button>
            </section>
          )
        })}
      </div>

      <ClassDialog open={dialogOpen} onOpenChange={setDialogOpen} session={editing} defaultDay={dialogDay} />
      <SubjectsDialog open={subjectsOpen} onOpenChange={setSubjectsOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this class?"
        description={
          deleting
            ? `${getSubject(deleting.subjectId).name} on ${WEEKDAYS[deleting.day]} at ${formatTime(deleting.start)} will be removed from your timetable.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (!deleting) return
          deleteClass(deleting.id)
          toast.success('Class removed')
        }}
      />
    </div>
  )
}
