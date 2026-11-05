export type Priority = 'low' | 'medium' | 'high'

export interface Subject {
  id: string
  name: string
  color: SubjectColor
}

export type SubjectColor =
  'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'teal' | 'orange'

export interface Task {
  reminderAt?: string
  noteId?: string
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
  html?: string
  notebookId?: string
  tags?: string[]
  favorite?: boolean
  archived?: boolean
  deletedAt?: string | null
  viewedAt?: string
  color?: string
  documentIds?: string[]
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

export interface Notebook {
  id: string
  title: string
  parentId: string
  subjectId: string
}
export interface Flashcard {
  id: string
  deck: string
  front: string
  back: string
  due: string
  interval: number
  reviews: number
  lastReviewed?: string
}
export interface StudyActivity {
  id: string
  title: string
  completedAt: string
}
export interface StudyDocument {
  id: string
  name: string
  type: string
  size: number
  notebookId: string
  extractedText: string
  createdAt: string
}
