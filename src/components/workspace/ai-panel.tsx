import { useState } from 'react'
import { Sparkles, Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { uid, useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
interface Question {
  question: string
  options: string[]
  answer: number
  explanation: string
}
export function AiPanel({
  content,
  onInsert,
  defaultAction = 'Summarize',
}: {
  content: string
  onInsert?: (text: string) => void
  defaultAction?: string
}) {
  const { cards, setCards, logActivity } = useStore()
  const [action, setAction] = useState(defaultAction)
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [generated, setGenerated] = useState<{ front: string; back: string }[]>(
    [],
  )
  const [saved, setSaved] = useState(false)
  async function run(requestedAction = action) {
    setBusy(true)
    setError('')
    setResult('')
    setQuiz([])
    setGenerated([])
    setAnswers({})
    setSaved(false)
    try {
      const response = await api<{ text: string }>('/api/study-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: requestedAction, content, question }),
      })
      if (requestedAction === 'Quiz') {
        const data = JSON.parse(response.text)
        if (
          !Array.isArray(data.questions) ||
          data.questions.length < 1 ||
          data.questions.length > 20 ||
          !data.questions.every(
            (q: Question) =>
              typeof q.question === 'string' &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              q.options.every(
                (option) => typeof option === 'string' && option.length > 0,
              ) &&
              typeof q.explanation === 'string' &&
              Number.isInteger(q.answer) &&
              q.answer >= 0 &&
              q.answer < 4,
          )
        )
          throw new Error('AI returned an invalid quiz. Please retry.')
        setQuiz(data.questions)
      } else if (requestedAction === 'Flashcards') {
        const data = JSON.parse(response.text)
        if (
          !Array.isArray(data.cards) ||
          data.cards.length < 1 ||
          data.cards.length > 20 ||
          !data.cards.every(
            (c: { front: string; back: string }) =>
              typeof c.front === 'string' &&
              c.front.length > 0 &&
              c.front.length <= 10000 &&
              typeof c.back === 'string' &&
              c.back.length > 0 &&
              c.back.length <= 20000,
          )
        )
          throw new Error('AI returned invalid flashcards. Please retry.')
        setGenerated(data.cards)
      } else setResult(response.text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-primary" /> StudySphere AI
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="AI action"
          className="workspace-select flex-1"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {[
            'Summarize',
            'Explain',
            'Improve Writing',
            'Bullet Points',
            'Structure Notes',
            'Key Concepts',
            'Revision Notes',
            'Expand',
            'Flashcards',
            'Quiz',
            'Study Guide',
            'Revision Plan',
            'Ask',
            'Hint',
          ].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <Button
          disabled={
            busy ||
            (!content.trim() &&
              action !== 'Ask' &&
              action !== 'Hint' &&
              action !== 'Revision Plan')
          }
          onClick={() => run()}
        >
          {busy ? 'Thinking…' : 'Generate'}
        </Button>
      </div>
      {(action === 'Ask' ||
        action === 'Hint' ||
        action === 'Revision Plan') && (
        <Input
          className="mt-2"
          placeholder="What would you like to understand or plan?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={2000}
        />
      )}
      {action === 'Ask' && (
        <Button
          className="mt-2"
          size="sm"
          variant="outline"
          disabled={busy || (!question.trim() && !content.trim())}
          onClick={() => run('Hint')}
        >
          Get a hint first
        </Button>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Generate sends only this source text and your question to AI. Check
        facts against your course materials.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-7">
            {result}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(result)
                  .then(() => toast.success('Copied'))
                  .catch(() => toast.error('Clipboard unavailable'))
              }}
            >
              <Copy /> Copy
            </Button>
            {onInsert && (
              <Button size="sm" onClick={() => onInsert(result)}>
                <Plus /> Add to note
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={saved}
              onClick={() => {
                logActivity(action)
                setSaved(true)
                toast.success('Study activity completed')
              }}
            >
              Mark studied
            </Button>
          </div>
        </>
      )}
      {generated.length > 0 && (
        <div className="mt-4 space-y-3">
          {generated.map((c, i) => (
            <div key={i} className="rounded-lg bg-card p-3 text-sm">
              <b>{c.front}</b>
              <p className="mt-1 text-muted-foreground">{c.back}</p>
            </div>
          ))}
          <Button
            disabled={saved}
            onClick={() => {
              setCards([
                ...cards,
                ...generated.map((c) => ({
                  ...c,
                  id: uid('card'),
                  deck: 'AI study cards',
                  due: new Date().toISOString(),
                  interval: 0,
                  reviews: 0,
                })),
              ])
              setSaved(true)
              toast.success('Cards added to AI study cards')
            }}
          >
            {saved ? 'Cards saved' : 'Save flashcards'}
          </Button>
        </div>
      )}
      {quiz.map((q, i) => (
        <div key={i} className="mt-4 rounded-xl bg-card p-4 text-sm">
          <p className="font-semibold">
            {i + 1}. {q.question}
          </p>
          <div className="mt-2 grid gap-2">
            {q.options.map((option, j) => (
              <Button
                className="h-auto justify-start whitespace-normal text-left"
                key={j}
                variant={answers[i] === j ? 'default' : 'outline'}
                disabled={answers[i] !== undefined}
                onClick={() => {
                  const next = { ...answers, [i]: j }
                  setAnswers(next)
                  if (Object.keys(next).length === quiz.length) {
                    logActivity('Completed AI quiz')
                    toast.success('Quiz completed')
                  }
                }}
              >
                {option}
              </Button>
            ))}
          </div>
          {answers[i] !== undefined && (
            <p className="mt-3">
              {answers[i] === q.answer
                ? 'Correct.'
                : `Correct answer: ${q.options[q.answer]}.`}{' '}
              {q.explanation}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
