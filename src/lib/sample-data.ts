import type { ClassSession, Note, Subject, Task } from './types'
import { addDays, toDateKey } from './dates'
import { DEFAULT_SUBJECTS } from './subjects'

/** Example content a new student can load from Settings or an empty state. */
export function buildSampleData(): {
  subjects: Subject[]
  tasks: Task[]
  notes: Note[]
  classes: ClassSession[]
} {
  const today = new Date()
  const day = (offset: number) => toDateKey(addDays(today, offset))
  const iso = (offsetDays: number) => addDays(today, offsetDays).toISOString()

  const task = (
    n: number,
    title: string,
    subjectId: string,
    due: number,
    priority: Task['priority'],
    completed = false,
    notes = '',
  ): Task => ({
    id: `sample-task-${n}`,
    title,
    subjectId,
    dueDate: day(due),
    priority,
    notes,
    completed,
    completedAt: completed ? iso(-1) : null,
    createdAt: iso(-5),
  })

  const tasks: Task[] = [
    task(1, 'Calculus problem set 4', 'sub-math', 0, 'high', false, 'Questions 1–15, show working.'),
    task(2, 'Lab report: Photosynthesis', 'sub-sci', 2, 'high'),
    task(3, 'Read chapters 5–6 of “Of Mice and Men”', 'sub-eng', 1, 'medium'),
    task(4, 'World War I timeline poster', 'sub-hist', 5, 'medium'),
    task(5, 'Python loops worksheet', 'sub-cs', -1, 'high', false, 'Submit on the class portal.'),
    task(6, 'Vocabulary quiz revision', 'sub-eng', 3, 'low'),
    task(7, 'Algebra review exercises', 'sub-math', -2, 'medium', true),
    task(8, 'Periodic table flashcards', 'sub-sci', -3, 'low', true),
  ]

  const note = (
    n: number,
    title: string,
    subjectId: string,
    content: string,
    updated: number,
    pinned = false,
  ): Note => ({
    id: `sample-note-${n}`,
    title,
    subjectId,
    content,
    pinned,
    createdAt: iso(updated - 2),
    updatedAt: iso(updated),
  })

  const notes: Note[] = [
    note(
      1,
      'Derivative rules cheat sheet',
      'sub-math',
      'Power rule: d/dx xⁿ = n·xⁿ⁻¹\nProduct rule: (uv)′ = u′v + uv′\nQuotient rule: (u/v)′ = (u′v − uv′) / v²\nChain rule: f(g(x))′ = f′(g(x))·g′(x)',
      0,
      true,
    ),
    note(
      2,
      'Photosynthesis summary',
      'sub-sci',
      '6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\n\nLight-dependent reactions happen in the thylakoid membranes. The Calvin cycle happens in the stroma.',
      -1,
    ),
    note(
      3,
      'Essay structure',
      'sub-eng',
      '1. Hook + thesis\n2. Three body paragraphs (point, evidence, explanation)\n3. Counter-argument\n4. Conclusion that restates the thesis in new words',
      -2,
    ),
    note(
      4,
      'Causes of WWI — MAIN',
      'sub-hist',
      'Militarism, Alliances, Imperialism, Nationalism. Trigger: assassination of Archduke Franz Ferdinand, June 1914.',
      -4,
    ),
  ]

  const cls = (
    n: number,
    subjectId: string,
    d: ClassSession['day'],
    start: string,
    end: string,
    location: string,
  ): ClassSession => ({ id: `sample-class-${n}`, subjectId, day: d, start, end, location })

  const classes: ClassSession[] = [
    cls(1, 'sub-math', 0, '09:00', '10:00', 'Room 204'),
    cls(2, 'sub-eng', 0, '10:15', '11:15', 'Room 112'),
    cls(3, 'sub-sci', 1, '09:00', '10:30', 'Lab B'),
    cls(4, 'sub-hist', 1, '11:00', '12:00', 'Room 301'),
    cls(5, 'sub-cs', 2, '13:00', '14:30', 'Computer Lab'),
    cls(6, 'sub-math', 2, '09:00', '10:00', 'Room 204'),
    cls(7, 'sub-eng', 3, '10:15', '11:15', 'Room 112'),
    cls(8, 'sub-sci', 3, '13:00', '14:00', 'Lab B'),
    cls(9, 'sub-math', 4, '09:00', '10:00', 'Room 204'),
    cls(10, 'sub-hist', 4, '11:00', '12:00', 'Room 301'),
  ]

  return { subjects: DEFAULT_SUBJECTS, tasks, notes, classes }
}
