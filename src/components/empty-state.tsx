import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" />
      </span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  )
}
