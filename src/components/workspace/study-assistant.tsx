import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { PageHeader } from '@/components/page-header'
import { AiPanel } from './ai-panel'
export function StudyAssistant() {
  const { notes, activities } = useStore()
  const [source, setSource] = useState('')
  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title="AI Study Assistant"
        description="Understand the why. Practice the how. Learn at your pace."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Choose a source (optional)
            <select
              className="workspace-select mt-2 w-full"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">General subject question</option>
              {notes
                .filter((n) => !n.deletedAt && !n.archived)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </label>
          <AiPanel
            content={notes.find((n) => n.id === source)?.content || ''}
            defaultAction="Ask"
          />
        </div>
        <aside className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold">Your study activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {activities.length} completed activities
          </p>
          <div className="mt-4 space-y-4">
            {activities.slice(0, 15).map((a) => (
              <div key={a.id}>
                <p className="text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.completedAt).toLocaleString()}
                </p>
              </div>
            ))}
            {!activities.length && (
              <p className="text-sm text-muted-foreground">
                Finish a quiz, review a card, or mark an explanation as studied
                to track your progress.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
