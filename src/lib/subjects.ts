import type { Subject, SubjectColor } from './types'

export const SUBJECT_COLORS: Record<
  SubjectColor,
  { label: string; dot: string; soft: string; border: string; top: string }
> = {
  indigo: {
    label: 'Indigo',
    dot: 'bg-indigo-500',
    soft: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    border: 'border-l-indigo-500',
    top: 'border-t-indigo-500',
  },
  violet: {
    label: 'Violet',
    dot: 'bg-violet-500',
    soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    border: 'border-l-violet-500',
    top: 'border-t-violet-500',
  },
  sky: {
    label: 'Sky',
    dot: 'bg-sky-500',
    soft: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    border: 'border-l-sky-500',
    top: 'border-t-sky-500',
  },
  emerald: {
    label: 'Emerald',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    border: 'border-l-emerald-500',
    top: 'border-t-emerald-500',
  },
  amber: {
    label: 'Amber',
    dot: 'bg-amber-500',
    soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    border: 'border-l-amber-500',
    top: 'border-t-amber-500',
  },
  rose: {
    label: 'Rose',
    dot: 'bg-rose-500',
    soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    border: 'border-l-rose-500',
    top: 'border-t-rose-500',
  },
  teal: {
    label: 'Teal',
    dot: 'bg-teal-500',
    soft: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    border: 'border-l-teal-500',
    top: 'border-t-teal-500',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-500',
    soft: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
    border: 'border-l-orange-500',
    top: 'border-t-orange-500',
  },
}

export const COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[]

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-math', name: 'Mathematics', color: 'indigo' },
  { id: 'sub-sci', name: 'Science', color: 'emerald' },
  { id: 'sub-eng', name: 'English', color: 'rose' },
  { id: 'sub-hist', name: 'History', color: 'amber' },
  { id: 'sub-cs', name: 'Computer Science', color: 'sky' },
]

export const NO_SUBJECT: Subject = {
  id: '',
  name: 'General',
  color: 'violet',
}
