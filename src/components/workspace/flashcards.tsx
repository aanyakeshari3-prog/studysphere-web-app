import { useConfirmation } from './use-confirmation'
import { useState } from 'react'
import { Layers, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { uid, useStore } from '@/lib/store'
import { reviewCard } from '@/lib/review'
import { toDateKey } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/page-header'
export function FlashcardWorkspace() {
  const { cards, setCards, logActivity } = useStore()
  const { confirm, dialog } = useConfirmation()
  const [deck, setDeck] = useState('all')
  const [form, setForm] = useState({
    deck: 'My study deck',
    front: '',
    back: '',
  })
  const [flipped, setFlipped] = useState(false)
  const [practice, setPractice] = useState(false)
  const [query, setQuery] = useState('')
  const decks = [...new Set(cards.map((c) => c.deck))]
  const visible = cards.filter(
    (c) =>
      (deck === 'all' || c.deck === deck) &&
      `${c.front} ${c.back} ${c.deck}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const due = visible.filter((c) => new Date(c.due) <= new Date())
  const card = (practice ? visible : due)[0]
  return (
    <div>
      {dialog}
      <PageHeader
        icon={Layers}
        title="Flashcards"
        description="A little recall today. A stronger memory tomorrow."
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="rounded-xl border bg-card px-5 py-3 text-sm">
          <b className="text-primary">{due.length}</b> due for review
        </div>
        <div className="rounded-xl border bg-card px-5 py-3 text-sm">
          <b className="text-primary">
            {
              cards.filter(
                (c) =>
                  c.lastReviewed &&
                  toDateKey(new Date(c.lastReviewed)) === toDateKey(),
              ).length
            }
          </b>{' '}
          cards reviewed today
        </div>
        <div className="rounded-xl border bg-card px-5 py-3 text-sm">
          <b className="text-primary">
            {cards.filter((c) => c.interval >= 8).length}
          </b>{' '}
          cards at 8+ day intervals
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <select
          className="workspace-select"
          aria-label="Flashcard deck"
          value={deck}
          onChange={(e) => {
            setDeck(e.target.value)
            setFlipped(false)
          }}
        >
          <option value="all">All decks</option>
          {decks.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <Input
          className="min-w-40 flex-1"
          aria-label="Search flashcards"
          placeholder="Search cards…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={async () => {
            setPractice(!practice)
            setFlipped(false)
          }}
        >
          {practice ? 'Due cards only' : 'Practice all cards'}
        </Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          {card ? (
            <>
              <p className="text-xs font-semibold tracking-wider text-primary">
                {card.deck} · NEXT REVIEW{' '}
                {new Date(card.due).toLocaleDateString()}
              </p>
              <button
                className="my-5 grid min-h-64 w-full place-items-center rounded-2xl bg-accent/50 p-6 text-center text-xl font-semibold"
                onClick={() => setFlipped(!flipped)}
                aria-label="Flip flashcard"
              >
                {flipped ? card.back : card.front}
              </button>
              <Button
                className="mb-4"
                variant="outline"
                onClick={() => setFlipped(!flipped)}
              >
                <RotateCcw />
                {flipped ? 'Show question' : 'Reveal answer'}
              </Button>
              {flipped && (
                <div className="flex flex-wrap gap-2">
                  {(['Difficult', 'Medium', 'Easy'] as const).map((r) => (
                    <Button
                      key={r}
                      variant={r === 'Easy' ? 'default' : 'outline'}
                      onClick={async () => {
                        setCards(
                          cards.map((c) =>
                            c.id === card.id ? reviewCard(c, r) : c,
                          ),
                        )
                        setFlipped(false)
                        setPractice(false)
                        logActivity(`Reviewed flashcard: ${r}`)
                        toast.success('Next review scheduled')
                      }}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid min-h-80 place-items-center text-center">
              <div>
                <Layers className="mx-auto mb-4 size-12 text-primary/40" />
                <h2 className="text-xl font-bold">
                  {visible.length
                    ? 'You’re all caught up.'
                    : 'Build your first deck.'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create cards here or generate them from notes and documents.
                </p>
              </div>
            </div>
          )}
        </section>
        <form
          className="space-y-4 rounded-2xl border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.front.trim() || !form.back.trim() || !form.deck.trim())
              return
            setCards([
              ...cards,
              {
                ...form,
                deck: form.deck.trim(),
                id: uid('card'),
                due: new Date().toISOString(),
                interval: 0,
                reviews: 0,
              },
            ])
            setForm({ ...form, front: '', back: '' })
            toast.success('Flashcard created')
          }}
        >
          <h2 className="font-bold">Create a flashcard</h2>
          <label className="block text-sm">
            Deck
            <Input
              required
              maxLength={100}
              value={form.deck}
              onChange={(e) => setForm({ ...form, deck: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Question
            <Textarea
              required
              maxLength={2000}
              value={form.front}
              onChange={(e) => setForm({ ...form, front: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Answer
            <Textarea
              required
              maxLength={4000}
              value={form.back}
              onChange={(e) => setForm({ ...form, back: e.target.value })}
            />
          </label>
          <Button>
            <Plus /> Add card
          </Button>
        </form>
      </div>
      <div className="mt-6 space-y-2">
        {visible.slice(0, 50).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm"
          >
            <span>
              <b>{c.front}</b>
              <span className="ml-2 text-muted-foreground">
                {c.deck} · {c.reviews} reviews · due{' '}
                {new Date(c.due).toLocaleDateString()}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete flashcard"
              onClick={async () => {
                if (await confirm('Delete this flashcard?')) {
                  setCards(cards.filter((x) => x.id !== c.id))
                  toast.success('Card deleted')
                }
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
