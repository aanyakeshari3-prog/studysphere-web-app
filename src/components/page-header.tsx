import type { LucideIcon } from 'lucide-react'

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 animate-fade-up sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-1 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
