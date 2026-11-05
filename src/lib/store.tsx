import { useAuth } from './auth'
import { api, exportJson } from './api'
import type { Notebook, Flashcard, StudyActivity } from './types'
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

/** Legacy browser keys are retained only for an explicit account import. */
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

export interface AppData {
  notebooks: Notebook[]
  cards: Flashcard[]
  activities: StudyActivity[]
  tasks: Task[]
  notes: Note[]
  subjects: Subject[]
  classes: ClassSession[]
  focusSessions: FocusSession[]
  prefs: Preferences
}

const EMPTY_DATA: AppData = {
  notebooks: [],
  cards: [],
  activities: [],
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
    return true
  } catch {
    // The caller reports recovery limitations while cloud saving still proceeds.
    return false
  }
}

export type TaskInput = Pick<
  Task,
  | 'title'
  | 'subjectId'
  | 'dueDate'
  | 'priority'
  | 'notes'
  | 'reminderAt'
  | 'noteId'
>
export type NoteInput = Pick<Note, 'title' | 'content' | 'subjectId'>
export type ClassInput = Omit<ClassSession, 'id'>
export type SubjectInput = Omit<Subject, 'id'>

interface StoreValue extends AppData {
  hydrated: boolean
  syncStatus: string
  syncError: string
  retrySave: () => void
  recoverDraft: () => void
  discardDraft: () => void
  exportBackup: () => void
  importLegacy: () => void
  setNotebooks: (value: Notebook[]) => void
  setCards: (value: Flashcard[]) => void
  logActivity: (title: string) => void
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
  purgeNote: (id: string) => void
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
  const { userId } = useAuth()
  const revision = useRef(0)
  const saved = useRef<AppData | null>(null)
  const latest = useRef(data)
  useEffect(() => {
    latest.current = data
  }, [data])
  const [syncStatus, setSyncStatus] = useState('Loading cloud workspace…')
  const [syncError, setSyncError] = useState('')
  const [retry, setRetry] = useState(0)
  const saving = useRef(false)
  const recoveryAvailable = useRef(true)
  const [tick, setTick] = useState(0)
  const cacheKey = `studysphere.draft.${userId}`
  const conflictKey = `studysphere.conflict.${userId}`
  const resolvingConflict = useRef(false)
  useEffect(() => {
    let active = true
    void api<{ data: Partial<AppData> | null; revision: number }>(
      '/api/workspace',
    )
      .then((row) => {
        if (!active) return
        const loaded = {
          ...EMPTY_DATA,
          ...row.data,
          prefs: { ...DEFAULT_PREFS, ...row.data?.prefs },
        }
        revision.current = row.revision
        saved.current = loaded
        setData(loaded)
        setHydrated(true)
        setSyncStatus('Saved to cloud')
        const draft = read<{ revision: number; data: AppData } | null>(
          cacheKey,
          null,
        )
        if (draft && JSON.stringify(draft.data) !== JSON.stringify(loaded)) {
          if (draft.revision === row.revision) {
            setData(draft.data)
            setSyncStatus('Recovering unsaved draft…')
          } else {
            if (!read(conflictKey, null)) write(conflictKey, draft)
            setSyncError(
              'An unsaved browser draft conflicts with the cloud version. Export it before clearing it.',
            )
            setSyncStatus('Draft needs review')
          }
        }
        if (read(conflictKey, null)) {
          setSyncError(
            'A conflicting browser draft is preserved. Export both versions or explicitly recover or discard the draft.',
          )
          setSyncStatus('Draft needs review')
        }
      })
      .catch((error) => {
        if (active) {
          setSyncError(error.message)
          setSyncStatus('Cloud unavailable')
        }
      })
    return () => {
      active = false
    }
  }, [userId, cacheKey, conflictKey])

  useEffect(() => {
    if (!hydrated || saved.current === data) return
    // Private recovery cache; the database remains the source of truth.
    recoveryAvailable.current = write(cacheKey, {
      revision: revision.current,
      data,
    })
    if (syncError) return
    // The status reflects synchronization with the external cloud save queue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncStatus('Unsaved changes…')
    const timer = window.setTimeout(async () => {
      if (saving.current) return
      saving.current = true
      setSyncStatus('Saving…')
      const snapshot = latest.current
      try {
        const result = await api<{ revision: number }>('/api/workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: snapshot, revision: revision.current }),
        })
        revision.current = result.revision
        saved.current = snapshot
        if (latest.current === snapshot) {
          try {
            localStorage.removeItem(cacheKey)
            if (resolvingConflict.current) {
              localStorage.removeItem(conflictKey)
              resolvingConflict.current = false
            }
          } catch {
            /* Cloud save already succeeded. */
          }
          setSyncStatus('Saved to cloud')
        } else
          write(cacheKey, { revision: result.revision, data: latest.current })
      } catch (error) {
        setSyncError(
          (error instanceof Error ? error.message : 'Cloud saving failed.') +
            (recoveryAvailable.current
              ? ' Browser recovery draft is available.'
              : ' Browser storage is full or blocked. Export a backup before leaving.'),
        )
        setSyncStatus('Not saved to cloud')
      } finally {
        saving.current = false
        setTick((t) => t + 1)
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [data, hydrated, syncError, retry, tick, cacheKey, conflictKey])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saved.current !== latest.current && hydrated) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hydrated])

  // Keep the <html> class in sync with the chosen theme.
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle(
      'dark',
      data.prefs.theme === 'dark',
    )
  }, [data.prefs.theme, hydrated])

  const getSubject = useCallback(
    (id: string) => data.subjects.find((s) => s.id === id) ?? NO_SUBJECT,
    [data.subjects],
  )

  const actions = useMemo(() => {
    const now = () => new Date().toISOString()
    return {
      setNotebooks(notebooks: Notebook[]) {
        setData((d) => ({ ...d, notebooks }))
      },
      setCards(cards: Flashcard[]) {
        setData((d) => ({ ...d, cards }))
      },
      logActivity(title: string) {
        setData((d) => ({
          ...d,
          activities: [
            { id: uid('activity'), title, completedAt: now() },
            ...d.activities,
          ],
        }))
      },
      addTask(input: TaskInput) {
        const task: Task = {
          ...input,
          id: uid('task'),
          completed: false,
          completedAt: null,
          createdAt: now(),
        }
        setData((d) => ({
          ...d,
          tasks: [task, ...d.tasks.filter((t) => t.id !== task.id)],
        }))
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
        setData((d) => ({
          ...d,
          tasks: [task, ...d.tasks.filter((t) => t.id !== task.id)],
        }))
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
        setData((d) => ({
          ...d,
          notes: [
            { ...note, deletedAt: null },
            ...d.notes.filter((n) => n.id !== note.id),
          ],
        }))
        return note
      },
      updateNote(id: string, input: Partial<Note>) {
        setData((d) => ({
          ...d,
          notes: d.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...input,
                  updatedAt: Object.keys(input).every(
                    (key) => key === 'viewedAt',
                  )
                    ? n.updatedAt
                    : now(),
                }
              : n,
          ),
        }))
      },
      purgeNote(id: string) {
        setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
      },
      deleteNote(id: string) {
        setData((d) => ({
          ...d,
          notes: d.notes.map((n) =>
            n.id === id ? { ...n, deletedAt: now() } : n,
          ),
        }))
      },
      restoreNote(note: Note) {
        setData((d) => ({
          ...d,
          notes: [
            { ...note, deletedAt: null },
            ...d.notes.filter((n) => n.id !== note.id),
          ],
        }))
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
            subjects: [
              ...d.subjects,
              ...sample.subjects.filter(
                (s) => !d.subjects.some((existing) => existing.id === s.id),
              ),
            ],
            tasks: [...d.tasks, ...sample.tasks],
            notes: [...d.notes, ...sample.notes],
            classes: [...d.classes, ...sample.classes],
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
    () => ({
      ...data,
      hydrated,
      syncStatus,
      syncError,
      retrySave: () => {
        setSyncError('')
        setRetry((r) => r + 1)
        if (!hydrated) window.location.reload()
      },
      recoverDraft: () => {
        const draft =
          read<{ data: AppData } | null>(conflictKey, null) ||
          read<{ data: AppData } | null>(cacheKey, null)
        if (
          draft &&
          window.confirm(
            'Replace the current cloud workspace with the recovered browser draft? Export a backup first.',
          )
        ) {
          resolvingConflict.current = true
          setData(draft.data)
          setSyncError('')
          setRetry((r) => r + 1)
        }
      },
      discardDraft: () => {
        if (
          window.confirm(
            'Permanently discard browser recovery drafts and reload the cloud version? Export a backup first.',
          )
        ) {
          localStorage.removeItem(cacheKey)
          localStorage.removeItem(conflictKey)
          window.location.reload()
        }
      },
      exportBackup: () => {
        void api('/api/documents')
          .then((documents) =>
            exportJson({
              cloud: data,
              recoveredDraft: read(cacheKey, null),
              conflictingDraft: read(conflictKey, null),
              documents,
            }),
          )
          .catch(() =>
            exportJson({
              cloud: data,
              recoveredDraft: read(cacheKey, null),
              conflictingDraft: read(conflictKey, null),
              documentMetadataUnavailable: true,
            }),
          )
      },
      importLegacy: () => {
        if (
          !window.confirm(
            'Import the old browser data into this account? Existing cloud records are kept.',
          )
        )
          return
        setData((d) => {
          const merge = <T extends { id: string }>(a: T[], b: T[]) => [
            ...a,
            ...b.filter((x) => !a.some((y) => x.id === y.id)),
          ]
          return {
            ...d,
            tasks: merge(d.tasks, read(STORAGE_KEYS.tasks, [])),
            notes: merge(d.notes, read(STORAGE_KEYS.notes, [])),
            subjects: merge(d.subjects, read(STORAGE_KEYS.subjects, [])),
            classes: merge(d.classes, read(STORAGE_KEYS.classes, [])),
            focusSessions: merge(d.focusSessions, read(STORAGE_KEYS.focus, [])),
          }
        })
      },
      getSubject,
      ...actions,
    }),
    [
      data,
      hydrated,
      getSubject,
      actions,
      syncStatus,
      syncError,
      cacheKey,
      conflictKey,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
