import { useConfirmation } from './use-confirmation'
import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import {
  BookOpenText,
  Plus,
  Pin,
  Star,
  Archive,
  Copy,
  Trash2,
  Maximize2,
  X,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/page-header'
import { SubjectSelect, SubjectBadge } from '@/components/subject-badge'
import { RichEditor } from './rich-editor'
import { AiPanel } from './ai-panel'
import { DocumentLibrary } from './document-library'
export function NotesWorkspace({
  collection = 'all',
}: {
  collection?: string
}) {
  const {
    notes,
    notebooks,
    addNote,
    updateNote,
    deleteNote,
    purgeNote,
    restoreNote,
    getSubject,
    syncStatus,
  } = useStore()
  const { confirm, dialog } = useConfirmation()
  const hash = useRouterState({
    select: (state) => state.location.hash.replace(/^#/, ''),
  })
  const [selected, setSelected] = useState(
    hash.startsWith('notebook:') ? '' : hash,
  )
  useEffect(() => {
    // Follow external navigation from workspace search and dashboard links.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash && !hash.startsWith('notebook:')) setSelected(hash)
  }, [hash])
  const [query, setQuery] = useState('')
  const [notebook, setNotebook] = useState(
    hash.startsWith('notebook:') ? hash.slice(9) : 'all',
  )
  const [view, setView] = useState(collection)
  const [sort, setSort] = useState('updatedAt')
  const [limit, setLimit] = useState(30)
  const [zen, setZen] = useState(false)
  const [guide, setGuide] = useState<string[]>([])
  const [attachments, setAttachments] = useState(false)
  const visible = notes
    .filter((n) =>
      view === 'trash'
        ? !!n.deletedAt
        : !n.deletedAt &&
          (view === 'archive' ? n.archived : !n.archived) &&
          (view !== 'favorites' || n.favorite) &&
          (view !== 'pinned' || n.pinned) &&
          (view !== 'viewed' || !!n.viewedAt),
    )
    .filter((n) => notebook === 'all' || n.notebookId === notebook)
    .filter((n) =>
      [n.title, n.content, ...(n.tags || []), getSubject(n.subjectId).name]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === 'title'
          ? a.title.localeCompare(b.title)
          : (
              b[sort as 'updatedAt' | 'createdAt' | 'viewedAt'] || ''
            ).localeCompare(
              a[sort as 'updatedAt' | 'createdAt' | 'viewedAt'] || '',
            )),
    )
  const note = notes.find((n) => n.id === selected)
  const create = () => {
    const n = addNote({ title: 'Untitled note', content: '', subjectId: '' })
    if (notebook !== 'all') updateNote(n.id, { notebookId: notebook })
    setSelected(n.id)
    setView('all')
    toast.success('Note created')
  }
  return (
    <div>
      {dialog}
      <PageHeader
        icon={BookOpenText}
        title={
          collection === 'favorites'
            ? 'Favorites'
            : collection === 'trash'
              ? 'Recently deleted'
              : 'My Notes'
        }
        description="A little space for your next big idea."
        actions={
          <Button onClick={create}>
            <Plus /> New note
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input
          className="min-w-40 flex-1"
          aria-label="Search notes"
          placeholder="Search notes, tags, subjects…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(30)
          }}
        />
        <select
          className="workspace-select"
          aria-label="Note collection"
          value={view}
          onChange={(e) => {
            setView(e.target.value)
            setSelected('')
          }}
        >
          {[
            ['all', 'All notes'],
            ['pinned', 'Pinned'],
            ['favorites', 'Favorites'],
            ['viewed', 'Recently viewed'],
            ['archive', 'Archive'],
            ['trash', 'Trash'],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="workspace-select"
          aria-label="Filter notebook"
          value={notebook}
          onChange={(e) => setNotebook(e.target.value)}
        >
          <option value="all">All notebooks</option>
          {notebooks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <select
          className="workspace-select"
          aria-label="Sort notes"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updatedAt">Last edited</option>
          <option value="createdAt">Date created</option>
          <option value="title">Title</option>
          <option value="viewedAt">Last viewed</option>
        </select>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="max-h-[48vh] space-y-2 overflow-y-auto xl:max-h-[75vh]">
          {visible.slice(0, limit).map((n) => (
            <article
              key={n.id}
              className={`rounded-xl border bg-card p-4 shadow-soft ${selected === n.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <div className="flex gap-2">
                <input
                  type="checkbox"
                  aria-label={`Include ${n.title} in study guide`}
                  checked={guide.includes(n.id)}
                  onChange={(e) =>
                    setGuide(
                      e.target.checked
                        ? [...guide, n.id]
                        : guide.filter((id) => id !== n.id),
                    )
                  }
                />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    setSelected(n.id)
                    requestAnimationFrame(() => {
                      if (window.innerWidth < 1280)
                        document
                          .getElementById('workspace-editor')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                    })
                    if (!n.deletedAt)
                      updateNote(n.id, { viewedAt: new Date().toISOString() })
                  }}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">
                      {n.title || 'Untitled note'}
                    </h2>
                    {n.pinned && (
                      <Pin className="size-3 shrink-0 text-primary" />
                    )}
                    {n.favorite && (
                      <Star className="size-3 shrink-0 text-primary" />
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {n.content || 'Start writing…'}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {notebooks.find((b) => b.id === n.notebookId)?.title ||
                      'Unfiled'}{' '}
                    · {new Date(n.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.tags?.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-accent px-1 text-[10px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No notes here yet. Create a note or choose another collection.
            </div>
          )}
          {visible.length > limit && (
            <Button variant="outline" onClick={() => setLimit((l) => l + 30)}>
              Load more
            </Button>
          )}
          {guide.length > 0 && (
            <AiPanel
              defaultAction="Study Guide"
              content={notes
                .filter((n) => guide.includes(n.id))
                .map((n) => `${n.title}\n${n.content}`)
                .join('\n\n')}
            />
          )}
        </aside>
        {note ? (
          <section
            id="workspace-editor"
            className={
              zen
                ? 'fixed inset-0 z-50 overflow-auto bg-background p-4 sm:px-[12vw] sm:py-8'
                : 'min-w-0 scroll-mt-20 rounded-2xl border bg-card p-4 shadow-soft sm:p-6'
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <SubjectBadge subject={getSubject(note.subjectId)} />
              <span className="text-xs text-muted-foreground" role="status">
                {syncStatus}
              </span>
              <div className="flex gap-1">
                {[
                  [
                    'Pin',
                    Pin,
                    () => updateNote(note.id, { pinned: !note.pinned }),
                  ],
                  [
                    'Favorite',
                    Star,
                    () => updateNote(note.id, { favorite: !note.favorite }),
                  ],
                  [
                    'Archive',
                    Archive,
                    () => {
                      updateNote(note.id, { archived: !note.archived })
                      setSelected('')
                      toast.success(
                        note.archived ? 'Note restored' : 'Note archived',
                      )
                    },
                  ],
                  [
                    'Duplicate',
                    Copy,
                    () => {
                      const n = addNote({
                        title: `${note.title} (copy)`,
                        content: note.content,
                        subjectId: note.subjectId,
                      })
                      updateNote(n.id, {
                        html: note.html,
                        notebookId: note.notebookId,
                        tags: note.tags,
                        color: note.color,
                      })
                      setSelected(n.id)
                      requestAnimationFrame(() => {
                        if (window.innerWidth < 1280)
                          document
                            .getElementById('workspace-editor')
                            ?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            })
                      })
                      toast.success('Note duplicated')
                    },
                  ],
                ].map(([label, Icon, run]) => {
                  const I = Icon as typeof Pin
                  return (
                    <Button
                      key={String(label)}
                      aria-label={String(label)}
                      title={String(label)}
                      size="icon-sm"
                      variant="ghost"
                      onClick={run as () => void}
                    >
                      <I />
                    </Button>
                  )
                })}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Distraction-free mode"
                  onClick={() => setZen(!zen)}
                >
                  {zen ? <X /> : <Maximize2 />}
                </Button>
              </div>
            </div>
            {note.deletedAt ? (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">{note.title}</h2>
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                <Button
                  onClick={async () => {
                    restoreNote(note)
                    toast.success('Note restored')
                    setView('all')
                  }}
                >
                  <RotateCcw /> Restore note
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (
                      await confirm(
                        'Permanently delete this note? This cannot be undone.',
                      )
                    ) {
                      purgeNote(note.id)
                      setSelected('')
                      toast.success('Note permanently deleted')
                    }
                  }}
                >
                  Delete permanently
                </Button>
              </div>
            ) : (
              <>
                <Input
                  className="mb-4 h-14 border-none px-0 text-2xl font-bold shadow-none md:text-2xl"
                  aria-label="Note title"
                  maxLength={100}
                  value={note.title}
                  onChange={(e) =>
                    updateNote(note.id, { title: e.target.value })
                  }
                />
                <div className="mb-5 grid gap-2 sm:grid-cols-2">
                  <SubjectSelect
                    value={note.subjectId}
                    onChange={(subjectId) => updateNote(note.id, { subjectId })}
                  />
                  <select
                    className="workspace-select"
                    aria-label="Move to notebook"
                    value={note.notebookId || ''}
                    onChange={(e) =>
                      updateNote(note.id, { notebookId: e.target.value })
                    }
                  >
                    <option value="">Unfiled</option>
                    {notebooks.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label="Tags, separated by commas"
                    placeholder="Tags, separated by commas"
                    key={`tags-${note.id}`}
                    defaultValue={note.tags?.join(', ') || ''}
                    onBlur={(e) =>
                      updateNote(note.id, {
                        tags: [
                          ...new Set(
                            e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          ),
                        ],
                      })
                    }
                  />
                  <label className="flex items-center gap-3 text-xs text-muted-foreground">
                    Note color
                    <input
                      aria-label="Note color"
                      type="color"
                      value={note.color || '#7363d8'}
                      onChange={(e) =>
                        updateNote(note.id, { color: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div
                  className="rounded border-l-4 pl-3"
                  style={{ borderColor: note.color || 'var(--primary)' }}
                >
                  <RichEditor
                    key={note.id}
                    note={note}
                    onChange={(patch) => updateNote(note.id, patch)}
                  />
                </div>
                <div className="mt-5 flex flex-wrap justify-between gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setAttachments(!attachments)}
                  >
                    Attachments & documents
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (
                        await confirm(
                          'Move this note to Trash? You can restore it later.',
                        )
                      ) {
                        deleteNote(note.id)
                        setSelected('')
                        toast.success('Note moved to Trash', {
                          action: {
                            label: 'Undo',
                            onClick: () => {
                              restoreNote(note)
                              toast.success('Note restored')
                            },
                          },
                        })
                      }
                    }}
                  >
                    <Trash2 /> Move to Trash
                  </Button>
                </div>
                {attachments && <DocumentLibrary attachmentNoteId={note.id} />}
              </>
            )}
          </section>
        ) : (
          <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed p-8 text-center">
            <div>
              <BookOpenText className="mx-auto mb-4 size-12 text-primary/40" />
              <h2 className="text-xl font-bold">Make room for your ideas</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Choose a note to keep writing, or start fresh. Your notes save
                automatically to your private workspace.
              </p>
              <Button className="mt-5" onClick={create}>
                <Plus /> Create a note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
