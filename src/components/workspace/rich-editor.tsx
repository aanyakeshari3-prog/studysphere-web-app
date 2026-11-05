import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AiPanel } from './ai-panel'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import type { StudyDocument } from '@/lib/types'
import type { Note } from '@/lib/types'
export function RichEditor({
  note,
  onChange,
}: {
  note: Note
  onChange: (data: Partial<Note>) => void
}) {
  const [images, setImages] = useState<StudyDocument[] | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [link, setLink] = useState('')
  const [selected, setSelected] = useState('')
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Highlight,
      Image,
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note.html || {
      type: 'doc',
      content: note.content.split('\n').map((text) => ({
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      })),
    },
    onUpdate: ({ editor }) =>
      onChange({ html: editor.getHTML(), content: editor.getText() }),
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      setSelected(editor.state.doc.textBetween(from, to, ' '))
    },
  })
  if (!editor) return <p>Opening editor…</p>
  const tools: [string, () => void][] = [
    [
      'H1',
      () => {
        editor.chain().focus().toggleHeading({ level: 1 }).run()
      },
    ],
    [
      'H2',
      () => {
        editor.chain().focus().toggleHeading({ level: 2 }).run()
      },
    ],
    [
      'Text',
      () => {
        editor.chain().focus().setParagraph().run()
      },
    ],
    [
      'Bold',
      () => {
        editor.chain().focus().toggleBold().run()
      },
    ],
    [
      'Italic',
      () => {
        editor.chain().focus().toggleItalic().run()
      },
    ],
    [
      'Underline',
      () => {
        editor.chain().focus().toggleUnderline().run()
      },
    ],
    [
      'Highlight',
      () => {
        editor.chain().focus().toggleHighlight().run()
      },
    ],
    [
      'Bullets',
      () => {
        editor.chain().focus().toggleBulletList().run()
      },
    ],
    [
      'Numbers',
      () => {
        editor.chain().focus().toggleOrderedList().run()
      },
    ],
    [
      'Checklist',
      () => {
        editor.chain().focus().toggleTaskList().run()
      },
    ],
    [
      'Quote',
      () => {
        editor.chain().focus().toggleBlockquote().run()
      },
    ],
    [
      'Table',
      () => {
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run()
      },
    ],
    [
      '+ Row',
      () => {
        editor.chain().focus().addRowAfter().run()
      },
    ],
    [
      '+ Column',
      () => {
        editor.chain().focus().addColumnAfter().run()
      },
    ],
    [
      'Remove table',
      () => {
        editor.chain().focus().deleteTable().run()
      },
    ],
    [
      'Undo',
      () => {
        editor.chain().focus().undo().run()
      },
    ],
    [
      'Redo',
      () => {
        editor.chain().focus().redo().run()
      },
    ],
  ]
  return (
    <>
      <div
        className="flex flex-wrap gap-1 border-y py-2"
        role="toolbar"
        aria-label="Text formatting"
      >
        {tools.map(([label, run]) => (
          <Button
            key={label}
            size="sm"
            variant="ghost"
            type="button"
            onClick={run}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          type="url"
          aria-label="Link URL"
          placeholder="https://…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={!/^https?:\/\//.test(link)}
          onClick={() => {
            editor.chain().focus().setLink({ href: link }).run()
            setLink('')
          }}
        >
          Add link
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          Unlink
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={imageLoading}
          onClick={async () => {
            setImageLoading(true)
            try {
              const docs = await api<StudyDocument[]>('/api/documents')
              setImages(docs.filter((d) => d.type.startsWith('image/')))
            } catch {
              toast.error('Images could not be loaded. Try again.')
            } finally {
              setImageLoading(false)
            }
          }}
        >
          {imageLoading ? 'Loading images…' : 'Insert uploaded image'}
        </Button>
        {images && (
          <select
            className="workspace-select"
            aria-label="Choose uploaded image"
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              editor
                .chain()
                .focus()
                .setImage({
                  src: `/api/documents?id=${e.target.value}`,
                  alt:
                    images.find((i) => i.id === e.target.value)?.name ||
                    'Note image',
                })
                .run()
              setImages(null)
            }}
          >
            <option value="">
              {images.length
                ? 'Choose an image'
                : 'Upload an image in Documents first'}
            </option>
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <EditorContent editor={editor} className="study-editor" />
      <div className="mt-6">
        <p className="mb-2 text-xs text-muted-foreground">
          {selected ? 'AI source: selected text' : 'AI source: entire note'} ·{' '}
          {editor.getText().split(/\s+/).filter(Boolean).length} words
        </p>
        <AiPanel
          content={selected || note.content}
          onInsert={(text) =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'paragraph',
                content: [{ type: 'text', text }],
              })
              .run()
          }
        />
      </div>
    </>
  )
}
