import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Note } from '@/lib/types'
import { useStore, type NoteInput } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubjectSelect } from '@/components/subject-badge'
import { FieldError } from '@/components/field-error'

const MAX_CONTENT = 10_000

type Errors = Partial<Record<'title' | 'content', string>>

export function NoteDialog({
  open,
  onOpenChange,
  note,
  defaultSubjectId = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note | null
  defaultSubjectId?: string
}) {
  const { addNote, updateNote } = useStore()
  const [form, setForm] = useState<NoteInput>({ title: '', content: '', subjectId: '' })
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    // Reset controlled fields when an existing dialog is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    setForm(
      note
        ? { title: note.title, content: note.content, subjectId: note.subjectId }
        : { title: '', content: '', subjectId: defaultSubjectId },
    )
  }, [open, note, defaultSubjectId])

  const set = <K extends keyof NoteInput>(key: K, value: NoteInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: Errors = {}
    const title = form.title.trim()
    if (!title) found.title = 'Give your note a title.'
    else if (title.length > 100) found.title = 'Keep the title under 100 characters.'
    if (!form.content.trim()) found.content = 'Write something before saving.'
    else if (form.content.length > MAX_CONTENT)
      found.content = `Notes can be up to ${MAX_CONTENT.toLocaleString()} characters.`
    setErrors(found)
    if (Object.keys(found).length) return

    const clean = { ...form, title }
    if (note) {
      updateNote(note.id, clean)
      toast.success('Note saved')
    } else {
      addNote(clean)
      toast.success('Note created', { description: title })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{note ? 'Edit note' : 'New note'}</DialogTitle>
          <DialogDescription>
            Capture key ideas, formulas and summaries, organised by subject.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div className="grid gap-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Newton’s laws of motion"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'note-title-error' : undefined}
                autoFocus
              />
              <FieldError id="note-title-error" message={errors.title} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="note-subject">Subject</Label>
              <SubjectSelect
                id="note-subject"
                value={form.subjectId}
                onChange={(v) => set('subjectId', v)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note-content">Note</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
              </span>
            </div>
            <Textarea
              id="note-content"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Start writing…"
              rows={12}
              className="min-h-64 resize-y leading-relaxed"
              aria-invalid={!!errors.content}
              aria-describedby={errors.content ? 'note-content-error' : undefined}
            />
            <FieldError id="note-content-error" message={errors.content} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{note ? 'Save note' : 'Create note'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
