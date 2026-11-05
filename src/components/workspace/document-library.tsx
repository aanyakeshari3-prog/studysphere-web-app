import { useConfirmation } from './use-confirmation'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { FileText, Upload, Download, Trash2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import type { StudyDocument } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AiPanel } from './ai-panel'
async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'txt') return file.text()
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    return (
      await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    ).value
  }
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    })
    try {
      const pdf = await task.promise
      const pages = []
      for (let i = 1; i <= Math.min(pdf.numPages, 150); i++) {
        const page = await pdf.getPage(i)
        const text = await page.getTextContent()
        pages.push(
          text.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        )
        if (pages.join('').length > 200000) break
      }
      return pages.join('\n').slice(0, 200000)
    } finally {
      await task.destroy()
    }
  }
  return ''
}
export function DocumentLibrary({
  attachmentNoteId,
}: {
  attachmentNoteId?: string
}) {
  const { notebooks, notes, updateNote } = useStore()
  const { confirm, dialog } = useConfirmation()
  const [docs, setDocs] = useState<StudyDocument[]>([])
  const [query, setQuery] = useState('')
  const [notebook, setNotebook] = useState('')
  const hash = useRouterState({
    select: (state) => state.location.hash.replace(/^#/, ''),
  })
  const [selected, setSelected] = useState(hash)
  useEffect(() => {
    // Synchronize a search result selected through navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash) setSelected(hash)
  }, [hash])
  const [progress, setProgress] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    setError('')
    void api<StudyDocument[]>('/api/documents')
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    void api<StudyDocument[]>('/api/documents')
      .then(setDocs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  async function upload(file?: File) {
    if (!file) return
    if (
      file.size > 4_000_000 ||
      !/\.(pdf|docx|txt|png|jpe?g|webp)$/i.test(file.name)
    ) {
      setError('Choose a supported file up to 4 MB.')
      return
    }
    setProgress(0)
    setError('')
    setStatus('Reading document…')
    try {
      let text = ''
      try {
        text = await extractText(file)
      } catch {
        toast.warning(
          'Text extraction failed. The original file can still be saved and downloaded.',
        )
      }
      const form = new FormData()
      form.append('file', file)
      form.append('text', text.slice(0, 200000))
      form.append('notebookId', notebook)
      setStatus('Uploading…')
      const row = await new Promise<StudyDocument>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/documents')
        xhr.timeout = 60000
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) resolve(data)
            else reject(new Error(data.error || 'Upload failed.'))
          } catch {
            reject(new Error('Upload failed. Please retry.'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error. Please retry.'))
        xhr.ontimeout = () =>
          reject(new Error('Upload timed out. Please retry.'))
        xhr.send(form)
      })
      setDocs((d) => [row, ...d])
      setSelected(row.id)
      if (attachmentNoteId) {
        const note = notes.find((n) => n.id === attachmentNoteId)
        updateNote(attachmentNoteId, {
          documentIds: [...(note?.documentIds || []), row.id],
        })
      }
      toast.success('Document uploaded')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setProgress(null)
      setStatus('')
    }
  }
  async function update(doc: StudyDocument, patch: Partial<StudyDocument>) {
    try {
      const row = await api<StudyDocument>(`/api/documents?id=${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, ...patch }),
      })
      setDocs((d) => d.map((x) => (x.id === doc.id ? row : x)))
      toast.success('Document updated')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const doc = docs.find((d) => d.id === selected)
  const visible = docs.filter(
    (d) =>
      (!notebook || d.notebookId === notebook) &&
      `${d.name} ${d.extractedText}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  return (
    <section className="mt-5 space-y-4">
      {dialog}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileText className="size-5 text-primary" /> Document library
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOCX, TXT and images · Up to 4 MB per file · Text PDFs up to
            150 pages
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Upload className="size-4" /> Upload
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            disabled={progress !== null}
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-40 flex-1"
          aria-label="Search documents"
          placeholder="Search titles and extracted text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="workspace-select"
          value={notebook}
          onChange={(e) => setNotebook(e.target.value)}
          aria-label="Document notebook"
        >
          <option value="">All notebooks / upload unfiled</option>
          {notebooks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>
      {progress !== null && (
        <div role="status">
          <p className="text-sm">
            {status} {progress}%
          </p>
          <progress
            className="w-full accent-primary"
            value={progress}
            max={100}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{' '}
          <Button variant="outline" size="sm" onClick={load}>
            Reload library
          </Button>
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_2fr]">
          <div className="space-y-2">
            {visible.map((d) => (
              <button
                key={d.id}
                className={`w-full rounded-xl border bg-card p-4 text-left ${selected === d.id ? 'border-primary' : ''}`}
                onClick={() => setSelected(d.id)}
              >
                <p className="truncate text-sm font-semibold">{d.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.name.split('.').pop()?.toUpperCase()} ·{' '}
                  {(d.size / 1024).toFixed(1)} KB
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {d.extractedText.slice(
                    Math.max(
                      0,
                      d.extractedText
                        .toLowerCase()
                        .indexOf(query.toLowerCase()) - 30,
                    ),
                    200,
                  ) || 'Preview available · No extracted text'}
                </p>
              </button>
            ))}
            {!visible.length && (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Upload your first study material, or try another search.
              </p>
            )}
          </div>
          {doc && (
            <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
              <label className="block text-xs text-muted-foreground">
                Document title
                <Input
                  key={`${doc.id}-${doc.name}`}
                  defaultValue={doc.name}
                  maxLength={200}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== doc.name)
                      void update(doc, { name: e.target.value })
                  }}
                />
              </label>
              <select
                aria-label="Move document to notebook"
                className="workspace-select w-full"
                value={doc.notebookId}
                onChange={(e) =>
                  void update(doc, { notebookId: e.target.value })
                }
              >
                <option value="">Unfiled</option>
                {notebooks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={`/api/documents?id=${doc.id}&download=1`}>
                    <Download /> Download
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`/api/documents?id=${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open preview
                  </a>
                </Button>
                {attachmentNoteId && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const note = notes.find((n) => n.id === attachmentNoteId)
                      const ids = note?.documentIds || []
                      const attached = ids.includes(doc.id)
                      updateNote(attachmentNoteId, {
                        documentIds: attached
                          ? ids.filter((id) => id !== doc.id)
                          : [...ids, doc.id],
                      })
                      toast.success(
                        attached ? 'Attachment removed' : 'Document attached',
                      )
                    }}
                  >
                    <Paperclip />
                    {notes
                      .find((n) => n.id === attachmentNoteId)
                      ?.documentIds?.includes(doc.id)
                      ? 'Detach'
                      : 'Attach to note'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (!(await confirm('Permanently delete this document?')))
                      return
                    try {
                      await api(`/api/documents?id=${doc.id}`, {
                        method: 'DELETE',
                      })
                      setDocs((d) => d.filter((x) => x.id !== doc.id))
                      setSelected('')
                      toast.success('Document deleted')
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
              {doc.type.startsWith('image/') ? (
                <img
                  src={`/api/documents?id=${doc.id}`}
                  alt={doc.name}
                  className="max-h-80 rounded-lg object-contain"
                />
              ) : doc.type === 'application/pdf' ? (
                <iframe
                  title={doc.name}
                  src={`/api/documents?id=${doc.id}`}
                  className="h-80 w-full rounded-lg border"
                />
              ) : (
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-6">
                  {doc.extractedText}
                </pre>
              )}
              {doc.extractedText ? (
                <AiPanel
                  content={doc.extractedText.slice(0, 80000)}
                  defaultAction="Ask"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No readable text extracted. Scanned PDFs and images need OCR,
                  which is not available yet. Attach a text version to use AI.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
