import { createFileRoute } from '@tanstack/react-router'
import { TaskCalendar } from '@/components/workspace/calendar'
export const Route = createFileRoute('/calendar')({ component: TaskCalendar })
