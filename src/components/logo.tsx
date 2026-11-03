import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-glow',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="2" />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="3.6"
          stroke="currentColor"
          strokeWidth="1.6"
          transform="rotate(-25 12 12)"
          opacity=".85"
        />
        <circle cx="19.2" cy="8.6" r="1.4" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="font-display text-lg font-extrabold tracking-tight">
          Study<span className="text-primary">Sphere</span>
        </span>
      )}
    </span>
  )
}
