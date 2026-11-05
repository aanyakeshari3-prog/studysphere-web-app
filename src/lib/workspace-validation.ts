import { z } from 'zod'
const id = z.string().max(150)
const date = z.string().max(40)
const subjectColor = z.enum([
  'indigo',
  'violet',
  'sky',
  'emerald',
  'amber',
  'rose',
  'teal',
  'orange',
])
export const workspaceSchema = z.object({
  tasks: z
    .array(
      z.object({
        id,
        title: z.string().max(120),
        subjectId: id,
        dueDate: date,
        priority: z.enum(['low', 'medium', 'high']),
        notes: z.string().max(10000),
        completed: z.boolean(),
        completedAt: date.nullable(),
        createdAt: date,
        reminderAt: date.optional(),
        noteId: id.optional(),
      }),
    )
    .max(10000),
  notes: z
    .array(
      z.object({
        id,
        title: z.string().max(150),
        content: z.string().max(250000),
        subjectId: id,
        pinned: z.boolean(),
        createdAt: date,
        updatedAt: date,
        html: z.string().max(500000).optional(),
        notebookId: id.optional(),
        tags: z.array(z.string().max(100)).max(100).optional(),
        favorite: z.boolean().optional(),
        archived: z.boolean().optional(),
        deletedAt: date.nullable().optional(),
        viewedAt: date.optional(),
        color: z
          .string()
          .regex(/^#[a-f0-9]{6}$/i)
          .optional(),
        documentIds: z.array(id).optional(),
      }),
    )
    .max(10000),
  notebooks: z
    .array(
      z.object({ id, title: z.string().max(100), parentId: id, subjectId: id }),
    )
    .max(2000),
  cards: z
    .array(
      z.object({
        id,
        deck: z.string().max(100),
        front: z.string().max(10000),
        back: z.string().max(20000),
        due: date,
        interval: z.number().nonnegative().finite(),
        reviews: z.number().int().nonnegative(),
        lastReviewed: date.optional(),
      }),
    )
    .max(50000),
  activities: z
    .array(z.object({ id, title: z.string().max(1000), completedAt: date }))
    .max(50000),
  subjects: z
    .array(z.object({ id, name: z.string().max(100), color: subjectColor }))
    .max(2000),
  classes: z
    .array(
      z.object({
        id,
        subjectId: id,
        day: z.number().int().min(0).max(6),
        start: date,
        end: date,
        location: z.string().max(1000),
      }),
    )
    .max(10000),
  focusSessions: z
    .array(
      z.object({
        id,
        completedAt: date,
        minutes: z.number().nonnegative().finite(),
      }),
    )
    .max(50000),
  prefs: z.object({
    displayName: z.string().max(100),
    theme: z.enum(['light', 'dark']),
    sidebarCollapsed: z.boolean(),
    dailyFocusGoal: z.number().int().min(1).max(100),
  }),
})
