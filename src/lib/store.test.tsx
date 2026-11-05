import { useEffect } from 'react'
import { render, waitFor, act, screen } from '@testing-library/react'
import { beforeEach, it, expect, vi } from 'vitest'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('./auth', () => ({ useAuth: () => ({ userId: 'student-a' }) }))
vi.mock('./api', () => ({ api: request, exportJson: vi.fn() }))
import { StoreProvider, useStore } from './store'
let store: ReturnType<typeof useStore>
function Probe() {
  const value = useStore()
  useEffect(() => {
    store = value
  }, [value])
  return (
    <div>
      {value.hydrated ? 'Loaded' : 'Loading'}
      <span>{value.syncStatus}</span>
    </div>
  )
}
beforeEach(() => {
  localStorage.clear()
  request.mockReset()
})
it('saves note edits, notebook moves, flashcard progress and task reminders across remounts', async () => {
  let remote: unknown = null
  let revision = 0
  request.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body))
      expect(body.revision).toBe(revision)
      remote = body.data
      return { revision: ++revision }
    }
    return { data: remote, revision }
  })
  const first = render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  )
  await screen.findByText('Loaded')
  act(() => {
    store.setNotebooks([
      { id: 'book', title: 'Biology', parentId: '', subjectId: '' },
    ])
    const note = store.addNote({
      title: 'Cells',
      content: 'Cells have membranes.',
      subjectId: '',
    })
    store.updateNote(note.id, { notebookId: 'book', favorite: true })
    store.addTask({
      title: 'Read chapter',
      subjectId: '',
      dueDate: '2026-11-20',
      priority: 'high',
      notes: '',
      reminderAt: '2026-11-19T18:00',
      noteId: note.id,
    })
    store.setCards([
      {
        id: 'card',
        deck: 'Biology',
        front: 'Cell?',
        back: 'Unit of life',
        reviews: 1,
        interval: 4,
        due: '2026-11-09T12:00:00Z',
      },
    ])
  })
  await waitFor(
    () =>
      expect(request.mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(true),
    { timeout: 2500 },
  )
  await waitFor(() => expect(store.syncStatus).toBe('Saved to cloud'))
  first.unmount()
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  )
  await screen.findByText('Loaded')
  expect(store.notes[0]).toMatchObject({
    title: 'Cells',
    notebookId: 'book',
    favorite: true,
  })
  expect(store.notebooks[0].title).toBe('Biology')
  expect(store.tasks[0].reminderAt).toBe('2026-11-19T18:00')
  expect(store.cards[0].reviews).toBe(1)
})
it('moves notes to trash and restores without duplicating records', async () => {
  request.mockResolvedValue({ data: null, revision: 0 })
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  )
  await screen.findByText('Loaded')
  let id = ''
  act(() => {
    id = store.addNote({
      title: 'Keep me',
      content: 'Original text',
      subjectId: '',
    }).id
  })
  const note = store.notes[0]
  act(() => store.deleteNote(id))
  expect(store.notes[0].deletedAt).toBeTruthy()
  act(() => {
    store.restoreNote(note)
    store.restoreNote(note)
  })
  expect(store.notes).toHaveLength(1)
  expect(store.notes[0].deletedAt).toBeNull()
})
it('retains a private recovery draft when the backend fails', async () => {
  request.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') throw new Error('Offline')
    return { data: null, revision: 0 }
  })
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  )
  await screen.findByText('Loaded')
  act(() =>
    store.addNote({
      title: 'Offline draft',
      content: 'Must survive a failure',
      subjectId: '',
    }),
  )
  await waitFor(() => expect(store.syncError).toContain('Offline'), {
    timeout: 2500,
  })
  expect(
    JSON.parse(localStorage.getItem('studysphere.draft.student-a')!).data
      .notes[0].content,
  ).toBe('Must survive a failure')
  expect(localStorage.getItem('studysphere.notes')).toBeNull()
})
it('does not silently overwrite a conflicting cloud version with an older browser draft', async () => {
  localStorage.setItem(
    'studysphere.draft.student-a',
    JSON.stringify({ revision: 1, data: { notes: [{ title: 'Old draft' }] } }),
  )
  request.mockResolvedValue({ data: null, revision: 4 })
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  )
  await screen.findByText('Loaded')
  expect(store.syncError).toMatch(/conflict/)
  expect(request).toHaveBeenCalledTimes(1)
  act(() =>
    store.addNote({
      title: 'New cloud draft',
      content: 'Keep both versions',
      subjectId: '',
    }),
  )
  expect(
    JSON.parse(localStorage.getItem('studysphere.conflict.student-a')!).data
      .notes[0].title,
  ).toBe('Old draft')
})
