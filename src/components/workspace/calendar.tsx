import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { toDateKey } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { TaskDialog } from '@/components/task-dialog'
import type { Task } from '@/lib/types'
export function TaskCalendar() {
  const { tasks } = useStore()
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [editing, setEditing] = useState<Task | null>(null)
  const start = new Date(month)
  start.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Calendar"
        description="See your deadlines with a little more perspective."
      />
      <div className="mb-5 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft />
        </Button>
        <h2 className="flex-1 text-center font-bold">
          {month.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[650px] grid-cols-7 overflow-hidden rounded-2xl border bg-card">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="border-b bg-accent/40 p-3 text-center text-xs font-semibold"
            >
              {d}
            </div>
          ))}
          {days.map((d) => (
            <div
              key={toDateKey(d)}
              className={`min-h-28 border-r border-b p-2 ${d.getMonth() !== month.getMonth() ? 'opacity-40' : ''}`}
            >
              <span
                className={`inline-grid size-7 place-items-center rounded-full text-xs ${toDateKey(d) === toDateKey() ? 'bg-primary text-white' : ''}`}
              >
                {d.getDate()}
              </span>
              {tasks
                .filter((t) => t.dueDate === toDateKey(d))
                .map((t) => (
                  <button
                    className={`mt-1 block w-full truncate rounded bg-accent p-1 text-left text-xs ${t.completed ? 'line-through opacity-60' : t.dueDate < toDateKey() ? 'text-destructive' : 'text-primary'}`}
                    key={t.id}
                    onClick={() => setEditing(t)}
                  >
                    {t.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      <TaskDialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null)
        }}
        task={editing}
      />
    </div>
  )
}
