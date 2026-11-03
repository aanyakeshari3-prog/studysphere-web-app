import { cn } from '@/lib/utils'
import { SUBJECT_COLORS } from '@/lib/subjects'
import type { Subject } from '@/lib/types'
import { useStore } from '@/lib/store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SubjectDot({ subject }: { subject: Subject }) {
  return (
    <span
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        SUBJECT_COLORS[subject.color].dot,
      )}
      aria-hidden="true"
    />
  )
}

export function SubjectBadge({
  subject,
  className,
}: {
  subject: Subject
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        SUBJECT_COLORS[subject.color].soft,
        className,
      )}
    >
      <SubjectDot subject={subject} />
      <span className="truncate">{subject.name}</span>
    </span>
  )
}

const NONE = '__none__'

/** Subject picker. An empty string value means "General" (no subject). */
export function SubjectSelect({
  id,
  value,
  onChange,
  allowNone = true,
  invalid,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  allowNone?: boolean
  invalid?: boolean
}) {
  const { subjects } = useStore()
  return (
    <Select
      value={value === '' ? (allowNone ? NONE : undefined) : value}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Choose a subject" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>General</SelectItem>}
        {subjects.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <SubjectDot subject={s} />
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
