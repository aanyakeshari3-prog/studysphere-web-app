import { transactionEvent } from '../lib/transaction-event'
import { protectedHandler } from '../lib/protected-handler'
import { recordEvent } from '../lib/admin-core'
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import { and, eq, desc } from 'drizzle-orm'
import { database } from '../../db/index'
import { documents } from '../../db/schema'
export default protectedHandler(async (req: Request) => {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (
    req.method !== 'GET' &&
    req.headers.get('origin') &&
    req.headers.get('origin') !== new URL(req.url).origin
  )
    return new Response(null, { status: 403 })
  try {
    const db = database()
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (req.method === 'GET' && !id)
      return Response.json(
        await db
          .select()
          .from(documents)
          .where(eq(documents.userId, user.id))
          .orderBy(desc(documents.createdAt)),
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    if (req.method === 'POST') {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File) || file.size > 4_000_000 || file.size === 0)
        return Response.json(
          { error: 'Choose a file between 1 byte and 4 MB.' },
          { status: 400 },
        )
      const extension = file.name.split('.').pop()?.toLowerCase()
      const types: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      }
      if (!extension || !types[extension])
        return Response.json(
          { error: 'Supported files: PDF, DOCX, TXT, PNG, JPEG and WebP.' },
          { status: 400 },
        )
      const fileId = crypto.randomUUID()
      const key = `${user.id}/${fileId}`
      await getStore('study-documents').set(key, await file.arrayBuffer())
      try {
        const row = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(documents)
            .values({
              id: fileId,
              userId: user.id,
              name: file.name.slice(0, 200),
              type: types[extension],
              size: file.size,
              notebookId: String(form.get('notebookId') || '').slice(0, 100),
              extractedText: String(form.get('text') || '').slice(0, 200000),
            })
            .returning()
          await transactionEvent(
            tx,
            user.id,
            'document.uploaded',
            'documents',
            { bytes: file.size },
          )
          return row
        })
        return Response.json(row)
      } catch (error) {
        await getStore('study-documents').delete(key)
        throw error
      }
    }
    if (!id) return new Response(null, { status: 400 })
    const condition = and(eq(documents.id, id), eq(documents.userId, user.id))
    const [row] = await db.select().from(documents).where(condition)
    if (!row) return new Response(null, { status: 404 })
    if (req.method === 'GET') {
      const bytes = await getStore('study-documents').get(`${user.id}/${id}`, {
        type: 'arrayBuffer',
      })
      if (!bytes) return new Response(null, { status: 404 })
      if (url.searchParams.has('download'))
        await recordEvent(user.id, 'document.download.initiated', 'documents')
      return new Response(bytes, {
        headers: {
          'Content-Type': row.type,
          'Content-Disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "sandbox; default-src 'none'",
        },
      })
    }
    if (req.method === 'PATCH') {
      const { name, notebookId } = await req.json()
      if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 200 ||
        typeof notebookId !== 'string'
      )
        return new Response('Invalid document', { status: 400 })
      const updated = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(documents)
          .set({ name: name.trim(), notebookId: notebookId.slice(0, 100) })
          .where(condition)
          .returning()
        await transactionEvent(tx, user.id, 'document.updated', 'documents')
        return updated
      })
      return Response.json(updated)
    }
    if (req.method === 'DELETE') {
      await getStore('study-documents').delete(`${user.id}/${id}`)
      await db.transaction(async (tx) => {
        await tx.delete(documents).where(condition)
        await transactionEvent(tx, user.id, 'document.deleted', 'documents')
      })
      return Response.json({ ok: true })
    }
    return new Response(null, { status: 405 })
  } catch {
    return Response.json(
      { error: 'Document storage is unavailable. Please retry.' },
      { status: 503 },
    )
  }
})
export const config = { path: '/api/documents' }
