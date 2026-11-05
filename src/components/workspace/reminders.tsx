import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
export function TaskReminders() {
  const { tasks, hydrated } = useStore()
  const shown = useRef(new Set<string>())
  useEffect(() => {
    if (!hydrated) return
    const check = () => {
      tasks
        .filter(
          (t) =>
            !t.completed &&
            t.reminderAt &&
            new Date(t.reminderAt).getTime() <= Date.now(),
        )
        .forEach((t) => {
          const key = `${t.id}-${t.reminderAt}`
          if (shown.current.has(key)) return
          shown.current.add(key)
          toast.info(`Reminder: ${t.title}`, {
            description: 'Your assignment needs attention.',
            duration: 12000,
          })
        })
    }
    check()
    const timer = window.setInterval(check, 30000)
    return () => window.clearInterval(timer)
  }, [tasks, hydrated])
  return null
}
