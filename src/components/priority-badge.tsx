import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Priority } from '@/lib/types'

export const PRIORITY_META: Record<
  Priority,
  { label: string; className: string; icon: typeof ArrowUp; rank: number }
> = {
  high: {
    label: 'High',
    className: 'bg-destructive/10 text-destructive',
    icon: ArrowUp,
    rank: 0,
  },
  medium: {
    label: 'Medium',
    className: 'bg-warning/15 text-amber-700 dark:text-warning',
    icon: Minus,
    rank: 1,
  },
  low: {
    label: 'Low',
    className: 'bg-success/12 text-emerald-700 dark:text-success',
    icon: ArrowDown,
    rank: 2,
  },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        meta.className,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  )
}
