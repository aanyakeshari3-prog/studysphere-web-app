import { CalendarClock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/lib/types'
import { useStore } from '@/lib/store'
import { daysUntil, formatDueLabel, toDateKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SubjectBadge } from '@/components/subject-badge'
import { PriorityBadge } from '@/components/priority-badge'

export function isOverdue(task: Task): boolean {
  return !task.completed && task.dueDate < toDateKey()
}

export function TaskItem({
  task,
  onEdit,
  onDelete,
  compact = false,
}: {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
  compact?: boolean
}) {
  const { toggleTask, getSubject } = useStore()
  const overdue = isOverdue(task)
  const soon = !task.completed && !overdue && daysUntil(task.dueDate) <= 1
  const checkboxId = `task-${task.id}`

  const toggle = () => {
    toggleTask(task.id)
    if (task.completed) toast('Marked as not done', { description: task.title })
    else toast.success('Nice work! Assignment completed ✅', { description: task.title })
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-all hover:shadow-soft motion-reduce:transition-none',
        overdue && 'border-destructive/40 bg-destructive/[0.04]',
        task.completed && 'opacity-70',
        compact && 'p-3',
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={task.completed}
        onCheckedChange={toggle}
        className="mt-0.5 size-5 rounded-md"
        aria-label={task.completed ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={checkboxId}
          className={cn(
            'block cursor-pointer font-semibold leading-snug break-words',
            task.completed && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </label>
        {!compact && task.notes && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.notes}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SubjectBadge subject={getSubject(task.subjectId)} />
          <PriorityBadge priority={task.priority} />
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground',
              overdue && 'font-semibold text-destructive',
              soon && 'text-amber-700 dark:text-warning',
            )}
          >
            <CalendarClock className="size-3.5" />
            {task.completed ? 'Completed' : formatDueLabel(task.dueDate)}
          </span>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(task)}
              aria-label={`Edit “${task.title}”`}
            >
              <Pencil />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(task)}
              aria-label={`Delete “${task.title}”`}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
