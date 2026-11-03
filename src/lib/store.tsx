import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ClassSession,
  FocusSession,
  Note,
  Preferences,
  Subject,
  Task,
} from './types'
import { DEFAULT_SUBJECTS, NO_SUBJECT } from './subjects'
import { buildSampleData } from './sample-data'

/** Each slice is stored under its own localStorage key. */
export const STORAGE_KEYS = {
  tasks: 'studysphere.tasks',
  notes: 'studysphere.notes',
  subjects: 'studysphere.subjects',
  classes: 'studysphere.timetable',
  focus: 'studysphere.focusSessions',
  prefs: 'studysphere.preferences',
} as const

export const DEFAULT_PREFS: Preferences = {
  displayName: '',
  theme: 'light',
  sidebarCollapsed: false,
  dailyFocusGoal: 4,
}

interface AppData {
  tasks: Task[]
  notes: Note[]
  subjects: Subject[]
  classes: ClassSession[]
  focusSessions: FocusSession[]
  prefs: Preferences
}

const EMPTY_DATA: AppData = {
  tasks: [],
  notes: [],
  subjects: DEFAULT_SUBJECTS,
  classes: [],
  focusSessions: [],
  prefs: DEFAULT_PREFS,
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode); the app keeps working in memory.
  }
}

export type TaskInput = Pick<
  Task,
  'title' | 'subjectId' | 'dueDate' | 'priority' | 'notes'
>
export type NoteInput = Pick<Note, 'title' | 'content' | 'subjectId'>
export type ClassInput = Omit<ClassSession, 'id'>
export type SubjectInput = Omit<Subject, 'id'>

interface StoreValue extends AppData {
  hydrated: boolean
  getSubject: (id: string) => Subject
  addTask: (input: TaskInput) => Task
  updateTask: (id: string, input: Partial<Task>) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  restoreTask: (task: Task) => void
  clearCompletedTasks: () => void
  addNote: (input: NoteInput) => Note
  updateNote: (id: string, input: Partial<Note>) => void
  deleteNote: (id: string) => void
  restoreNote: (note: Note) => void
  addClass: (input: ClassInput) => void
  updateClass: (id: string, input: ClassInput) => void
  deleteClass: (id: string) => void
  addSubject: (input: SubjectInput) => Subject
  updateSubject: (id: string, input: SubjectInput) => void
  deleteSubject: (id: string) => void
  logFocusSession: (minutes: number) => void
  updatePrefs: (input: Partial<Preferences>) => void
  loadSampleData: () => void
  resetAllData: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [hydrated, setHydrated] = useState(false)
  const previous = useRef<AppData | null>(null)

  // localStorage only exists in the browser, so read it after mount.
  useEffect(() => {
    const loaded: AppData = {
      tasks: read(STORAGE_KEYS.tasks, EMPTY_DATA.tasks),
      notes: read(STORAGE_KEYS.notes, EMPTY_DATA.notes),
      subjects: read(STORAGE_KEYS.subjects, EMPTY_DATA.subjects),
      classes: read(STORAGE_KEYS.classes, EMPTY_DATA.classes),
      focusSessions: read(STORAGE_KEYS.focus, EMPTY_DATA.focusSessions),
      prefs: { ...DEFAULT_PREFS, ...read(STORAGE_KEYS.prefs, {}) },
    }
    previous.current = loaded
    setData(loaded)
    setHydrated(true)
  }, [])

  // Write only the slices that changed.
  useEffect(() => {
    if (!hydrated) return
    const prev = previous.current
    if (prev?.tasks !== data.tasks) write(STORAGE_KEYS.tasks, data.tasks)
    if (prev?.notes !== data.notes) write(STORAGE_KEYS.notes, data.notes)
    if (prev?.subjects !== data.subjects)
      write(STORAGE_KEYS.subjects, data.subjects)
    if (prev?.classes !== data.classes) write(STORAGE_KEYS.classes, data.classes)
    if (prev?.focusSessions !== data.focusSessions)
      write(STORAGE_KEYS.focus, data.focusSessions)
    if (prev?.prefs !== data.prefs) write(STORAGE_KEYS.prefs, data.prefs)
    previous.current = data
  }, [data, hydrated])

  // Keep the <html> class in sync with the chosen theme.
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle('dark', data.prefs.theme === 'dark')
  }, [data.prefs.theme, hydrated])

  const getSubject = useCallback(
    (id: string) => data.subjects.find((s) => s.id === id) ?? NO_SUBJECT,
    [data.subjects],
  )

  const actions = useMemo(() => {
    const now = () => new Date().toISOString()
    return {
      addTask(input: TaskInput) {
        const task: Task = {
          ...input,
          id: uid('task'),
          completed: false,
          completedAt: null,
          createdAt: now(),
        }
        setData((d) => ({ ...d, tasks: [task, ...d.tasks] }))
        return task
      },
      updateTask(id: string, input: Partial<Task>) {
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...input } : t)),
        }))
      },
      toggleTask(id: string) {
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: t.completed ? null : now(),
                }
              : t,
          ),
        }))
      },
      deleteTask(id: string) {
        setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))
      },
      restoreTask(task: Task) {
        setData((d) => ({ ...d, tasks: [task, ...d.tasks] }))
      },
      clearCompletedTasks() {
        setData((d) => ({ ...d, tasks: d.tasks.filter((t) => !t.completed) }))
      },
      addNote(input: NoteInput) {
        const note: Note = {
          ...input,
          id: uid('note'),
          pinned: false,
          createdAt: now(),
          updatedAt: now(),
        }
        setData((d) => ({ ...d, notes: [note, ...d.notes] }))
        return note
      },
      updateNote(id: string, input: Partial<Note>) {
        setData((d) => ({
          ...d,
          notes: d.notes.map((n) =>
            n.id === id ? { ...n, ...input, updatedAt: now() } : n,
          ),
        }))
      },
      deleteNote(id: string) {
        setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
      },
      restoreNote(note: Note) {
        setData((d) => ({ ...d, notes: [note, ...d.notes] }))
      },
      addClass(input: ClassInput) {
        setData((d) => ({
          ...d,
          classes: [...d.classes, { ...input, id: uid('class') }],
        }))
      },
      updateClass(id: string, input: ClassInput) {
        setData((d) => ({
          ...d,
          classes: d.classes.map((c) => (c.id === id ? { ...input, id } : c)),
        }))
      },
      deleteClass(id: string) {
        setData((d) => ({
          ...d,
          classes: d.classes.filter((c) => c.id !== id),
        }))
      },
      addSubject(input: SubjectInput) {
        const subject = { ...input, id: uid('sub') }
        setData((d) => ({ ...d, subjects: [...d.subjects, subject] }))
        return subject
      },
      updateSubject(id: string, input: SubjectInput) {
        setData((d) => ({
          ...d,
          subjects: d.subjects.map((s) => (s.id === id ? { ...input, id } : s)),
        }))
      },
      deleteSubject(id: string) {
        // Classes need a subject, so remove them; tasks and notes become "General".
        setData((d) => ({
          ...d,
          subjects: d.subjects.filter((s) => s.id !== id),
          classes: d.classes.filter((c) => c.subjectId !== id),
          tasks: d.tasks.map((t) =>
            t.subjectId === id ? { ...t, subjectId: '' } : t,
          ),
          notes: d.notes.map((n) =>
            n.subjectId === id ? { ...n, subjectId: '' } : n,
          ),
        }))
      },
      logFocusSession(minutes: number) {
        setData((d) => ({
          ...d,
          focusSessions: [
            ...d.focusSessions,
            { id: uid('focus'), completedAt: now(), minutes },
          ],
        }))
      },
      updatePrefs(input: Partial<Preferences>) {
        setData((d) => ({ ...d, prefs: { ...d.prefs, ...input } }))
      },
      loadSampleData() {
        setData((d) => {
          const sample = buildSampleData()
          return {
            ...d,
            subjects: sample.subjects,
            tasks: sample.tasks,
            notes: sample.notes,
            classes: sample.classes,
          }
        })
      },
      resetAllData() {
        setData((d) => ({
          ...EMPTY_DATA,
          prefs: { ...DEFAULT_PREFS, theme: d.prefs.theme },
        }))
      },
    }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ ...data, hydrated, getSubject, ...actions }),
    [data, hydrated, getSubject, actions],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
