import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { matchesSearch, searchTerms } from '@/lib/search'
import type { StudyDocument } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
function Highlight({ text, query }: { text: string; query: string }) {
  const term = searchTerms(query).find((t) => text.toLowerCase().includes(t))
  const start = term ? text.toLowerCase().indexOf(term) : -1
  return start < 0 ? (
    <>{text.slice(0, 180)}</>
  ) : (
    <>
      {text.slice(Math.max(0, start - 50), start)}
      <mark className="rounded bg-primary/20 text-inherit">
        {text.slice(start, start + term!.length)}
      </mark>
      {text.slice(start + term!.length, start + 130)}
    </>
  )
}
export function GlobalSearch({ compact = false }: { compact?: boolean } = {}) {
  const { notes, notebooks, cards } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<StudyDocument[]>([])
  const [error, setError] = useState('')
  const [related, setRelated] = useState<string[]>([])
  const [thinking, setThinking] = useState(false)
  const results = [
    ...notes
      .filter((n) => !n.deletedAt)
      .map((n) => ({
        id: n.id,
        title: n.title,
        text: n.content,
        meta: `Note · ${notebooks.find((b) => b.id === n.notebookId)?.title || 'Unfiled'} · ${n.tags?.join(', ') || ''}`,
        to: '/notes' as const,
      })),
    ...notebooks.map((n) => ({
      id: n.id,
      title: n.title,
      text: '',
      meta: 'Notebook',
      to: '/notebooks' as const,
    })),
    ...docs.map((d) => ({
      id: d.id,
      title: d.name,
      text: d.extractedText,
      meta: `Document · ${notebooks.find((b) => b.id === d.notebookId)?.title || 'Unfiled'}`,
      to: '/documents' as const,
    })),
    ...cards.map((c) => ({
      id: c.id,
      title: c.front,
      text: c.back,
      meta: `Flashcard · ${c.deck}`,
      to: '/flashcards' as const,
    })),
  ].filter(
    (r) =>
      matchesSearch(`${r.title} ${r.text} ${r.meta}`, query) ||
      related.some((term) =>
        matchesSearch(`${r.title} ${r.text} ${r.meta}`, term),
      ),
  )
  return (
    <>
      <Button
        variant="outline"
        className="gap-2 text-muted-foreground"
        onClick={() => {
          setOpen(true)
          setError('')
          void api<StudyDocument[]>('/api/documents')
            .then(setDocs)
            .catch(() =>
              setError(
                'Documents could not be searched. Reopen search to retry.',
              ),
            )
        }}
      >
        <Search className="size-4" />
        <span className={compact ? 'sr-only' : ''}>Search your workspace</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Find your next connection</DialogTitle>
            <DialogDescription>
              Search notes, notebooks, tags, documents and flashcards. Try “Find
              my notes about photosynthesis”. Expand your query with AI to
              include related concepts. Only your search query is sent for this
              action.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Search your workspace…"
            aria-label="Global search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setRelated([])
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={thinking || !query.trim()}
              onClick={async () => {
                setThinking(true)
                setError('')
                try {
                  const response = await api<{ text: string }>(
                    '/api/study-ai',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'SearchTerms',
                        content: query,
                      }),
                    },
                  )
                  const terms = JSON.parse(response.text).terms
                  if (
                    !Array.isArray(terms) ||
                    !terms.every((t) => typeof t === 'string')
                  )
                    throw new Error('Search expansion was invalid. Try again.')
                  setRelated(terms.slice(0, 6).map((t) => t.slice(0, 100)))
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'AI search unavailable. Keyword search still works.',
                  )
                } finally {
                  setThinking(false)
                }
              }}
            >
              {thinking
                ? 'Finding related concepts…'
                : 'Include related concepts with AI'}
            </Button>
            {related.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Also matching: {related.join(', ')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {results.slice(0, 40).map((r) => (
              <Link
                key={`${r.to}-${r.id}`}
                to={r.to}
                hash={r.id}
                onClick={() => setOpen(false)}
                className="block rounded-xl border p-4 hover:bg-accent"
              >
                <p className="text-xs text-primary">{r.meta}</p>
                <h3 className="mt-1 font-semibold">
                  <Highlight text={r.title} query={query} />
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  <Highlight text={r.text} query={query} />
                </p>
              </Link>
            ))}
            {query && !results.length && (
              <p className="p-6 text-center text-muted-foreground">
                No results. Try a topic or tag.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
