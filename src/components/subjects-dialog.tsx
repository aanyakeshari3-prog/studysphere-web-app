import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Subject, SubjectColor } from '@/lib/types'
import { useStore } from '@/lib/store'
import { COLOR_KEYS, SUBJECT_COLORS } from '@/lib/subjects'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldError } from '@/components/field-error'
import { SubjectDot } from '@/components/subject-badge'

function ColorPicker({ value, onChange }: { value: SubjectColor; onChange: (c: SubjectColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Subject colour" className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={SUBJECT_COLORS[c].label}
          onClick={() => onChange(c)}
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            SUBJECT_COLORS[c].dot,
            value === c && 'ring-2 ring-foreground/40',
          )}
        >
          {value === c && <Check className="size-4" />}
        </button>
      ))}
    </div>
  )
}

export function SubjectsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { subjects, tasks, notes, classes, addSubject, updateSubject, deleteSubject } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState<SubjectColor>('indigo')
  const [error, setError] = useState<string>()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<SubjectColor>('indigo')
  const [editError, setEditError] = useState<string>()
  const [deleting, setDeleting] = useState<Subject | null>(null)

  const validate = (value: string, ignoreId?: string) => {
    const v = value.trim()
    if (!v) return 'Enter a subject name.'
    if (v.length > 40) return 'Keep it under 40 characters.'
    if (subjects.some((s) => s.id !== ignoreId && s.name.toLowerCase() === v.toLowerCase()))
      return 'You already have a subject with this name.'
    return undefined
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate(name)
    setError(err)
    if (err) return
    addSubject({ name: name.trim(), color })
    toast.success('Subject added', { description: name.trim() })
    setName('')
    setColor(COLOR_KEYS[(COLOR_KEYS.indexOf(color) + 1) % COLOR_KEYS.length])
  }

  const saveEdit = () => {
    if (!editingId) return
    const err = validate(editName, editingId)
    setEditError(err)
    if (err) return
    updateSubject(editingId, { name: editName.trim(), color: editColor })
    toast.success('Subject updated')
    setEditingId(null)
  }

  const usage = (id: string) => ({
    tasks: tasks.filter((t) => t.subjectId === id).length,
    notes: notes.filter((n) => n.subjectId === id).length,
    classes: classes.filter((c) => c.subjectId === id).length,
  })

  const deletingUsage = deleting ? usage(deleting.id) : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage subjects</DialogTitle>
            <DialogDescription>
              Subjects colour-code your homework, notes and timetable.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={add} noValidate className="grid gap-3 rounded-2xl border bg-muted/40 p-4">
            <Label htmlFor="new-subject">New subject</Label>
            <div className="flex gap-2">
              <Input
                id="new-subject"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(undefined)
                }}
                placeholder="e.g. Geography"
                aria-invalid={!!error}
                aria-describedby={error ? 'new-subject-error' : undefined}
              />
              <Button type="submit">
                <Plus /> Add
              </Button>
            </div>
            <FieldError id="new-subject-error" message={error} />
            <ColorPicker value={color} onChange={setColor} />
          </form>

          {subjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No subjects yet — add one above.</p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {subjects.map((s) => {
                const u = usage(s.id)
                if (editingId === s.id)
                  return (
                    <li key={s.id} className="grid gap-3 p-3">
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value)
                            setEditError(undefined)
                          }}
                          aria-label="Subject name"
                          aria-invalid={!!editError}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveEdit()
                            }
                            if (e.key === 'Escape') {
                              e.stopPropagation()
                              setEditingId(null)
                            }
                          }}
                        />
                        <Button size="icon" onClick={saveEdit} aria-label="Save subject">
                          <Check />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel editing">
                          <X />
                        </Button>
                      </div>
                      <FieldError id={`edit-${s.id}-error`} message={editError} />
                      <ColorPicker value={editColor} onChange={setEditColor} />
                    </li>
                  )
                return (
                  <li key={s.id} className="flex items-center gap-3 p-3">
                    <SubjectDot subject={s} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.tasks} homework · {u.notes} notes · {u.classes} classes
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${s.name}`}
                      onClick={() => {
                        setEditingId(s.id)
                        setEditName(s.name)
                        setEditColor(s.color)
                        setEditError(undefined)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => setDeleting(s)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'subject'}?`}
        description={
          deletingUsage && (deletingUsage.classes || deletingUsage.tasks || deletingUsage.notes)
            ? `${deletingUsage.classes} timetable class${deletingUsage.classes === 1 ? '' : 'es'} will be removed. ${deletingUsage.tasks} homework and ${deletingUsage.notes} notes will move to “General”.`
            : 'This subject isn’t used anywhere yet.'
        }
        onConfirm={() => {
          if (!deleting) return
          deleteSubject(deleting.id)
          toast.success('Subject deleted', { description: deleting.name })
        }}
      />
    </>
  )
}
