import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ClassSession, Weekday } from '@/lib/types'
import { useStore, type ClassInput } from '@/lib/store'
import { WEEKDAYS, formatTime, timeToMinutes } from '@/lib/dates'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubjectSelect } from '@/components/subject-badge'
import { FieldError } from '@/components/field-error'

type Errors = Partial<Record<'subjectId' | 'start' | 'end', string>>

export function ClassDialog({
  open,
  onOpenChange,
  session,
  defaultDay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session?: ClassSession | null
  defaultDay: Weekday
}) {
  const { subjects, classes, addClass, updateClass, getSubject } = useStore()
  const [form, setForm] = useState<ClassInput>({
    subjectId: '',
    day: 0,
    start: '09:00',
    end: '10:00',
    location: '',
  })
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      session
        ? { subjectId: session.subjectId, day: session.day, start: session.start, end: session.end, location: session.location }
        : { subjectId: subjects[0]?.id ?? '', day: defaultDay, start: '09:00', end: '10:00', location: '' },
    )
  }, [open, session, defaultDay, subjects])

  const set = <K extends keyof ClassInput>(key: K, value: ClassInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined, ...(key === 'start' || key === 'day' ? { end: undefined } : {}) }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: Errors = {}
    if (!form.subjectId) found.subjectId = 'Choose a subject.'
    if (!form.start) found.start = 'Add a start time.'
    if (!form.end) found.end = 'Add an end time.'
    if (form.start && form.end && timeToMinutes(form.end) <= timeToMinutes(form.start))
      found.end = 'End time must be after the start time.'
    if (!found.end && form.start && form.end) {
      const clash = classes.find(
        (c) =>
          c.id !== session?.id &&
          c.day === form.day &&
          timeToMinutes(form.start) < timeToMinutes(c.end) &&
          timeToMinutes(c.start) < timeToMinutes(form.end),
      )
      if (clash)
        found.end = `Overlaps with ${getSubject(clash.subjectId).name} (${formatTime(clash.start)}–${formatTime(clash.end)}).`
    }
    setErrors(found)
    if (Object.keys(found).length) return

    const clean = { ...form, location: form.location.trim() }
    if (session) {
      updateClass(session.id, clean)
      toast.success('Class updated')
    } else {
      addClass(clean)
      toast.success('Class added', {
        description: `${getSubject(clean.subjectId).name} on ${WEEKDAYS[clean.day]}`,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{session ? 'Edit class' : 'Add class'}</DialogTitle>
          <DialogDescription>Schedule a recurring weekly class.</DialogDescription>
        </DialogHeader>
        {subjects.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Add a subject first using “Manage subjects” on the timetable page.
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="class-subject">Subject</Label>
              <SubjectSelect
                id="class-subject"
                value={form.subjectId}
                onChange={(v) => set('subjectId', v)}
                allowNone={false}
                invalid={!!errors.subjectId}
              />
              <FieldError id="class-subject-error" message={errors.subjectId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-day">Day</Label>
              <Select value={String(form.day)} onValueChange={(v) => set('day', Number(v) as Weekday)}>
                <SelectTrigger id="class-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="class-start">Start</Label>
                <Input
                  id="class-start"
                  type="time"
                  value={form.start}
                  onChange={(e) => set('start', e.target.value)}
                  aria-invalid={!!errors.start}
                />
                <FieldError id="class-start-error" message={errors.start} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="class-end">End</Label>
                <Input
                  id="class-end"
                  type="time"
                  value={form.end}
                  onChange={(e) => set('end', e.target.value)}
                  aria-invalid={!!errors.end}
                />
              </div>
            </div>
            <FieldError id="class-end-error" message={errors.end} />
            <div className="grid gap-2">
              <Label htmlFor="class-location">
                Room or location <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="class-location"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Room 204"
                maxLength={60}
              />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{session ? 'Save changes' : 'Add class'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
