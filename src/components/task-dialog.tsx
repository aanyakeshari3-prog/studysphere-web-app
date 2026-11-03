import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Priority, Task } from '@/lib/types'
import { useStore, type TaskInput } from '@/lib/store'
import { toDateKey } from '@/lib/dates'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubjectSelect } from '@/components/subject-badge'
import { FieldError } from '@/components/field-error'
import { PRIORITY_META } from '@/components/priority-badge'
import { cn } from '@/lib/utils'

type Errors = Partial<Record<'title' | 'dueDate', string>>

function blank(): TaskInput {
  return {
    title: '',
    subjectId: '',
    dueDate: toDateKey(),
    priority: 'medium',
    notes: '',
  }
}

export function validateTask(input: TaskInput, isNew: boolean): Errors {
  const errors: Errors = {}
  const title = input.title.trim()
  if (!title) errors.title = 'Give the assignment a title.'
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters.'
  if (!input.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate))
    errors.dueDate = 'Pick a due date.'
  else if (isNew && input.dueDate < toDateKey())
    errors.dueDate = 'The due date can’t be in the past.'
  return errors
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultSubjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  defaultSubjectId?: string
}) {
  const { addTask, updateTask } = useStore()
  const [form, setForm] = useState<TaskInput>(blank)
  const [errors, setErrors] = useState<Errors>({})
  const isNew = !task

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      task
        ? {
            title: task.title,
            subjectId: task.subjectId,
            dueDate: task.dueDate,
            priority: task.priority,
            notes: task.notes,
          }
        : { ...blank(), subjectId: defaultSubjectId ?? '' },
    )
  }, [open, task, defaultSubjectId])

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = validateTask(form, isNew)
    setErrors(found)
    if (Object.keys(found).length) return
    const clean = { ...form, title: form.title.trim(), notes: form.notes.trim() }
    if (task) {
      updateTask(task.id, clean)
      toast.success('Assignment updated')
    } else {
      addTask(clean)
      toast.success('Assignment added', { description: clean.title })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New assignment' : 'Edit assignment'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Add homework with a subject, due date and priority.'
              : 'Update the details of this assignment.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Chemistry worksheet 3"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              autoFocus
            />
            <FieldError id="task-title-error" message={errors.title} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-subject">Subject</Label>
              <SubjectSelect
                id="task-subject"
                value={form.subjectId}
                onChange={(v) => set('subjectId', v)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                min={isNew ? toDateKey() : undefined}
                onChange={(e) => set('dueDate', e.target.value)}
                aria-invalid={!!errors.dueDate}
                aria-describedby={errors.dueDate ? 'task-due-error' : undefined}
              />
              <FieldError id="task-due-error" message={errors.dueDate} />
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Priority</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                const Icon = PRIORITY_META[p].icon
                const selected = form.priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set('priority', p)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      selected
                        ? cn('border-transparent', PRIORITY_META[p].className, 'ring-2 ring-current/30')
                        : 'hover:bg-muted',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {PRIORITY_META[p].label}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="task-notes">
              Details <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="task-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Pages, questions, submission instructions…"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isNew ? 'Add assignment' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
