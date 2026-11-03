import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpenText, Pencil, Pin, PinOff, Plus, Search, SearchX, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Note } from '@/lib/types'
import { useStore } from '@/lib/store'
import { formatRelative } from '@/lib/dates'
import { SUBJECT_COLORS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { NoteDialog } from '@/components/note-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SubjectBadge, SubjectDot } from '@/components/subject-badge'

export const Route = createFileRoute('/notes')({
  head: () => ({ meta: [{ title: 'Notes — StudySphere' }] }),
  component: NotesPage,
})

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/20 px-0.5 text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

function NotesPage() {
  const { notes, subjects, getSubject, updateNote, deleteNote, restoreNote } = useStore()
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)

  const countBySubject = useMemo(() => {
    const map = new Map<string, number>()
    notes.forEach((n) => map.set(n.subjectId, (map.get(n.subjectId) ?? 0) + 1))
    return map
  }, [notes])

  const q = query.trim()
  const visible = useMemo(() => {
    const lower = q.toLowerCase()
    return notes
      .filter((n) => subject === 'all' || n.subjectId === subject)
      .filter(
        (n) =>
          !lower ||
          n.title.toLowerCase().includes(lower) ||
          n.content.toLowerCase().includes(lower),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  }, [notes, subject, q])

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const chips: { id: string; label: string; dot?: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'All notes', count: notes.length },
    ...subjects.map((s) => ({ id: s.id, label: s.name, dot: <SubjectDot subject={s} />, count: countBySubject.get(s.id) ?? 0 })),
    ...(countBySubject.get('') ? [{ id: '', label: 'General', dot: <SubjectDot subject={getSubject('')} />, count: countBySubject.get('') ?? 0 }] : []),
  ]

  return (
    <div>
      <PageHeader
        icon={BookOpenText}
        title="Notes"
        description="Your digital notebook — searchable and organised by subject."
        actions={
          <Button onClick={openNew}>
            <Plus /> New note
          </Button>
        }
      />

      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles and content…"
            className="h-11 rounded-xl bg-card pl-10 shadow-soft"
            aria-label="Search notes"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by subject">
          {chips.map((c) => (
            <button
              key={c.id || 'general'}
              onClick={() => setSubject(c.id)}
              aria-pressed={subject === c.id}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                subject === c.id ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted',
              )}
            >
              {c.dot}
              {c.label}
              <span className="text-xs tabular-nums text-muted-foreground">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={BookOpenText}
          title="Your notebook is empty"
          description="Create notes for lessons, formulas and revision summaries. They’re saved right in your browser."
          action={
            <Button onClick={openNew}>
              <Plus /> Create your first note
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No notes found"
          description={q ? `Nothing matches “${q}”.` : 'There are no notes for this subject yet.'}
          action={
            <>
              {(q || subject !== 'all') && (
                <Button variant="outline" onClick={() => { setQuery(''); setSubject('all') }}>
                  Show all notes
                </Button>
              )}
              <Button onClick={openNew}>
                <Plus /> New note
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((n) => {
            const s = getSubject(n.subjectId)
            return (
              <article
                key={n.id}
                className={cn(
                  'group flex flex-col rounded-2xl border border-t-4 bg-card p-5 shadow-soft transition-all animate-fade-up hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none',
                  SUBJECT_COLORS[s.color].top,
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <SubjectBadge subject={s} />
                  {n.pinned && <Pin className="size-4 fill-primary text-primary" aria-label="Pinned" />}
                </div>
                <button
                  className="text-left focus-visible:outline-none"
                  onClick={() => { setEditing(n); setDialogOpen(true) }}
                >
                  <h2 className="font-display text-lg leading-snug font-bold break-words group-hover:text-primary">
                    <Highlight text={n.title} query={q} />
                  </h2>
                  <p className="mt-2 line-clamp-5 text-sm whitespace-pre-line text-muted-foreground break-words">
                    <Highlight text={n.content} query={q} />
                  </p>
                </button>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-xs text-muted-foreground">Edited {formatRelative(n.updatedAt)}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        updateNote(n.id, { pinned: !n.pinned })
                        toast.success(n.pinned ? 'Note unpinned' : 'Note pinned to top')
                      }}
                      aria-label={n.pinned ? `Unpin “${n.title}”` : `Pin “${n.title}”`}
                    >
                      {n.pinned ? <PinOff /> : <Pin />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditing(n); setDialogOpen(true) }}
                      aria-label={`Edit “${n.title}”`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(n)}
                      aria-label={`Delete “${n.title}”`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        note={editing}
        defaultSubjectId={subject === 'all' ? '' : subject}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this note?"
        description={deleting ? `“${deleting.title}” will be permanently removed.` : ''}
        onConfirm={() => {
          if (!deleting) return
          const note = deleting
          deleteNote(note.id)
          toast.success('Note deleted', {
            description: note.title,
            action: { label: 'Undo', onClick: () => { restoreNote(note); toast.success('Note restored') } },
          })
        }}
      />
    </div>
  )
}
