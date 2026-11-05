import { useConfirmation } from './use-confirmation'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { FolderTree, Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { uid, useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
export function NotebooksWorkspace() {
  const { notebooks, setNotebooks, notes, subjects, updateNote } = useStore()
  const { confirm, dialog } = useConfirmation()
  const [title, setTitle] = useState('')
  const [parentId, setParent] = useState('')
  const [subjectId, setSubject] = useState('')
  const [editing, setEditing] = useState('')
  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const item = {
      id: editing || uid('book'),
      title: title.trim(),
      parentId,
      subjectId,
    }
    setNotebooks(
      editing
        ? notebooks.map((n) => (n.id === editing ? item : n))
        : [...notebooks, item],
    )
    setTitle('')
    setEditing('')
    setParent('')
    setSubject('')
    toast.success('Notebook saved')
  }
  function path(id: string, seen: string[] = []): string {
    const n = notebooks.find((n) => n.id === id)
    return !n || seen.includes(id)
      ? ''
      : `${n.parentId ? path(n.parentId, [...seen, id]) + ' / ' : ''}${n.title}`
  }
  const descendants = (id: string): string[] =>
    notebooks
      .filter((n) => n.parentId === id)
      .flatMap((n) => [n.id, ...descendants(n.id)])
  return (
    <div>
      {dialog}
      <PageHeader
        icon={FolderTree}
        title="My Notebooks"
        description="Give every subject and idea a home."
      />
      <form
        onSubmit={save}
        className="mb-6 flex flex-wrap gap-3 rounded-2xl border bg-card p-5"
      >
        <Input
          className="min-w-40 flex-1"
          aria-label="Notebook title"
          placeholder="Notebook name"
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="workspace-select"
          aria-label="Parent notebook"
          value={parentId}
          onChange={(e) => setParent(e.target.value)}
        >
          <option value="">Top-level notebook</option>
          {notebooks
            .filter(
              (n) => n.id !== editing && !descendants(editing).includes(n.id),
            )
            .map((n) => (
              <option key={n.id} value={n.id}>
                {path(n.id)}
              </option>
            ))}
        </select>
        <select
          className="workspace-select"
          aria-label="Notebook subject"
          value={subjectId}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">Personal notebook</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button>
          <Plus />
          {editing ? 'Save notebook' : 'Create notebook'}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            type="button"
            onClick={async () => {
              setEditing('')
              setTitle('')
              setParent('')
            }}
          >
            Cancel
          </Button>
        )}
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {notebooks.map((n) => (
          <article
            key={n.id}
            className="rounded-2xl border bg-card p-5 shadow-soft"
          >
            <FolderTree className="mb-4 size-7 text-primary" />
            <p className="text-xs text-muted-foreground">
              {n.parentId
                ? path(n.parentId)
                : subjects.find((s) => s.id === n.subjectId)?.name ||
                  'Personal'}
            </p>
            <h2 className="mt-1 text-lg font-bold">{n.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {
                notes.filter(
                  (note) => note.notebookId === n.id && !note.deletedAt,
                ).length
              }{' '}
              notes
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/notes" hash={`notebook:${n.id}`}>
                  Open notes
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setEditing(n.id)
                  setTitle(n.title)
                  setParent(n.parentId)
                  setSubject(n.subjectId)
                }}
              >
                <Pencil /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (
                    !(await confirm(
                      'Delete this notebook? Its notes become unfiled and child notebooks move up.',
                    ))
                  )
                    return
                  setNotebooks(
                    notebooks
                      .filter((b) => b.id !== n.id)
                      .map((b) =>
                        b.parentId === n.id
                          ? { ...b, parentId: n.parentId }
                          : b,
                      ),
                  )
                  notes
                    .filter((note) => note.notebookId === n.id)
                    .forEach((note) => updateNote(note.id, { notebookId: '' }))
                  toast.success('Notebook deleted')
                }}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!notebooks.length && (
        <p className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Start with a subject, a semester, or a personal project.
        </p>
      )}
    </div>
  )
}
