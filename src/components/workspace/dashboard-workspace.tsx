import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { StudyDocument } from '@/lib/types'
import { Link } from '@tanstack/react-router'
import {
  BookOpenText,
  FolderTree,
  Layers,
  Sparkles,
  Plus,
  Pin,
} from 'lucide-react'
import { useStore, uid } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
export function DashboardWorkspace() {
  const { notes, notebooks, cards, setNotebooks, activities } = useStore()
  const [documents, setDocuments] = useState<StudyDocument[]>([])
  const [documentsError, setDocumentsError] = useState(false)
  useEffect(() => {
    void api<StudyDocument[]>('/api/documents')
      .then(setDocuments)
      .catch(() => setDocumentsError(true))
  }, [])
  const recent = notes
    .filter((n) => !n.deletedAt && !n.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)
  const pinned = notes
    .filter((n) => n.pinned && !n.deletedAt && !n.archived)
    .slice(0, 3)
  const due = cards.filter((c) => new Date(c.due) <= new Date()).length
  return (
    <section className="my-7 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Your learning workspace</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/notes">
              <Plus /> Note
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNotebooks([
                ...notebooks,
                {
                  id: uid('book'),
                  title: 'New notebook',
                  parentId: '',
                  subjectId: '',
                },
              ])
              toast.success('Notebook created. Rename it in Notebooks.')
            }}
          >
            <Plus /> Notebook
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/flashcards">
              <Plus /> Flashcards
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpenText className="size-4 text-primary" /> Continue writing
            </h3>
            <Link to="/notes" className="text-xs text-primary">
              All notes
            </Link>
          </div>
          {recent.length ? (
            recent.map((n) => (
              <Link
                key={n.id}
                to="/notes"
                hash={n.id}
                className="mt-4 block border-t pt-3"
              >
                <p className="text-sm font-semibold">
                  {n.title || 'Untitled note'}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {n.content || 'Start with a thought…'}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Edited {new Date(n.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Start a note and pick up where you left off.
            </p>
          )}
          {pinned.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Pin className="size-3" /> Pinned notes
              </p>
              {pinned.map((n) => (
                <Link
                  key={n.id}
                  to="/notes"
                  hash={n.id}
                  className="mt-2 block text-sm"
                >
                  {n.title}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {notebooks.slice(0, 4).map((b) => (
              <Link
                key={b.id}
                to="/notes"
                hash={`notebook:${b.id}`}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs"
              >
                <FolderTree className="size-3" />
                {b.title}
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Link
            to="/assistant"
            className="block rounded-2xl border border-primary/20 bg-primary/5 p-5"
          >
            <Sparkles className="mb-3 size-6 text-primary" />
            <h3 className="font-bold">A fresh way to understand</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Turn your notes into explanations, revision guides, and practice
              questions.
            </p>
          </Link>
          <Link
            to="/flashcards"
            className="block rounded-2xl border bg-card p-5"
          >
            <h3 className="flex items-center gap-2 font-semibold">
              <Layers className="size-4 text-primary" />
              {due} cards ready to review
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {activities.length} study activities completed. Keep your recall
              growing.
            </p>
          </Link>
          <Link
            className="block rounded-xl border bg-card p-4 text-sm text-primary"
            to="/documents"
          >
            Open your document library →
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold">Recent documents</h3>
        {documentsError ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Documents are temporarily unavailable. Open the library to retry.
          </p>
        ) : documents.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {documents.slice(0, 3).map((d) => (
              <Link
                key={d.id}
                to="/documents"
                hash={d.id}
                className="truncate rounded-lg bg-accent/50 p-3 text-sm"
              >
                {d.name}
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {(d.size / 1024).toFixed(1)} KB
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            to="/documents"
            className="mt-2 block text-sm text-muted-foreground"
          >
            Add your course materials to keep them close to your notes.
          </Link>
        )}
      </div>
    </section>
  )
}
