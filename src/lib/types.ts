export type Priority = 'low' | 'medium' | 'high'

export interface Subject {
  id: string
  name: string
  color: SubjectColor
}

export type SubjectColor =
  | 'indigo'
  | 'violet'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'teal'
  | 'orange'

export interface Task {
  id: string
  title: string
  subjectId: string
  /** Local date, YYYY-MM-DD */
  dueDate: string
  priority: Priority
  notes: string
  completed: boolean
  completedAt: string | null
  createdAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  subjectId: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

/** Monday = 0 … Sunday = 6 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ClassSession {
  id: string
  subjectId: string
  day: Weekday
  /** HH:MM, 24h */
  start: string
  end: string
  location: string
}

export interface FocusSession {
  id: string
  completedAt: string
  minutes: number
}

export type Theme = 'light' | 'dark'

export interface Preferences {
  displayName: string
  theme: Theme
  sidebarCollapsed: boolean
  dailyFocusGoal: number
}
