import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardList, FilterX, Plus, Search, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import type { Priority, Task } from '@/lib/types'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { TaskItem, isOverdue } from '@/components/task-item'
import { TaskDialog } from '@/components/task-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PRIORITY_META } from '@/components/priority-badge'
import { SubjectDot } from '@/components/subject-badge'

export const Route = createFileRoute('/homework')({
  head: () => ({ meta: [{ title: 'Homework — StudySphere' }] }),
  component: HomeworkPage,
})

type Status = 'all' | 'pending' | 'overdue' | 'completed'
type Sort = 'due' | 'priority' | 'newest'

const STATUS_LABELS: Record<Status, string> = {
  all: 'All',
  pending: 'Pending',
  overdue: 'Overdue',
  completed: 'Completed',
}

function matchesStatus(task: Task, status: Status) {
  if (status === 'pending') return !task.completed
  if (status === 'completed') return task.completed
  if (status === 'overdue') return isOverdue(task)
  return true
}

function HomeworkPage() {
  const { tasks, subjects, deleteTask, restoreTask, clearCompletedTasks } = useStore()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [subject, setSubject] = useState('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [sort, setSort] = useState<Sort>('due')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(STATUS_LABELS) as Status[]).map((s) => [
          s,
          tasks.filter((t) => matchesStatus(t, s)).length,
        ]),
      ) as Record<Status, number>,
    [tasks],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks
      .filter((t) => matchesStatus(t, status))
      .filter((t) => subject === 'all' || t.subjectId === (subject === 'general' ? '' : subject))
      .filter((t) => priority === 'all' || t.priority === priority)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
      .sort((a, b) => {
        // Unfinished work always comes first.
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (sort === 'priority')
          return (
            PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
            a.dueDate.localeCompare(b.dueDate)
          )
        if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
        return a.dueDate.localeCompare(b.dueDate)
      })
  }, [tasks, status, subject, priority, query, sort])

  const filtersActive = query !== '' || subject !== 'all' || priority !== 'all' || status !== 'all'

  const resetFilters = () => {
    setQuery('')
    setSubject('all')
    setPriority('all')
    setStatus('all')
  }

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const confirmDelete = (task: Task) => {
    deleteTask(task.id)
    toast.success('Assignment deleted', {
      description: task.title,
      action: {
        label: 'Undo',
        onClick: () => {
          restoreTask(task)
          toast.success('Assignment restored')
        },
      },
    })
  }

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title="Homework"
        description="Track assignments, deadlines and priorities across every subject."
        actions={
          <>
            {counts.completed > 0 && (
              <Button variant="outline" onClick={() => setClearOpen(true)}>
                Clear completed
              </Button>
            )}
            <Button onClick={openNew}>
              <Plus /> Add assignment
            </Button>
          </>
        }
      />

      {/* Status tabs */}
      <div role="tablist" aria-label="Filter by status" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              status === s
                ? 'border-transparent bg-primary text-primary-foreground shadow-glow'
                : 'bg-card hover:bg-muted',
              s === 'overdue' && counts.overdue > 0 && status !== s && 'border-destructive/40 text-destructive',
            )}
          >
            {STATUS_LABELS[s]}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs tabular-nums',
                status === s ? 'bg-white/20' : 'bg-muted',
              )}
            >
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 grid gap-3 rounded-2xl border bg-card p-3 shadow-soft sm:grid-cols-2 lg:grid-cols-[1fr_200px_160px_170px_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assignments…"
            className="pl-9"
            aria-label="Search assignments"
          />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-full" aria-label="Filter by subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="general">General</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <SubjectDot subject={s} /> {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as 'all' | Priority)}>
          <SelectTrigger className="w-full" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High priority</SelectItem>
            <SelectItem value="medium">Medium priority</SelectItem>
            <SelectItem value="low">Low priority</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-full" aria-label="Sort assignments">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Sort: Due date</SelectItem>
            <SelectItem value="priority">Sort: Priority</SelectItem>
            <SelectItem value="newest">Sort: Recently added</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={resetFilters} disabled={!filtersActive}>
          <FilterX /> Reset
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No homework yet"
          description="Add your first assignment to start tracking deadlines and priorities."
          action={
            <Button onClick={openNew}>
              <Plus /> Add assignment
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching assignments"
          description="Try a different search or clear the filters to see everything."
          action={
            <Button variant="outline" onClick={resetFilters}>
              <FilterX /> Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {tasks.length} assignment{tasks.length === 1 ? '' : 's'}
          </p>
          {visible.map((t) => (
            <div key={t.id} className="animate-fade-up">
              <TaskItem
                task={t}
                onEdit={(task) => {
                  setEditing(task)
                  setDialogOpen(true)
                }}
                onDelete={setDeleting}
              />
            </div>
          ))}
        </div>
      )}

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this assignment?"
        description={deleting ? `“${deleting.title}” will be permanently removed.` : ''}
        onConfirm={() => deleting && confirmDelete(deleting)}
      />
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear completed assignments?"
        description={`This removes ${counts.completed} completed assignment${counts.completed === 1 ? '' : 's'}.`}
        confirmLabel="Clear completed"
        onConfirm={() => {
          clearCompletedTasks()
          toast.success('Completed assignments cleared')
        }}
      />
    </div>
  )
}
